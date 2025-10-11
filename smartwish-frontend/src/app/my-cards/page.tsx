"use client";

import { useState, useEffect, Suspense, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import LoadingOverlay from '@/components/LoadingOverlay';
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import { Menu, MenuButton, MenuItems, MenuItem, Dialog, Transition } from "@headlessui/react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import SendECardModal from "@/components/SendECardModal";
import PrinterSelectionModal from "@/components/PrinterSelectionModal";
import jsPDF from 'jspdf';
import useSWR from "swr";
import { useToast } from "@/contexts/ToastContext";
import {
  DynamicRouter,
  authGet,
  deleteRequest,
  postRequest,
} from "@/utils/request_utils";

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Utility function to format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "1 day ago";
  } else if (diffDays < 30) {
    return `${diffDays} days ago`;
  } else if (diffDays < 365) {
    const diffMonths = Math.floor(diffDays / 30);
    return diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
  } else {
    const diffYears = Math.floor(diffDays / 365);
    return diffYears === 1 ? "1 year ago" : `${diffYears} years ago`;
  }
};

type MyCard = {
  id: string;
  name: string;
  thumbnail: string;
  lastEdited: string;
  category?: string;
  status?: string;
  originalDesignId?: string; // For templates, this is the saved design ID needed for unpublishing
};

type SavedDesign = {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  status?: string;
  metadata?: string | object;
  // Add image fields for the four card pages
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
};

type PublishedTemplate = {
  id: string;
  title: string;
  cover_image?: string;
  image_1?: string;
  category_name?: string;
  author?: string;
  created_at: string;
  updated_at: string;
  original_saved_design_id?: string; // Link back to the saved design
};

type SavedDesignsResponse = {
  success: boolean;
  data: SavedDesign[];
};

type PublishedTemplatesResponse = {
  success: boolean;
  data: PublishedTemplate[];
};

// Authenticated fetcher using request utils
const createAuthenticatedFetcher =
  (session: any) =>
    async (url: string): Promise<SavedDesignsResponse> => {
      try {
        console.log("🔍 Fetching data from:", url);
        console.log("🔐 Session exists:", !!session);

        if (!session?.user) {
          throw new Error("No authenticated session");
        }

        const response = await authGet<SavedDesign[]>(url, session);
        console.log("✅ Data fetched successfully:", response);

        // Check if response.data exists (wrapped response) or if response itself is the array
        let designs: SavedDesign[] = [];
        if (Array.isArray(response.data)) {
          designs = response.data;
        } else if (Array.isArray(response)) {
          // Handle case where backend returns array directly
          designs = response as any;
        } else {
          console.log("🔍 Response structure:", response);
          designs = [];
        }

        console.log("📋 Processed designs count:", designs.length);

        return {
          success: true,
          data: designs,
        };
      } catch (error) {
        console.error("❌ Error fetching data:", error);
        throw error;
      }
    };

// Transform saved design to MyCard format
const transformSavedDesign = (design: SavedDesign): MyCard => {
  // Prioritize individual image columns for thumbnail, fallback to existing thumbnail
  const thumbnail =
    design.image1 || design.thumbnail || "/placeholder-image.jpg";

  return {
    id: design.id,
    name: design.title,
    thumbnail: thumbnail,
    lastEdited: `Edited ${formatRelativeTime(design.updatedAt)}`,
    category: design.category,
    status: design.status || "draft",
  };
};

// Transform published template to MyCard format
const transformPublishedTemplate = (template: PublishedTemplate): MyCard => {
  // Use cover_image or image_1 as thumbnail
  const thumbnail =
    template.cover_image || template.image_1 || "/placeholder-image.jpg";

  return {
    id: template.id,
    name: template.title,
    thumbnail: thumbnail,
    lastEdited: "", // No date display for published cards
    category: template.category_name || "General",
    status: "published",
    originalDesignId: template.original_saved_design_id, // Keep track of the original design ID for unpublishing
  };
};

// Transform published saved design to MyCard format (without date)
const transformPublishedSavedDesign = (design: SavedDesign): MyCard => {
  // Prioritize individual image columns for thumbnail, fallback to existing thumbnail
  const thumbnail =
    design.image1 || design.thumbnail || "/placeholder-image.jpg";

  return {
    id: design.id,
    name: design.title,
    thumbnail: thumbnail,
    lastEdited: "", // No date display for published cards
    category: design.category,
    status: design.status || "published",
  };
};

// Custom fetcher for user's published templates (filtered by author_id)
const templatesFetcher = async (url: string, userId?: string) => {
  if (!url || !userId) {
    return { success: true, data: [] };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch templates");
  }

  const result = await response.json();

  // Filter templates to only show those where author_id matches current user's ID
  if (result.success && result.data) {
    const userTemplates = result.data.filter(
      (template: any) => template.author_id === userId
    );
    return { ...result, data: userTemplates };
  }

  return result;
};

// Component that uses useSearchParams - wrapped in Suspense
function MyCardsContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [designToDelete, setDesignToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [eCardModalOpen, setECardModalOpen] = useState(false);
  const [cardToSend, setCardToSend] = useState<{
    id: string;
    name: string;
    thumbnail: string;
  } | null>(null);
  const [sendingECard, setSendingECard] = useState(false);
  const [giftCardData, setGiftCardData] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showGiftAnimation, setShowGiftAnimation] = useState(false);
  const [animatingCardId, setAnimatingCardId] = useState<string | null>(null);
  const [animatingCardData, setAnimatingCardData] = useState<any>(null);
  const [animationTargetPosition, setAnimationTargetPosition] = useState<{ x: number; y: number } | null>(null);

  // Check for gift card integration
  const cardId = searchParams.get('cardId');
  const showGift = searchParams.get('showGift') === 'true';
  const giftAdded = searchParams.get('giftAdded');

  // Load gift card data if needed
  useEffect(() => {
    if (showGift && cardId) {
      const storedGiftData = localStorage.getItem(`giftCard_${cardId}`);
      if (storedGiftData) {
        setGiftCardData(JSON.parse(storedGiftData));
        // Navigate to the card editor with gift card integration
        window.location.href = `/my-cards/${cardId}?showGift=true`;
      }
    }
  }, [showGift, cardId]);

  // Trigger gift card animation when gift is added
  useEffect(() => {
    if (giftAdded) {
      const storedGiftData = localStorage.getItem(`giftCard_${giftAdded}`);
      if (storedGiftData) {
        setAnimatingCardId(giftAdded);
        setAnimatingCardData(JSON.parse(storedGiftData));

        console.log('🎁 Starting gift card animation for card:', giftAdded);

        // Wait for cards to render, then calculate target position and start animation
        const tryStartAnimation = (attempts = 0) => {
          const targetCard = document.getElementById(`card-${giftAdded}`);

          if (targetCard) {
            console.log('🎯 Found target card, calculating position...');
            const rect = targetCard.getBoundingClientRect();
            const targetPosition = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 4, // Target the top portion (cover)
            };
            console.log('📍 Target position:', targetPosition);

            setAnimationTargetPosition(targetPosition);

            // Start animation slightly after setting position
            setTimeout(() => {
              setShowGiftAnimation(true);
              console.log('✨ Animation started!');
            }, 50);

            // Clean up URL
            const url = new URL(window.location.href);
            url.searchParams.delete('giftAdded');
            window.history.replaceState({}, '', url.toString());

            // Hide animation after it completes
            setTimeout(() => {
              setShowGiftAnimation(false);
              setAnimatingCardId(null);
              setAnimatingCardData(null);
              setAnimationTargetPosition(null);
              console.log('🎁 Animation completed!');
            }, 3000); // Animation duration + buffer
          } else if (attempts < 30) {
            // Retry up to 30 times (3 seconds total)
            console.log(`⏳ Card not found yet, retrying... (attempt ${attempts + 1}/30)`);
            setTimeout(() => tryStartAnimation(attempts + 1), 100);
          } else {
            console.error('❌ Could not find target card after 30 attempts');
          }
        };

        // Start trying after a longer delay to ensure DOM is fully loaded
        setTimeout(() => tryStartAnimation(), 500);
      }
    }
  }, [giftAdded]);

  // Printer selection modal state
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [cardToPrint, setCardToPrint] = useState<MyCard | null>(null);

  // Publish modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [cardToPublish, setCardToPublish] = useState<MyCard | null>(null);
  const [publishCategory, setPublishCategory] = useState("");
  const [publishDescription, setPublishDescription] = useState("");

  // Manual state management for data
  const [savedDesignsResponse, setSavedDesignsResponse] =
    useState<SavedDesignsResponse | null>(null);
  const [templatesResponse, setTemplatesResponse] =
    useState<PublishedTemplatesResponse | null>(null);
  const [savedDesignsError, setSavedDesignsError] = useState<Error | null>(
    null
  );
  const [savedDesignsLoading, setSavedDesignsLoading] = useState(false);

  // Fetch categories for publish modal
  const { data: categoriesResponse } = useSWR<{
    success: boolean;
    data: Array<{ id: string; name: string; display_name: string }>;
  }>("/api/categories", fetcher);
  const categories = categoriesResponse?.data || [];

  // Manual fetch function for saved designs
  const fetchSavedDesigns = async () => {
    if (!session?.user) return;

    setSavedDesignsLoading(true);
    setSavedDesignsError(null);

    try {
      const savedDesignsUrl = DynamicRouter(
        "saved-designs",
        "",
        undefined,
        false
      );
      const authenticatedFetcher = createAuthenticatedFetcher(session);
      const response = await authenticatedFetcher(savedDesignsUrl);
      setSavedDesignsResponse(response);
    } catch (error) {
      setSavedDesignsError(error as Error);
      console.error("Error fetching saved designs:", error);
    } finally {
      setSavedDesignsLoading(false);
    }
  };

  // Manual fetch function for published templates
  const fetchPublishedTemplates = async () => {
    if (!session?.user?.id) return;

    try {
      const templatesUrl = DynamicRouter(
        "api",
        "simple-templates/with-author",
        undefined,
        false
      );
      const response = await templatesFetcher(
        templatesUrl,
        session.user.id.toString()
      );
      setTemplatesResponse(response);
    } catch (error) {
      console.error("Error fetching published templates:", error);
    }
  };

  // Replace mutateSavedDesigns with manual refetch
  const mutateSavedDesigns = fetchSavedDesigns;

  // Load data when page opens and session is available
  useEffect(() => {
    if (session?.user) {
      fetchSavedDesigns();
      fetchPublishedTemplates();
    }
  }, [session?.user]);

  // Check for new design success message
  useEffect(() => {
    const newDesignId = searchParams?.get("newDesign");
    const message = searchParams?.get("message");

    if (newDesignId && message) {
      showToast({
        type: 'success',
        title: 'Design created successfully!',
        message: decodeURIComponent(message),
        duration: 1000
      });

      // Clear the URL parameters
      const timer = setTimeout(() => {
        // Clean up URL parameters
        window.history.replaceState({}, "", "/my-cards");
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Transform saved designs to cards format
  const allDesigns = savedDesignsResponse?.data || [];
  const publishedStatuses = new Set(["published", "published_to_templates"]);
  const draftCards: MyCard[] = allDesigns
    .filter((d) => !publishedStatuses.has(d.status || ""))
    .map(transformSavedDesign);

  // Get user's published designs
  const userPublishedCards: MyCard[] = allDesigns
    .filter((d) => publishedStatuses.has(d.status || ""))
    .map(transformPublishedSavedDesign);

  // Get user's published templates from the templates API (filtered by author_id)
  const userPublishedTemplates: MyCard[] = (templatesResponse?.data || []).map((template) => {
    const transformed = transformPublishedTemplate(template);
    console.log('📋 Transformed template:', {
      id: transformed.id,
      name: transformed.name,
      originalDesignId: transformed.originalDesignId,
      hasOriginalId: !!transformed.originalDesignId
    });
    return transformed;
  });

  // Combine user's published designs with user's published templates
  // Remove duplicates based on ID (in case user's published design is also in templates)
  const allPublishedCards: MyCard[] = [
    ...userPublishedCards,
    ...userPublishedTemplates.filter(
      (template) =>
        // Only include template if it's not already in userPublishedCards
        // Use originalDesignId to match the saved_design that was promoted
        !userPublishedCards.some((userCard) =>
          userCard.id === template.originalDesignId || userCard.id === template.id
        )
    ),
  ].sort((a, b) => {
    // Sort by last edited/updated date (newest first)
    // We need to extract the actual dates from the original data for proper sorting
    const aDesign = [...allDesigns, ...(templatesResponse?.data || [])]
      .find(item => item.id === a.id);
    const bDesign = [...allDesigns, ...(templatesResponse?.data || [])]
      .find(item => item.id === b.id);

    const aTime = aDesign ? new Date(aDesign.updatedAt || aDesign.updated_at).getTime() : 0;
    const bTime = bDesign ? new Date(bDesign.updatedAt || bDesign.updated_at).getTime() : 0;

    return bTime - aTime;
  });

  // Debug logging
  console.log("My Cards - Saved designs response:", savedDesignsResponse);
  console.log("My Cards - Draft cards:", draftCards);
  console.log("My Cards - Published cards:", allPublishedCards);
  console.log("My Cards - Loading state:", savedDesignsLoading);
  console.log("My Cards - Error state:", savedDesignsError);

  // Removed separate published fetch; derive from single dataset.

  // Show delete confirmation modal
  const showDeleteConfirmation = (designId: string, designName: string) => {
    setDesignToDelete({ id: designId, name: designName });
    setDeleteModalOpen(true);
  };

  // Handle delete design (called from modal)
  const handleDelete = async () => {
    if (!designToDelete || !session) return;

    setDeletingId(designToDelete.id);
    try {
      const deleteUrl = DynamicRouter(
        "saved-designs",
        designToDelete.id,
        undefined,
        false
      );
      console.log("🗑️ Deleting design:", designToDelete.id, "URL:", deleteUrl);

      const result = await deleteRequest(deleteUrl, session as any);
      console.log("✅ Delete result:", result);

      showToast({
        type: 'success',
        title: 'Design deleted successfully!',
        message: 'Your design has been successfully deleted!',
        duration: 1000
      });

      // Refresh the designs list
      fetchSavedDesigns();

      // Close modal
      setDeleteModalOpen(false);
      setDesignToDelete(null);
    } catch (error: unknown) {
      console.error("❌ Error deleting design:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to delete design: ${msg}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Close delete modal
  const closeDeleteModal = () => {
    if (deletingId) return; // Prevent closing while deleting
    setDeleteModalOpen(false);
    setDesignToDelete(null);
  };

  // Open publish modal
  const handlePublishClick = (card: MyCard) => {
    setCardToPublish(card);
    setPublishCategory(card.categoryId || "");
    setPublishDescription("");
    setPublishModalOpen(true);
  };

  // Publish design with metadata
  const handlePublishDesign = async () => {
    if (!session || !cardToPublish) return;

    // Validate required fields
    if (!publishCategory || !publishDescription.trim()) {
      showToast({
        type: 'error',
        title: 'Missing Information',
        message: 'Please select a card type and provide a description',
        duration: 4000
      });
      return;
    }

    try {
      const publishUrl = DynamicRouter(
        "saved-designs",
        `${cardToPublish.id}/publish`,
        undefined,
        false
      );
      console.log("📤 Publishing design:", cardToPublish.id, "URL:", publishUrl);

      const result = await postRequest(publishUrl, {
        category_id: publishCategory,
        description: publishDescription,
      }, session as any);

      console.log("✅ Publish result:", result);

      // Close modal and reset
      setPublishModalOpen(false);
      setCardToPublish(null);
      setPublishCategory("");
      setPublishDescription("");

      // Refresh data
      await Promise.all([fetchSavedDesigns(), fetchPublishedTemplates()]);
    } catch (e: unknown) {
      console.error("❌ Error publishing design:", e);
      const msg = e instanceof Error ? e.message : "Failed to publish design";
      showToast({
        type: 'error',
        title: 'Publish Failed',
        message: msg,
        duration: 5000
      });
    }
  };

  // Unpublish design
  const handleUnpublishDesign = async (card: MyCard) => {
    if (!session) return;

    // Use originalDesignId if available (for templates), otherwise use the card id (for saved designs)
    const designId = card.originalDesignId || card.id;

    console.log("📥 Unpublishing design:", {
      cardId: card.id,
      designId: designId,
      isTemplate: !!card.originalDesignId
    });

    try {
      // Use Next.js API route for better error handling
      const response = await fetch(`/api/saved-designs/${designId}/unpublish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();

        // If design not found, it might have been deleted - refresh the list
        if (response.status === 404) {
          console.warn("⚠️ Design not found - refreshing card list");
          showToast({
            type: 'warning',
            title: 'Design not found',
            message: 'This design no longer exists. Refreshing the list...',
            duration: 3000
          });
          // Refresh both lists to update the UI
          await Promise.all([
            fetchSavedDesigns(),
            fetchPublishedTemplates()
          ]);
          return;
        }

        throw new Error(error.error || 'Failed to unpublish design');
      }

      const result = await response.json();
      console.log("✅ Unpublish result:", result);

      // Refresh both lists to update the UI
      await Promise.all([
        fetchSavedDesigns(),
        fetchPublishedTemplates()
      ]);
    } catch (e: unknown) {
      console.error("❌ Error unpublishing design:", e);
      const msg = e instanceof Error ? e.message : "Failed to unpublish design";
      showToast({
        type: 'error',
        title: 'Unpublish failed',
        message: msg,
        duration: 5000
      });
    }
  };

  // Handle duplicate design
  const handleDuplicate = async (designId: string) => {
    if (!session) return;

    setDuplicatingId(designId);
    try {
      console.log("🔄 Starting duplicate process for design:", designId);

      const duplicateUrl = DynamicRouter(
        "saved-designs",
        `${designId}/duplicate`,
        undefined,
        false
      );
      console.log("📡 Duplicate URL:", duplicateUrl);

      const result = await postRequest(duplicateUrl, {}, session as any);
      console.log("✅ Duplicate result:", result);

      showToast({
        type: 'success',
        title: 'Design duplicated successfully!',
        message: 'A copy of your design has been created successfully!',
        duration: 1000
      });

      // Refresh the designs list
      fetchSavedDesigns();
    } catch (error: unknown) {
      console.error("❌ Error duplicating design:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to duplicate design: ${msg}`);
    } finally {
      setDuplicatingId(null);
    }
  };

  // Promote removed: publishing now also creates template; use Unpublish to revert.

  // Handle sending E-Card
  const handleSendECard = (card: MyCard) => {
    setCardToSend({
      id: card.id,
      name: card.name,
      thumbnail: card.thumbnail,
    });
    setECardModalOpen(true);
  };

  // Handle print card
  const handlePrint = async (card: MyCard) => {
    setIsPrinting(true);
    try {
      // Get the card data to extract image URLs
      const savedDesign = savedDesignsResponse?.data?.find(d => d.id === card.id);
      if (!savedDesign) {
        alert('Card data not found');
        setIsPrinting(false);
        return;
      }

      // Extract image URLs
      const image1 = savedDesign.image1;
      const image2 = savedDesign.image2;
      const image3 = savedDesign.image3;
      const image4 = savedDesign.image4;

      if (!image1 || !image2 || !image3 || !image4) {
        alert('All four card images are required for printing');
        setIsPrinting(false);
        return;
      }

      console.log('Generating print JPEG files for card:', card.id);
      console.log('🔍 Print Debug - Full saved design object:', savedDesign);
      console.log('🔍 Print Debug - Saved design metadata:', savedDesign.metadata);
      console.log('🔍 Print Debug - Metadata type:', typeof savedDesign.metadata);

      // Extract gift card data from metadata if present
      let giftCardData = null;
      if (savedDesign.metadata) {
        try {
          const metadata = typeof savedDesign.metadata === 'string'
            ? JSON.parse(savedDesign.metadata)
            : savedDesign.metadata;
          console.log('🔍 Print Debug - Parsed metadata:', metadata);
          console.log('🔍 Print Debug - Metadata keys:', Object.keys(metadata || {}));
          giftCardData = metadata.giftCard || metadata.giftCardData || null;
          console.log('🔍 Print Debug - Extracted gift card data:', giftCardData);
        } catch (error) {
          console.warn('Failed to parse metadata for gift card data:', error);
        }
      } else {
        console.log('🔍 Print Debug - No metadata found in saved design');
      }

      // Also check localStorage as fallback
      const localGiftData = localStorage.getItem(`giftCard_${card.id}`);
      if (localGiftData && !giftCardData) {
        try {
          giftCardData = JSON.parse(localGiftData);
          console.log('🔍 Print Debug - Using gift card data from localStorage:', giftCardData);
        } catch (error) {
          console.warn('Failed to parse localStorage gift card data:', error);
        }
      }

      // Prepare request payload
      const requestPayload = {
        cardId: card.id,
        image1,
        image2,
        image3,
        image4,
        giftCardData,
      };
      console.log('🔍 Print Debug - Request payload to backend:', requestPayload);

      // Call the backend API to generate JPEG files
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com'}/generate-print-jpegs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error('Failed to generate print files');
      }

      const result = await response.json();
      console.log('Backend API response:', result);

      if (result.success) {
        console.log('PDF generated successfully, downloading...');
        console.log('PDF URL:', result.pdfUrl);

        // Download the PDF blob directly from the backend
        const pdfResponse = await fetch(result.pdfUrl);
        if (!pdfResponse.ok) {
          throw new Error('Failed to download PDF from backend');
        }

        const pdfBlob = await pdfResponse.blob();
        console.log('PDF blob downloaded successfully, size:', pdfBlob.size, 'bytes');

        // Validate PDF blob
        if (!pdfBlob || pdfBlob.size === 0) {
          throw new Error('Downloaded PDF blob is empty or invalid');
        }

        // Set state and open printer selection modal
        setPdfBlob(pdfBlob);
        setCardToPrint(card);
        setPrinterModalOpen(true);
        console.log('Printer modal opened successfully');
        setIsPrinting(false);

      } else {
        throw new Error(result.message || 'Failed to generate print files');
      }
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to generate print files. Please try again.');
      setIsPrinting(false);
    }
  };

  // Handle add gift
  const handleAddGift = (card: MyCard) => {
    console.log('Adding gift for card:', card.id);
    setIsNavigating(true);
    // Navigate to marketplace with card integration mode
    window.location.href = `/marketplace?cardId=${card.id}&cardName=${encodeURIComponent(card.name)}&mode=gift`;
  };

  const handleECardSend = async (email: string, message: string) => {
    if (!session || !cardToSend) return;

    if (!session?.user?.id) {
      throw new Error("Please sign in to send e-cards");
    }

    setSendingECard(true);

    try {
      const response = await fetch("/api/send-ecard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cardId: cardToSend.id,
          cardName: cardToSend.name,
          recipientEmail: email,
          message: message,
          senderName: session.user.name || session.user.email,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Show specific error message from API
        const errorMessage = result.error || "Failed to send e-card";
        showToast({
          type: 'error',
          title: 'Failed to send e-card',
          message: errorMessage,
          duration: 1000
        });
        throw new Error(errorMessage);
      }

      showToast({
        type: 'success',
        title: 'E-Card sent successfully!',
        message: `E-Card "${cardToSend.name}" has been sent to ${email}`,
        duration: 1000
      });

      // Close modal and reset state
      setECardModalOpen(false);
      setCardToSend(null);
    } catch (error) {
      console.error("❌ Send e-card failed:", error);
      // Don't throw the error again since we already handled it
      return;
    } finally {
      setSendingECard(false);
    }
  };

  const handleECardModalClose = () => {
    if (!sendingECard) {
      setECardModalOpen(false);
      setCardToSend(null);
    }
  };

  return (
    <main className="pb-24">
      {/* Loading Overlay for Print Operation */}
      {isPrinting && (
        <LoadingOverlay
          message="Preparing your card for printing..."
          submessage="This may take a few moments"
        />
      )}

      {/* Loading Overlay for Navigation */}
      {isNavigating && (
        <LoadingOverlay
          message="Loading marketplace..."
          submessage="Please wait"
        />
      )}

      {/* Gift Card Animation Overlay */}
      {showGiftAnimation && animatingCardData && animationTargetPosition && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* Gift Card SVG - starts from center and flies to the target card */}
          <div
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              animation: `gift-card-fly-custom 2.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards`,
              '--target-x': `${animationTargetPosition.x}px`,
              '--target-y': `${animationTargetPosition.y}px`,
            } as React.CSSProperties}
          >
            <svg
              width="300"
              height="250"
              viewBox="0 0 700 550"
              xmlns="http://www.w3.org/2000/svg"
              className="gift-card-svg"
            >
              <defs>
                <filter id="shadow-anim" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="25" />
                  <feOffset dx="0" dy="12" result="offsetblur" />
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.3" />
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Main container with shadow */}
              <rect x="0" y="0" width="700" height="550" rx="48" ry="48" fill="rgba(255,255,255,0.95)" stroke="rgba(229,231,235,1)" strokeWidth="3" filter="url(#shadow-anim)" />

              {/* QR Code on left */}
              <rect x="50" y="40" width="280" height="280" rx="24" ry="24" fill="white" />
              <image x="50" y="40" width="280" height="280" href={animatingCardData.qrCode} preserveAspectRatio="xMidYMid meet" />

              {/* Company logo on right (same size as QR code) */}
              {animatingCardData.storeLogo && (
                <>
                  <rect x="370" y="40" width="280" height="280" rx="24" ry="24" fill="white" />
                  <image x="370" y="40" width="280" height="280" href={animatingCardData.storeLogo} preserveAspectRatio="xMidYMid meet" />
                </>
              )}

              {/* Company name and amount centered below both */}
              <text x="350" y="390" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="42" fontWeight="600" fill="#1f2937">
                {animatingCardData.storeName}
              </text>
              <text x="350" y="450" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="36" fill="#4b5563">
                ${animatingCardData.amount}
              </text>
            </svg>
          </div>
        </div>
      )}

      <div className="px-4 pt-6 sm:px-6 lg:px-8" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">


        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Designs
          </h1>
        </div>

        {/* Saved Cards Section */}
        <div className="mb-16">
          <div className="mb-6"></div>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
            {savedDesignsLoading ? (
              // Skeleton loading for saved cards
              Array(6)
                .fill(0)
                .map((_, index) => (
                  <div
                    key={`saved-skeleton-${index}`}
                    className="group rounded-2xl bg-white ring-1 ring-gray-200"
                  >
                    <div className="relative overflow-hidden rounded-t-2xl">
                      <div className="aspect-[640/989] w-full bg-gray-200 animate-pulse" />
                      <div className="absolute right-3 top-3">
                        <div className="w-8 h-8 bg-gray-300 rounded-lg animate-pulse"></div>
                      </div>
                    </div>
                    <div className="px-4 pt-3 pb-4 text-left">
                      <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                    </div>
                  </div>
                ))
            ) : savedDesignsError ? (
              <div className="col-span-full text-center text-red-600 py-8">
                Failed to load saved cards.{" "}
                <button
                  onClick={fetchSavedDesigns}
                  className="text-indigo-600 hover:text-indigo-500 underline ml-1"
                >
                  Try again
                </button>
              </div>
            ) : draftCards.length === 0 ? (
              <div className="col-span-full">
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <h3 className="mt-4 text-sm font-medium text-gray-900">
                    No saved designs
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Get started by creating your first greeting card from our
                    templates.
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/templates"
                      className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      <svg
                        className="-ml-0.5 mr-1.5 h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                      </svg>
                      Browse Templates
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              draftCards.map((c, index) => (
                <div
                  key={c.id}
                  id={`card-${c.id}`}
                  className="group rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow hover:shadow-sm"
                >
                  <div className="relative overflow-hidden rounded-t-2xl">
                    <Link
                      href={`/my-cards/${c.id}`}
                      className="block overflow-hidden"
                    >
                      <Image
                        alt={c.name}
                        src={c.thumbnail}
                        width={640}
                        height={989}
                        className="aspect-[640/989] w-full bg-gray-100 object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </Link>
                    <div className="absolute right-3 top-3 flex gap-2">
                      <Menu
                        as="div"
                        className="relative inline-block text-left"
                      >
                        <MenuButton className="inline-flex items-center justify-center rounded-lg bg-black/80 p-1.5 text-white shadow-sm hover:bg-black">
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </MenuButton>
                        <MenuItems
                          anchor={{
                            to:
                              (index + 1) % 2 === 0
                                ? "bottom start"
                                : "bottom end",
                            gap: 8,
                            padding: 16,
                          }}
                          className="z-50 w-48 rounded-md bg-white p-1 text-sm shadow-2xl ring-1 ring-black/5 origin-top-right data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
                        >
                          <MenuItem>
                            <Link
                              href={`/my-cards/${c.id}`}
                              className="block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                            >
                              View Card
                            </Link>
                          </MenuItem>
                          <MenuItem>
                            {({ close }) => (
                              publishedStatuses.has(c.status || "") ? (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleUnpublishDesign(c);
                                    close();
                                  }}
                                  className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                                >
                                  Unpublish
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handlePublishClick(c);
                                    close();
                                  }}
                                  className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                                >
                                  Publish
                                </button>
                              )
                            )}
                          </MenuItem>
                          <MenuItem>
                            {({ close }) => (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDuplicate(c.id);
                                  close();
                                }}
                                disabled={duplicatingId === c.id}
                                className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {duplicatingId === c.id
                                  ? "Duplicating..."
                                  : "Duplicate"}
                              </button>
                            )}
                          </MenuItem>
                          <MenuItem>
                            {({ close }) => (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleSendECard(c);
                                  close();
                                }}
                                className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                                title="Send E-Card"
                              >
                                Send E-Card
                              </button>
                            )}
                          </MenuItem>
                          <MenuItem>
                            {({ close }) => (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handlePrint(c);
                                  close();
                                }}
                                className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50 hidden md:block"
                              >
                                Print
                              </button>
                            )}
                          </MenuItem>
                          <MenuItem>
                            {({ close }) => (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleAddGift(c);
                                  close();
                                }}
                                className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                              >
                                Add Gift
                              </button>
                            )}
                          </MenuItem>
                          {/* Promote removed */}
                          <MenuItem>
                            {({ close }) => (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  showDeleteConfirmation(c.id, c.name);
                                  close();
                                }}
                                disabled={deletingId === c.id}
                                className="w-full text-left block rounded px-2 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingId === c.id ? "Deleting..." : "Delete"}
                              </button>
                            )}
                          </MenuItem>
                        </MenuItems>
                      </Menu>
                    </div>
                  </div>
                  <div className="px-4 pt-3 pb-4 text-left">
                    <h3 className="line-clamp-1 text-[15px] font-semibold leading-6">
                      <Link
                        href={`/my-cards/${c.id}`}
                        className="text-gray-900 hover:text-indigo-600 transition-colors duration-200"
                      >
                        {c.name}
                      </Link>
                    </h3>
                    <div className="mt-1.5 text-[12px] text-gray-600">
                      {c.lastEdited}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="relative mb-16">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-6 text-sm font-medium text-gray-500">
              Published Cards
            </span>
          </div>
        </div>

        {/* Published Cards Section */}
        <div>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
            {savedDesignsLoading ? (
              Array(3)
                .fill(0)
                .map((_, index) => (
                  <div
                    key={`published-skeleton-${index}`}
                    className="group rounded-2xl bg-white ring-1 ring-gray-200"
                  >
                    <div className="relative overflow-hidden rounded-t-2xl">
                      <div className="aspect-[640/989] w-full bg-gray-200 animate-pulse" />
                    </div>
                    <div className="px-4 pt-3 pb-4 text-left">
                      <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4 mb-2" />
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))
            ) : allPublishedCards.length === 0 ? (
              <div className="col-span-full">
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                    />
                  </svg>
                  <h3 className="mt-4 text-sm font-medium text-gray-900">
                    No published cards
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Publish a saved design to see it here.
                  </p>
                </div>
              </div>
            ) : (
              allPublishedCards.map((c: MyCard, index: number) => (
                <div
                  key={c.id}
                  className="group rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow hover:shadow-sm"
                >
                  <div className="relative overflow-hidden rounded-t-2xl">
                    <div className="block overflow-hidden cursor-default">
                      <Image
                        alt={c.name}
                        src={c.thumbnail}
                        width={640}
                        height={989}
                        className="aspect-[640/989] w-full bg-gray-100 object-cover"
                      />
                    </div>
                    <div className="absolute right-3 top-3 flex gap-2">
                      <Menu
                        as="div"
                        className="relative inline-block text-left"
                      >
                        <MenuButton className="inline-flex items-center justify-center rounded-lg bg-black/80 p-1.5 text-white shadow-sm hover:bg-black">
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </MenuButton>
                        <MenuItems
                          anchor={{
                            to:
                              (index + 1) % 2 === 0
                                ? "bottom start"
                                : "bottom end",
                            gap: 8,
                            padding: 16,
                          }}
                          className="z-50 w-48 rounded-md bg-white p-1 text-sm shadow-2xl ring-1 ring-black/5 origin-top-right data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
                        >
                          <MenuItem>
                            {({ close }) => (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleSendECard(c);
                                  close();
                                }}
                                className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                                title="Send E-Card"
                              >
                                Send E-Card
                              </button>
                            )}
                          </MenuItem>
                          <MenuItem>
                            {({ close }) => (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handlePrint(c);
                                  close();
                                }}
                                className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                              >
                                Print
                              </button>
                            )}
                          </MenuItem>
                          <MenuItem>
                            {({ close }) => (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleUnpublishDesign(c);
                                  close();
                                }}
                                className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                              >
                                Unpublish
                              </button>
                            )}
                          </MenuItem>
                        </MenuItems>
                      </Menu>
                    </div>
                  </div>
                  <div className="px-4 pt-3 pb-4 text-left">
                    <h3 className="line-clamp-1 text-[15px] font-semibold leading-6 text-gray-900">
                      {c.name}
                    </h3>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={closeDeleteModal}
          onConfirm={handleDelete}
          title="Delete Design"
          itemName={designToDelete?.name || ""}
          itemType="design"
          isDeleting={!!deletingId}
        />

        {/* Send E-Card Modal */}
        <SendECardModal
          isOpen={eCardModalOpen}
          onClose={handleECardModalClose}
          onSend={handleECardSend}
          cardName={cardToSend?.name || ""}
          cardThumbnail={
            cardToSend?.thumbnail && cardToSend.thumbnail.trim() !== ""
              ? cardToSend.thumbnail
              : ""
          }
          isLoading={sendingECard}
        />

        {/* Printer Selection Modal */}
        <PrinterSelectionModal
          isOpen={printerModalOpen}
          onClose={() => {
            setPrinterModalOpen(false);
            setPdfBlob(null);
            setCardToPrint(null);
          }}
          onPrint={(printerName: string) => {
            console.log(`Printing to: ${printerName}`);
            // The actual printing is handled within the modal
          }}
          pdfBlob={pdfBlob}
          cardName={cardToPrint?.name || ""}
        />

        {/* Publish Modal */}
        <Transition appear show={publishModalOpen} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => setPublishModalOpen(false)}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4 text-center">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 mb-4"
                    >
                      Publish Card to Store
                    </Dialog.Title>

                    <div className="mt-2 space-y-4">
                      <p className="text-sm text-gray-500">
                        Please provide details about your card so others can find it.
                      </p>

                      {/* Card Type/Category */}
                      <div>
                        <label
                          htmlFor="publish-category"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Card Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="publish-category"
                          value={publishCategory}
                          onChange={(e) => setPublishCategory(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Select a card type...</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.display_name || cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Description */}
                      <div>
                        <label
                          htmlFor="publish-description"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id="publish-description"
                          value={publishDescription}
                          onChange={(e) => setPublishDescription(e.target.value)}
                          placeholder="Describe your card (e.g., 'A beautiful birthday card with colorful balloons, perfect for celebrating a special day')"
                          rows={4}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          This helps people find your card when searching
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex gap-3 justify-end">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        onClick={() => {
                          setPublishModalOpen(false);
                          setCardToPublish(null);
                          setPublishCategory("");
                          setPublishDescription("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handlePublishDesign}
                        disabled={
                          !publishCategory || !publishDescription.trim()
                        }
                      >
                        Publish to Store
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </main>
  );
}

// Main component with Suspense boundary
export default function MyCardsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={
          <main className="pb-24">
            <div className="px-4 pt-6 sm:px-6 lg:px-8" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  My designs
                </h1>
              </div>
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading...</p>
              </div>
            </div>
          </main>
        }
      >
        <MyCardsContent />
      </Suspense>
    </div>
  );
}
