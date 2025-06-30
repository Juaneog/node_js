/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { audioContext } from './utils';
import AudioRecordingWorklet from './worklets/audio-processing';
import VolMeterWorket from './worklets/vol-meter';

import { createWorketFromSrc } from './audioworklet-registry';
import EventEmitter from 'eventemitter3';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

interface AudioRecorderEvents {
  data: [base64: string];
  volume: [volume: number];
  error: [error: Error];
}

export class AudioRecorder extends EventEmitter<AudioRecorderEvents> {
  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;

  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {
    super();
  }

  async start(): Promise<this> { // Return `this` for chaining, as per EventEmitter `on`
    if (this.starting) {
      await this.starting;
      return this;
    }
    if (this.recording) {
      return this;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error = new Error('getUserMedia not supported on this browser.');
      (this as any).emit('error', error);
      throw error;
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = await audioContext({ sampleRate: this.sampleRate });
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        const workletName = 'audio-recorder-worklet';
        const src = createWorketFromSrc(workletName, AudioRecordingWorklet);

        await this.audioContext.audioWorklet.addModule(src);
        this.recordingWorklet = new AudioWorkletNode(
          this.audioContext,
          workletName
        );

        this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
          const arrayBuffer = ev.data.data.int16arrayBuffer;
          if (arrayBuffer) {
            const arrayBufferString = arrayBufferToBase64(arrayBuffer);
            (this as any).emit('data', arrayBufferString);
          }
        };
        this.source.connect(this.recordingWorklet);

        const vuWorkletName = 'vu-meter';
        await this.audioContext.audioWorklet.addModule(
          createWorketFromSrc(vuWorkletName, VolMeterWorket)
        );
        this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
        this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
          (this as any).emit('volume', ev.data.volume);
        };

        this.source.connect(this.vuWorklet);
        this.recording = true;
        resolve();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error starting audio recording:', error);
        (this as any).emit('error', error);
        this.stop(); // Clean up on error
        reject(error);
      } finally {
        this.starting = null;
      }
    });
    await this.starting;
    return this;
  }

  stop() {
    const handleStop = () => {
      if (this.source) {
        this.source.disconnect();
        this.source = undefined;
      }
      if (this.recordingWorklet) {
        this.recordingWorklet.port.onmessage = null;
        this.recordingWorklet.disconnect();
        this.recordingWorklet = undefined;
      }
      if (this.vuWorklet) {
        this.vuWorklet.port.onmessage = null;
        this.vuWorklet.disconnect();
        this.vuWorklet = undefined;
      }
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = undefined;
      // Do not close or suspend the audioContext here, as it might be shared or reused.
      // this.audioContext?.close(); // Consider if context should be closed
      // this.audioContext = undefined;
      this.recording = false;
    };

    if (this.starting) {
      this.starting.finally(handleStop); // Use finally to ensure stop logic runs
    } else {
      handleStop();
    }
  }
}