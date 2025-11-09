"use client";

import { useEffect } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

interface ThankYouOverlayProps {
  isVisible: boolean;
  message: string;
  onClose: () => void;
}

export default function ThankYouOverlay({
  isVisible,
  message,
  onClose,
}: ThankYouOverlayProps) {
  useEffect(() => {
    if (isVisible) {
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-fadeIn"
      style={{
        animation: "fadeIn 0.5s ease-in, fadeOut 0.5s ease-out 2.5s forwards",
      }}
    >
      <div className="text-center px-8 animate-scaleIn">
        {/* Animated Check Icon */}
        <div className="flex justify-center mb-6">
          <CheckCircleIcon
            className="h-24 w-24 text-white animate-bounce"
            style={{ animation: "bounce 0.6s ease-out" }}
          />
        </div>

        {/* Thank You Message */}
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 drop-shadow-lg">
          Thank You! 🎉
        </h1>

        {/* Custom Message */}
        <p className="text-2xl md:text-3xl text-white/90 font-medium drop-shadow">
          {message}
        </p>

        {/* Fun Decorative Elements */}
        <div className="mt-8 flex justify-center gap-3">
          <span className="text-4xl animate-wiggle" style={{ animationDelay: "0s" }}>✨</span>
          <span className="text-4xl animate-wiggle" style={{ animationDelay: "0.1s" }}>🎊</span>
          <span className="text-4xl animate-wiggle" style={{ animationDelay: "0.2s" }}>🎈</span>
          <span className="text-4xl animate-wiggle" style={{ animationDelay: "0.3s" }}>🎉</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes wiggle {
          0%,
          100% {
            transform: rotate(0deg) scale(1);
          }
          25% {
            transform: rotate(-10deg) scale(1.1);
          }
          75% {
            transform: rotate(10deg) scale(1.1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-in;
        }

        .animate-scaleIn {
          animation: scaleIn 0.6s ease-out;
        }

        .animate-wiggle {
          animation: wiggle 1s ease-in-out infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}


