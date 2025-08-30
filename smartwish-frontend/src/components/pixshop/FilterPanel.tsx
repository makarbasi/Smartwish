/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { CheckIcon } from './icons';

interface FilterPanelProps {
  onApplyFilter: (prompt: string) => void;
  isLoading: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onApplyFilter, isLoading }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = [
    { name: 'Synthwave', prompt: 'Apply a vibrant 80s synthwave aesthetic with neon magenta and cyan glows, and subtle scan lines.', image: '/synthwave.jpg' },
    { name: 'Anime', prompt: 'Give the image a vibrant Japanese anime style, with bold outlines, cel-shading, and saturated colors.', image: '/anime.jpg' },
    { name: 'Lomo', prompt: 'Apply a Lomography-style cross-processing film effect with high-contrast, oversaturated colors, and dark vignetting.', image: '/lomo.jpg' },
    { name: 'Glitch', prompt: 'Transform the image into a futuristic holographic projection with digital glitch effects and chromatic aberration.', image: '/glitch.jpg' },
  ];

  const activePrompt = selectedPresetPrompt || customPrompt;

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
      onApplyFilter(activePrompt);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in">
      {/* Filter Tiles */}
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
                <img
                  src={preset.image}
                  alt={preset.name}
                  className="w-full h-full object-cover"
                />
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
            placeholder="Or describe a custom filter (e.g., '80s synthwave glow')"
            className={`bg-transparent border-none text-gray-800 rounded-md p-2 text-base focus:outline-none transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-60 ${activePrompt ? 'w-64' : 'w-80'}`}
            disabled={isLoading}
          />

          {activePrompt && (
            <button
              onClick={handleApply}
              className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold p-2 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none animate-slide-in-right"
              disabled={isLoading || !activePrompt.trim()}
              title="Apply Filter"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;