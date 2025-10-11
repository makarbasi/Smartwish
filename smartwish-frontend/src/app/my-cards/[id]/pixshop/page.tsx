'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { mutate } from 'swr';
import { sessionDataManager, fileToBlob, blobToFile } from '@/utils/sessionDataManager';

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

// IndexedDB utilities for efficient image storage
const DB_NAME = 'SmartWishPixshop';
const DB_VERSION = 1;
const STORE_NAME = 'pageImages';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const storeImageInDB = async (key: string, imageFile: File): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  await new Promise<void>((resolve, reject) => {
    const request = store.put({
      id: key,
      file: imageFile,
      timestamp: Date.now()
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  db.close();
};

const getImageFromDB = async (key: string): Promise<File | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const result = await new Promise<any>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return result?.file || null;
  } catch (error) {
    console.warn('Failed to get image from IndexedDB:', error);
    return null;
  }
};

const cleanupOldSessionData = async (): Promise<void> => {
  // Remove oldest page data to free up space
  const keysToRemove: string[] = [];
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('pixshop-page-') || key?.startsWith('pixshop-stack-')) {
      try {
        const data = JSON.parse(sessionStorage.getItem(key) || '{}');
        if (data.timestamp && (now - data.timestamp) > maxAge) {
          keysToRemove.push(key);
        }
      } catch (e) {
        // Invalid data, mark for removal
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach(key => {
    console.log(`🧹 Removing old session data: ${key}`);
    sessionStorage.removeItem(key);
  });

  console.log(`🧹 Cleaned up ${keysToRemove.length} old session storage entries`);
};

// Synchronous fallback save for when async operations might be interrupted
const synchronousFallbackSave = (
  pageStorageKey: string,
  stackStorageKey: string,
  history: File[],
  historyIndex: number,
  currentImage: File | null,
  originalImage: File | null,
  pageIndex: number,
  templateIdParam: string | null
): void => {
  if (typeof window === 'undefined' || !templateIdParam || !currentImage) return;

  try {
    const pageState = {
      historyLength: history.length,
      historyIndex,
      hasChanges: history.length > 1 || historyIndex > 0,
      timestamp: Date.now(),
      pageIndex,
      synchronousSave: true
    };

    // Only save basic state info without image data in synchronous mode
    sessionStorage.setItem(pageStorageKey, JSON.stringify(pageState));
    console.log(`⚡ Synchronous fallback save completed for page ${pageIndex}`);
  } catch (error) {
    console.warn('⚠️ Even synchronous save failed:', error);
  }
};

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error(`Fetch error ${res.status}`);
    return res.json();
  });

// Use the centralized Gemini-based image generation service
import { generateEditedImage, generateFilteredImage, generateAdjustedImage } from '../../../services/geminiService';
import { saveSavedDesignWithImages } from '@/utils/savedDesignUtils';
import { processImageForUpload } from '@/utils/imageOptimizer';
import { usePixshop } from '@/contexts/PixshopContext';

// Helper function to convert File to Data URL
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

// Spinner Component
const Spinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
)

// External panels (from src/components/pixshop)
import FilterPanel from '../../../../components/pixshop/FilterPanel';
import AdjustmentPanel from '../../../../components/pixshop/AdjustmentPanel';
import { useVoiceInput } from '@/hooks/useVoiceInput';

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

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

const MicrophoneIcon = ({ className, isRecording }: { className?: string; isRecording?: boolean }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    {isRecording && (
      <circle cx="12" cy="12" r="8" className="animate-pulse" fill="currentColor" opacity="0.2" />
    )}
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

// Helper to extract an image at a given index from a savedDesign object
const getImageByIndexFromSavedDesign = (savedDesign: any, index: number): { url: string | null; total: number } => {

  console.log('getImageByIndexFromSavedDesign', { savedDesign, index });
  if (!savedDesign) return { url: null, total: 0 };

  // Collect images in priority order into an array preserving positions
  let images: (string | undefined)[] = [];
  const individual = [savedDesign.image1, savedDesign.image2, savedDesign.image3, savedDesign.image4].filter((v: any) => v !== undefined && v !== null);
  if (individual.length > 0) images = [savedDesign.image1, savedDesign.image2, savedDesign.image3, savedDesign.image4];

  if (images.length === 0 && savedDesign.designData && Array.isArray(savedDesign.designData.pages)) {
    images = savedDesign.designData.pages.map((p: any) => p?.image || '');
  }

  if (images.length === 0 && Array.isArray(savedDesign.imageUrls) && savedDesign.imageUrls.length > 0) {
    images = [...savedDesign.imageUrls];
  }

  if (images.length === 0 && savedDesign.thumbnail) {
    images = [savedDesign.thumbnail];
  }

  const total = images.length;
  if (total === 0) return { url: null, total: 0 };

  // If index is out of range but looks 1-based, attempt (index-1)
  let chosenIndex = index;
  if (chosenIndex >= total && index - 1 >= 0 && index - 1 < total) {
    // Treat provided pageIndex as 1-based
    chosenIndex = index - 1;
  }

  if (chosenIndex < 0 || chosenIndex >= total) chosenIndex = 0; // fallback

  return { url: images[chosenIndex] || null, total };
};

type Tab = 'retouch' | 'adjust' | 'filters';

const PixshopPage: React.FC = () => {
  const { data: session } = useSession();
  const params = useParams();
  const cardParam = params?.id as string; // could be actual id or 'template-editor'
  const searchParams = useSearchParams();
  const rawPageIndex = searchParams?.get('pageIndex');
  const templateIdParam = searchParams?.get('templateId') || undefined;
  const templateNameParam = searchParams?.get('templateName') || undefined;
  const returnToPintura = searchParams?.get('returnToPintura') === '1';
  const fromPintura = searchParams?.get('fromPintura') === '1';
  const isTemplateContext = cardParam === 'template-editor' || !!templateIdParam;

  // Pixshop context for managing blob data
  const { setPixshopBlob, setSaveStatus } = usePixshop();

  console.log('🎯 Pixshop page loading with params:', {
    cardParam,
    templateIdParam,
    templateNameParam,
    returnToPintura,
    fromPintura,
    isTemplateContext,
    rawPageIndex,
    allSearchParams: Object.fromEntries(searchParams?.entries() || [])
  });
  // Effective design id we use to look up saved design
  const effectiveDesignId = isTemplateContext ? (templateIdParam || '') : (cardParam || '');
  const pageIndexParam = rawPageIndex ? parseInt(rawPageIndex, 10) : 0;
  // We'll treat incoming index as zero-based, but fallback code in getter handles 1-based if needed
  const pageIndex = Number.isNaN(pageIndexParam) ? 0 : pageIndexParam;
  const router = useRouter();
  // Local copy of the design so we don't repeatedly depend on the SWR array lookups
  const [localDesign, setLocalDesign] = useState<SavedDesign | null>(null);

  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  // Removed remote save; we only pass edited image back via sessionStorage

  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [hasStarted, setHasStarted] = useState<boolean>(true);
  const [hasUserInteracted, setHasUserInteracted] = useState<boolean>(false);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Voice input for retouch tab
  const { isRecording, isSupported, startRecording } = useVoiceInput({
    onResult: (transcript) => {
      setPrompt(transcript);
    },
  });

  // Reset interaction state when component mounts (reopening Pixshop)
  useEffect(() => {
    console.log('🔄 Pixshop component mounted - resetting interaction state');
    setHasUserInteracted(false);
  }, []);

  // Create a unique storage key for this page
  const pageStorageKey = `pixshop-page-${templateIdParam}-${pageIndex}`;
  const stackStorageKey = `pixshop-stack-${templateIdParam}`;
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Save current page state using session manager for cross-route persistence
  const savePageState = useCallback(async () => {
    if (typeof window === 'undefined' || !templateIdParam) return;

    try {
      const hasChanges = history.length > 1 || historyIndex > 0;

      const pageData = {
        historyLength: history.length,
        historyIndex,
        hasChanges,
        originalImageExists: !!originalImage,
        timestamp: Date.now()
      };

      // Get current image blob if we have changes
      let imageBlob: Blob | undefined;
      if (currentImage && hasChanges) {
        try {
          imageBlob = await fileToBlob(currentImage);
          console.log(`🖼️ Converted current image to blob for page ${pageIndex}`);
        } catch (error) {
          console.warn('⚠️ Failed to convert image to blob:', error);
        }
      }

      // Save to session manager (handles both sessionStorage and memory)
      sessionDataManager.savePageData(templateIdParam, pageIndex, pageData, imageBlob);

      console.log(`💾 Saved page state via session manager for page ${pageIndex}:`, {
        hasChanges,
        historyLength: history.length,
        hasImageBlob: !!imageBlob
      });
    } catch (error) {
      console.warn('⚠️ Failed to save page state via session manager:', error);
    }
  }, [history, historyIndex, currentImage, originalImage, pageIndex, templateIdParam]);

  // Restore page state using session manager
  const restorePageState = useCallback(async () => {
    if (typeof window === 'undefined' || !templateIdParam) return false;

    try {
      const pageData = sessionDataManager.getPageData(templateIdParam, pageIndex);

      if (!pageData) {
        console.log(`📂 No session data found for template ${templateIdParam}, page ${pageIndex}`);
        return false;
      }

      console.log(`📂 Found session data for page ${pageIndex}:`, {
        hasChanges: pageData.hasChanges,
        historyLength: pageData.historyLength,
        hasBlob: !!pageData.editedImageBlob
      });

      if (pageData.hasChanges && pageData.editedImageBlob) {
        // Convert blob back to File
        const restoredFile = blobToFile(
          pageData.editedImageBlob,
          `restored-page-${pageIndex}-${Date.now()}.jpg`
        );

        console.log(`✅ Restored image from session for page ${pageIndex}:`, {
          fileName: restoredFile.name,
          fileSize: restoredFile.size,
          fileType: restoredFile.type
        });

        return restoredFile;
      }

      return false;
    } catch (error) {
      console.warn('⚠️ Failed to restore page state from session:', error);
      return false;
    }
  }, [pageIndex, templateIdParam]);

  // Check for incoming Pintura state when coming from Pintura editor
  useEffect(() => {
    if (fromPintura && typeof window !== 'undefined') {
      console.log('🎯 Pixshop: Checking for incoming Pintura state...');

      try {
        const pinturaStateStr = sessionStorage.getItem('pinturaToPixshop');
        if (pinturaStateStr) {
          const pinturaState = JSON.parse(pinturaStateStr);
          console.log('📥 Found Pintura state for Pixshop:', {
            pageIndex: pinturaState.pageIndex,
            templateId: pinturaState.templateId,
            fromPintura: pinturaState.fromPintura,
            changesSaved: pinturaState.changesSaved
          });

          // Clear the sessionStorage since we've received the state
          sessionStorage.removeItem('pinturaToPixshop');

          // All cases: let the normal loading process happen to get the current card state
          console.log('✅ Coming from Pintura - loading current card state from database');
          return;
        } else {
          console.log('📝 No Pintura state found - proceeding with normal loading');
        }
      } catch (error) {
        console.error('❌ Failed to load Pintura state:', error);
        // Continue with normal loading if Pintura state fails
      }
    }
  }, [fromPintura]);

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

  // Load image from saved design when data is available and page index changes (initial only)
  useEffect(() => {
    // Skip if we've already loaded from Pintura state or if we already have history
    if (history.length > 0) return;

    // First try to restore page state
    const loadImage = async () => {
      console.log(`🔄 Loading image for page ${pageIndex}...`);

      // PRIORITY 1: Check for processed image from retouch flow
      if (typeof window !== 'undefined') {
        const retouchImageUrl = sessionStorage.getItem('retouchProcessedImage');
        const retouchTimestamp = sessionStorage.getItem('retouchProcessedImageTimestamp');

        if (retouchImageUrl && retouchTimestamp) {
          const timestamp = parseInt(retouchTimestamp);
          const now = Date.now();

          // Only use if processed within the last 10 seconds (fresh from retouch)
          if (now - timestamp < 10000) {
            try {
              console.log('🎨 Found fresh processed image from retouch button:', retouchImageUrl.substring(0, 50));

              const response = await fetch(retouchImageUrl);
              const blob = await response.blob();
              const file = new File([blob], `retouch-processed-${Date.now()}.jpg`, { type: blob.type });

              setHistory([file]);
              setHistoryIndex(0);
              setIsInitialLoad(false);

              // Clean up session storage
              sessionStorage.removeItem('retouchProcessedImage');
              sessionStorage.removeItem('retouchProcessedImageTimestamp');

              console.log('✅ Successfully loaded processed image from retouch');
              return;
            } catch (error) {
              console.error('❌ Failed to load retouch processed image:', error);
              // Continue with normal loading
            }
          } else {
            console.log('⏰ Retouch processed image is stale, removing and continuing with normal loading');
            sessionStorage.removeItem('retouchProcessedImage');
            sessionStorage.removeItem('retouchProcessedImageTimestamp');
          }
        }
      }

      // PRIORITY 2: Try to restore from saved page state
      const restoredImage = await restorePageState();
      if (restoredImage) {
        console.log(`✅ Restored edited image from saved state for page ${pageIndex}`);
        setHistory([restoredImage]);
        setHistoryIndex(0);
        setIsInitialLoad(false);
        return;
      }

      // PRIORITY 3: Proceed with normal loading
      console.log(`📥 No saved state found, loading original image for page ${pageIndex}`);

      if (apiResponse?.data && effectiveDesignId) {
        const savedDesign = apiResponse.data.find((d) => d.id === effectiveDesignId);
        if (!savedDesign) {
          // If we're in template context, attempt to load template directly
          if (isTemplateContext && templateIdParam) {
            try {
              // First try sessionStorage handoff (faster, includes edited pages in memory)
              if (typeof window !== 'undefined') {
                const stored = sessionStorage.getItem('templateEditorForPixshop');
                if (stored) {
                  try {
                    const parsed = JSON.parse(stored);
                    if (parsed?.templateId === templateIdParam && Array.isArray(parsed.pages) && parsed.pages.length) {
                      const pseudo: SavedDesign = {
                        id: templateIdParam,
                        title: parsed.templateName || 'Template',
                        image1: parsed.pages[0],
                        image2: parsed.pages[1],
                        image3: parsed.pages[2],
                        image4: parsed.pages[3],
                        thumbnail: parsed.pages[0],
                        designData: { pages: parsed.pages.map((img: string) => ({ image: img })) }
                      };
                      setLocalDesign(pseudo);
                      const { url } = getImageByIndexFromSavedDesign(pseudo, pageIndex);
                      if (url) {
                        const blobRes = await fetch(url);
                        const blob = await blobRes.blob();
                        const file = new File([blob], `template-${templateIdParam}-page-${pageIndex}.jpg`, { type: blob.type || 'image/jpeg' });
                        setHistory([file]);
                        setHistoryIndex(0);
                        setIsInitialLoad(false);
                        return; // Done via session storage
                      }
                    }
                  } catch { }
                }
              }
              const resp = await fetch(`/api/templates/${templateIdParam}`);
              if (!resp.ok) {
                throw new Error(`Template fetch failed: ${resp.status}`);
              }
              const result = await resp.json();
              if (!result?.data) throw new Error('Template data missing');
              const t = result.data;
              const images = [t.image_1, t.image_2, t.image_3, t.image_4].filter(Boolean);
              if (images.length === 0) {
                setError('Template has no images to edit.');
                return;
              }
              const pseudo: SavedDesign = {
                id: templateIdParam,
                title: templateNameParam ? decodeURIComponent(templateNameParam) : (t.title || 'Template'),
                image1: t.image_1 || undefined,
                image2: t.image_2 || undefined,
                image3: t.image_3 || undefined,
                image4: t.image_4 || undefined,
                thumbnail: t.image_1 || undefined,
                designData: { pages: images.map((img: string) => ({ image: img })) }
              };
              setLocalDesign(pseudo);
              const { url } = getImageByIndexFromSavedDesign(pseudo, pageIndex);
              if (!url) {
                setError(`No image found at index ${pageIndex} for this template.`);
                return;
              }
              const blobRes = await fetch(url);
              const blob = await blobRes.blob();
              const file = new File([blob], `template-${templateIdParam}-page-${pageIndex}.jpg`, { type: blob.type || 'image/jpeg' });
              setHistory([file]);
              setHistoryIndex(0);
              setIsInitialLoad(false);
            } catch (e) {
              console.error('❌ Failed to load template fallback:', e);
              setError(e instanceof Error ? e.message : 'Failed to load template');
            }
          } else {
            setError(`Card with ID ${effectiveDesignId} not found. Please check the URL or try refreshing the page.`);
          }
          return;
        }
        // Cache locally for subsequent operations
        setLocalDesign(savedDesign);
        const { url } = getImageByIndexFromSavedDesign(savedDesign, pageIndex);
        if (!url) {
          setError(`No image found at index ${pageIndex} for this card.`);
          return;
        }
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const file = new File([blob], `card-${effectiveDesignId}-page-${pageIndex}.jpg`, { type: 'image/jpeg' });
          setHistory([file]);
          setHistoryIndex(0);
          setIsInitialLoad(false);
        } catch (err) {
          console.error('❌ Error loading image:', err);
          setError('Failed to load image from saved design');
        }
      }
    };

    // Call the async function
    loadImage();
  }, [apiResponse, effectiveDesignId, history.length, pageIndex, isTemplateContext, templateIdParam, templateNameParam, restorePageState]);

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

  // Handle browser navigation (back button) as cancellation
  useEffect(() => {
    console.log('🔧 Setting up popstate handler for browser back button');

    const handlePopState = async () => {
      console.log('🚫 Browser back button detected - saving state and cleaning up sessionStorage');
      // Save current state before leaving
      try {
        await savePageState();
        console.log('✅ State saved successfully before navigation');
      } catch (error) {
        console.warn('⚠️ Failed to save state before navigation:', error);
      }
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pixshopToPintura');
        sessionStorage.removeItem('pixshopTemplateEdit');
      }
    };

    // Also save state when page is about to unload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('📤 Page unloading - saving current state');

      // Try async save first, but don't wait for it
      savePageState().catch(error => {
        console.warn('⚠️ Async save failed during unload:', error);
      });

      // Immediate synchronous fallback to ensure SOMETHING is saved
      synchronousFallbackSave(
        pageStorageKey,
        stackStorageKey,
        history,
        historyIndex,
        currentImage,
        originalImage,
        pageIndex,
        templateIdParam
      );

      // Don't prevent the user from leaving, just save what we can
      console.log('✅ Synchronous save completed during unload');
    };

    // Handle page visibility changes (user switches tabs or navigates)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📱 Page becoming hidden - saving state immediately');
        // Page is being hidden, save immediately with fallback
        savePageState().catch(error => {
          console.warn('⚠️ Async save failed on visibility change:', error);
        });

        // Synchronous fallback
        synchronousFallbackSave(
          pageStorageKey,
          stackStorageKey,
          history,
          historyIndex,
          currentImage,
          originalImage,
          pageIndex,
          templateIdParam
        );
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('🧹 Cleaning up navigation handlers and saving state');

      // Try async save first
      savePageState().catch(error => {
        console.warn('⚠️ Async save failed during unmount:', error);
      });

      // Immediate synchronous fallback
      synchronousFallbackSave(
        pageStorageKey,
        stackStorageKey,
        history,
        historyIndex,
        currentImage,
        originalImage,
        pageIndex,
        templateIdParam
      );

      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [savePageState, pageStorageKey, stackStorageKey, history, historyIndex, currentImage, originalImage, pageIndex, templateIdParam]);

  // Auto-save when history or historyIndex changes (user made edits)
  useEffect(() => {
    // Don't save during initial load or if there are no changes
    if (isInitialLoad || (!history.length || (history.length === 1 && historyIndex === 0))) {
      return;
    }

    console.log('🔄 History changed, auto-saving state:', {
      historyLength: history.length,
      historyIndex,
      hasChanges: history.length > 1 || historyIndex > 0
    });

    // Debounced save to avoid excessive saves during rapid changes
    const saveTimeout = setTimeout(async () => {
      try {
        await savePageState();
        console.log('✅ Auto-saved state after history change');
      } catch (error) {
        console.warn('⚠️ Failed to auto-save state:', error);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(saveTimeout);
  }, [history, historyIndex, savePageState, isInitialLoad]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Auto-save function that runs after each edit
  const handleAutoSave = useCallback(async () => {
    console.log('🚀 Auto-save triggered with state:', {
      hasCurrentImage: !!currentImage,
      hasUser: !!session?.user?.id,
      isTemplateContext,
      isAutoSaving,
      autoSaveStatus
    });

    if (!currentImage || !session?.user?.id || isTemplateContext || isAutoSaving) {
      console.log('❌ Auto-save skipped:', {
        noImage: !currentImage,
        noUser: !session?.user?.id,
        templateContext: isTemplateContext,
        alreadySaving: isAutoSaving
      });
      return;
    }

    if (!effectiveDesignId) {
      console.log('❌ Auto-save skipped: Missing design id');
      return;
    }

    try {
      setIsAutoSaving(true);
      setAutoSaveStatus('saving');

      // Convert the edited image file to data URL
      const newImageDataUrl = await fileToDataURL(currentImage);
      console.log('📸 Auto-save: Converted edited image to data URL');

      // Get current saved design to find the existing Supabase URL for this page
      const savedDesign = apiResponse?.data?.find((d) => d.id === effectiveDesignId);

      if (!savedDesign) {
        console.error('❌ Auto-save failed: Design not found');
        setAutoSaveStatus('error');
        return;
      }

      // Get the existing Supabase URL for this page index
      const { url: existingSupabaseUrl } = getImageByIndexFromSavedDesign(savedDesign, pageIndex);

      if (!existingSupabaseUrl) {
        console.error(`❌ Auto-save failed: No existing image found at page index ${pageIndex}`);
        setAutoSaveStatus('error');
        return;
      }

      console.log('🔄 Auto-save: Updating Supabase image content...');

      // Use the simplified update-images API to replace the Supabase image content
      const response = await fetch('/api/update-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          supabaseUrl: existingSupabaseUrl,
          newImageBlob: newImageDataUrl,
          designId: effectiveDesignId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to auto-save image');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to auto-save image');
      }

      console.log('✅ Auto-save successful: Image content updated in Supabase');
      setAutoSaveStatus('saved');

      // Force refresh the SWR cache for saved designs to show updated image
      if (typeof window !== 'undefined') {
        mutate('/api/saved-designs');
      }

      // Reset status after 2 seconds
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);

    } catch (err) {
      console.error('❌ Auto-save failed:', err);
      setAutoSaveStatus('error');

      // Reset error status after 3 seconds
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);
    } finally {
      setIsAutoSaving(false);
    }
  }, [currentImage, effectiveDesignId, pageIndex, session, apiResponse, isTemplateContext, isAutoSaving, autoSaveStatus]);

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Save page state when we add new image to history
    setTimeout(async () => {
      try {
        await savePageState();
        console.log('✅ State saved after adding image to history');
      } catch (error) {
        console.warn('⚠️ Failed to save state after adding image:', error);
      }
    }, 100); // Small delay to ensure state is updated

    // Trigger auto-save after image edit (for non-template context)
    setTimeout(() => {
      if (!isTemplateContext) {
        console.log('🚀 Triggering auto-save after image edit...');
        handleAutoSave();
      } else {
        console.log('📝 Template context - skipping auto-save');
      }
    }, 500); // Small delay to ensure history state is fully updated
  }, [history, historyIndex, savePageState, isTemplateContext, handleAutoSave]);

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
      // Save state after undo
      setTimeout(async () => {
        try {
          await savePageState();
          console.log('✅ State saved after undo');
        } catch (error) {
          console.warn('⚠️ Failed to save state after undo:', error);
        }
      }, 100);
    }
  }, [canUndo, historyIndex, savePageState]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
      // Save state after redo
      setTimeout(async () => {
        try {
          await savePageState();
          console.log('✅ State saved after redo');
        } catch (error) {
          console.warn('⚠️ Failed to save state after redo:', error);
        }
      }, 100);
    }
  }, [canRedo, historyIndex, savePageState]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
      // Save state after reset
      setTimeout(() => savePageState(), 100);
    }
  }, [history, savePageState]);

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

  const handleCancel = useCallback(() => {
    console.log('🚫 User canceled pixshop editing - returning without saving');

    // Mark that user has interacted (clicked cancel)
    setHasUserInteracted(true);

    // Clean up any potential sessionStorage data to prevent stale data issues
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pixshopToPintura');
      sessionStorage.removeItem('pixshopTemplateEdit');
      // Also clean up individual page state and global stack
      sessionStorage.removeItem(pageStorageKey);
      sessionStorage.removeItem(stackStorageKey);
      console.log('🧹 Cleaned up sessionStorage on cancel (including page state and global stack)');
    }

    // Navigate back without saving any changes
    if (isTemplateContext) {
      // Template context: return to template editor
      const q = new URLSearchParams();
      if (templateIdParam) q.set('templateId', templateIdParam);
      if (templateNameParam) q.set('templateName', templateNameParam || '');
      q.set('pageIndex', String(pageIndex));
      // Note: We don't set returnToPintura flag because we're canceling
      console.log('🔄 Canceling - redirecting back to template editor without changes');
      router.push(`/my-cards/template-editor?${q.toString()}`);
    } else {
      // Regular card context: return to card editor
      console.log('🔄 Canceling - redirecting back to card editor without changes');
      router.push(`/my-cards/${effectiveDesignId}`);
    }
  }, [isTemplateContext, templateIdParam, templateNameParam, pageIndex, router, effectiveDesignId, hasUserInteracted, pageStorageKey, stackStorageKey]);

  const handleSave = useCallback(async () => {
    console.log('💾 handleSave called with state:', {
      hasCurrentImage: !!currentImage,
      hasUser: !!session?.user?.id,
      isTemplateContext,
      returnToPintura,
      hasUserInteracted,
      fromPintura
    });

    if (!currentImage) {
      setError('No image to save');
      return;
    }

    if (!session?.user?.id) {
      setError('Please log in to save changes');
      return;
    }

    // Mark that user has interacted (clicked save)
    setHasUserInteracted(true);

    // Template context: just return to template editor (future: persist changes upstream)
    if (isTemplateContext) {
      console.log('📝 Template context detected - skipping database save');
      console.log('🔍 Template context details:', { cardParam, templateIdParam, isTemplateContext });

      // Check if we came from Pintura (only check explicit URL parameter, not referrer)
      const returnToPintura = searchParams?.get('returnToPintura') === '1';

      console.log('🔍 Return to Pintura check:', {
        returnToPinturaParam: searchParams?.get('returnToPintura'),
        willReturnToPintura: returnToPintura,
        hasUserInteracted,
        currentImageExists: !!currentImage
      });

      if (returnToPintura) {
        console.log('🔄 Returning edited image to Pintura editor');
        try {
          setIsLoading(true);

          // Store the edited image for Pintura to consume
          const dataUrl = await fileToDataURL(currentImage);
          console.log('🖼️ Converted edited image to data URL (size:', dataUrl.length, 'chars)');
          console.log('🖼️ Data URL starts with:', dataUrl.substring(0, 50));

          // Log binary data details
          console.log('📊 Current image file details:', {
            name: currentImage.name,
            size: currentImage.size,
            type: currentImage.type,
            lastModified: currentImage.lastModified
          });

          // Log blob data in chunks to avoid console truncation
          const chunkSize = 100;
          for (let i = 0; i < Math.min(500, dataUrl.length); i += chunkSize) {
            console.log(`🔢 Binary chunk ${Math.floor(i / chunkSize) + 1}:`, dataUrl.substring(i, i + chunkSize));
          }

          // Create a blob URL for verification
          const blobUrl = URL.createObjectURL(currentImage);
          console.log('🌐 Created blob URL for verification:', blobUrl);

          // Test if the data URL can be loaded as an image
          if (typeof window !== 'undefined') {
            const testImg = document.createElement('img');
            testImg.onload = () => {
              console.log('✅ Data URL successfully creates valid image:', {
                width: testImg.width,
                height: testImg.height,
                naturalWidth: testImg.naturalWidth,
                naturalHeight: testImg.naturalHeight
              });
              URL.revokeObjectURL(blobUrl); // Clean up test blob URL
            };
            testImg.onerror = (error: any) => {
              console.error('❌ Data URL failed to load as image:', error);
              URL.revokeObjectURL(blobUrl); // Clean up test blob URL
            };
            testImg.src = dataUrl;
          }

          const pinturaPayload = {
            pageIndex,
            editedImage: dataUrl,
            templateId: templateIdParam,
            returnToPintura: true,
            timestamp: Date.now(),
            blobUrl: blobUrl, // Include blob URL for reference
            fileSize: currentImage.size,
            fileType: currentImage.type
          };

          try {
            sessionStorage.setItem('pixshopToPintura', JSON.stringify(pinturaPayload));
            console.log('💾 Saved edited image for Pintura to consume');
            console.log('📦 Payload size:', JSON.stringify(pinturaPayload).length, 'chars');
            console.log('📋 Payload structure:', {
              pageIndex: pinturaPayload.pageIndex,
              templateId: pinturaPayload.templateId,
              hasEditedImage: !!pinturaPayload.editedImage,
              editedImageSize: pinturaPayload.editedImage.length,
              blobUrl: pinturaPayload.blobUrl,
              fileSize: pinturaPayload.fileSize,
              fileType: pinturaPayload.fileType
            });

            // Verify sessionStorage was written correctly
            const stored = sessionStorage.getItem('pixshopToPintura');
            if (stored) {
              const parsed = JSON.parse(stored);
              console.log('✅ Verified sessionStorage contains blob data:', {
                hasData: !!parsed.editedImage,
                dataSize: parsed.editedImage?.length || 0,
                dataPrefix: parsed.editedImage?.substring(0, 30) || 'none'
              });
            }
          } catch (storageError) {
            console.warn('⚠️ Failed to save to sessionStorage:', storageError);
          }

          // Navigate back to template editor (which will open Pintura with the edited image)
          const q = new URLSearchParams();
          if (templateIdParam) q.set('templateId', templateIdParam);
          if (templateNameParam) q.set('templateName', templateNameParam || '');
          q.set('returnToPintura', '1');
          q.set('pageIndex', String(pageIndex));
          console.log('🔄 Returning to template editor to reopen Pintura with edited image');
          router.push(`/my-cards/template-editor?${q.toString()}`);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Regular template editor return (not from Pintura)
      try {
        setIsLoading(true);

        // Get the complete global stack of changes
        const globalStack = getGlobalStack();

        // Add current page to stack before saving
        if (currentImage) {
          const currentDataUrl = await fileToDataURL(currentImage);
          updateGlobalStack(pageIndex, currentDataUrl);
        }

        // Get updated stack after adding current page
        const updatedStack = getGlobalStack();

        console.log('📚 Saving complete stack to template editor:', {
          totalPages: Object.keys(updatedStack).length,
          pagesWithChanges: Object.keys(updatedStack).map(key => parseInt(key)),
          currentPage: pageIndex
        });

        // Convert stack to format expected by template editor
        const stackPayload = {
          templateId: templateIdParam,
          pageChanges: updatedStack,
          lastEditedPage: pageIndex,
          timestamp: Date.now()
        };

        try {
          sessionStorage.setItem('pixshopTemplateEdit', JSON.stringify(stackPayload));
          console.log('💾 Saved complete page stack to sessionStorage for template editor');
        } catch (storageError) {
          console.warn('⚠️ Failed to save stack to sessionStorage:', storageError);
        }

        const q = new URLSearchParams();
        if (templateIdParam) q.set('templateId', templateIdParam);
        if (templateNameParam) q.set('templateName', templateNameParam || '');
        q.set('updated', '1');
        q.set('fromPixshop', '1');
        q.set('pageIndex', String(pageIndex));
        console.log('🔄 Redirecting back to template editor with complete stack:', q.toString());
        router.push(`/my-cards/template-editor?${q.toString()}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Non-template context: save through backend using the proper utility
    if (!effectiveDesignId) {
      setError('Missing design id');
      return;
    }

    // Extra safety check - should never reach here in template context
    if (isTemplateContext) {
      console.error('🚨 ERROR: Reached database save section while in template context!');
      console.error('🚨 Template context details:', { cardParam, templateIdParam, isTemplateContext });
      setError('Internal error: Template context should not save to database');
      return;
    }

    console.log('💾 Non-template context - proceeding with database save');
    console.log('🔍 Save context details:', { effectiveDesignId, cardParam, isTemplateContext });

    try {
      setIsLoading(true);
      setError(null);

      // IMMEDIATE RETURN: Store the current blob in context for instant preview
      console.log('🚀 Storing image blob for immediate preview in context...');

      // Convert blob to data URL for cross-page compatibility
      console.log('🔄 Converting blob to data URL for cross-page transfer...');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(currentImage);
      });

      console.log('✅ Blob converted to data URL:', dataUrl.substring(0, 50) + '...');

      // Store the data URL in context for instant preview
      const pixshopBlobData = {
        designId: effectiveDesignId,
        pageIndex: pageIndex,
        blob: currentImage, // Store the actual blob for potential use
        blobUrl: dataUrl, // Use data URL instead of blob URL for cross-page compatibility
        timestamp: Date.now(),
        fromPixshop: true
      };

      setPixshopBlob(pixshopBlobData);
      console.log('📸 Data URL stored in context, navigating back immediately...');

      // Navigate back immediately with the blob for instant preview
      const timestamp = Date.now();
      router.push(`/my-cards/${cardParam}?openPintura=1&fromPixshop=1&pageIndex=${pageIndex}&timestamp=${timestamp}`);

      // ASYNC SAVE: Continue save operation in background
      console.log('🔄 Starting async save in background...');
      setSaveStatus(true); // Mark as saving

      // Don't await this - let it run in background
      saveInBackground();

    } catch (err) {
      console.error('Save failed', err);
      setError(err instanceof Error ? err.message : 'Failed to save image');
      setIsLoading(false);
    }

    // Background save function
    async function saveInBackground() {
      try {
        console.log('🔄 Background save: Finding saved design...');

        // Get current saved design to find the existing Supabase URL for this page
        const savedDesign = apiResponse?.data?.find((d) => d.id === effectiveDesignId);

        if (!savedDesign) {
          console.error('❌ Background save failed: Design not found');
          return;
        }

        // Get the existing Supabase URL for this page index
        const { url: existingSupabaseUrl } = getImageByIndexFromSavedDesign(savedDesign, pageIndex);

        if (!existingSupabaseUrl) {
          console.error(`❌ Background save failed: No existing image found at page index ${pageIndex}`);
          return;
        }

        console.log('🔄 Background save: Optimizing and updating image in Supabase...');

        // Optimize the image for faster upload
        const optimizedImage = await processImageForUpload(currentImage);

        // Convert optimized image to base64 data URL for the API
        console.log('🔄 Converting optimized image to base64 for API...');
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(optimizedImage);
        });

        // Create JSON payload for the API
        const updatePayload = {
          supabaseUrl: existingSupabaseUrl,
          newImageBlob: base64DataUrl,
          // Only pass designId if we're NOT in template context (extra safety)
          ...((!isTemplateContext) && { designId: effectiveDesignId })
        };

        console.log('🔄 Sending JSON payload to update-images API...');

        // Use the existing update-images API with JSON payload
        const response = await fetch('/api/update-images', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update image');
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to update image');
        }

        console.log('✅ Background save: Image updated successfully in Supabase');

        // Update context to mark save as complete
        setSaveStatus(false);

        // Force refresh the SWR cache for saved designs
        if (typeof window !== 'undefined') {
          mutate('/api/saved-designs');
        }

      } catch (err) {
        console.error('❌ Background save failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setSaveStatus(false, errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  }, [currentImage, effectiveDesignId, pageIndex, cardParam, router, isTemplateContext, templateIdParam, templateNameParam, session, apiResponse, searchParams, refetchData, hasUserInteracted, setPixshopBlob, setSaveStatus]);

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
            className={`w-auto h-auto object-contain ${imageMaxHeightClass} max-w-full rounded-xl pointer-events-none`}
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        )}
        {/* The current image is an overlay that fades in/out for comparison */}
        <img
          ref={imgRef}
          key={currentImageUrl}
          src={currentImageUrl || undefined}
          alt="Current"
          onClick={handleImageClick}
          className={`absolute top-0 left-0 w-auto h-auto object-contain ${imageMaxHeightClass} max-w-full rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>
    );

    return (
      <div className="w-full mx-auto flex flex-col items-center gap-4 animate-fade-in pb-20">
        {/* Top Action Buttons */}
        <div className="flex items-center justify-between gap-2 mb-2 w-full">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isTemplateContext) {
                  const q = new URLSearchParams();
                  if (templateIdParam) q.set('templateId', templateIdParam);
                  if (templateNameParam) q.set('templateName', templateNameParam);
                  q.set('fromPixshop', '1');
                  q.set('pageIndex', String(pageIndex));
                  router.push(`/my-cards/template-editor?${q.toString()}`);
                } else {
                  router.push(`/my-cards/${cardParam}?openPintura=1&fromPixshop=1&pageIndex=${pageIndex}`);
                }
              }}
              className="flex items-center justify-center bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-300 active:scale-95 shadow-lg"
              aria-label="Back to Pintura Editor"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
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

          <div className="flex items-center gap-3">
            {/* Auto-save status indicator */}
            {!isTemplateContext && (
              <div className="flex items-center gap-2 text-sm">
                {autoSaveStatus === 'saving' && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Auto-saving...</span>
                  </div>
                )}
                {autoSaveStatus === 'saved' && (
                  <div className="flex items-center gap-2 text-green-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Auto-saved</span>
                  </div>
                )}
                {autoSaveStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>Auto-save failed</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!currentImage || isLoading || isInitialLoad}
                className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Save and return edited image to editor"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <CheckIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Upload button removed as per request */}

        <div className="flex justify-center w-full">
          <div className="relative inline-block shadow-lg rounded-xl overflow-hidden bg-white p-2 max-w-full">
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
  const bottomPaddingClass = activeTab === 'retouch' ? 'pb-[160px]' : 'pb-[350px]';
  const imageMaxHeightClass = activeTab === 'retouch' ? 'max-h-[calc(100vh-220px)]' : 'max-h-[calc(100vh-420px)]';

  return (
    <div className="min-h-screen h-screen text-gray-800 bg-[#fafafa] flex flex-col">
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-3 sm:p-4 md:p-8 flex justify-center ${currentImage ? 'items-start' : 'items-center'} ${bottomPaddingClass}`}>
        {/* Inject dynamic max-height class into image elements by replacing their max-h utility */}
        <style>{`
          /* Override existing 60vh cap with dynamic calculation */
          .pixshop-dynamic-image > img, .pixshop-dynamic-image > .relative > img { ${''} }
        `}</style>
        {renderContent()}
      </main>

      {/* Fixed bottom tools bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-4 pt-3 pb-4 flex flex-col items-center gap-5">
          {/* Active panel / input ABOVE tool icons */}
          {activeTab === 'retouch' && (
            <div className="flex items-center gap-2 bg-white/95 border border-gray-200 rounded-xl px-2 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 focus-within:ring-2 focus-within:ring-blue-400 transition w-full max-w-xs sm:max-w-sm mx-auto">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={editHotspot ? 'Describe edit...' : 'Click area first'}
                aria-label="Retouch prompt"
                className="flex-1 min-w-0 bg-transparent placeholder-gray-400 text-gray-800 text-xs sm:text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || !editHotspot}
              />
              {isSupported && (
                <button
                  onClick={startRecording}
                  disabled={isLoading || !editHotspot || isRecording}
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
                onClick={handleGenerate}
                className="flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-500 text-white p-1.5 rounded-md shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                disabled={isLoading || !prompt.trim() || !editHotspot}
                title="Apply edit"
              >
                <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5" />
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