"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import PinturaEditorModal from "@/components/PinturaEditorModal";

type UploadStatus = "idle" | "loading" | "uploading" | "success" | "error" | "expired";
type ActionMode = "select" | "processing" | "remove-bg" | "edit" | "upload";

interface SessionInfo {
  slotIndex: number;
  status: string;
  expiresAt: number;
}

export default function MobileUploadPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [status, setStatus] = useState<UploadStatus>("loading");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null); // Keep original for comparison
  const [isUploading, setIsUploading] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>("select");
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Validate session on mount
  useEffect(() => {
    const validateSession = async () => {
      try {
        const response = await fetch(`/api/sticker-upload/session?sessionId=${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
          setStatus("expired");
          setErrorMessage(data.error || "This link has expired or is invalid.");
          return;
        }

        if (data.session.status === "completed") {
          setStatus("success");
          setSessionInfo(data.session);
          return;
        }

        if (data.session.status === "expired") {
          setStatus("expired");
          setErrorMessage("This upload link has expired. Please scan a new QR code.");
          return;
        }

        setSessionInfo(data.session);
        setStatus("idle");
      } catch (error) {
        console.error("Error validating session:", error);
        setStatus("error");
        setErrorMessage("Unable to connect. Please check your internet connection.");
      }
    };

    validateSession();
  }, [sessionId]);

  // Handle file selection
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewUrl(dataUrl);
      setOriginalPreviewUrl(dataUrl); // Store original
      setActionMode("processing"); // Show action options
    };
    reader.readAsDataURL(file);
  };

  // Handle background removal
  const handleRemoveBackground = async () => {
    if (!previewUrl) return;

    setIsProcessingBg(true);
    setActionMode("remove-bg");

    try {
      const response = await fetch("/api/sticker-upload/remove-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: previewUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Background removal failed");
      }

      // Update preview with background-removed image
      setPreviewUrl(data.imageBase64);
      setActionMode("remove-bg"); // Show accept/reject options
    } catch (error) {
      console.error("Background removal error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove background. Please try again.");
      setActionMode("processing"); // Go back to action selection
    } finally {
      setIsProcessingBg(false);
    }
  };

  // Accept background-removed image
  const handleAcceptBgRemoved = () => {
    // Keep the current previewUrl (which is the bg-removed version)
    setActionMode("processing"); // Go back to action options
  };

  // Reject background-removed image, revert to original
  const handleRejectBgRemoved = () => {
    if (originalPreviewUrl) {
      setPreviewUrl(originalPreviewUrl);
    }
    setActionMode("processing"); // Go back to action options
  };

  // Handle edit image - open Pintura editor
  const handleEditImage = () => {
    setShowEditor(true);
    setActionMode("edit");
  };

  // Handle editor process (save)
  const handleEditorProcess = (result: { dest: File }) => {
    // Convert File to base64 data URL for upload compatibility
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewUrl(dataUrl);
      setOriginalPreviewUrl(dataUrl); // Update original too
      setShowEditor(false);
      setActionMode("processing"); // Go back to action options
    };
    reader.onerror = () => {
      console.error("Failed to read edited image");
      setShowEditor(false);
      setActionMode("processing");
    };
    reader.readAsDataURL(result.dest);
  };

  // Handle editor hide (cancel)
  const handleEditorHide = () => {
    setShowEditor(false);
    setActionMode("processing"); // Go back to action options
  };

  // Handle upload
  const handleUpload = async () => {
    if (!previewUrl) return;

    setIsUploading(true);
    setStatus("uploading");

    try {
      const response = await fetch("/api/sticker-upload/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          imageBase64: previewUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setStatus("success");
    } catch (error) {
      console.error("Upload error:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Clear preview and reset
  const handleClear = () => {
    setPreviewUrl(null);
    setOriginalPreviewUrl(null);
    setActionMode("select");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Connecting...</p>
        </div>
      </div>
    );
  }

  // Expired/Error state
  if (status === "expired" || (status === "error" && !previewUrl)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Link Expired</h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <p className="text-sm text-gray-500">
            Go back to the kiosk and tap the sticker circle to generate a new QR code.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Upload Complete!</h1>
          <p className="text-gray-600 mb-6">
            Your photo has been added to sticker #{(sessionInfo?.slotIndex ?? 0) + 1} on the kiosk.
          </p>
          <p className="text-sm text-gray-500">
            You can now close this page and return to the kiosk.
          </p>
        </div>
      </div>
    );
  }

  // Main upload UI
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-purple-50 to-indigo-50 flex flex-col p-4">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
          Add Your Photo
        </h1>
        <p className="text-gray-600 mt-1">
          Sticker #{(sessionInfo?.slotIndex ?? 0) + 1}
        </p>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center py-6">
        {previewUrl ? (
          <div className="relative">
            {/* Preview circle */}
            <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-white shadow-xl bg-white relative">
              <Image
                src={previewUrl}
                alt="Preview"
                fill
                className="object-cover"
                sizes="256px"
              />
              
              {/* Loading overlay when processing background removal */}
              {isProcessingBg && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                  <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3" />
                  <p className="text-white font-semibold text-sm">Removing background...</p>
                  <p className="text-white/80 text-xs mt-1">This may take a few seconds</p>
                </div>
              )}
            </div>
            {/* Clear button */}
            {actionMode !== "edit" && !isProcessingBg && (
              <button
                onClick={handleClear}
                className="absolute -top-2 -right-2 w-10 h-10 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-20"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="w-64 h-64 rounded-full border-4 border-dashed border-gray-300 bg-white/50 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Select a photo</p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 max-w-sm mx-auto w-full pb-8">
        {actionMode === "select" && !previewUrl ? (
          <>
            {/* Camera button */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-semibold text-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take Photo
            </button>

            {/* Gallery button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 px-6 bg-white text-gray-700 border-2 border-gray-200 rounded-2xl font-semibold text-lg shadow-md active:scale-95 transition-transform flex items-center justify-center gap-3"
            >
              <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Choose from Gallery
            </button>
          </>
        ) : actionMode === "processing" && previewUrl ? (
          <>
            {/* Three action options */}
            <div className="space-y-3">
              {/* Remove Background */}
              <button
                onClick={handleRemoveBackground}
                disabled={isProcessingBg}
                className={`w-full py-4 px-6 rounded-2xl font-semibold text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${
                  isProcessingBg
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-500 to-cyan-600 text-white active:scale-95"
                }`}
              >
                {isProcessingBg ? (
                  <>
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Remove Background
                  </>
                )}
              </button>

              {/* Edit Image */}
              <button
                onClick={handleEditImage}
                disabled={isProcessingBg}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl font-semibold text-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Image
              </button>

              {/* Upload */}
              <button
                onClick={handleUpload}
                disabled={isUploading || isProcessingBg}
                className={`w-full py-4 px-6 rounded-2xl font-semibold text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${
                  isUploading || isProcessingBg
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-gradient-to-r from-green-500 to-emerald-600 text-white active:scale-95"
                }`}
              >
                {isUploading ? (
                  <>
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload to Kiosk
                  </>
                )}
              </button>
            </div>

            {/* Change photo button */}
            <button
              onClick={handleClear}
              disabled={isUploading || isProcessingBg}
              className="w-full py-3 px-6 text-gray-600 font-medium active:scale-95 transition-transform disabled:opacity-50"
            >
              Choose Different Photo
            </button>
          </>
        ) : actionMode === "remove-bg" && previewUrl ? (
          <>
            {/* Accept/Reject background removal */}
            <div className="space-y-3">
              <p className="text-center text-sm text-gray-600 mb-2">
                Background removed! Keep this or use original?
              </p>
              
              <button
                onClick={handleAcceptBgRemoved}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-semibold text-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Keep This (No Background)
              </button>

              <button
                onClick={handleRejectBgRemoved}
                className="w-full py-4 px-6 bg-white text-gray-700 border-2 border-gray-200 rounded-2xl font-semibold text-lg shadow-md active:scale-95 transition-transform flex items-center justify-center gap-3"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Use Original
              </button>
            </div>
          </>
        ) : null}

        {/* Error message */}
        {status === "error" && errorMessage && (
          <div className="bg-red-100 text-red-700 rounded-xl p-4 text-center">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Pintura Editor Modal */}
      {showEditor && previewUrl && (
        <PinturaEditorModal
          imageSrc={previewUrl}
          isVisible={showEditor}
          onHide={handleEditorHide}
          onProcess={handleEditorProcess}
        />
      )}
    </div>
  );
}
