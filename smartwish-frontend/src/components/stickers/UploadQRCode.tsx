"use client";

import { useState, useEffect, useCallback } from "react";
import { XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import QRCode from "qrcode";

interface UploadQRCodeProps {
  slotIndex: number;
  kioskSessionId: string;
  onUploadComplete: (slotIndex: number, imageBase64: string) => void;
  onClose: () => void;
}

type QRStatus = "generating" | "ready" | "waiting" | "completed" | "error" | "expired";

/**
 * UploadQRCode - Displays a QR code for mobile upload
 * Polls for upload completion and notifies parent when image is received
 */
export default function UploadQRCode({
  slotIndex,
  kioskSessionId,
  onUploadComplete,
  onClose,
}: UploadQRCodeProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<QRStatus>("generating");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Generate QR code session
  const generateSession = useCallback(async () => {
    setStatus("generating");
    setErrorMessage("");

    try {
      const response = await fetch("/api/sticker-upload/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotIndex, kioskSessionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate upload link");
      }

      setSessionId(data.sessionId);
      setExpiresAt(data.expiresAt);

      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(data.uploadUrl, {
        width: 280,
        margin: 2,
        color: { dark: "#1e1e1e", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });

      setQrCodeDataUrl(qrDataUrl);
      setStatus("ready");
    } catch (error) {
      console.error("Error generating QR session:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate QR code");
    }
  }, [slotIndex, kioskSessionId]);

  // Generate session on mount
  useEffect(() => {
    generateSession();
  }, [generateSession]);

  // Poll for upload completion
  useEffect(() => {
    if (!sessionId || status === "completed" || status === "expired" || status === "error") {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sticker-upload/session?sessionId=${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setStatus("expired");
            clearInterval(pollInterval);
          }
          return;
        }

        if (data.session.status === "completed" && data.session.imageBase64) {
          setStatus("completed");
          clearInterval(pollInterval);
          // Notify parent with the uploaded image
          onUploadComplete(slotIndex, data.session.imageBase64);
        } else if (data.session.status === "expired") {
          setStatus("expired");
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.warn("Poll error:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [sessionId, status, slotIndex, onUploadComplete]);

  // Update countdown timer
  useEffect(() => {
    if (!expiresAt || status === "completed") return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, expiresAt - now);

      if (remaining === 0) {
        setStatus("expired");
        setTimeRemaining("Expired");
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, status]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Upload from Phone</h2>
              <p className="text-white/80 text-sm">Sticker #{slotIndex + 1}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Generating state */}
          {status === "generating" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Generating QR code...</p>
            </div>
          )}

          {/* Ready/Waiting state */}
          {(status === "ready" || status === "waiting") && qrCodeDataUrl && (
            <div className="text-center">
              {/* QR Code */}
              <div className="relative inline-block mb-4">
                <div className="p-4 bg-white rounded-2xl shadow-lg border-2 border-gray-100">
                  <img
                    src={qrCodeDataUrl}
                    alt="Scan to upload"
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                {/* Phone icon overlay */}
                <div className="absolute -bottom-3 -right-3 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-3">
                <p className="text-gray-800 font-semibold">
                  Scan with your phone camera
                </p>
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Waiting for upload
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="font-mono">{timeRemaining}</span>
                </div>
              </div>

              {/* Steps */}
              <div className="mt-6 grid grid-cols-3 gap-2 text-xs text-gray-500">
                <div className="flex flex-col items-center p-2 bg-gray-50 rounded-xl">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold mb-1">1</span>
                  <span>Scan QR</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 rounded-xl">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold mb-1">2</span>
                  <span>Take/Choose Photo</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 rounded-xl">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold mb-1">3</span>
                  <span>Upload</span>
                </div>
              </div>
            </div>
          )}

          {/* Completed state */}
          {status === "completed" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Photo Received!</h3>
              <p className="text-gray-600">Your photo has been added to the sticker.</p>
            </div>
          )}

          {/* Expired state */}
          {status === "expired" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">QR Code Expired</h3>
              <p className="text-gray-600 mb-4">The upload link has timed out.</p>
              <button
                onClick={generateSession}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                <ArrowPathIcon className="w-5 h-5" />
                Generate New QR Code
              </button>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h3>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
              <button
                onClick={generateSession}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                <ArrowPathIcon className="w-5 h-5" />
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(status === "ready" || status === "waiting") && (
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Cancel and go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
