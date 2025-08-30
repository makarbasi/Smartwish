/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage } from '../../services/pixshop-geminiService';
import Spinner from './Spinner';
import FilterPanel from './FilterPanel';
import AdjustmentPanel from './AdjustmentPanel';
import { UndoIcon, RedoIcon, EyeIcon, RetouchIcon, SlidersIcon, FilterIcon, CheckIcon } from './icons';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  if (arr.length < 2) throw new Error("Invalid data URL");
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

type Tab = 'retouch' | 'adjust' | 'filters';

const PixshopApp: React.FC = () => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [hasStarted, setHasStarted] = useState<boolean>(true);

  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

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

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
  }, []);

  // Load default image on mount
  useEffect(() => {
    const loadDefaultImage = async () => {
      try {
        const response = await fetch('/US.png');
        const blob = await response.blob();
        const file = new File([blob], 'US.png', { type: blob.type });
        handleImageUpload(file);
        setIsInitialLoad(false);
      } catch (error) {
        console.error('Failed to load default image:', error);
        setIsInitialLoad(false);
      }
    };

    if (isInitialLoad) {
      loadDefaultImage();
    }
  }, [isInitialLoad]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const handleGenerate = useCallback(async () => {
    if (!currentImage || !prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const editedImageUrl = await generateEditedImage(
        currentImage,
        prompt,
        editHotspot || { x: 0, y: 0 }
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

  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) return;

    setIsLoading(true);
    setError(null);

    try {
      const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
      const filteredImageFile = dataURLtoFile(filteredImageUrl, 'filtered.png');
      addImageToHistory(filteredImageFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) return;

    setIsLoading(true);
    setError(null);

    try {
      const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
      const adjustedImageFile = dataURLtoFile(adjustedImageUrl, 'adjusted.png');
      addImageToHistory(adjustedImageFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canUndo, historyIndex]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(0);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canUndo]);

  const handleUploadNew = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch' || isLoading) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setEditHotspot({ x, y });
    setDisplayHotspot({ x, y });
  }, [activeTab, isLoading]);

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center animate-fade-in">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <div className="text-red-600 text-lg font-semibold mb-2">Oops! Something went wrong</div>
            <div className="text-red-700 mb-4">{error}</div>
            <button
              onClick={() => setError(null)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    if (isInitialLoad) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] animate-fade-in">
          <Spinner />
          <p className="text-gray-600 mt-4">Loading editor...</p>
        </div>
      );
    }

    if (!currentImageUrl) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center animate-fade-in">
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 max-w-md">
            <div className="text-gray-600 text-lg font-semibold mb-2">No image loaded</div>
            <div className="text-gray-500 mb-4">Upload an image to get started</div>
            <button
              onClick={handleUploadNew}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Upload Image
            </button>
          </div>
        </div>
      );
    }

    const imageDisplay = (
      <div className="relative inline-block">
        {/* Original image for comparison - only shown when comparing */}
        {originalImageUrl && isComparing && (
          <img
            src={originalImageUrl}
            alt="Original"
            className="w-full h-auto object-contain max-h-[60vh] rounded-xl"
          />
        )}
        {/* The current image is an overlay that fades in/out for comparison */}
        {!isComparing && (
          <img
            ref={imgRef}
            key={currentImageUrl}
            src={currentImageUrl}
            alt="Current"
            onClick={handleImageClick}
            className={`w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`}
          />
        )}
      </div>
    );

    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-3 animate-fade-in pb-20">
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

          {displayHotspot && !isLoading && activeTab === 'retouch' && (
            <div
              className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}
            >
              <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-400"></div>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="w-full">
          {activeTab === 'adjust' && (
            <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />
          )}
          {activeTab === 'filters' && (
            <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-radial from-blue-100/20 via-transparent to-purple-100/20 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {renderContent()}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-1 py-3">
            <button
              onClick={() => setActiveTab('retouch')}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all duration-200 ease-in-out ${
                activeTab === 'retouch'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <RetouchIcon className="w-5 h-5" />
              <span className="text-xs font-medium">Retouch</span>
            </button>
            <button
              onClick={() => setActiveTab('adjust')}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all duration-200 ease-in-out ${
                activeTab === 'adjust'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <SlidersIcon className="w-5 h-5" />
              <span className="text-xs font-medium">Adjust</span>
            </button>
            <button
              onClick={() => setActiveTab('filters')}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all duration-200 ease-in-out ${
                activeTab === 'filters'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <FilterIcon className="w-5 h-5" />
              <span className="text-xs font-medium">Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fixed Text Input for Retouch Tab */}
      {activeTab === 'retouch' && (
        <div className="fixed bottom-20 left-0 right-0 z-20">
          <div className="container mx-auto px-4">
            <div className="flex justify-center">
              <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md border border-gray-200 rounded-full p-2 shadow-lg max-w-md w-full">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={editHotspot ? "Describe your edit..." : "Click on the image first, then describe your edit"}
                  className="bg-transparent border-none text-gray-800 rounded-full px-4 py-2 text-base focus:outline-none flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading || !editHotspot}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
                {prompt.trim() && editHotspot && (
                  <button
                    onClick={handleGenerate}
                    className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold p-2 rounded-full transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none animate-slide-in-right"
                    disabled={isLoading || !prompt.trim() || !editHotspot}
                    title="Generate Edit"
                  >
                    <CheckIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PixshopApp;