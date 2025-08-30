/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect } from 'react';
import { generateEditedImage } from './geminiService';
import FilterPanel from './FilterPanel';
import AdjustmentPanel from './AdjustmentPanel';
import Spinner from './Spinner';
import {
  UploadIcon,
  UndoIcon,
  RedoIcon,
  EyeIcon,
  RetouchIcon,
  SlidersIcon,
  FilterIcon,
  BullseyeIcon
} from './icons';

interface Hotspot {
  x: number;
  y: number;
}

interface HistoryEntry {
  imageUrl: string;
  timestamp: number;
}

type Tab = 'retouch' | 'adjust' | 'filters';

const PixshopEditor: React.FC = () => {
  const [currentImage, setCurrentImage] = useState<string>('/US.jpg');
  const [originalImage, setOriginalImage] = useState<string>('/US.jpg');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [prompt, setPrompt] = useState('');
  const [showComparison, setShowComparison] = useState(false);

  // Load default image on mount
  useEffect(() => {
    const defaultImageUrl = '/US.jpg';
    setCurrentImage(defaultImageUrl);
    setOriginalImage(defaultImageUrl);
    setHistory([{ imageUrl: defaultImageUrl, timestamp: Date.now() }]);
    setHistoryIndex(0);
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setCurrentImage(imageUrl);
        setOriginalImage(imageUrl);
        setHistory([{ imageUrl, timestamp: Date.now() }]);
        setHistoryIndex(0);
        setHotspots([]);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleGenerate = useCallback(async (userPrompt: string, hotspotList: Hotspot[] = []) => {
    if (!userPrompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const editedImageUrl = await generateEditedImage(currentImage, userPrompt, hotspotList);
      
      // Add to history
      const newEntry: HistoryEntry = {
        imageUrl: editedImageUrl,
        timestamp: Date.now()
      };
      
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newEntry);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setCurrentImage(editedImageUrl);
      setHotspots([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, history, historyIndex]);

  const handleApplyFilter = useCallback((filterPrompt: string) => {
    handleGenerate(filterPrompt);
  }, [handleGenerate]);

  const handleApplyAdjustment = useCallback((adjustmentPrompt: string) => {
    handleGenerate(adjustmentPrompt);
  }, [handleGenerate]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentImage(history[newIndex].imageUrl);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentImage(history[newIndex].imageUrl);
    }
  }, [history, historyIndex]);

  const handleReset = useCallback(() => {
    setCurrentImage(originalImage);
    setHistory([{ imageUrl: originalImage, timestamp: Date.now() }]);
    setHistoryIndex(0);
    setHotspots([]);
    setError(null);
  }, [originalImage]);

  const handleUploadNew = useCallback(() => {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    fileInput?.click();
  }, []);

  const handleImageClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch') return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setHotspots(prev => [...prev, { x, y }]);
  }, [activeTab]);

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-red-500 text-lg font-semibold mb-2">Error</div>
            <div className="text-gray-600 mb-4">{error}</div>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Spinner />
            <div className="mt-4 text-gray-600">Generating your image...</div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative max-w-2xl max-h-96">
          <img
            src={showComparison ? originalImage : currentImage}
            alt="Current image"
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg cursor-crosshair"
            onClick={handleImageClick}
          />
          {hotspots.map((hotspot, index) => (
            <div
              key={index}
              className="absolute w-4 h-4 bg-red-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Action Bar */}
      <div className="flex justify-between items-center p-4 bg-white shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0 || isLoading}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Undo"
          >
            <UndoIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1 || isLoading}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Redo"
          >
            <RedoIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onMouseDown={() => setShowComparison(true)}
            onMouseUp={() => setShowComparison(false)}
            onMouseLeave={() => setShowComparison(false)}
            disabled={isLoading}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Compare with original (hold)"
          >
            <EyeIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Reset
          </button>
          <button
            onClick={handleUploadNew}
            disabled={isLoading}
            className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
          >
            <UploadIcon className="w-4 h-4" />
            Upload New
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        id="file-input"
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Main Content */}
      {renderContent()}

      {/* Bottom Tab Navigation */}
      <div className="bg-white border-t">
        <div className="flex">
          {[
            { id: 'retouch' as Tab, label: 'Retouch', icon: RetouchIcon },
            { id: 'adjust' as Tab, label: 'Adjust', icon: SlidersIcon },
            { id: 'filters' as Tab, label: 'Filters', icon: FilterIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'retouch' && (
            <div className="space-y-4">
              {hotspots.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BullseyeIcon className="w-4 h-4" />
                  <span>{hotspots.length} hotspot{hotspots.length !== 1 ? 's' : ''} selected</span>
                  <button
                    onClick={() => setHotspots([])}
                    className="text-blue-600 hover:text-blue-800 ml-2"
                  >
                    Clear
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want to edit (e.g., 'remove the person in the background')..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleGenerate(prompt, hotspots);
                      setPrompt('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    handleGenerate(prompt, hotspots);
                    setPrompt('');
                  }}
                  disabled={isLoading || !prompt.trim()}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Generate
                </button>
              </div>
            </div>
          )}

          {activeTab === 'adjust' && (
            <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />
          )}

          {activeTab === 'filters' && (
            <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />
          )}
        </div>
      </div>
    </div>
  );
};

export default PixshopEditor;