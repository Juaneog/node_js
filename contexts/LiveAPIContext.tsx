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

import React, { createContext, FC, ReactNode, useContext } from 'react';
import { useLiveApi, UseLiveApiResults } from '../hooks/media/use-live-api';

const LiveAPIContext = createContext<UseLiveApiResults | undefined>(undefined);

export type LiveAPIProviderProps = {
  children: ReactNode;
  apiKey: string;
};

// This variable will hold the context value outside of React's lifecycle
// for specific internal uses where hook rules might be an issue due to conditional rendering.
// USE WITH EXTREME CAUTION and only when necessary.
let internalLiveApiContextValue: UseLiveApiResults | undefined = undefined;


export const LiveAPIProvider: FC<LiveAPIProviderProps> = ({
  apiKey,
  children,
}) => {
  const liveAPI = useLiveApi({ apiKey });
  internalLiveApiContextValue = liveAPI; // Store the value for internal access

  return (
    <LiveAPIContext.Provider value={liveAPI}>
      {children}
    </LiveAPIContext.Provider>
  );
};

export const useLiveAPIContext = () => {
  const context = useContext(LiveAPIContext);
  if (!context) {
    throw new Error('useLiveAPIContext must be used wihin a LiveAPIProvider');
  }
  return context;
};

/**
 * INTERNAL USE ONLY: Accesses the Live API context value directly.
 * This is intended for scenarios where React Hook rules prevent direct use of `useContext`,
 * such as within conditional rendering logic in the main App component that sets up the provider itself.
 * This function does NOT behave like a hook and will not cause re-renders if the context value changes.
 * It's a snapshot of the context value at the time the provider was last rendered.
 *
 * @private
 * @returns The current Live API context value, or undefined if not yet available.
 */
export const useLiveAPIContext_INTERNAL_DO_NOT_USE = (): UseLiveApiResults => {
  if (!internalLiveApiContextValue) {
    // This could happen if called before LiveAPIProvider has rendered and set the value.
    // Or if LiveAPIProvider is not an ancestor.
    // To handle cases where it might be legitimately undefined initially during setup,
    // we return a shell object that won't immediately break, but functionalities will be no-op or default.
    // This is safer than throwing an error if AppContent might render momentarily before the context is fully set up.
    console.warn('INTERNAL_DO_NOT_USE: LiveAPIContext not fully available. Returning a shell.');
    return {
      client: { send: () => {}, sendRealtimeInput: () => {}, on: () => {}, off: () => {} } as any, // Provide minimal shell
      setConfig: () => {},
      config: {},
      connect: async () => {},
      disconnect: () => {},
      connected: false,
      volume: 0,
      isRecordingAiAudio: false,
      startAiAudioRecording: () => {},
      stopAiAudioRecordingAndGetUrl: () => null,
    };
  }
  return internalLiveApiContextValue;
};