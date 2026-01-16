'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateEditedImage } from '../../services/pixshop-geminiService';
import Spinner from './Spinner';
import { UndoIcon, RedoIcon, EyeIcon, CheckIcon } from './icons';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  if (arr.length < 2) throw new Error("Invalid data URL format");
  
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

interface AIEditorProps {
  currentImageSrc: string;
  onImageUpdate: (newImageSrc: string) => void;
  onClose: () => void;
}

const AIEditor: React.FC<AIEditorProps> = ({ 
  currentImageSrc, 
  onImageUpdate,
  onClose
}) => {
  // State management
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current image access and history management
  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);

  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Update the parent with the new image
    const newImageUrl = URL.createObjectURL(newImageFile);
    onImageUpdate(newImageUrl);
  }, [history, historyIndex, onImageUpdate]);

  // Initialize history with current image
  useEffect(() => {
    const initializeHistory = async () => {
      if (currentImageSrc && history.length === 0) {
        try {
          const response = await fetch(currentImageSrc);
          const blob = await response.blob();
          const file = new File([blob], 'current.png', { type: blob.type });
          setHistory([file]);
          setHistoryIndex(0);
        } catch (error) {
          console.error('Failed to initialize history:', error);
        }
      }
    };
    initializeHistory();
  }, [currentImageSrc, history.length]);

  const handleGenerate = useCallback(async () => {
    if (!currentImage || !prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      if (!editHotspot) {
        setError('Please click on the image to select an area to edit.');
        return;
      }
      
      const editedImageUrl = await generateEditedImage(
        currentImage,
        prompt,
        editHotspot
      );
      const editedImageFile = dataURLtoFile(editedImageUrl, 'edited.png');
      addImageToHistory(editedImageFile);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevImage = history[newIndex];
      if (prevImage) {
        const imageUrl = URL.createObjectURL(prevImage);
        onImageUpdate(imageUrl);
      }
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canUndo, historyIndex, history, onImageUpdate]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextImage = history[newIndex];
      if (nextImage) {
        const imageUrl = URL.createObjectURL(nextImage);
        onImageUpdate(imageUrl);
      }
    }
  }, [canRedo, historyIndex, history, onImageUpdate]);

  const handleReset = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(0);
      const originalImage = history[0];
      if (originalImage) {
        const imageUrl = URL.createObjectURL(originalImage);
        onImageUpdate(imageUrl);
      }
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canUndo, history, onImageUpdate]);

  const handleUploadNew = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setError(null);
      setHistory([file]);
      setHistoryIndex(0);
      setEditHotspot(null);
      setDisplayHotspot(null);
      // Reset the input value so the same file can be selected again
      if (event.target) {
        event.target.value = '';
      }
    } else {
      setError('Please select a valid image file.');
    }
  }, []);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDisplayHotspot({ x: offsetX, y: offsetY });

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const scaleX = naturalWidth / clientWidth;
    const scaleY = naturalHeight / clientHeight;

    const originalX = Math.round(offsetX * scaleX);
    const originalY = Math.round(offsetY * scaleY);

    setEditHotspot({ x: originalX, y: originalY });
  };

  const imageDisplay = (
    <div className="relative">
      {/* Base image is the original, always at the bottom */}
      {originalImageUrl && (
        <img
          key={originalImageUrl}
          src={originalImageUrl}
          alt="Original"
          className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none"
        />
      )}
      {/* The current image is an overlay that fades in/out for comparison */}
      <img
        ref={imgRef}
        key={currentImageUrl}
        src={currentImageUrl || ''}
        alt="Current"
        onClick={handleImageClick}
        className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out cursor-crosshair ${isComparing ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );

  return (
    <div className="min-h-screen text-gray-800 bg-[#fafafa] flex flex-col">
      {/* Header with close button */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold">AI Image Editor</h1>
        <button
          onClick={onClose}
          className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out"
          aria-label="Close AI Editor"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <main className="flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center items-start">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-3 animate-fade-in pb-20">
          {/* Error Display */}
          {error && (
            <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
              <h2 className="text-2xl font-bold text-red-300">An Error Occurred</h2>
              <p className="text-md text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Top Action Buttons */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="flex items-center justify-center bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 shadow-lg"
              aria-label="Undo last action"
            >
              <UndoIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="flex items-center justify-center bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 shadow-lg"
              aria-label="Redo last action"
            >
              <RedoIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>

            {canUndo && (
              <button
                onMouseDown={() => setIsComparing(true)}
                onMouseUp={() => setIsComparing(false)}
                onMouseLeave={() => setIsComparing(false)}
                onTouchStart={() => setIsComparing(true)}
                onTouchEnd={() => setIsComparing(false)}
                className="flex items-center justify-center bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-300 active:scale-95 shadow-lg"
                aria-label="Press and hold to see original image"
              >
                <EyeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            <button
              onClick={handleReset}
              disabled={!canUndo}
              className="flex items-center justify-center bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 shadow-lg"
              aria-label="Reset to original image"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            <button
              onClick={handleUploadNew}
              className="flex items-center justify-center bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-300 active:scale-95 shadow-lg"
              aria-label="Upload new image"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </button>
          </div>

          {/* Hidden file input for upload new image */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="relative w-full shadow-lg rounded-xl overflow-hidden bg-white">
            {isLoading && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                <Spinner />
                <p className="text-gray-700">AI is working its magic...</p>
              </div>
            )}

            {imageDisplay}

            {displayHotspot && !isLoading && (
              <div
                className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}
              >
                <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-400"></div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Text Input and Generate Button - Fixed at bottom of viewport */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg p-2 shadow-lg">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={editHotspot ? "e.g., 'change my shirt color to blue'" : "Click an area on the image first"}
            className={`bg-transparent border-none text-gray-800 rounded-md p-2 text-base focus:outline-none transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-60 ${prompt.trim() ? 'w-64' : 'w-80'}`}
            disabled={isLoading || !editHotspot}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && prompt.trim() && !isLoading) {
                handleGenerate();
              }
            }}
          />

          {prompt.trim() && (
            <button
              onClick={handleGenerate}
              className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold p-2 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none animate-slide-in-right"
              disabled={isLoading || !prompt.trim() || !editHotspot}
              title="Generate"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIEditor;
