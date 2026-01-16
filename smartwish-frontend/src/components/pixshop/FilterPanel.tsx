/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { CheckIcon, MicrophoneIcon } from './icons';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useKioskConfig } from '@/hooks/useKioskConfig';

interface FilterPanelProps {
  onApplyFilter: (prompt: string) => void;
  isLoading: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onApplyFilter, isLoading }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const { config: kioskConfig } = useKioskConfig();
  const micEnabled = kioskConfig?.micEnabled !== false;

  const { isRecording, isSupported, startRecording } = useVoiceInput({
    onResult: (transcript) => {
      setCustomPrompt(transcript);
      setSelectedPresetPrompt(null);
    },
  });

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
      <div className="flex justify-center px-2">
        <div className="flex items-center gap-2 bg-white/95 border border-gray-200 rounded-xl px-2 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 focus-within:ring-2 focus-within:ring-blue-400 transition w-full max-w-xs sm:max-w-md">
          <input
            type="text"
            value={customPrompt}
            onChange={handleCustomChange}
            placeholder="Describe or tweak prompt"
            aria-label="Filter prompt"
            className="flex-1 min-w-0 bg-transparent placeholder-gray-400 text-gray-800 text-xs sm:text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          />
          {isSupported && micEnabled && (
            <button
              onClick={startRecording}
              disabled={isLoading || isRecording}
              className={`p-1.5 rounded-md transition-all flex-shrink-0 ${isRecording
                ? 'bg-red-100 text-red-600 animate-pulse'
                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? 'Listening...' : 'Voice input'}
            >
              <MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5" isRecording={isRecording} />
            </button>
          )}
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-medium px-3 py-1.5 rounded-md shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            disabled={isLoading || !activePrompt?.trim()}
            title="Apply Filter"
          >
            <CheckIcon className="w-4 h-4" />
            <span className="hidden sm:inline text-xs sm:text-sm">Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;