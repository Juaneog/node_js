/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import React, { useEffect, useState } from 'react';

export interface ExtendedErrorType {
  code?: number;
  message?: string;
  status?: string;
}

// Corrected filename in comment from ErrorSreen.tsx to ErrorScreen.tsx
export default function ErrorScreen() {
  const { client } = useLiveAPIContext();
  const [error, setError] = useState<ErrorEvent | null>(null);

  useEffect(() => {
    function onError(error: ErrorEvent) {
      console.error(error);
      setError(error);
    }

    (client as any).on('error', onError);

    return () => {
      (client as any).off('error', onError);
    };
  }, [client]);

  const quotaErrorMessage =
    'Gemini Live API in AI Studio has a limited free quota each day. Come back tomorrow to continue.';
  
  const serviceUnavailableKeywords = ["service is currently unavailable", "service unavailable"];
  const isServiceUnavailableError = error?.message && serviceUnavailableKeywords.some(keyword => error.message.toLowerCase().includes(keyword.toLowerCase()));

  let errorMessage = 'Something went wrong. Please try again.';
  let rawMessage: string | null = error?.message || null;
  let tryAgainOption = true;

  if (isServiceUnavailableError) {
    errorMessage = "The service is temporarily unavailable. This could be due to a temporary issue with the service or your internet connection. Please check your connection and try again using the play button.";
    // rawMessage will still be displayed
    // tryAgainOption remains true, allowing the "Close" button
  } else if (error?.message?.includes('RESOURCE_EXHAUSTED')) {
    errorMessage = quotaErrorMessage;
    rawMessage = null; // Hide raw message for quota error for cleaner UI
    tryAgainOption = false;
  }


  if (!error) {
    return <div style={{ display: 'none' }} />;
  }

  return (
    <div className="error-screen" role="alert" aria-live="assertive">
      <div
        style={{
          fontSize: 48,
        }}
        aria-hidden="true"
      >
        🐈
      </div>
      <div
        className="error-message-container"
        style={{
          fontSize: 22,
          lineHeight: 1.2,
          opacity: 0.8, // Increased opacity slightly for better readability
        }}
      >
        {errorMessage}
      </div>
      {tryAgainOption ? (
        <button
          className="close-button"
          onClick={() => {
            setError(null);
          }}
          aria-label="Close error message"
        >
          Close
        </button>
      ) : null}
      {rawMessage ? (
        <div
          className="error-raw-message-container"
          style={{
            fontSize: 15,
            lineHeight: 1.2,
            opacity: 0.5, // Increased opacity slightly
            marginTop: '16px',
          }}
        >
          <strong>Details:</strong> {rawMessage}
        </div>
      ) : null}
    </div>
  );
}