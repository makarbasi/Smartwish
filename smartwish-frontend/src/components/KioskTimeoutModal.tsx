"use client";

import { useEffect, useState } from "react";

interface KioskTimeoutModalProps {
  isOpen: boolean;
  onStillHere: () => void;
  onStartFresh: () => void;
  onTimeout: () => void;
  countdownSeconds?: number;
}

export function KioskTimeoutModal({
  isOpen,
  onStillHere,
  onStartFresh,
  onTimeout,
  countdownSeconds = 60,
}: KioskTimeoutModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);

  // Reset countdown when modal opens
  useEffect(() => {
    if (isOpen) {
      setSecondsLeft(countdownSeconds);
    }
  }, [isOpen, countdownSeconds]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onTimeout]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl p-10 max-w-2xl w-full mx-6 border border-white/10">
        {/* Warning Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg
              className="w-14 h-14 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-4xl font-bold text-white text-center mb-4">
          Are you still there?
        </h2>

        {/* Countdown */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse">
              {secondsLeft}
            </div>
            <div className="text-center text-gray-400 text-lg mt-2">
              seconds remaining
            </div>
          </div>
        </div>

        {/* Message */}
        <p className="text-xl text-gray-300 text-center mb-10">
          To continue your session, please let us know you're still here.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {/* Yes, I'm still here button */}
          <button
            onClick={onStillHere}
            className="group relative px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xl font-semibold rounded-2xl shadow-lg hover:shadow-indigo-500/50 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <span className="flex items-center gap-3">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Yes, I'm Still Here
            </span>
          </button>

          {/* Start Fresh button */}
          <button
            onClick={onStartFresh}
            className="group relative px-10 py-5 bg-gradient-to-r from-gray-700 to-gray-800 text-white text-xl font-semibold rounded-2xl shadow-lg hover:shadow-gray-700/50 transition-all duration-300 hover:scale-105 active:scale-95 border border-gray-600"
          >
            <span className="flex items-center gap-3">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Start Fresh
            </span>
          </button>
        </div>

        {/* Small hint text */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Your session will restart automatically when the timer reaches zero
        </p>
      </div>
    </div>
  );
}
