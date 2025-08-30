/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { CheckIcon } from './icons';

interface AdjustmentPanelProps {
  onApplyAdjustment: (prompt: string) => void;
  isLoading: boolean;
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ onApplyAdjustment, isLoading }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = [
    {
      name: 'Blur Background',
      prompt: 'Apply a realistic depth-of-field effect, making the background blurry while keeping the main subject in sharp focus.',
      image: '/sample-portrait.jpg',
      effect: 'blur'
    },
    {
      name: 'Enhance Details',
      prompt: 'Slightly enhance the sharpness and details of the image without making it look unnatural.',
      image: '/sample-landscape.jpg',
      effect: 'sharpen'
    },
    {
      name: 'Warmer Lighting',
      prompt: 'Adjust the color temperature to give the image warmer, golden-hour style lighting.',
      image: '/sample-portrait.jpg',
      effect: 'warm'
    },
    {
      name: 'Studio Light',
      prompt: 'Add dramatic, professional studio lighting to the main subject.',
      image: '/sample-portrait.jpg',
      effect: 'studio'
    },
  ];

  const activePrompt = selectedPresetPrompt || customPrompt;

  const getEffectClass = (effect: string) => {
    switch (effect) {
      case 'blur':
        return 'filter blur-sm';
      case 'sharpen':
        return 'filter contrast-125 brightness-110';
      case 'warm':
        return 'filter sepia-50 brightness-110 saturate-150';
      case 'studio':
        return 'filter brightness-125 contrast-110 saturate-125';
      default:
        return '';
    }
  };

  const getBackgroundClass = (effect: string) => {
    switch (effect) {
      case 'blur':
        return 'bg-gradient-to-br from-blue-100 to-blue-300';
      case 'sharpen':
        return 'bg-gradient-to-br from-gray-100 to-gray-300';
      case 'warm':
        return 'bg-gradient-to-br from-orange-200 to-yellow-300';
      case 'studio':
        return 'bg-gradient-to-br from-purple-200 to-pink-300';
      default:
        return 'bg-gray-200';
    }
  };

  const handlePresetClick = (prompt: string) => {
    setSelectedPresetPrompt(prompt);
    setCustomPrompt('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomPrompt(e.target.value);
    setSelectedPresetPrompt(null);
  };

  const handleApply = () => {
    if (activePrompt) {
      onApplyAdjustment(activePrompt);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in">
      {/* Adjustment Tiles */}
      <div className="flex justify-center">
        <div className="grid grid-cols-4 gap-8">
          {presets.map(preset => (
            <button
              key={preset.name}
              onClick={() => handlePresetClick(preset.prompt)}
              disabled={isLoading}
              className="flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 hover:bg-white/10"
            >
              <div className={`w-16 h-16 rounded-lg border-2 shadow-lg relative overflow-hidden ${selectedPresetPrompt === preset.prompt ? 'ring-4 ring-blue-500 border-blue-500' : 'border-white/30'}`}>
                <div className={`w-full h-full ${getEffectClass(preset.effect)} ${getBackgroundClass(preset.effect)}`}>
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-8 bg-white/60 rounded-full"></div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-black/10"></div>
              </div>
              <span className="text-xs text-gray-700 text-center leading-tight font-medium">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Text Input and Apply Button */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg p-2 shadow-lg">
          <input
            type="text"
            value={customPrompt}
            onChange={handleCustomChange}
            placeholder="Or describe an adjustment (e.g., 'change background to a forest')"
            className={`bg-transparent border-none text-gray-800 rounded-md p-2 text-base focus:outline-none transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-60 ${activePrompt ? 'w-64' : 'w-80'}`}
            disabled={isLoading}
          />

          <button
            onClick={handleApply}
            className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold p-3 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none min-w-[80px] min-h-[44px] flex items-center justify-center gap-2"
            disabled={isLoading || !activePrompt?.trim()}
            title="Apply Adjustment"
          >
            <CheckIcon className="w-5 h-5" />
            <span className="text-sm">Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdjustmentPanel;