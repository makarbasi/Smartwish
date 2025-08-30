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

interface PixshopPluginProps {
  currentImageSrc: string;
  onImageUpdate: (newImageSrc: string) => void;
  editorInstance?: any;
}

const PixshopPlugin: React.FC<PixshopPluginProps> = ({ 
  currentImageSrc, 
  onImageUpdate, 
  editorInstance 
}) => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  const [isComparing, setIsComparing] = useState<boolean>(false);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

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

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Update the editor with the new image
    const newImageUrl = URL.createObjectURL(newImageFile);
    onImageUpdate(newImageUrl);
  }, [history, historyIndex, onImageUpdate]);

  const handleGenerate = useCallback(async () => {
    if (!currentImage || !prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use hotspot if available, otherwise default to center of image
      const hotspot = editHotspot || { x: 0.5, y: 0.5 }; // Use relative coordinates
      
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

  const handleImageClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (activeTab !== 'retouch' || isLoading) return;

    // Find the Pintura editor canvas more specifically
    const pinturaEditor = document.querySelector('.PinturaEditor') || document.querySelector('[data-pintura]');
    const imageElement = pinturaEditor?.querySelector('canvas') || 
                        document.querySelector('.PinturaStage canvas') ||
                        document.querySelector('canvas[data-pintura-canvas]') ||
                        document.querySelector('canvas');
    
    if (!imageElement) {
      console.log('No canvas element found for hotspot detection');
      return;
    }

    const rect = imageElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log('Hotspot selected at:', { x, y });
    setEditHotspot({ x, y });
    setDisplayHotspot({ x, y });
  }, [activeTab, isLoading]);

  // Add click listener to the editor canvas/image when retouch tab is active
  useEffect(() => {
    if (activeTab === 'retouch') {
      // Find the Pintura editor canvas more specifically
      const pinturaEditor = document.querySelector('.PinturaEditor') || document.querySelector('[data-pintura]');
      const imageElement = pinturaEditor?.querySelector('canvas') || 
                          document.querySelector('.PinturaStage canvas') ||
                          document.querySelector('canvas[data-pintura-canvas]') ||
                          document.querySelector('canvas');
      
      if (imageElement) {
        const clickHandler = (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const rect = imageElement.getBoundingClientRect();
          const x = mouseEvent.clientX - rect.left;
          const y = mouseEvent.clientY - rect.top;
          
          console.log('Canvas clicked at:', { x, y });
          setEditHotspot({ x, y });
          setDisplayHotspot({ x, y });
        };
        
        imageElement.addEventListener('click', clickHandler);
        imageElement.style.cursor = 'crosshair';
        
        return () => {
          imageElement.removeEventListener('click', clickHandler);
          imageElement.style.cursor = '';
        };
      } else {
        console.log('No canvas element found for click listener');
      }
    }
  }, [activeTab, isLoading]);

  // Add styles to ensure proper visibility within Pintura container
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .pixshop-plugin-container {
        min-height: 400px;
        background: white;
        border-radius: 8px;
        overflow: visible;
      }
      .pixshop-tab-navigation {
        position: sticky;
        bottom: 0;
        background: #fafafa;
        border-top: 1px solid #e5e7eb;
        z-index: 10;
      }
      .pixshop-input-area {
        position: sticky;
        bottom: 60px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 10;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="pixshop-plugin-container relative flex flex-col h-full">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
          <Spinner />
          <p className="text-gray-700">AI is working its magic...</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 text-red-700">
          <strong>Error:</strong> {error}
          <button 
            onClick={() => setError(null)}
            className="ml-4 bg-red-600 text-white border-none rounded px-2 py-1 cursor-pointer hover:bg-red-700"
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
          <div className="text-center text-gray-600 py-8">
            <p className="mb-2">Click on an area of the image to start retouching</p>
            <p className="text-sm text-gray-500">Selected area will appear as a hotspot</p>
          </div>
        )}
      </div>

      {/* Text Input Area for Retouch Tab */}
      {activeTab === 'retouch' && (
        <div className="pixshop-input-area mx-4 mb-4 p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={editHotspot ? "e.g., 'change my shirt color to blue'" : "Click an area on the image first"}
              className="flex-1 bg-transparent border border-gray-300 text-gray-800 rounded-md p-3 text-base focus:outline-none focus:border-blue-500 transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-gray-50"
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
                className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold p-3 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !prompt.trim() || !editHotspot}
                title="Generate"
              >
                <CheckIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Tab Navigation */}
      <div className="pixshop-tab-navigation p-4">
        <div className="flex items-center justify-center gap-4">
          {([
            { key: 'retouch', icon: RetouchIcon, label: 'Retouch' },
            { key: 'adjust', icon: SlidersIcon, label: 'Adjust' },
            { key: 'filters', icon: FilterIcon, label: 'Filters' }
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
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

export default PixshopPlugin;