// ...existing code...
"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
// Removed FaRegSave, using Heroicons ArchiveBoxIcon for save
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowUturnLeftIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { FaRegSave } from "react-icons/fa";
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import Image from "next/image";
import HTMLFlipBook from "react-pageflip";
import PinturaEditorModal from "@/components/PinturaEditorModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import SendECardModal from "@/components/SendECardModal";
import PrinterSelectionModal from "@/components/PrinterSelectionModal";
import CardPaymentModal from "@/components/CardPaymentModal";
import MarketplaceGiftCarousel from "@/components/MarketplaceGiftCarousel";
import useSWR from "swr";
import { saveSavedDesignWithImages } from "@/utils/savedDesignUtils";
import { useSession } from "next-auth/react";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useKioskConfig } from "@/hooks/useKioskConfig";

type SavedDesign = {
  id: string;
  title: string;
  imageUrls?: string[];
  thumbnail?: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  categoryId?: string;
  categoryName?: string;
  category_id?: string;
  category_name?: string;
  status?: string;
  // New individual image fields
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  designData?: {
    templateKey: string;
    pages: Array<{
      header: string;
      image: string;
      text: string;
      footer: string;
    }>;
    editedPages: Record<number, string>;
  };
  // Metadata field for storing additional data like gift cards
  metadata?: any;
};

type ApiResponse = {
  success: boolean;
  data: SavedDesign[];
  count?: number;
};

type CardData = {
  id: string;
  name: string;
  createdAt: string;
  pages: string[];
  categoryId?: string;
  categoryName?: string;
};

type Category = {
  id: string;
  name: string;
  description: string;
  slug: string;
};

type CategoriesResponse = {
  success: boolean;
  data: Category[];
  count: number;
};

const fetcher = (url: string) =>
  fetch(url, {
    credentials: "include", // Include cookies for authentication
  }).then((res) => res.json());

// Transform saved design to card data
const transformSavedDesignToCard = (savedDesign: SavedDesign): CardData => {
  // First priority: Use individual image columns (image1, image2, image3, image4)
  let pages: string[] = [];

  console.log("🔄 Transforming saved design:", savedDesign.id);
  console.log("📸 Individual image fields:", {
    image1: savedDesign.image1 ? "Present" : "Empty",
    image2: savedDesign.image2 ? "Present" : "Empty",
    image3: savedDesign.image3 ? "Present" : "Empty",
    image4: savedDesign.image4 ? "Present" : "Empty",
  });

  if (
    savedDesign.image1 ||
    savedDesign.image2 ||
    savedDesign.image3 ||
    savedDesign.image4
  ) {
    pages = [
      savedDesign.image1 || "",
      savedDesign.image2 || "",
      savedDesign.image3 || "",
      savedDesign.image4 || "",
    ];
    console.log(
      "✅ Using individual image columns, pages count:",
      pages.filter(Boolean).length
    );
  }

  // Second priority: Extract images from designData.pages (for backward compatibility)
  if (
    pages.filter(Boolean).length === 0 &&
    savedDesign.designData?.pages &&
    savedDesign.designData.pages.length > 0
  ) {
    // Extract image URLs from each page
    pages = savedDesign.designData.pages.map((page) => page.image || "");
    console.log(
      "⚡ Using designData.pages, pages count:",
      pages.filter(Boolean).length
    );
  }

  // Third priority: Use imageUrls array if no pages found
  if (
    pages.filter(Boolean).length === 0 &&
    savedDesign.imageUrls &&
    savedDesign.imageUrls.length > 0
  ) {
    pages = [...savedDesign.imageUrls];
    while (pages.length < 4) pages.push(""); // Ensure 4 pages
    console.log(
      "📋 Using imageUrls array, pages count:",
      pages.filter(Boolean).length
    );
  }

  // Fourth priority: Use thumbnail as fallback for all pages
  if (pages.filter(Boolean).length === 0 && savedDesign.thumbnail) {
    pages = [
      savedDesign.thumbnail,
      savedDesign.thumbnail,
      savedDesign.thumbnail,
      savedDesign.thumbnail,
    ];
    console.log("🖼️ Using thumbnail fallback");
  }

  // Ensure we have at least 4 pages for the card view
  while (pages.length < 4) {
    if (pages.length > 0) {
      pages.push(pages[0]); // Duplicate first page if we don't have enough
    } else {
      pages.push(""); // Add empty string as fallback
    }
  }

  return {
    id: savedDesign.id,
    name: savedDesign.title,
    createdAt:
      typeof savedDesign.createdAt === "string"
        ? savedDesign.createdAt
        : savedDesign.createdAt.toISOString(),
    pages: pages.slice(0, 4), // Limit to 4 pages
    // Extract category info from saved design if available
    categoryId:
      (savedDesign as any).category_id || (savedDesign as any).categoryId,
    categoryName:
      (savedDesign as any).category_name || (savedDesign as any).categoryName,
  };
};

/**
 * Load and decrypt gift card data from localStorage
 * Handles both encrypted (new) and unencrypted (legacy) formats
 */
async function loadGiftCardData(cardId: string): Promise<any | null> {
  const storedData = localStorage.getItem(`giftCard_${cardId}`);
  if (!storedData) return null;

  // Check if it's legacy JSON format (starts with { or [)
  if (storedData.startsWith('{') || storedData.startsWith('[')) {
    try {
      return JSON.parse(storedData);
    } catch {
      return null;
    }
  }

  // Encrypted format - decrypt via API
  try {
    const response = await fetch('/api/giftcard/decrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encryptedData: storedData })
    });

    if (response.ok) {
      const { giftCardData } = await response.json();
      return giftCardData;
    } else {
      console.error('Failed to decrypt gift card data');
      return null;
    }
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

export default function CustomizeCardPage() {
  const componentMountTime = useRef(performance.now());

  useEffect(() => {
    console.log(`⏱️ [EDITOR] Component mounted at ${componentMountTime.current.toFixed(1)}ms`);
    return () => {
      console.log(`⏱️ [EDITOR] Component unmounting`);
    };
  }, []);

  const { data: session, status } = useSession();
  const { isKiosk } = useDeviceMode();
  const { config: kioskConfig } = useKioskConfig();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cardId = params?.id as string;
  const [currentPage, setCurrentPage] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipBookRef = useRef<any>(null);

  // Check if we're on a pixshop route - if so, don't fetch saved designs
  const isPixshopRoute = pathname?.includes('/pixshop');

  console.log('🔍 Parent page pathname:', pathname);
  console.log('🔍 isPixshopRoute:', isPixshopRoute);
  console.log(`⏱️ [EDITOR] Current time: ${performance.now().toFixed(1)}ms, card ID: ${cardId}`);

  // Editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Pintura Editor state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);

  // Save functionality state
  const [isSaving, setIsSaving] = useState(false);

  // Gift card integration state
  const [giftCardData, setGiftCardData] = useState<any>(null);
  const [pendingGiftCardQr, setPendingGiftCardQr] = useState<string>('');
  const showGift = searchParams.get('showGift') === 'true';

  // Check if gift card is pending (not yet issued)
  const isGiftCardPending = giftCardData && (giftCardData.isIssued === false || giftCardData.status === 'pending');

  // Generate pending QR code for gift cards not yet issued
  useEffect(() => {
    if (isGiftCardPending && typeof window !== 'undefined') {
      import('qrcode').then((QRCode) => {
        const pendingUrl = `${window.location.origin}/gift-pending`;
        QRCode.toDataURL(pendingUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#d97706', // Amber color for pending
            light: '#ffffff'
          },
          errorCorrectionLevel: 'H'
        }).then((url: string) => {
          setPendingGiftCardQr(url);
          console.log('✅ Pending gift card QR generated for card page');
        }).catch((err: Error) => {
          console.error('Failed to generate pending QR code:', err);
        });
      });
    } else if (!isGiftCardPending) {
      setPendingGiftCardQr(''); // Clear pending QR when card is issued
    }
  }, [isGiftCardPending]);

  // Get the QR code to display (pending or real)
  const displayQrCode = isGiftCardPending ? pendingGiftCardQr : giftCardData?.qrCode;

  // Remove gift card handler
  const handleRemoveGiftCard = useCallback(() => {
    setGiftCardData(null);
    setPendingGiftCardQr('');
    // Remove from localStorage
    localStorage.removeItem(`giftCard_${cardId}`);
    localStorage.removeItem(`giftCardMeta_${cardId}`);
    console.log('🗑️ Gift card removed for card:', cardId);
  }, [cardId]);


  const [saveMessage, setSaveMessage] = useState("");
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  // Undo/Revert functionality state
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [originalName, setOriginalName] = useState<string>("");

  // Save As functionality state
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [isSavingAs, setIsSavingAs] = useState(false);

  // Send E-card functionality state
  const [showSendModal, setShowSendModal] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Payment and printing state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ card: { id: string; name: string }; action: 'print' | 'send' } | null>(null);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);


  // Swipe functionality state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Loading state for when transitioning to Pintura editor
  const [isOpeningPintura, setIsOpeningPintura] = useState(() => {
    // Check immediately if we should show loading state
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('openPintura') === '1';
    }
    return false;
  });

  // Check if we're in template mode (temporary ID from templates page)
  const mode = searchParams.get('mode');
  const isTemplateMode = mode === 'template' || (cardId && cardId.startsWith('temp-'));

  // State for template mode
  const [templateData, setTemplateData] = useState<any>(null);
  const [realSavedDesignId, setRealSavedDesignId] = useState<string | null>(null);
  const [savingInBackground, setSavingInBackground] = useState(isTemplateMode);

  // Load template data from sessionStorage if in template mode
  useEffect(() => {
    if (isTemplateMode && cardId) {
      const loadStart = performance.now();
      console.log(`⏱️ [EDITOR] Loading template data from sessionStorage at ${loadStart.toFixed(1)}ms`);

      const stored = sessionStorage.getItem(`pendingTemplate_${cardId}`);
      if (stored) {
        const parseStart = performance.now();
        const data = JSON.parse(stored);
        const parseEnd = performance.now();
        console.log(`⏱️ [EDITOR] Parsed template data in ${(parseEnd - parseStart).toFixed(1)}ms`);
        console.log('📋 Loaded template data from sessionStorage:', data);
        setTemplateData(data);
        const loadEnd = performance.now();
        console.log(`⏱️ [EDITOR] Total template load time: ${(loadEnd - loadStart).toFixed(1)}ms`);
      } else {
        console.warn(`⚠️ [EDITOR] No template data found in sessionStorage for ${cardId}`);

        // Check if this temp ID was already saved - if so, redirect to the real ID
        const realId = sessionStorage.getItem(`tempIdMap_${cardId}`);
        if (realId) {
          console.log('🔄 Found mapping to real ID, redirecting:', cardId, '->', realId);
          // Preserve any query params (like showGift=true)
          const currentUrl = new URL(window.location.href);
          currentUrl.pathname = `/my-cards/${realId}`;
          window.location.href = currentUrl.toString();
          return;
        }
      }
    }
  }, [isTemplateMode, cardId]);

  // Listen for background save completion
  useEffect(() => {
    if (!isTemplateMode || !cardId) return;

    const handleTemplateSaved = (event: CustomEvent) => {
      const { tempId, savedDesignId, savedDesign } = event.detail;
      if (tempId === cardId) {
        console.log('✅ Background save completed, transitioning to saved design:', savedDesignId);
        setRealSavedDesignId(savedDesignId);
        setSavingInBackground(false);

        // Migrate gift card data from temp ID to real ID
        const tempGiftCard = localStorage.getItem(`giftCard_${tempId}`);
        if (tempGiftCard) {
          console.log('🎁 Migrating gift card from temp ID to real ID:', tempId, '->', savedDesignId);
          localStorage.setItem(`giftCard_${savedDesignId}`, tempGiftCard);
          localStorage.removeItem(`giftCard_${tempId}`);
        }

        // Store mapping from temp ID to real ID (in case user navigates back with old URL)
        sessionStorage.setItem(`tempIdMap_${tempId}`, savedDesignId);

        // Keep pendingTemplate for a bit longer in case user navigates away and back
        // Will clean up on next page load if the real design exists
        // sessionStorage.removeItem(`pendingTemplate_${tempId}`);

        // Update URL without reload
        window.history.replaceState(null, '', `/my-cards/${savedDesignId}`);
      }
    };

    const handleTemplateSaveFailed = (event: CustomEvent) => {
      const { tempId, error } = event.detail;
      if (tempId === cardId) {
        console.error('❌ Background save failed:', error);
        setSavingInBackground(false);
        // Show error to user
        alert(`Failed to save design: ${error}. Your work is preserved in the editor.`);
      }
    };

    window.addEventListener('templateSaved', handleTemplateSaved as EventListener);
    window.addEventListener('templateSaveFailed', handleTemplateSaveFailed as EventListener);

    return () => {
      window.removeEventListener('templateSaved', handleTemplateSaved as EventListener);
      window.removeEventListener('templateSaveFailed', handleTemplateSaveFailed as EventListener);
    };
  }, [isTemplateMode, cardId]);

  // Fetch all saved designs and find the specific one (only if not in template mode or pixshop route)
  const shouldFetch = !isPixshopRoute && !isTemplateMode;
  console.log('🔍 Should fetch saved designs:', shouldFetch, { isTemplateMode, isPixshopRoute });

  const {
    data: apiResponse,
    error,
    isLoading,
  } = useSWR<ApiResponse>(shouldFetch ? "/api/saved-designs" : null, fetcher);

  // Fetch categories
  const categoriesResponse = useSWR<CategoriesResponse>(
    "/api/categories",
    fetcher
  );
  const categories = categoriesResponse?.data?.data || [];

  // If we're on pixshop route, don't render this component - let the child route handle it
  if (isPixshopRoute) {
    return null;
  }

  const cardData = useMemo(() => {
    const memoStart = performance.now();
    console.log(`⏱️ [EDITOR] cardData useMemo triggered at ${memoStart.toFixed(1)}ms`);

    // If in template mode, use template data
    if (isTemplateMode && templateData) {
      const result = {
        id: templateData.id,
        name: templateData.name,
        createdAt: new Date().toISOString(),
        pages: templateData.pages || [],
        categoryId: templateData.categoryId,
        categoryName: templateData.categoryName,
      };
      const memoEnd = performance.now();
      console.log(`⏱️ [EDITOR] cardData created from template in ${(memoEnd - memoStart).toFixed(1)}ms`);
      console.log(`✅ [EDITOR] Card data ready with ${result.pages.length} pages`);
      return result;
    }

    // Otherwise use saved design data
    if (!apiResponse?.data || !cardId) {
      console.log(`⚠️ [EDITOR] cardData null: apiResponse=${!!apiResponse}, cardId=${cardId}`);
      return null;
    }
    const savedDesign = apiResponse.data.find((d) => d.id === cardId);
    const result = savedDesign ? transformSavedDesignToCard(savedDesign) : null;
    const memoEnd = performance.now();
    console.log(`⏱️ [EDITOR] cardData created from API in ${(memoEnd - memoStart).toFixed(1)}ms`);
    return result;
  }, [apiResponse, cardId, isTemplateMode, templateData]);

  // Get the saved design data to access status field
  const savedDesign = useMemo(() => {
    if (isTemplateMode) return null; // No saved design yet in template mode
    if (!apiResponse?.data || !cardId) return null;
    return apiResponse.data.find((d) => d.id === cardId) || null;
  }, [apiResponse, cardId, isTemplateMode]);

  // Display-only order: swap inside pages so blank shows second and content third
  const displayPages = useMemo(() => {
    const basePages = cardData?.pages || [];
    const pages = [0, 1, 2, 3].map((i) => pageImages[i] || basePages[i] || "");
    if (pages.length >= 3) {
      [pages[1], pages[2]] = [pages[2], pages[1]];
    }
    return pages;
  }, [pageImages, cardData?.pages]);

  // Load gift card data - check both localStorage and saved design metadata
  useEffect(() => {
    console.log('🎁 Initial gift card load effect running...', { cardId, hasSavedDesign: !!savedDesign });

    const loadData = async () => {
      if (cardId) {
        // First check localStorage for immediate availability (prioritize this)
        console.log('🎁 Checking localStorage for key:', `giftCard_${cardId}`);

        const giftData = await loadGiftCardData(cardId);

        if (giftData) {
          console.log('🎁 ✅ USING GIFT CARD FROM LOCALSTORAGE (decrypted):', giftData);
          setGiftCardData(giftData);
          // Don't check metadata if localStorage has data - localStorage is more recent
          return;
        } else {
          console.log('🎁 No gift card in localStorage, checking metadata...');
        }

        // Only check saved design metadata if localStorage is empty
        if (savedDesign?.metadata) {
          try {
            const metadata = typeof savedDesign.metadata === 'string'
              ? JSON.parse(savedDesign.metadata)
              : savedDesign.metadata;

            console.log('🎁 Saved design metadata:', metadata);

            if (metadata.giftCard) {
              console.log('🎁 Loading gift card from metadata (localStorage was empty):', metadata.giftCard);
              setGiftCardData(metadata.giftCard);
            } else {
              console.log('🎁 No gift card in metadata');
            }
          } catch (error) {
            console.warn('Failed to parse metadata for gift card data:', error);
          }
        } else {
          console.log('🎁 No saved design metadata available');
        }
      }
    };

    loadData();
  }, [cardId, savedDesign]);

  // Check for showGift parameter and reload gift card data
  // Also watch for URL changes to detect when returning from marketplace
  useEffect(() => {
    const loadShowGiftData = async () => {
      if (showGift && cardId) {
        console.log('🎁 showGift parameter detected, reloading gift card data');
        console.log('🎁 Current URL:', window.location.href);
        console.log('🎁 cardId:', cardId);

        const giftData = await loadGiftCardData(cardId);

        if (giftData) {
          console.log('🎁 Loaded gift card data (decrypted):', giftData);
          setGiftCardData(giftData);
          console.log('🎁 Gift card data set successfully');
        } else {
          console.log('🎁 No gift card data found in localStorage');
        }
      } else {
        console.log('🎁 showGift check:', { showGift, cardId });
      }
    };

    loadShowGiftData();
  }, [showGift, cardId, searchParams]); // Add searchParams to re-run on URL changes

  // Listen for popstate events (browser back/forward navigation)
  useEffect(() => {
    const handlePopState = async () => {
      if (cardId) {
        console.log('🎁 Navigation detected, checking for gift card updates');
        const giftData = await loadGiftCardData(cardId);
        if (giftData) {
          console.log('🎁 Updated gift card from navigation:', giftData);
          setGiftCardData(giftData);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [cardId]);

  // Listen for window focus to reload gift card when returning from marketplace
  useEffect(() => {
    const handleFocus = async () => {
      if (cardId && showGift) {
        console.log('🎁 Window focus detected with showGift=true, reloading gift card');
        const giftData = await loadGiftCardData(cardId);
        if (giftData) {
          console.log('🎁 Updated gift card from focus:', giftData);
          setGiftCardData(giftData);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [cardId, showGift]);

  // Auto-save gift card data to database metadata when it changes
  useEffect(() => {
    if (giftCardData && cardId && session?.user?.id && savedDesign) {
      const saveGiftCardMetadata = async () => {
        try {
          console.log('💾 Auto-saving gift card data to metadata...', giftCardData);

          // Get current metadata
          let metadata = savedDesign.metadata || {};
          if (typeof metadata === 'string') {
            metadata = JSON.parse(metadata);
          }

          // Update with gift card data
          metadata.giftCard = giftCardData;

          // Use Next.js API route for proper authentication
          const response = await fetch(`/api/saved-designs/${cardId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              metadata: metadata
            }),
          });

          if (response.ok) {
            console.log('✅ Gift card data saved to metadata');
          } else {
            const errorData = await response.json();
            console.error('❌ Failed to save gift card data to metadata:', errorData);
          }
        } catch (error) {
          console.error('Error saving gift card metadata:', error);
        }
      };

      // Debounce to avoid too many rapid saves
      const timeoutId = setTimeout(saveGiftCardMetadata, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [giftCardData, cardId, session?.user?.id, savedDesign]);

  // Initialize page images when card data is available
  useEffect(() => {
    if (cardData) {
      setPageImages([...cardData.pages]);
      setOriginalImages([...cardData.pages]); // Save original for revert
      setOriginalName(cardData.name); // Save original name
      setEditedName(cardData.name);
    }
  }, [cardData]);

  // Define callback functions before early returns
  const handleFlipNext = useCallback(() => {
    // Check if we're on mobile/tablet (flipbook is hidden at lg breakpoint = 1024px)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      // Mobile/Tablet: directly update currentPage state
      if (currentPage < 3) {
        setCurrentPage(currentPage + 1);
      }
    } else {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage < 3) {
        flipBookRef.current.pageFlip().flipNext();
      }
    }
  }, [currentPage]);

  const handleFlipPrev = useCallback(() => {
    // Check if we're on mobile/tablet (flipbook is hidden at lg breakpoint = 1024px)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      // Mobile/Tablet: directly update currentPage state
      if (currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    } else {
      // Desktop: use flipbook
      if (flipBookRef.current && currentPage > 0) {
        flipBookRef.current.pageFlip().flipPrev();
      }
    }
  }, [currentPage]);

  const goToPage = useCallback((pageIndex: number) => {
    // Check if we're on mobile/tablet (flipbook is hidden at lg breakpoint = 1024px)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      // Mobile/Tablet: directly update currentPage state
      setCurrentPage(pageIndex);
    } else {
      // Desktop: use flipbook
      if (flipBookRef.current) {
        flipBookRef.current.pageFlip().flip(pageIndex);
      }
    }
  }, []);

  const handlePageFlip = useCallback((e: { data: number }) => {
    setCurrentPage(e.data);
  }, []);

  // Listen for page navigation events from Sidebar
  useEffect(() => {
    const handlePageNavigation = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { action, page } = customEvent.detail;

      switch (action) {
        case "prev":
          handleFlipPrev();
          break;
        case "next":
          handleFlipNext();
          break;
        case "goto":
          goToPage(page);
          break;
      }
    };

    window.addEventListener("pageNavigation", handlePageNavigation);
    return () =>
      window.removeEventListener("pageNavigation", handlePageNavigation);
  }, [currentPage, handleFlipNext, handleFlipPrev, goToPage]);

  // Notify Sidebar about current page changes
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("pageChanged", { detail: { currentPage } })
    );
  }, [currentPage]);

  // Keyboard navigation for flipbook
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard events on desktop when flipbook is visible (lg breakpoint = 1024px)
      if (typeof window !== "undefined" && window.innerWidth >= 1024) {
        switch (event.key) {
          case "ArrowLeft":
            event.preventDefault();
            handleFlipPrev();
            break;
          case "ArrowRight":
            event.preventDefault();
            handleFlipNext();
            break;
          case "Home":
            event.preventDefault();
            goToPage(0);
            break;
          case "End":
            event.preventDefault();
            goToPage(3);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlipNext, handleFlipPrev, goToPage]);

  // Initialize editing states when card loads
  useEffect(() => {
    if (cardData && categories.length > 0) {
      setEditedName(cardData.name);
      console.log("🔍 Card data:", cardData);
      console.log("🔍 Categories:", categories);

      // Find and set the initial category if it exists
      let foundCategory = null;

      if (cardData.categoryId) {
        foundCategory = categories.find(
          (cat) => cat.id === cardData.categoryId
        );
        console.log("🎯 Found category by ID:", foundCategory);
      }

      if (!foundCategory && cardData.categoryName) {
        // Fallback: try to match by name if ID doesn't work
        foundCategory = categories.find(
          (cat) => cat.name === cardData.categoryName
        );
        console.log("🎯 Found category by name:", foundCategory);
      }

      if (foundCategory) {
        setSelectedCategory(foundCategory);
      } else {
        // If no category is found, optionally set the first category as default
        // or leave it as null to show "Select category"
        console.log(
          "⚠️ No category found for card, available categories:",
          categories.map((c) => ({ id: c.id, name: c.name }))
        );
        console.log("💡 Leaving category selection empty for user to choose");
      }
    }
  }, [cardData, categories]);

  // Debug effect to track category changes
  useEffect(() => {
    console.log("🔄 Selected category changed:", selectedCategory);
  }, [selectedCategory]);

  // Handle openPintura URL parameter to automatically open editor after pixshop save or back button
  useEffect(() => {
    const openPintura = searchParams.get('openPintura');
    const updated = searchParams.get('updated');
    const fromPixshop = searchParams.get('fromPixshop');

    if (openPintura === '1' && cardData && pageImages.length > 0) {
      if (updated === '1') {
        console.log("🎨 Auto-opening Pintura editor after pixshop save");
      } else if (fromPixshop === '1') {
        console.log("🎨 Auto-opening Pintura editor from pixshop back button");
      }

      // Open editor for the correct page (get from URL params)
      setTimeout(() => {
        const pageIndex = parseInt(searchParams.get('pageIndex') || '0', 10);
        setEditingPageIndex(pageIndex);
        setEditorVisible(true);
        setIsOpeningPintura(false); // Clear loading state when editor opens
      }, 500); // Small delay to ensure everything is loaded

      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('openPintura');
      newUrl.searchParams.delete('updated');
      newUrl.searchParams.delete('fromPixshop');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [searchParams, cardData, pageImages]);

  // Legacy sessionStorage code removed - now using PixshopContext for instant preview

  // Auto-detect changes by comparing current state with original state
  useEffect(() => {
    if (!cardData || !originalImages.length) return;

    // Check if images have changed
    const imagesChanged = pageImages.some(
      (img, index) => img !== originalImages[index]
    );

    // Check if name has changed
    const nameChanged = editedName !== originalName;

    // Check if category has changed
    const categoryChanged = selectedCategory?.id !== cardData.categoryId;

    const hasChanges = imagesChanged || nameChanged || categoryChanged;

    if (hasChanges !== hasUnsavedChanges) {
      setHasUnsavedChanges(hasChanges);
      console.log("🔄 Auto-detected changes:", {
        imagesChanged,
        nameChanged,
        categoryChanged,
        hasChanges,
      });
    }
  }, [
    pageImages,
    editedName,
    selectedCategory,
    originalImages,
    originalName,
    cardData,
    hasUnsavedChanges,
  ]);

  // Swipe handling functions
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentPage < 3) {
      handleFlipNext();
    }
    if (isRightSwipe && currentPage > 0) {
      handleFlipPrev();
    }
  };

  // Undo function - restore previous state
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      const newUndoStack = undoStack.slice(0, -1);

      setUndoStack(newUndoStack);
      setPageImages(previousState);
      setHasUnsavedChanges(true);

      console.log("⏪ Undo applied, restored previous state");
    }
  };

  // Revert function - restore to original state
  const handleRevert = () => {
    setShowRevertConfirm(true);
  };

  const confirmRevert = () => {
    setPageImages([...originalImages]);
    if (cardData && originalName) {
      setEditedName(originalName);
    }
    setUndoStack([]);
    setHasUnsavedChanges(false);
    setShowRevertConfirm(false);

    console.log("🔄 Reverted to original state");
  };

  // Save As function - save as new card
  const handleSaveAs = () => {
    if (!cardData) {
      alert("No card data available");
      return;
    }
    setSaveAsName(`${cardData.name} - Copy`);
    setShowSaveAsModal(true);
  };

  // Handle Save As modal submission
  const handleSaveAsSubmit = async () => {
    if (!cardData || !saveAsName.trim()) {
      return;
    }

    if (!session?.user?.id) {
      alert("Please sign in to save cards");
      return;
    }

    setIsSavingAs(true);

    try {
      const result = await saveSavedDesignWithImages(cardData.id, pageImages, {
        action: "duplicate",
        title: saveAsName.trim(),
        userId: String(session.user.id),
        categoryId: selectedCategory?.id || cardData.categoryId,
        categoryName: selectedCategory?.name || cardData.categoryName,
        giftCardData: giftCardData,
      });

      if (result.saveResult.success) {
        setSaveMessage(`✅ Saved as "${saveAsName.trim()}"`);
        setShowSaveAsModal(false);
        setSaveAsName("");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        throw new Error(result.saveResult.error || "Save failed");
      }
    } catch (error) {
      console.error("Error saving as new card:", error);

      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes("401")) {
        // Token expired, redirect to login with callback to my-cards
        window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(
          "/my-cards"
        )}`;
        return;
      }

      setSaveMessage(`❌ Failed to save as new card`);
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setIsSavingAs(false);
    }
  };

  // Handle sending E-Card - Show payment modal first
  const handleSendECard = () => {
    if (!cardData) {
      alert("No card data available");
      return;
    }
    console.log('💳 Opening payment modal for send e-card:', cardData.id);
    setPendingAction({
      card: { id: cardData.id, name: cardData.name },
      action: 'send'
    });
    setPaymentModalOpen(true);
  };

  // Execute send e-card after payment
  const executeSendECard = () => {
    if (!pendingAction || pendingAction.action !== 'send') return;

    console.log('📧 Payment successful, showing e-card modal');
    setShowSendModal(true);
    setPaymentModalOpen(false);
    setPendingAction(null);
  };

  // Handle sending the actual e-card (called from modal)
  const handleSendEcard = async (email: string, message: string) => {
    if (!cardData) {
      throw new Error("No card data available");
    }

    if (!session?.user?.id) {
      throw new Error("Please sign in to send e-cards");
    }

    setIsSendingEmail(true);

    try {
      const response = await fetch("/api/send-ecard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cardId: cardData.id,
          cardName: cardData.name,
          recipientEmail: email,
          message: message,
          senderName: session.user.name || session.user.email,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || "Failed to send e-card";
        setSaveMessage(`❌ ${errorMessage}`);
        setTimeout(() => setSaveMessage(""), 5000);
        throw new Error(errorMessage);
      }

      setSaveMessage("✅ E-card sent successfully!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("❌ Send e-card failed:", error);
      return;
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Handle print card - Show payment modal first
  const handlePrint = () => {
    if (!cardData) {
      alert("No card data available");
      return;
    }
    console.log('💳 Opening payment modal for print:', cardData.id);
    // TEMPORARY: Skip payment modal during development
    setPendingAction({
      card: { id: cardData.id, name: cardData.name },
      action: 'print'
    });
    // setPaymentModalOpen(true); // Commented out for development

    // Call executePrint directly without payment
    executePrintDirect();
  };

  // Direct print execution without payment (for development)
  const executePrintDirect = async () => {
    if (!cardData) return;

    console.log('🖨️ Starting print process...');

    setIsPrinting(true);
    try {
      // Extract image URLs from current state
      const image1 = pageImages[0];
      const image2 = pageImages[1];
      const image3 = pageImages[2];
      const image4 = pageImages[3];

      if (!image1 || !image2 || !image3 || !image4) {
        alert('All four card images are required for printing');
        setIsPrinting(false);
        return;
      }

      // Always use direct printing to default printer (no dialog)
      console.log('🖨️ Direct printing to default printer (no dialog)...');
      await autoPrintToEpson(image1, image2, image3, image4);

      setIsPrinting(false);
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to generate print files. Please try again.');
      setIsPrinting(false);
    }
  };

  // Browser-based printing for production mode (uses browser's print dialog)
  const printViaBrowser = async (image1: string, image2: string, image3: string, image4: string) => {
    console.log('📄 Generating printable card...');

    try {
      // Create a print-friendly HTML layout
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to print. Or download the images and print manually.');
        return;
      }

      // Create print-optimized layout (landscape, 2 pages for duplex)
      const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Card - ${cardData?.name || 'Greeting Card'}</title>
          <style>
            @page {
              size: letter landscape;
              margin: 0;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .page { page-break-after: always; }
              .page:last-child { page-break-after: auto; }
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .page {
              width: 11in;
              height: 8.5in;
              display: flex;
              position: relative;
              background: white;
            }
            .panel {
              width: 50%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .panel img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .instructions {
              padding: 20px;
              text-align: center;
              background: #f0f0f0;
            }
            @media print {
              .instructions { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="instructions">
            <h2>🖨️ Print Settings</h2>
            <p><strong>Paper:</strong> Letter (8.5" × 11") | <strong>Orientation:</strong> Landscape</p>
            <p><strong>Two-Sided:</strong> ON (Flip on Short Edge) | <strong>Borderless:</strong> ON (recommended)</p>
            <p>Click Print below or press Ctrl+P</p>
            <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; cursor: pointer;">
              Print Card
            </button>
          </div>
          
          <!-- Page 1: Back (left) + Front (right) -->
          <div class="page">
            <div class="panel">
              <img src="${image4}" alt="Back Cover" />
            </div>
            <div class="panel">
              <img src="${image1}" alt="Front Cover" />
            </div>
          </div>
          
          <!-- Page 2: Inside Right (left) + Inside Left (right) -->
          <div class="page">
            <div class="panel">
              <img src="${image2}" alt="Inside Right" />
            </div>
            <div class="panel">
              <img src="${image3}" alt="Inside Left" />
            </div>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(printHTML);
      printWindow.document.close();

      // Wait for images to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      };

      console.log('✅ Print window opened. Use your browser print dialog to select your printer.');

    } catch (error) {
      console.error('Browser print error:', error);
      throw error;
    }
  };

  // Helper function to log print job to the database (for manager tracking)
  const logPrintJob = async (data: {
    kioskId: string;
    productType: string;
    productId?: string;
    productName?: string;
    paperType?: string;
    paperSize?: string;
    trayNumber?: number | null;
    copies?: number;
  }) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com'}/kiosk/print-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      console.log('📊 Print job logged for tracking');
    } catch (err) {
      console.warn('Failed to log print job:', err);
      // Don't throw - logging is optional, print should still proceed
    }
  };

  // Auto-print using kiosk config for printer and tray selection
  const autoPrintToEpson = async (image1: string, image2: string, image3: string, image4: string, paperType: string = 'greeting-card') => {
    // Get printer settings from kiosk config
    const printerName = kioskConfig?.printerName || 'HP OfficeJet Pro 9130e Series [HPIE4B65B]';
    const trays = kioskConfig?.printerTrays || [];
    
    // Find the tray for this paper type
    const tray = trays.find(t => t.paperType === paperType);
    const trayNumber = tray?.trayNumber || null;
    const paperSize = tray?.paperSize || 'letter'; // Default to letter if no tray configured
    
    // Get kiosk ID from context for logging
    const kioskId = localStorage.getItem('smartwish_kiosk_id');
    
    console.log(`🖨️ Auto-printing to: ${printerName} (Direct backend print - NO popup)`);
    console.log(`📥 Paper type: ${paperType}, Tray: ${trayNumber || 'Auto'}, Size: ${paperSize}`);

    try {
      // Log the print job for manager tracking (if kiosk is activated)
      if (kioskId) {
        await logPrintJob({
          kioskId,
          productType: paperType,
          productId: cardData?.id,
          productName: cardData?.name || 'Greeting Card',
          paperType,
          paperSize,
          trayNumber,
          copies: 1,
        });
      }

      // Convert image URLs to base64
      console.log('Converting images to base64 for backend printing...');
      const imageBase64Array = await Promise.all([
        fetchImageAsBase64(image1),
        fetchImageAsBase64(image2),
        fetchImageAsBase64(image3),
        fetchImageAsBase64(image4)
      ]);

      console.log('Images converted, sending to backend printer...');

      // Send to backend /print-pc endpoint with tray info
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com'}/print-pc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: imageBase64Array,
          printerName: printerName,
          paperSize: paperSize,
          paperType: paperType,
          trayNumber: trayNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send print job');
      }

      const result = await response.json();
      console.log('✅ Print job sent successfully!', result);
      alert(`Print job sent to ${printerName}${trayNumber ? ` (Tray ${trayNumber})` : ''}!\nCheck your printer for output.`);

    } catch (err) {
      console.error('Auto-print error:', err);
      alert(`Failed to print: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Helper function to fetch image and convert to base64
  const fetchImageAsBase64 = async (imageUrl: string): Promise<string> => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Execute print after payment
  const executePrint = async () => {
    if (!pendingAction || pendingAction.action !== 'print') return;

    if (!cardData) return;

    console.log('🖨️ Payment successful, proceeding with print');

    setIsPrinting(true);
    try {
      // Extract image URLs from current state
      const image1 = pageImages[0];
      const image2 = pageImages[1];
      const image3 = pageImages[2];
      const image4 = pageImages[3];

      if (!image1 || !image2 || !image3 || !image4) {
        alert('All four card images are required for printing');
        setIsPrinting(false);
        return;
      }

      console.log('Printing directly to EPSON printer via backend...');

      // Send images directly to backend printer - no PDF generation needed
      // The backend will handle compositing and printing automatically
      await autoPrintToEpson(image1, image2, image3, image4);
      setIsPrinting(false);
      setPaymentModalOpen(false);
      setPendingAction(null);
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to generate print files. Please try again.');
      setIsPrinting(false);
      setPaymentModalOpen(false);
      setPendingAction(null);
    }
  };

  // Save functions
  const handleSave = async () => {
    if (!cardData) {
      alert("No card data available");
      return;
    }

    if (!session?.user?.id) {
      alert("Please sign in to save cards");
      return;
    }

    // If in template mode and still saving in background, wait for it
    if (isTemplateMode && savingInBackground) {
      alert("Design is being saved to your library. Please wait a moment...");
      return;
    }

    // Use real saved design ID if we have it
    const actualCardId = realSavedDesignId || cardData.id;

    // If still in template mode without real ID, can't save updates yet
    if (isTemplateMode && !realSavedDesignId) {
      alert("Design is still being prepared. Please wait a moment before saving changes.");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      const finalName = editedName.trim() || cardData.name;
      console.log("💾 Saving card:", finalName);
      console.log("📂 Category:", selectedCategory?.name || "None");
      console.log("📸 Current page images:", pageImages);
      console.log("🖼️ Cover image (first):", pageImages[0]);
      const userId = String(session.user.id);
      console.log("🆔 Using user ID:", userId);
      console.log("🆔 Actual card ID:", actualCardId);

      const result = await saveSavedDesignWithImages(actualCardId, pageImages, {
        action: "update",
        title: finalName,
        userId,
        designId: `updated_${actualCardId}_${Date.now()}`,
        categoryId: selectedCategory?.id,
        categoryName: selectedCategory?.name,
        giftCardData: giftCardData,
      });

      console.log("✅ Save result:", result);
      setSaveMessage("Card saved successfully!");
      setHasUnsavedChanges(false); // Clear unsaved changes flag

      // Update local card data
      if (cardData) {
        cardData.name = finalName;
        cardData.categoryId = selectedCategory?.id;
        cardData.categoryName = selectedCategory?.name;
      }

      // Update the original state to reflect the saved state
      setOriginalImages([...pageImages]); // Update original images to current saved state
      setOriginalName(finalName); // Update original name to saved name

      // Log the save result for verification
      if (result.saveResult) {
        console.log("💾 Save result:", result.saveResult);
      }

      // Show success message for a few seconds
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("❌ Save failed:", error);

      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes("401")) {
        // Token expired, redirect to login with callback to my-cards
        window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(
          "/my-cards"
        )}`;
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setSaveMessage(`Failed to save card: ${errorMessage}`);

      // Show error message for a few seconds
      setTimeout(() => setSaveMessage(""), 8000);
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading screen when transitioning to Pintura editor
  if (isOpeningPintura) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Opening Pintura Editor...</p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h1>
          <p className="text-gray-600 mb-6">
            Please sign in to view your cards.
          </p>
          <Link
            href={`/sign-in?callbackUrl=${encodeURIComponent("/my-cards")}`}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Skip loading state if in template mode with data
  if (!isTemplateMode && isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading card...</p>
        </div>
      </div>
    );
  }

  // Show loading state if we don't have card data yet (even if API call completed)
  if (!cardData && !error && !isTemplateMode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading card...</p>
        </div>
      </div>
    );
  }

  // Only show error state if we have an error OR if we've finished loading but have no data
  if (error || (!isLoading && !cardData)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Card Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            The card you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/my-cards"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
        </div>
      </div>
    );
  }

  // From here onward cardData is guaranteed non-null
  const cd = cardData!;

  console.log(`⏱️ [EDITOR] Rendering main UI at ${performance.now().toFixed(1)}ms with card:`, cd.name);

  // Function to handle editing a specific page (expects underlying data index)
  const handleEditPage = async (pageIndex: number) => {
    console.log("🎨 Opening Pintura editor for page:", pageIndex);

    if (!cardData || pageIndex >= cardData.pages.length) {
      console.error("❌ Invalid page index or no card data");
      return;
    }

    try {
      // Convert image to blob URL for Pintura compatibility if needed
      const imageUrl = pageImages[pageIndex] || cardData.pages[pageIndex];
      const blobImageUrl = await convertImageToBlob(imageUrl);

      // Update the page images with blob URL if needed
      if (imageUrl !== blobImageUrl) {
        const updatedImages = [...pageImages];
        updatedImages[pageIndex] = blobImageUrl;
        setPageImages(updatedImages);
      }

      setEditingPageIndex(pageIndex);
      setEditorVisible(true);
    } catch (error) {
      console.error("❌ Failed to open editor:", error);
      alert("Failed to load image for editing. Please try again.");
    }
  };

  // Convert external image URL for Pintura
  const convertImageToBlob = async (imageUrl: string): Promise<string> => {
    try {
      console.log(
        "🔄 Converting image to blob URL for Pintura compatibility:",
        imageUrl
      );

      // Check if it's already a blob URL
      if (imageUrl.startsWith("blob:")) {
        console.log(
          "✅ Image is already a blob URL, returning as-is:",
          imageUrl
        );
        return imageUrl;
      }

      console.log("🌐 Fetching image...");
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image: ${response.status} ${response.statusText}`
        );
      }

      console.log("📦 Converting response to blob...");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      console.log("✅ Successfully created blob URL:", blobUrl);
      return blobUrl;
    } catch (error) {
      console.error("❌ Failed to convert image to blob:", error);
      console.log("🔄 Falling back to original URL:", imageUrl);
      return imageUrl;
    }
  };

  // Handle editor process result
  const handleEditorProcess = ({ dest }: { dest: File }) => {
    console.log("✅ Editor process complete:", dest);

    if (editingPageIndex !== null && dest) {
      // Save current state to undo stack before making changes
      setUndoStack((prev) => [...prev, [...pageImages]]);

      // Create blob URL from the edited image
      const blobUrl = URL.createObjectURL(dest);

      // Update the page images
      const updatedImages = [...pageImages];
      updatedImages[editingPageIndex] = blobUrl;
      setPageImages(updatedImages);
      setHasUnsavedChanges(true); // Mark as having unsaved changes when image is edited

      console.log(
        "📸 Updated page image at index:",
        editingPageIndex,
        "with:",
        blobUrl
      );
    }
  };

  // Handle name editing
  const handleStartEditingName = () => {
    setEditedName(cardData?.name || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    // Auto-detection will handle the unsaved changes flag
    setIsEditingName(false);
  };

  const handleCancelNameEdit = () => {
    setEditedName(cardData?.name || "");
    setIsEditingName(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelNameEdit();
    }
  };

  // Handle category selection
  const handleCategoryChange = (category: Category) => {
    setSelectedCategory(category);
    // Auto-detection will handle the unsaved changes flag
  };

  // Handle editor close
  const handleEditorClose = () => {
    console.log("🚪 Closing editor");
    setEditorVisible(false);
    setEditingPageIndex(null);
  };

  // Chat / Style Assistant removed

  // Show loading screen when openPintura parameter is present
  const openPintura = searchParams.get('openPintura');
  if (openPintura === '1') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-100 ${isKiosk ? 'pb-24' : ''}`}>
      {/* Header - Sticky */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Kiosk Mode - Simple Back Button Only */}
          {isKiosk ? (
            <div className="py-3 flex items-center">
              <Link
                href="/templates"
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Back to Designs</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Mobile Header */}
              <div className="lg:hidden">
                <div className="flex items-center justify-between py-3">
                  {/* Left - Back Button */}
                  <Link
                    href="/my-cards"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    <span className="font-medium text-sm">Back</span>
                  </Link>

                  {/* Center - Title (when not editing) */}
                  {!isEditingName && (
                    <div className="flex-1 mx-4 text-center min-w-0">
                      <div className="flex items-center justify-center gap-2">
                        <h1 className="text-lg font-semibold text-gray-900 truncate">
                          {editedName || cd.name}
                        </h1>
                        <button
                          onClick={handleStartEditingName}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="Edit name"
                        >
                          <PencilIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Center - Edit Input (when editing) */}
                  {isEditingName && (
                    <div className="flex-1 mx-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={handleKeyPress}
                        onBlur={handleSaveName}
                        className="flex-1 text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        autoFocus
                        placeholder="Card name..."
                      />
                      <button
                        onClick={handleSaveName}
                        className="p-1 text-green-600 hover:text-green-700"
                        title="Save"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelNameEdit}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title="Cancel"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Right - Status Indicators */}
                  <div className="flex items-center gap-2">
                    {/* Background Saving Indicator */}
                    {savingInBackground && (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1 rounded-md">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                        <span className="text-xs text-blue-700 font-medium">
                          Saving to library...
                        </span>
                      </div>
                    )}

                    {/* Save Status */}
                    {saveMessage && (
                      <div
                        className={`px-2 py-1 rounded-md text-xs font-medium ${saveMessage.includes("Failed")
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : "bg-green-50 text-green-600 border border-green-200"
                          }`}
                      >
                        {saveMessage.includes("Failed") ? "⚠" : "✓"}
                      </div>
                    )}

                    {/* Unsaved Changes */}
                    {hasUnsavedChanges && !saveMessage && !savingInBackground && (
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                        <span className="text-xs text-amber-700 font-medium">
                          Unsaved
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Category Row - Mobile */}
                <div className="pb-4 hidden">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <Listbox value={selectedCategory} onChange={handleCategoryChange}>
                    <div className="relative">
                      <ListboxButton className="relative w-full cursor-pointer rounded-lg bg-gray-50 py-3 pl-3 pr-10 text-left text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 border border-gray-200 hover:bg-gray-100 transition-colors">
                        <span className="block truncate font-medium">
                          {selectedCategory?.name || "Select a category"}
                        </span>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon
                            className="h-5 w-5 text-gray-400"
                            aria-hidden="true"
                          />
                        </span>
                      </ListboxButton>

                      <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none">
                        {categories.map((category) => (
                          <ListboxOption
                            key={category.id}
                            className={({ focus }) =>
                              `relative cursor-pointer select-none py-3 pl-10 pr-4 ${focus
                                ? "bg-indigo-100 text-indigo-900"
                                : "text-gray-900"
                              }`
                            }
                            value={category}
                          >
                            {({ selected }) => (
                              <>
                                <span
                                  className={`block truncate ${selected ? "font-semibold" : "font-normal"
                                    }`}
                                >
                                  {category.name}
                                </span>
                                {selected ? (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                                    <CheckIcon
                                      className="h-5 w-5"
                                      aria-hidden="true"
                                    />
                                  </span>
                                ) : null}
                              </>
                            )}
                          </ListboxOption>
                        ))}
                        {categories.length === 0 && (
                          <div className="relative cursor-default select-none py-3 px-4 text-gray-700">
                            Loading categories...
                          </div>
                        )}
                      </ListboxOptions>
                    </div>
                  </Listbox>
                </div>
              </div>

              {/* Desktop Header */}
              <div className="hidden lg:block">
                <div className="flex items-center justify-between py-4">
                  {/* Left Section */}
                  <div className="flex items-center gap-6">
                    <Link
                      href="/my-cards"
                      className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                      <span className="font-medium">Back to Cards</span>
                    </Link>

                    <div className="h-5 w-px bg-gray-300" />

                    {/* Title Section */}
                    {isEditingName ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          onKeyDown={handleKeyPress}
                          onBlur={handleSaveName}
                          className="text-xl font-bold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 max-w-md"
                          autoFocus
                          placeholder="Enter card name..."
                        />
                        <button
                          onClick={handleSaveName}
                          className="p-1.5 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded border border-green-200"
                          title="Save name"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelNameEdit}
                          className="p-1.5 text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-gray-900">
                          {editedName || cd.name}
                        </h1>
                        <button
                          onClick={handleStartEditingName}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="Edit name"
                        >
                          <PencilIcon className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Center Section - Meta Info */}
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span>Created {new Date(cd.createdAt).toLocaleDateString()}</span>
                    {selectedCategory && (
                      <>
                        <span>•</span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {selectedCategory.name}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Right Section */}
                  <div className="flex items-center gap-4">
                    {/* Category Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        Category:
                      </span>
                      <Listbox
                        value={selectedCategory}
                        onChange={handleCategoryChange}
                      >
                        <div className="relative">
                          <ListboxButton className="relative cursor-pointer rounded-lg bg-gray-50 border border-gray-200 py-1.5 pl-3 pr-8 text-left text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 hover:bg-gray-100 transition-colors min-w-[160px]">
                            <span className="block truncate font-medium text-gray-900">
                              {selectedCategory?.name || "Select category"}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronUpDownIcon
                                className="h-4 w-4 text-gray-400"
                                aria-hidden="true"
                              />
                            </span>
                          </ListboxButton>

                          <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
                            {categories.map((category) => (
                              <ListboxOption
                                key={category.id}
                                className={({ focus }) =>
                                  `relative cursor-pointer select-none py-2 pl-8 pr-4 ${focus
                                    ? "bg-indigo-100 text-indigo-900"
                                    : "text-gray-900"
                                  }`
                                }
                                value={category}
                              >
                                {({ selected }) => (
                                  <>
                                    <span
                                      className={`block truncate ${selected ? "font-semibold" : "font-normal"
                                        }`}
                                    >
                                      {category.name}
                                    </span>
                                    {selected ? (
                                      <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-indigo-600">
                                        <CheckIcon
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </ListboxOption>
                            ))}
                            {categories.length === 0 && (
                              <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                                Loading categories...
                              </div>
                            )}
                          </ListboxOptions>
                        </div>
                      </Listbox>
                    </div>

                    {/* Status Messages */}
                    {/* Unsaved Changes Indicator */}
                    {hasUnsavedChanges && !saveMessage && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                        <span className="text-sm text-amber-700 font-medium">
                          Unsaved
                        </span>
                      </div>
                    )}

                    {/* Save Status Message */}
                    {saveMessage && (
                      <div
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${saveMessage.includes("Failed")
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-green-50 text-green-700 border border-green-200"
                          }`}
                      >
                        {saveMessage.includes("Failed") ? "⚠ " : "✓ "}{saveMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex relative min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-72px)]">
        {/* Floating Toolbar - Hidden in Kiosk Mode */}
        {!isKiosk && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 flex items-center gap-1 sm:gap-2 bg-white rounded-full shadow-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 backdrop-blur-sm bg-white/95">
            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 ${hasUnsavedChanges
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={hasUnsavedChanges ? "Save Changes" : "No changes to save"}
            >
              {isSaving ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-300 border-t-current rounded-full animate-spin" />
              ) : (
                <FaRegSave className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>

            {/* Save As Button */}
            <button
              onClick={handleSaveAs}
              className="p-1.5 sm:p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-all duration-200 touch-manipulation"
              title="Save As New Card"
            >
              <DocumentDuplicateIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Send E-card Button */}
            <button
              onClick={handleSendECard}
              className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 touch-manipulation"
              title="Send E-card"
            >
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>

            {/* Undo Button */}
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1.5 sm:p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
              title="Undo Last Change"
            >
              <ArrowUturnLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Revert Button */}
            <button
              onClick={handleRevert}
              disabled={!hasUnsavedChanges}
              className="p-1.5 sm:p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
              title="Revert to Original"
            >
              <ArrowPathIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        )}

        {/* Gift Card Panel - Above Card */}
        <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-20 sm:pt-4">
          <div className="max-w-5xl mx-auto">
            <MarketplaceGiftCarousel
              cardId={cardId}
              giftCardData={giftCardData}
              onRemove={handleRemoveGiftCard}
            />
          </div>
        </div>

        {/* Center - Card Editor */}
        <div
          className={`flex-1 flex items-center justify-center min-h-[calc(100vh-200px)] py-4 lg:py-8 transition-all duration-300 px-4 pt-48 sm:pt-44`}
        >
          {/* Previous Page Button */}
          <button
            onClick={handleFlipPrev}
            disabled={currentPage === 0}
            className="hidden lg:flex flex-shrink-0 p-4 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mr-4 lg:mr-8 text-gray-700"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>

          {/* Desktop Flipbook Container */}
          <div className="hidden lg:block relative">
            <HTMLFlipBook
              ref={flipBookRef}
              width={400}
              height={617}
              size="fixed"
              startPage={0}
              minWidth={200}
              maxWidth={800}
              minHeight={200}
              maxHeight={800}
              style={{}}
              maxShadowOpacity={0.8}
              showCover={true}
              mobileScrollSupport={true}
              onFlip={handlePageFlip}
              className="flipbook-shadow"
              flippingTime={600}
              usePortrait={false}
              startZIndex={10}
              autoSize={false}
              clickEventForward={true}
              useMouseEvents={true}
              swipeDistance={30}
              showPageCorners={true}
              disableFlipByClick={false}
              drawShadow={true}
            >
              {/* Front Cover - Page 1 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={displayPages[0]}
                    alt="Gift Card Cover"
                    width={400}
                    height={617}
                    className="w-full h-full object-cover rounded-lg"
                    priority
                  />
                  {/* Edit icon blocking zone */}
                  <div
                    className="absolute top-0 right-0 w-20 h-20 z-30 flex items-start justify-end pt-4 pr-4"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                    }}
                    style={{ pointerEvents: "auto" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleEditPage(0);
                      }}
                      className="group p-3 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_4px_20px_rgba(124,58,237,0.5)] hover:shadow-[0_6px_30px_rgba(124,58,237,0.7)] hover:scale-110 active:scale-95 transition-all duration-300"
                      style={{
                        animation: 'pulse-fast-glow 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        boxShadow: '0 4px 20px rgba(124,58,237,0.5), 0 0 20px rgba(124,58,237,0.3), 0 0 40px rgba(124,58,237,0.2)'
                      }}
                    >
                      <svg
                        className="w-6 h-6 text-white drop-shadow-lg"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Inner Left Page - Page 2 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={displayPages[1]}
                    alt="Gift Card Page 2"
                    width={400}
                    height={617}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {/* Edit icon blocking zone */}
                  <div
                    className="absolute top-0 right-0 w-20 h-20 z-30 flex items-start justify-end pt-4 pr-4"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                    }}
                    style={{ pointerEvents: "auto" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleEditPage(2);
                      }}
                      className="group p-3 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_4px_20px_rgba(124,58,237,0.5)] hover:shadow-[0_6px_30px_rgba(124,58,237,0.7)] hover:scale-110 active:scale-95 transition-all duration-300 animate-pulse"
                      style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                    >
                      <svg
                        className="w-6 h-6 text-white drop-shadow-lg"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Inner Right Page - Page 3 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={displayPages[2]}
                    alt="Gift Card Page 3"
                    width={400}
                    height={617}
                    className="w-full h-full object-cover rounded-lg"
                  />

                  {/* Gift Card QR Code and Logo Overlay */}
                  {giftCardData && savedDesign?.status !== 'published' && displayQrCode && (
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 backdrop-blur-sm rounded-2xl p-4 shadow-lg border bg-white/95 border-gray-200">
                      <div className="flex flex-col items-center space-y-3">
                        {/* QR Code and Logo side-by-side */}
                        <div className="flex items-center space-x-4">
                          {/* QR Code on left */}
                          <div className="bg-white p-2 rounded-lg shadow-sm">
                            <img
                              src={displayQrCode}
                              alt="Gift Card QR Code"
                              className="w-24 h-24 object-contain"
                            />
                          </div>

                          {/* Company Logo on right (same size as QR code) */}
                          {giftCardData.storeLogo && (
                            <div className="bg-white p-2 rounded-lg shadow-sm">
                              <img
                                src={giftCardData.storeLogo}
                                alt={giftCardData.storeName}
                                className="w-24 h-24 object-contain"
                              />
                            </div>
                          )}
                        </div>

                        {/* Company Name and Amount centered below */}
                        <div className="text-center">
                          <p className="text-sm font-semibold text-gray-800">{giftCardData.storeName}</p>
                          <p className="text-xs text-gray-600">${giftCardData.amount}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Edit icon */}
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleEditPage(1);
                    }}
                    className="absolute top-4 right-4 group p-3 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_4px_20px_rgba(124,58,237,0.5)] hover:shadow-[0_6px_30px_rgba(124,58,237,0.7)] hover:scale-110 active:scale-95 transition-all duration-300 z-20"
                    style={{
                      animation: 'pulse-fast-glow 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      boxShadow: '0 4px 20px rgba(124,58,237,0.5), 0 0 20px rgba(124,58,237,0.3), 0 0 40px rgba(124,58,237,0.2)'
                    }}
                  >
                    <svg
                      className="w-6 h-6 text-white drop-shadow-lg"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Back Cover - Page 4 */}
              <div className="page-hard">
                <div className="page-content w-full h-full relative">
                  <Image
                    src={displayPages[3]}
                    alt="Gift Card Page 4"
                    width={400}
                    height={617}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {/* Edit icon */}
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleEditPage(3);
                    }}
                    className="absolute top-4 right-4 group p-3 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_4px_20px_rgba(124,58,237,0.5)] hover:shadow-[0_6px_30px_rgba(124,58,237,0.7)] hover:scale-110 active:scale-95 transition-all duration-300 z-20"
                    style={{
                      animation: 'pulse-fast-glow 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      boxShadow: '0 4px 20px rgba(124,58,237,0.5), 0 0 20px rgba(124,58,237,0.3), 0 0 40px rgba(124,58,237,0.2)'
                    }}
                  >
                    <svg
                      className="w-6 h-6 text-white drop-shadow-lg"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </HTMLFlipBook>
          </div>

          {/* Desktop Page Indicator */}
          <div className="hidden lg:block absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm shadow-lg">
              Page {currentPage + 1} of 4
            </div>
          </div>

          {/* Mobile/Tablet Single Page View */}
          <div className="lg:hidden relative px-4">
            <div
              className="w-full max-w-sm mx-auto bg-white rounded-xl shadow-2xl overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-full aspect-[640/989] relative bg-gray-100">
                {displayPages[currentPage] ? (
                  <Image
                    src={displayPages[currentPage]}
                    alt={`Card Page ${currentPage + 1}`}
                    width={640}
                    height={989}
                    className="w-full h-full object-cover"
                    priority
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}

                {/* Gift Card QR Code and Logo Overlay (Mobile) - Show on page 3 (index 2) */}
                {currentPage === 2 && giftCardData && savedDesign?.status !== 'published' && displayQrCode && (
                  <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 backdrop-blur-sm rounded-xl p-3 shadow-lg border max-w-[85%] bg-white/95 border-gray-200">
                    <div className="flex flex-col items-center space-y-2">
                      {/* QR Code and Logo side-by-side */}
                      <div className="flex items-center space-x-3">
                        {/* QR Code on left */}
                        <div className="bg-white p-1.5 rounded-lg shadow-sm">
                          <img
                            src={displayQrCode}
                            alt="Gift Card QR Code"
                            className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                          />
                        </div>

                        {/* Company Logo on right (same size as QR code) */}
                        {giftCardData.storeLogo && (
                          <div className="bg-white p-1.5 rounded-lg shadow-sm">
                            <img
                              src={giftCardData.storeLogo}
                              alt={giftCardData.storeName}
                              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                            />
                          </div>
                        )}
                      </div>

                      {/* Company Name and Amount centered below */}
                      <div className="text-center">
                        <p className="text-xs sm:text-sm font-semibold text-gray-800">{giftCardData.storeName}</p>
                        <p className="text-xs text-gray-600">${giftCardData.amount}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit icon - positioned but doesn't block swipes */}
                <div
                  className="absolute top-3 right-3 z-30"
                  style={{ pointerEvents: "auto" }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const dataIndex = currentPage === 1 ? 2 : currentPage === 2 ? 1 : currentPage;
                      handleEditPage(dataIndex);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      const dataIndex = currentPage === 1 ? 2 : currentPage === 2 ? 1 : currentPage;
                      handleEditPage(dataIndex);
                    }}
                    className="group p-3 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_4px_20px_rgba(124,58,237,0.5)] hover:shadow-[0_6px_30px_rgba(124,58,237,0.7)] hover:scale-110 active:scale-95 transition-all duration-300"
                    style={{
                      animation: 'pulse-fast-glow 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      boxShadow: '0 4px 20px rgba(124,58,237,0.5), 0 0 20px rgba(124,58,237,0.3), 0 0 40px rgba(124,58,237,0.2)'
                    }}
                  >
                    <svg
                      className="w-6 h-6 text-white drop-shadow-lg"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>

                {/* Mobile Page Indicator with Navigation */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="flex items-center gap-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm shadow-lg">
                    <button
                      onClick={handleFlipPrev}
                      disabled={currentPage === 0}
                      className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-3 w-3" />
                    </button>
                    <span>Page {currentPage + 1} of 4</span>
                    <button
                      onClick={handleFlipNext}
                      disabled={currentPage >= 3}
                      className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Next Page Button */}
          <button
            onClick={handleFlipNext}
            disabled={currentPage >= 3}
            className="hidden lg:flex flex-shrink-0 p-4 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ml-4 lg:ml-8 text-gray-700"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Right Sidebar removed */}
      </div>

      {/* Mobile Overlay */}
      {/* Mobile Overlay placeholder (no assistant) */}

      {/* Pintura Editor Modal */}
      {editingPageIndex !== null && (
        <PinturaEditorModal
          imageSrc={
            pageImages[editingPageIndex] || cardData?.pages[editingPageIndex]
          }
          originalImageSrc={cardData?.pages[editingPageIndex]}
          isVisible={editorVisible}
          onHide={handleEditorClose}
          onProcess={handleEditorProcess}
          editingPageIndex={editingPageIndex}
        />
      )}

      {/* Revert Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRevertConfirm}
        onClose={() => setShowRevertConfirm(false)}
        onConfirm={confirmRevert}
        title="Revert All Changes?"
        message="Are you sure you want to revert all changes? This will restore the original card state and cannot be undone."
        confirmText="Revert Changes"
        confirmButtonType="warning"
      />

      {/* Kiosk Mode - Bottom Action Buttons */}
      {isKiosk && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-50 to-white border-t border-gray-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-40">
          <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex gap-5 justify-center">
              {/* Print Button - Elegant purple gradient */}
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="group flex-1 max-w-xs flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white rounded-2xl font-semibold text-lg shadow-[0_8px_30px_rgba(124,58,237,0.35)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-[0_8px_30px_rgba(124,58,237,0.35)] overflow-hidden relative"
              >
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                {isPrinting ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="relative">Preparing...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-6 w-6 relative drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span className="relative">Print Card</span>
                  </>
                )}
              </button>

              {/* Send E-card Button - Elegant teal gradient */}
              <button
                onClick={handleSendECard}
                className="group flex-1 max-w-xs flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 text-white rounded-2xl font-semibold text-lg shadow-[0_8px_30px_rgba(20,184,166,0.35)] hover:shadow-[0_12px_40px_rgba(20,184,166,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out touch-manipulation overflow-hidden relative"
              >
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                <svg className="h-6 w-6 relative drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="relative">Send E-card</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {pendingAction && (
        <CardPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setPendingAction(null);
          }}
          onPaymentSuccess={() => {
            if (pendingAction.action === 'print') {
              executePrint();
            } else if (pendingAction.action === 'send') {
              executeSendECard();
            }
          }}
          cardId={pendingAction.card.id}
          cardName={pendingAction.card.name}
          action={pendingAction.action}
        />
      )}

      {/* Printer Selection Modal */}
      <PrinterSelectionModal
        isOpen={printerModalOpen}
        onClose={() => {
          setPrinterModalOpen(false);
          setPdfBlob(null);
        }}
        pdfBlob={pdfBlob}
      />

      <style jsx global>{`
        .flipbook-shadow {
          filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3));
          transition: transform 0.3s ease, filter 0.3s ease;
        }

        .flipbook-shadow:hover {
          transform: scale(1.02);
          filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.4));
        }

        /* Hide flipbook navigation dots */
        .stf__block .stf__wrapper .stf__navigation {
          display: none !important;
        }

        .stf__navigation,
        .stf__navigation .stf__navigation__item,
        .stf__navigation .stf__navigation__button {
          display: none !important;
        }

        .page-hard {
          width: 100%;
          height: 100%;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15),
            0 2px 10px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
          transition: box-shadow 0.3s ease;
          cursor: grab;
        }

        .page-hard:active {
          cursor: grabbing;
        }

        .page-content {
          width: 100%;
          height: 100%;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
          position: relative;
        }

        /* Page corner hint animation */
        .page-hard::before {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          width: 30px;
          height: 30px;
          background: linear-gradient(
            -45deg,
            transparent 0%,
            transparent 48%,
            rgba(0, 0, 0, 0.1) 49%,
            rgba(0, 0, 0, 0.1) 51%,
            transparent 52%,
            transparent 100%
          );
          z-index: 10;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .page-hard:hover::before {
          opacity: 1;
        }
      `}</style>

      {/* Save As Modal */}
      {showSaveAsModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-30 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Save As New Card
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Name
                </label>
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter card name..."
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSaveAsModal(false);
                    setSaveAsName("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={isSavingAs}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsSubmit}
                  disabled={isSavingAs || !saveAsName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingAs ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save As New Card"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send E-card Modal */}
      <SendECardModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSend={handleSendEcard}
        cardName={cardData?.name || "Untitled Card"}
        cardThumbnail={cardData?.pages?.[0] || ""}
        isLoading={isSendingEmail}
      />

      {/* CSS for fast pulse glow animation */}
      <style jsx global>{`
        @keyframes pulse-fast-glow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 4px 20px rgba(124,58,237,0.5), 0 0 20px rgba(124,58,237,0.3), 0 0 40px rgba(124,58,237,0.2);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.05);
            box-shadow: 0 6px 30px rgba(124,58,237,0.7), 0 0 30px rgba(124,58,237,0.5), 0 0 60px rgba(124,58,237,0.3);
          }
        }
      `}</style>
    </div>
  );
}
