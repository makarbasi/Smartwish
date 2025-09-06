'use client'

import React from 'react';
import { createPortal } from 'react-dom';

interface WarningDialogProps {
  isOpen: boolean;
  onContinue: () => void;
  onCancel: () => void;
}

const WarningDialog: React.FC<WarningDialogProps> = ({ isOpen, onContinue, onCancel }) => {
  console.log('🚨 WarningDialog render:', { 
    isOpen, 
    timestamp: new Date().toISOString(),
    willRender: isOpen 
  });
  
  if (!isOpen) {
    console.log('🚨 WarningDialog not open - returning null');
    return null;
  }

  console.log('🚨 WarningDialog IS OPEN - rendering dialog content');

  const dialogContent = (
    <div 
      className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center" 
      style={{ zIndex: 2147483647 }}
      onClick={(e) => {
        // Prevent clicks on backdrop from immediately closing dialog
        e.stopPropagation();
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => {
          // Prevent clicks on dialog content from bubbling to backdrop
          e.stopPropagation();
        }}
      >
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="ml-3 text-lg font-semibold text-gray-900">Switch to Pixshop</h3>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-3">
            You're about to switch to Pixshop AI editor. Please note:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li>All changes you've made in Pintura will be saved</li>
            <li>You can return to Pintura editor at any time</li>
            <li>Changes made in Pixshop cannot be undone once you return to Pintura</li>
          </ul>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Continue to Pixshop
          </button>
        </div>
      </div>
    </div>
  );

  // Render in a portal to ensure it appears at the top level
  return typeof window !== 'undefined' ? createPortal(dialogContent, document.body) : null;
};

export default WarningDialog;