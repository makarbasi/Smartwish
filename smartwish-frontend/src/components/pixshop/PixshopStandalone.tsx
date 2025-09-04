'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage } from '../../services/pixshop-geminiService';
import Spinner from './Spinner';
import FilterPanel from './FilterPanel';
import AdjustmentPanel from './AdjustmentPanel';
import { UndoIcon, RedoIcon, EyeIcon, RetouchIcon, SlidersIcon, FilterIcon, CheckIcon } from './icons';

// Upload icon component
const UploadIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
);

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

interface PixshopStandaloneProps {
  currentImageSrc: string;
  onImageUpdate: (newImageSrc: string) => void;
}

const PixshopStandalone: React.FC<PixshopStandaloneProps> = ({ 
  currentImageSrc, 
  onImageUpdate
}) => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number; y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number; y: number } | null>(null);
  const [currentImage, setCurrentImage] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Add image to history
  const addImageToHistory = useCallback((file: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(file);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    const url = URL.createObjectURL(file);
    onImageUpdate(url);
  }, [history, historyIndex, onImageUpdate]);

  // Load image from source
  useEffect(() => {
    if (currentImageSrc) {
      const loadImage = async () => {
        try {
          let file: File;
          
          if (currentImageSrc.startsWith('data:')) {
            // Data URL
            file = dataURLtoFile(currentImageSrc, 'image.png');
          } else if (currentImageSrc.startsWith('blob:')) {
            // Blob URL
            const response = await fetch(currentImageSrc);
            const blob = await response.blob();
            file = new File([blob], 'image.png', { type: blob.type });
          } else {
            // Regular URL
            const response = await fetch(currentImageSrc);
            const blob = await response.blob();
            file = new File([blob], 'image.png', { type: blob.type });
          }
          
          setCurrentImage(file);
          
          // Only add to history if it's not already the current image
          if (history.length === 0 || historyIndex === -1) {
            addImageToHistory(file);
          }
        } catch (err) {
          console.error('Error loading image:', err);
          setError('Failed to load image');
        }
      };
      
      loadImage();
    }
  }, [currentImageSrc]);

  // Handle image click for hotspot selection
  const handleImageClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch') return;
    
    const img = event.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert to relative coordinates (0-1)
    const relativeX = x / rect.width;
    const relativeY = y / rect.height;
    
    // Convert to image pixel coordinates
    const imgX = Math.round(relativeX * img.naturalWidth);
    const imgY = Math.round(relativeY * img.naturalHeight);
    
    setEditHotspot({ x: imgX, y: imgY });
    setDisplayHotspot({ x, y });
  }, [activeTab]);

  // Undo/Redo functionality
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (canUndo) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const file = history[newIndex];
      const url = URL.createObjectURL(file);
      onImageUpdate(url);
      setCurrentImage(file);
    }
  }, [canUndo, historyIndex, history, onImageUpdate]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const file = history[newIndex];
      const url = URL.createObjectURL(file);
      onImageUpdate(url);
      setCurrentImage(file);
    }
  }, [canRedo, historyIndex, history, onImageUpdate]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      const file = history[0];
      const url = URL.createObjectURL(file);
      onImageUpdate(url);
      setCurrentImage(file);
    }
  }, [history, onImageUpdate]);

  // Generate edited image
  const handleGenerate = useCallback(async () => {
    if (!currentImage || !prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use hotspot if available, otherwise default to center of image
      const hotspot = editHotspot || { x: 0.5, y: 0.5 };
      
      const editedImageUrl = await generateEditedImage(
        currentImage,
        prompt,
        hotspot
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

  return (
    <div className="pixshop-standalone h-full flex flex-col">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-4">
            <Spinner />
            <span className="text-gray-700">Processing your image...</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Action Buttons */}
      <div className="flex items-center justify-center gap-2 p-3 border-b border-gray-200">
        <button
          onClick={handleUndo}
          disabled={!canUndo || isLoading}
          className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          aria-label="Undo last action"
        >
          <UndoIcon className="w-4 h-4" />
        </button>
        
        <button
          onClick={handleRedo}
          disabled={!canRedo || isLoading}
          className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          aria-label="Redo last action"
        >
          <RedoIcon className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gray-200"></div>

        {canUndo && (
          <button
            onMouseDown={() => setIsComparing(true)}
            onMouseUp={() => setIsComparing(false)}
            onMouseLeave={() => setIsComparing(false)}
            onTouchStart={() => setIsComparing(true)}
            onTouchEnd={() => setIsComparing(false)}
            className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 hover:border-gray-300 active:scale-95"
            aria-label="Press and hold to see original image"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={handleReset}
          disabled={!canUndo || isLoading}
          className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 hover:border-gray-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          aria-label="Reset to original image"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
        {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
        {activeTab === 'retouch' && (
          <div className="space-y-4">
            {/* Image Preview for Hotspot Selection */}
            {currentImageSrc && (
              <div className="relative">
                <img
                  ref={imageRef}
                  src={isComparing && history[0] ? URL.createObjectURL(history[0]) : currentImageSrc}
                  alt="Edit preview"
                  className="w-full max-h-64 object-contain rounded-lg border border-gray-200 cursor-crosshair"
                  onClick={handleImageClick}
                />
                {/* Display hotspot */}
                {displayHotspot && !isComparing && (
                  <div
                    className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg"
                    style={{
                      left: displayHotspot.x,
                      top: displayHotspot.y,
                    }}
                  />
                )}
              </div>
            )}

            {/* Hotspot Status */}
            {editHotspot ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 font-medium">✨ Hotspot selected!</p>
                <p className="text-blue-600 text-sm">Position: {Math.round(editHotspot.x)}, {Math.round(editHotspot.y)}</p>
                <p className="text-xs text-blue-500 mt-1">Enter your editing instructions below</p>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <p className="text-gray-600">👆 Click on the image to select an area for editing</p>
                <p className="text-xs text-gray-500 mt-1">Your selected area will appear as a hotspot</p>
              </div>
            )}

            {/* Text Input Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Editing Instructions
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={editHotspot ? "e.g., 'change my shirt color to blue'" : "Select an area on the image first"}
                  className="flex-1 bg-white border border-gray-300 text-gray-800 rounded-md p-3 text-base focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-gray-50"
                  disabled={isLoading || !editHotspot}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && prompt.trim() && !isLoading) {
                      handleGenerate();
                    }
                  }}
                />

                {prompt.trim() && editHotspot && (
                  <button
                    onClick={handleGenerate}
                    className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold p-3 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                    disabled={isLoading || !prompt.trim() || !editHotspot}
                    title="Generate AI Edit"
                  >
                    <CheckIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Action Suggestions */}
            {editHotspot && !prompt.trim() && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Remove this object",
                    "Change color to blue",
                    "Make it brighter",
                    "Blur the background",
                    "Add more detail"
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setPrompt(suggestion)}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors duration-200"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-center gap-4">
          {([
            { key: 'retouch', icon: RetouchIcon, label: 'Retouch' },
            { key: 'adjust', icon: SlidersIcon, label: 'Adjust' },
            { key: 'filters', icon: FilterIcon, label: 'Filters' }
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                // Clear retouch-specific state when switching tabs
                if (key !== 'retouch') {
                  setEditHotspot(null);
                  setDisplayHotspot(null);
                  setPrompt('');
                }
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-300 ease-in-out min-w-[80px] ${
                activeTab === key
                  ? 'bg-blue-50 text-blue-600 border-blue-200 scale-105'
                  : 'text-gray-600 hover:text-gray-800 hover:scale-105 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              aria-label={label}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PixshopStandalone;
