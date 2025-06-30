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

// Function to write a string to a DataView
function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Encodes PCM16 audio data into a WAV file Blob.
 * @param pcm16Data The Int16Array containing the PCM data.
 * @param sampleRate The sample rate of the audio (e.g., 24000 for AI audio).
 * @param numChannels The number of channels (e.g., 1 for mono).
 * @returns A Blob representing the WAV file.
 */
export function encodeWAVFromPCM16(pcm16Data: Int16Array, sampleRate: number, numChannels: number): Blob {
  const bytesPerSample = 2; // Int16 is 2 bytes
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm16Data.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize); // 44 bytes for WAV header
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk size
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');

  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  // FMT chunk size
  view.setUint32(16, 16, true); // 16 for PCM
  // Audio format (PCM)
  view.setUint16(20, 1, true);
  // Number of channels
  view.setUint16(22, numChannels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate
  view.setUint32(28, byteRate, true);
  // Block align
  view.setUint16(32, blockAlign, true);
  // Bits per sample
  view.setUint16(34, 16, true); // 16-bit PCM

  // Data sub-chunk
  writeString(view, 36, 'data');
  // Data chunk size
  view.setUint32(40, dataSize, true);

  // Write PCM data
  for (let i = 0; i < pcm16Data.length; i++) {
    view.setInt16(44 + i * 2, pcm16Data[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
}
