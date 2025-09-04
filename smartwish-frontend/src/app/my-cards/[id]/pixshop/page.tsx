'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

// Types for API responses
type SavedDesign = {
  id: string;
  title?: string;
  imageUrls?: string[];
  thumbnail?: string;
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  designData?: { pages?: Array<{ image?: string; header?: string }> } | null;
};

type ApiResponse = {
  success: boolean;
  data: SavedDesign[];
  count?: number;
};

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error(`Fetch error ${res.status}`);
    return res.json();
  });

// Use the centralized Gemini-based image generation service
import { generateEditedImage, generateFilteredImage, generateAdjustedImage } from '../../../services/geminiService';

// Spinner Component
const Spinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
)

// External panels (from src/components/pixshop)
import FilterPanel from '../../../../components/pixshop/FilterPanel';
import AdjustmentPanel from '../../../../components/pixshop/AdjustmentPanel';

// Icons
const UndoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
  </svg>
)

const RedoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
  </svg>
)

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
)

const RetouchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)

const SlidersIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
  </svg>
)

const FilterIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
  </svg>
)

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

// Helper to extract the best image URL from a savedDesign object
const getFirstImageFromSavedDesign = (savedDesign: any): string | null => {
  if (!savedDesign) return null;
  // Prefer explicit image columns
  if (savedDesign.image1) return savedDesign.image1;
  if (savedDesign.image2) return savedDesign.image2;
  if (savedDesign.image3) return savedDesign.image3;
  if (savedDesign.image4) return savedDesign.image4;

  // designData.pages fallback
  if (savedDesign.designData && Array.isArray(savedDesign.designData.pages) && savedDesign.designData.pages.length > 0) {
    const first = savedDesign.designData.pages.find((p: any) => p && (p.image || p.header));
    if (first && first.image) return first.image;
  }

  // imageUrls array
  if (Array.isArray(savedDesign.imageUrls) && savedDesign.imageUrls.length > 0) return savedDesign.imageUrls[0];

  // thumbnail fallback
  if (savedDesign.thumbnail) return savedDesign.thumbnail;

  return null;
}

type Tab = 'retouch' | 'adjust' | 'filters';

const PixshopPage: React.FC = () => {
  const params = useParams();
  const cardId = params?.id as string;
  const router = useRouter();
  
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

  // Fetch saved designs to get the image for this card
  const {
    data: apiResponse,
    error: fetchError,
    isLoading: isFetching,
    mutate: refetchData,
  } = useSWR<ApiResponse>("/api/saved-designs", fetcher, {
    revalidateOnFocus: true,
    revalidateOnMount: true,
    dedupingInterval: 2000, // Prevent too frequent requests
  });

  // Load image from saved design when data is available
  useEffect(() => {
    if (apiResponse?.data && cardId && history.length === 0) {
      console.log('🔍 Looking for card with ID:', cardId);
      console.log('📋 Available cards:', apiResponse.data.map(d => ({ id: d.id, title: d.title })));
      
      const savedDesign = apiResponse.data.find((d) => d.id === cardId);
      if (savedDesign) {
        console.log('✅ Found card:', savedDesign.title || 'Untitled');
        const imageUrl = getFirstImageFromSavedDesign(savedDesign);
        if (imageUrl) {
          console.log('🖼️ Loading image from:', imageUrl);
          // Convert URL to File object
          fetch(imageUrl)
            .then(res => res.blob())
            .then(blob => {
              const file = new File([blob], `card-${cardId}.jpg`, { type: 'image/jpeg' });
              setHistory([file]);
              setHistoryIndex(0);
              setIsInitialLoad(false);
              console.log('✅ Image loaded successfully');
            })
            .catch(err => {
              console.error('❌ Error loading image:', err);
              setError('Failed to load image from saved design');
            });
        } else {
          console.log('❌ No image URL found for card');
          setError('No image found for this card');
        }
      } else {
        console.log('❌ Card not found in fetched data');
        setError(`Card with ID ${cardId} not found. Please check the URL or try refreshing the page.`);
      }
    }
  }, [apiResponse, cardId, history.length]);

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

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setIsInitialLoad(false);
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
      // Reset the input value so the same file can be selected again
      if (event.target) {
        event.target.value = '';
      }
    } else {
      setError('Please select a valid image file.');
    }
  }, [handleImageUpload]);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to edit.');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a description for your edit.');
      return;
    }

    if (!editHotspot) {
      setError('Please click on the image to select an area to edit.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot);
      const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
      addImageToHistory(newImageFile);
      setEditHotspot(null);
      setDisplayHotspot(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate the image. ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);

  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply a filter to.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
      const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
      addImageToHistory(newImageFile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to apply the filter. ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply an adjustment to.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
      const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
      addImageToHistory(newImageFile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to apply the adjustment. ${errorMessage}`);
      console.error(err);
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
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [history]);

  const handleUploadNew = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  // Convert a File to data URL (base64)
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSave = useCallback(async () => {
    if (!currentImage) {
      setError('No image to save');
      return;
    }

    // Ensure we have the card data loaded
    if (!apiResponse?.data || !cardId) {
      setError('Card data not loaded. Please wait and try again.');
      return;
    }

    // Find the saved design data we originally loaded (from SWR response)
    const savedDesign = apiResponse.data.find(d => d.id === cardId);
    if (!savedDesign) {
      console.log('❌ Card not found in local data, available cards:', apiResponse.data.map(d => d.id));
      setError('Card not found in loaded data. Please refresh the page and try again.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('💾 Saving card with ID:', cardId);
      console.log('📄 Found saved design:', savedDesign.title || 'Untitled');

      const newImageDataUrl = await fileToDataURL(currentImage);

      // Build pages array preserving existing other images if available
      const existingImages: string[] = [];
      if (savedDesign) {
        // Prefer individual image fields
        const possible = [savedDesign.image1, savedDesign.image2, savedDesign.image3, savedDesign.image4];
        if (possible.some(Boolean)) {
          existingImages.push(...possible.map(i => i || ''));
        } else if (savedDesign.designData?.pages?.length) {
          existingImages.push(...savedDesign.designData.pages.map(p => p.image || ''));
        } else if (savedDesign.imageUrls?.length) {
          existingImages.push(...savedDesign.imageUrls);
        } else if (savedDesign.thumbnail) {
          existingImages.push(savedDesign.thumbnail);
        }
      }
      while (existingImages.length < 4) existingImages.push('');

      // Replace first slot with new edited image (future: track which slot was edited)
      existingImages[0] = newImageDataUrl;

      // Prepare designData pages if original had designData
      let updatedDesignData = undefined as any;
      if (savedDesign?.designData?.pages?.length) {
        updatedDesignData = {
          ...savedDesign.designData,
          pages: savedDesign.designData.pages.map((p, idx) => idx === 0 ? { ...p, image: newImageDataUrl } : p)
        };
      }

      const body: any = {
        title: savedDesign?.title || 'Edited Design',
        image1: existingImages[0] || null,
        image2: existingImages[1] || null,
        image3: existingImages[2] || null,
        image4: existingImages[3] || null,
        thumbnail: existingImages[0] || null,
        imageUrls: existingImages.filter(Boolean),
      };
      if (updatedDesignData) body.designData = updatedDesignData;

      console.log('📡 Sending PUT request to:', `/api/saved-designs/${cardId}`);
      console.log('📦 Request body keys:', Object.keys(body));
      
      const resp = await fetch(`/api/saved-designs/${cardId}` , {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      console.log('📨 Response status:', resp.status, resp.statusText);
      
      if (!resp.ok) {
        const responseText = await resp.text();
        console.log('❌ Response text:', responseText);
        
        let errorMessage = `Save failed: ${resp.status}`;
        
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Use the raw response text if JSON parsing fails
          errorMessage = responseText || errorMessage;
        }
        
        if (resp.status === 404) {
          // If it's a 404, let's try to refetch the data and retry once
          console.log('🔄 Card not found, trying to refetch data...');
          throw new Error(`Card not found on server. This might be a temporary issue. Please try again or refresh the page. (${errorMessage})`);
        } else {
          throw new Error(`${errorMessage}. Please try again.`);
        }
      }
      
      console.log('✅ Save successful!');

      // Navigate back directly into Pintura editor for this design
      router.push(`/my-cards/${cardId}?openPintura=1&updated=1`);
    } catch (err) {
      console.error('Save failed', err);
      setError(err instanceof Error ? err.message : 'Failed to save image');
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, apiResponse, cardId, router]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch') return;

    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDisplayHotspot({ x: offsetX, y: offsetY });

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const scaleX = naturalWidth / clientWidth;
    const scaleY = naturalHeight / clientHeight;

    const originalX = Math.round(offsetX * scaleX);
    const originalY = Math.round(offsetY * scaleY);

    setEditHotspot({ x: originalX, y: originalY });
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
          <h2 className="text-2xl font-bold text-red-300">An Error Occurred</h2>
          <p className="text-md text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (isFetching || !apiResponse) {
      return (
        <div className="text-center animate-fade-in flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-gray-600">Loading your card...</p>
        </div>
      );
    }

    if (hasStarted && !currentImageUrl && !isFetching) {
      return (
        <div className="text-center animate-fade-in flex flex-col items-center gap-4">
          <div
            onClick={handleUploadNew}
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload an Image</h3>
            <p className="text-gray-600 mb-4">
              Drag and drop your image here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Supports JPG, PNG, WebP up to 10MB
            </p>
          </div>
        </div>
      );
    }

    const imageDisplay = (
      <div className="relative">
        {/* Base image is the original, always at the bottom */}
        {originalImageUrl && (
          <img
            key={originalImageUrl}
            src={originalImageUrl || undefined}
            alt="Original"
            className={`h-auto object-contain ${imageMaxHeightClass} max-w-full rounded-xl pointer-events-none`}
          />
        )}
        {/* The current image is an overlay that fades in/out for comparison */}
        <img
          ref={imgRef}
          key={currentImageUrl}
          src={currentImageUrl || undefined}
          alt="Current"
          onClick={handleImageClick}
          className={`absolute top-0 left-0 h-auto object-contain ${imageMaxHeightClass} max-w-full rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`}
        />
      </div>
    );

    return (
  <div className="w-full mx-auto flex flex-col items-center gap-5 animate-fade-in pb-20">
        {/* Top Action Buttons */}
        <div className="flex items-center justify-between gap-2 mb-3 w-full">
          <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/my-cards/${cardId}?openPintura=1`)}
            className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 px-3 py-2 rounded-md transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-300 active:scale-95 shadow-lg"
            aria-label="Back to Pintura Editor"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="text-sm font-medium">Back to Editor</span>
          </button>

          <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>

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
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!currentImage || isLoading || !apiResponse?.data || isInitialLoad}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg px-3 py-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Save edited image and return"
            >
              {isLoading ? 'Saving...' : !apiResponse?.data ? 'Loading...' : 'Save & Return'}
            </button>
          </div>
        </div>

  {/* Upload button removed as per request */}

        <div className="flex justify-center w-full">
          <div className="relative inline-block shadow-lg rounded-xl overflow-hidden bg-white p-2">
          {isLoading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 animate-fade-in rounded-xl">
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
        </div>

      </div>
    );
  };

  // Dynamic layout sizing for image area (subtract estimated bottom bar heights per tab)
  const bottomPaddingClass = activeTab === 'retouch' ? 'pb-[170px]' : 'pb-[360px]';
  const imageMaxHeightClass = activeTab === 'retouch' ? 'max-h-[calc(100vh-240px)]' : 'max-h-[calc(100vh-430px)]';

  return (
    <div className="min-h-screen h-screen text-gray-800 bg-[#fafafa] flex flex-col">
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center ${currentImage ? 'items-start' : 'items-center'} ${bottomPaddingClass}`}>
        {/* Inject dynamic max-height class into image elements by replacing their max-h utility */}
        <style>{`
          /* Override existing 60vh cap with dynamic calculation */
          .pixshop-dynamic-image > img, .pixshop-dynamic-image > .relative > img { ${''} }
        `}</style>
        {renderContent()}
      </main>

      {/* Fixed bottom tools bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="max-w-[1600px] mx-auto px-4 pt-3 pb-4 flex flex-col items-center gap-5">
          {/* Active panel / input ABOVE tool icons */}
          {activeTab === 'retouch' && (
            <div className="flex items-center gap-3 bg-white/95 border border-gray-200 rounded-xl px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 focus-within:ring-2 focus-within:ring-blue-400 transition w-full max-w-[28rem] mx-auto">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={editHotspot ? 'Describe your edit (e.g., change shirt to blue)' : 'Click an area first'}
                aria-label="Retouch prompt"
                className="w-64 md:w-80 bg-transparent placeholder-gray-400 text-gray-800 text-sm md:text-base focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || !editHotspot}
              />
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-medium px-4 py-2 rounded-md shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[84px] justify-center"
                disabled={isLoading || !prompt.trim() || !editHotspot}
                title="Generate edit"
              >
                <CheckIcon className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Apply</span>
              </button>
            </div>
          )}
          {activeTab === 'adjust' && (
            <div className="w-full max-w-5xl overflow-y-auto max-h-[320px] pr-1 mx-auto">
              <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />
            </div>
          )}
          {activeTab === 'filters' && (
            <div className="w-full max-w-5xl overflow-y-auto max-h-[320px] pr-1 mx-auto">
              <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />
            </div>
          )}

          {/* Tab buttons BELOW panel */}
          <div className="flex items-center justify-center gap-3">
            {([
              { key: 'retouch', icon: RetouchIcon, label: 'Retouch' },
              { key: 'adjust', icon: SlidersIcon, label: 'Adjust' },
              { key: 'filters', icon: FilterIcon, label: 'Filters' }
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ease-in-out ${activeTab === key
                  ? 'bg-gray-200/80 text-gray-800 border-gray-400 scale-110'
                  : 'text-gray-600 hover:text-gray-800 hover:scale-105 border-gray-300/50 hover:border-gray-400/70'
                  }`}
                aria-label={label}
              >
                <Icon className="w-6 h-6" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PixshopPage;