'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface PixshopBlobData {
  designId: string;
  pageIndex: number;
  blob: Blob;
  blobUrl: string;
  timestamp: number;
  fromPixshop: boolean;
}

interface PixshopContextType {
  // Blob data management
  currentBlob: PixshopBlobData | null;
  setPixshopBlob: (data: PixshopBlobData) => void;
  clearPixshopBlob: () => void;
  
  // Background save status
  isSaving: boolean;
  saveError: string | null;
  setSaveStatus: (saving: boolean, error?: string) => void;
  
  // Convenience methods
  getBlobForDesign: (designId: string, pageIndex: number) => PixshopBlobData | null;
  hasUnsavedChanges: boolean;
  markSaved: () => void;
}

const PixshopContext = createContext<PixshopContextType | undefined>(undefined);

interface PixshopProviderProps {
  children: ReactNode;
}

export function PixshopProvider({ children }: PixshopProviderProps) {
  const [currentBlob, setCurrentBlob] = useState<PixshopBlobData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const setPixshopBlob = useCallback((data: PixshopBlobData) => {
    console.log('🎨 Pixshop Context: Setting blob for design', data.designId, 'page', data.pageIndex);
    console.log('🔗 Blob URL type:', data.blobUrl.startsWith('data:') ? 'data URL' : 'blob URL');
    
    // Clean up previous blob URL if it exists and is a blob URL (not data URL)
    if (currentBlob?.blobUrl && currentBlob.blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentBlob.blobUrl);
      console.log('🧹 Cleaned up previous blob URL');
    }
    
    setCurrentBlob(data);
    setHasUnsavedChanges(true);
    setSaveError(null);
  }, [currentBlob]);

  const clearPixshopBlob = useCallback(() => {
    console.log('🧹 Pixshop Context: Clearing blob data');
    
    // Only revoke if it's a blob URL (not data URL)
    if (currentBlob?.blobUrl && currentBlob.blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentBlob.blobUrl);
      console.log('🧹 Revoked blob URL');
    } else if (currentBlob?.blobUrl?.startsWith('data:')) {
      console.log('🔗 Data URL detected - no cleanup needed');
    }
    
    setCurrentBlob(null);
    setHasUnsavedChanges(false);
    setSaveError(null);
  }, [currentBlob]);

  const setSaveStatus = useCallback((saving: boolean, error?: string) => {
    setIsSaving(saving);
    setSaveError(error || null);
    
    if (saving) {
      console.log('💾 Pixshop Context: Starting background save...');
    } else if (error) {
      console.error('❌ Pixshop Context: Save failed:', error);
    } else {
      console.log('✅ Pixshop Context: Save completed successfully');
    }
  }, []);

  const getBlobForDesign = useCallback((designId: string, pageIndex: number) => {
    if (!currentBlob) return null;
    if (currentBlob.designId !== designId) return null;
    if (currentBlob.pageIndex !== pageIndex) return null;
    return currentBlob;
  }, [currentBlob]);

  const markSaved = useCallback(() => {
    setHasUnsavedChanges(false);
    setIsSaving(false);
    setSaveError(null);
  }, []);

  // Auto-cleanup blob URLs on unmount (only for blob URLs, not data URLs)
  React.useEffect(() => {
    return () => {
      if (currentBlob?.blobUrl && currentBlob.blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentBlob.blobUrl);
        console.log('🧹 Context cleanup: Revoked blob URL on unmount');
      }
    };
  }, [currentBlob]);

  const contextValue: PixshopContextType = {
    currentBlob,
    setPixshopBlob,
    clearPixshopBlob,
    isSaving,
    saveError,
    setSaveStatus,
    getBlobForDesign,
    hasUnsavedChanges,
    markSaved,
  };

  return (
    <PixshopContext.Provider value={contextValue}>
      {children}
    </PixshopContext.Provider>
  );
}

export function usePixshop() {
  const context = useContext(PixshopContext);
  if (context === undefined) {
    throw new Error('usePixshop must be used within a PixshopProvider');
  }
  return context;
}

// Optional version that returns default values if provider is not available
export function usePixshopOptional(): PixshopContextType {
  const context = useContext(PixshopContext);
  if (context === undefined) {
    // Return default/empty implementation
    return {
      currentBlob: null,
      setPixshopBlob: () => {},
      clearPixshopBlob: () => {},
      isSaving: false,
      saveError: null,
      setSaveStatus: () => {},
      getBlobForDesign: () => null,
      hasUnsavedChanges: false,
      markSaved: () => {},
    };
  }
  return context;
}