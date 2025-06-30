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

import cn from 'classnames';
import React, { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useUI } from '@/lib/state';
// Removed jsPDF import

export type ControlTrayProps = {
  children?: ReactNode;
};

function ControlTray({ children }: ControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const { 
    showAgentEdit, 
    showUserConfig,
  } = useUI(); // Removed PDF-related state
  
  const { 
    client, 
    connected, 
    connect, 
    disconnect,
    isRecordingAiAudio,
    startAiAudioRecording,
    stopAiAudioRecordingAndGetUrl
  } = useLiveAPIContext();

  const [downloadableAudioUrl, setDownloadableAudioUrl] = useState<string | null>(null);

  // Stop the current agent if the user is editing the agent or user config
  useEffect(() => {
    if (showAgentEdit || showUserConfig) {
      if (connected) disconnect();
      if (isRecordingAiAudio) { // Stop AI audio recording if active
        const url = stopAiAudioRecordingAndGetUrl();
        if (url) {
            // User might want to download this, so we set it.
            // Or decide to discard it: setDownloadableAudioUrl(null); URL.revokeObjectURL(url);
           setDownloadableAudioUrl(url); 
        }
      }
    }
  }, [showUserConfig, showAgentEdit, connected, disconnect, isRecordingAiAudio, stopAiAudioRecordingAndGetUrl]);

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };
    if (connected && !muted && audioRecorder) {
      (audioRecorder as any).on('data', onData).start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      (audioRecorder as any).off('data', onData);
    };
  }, [connected, client, muted, audioRecorder]);

  const handleConnectToggle = async () => {
    if (connected) {
      if (isRecordingAiAudio) {
        const url = stopAiAudioRecordingAndGetUrl();
        setDownloadableAudioUrl(url);
      }
      disconnect();
    } else {
      // User is initiating a new interaction phase
      // No longer clearing PDF state here
      if (downloadableAudioUrl) {
        URL.revokeObjectURL(downloadableAudioUrl);
        setDownloadableAudioUrl(null);
      }
      await connect();
    }
  };

  // Removed handleSavePdf function

  const handleToggleAiAudioRecord = () => {
    if (!connected) return; // Should not be possible if button is disabled

    if (isRecordingAiAudio) {
      const url = stopAiAudioRecordingAndGetUrl();
      setDownloadableAudioUrl(url);
    } else {
      if (downloadableAudioUrl) {
        URL.revokeObjectURL(downloadableAudioUrl); // Clean up previous URL
        setDownloadableAudioUrl(null);
      }
      startAiAudioRecording();
    }
  };

  const handleDownloadRecordedAudio = () => {
    if (downloadableAudioUrl) {
      const a = document.createElement('a');
      a.href = downloadableAudioUrl;
      a.download = 'ai_response.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Keep URL for potential re-download, or revoke and clear:
      // URL.revokeObjectURL(downloadableAudioUrl);
      // setDownloadableAudioUrl(null);
    }
  };


  return (
    <section className="control-tray">
      <nav className={cn('actions-nav', { disabled: !connected })}>
        <button
          className={cn('action-button mic-button')}
          onClick={() => setMuted(!muted)}
          disabled={!connected || muted}
          aria-disabled={!connected || muted}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        >
          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
        </button>
        {/* AI Audio Recording Button */}
        <button
          className={cn('action-button record-ai-audio-button', { 'recording': isRecordingAiAudio })}
          onClick={handleToggleAiAudioRecord}
          disabled={!connected}
          aria-disabled={!connected}
          aria-label={isRecordingAiAudio ? "Stop recording AI audio" : "Start recording AI audio"}
          title={isRecordingAiAudio ? "Stop recording AI audio" : "Start recording AI audio"}
        >
          <span className="material-symbols-outlined filled">
            {isRecordingAiAudio ? 'stop_circle' : 'fiber_manual_record'}
          </span>
        </button>
        {/* Download Recorded AI Audio Button */}
        <button
          className={cn('action-button download-ai-audio-button')}
          onClick={handleDownloadRecordedAudio}
          disabled={!downloadableAudioUrl}
          aria-disabled={!downloadableAudioUrl}
          aria-label="Download recorded AI audio"
          title="Download recorded AI audio"
        >
          <span className="material-symbols-outlined filled">file_download</span>
        </button>
        {/* Removed Save PDF button */}
        {children}
      </nav>

      <div className={cn('connection-container', { connected })}>
        <div className="connection-button-container">
          <button
            ref={connectButtonRef}
            className={cn('action-button connect-toggle', { connected })}
            onClick={handleConnectToggle}
            aria-label={connected ? "Pause session" : "Start session"}
          >
            <span className="material-symbols-outlined filled">
              {connected ? 'pause' : 'play_arrow'}
            </span>
          </button>
        </div>
        <span className="text-indicator">{connected ? 'Streaming' : 'Paused'}</span>
      </div>
    </section>
  );
}

export default memo(ControlTray);