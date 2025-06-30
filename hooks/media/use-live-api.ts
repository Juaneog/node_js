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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { DEFAULT_LIVE_API_MODEL } from '../../lib/constants';
import { encodeWAVFromPCM16 } from '../../lib/wav-encoder'; // Import WAV encoder

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  connected: boolean;

  volume: number;

  // AI Audio Recording
  isRecordingAiAudio: boolean;
  startAiAudioRecording: () => void;
  stopAiAudioRecordingAndGetUrl: () => string | null;
};

export function useLiveApi({
  apiKey,
  model = DEFAULT_LIVE_API_MODEL,
}: {
  apiKey: string;
  model?: string;
}): UseLiveApiResults {
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});

  // AI Audio Recording State
  const [isRecordingAiAudio, setIsRecordingAiAudio] = useState(false);
  const [aiAudioChunks, setAiAudioChunks] = useState<ArrayBuffer[]>([]);
  const aiSampleRate = 24000; // AI audio is 24kHz
  const aiNumChannels = 1; // AI audio is mono

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
      // Stop recording if connection closes
      if (isRecordingAiAudio) {
        setIsRecordingAiAudio(false);
        // Current recording is lost if connection drops; user would need to re-record.
        setAiAudioChunks([]); 
      }
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onAudio = (data: ArrayBuffer) => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
      if (isRecordingAiAudio) {
        // Ensure data is valid and has content before adding
        if (data && data.byteLength > 0) {
          setAiAudioChunks(prevChunks => [...prevChunks, data]);
        }
      }
    };

    // Bind event listeners
    (client as any).on('open', onOpen);
    (client as any).on('close', onClose);
    (client as any).on('interrupted', stopAudioStreamer);
    (client as any).on('audio', onAudio);

    return () => {
      // Clean up event listeners
      (client as any).off('open', onOpen);
      (client as any).off('close', onClose);
      (client as any).off('interrupted', stopAudioStreamer);
      (client as any).off('audio', onAudio);
    };
  }, [client, isRecordingAiAudio]); // isRecordingAiAudio dependency is correct

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('config has not been set');
    }
    client.disconnect();
    await client.connect(config);
  }, [client, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [client]);


  const startAiAudioRecording = useCallback(() => {
    setIsRecordingAiAudio(true);
    setAiAudioChunks([]); // Clear any previous chunks
  }, []);

  const stopAiAudioRecordingAndGetUrl = useCallback(() => {
    setIsRecordingAiAudio(false);
    
    // Process a copy of the chunks and clear the state immediately
    const currentChunks = [...aiAudioChunks];
    setAiAudioChunks([]); 

    if (currentChunks.length === 0) {
      return null;
    }

    let totalLength = 0;
    currentChunks.forEach(chunk => {
      totalLength += chunk.byteLength;
    });

    // If, despite the check in onAudio, totalLength is 0, it means no actual data bytes were collected.
    if (totalLength === 0) {
        console.warn("No actual audio data recorded, though chunk entries were present. Resulting WAV will be silent.");
        // Proceed to create a header-only WAV, which is valid.
    }

    const concatenated = new Uint8Array(totalLength);
    let offset = 0;
    currentChunks.forEach(chunk => {
      concatenated.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    });

    if (concatenated.buffer.byteLength % 2 !== 0) {
        console.error("Concatenated audio data length is not a multiple of 2. Cannot convert to Int16Array properly.");
        return null; 
    }
    const pcm16Data = new Int16Array(concatenated.buffer);
    
    const wavBlob = encodeWAVFromPCM16(pcm16Data, aiSampleRate, aiNumChannels);

    // A valid WAV header is 44 bytes. If the blob is smaller, something is wrong.
    // If pcm16Data is empty, blob size will be 44.
    if (!wavBlob || wavBlob.size < 44) {
        console.error("WAV Blob creation failed or resulted in an unexpectedly small blob (size: " + wavBlob?.size + ").");
        return null;
    }

    const url = URL.createObjectURL(wavBlob);
    return url;
  }, [aiAudioChunks, aiSampleRate, aiNumChannels]); // setAiAudioChunks is implicitly covered by aiAudioChunks

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    volume,
    isRecordingAiAudio,
    startAiAudioRecording,
    stopAiAudioRecordingAndGetUrl,
  };
}