'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { mutate } from 'swr';

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
import { saveSavedDesignWithImages } from '@/utils/savedDesignUtils';

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
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Check for incoming Pintura state when coming from Pintura editor
  useEffect(() => {
    if (fromPintura && typeof window !== 'undefined') {
      console.log('🎯 Pixshop: Checking for incoming Pintura state...');
      
      try {
        const pinturaStateStr = sessionStorage.getItem('pinturaToPixshop');
        if (pinturaStateStr) {
          const pinturaState = JSON.parse(pinturaStateStr);
          console.log('📥 Found Pintura state for Pixshop:', {
            hasOriginal: !!pinturaState.originalImage,
            hasEdited: !!pinturaState.editedImage,
            editedSize: pinturaState.editedImage?.length,
            pageIndex: pinturaState.pageIndex,
            templateId: pinturaState.templateId,
            fromPintura: pinturaState.fromPintura,
            fallback: pinturaState.fallback
          });

          // Use the edited image from Pintura as the starting point
          const imageToUse = pinturaState.editedImage || pinturaState.originalImage;
          if (imageToUse && imageToUse.startsWith('data:')) {
            // Convert data URL to File
            const file = dataURLtoFile(imageToUse, `pintura-edited-${Date.now()}.jpg`);
            console.log('✅ Converted Pintura image to File object:', {
              name: file.name,
              size: file.size,
              type: file.type
            });
            
            // Set this as the initial image in history
            setHistory([file]);
            setHistoryIndex(0);
            setIsInitialLoad(false);
            
            console.log('🎨 Pixshop initialized with Pintura edited image');
            
            // Clear the sessionStorage to prevent reuse
            sessionStorage.removeItem('pinturaToPixshop');
            return; // Skip normal image loading
          }
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
    
    if (apiResponse?.data && effectiveDesignId) {
      const savedDesign = apiResponse.data.find((d) => d.id === effectiveDesignId);
      if (!savedDesign) {
        // If we're in template context, attempt to load template directly
        if (isTemplateContext && templateIdParam) {
          (async () => {
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
                  } catch {}
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
          })();
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
      fetch(url)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `card-${effectiveDesignId}-page-${pageIndex}.jpg`, { type: 'image/jpeg' });
          setHistory([file]);
          setHistoryIndex(0);
          setIsInitialLoad(false);
        })
        .catch(err => {
          console.error('❌ Error loading image:', err);
          setError('Failed to load image from saved design');
        });
    }
  }, [apiResponse, effectiveDesignId, history.length, pageIndex, isTemplateContext, templateIdParam, templateNameParam]);

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
    const handlePopState = () => {
      console.log('🚫 Browser back button detected - cleaning up sessionStorage');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pixshopToPintura');
        sessionStorage.removeItem('pixshopTemplateEdit');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  const handleCancel = useCallback(() => {
    console.log('🚫 User canceled pixshop editing - returning without saving');
    
    // Clean up any potential sessionStorage data to prevent stale data issues
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pixshopToPintura');
      sessionStorage.removeItem('pixshopTemplateEdit');
      console.log('🧹 Cleaned up sessionStorage on cancel');
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
  }, [isTemplateContext, templateIdParam, templateNameParam, pageIndex, router, effectiveDesignId]);

  const handleSave = useCallback(async () => {
    if (!currentImage) {
      setError('No image to save');
      return;
    }

    if (!session?.user?.id) {
      setError('Please log in to save changes');
      return;
    }

    // Template context: just return to template editor (future: persist changes upstream)
    if (isTemplateContext) {
      console.log('📝 Template context detected - skipping database save');
      console.log('🔍 Template context details:', { cardParam, templateIdParam, isTemplateContext });
      
      // Check if we came from Pintura (has returnToPintura param or referrer indicates Pintura)
      const returnToPintura = searchParams?.get('returnToPintura') === '1' || 
                             document.referrer.includes('template-editor') && 
                             !document.referrer.includes('pixshop');
      
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
            console.log(`🔢 Binary chunk ${Math.floor(i/chunkSize)+1}:`, dataUrl.substring(i, i + chunkSize));
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
        // Convert file to data URL and stash into sessionStorage for template-editor to pick up
        const dataUrl = await fileToDataURL(currentImage);
        const payload = { pageIndex, image: dataUrl, templateId: templateIdParam };
        try {
          sessionStorage.setItem('pixshopTemplateEdit', JSON.stringify(payload));
          console.log('💾 Saved edited image to sessionStorage for template editor');
        } catch (storageError) {
          console.warn('⚠️ Failed to save to sessionStorage:', storageError);
        }
        const q = new URLSearchParams();
        if (templateIdParam) q.set('templateId', templateIdParam);
        if (templateNameParam) q.set('templateName', templateNameParam || '');
        q.set('updated', '1');
        q.set('fromPixshop', '1');
        q.set('pageIndex', String(pageIndex));
        console.log('🔄 Redirecting back to template editor with query:', q.toString());
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

      // Convert the edited image file to data URL
      const newImageDataUrl = await fileToDataURL(currentImage);
      console.log('📸 Converted edited image to data URL');

      // Get current saved design to find the existing Supabase URL for this page
      const savedDesign = apiResponse?.data?.find((d) => d.id === effectiveDesignId);
      
      if (!savedDesign) {
        setError('Design not found. Please go back and try again.');
        return;
      }
      
      // Get the existing Supabase URL for this page index
      const { url: existingSupabaseUrl } = getImageByIndexFromSavedDesign(savedDesign, pageIndex);
      
      if (!existingSupabaseUrl) {
        setError(`No existing image found at page index ${pageIndex} to update.`);
        return;
      }

      console.log('🔄 Updating Supabase image content...');
      
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
          // Only pass designId if we're NOT in template context (extra safety)
          designId: isTemplateContext ? undefined : effectiveDesignId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update images');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update images');
      }

      console.log('✅ Image content updated successfully in Supabase');

      // Force refresh the SWR cache for saved designs to show updated image
      if (typeof window !== 'undefined') {
        // Clear the cache and trigger refetch
        mutate('/api/saved-designs');
        
        // Add a small delay to allow cache to clear
        setTimeout(() => {
          // Navigate back with a cache-busting timestamp
          const timestamp = Date.now();
          router.push(`/my-cards/${cardParam}?openPintura=1&updated=${timestamp}&pageIndex=${pageIndex}`);
        }, 500);
      } else {
        router.push(`/my-cards/${cardParam}?openPintura=1&updated=1&pageIndex=${pageIndex}`);
      }
    } catch (err) {
      console.error('Save failed', err);
      setError(err instanceof Error ? err.message : 'Failed to save image');
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, effectiveDesignId, pageIndex, cardParam, router, isTemplateContext, templateIdParam, templateNameParam, session, apiResponse, searchParams, refetchData]);

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
              onClick={handleCancel}
              disabled={isLoading}
              className="bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg px-3 py-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Cancel and return to editor without saving changes"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!currentImage || isLoading || isInitialLoad}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg px-3 py-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Save and return edited image to editor"
            >
              {isLoading ? 'Saving...' : 'Done'}
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