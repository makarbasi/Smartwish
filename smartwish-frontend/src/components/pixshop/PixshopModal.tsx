'use client'

import React from 'react';
import PixshopStandalone from './PixshopStandalone';

interface PixshopModalProps {
  isOpen: boolean;
  currentImageSrc: string;
  onClose: () => void;
  onImageUpdate: (newImageSrc: string) => void;
}

const PixshopModal: React.FC<PixshopModalProps> = ({
  isOpen,
  currentImageSrc,
  onClose,
  onImageUpdate
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-[9998] flex flex-col">
      {/* Header with back button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back to Pintura</span>
          </button>
        </div>
        
        <h1 className="text-xl font-semibold text-gray-800">Pixshop AI Editor</h1>
        
        <div className="w-32"></div> {/* Spacer for center alignment */}
      </div>

      {/* Pixshop Editor Content */}
      <div className="flex-1 overflow-hidden">
        <PixshopStandalone
          currentImageSrc={currentImageSrc}
          onImageUpdate={onImageUpdate}
        />
      </div>
    </div>
  );
};

export default PixshopModal;