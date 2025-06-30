/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef } from 'react';
import { Modality, LiveServerMessage } from '@google/genai';

import BasicFace from '../basic-face/BasicFace';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { createSystemInstructions } from '@/lib/prompts';
import { useAgent, useUser, useUI } from '@/lib/state';

export default function KeynoteCompanion() {
  const { client, connected, setConfig } = useLiveAPIContext();
  const user = useUser();
  const { current } = useAgent();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Removed PDF-related state from useUI

  // Set the configuration for the Live API
  useEffect(() => {
    setConfig({
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: current.voice },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: createSystemInstructions(current, user),
          },
        ],
      },
    });
  }, [setConfig, user, current]);

  // Initiate the session when the Live API connection is established
  // Instruct the model to send an initial greeting message
  useEffect(() => {
    const beginSession = async () => {
      if (!connected) return;
      // Clear any previous response state before starting a new session/greeting
      // No longer clearing PDF related state here

      client.send(
        {
          text: 'Greet the user and introduce yourself and your role.',
        },
        true
      );
    };
    beginSession();
  }, [client, connected]);

  // Removed useEffect for PDF content collection ('content' and 'turncomplete' listeners)

  return (
    <div className="keynote-companion">
      <BasicFace canvasRef={canvasRef} color={current.bodyColor} />
    </div>
  );
}