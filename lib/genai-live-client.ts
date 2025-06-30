/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  Session,
} from '@google/genai';
import EventEmitter from 'eventemitter3';
import { DEFAULT_LIVE_API_MODEL } from './constants';
import { difference } from 'lodash';
import { base64ToArrayBuffer } from './utils';

/**
 * Represents a single log entry in the system.
 * Used for tracking and displaying system events, messages, and errors.
 */
export interface StreamingLog {
  // Optional count for repeated log entries
  count?: number;
  // Optional additional data associated with the log
  data?: unknown;
  // Timestamp of when the log was created
  date: Date;
  // The log message content
  message: string | object;
  // The type/category of the log entry
  type: string;
}

/**
 * Event types that can be emitted by the MultimodalLiveClient.
 * Each event corresponds to a specific message from GenAI or client state change.
 */
export interface LiveClientEventTypes {
  audio: [data: ArrayBuffer];
  close: [event: CloseEvent];
  content: [data: LiveServerContent];
  error: [e: ErrorEvent];
  interrupted: [];
  log: [log: StreamingLog];
  open: [];
  setupcomplete: [];
  toolcall: [toolCall: LiveServerToolCall];
  toolcallcancellation: [
    toolcallCancellation: LiveServerToolCallCancellation
  ];
  turncomplete: [];
}

export class GenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  public readonly model: string = DEFAULT_LIVE_API_MODEL;

  protected readonly client: GoogleGenAI;
  protected session?: Session;

  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  public get status() {
    return this._status;
  }

  /**
   * Creates a new GenAILiveClient instance.
   * @param apiKey - API key for authentication with Google GenAI
   * @param model - Optional model name to override the default model
   */
  constructor(apiKey: string, model?: string) {
    super();
    if (model) this.model = model;

    this.client = new GoogleGenAI({
      apiKey: apiKey,
    });
  }

  public async connect(config: LiveConnectConfig): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      this.log('client.connect', 'Connection attempt while already connected or connecting.');
      return false;
    }

    this._status = 'connecting';
    this.log('client.connect', `Attempting to connect with config: ${JSON.stringify(config)}`);
    const callbacks: LiveCallbacks = {
      onopen: this.onOpen.bind(this),
      onmessage: this.onMessage.bind(this),
      onerror: this.onError.bind(this),
      onclose: this.onClose.bind(this),
    };

    try {
      this.session = await this.client.live.connect({
        model: this.model,
        config: {
          ...config,
        },
        callbacks,
      });
    } catch (e) {
      const errorEvent = e instanceof ErrorEvent ? e : new ErrorEvent('error', { error: e, message: (e as Error).message });
      console.error('Error connecting to GenAI Live:', errorEvent);
      this._status = 'disconnected';
      this.session = undefined;
      this.onError(errorEvent); // Ensure error is emitted
      return false;
    }

    // onOpen callback will set status to 'connected'
    return true;
  }

  public disconnect() {
    if (this.session) {
      this.session.close();
      this.session = undefined;
    }
    // onClose callback will set status to 'disconnected' if not already
    // Forcing status here in case close event doesn't fire as expected or is delayed
    if (this._status !== 'disconnected') {
       this._status = 'disconnected';
       this.log('client.disconnect', `Disconnected by client call.`);
       // Manually emit close if no session was active to trigger it
       if (!this.session) {
         (this as any).emit('close', new CloseEvent('clientdisconnect', {reason: 'Client initiated disconnect'}));
       }
    }
    return true;
  }

  public send(parts: Part | Part[], turnComplete: boolean = true) {
    if (this._status !== 'connected' || !this.session) {
      const error = new ErrorEvent('error', {message: 'Client is not connected'});
      (this as any).emit('error', error);
      this.log('client.send.error', 'Attempted to send when not connected.');
      return;
    }
    this.session.sendClientContent({ turns: parts, turnComplete });
    this.log(`client.send`, parts);
  }

  public sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (this._status !== 'connected' || !this.session) {
      const error = new ErrorEvent('error', {message: 'Client is not connected'});
      (this as any).emit('error', error);
      this.log('client.realtimeInput.error', 'Attempted to send realtime input when not connected.');
      return;
    }
    chunks.forEach(chunk => {
      this.session!.sendRealtimeInput({ media: chunk });
    });

    let hasAudio = false;
    let hasVideo = false;
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      if (ch.mimeType.includes('audio')) hasAudio = true;
      if (ch.mimeType.includes('image')) hasVideo = true;
      if (hasAudio && hasVideo) break;
    }

    let message = 'unknown';
    if (hasAudio && hasVideo) message = 'audio + video';
    else if (hasAudio) message = 'audio';
    else if (hasVideo) message = 'video';
    this.log(`client.realtimeInput`, message);
  }

  public sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (this._status !== 'connected' || !this.session) {
      const error = new ErrorEvent('error', {message: 'Client is not connected'});
      (this as any).emit('error', error);
      this.log('client.toolResponse.error', 'Attempted to send tool response when not connected.');
      return;
    }
    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      this.session.sendToolResponse({
        functionResponses: toolResponse.functionResponses!,
      });
    }

    this.log(`client.toolResponse`, { toolResponse });
  }

  protected onMessage(message: LiveServerMessage) {
    this.log('server.message', message);
    if (message.setupComplete) {
      (this as any).emit('setupcomplete');
      return;
    }
    if (message.toolCall) {
      (this as any).emit('toolcall', message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      (this as any).emit('toolcallcancellation', message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;
      if ('interrupted' in serverContent) {
        (this as any).emit('interrupted');
        return;
      }
      if ('turnComplete' in serverContent) {
        (this as any).emit('turncomplete');
      }

      if (serverContent.modelTurn) {
        let parts: Part[] = serverContent.modelTurn.parts || [];

        const audioParts = parts.filter(p =>
          p.inlineData?.mimeType?.startsWith('audio/pcm')
        );
        const base64s = audioParts.map(p => p.inlineData?.data);
        const otherParts = difference(parts, audioParts);

        base64s.forEach(b64 => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            (this as any).emit('audio', data);
            this.log(`server.audio`, `buffer (${data.byteLength})`);
          }
        });
        if (!otherParts.length) {
          return;
        }

        parts = otherParts;

        const content: LiveServerContent = { modelTurn: { parts } };
        (this as any).emit('content', content);
      } else {
        // This case should ideally not happen if messages are well-formed
        this.log('server.message.unmatched', message);
      }
    }
  }

  protected onError(e: ErrorEvent) {
    // Prevent multiple disconnect operations if already disconnected
    if (this._status !== 'disconnected') {
        this._status = 'disconnected';
        this.session = undefined; // Ensure session is cleared on error
    }
    console.error('GenAILiveClient error:', e);
    const message = `GenAI Live Error: ${e.message || 'Unknown error'}`;
    this.log(`server.${e.type || 'error'}`, message);
    (this as any).emit('error', e);
  }

  protected onOpen() {
    this._status = 'connected';
    this.log('server.open', 'Connection opened.');
    (this as any).emit('open');
  }

  protected onClose(e: CloseEvent) {
     // Prevent multiple disconnect operations
    if (this._status !== 'disconnected') {
        this._status = 'disconnected';
        this.session = undefined; // Ensure session is cleared on close
    }
    let reason = e.reason || '';
    if (reason.toLowerCase().includes('error')) {
      const prelude = 'ERROR]';
      const preludeIndex = reason.indexOf(prelude);
      if (preludeIndex > 0) {
        reason = reason.slice(preludeIndex + prelude.length + 1, Infinity);
      }
    }

    this.log(
      `server.${e.type}`,
      `disconnected ${reason ? `with reason: ${reason}` : `(code: ${e.code})`}`
    );
    (this as any).emit('close', e);
  }

  /**
   * Internal method to emit a log event.
   * @param type - Log type
   * @param message - Log message
   */
  protected log(type: string, message: string | object) {
    (this as any).emit('log', {
      type,
      message,
      date: new Date(),
    });
  }
}