"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import SendECardModal from "@/components/SendECardModal";
import PrinterSelectionModal from "@/components/PrinterSelectionModal";
import jsPDF from 'jspdf';
import { useToast } from "@/contexts/ToastContext";
import {
  DynamicRouter,
  authGet,
  deleteRequest,
  postRequest,
} from "@/utils/request_utils";

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
  // New individual image fields
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
  
  // Check for gift card integration
  const cardId = searchParams.get('cardId');
  const showGift = searchParams.get('showGift') === 'true';
  
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
  
  // Printer selection modal state
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [cardToPrint, setCardToPrint] = useState<MyCard | null>(null);

  // Manual state management for data
  const [savedDesignsResponse, setSavedDesignsResponse] =
    useState<SavedDesignsResponse | null>(null);
  const [templatesResponse, setTemplatesResponse] =
    useState<PublishedTemplatesResponse | null>(null);
  const [savedDesignsError, setSavedDesignsError] = useState<Error | null>(
    null
  );
  const [savedDesignsLoading, setSavedDesignsLoading] = useState(false);

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
  const userPublishedTemplates: MyCard[] = (templatesResponse?.data || []).map(
    transformPublishedTemplate
  );

  // Combine user's published designs with user's published templates
  // Remove duplicates based on ID (in case user's published design is also in templates)
  const allPublishedCards: MyCard[] = [
    ...userPublishedCards,
    ...userPublishedTemplates.filter(
      (template) =>
        !userPublishedCards.some((userCard) => userCard.id === template.id)
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

  // Publish design
  const handlePublishDesign = async (designId: string) => {
    if (!session) return;

    try {
      const publishUrl = DynamicRouter(
        "saved-designs",
        `${designId}/publish`,
        undefined,
        false
      );
      console.log("📤 Publishing design:", designId, "URL:", publishUrl);

      const result = await postRequest(publishUrl, {}, session as any);
      console.log("✅ Publish result:", result);

      showToast({
        type: 'success',
        title: 'Design published successfully!',
        message: 'Your design is now live and published for everyone to see!',
        duration: 1000
      });
      fetchSavedDesigns();
      fetchPublishedTemplates();
    } catch (e: unknown) {
      console.error("❌ Error publishing design:", e);
      const msg = e instanceof Error ? e.message : "Failed to publish design";
      alert(msg);
    }
  };

  // Unpublish design
  const handleUnpublishDesign = async (designId: string) => {
    if (!session) return;

    try {
      const unpublishUrl = DynamicRouter(
        "saved-designs",
        `${designId}/unpublish`,
        undefined,
        false
      );
      console.log("📥 Unpublishing design:", designId, "URL:", unpublishUrl);

      const result = await postRequest(unpublishUrl, {}, session as any);
      console.log("✅ Unpublish result:", result);

      showToast({
        type: 'success',
        title: 'Design unpublished successfully!',
        message: 'Your design has been unpublished and moved back to drafts.',
        duration: 1000
      });
      fetchSavedDesigns();
      fetchPublishedTemplates();
    } catch (e: unknown) {
      console.error("❌ Error unpublishing design:", e);
      const msg = e instanceof Error ? e.message : "Failed to unpublish design";
      alert(msg);
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
    try {
      // Get the card data to extract image URLs
      const savedDesign = savedDesignsResponse?.data?.find(d => d.id === card.id);
      if (!savedDesign) {
        alert('Card data not found');
        return;
      }

      // Extract image URLs
      const image1 = savedDesign.image1;
      const image2 = savedDesign.image2;
      const image3 = savedDesign.image3;
      const image4 = savedDesign.image4;

      if (!image1 || !image2 || !image3 || !image4) {
        alert('All four card images are required for printing');
        return;
      }

      console.log('Generating print JPEG files for card:', card.id);

      // Call the backend API to generate JPEG files
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com'}/generate-print-jpegs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: card.id,
          image1,
          image2,
          image3,
          image4,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate print files');
      }

      const result = await response.json();
      console.log('Backend API response:', result);
      
      if (result.success) {
        console.log('JPEG files generated successfully, creating PDF...');
        console.log('JPEG file URLs:', {
          jpeg1: result.files?.jpeg1,
          jpeg2: result.files?.jpeg2
        });
        
        // Create PDF from the JPEG files
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Function to load image and add to PDF with timeout
        const addImageToPDF = (imageUrl: string, pageNumber: number): Promise<void> => {
          return new Promise((resolve, reject) => {
            console.log(`Loading image ${pageNumber}: ${imageUrl}`);
            
            // Check if URL is valid
            if (!imageUrl || typeof imageUrl !== 'string') {
              const error = `Invalid image URL for page ${pageNumber}: ${imageUrl}`;
              console.error(error);
              reject(new Error(error));
              return;
            }
            
            const img = document.createElement('img');
            let isResolved = false;
            
            // Set up timeout (30 seconds)
            const timeout = setTimeout(() => {
              if (!isResolved) {
                isResolved = true;
                console.error(`Timeout loading image ${pageNumber}: ${imageUrl}`);
                reject(new Error(`Timeout loading image ${pageNumber}: ${imageUrl}`));
              }
            }, 30000);
            
            // Set up error handler first
            img.onerror = (error) => {
              if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                console.error(`Failed to load image ${pageNumber}:`, error);
                console.error(`Image URL: ${imageUrl}`);
                console.error(`Error details:`, {
                  type: 'image_load_error',
                  pageNumber,
                  imageUrl,
                  error
                });
                reject(new Error(`Failed to load image ${pageNumber}: ${imageUrl}. Error: ${error}`));
              }
            };
            
            // Set up load handler
            img.onload = () => {
              if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                try {
                  console.log(`Image ${pageNumber} loaded successfully, dimensions: ${img.width}x${img.height}`);
                  
                  // Validate image dimensions
                  if (img.width === 0 || img.height === 0) {
                    throw new Error(`Invalid image dimensions: ${img.width}x${img.height}`);
                  }
                  
                  // Calculate dimensions to fit A4 page (210 x 297 mm)
                  const pageWidth = 210;
                  const pageHeight = 297;
                  const margin = 10;
                  const maxWidth = pageWidth - (margin * 2);
                  const maxHeight = pageHeight - (margin * 2);
                  
                  // Calculate aspect ratio and dimensions
                  const imgAspectRatio = img.width / img.height;
                  let imgWidth = maxWidth;
                  let imgHeight = maxWidth / imgAspectRatio;
                  
                  if (imgHeight > maxHeight) {
                    imgHeight = maxHeight;
                    imgWidth = maxHeight * imgAspectRatio;
                  }
                  
                  // Center the image on the page
                  const x = (pageWidth - imgWidth) / 2;
                  const y = (pageHeight - imgHeight) / 2;
                  
                  if (pageNumber > 1) {
                    pdf.addPage();
                  }
                  
                  console.log(`Adding image ${pageNumber} to PDF at position (${x}, ${y}) with size ${imgWidth}x${imgHeight}`);
                  pdf.addImage(img, 'JPEG', x, y, imgWidth, imgHeight);
                  console.log(`Image ${pageNumber} added to PDF successfully`);
                  resolve();
                } catch (error) {
                  console.error(`Error adding image ${pageNumber} to PDF:`, error);
                  console.error(`PDF addImage error details:`, {
                    type: 'pdf_add_image_error',
                    pageNumber,
                    imageUrl,
                    imageDimensions: `${img.width}x${img.height}`,
                    error
                  });
                  reject(new Error(`PDF generation error for image ${pageNumber}: ${error.message}`));
                }
              }
            };
            
            // Try to set crossOrigin, but don't fail if it doesn't work
            try {
              img.crossOrigin = 'anonymous';
            } catch (corsError) {
              console.warn(`Could not set crossOrigin for image ${pageNumber}:`, corsError);
            }
            
            // Set the source last to trigger loading
            img.src = imageUrl;
          });
        };

        // Add both JPEG images to PDF
        try {
          console.log('Starting PDF generation process...');
          console.log('Available JPEG files:', {
            jpeg1: result.files?.jpeg1,
            jpeg2: result.files?.jpeg2
          });
          
          // Validate that we have the required JPEG files
          if (!result.files?.jpeg1 || !result.files?.jpeg2) {
            throw new Error('Missing JPEG files from backend response');
          }
          
          console.log('Adding first image to PDF...');
          await addImageToPDF(result.files.jpeg1, 1);
          console.log('First image added successfully');
          
          console.log('Adding second image to PDF...');
          await addImageToPDF(result.files.jpeg2, 2);
          console.log('Second image added successfully');
          
          console.log('Generating PDF blob...');
          const pdfBlob = pdf.output('blob');
          console.log('PDF blob generated successfully, size:', pdfBlob.size, 'bytes');
          
          // Validate PDF blob
          if (!pdfBlob || pdfBlob.size === 0) {
            throw new Error('Generated PDF blob is empty or invalid');
          }
          
          // Set state and open printer selection modal
          setPdfBlob(pdfBlob);
          setCardToPrint(card);
          setPrinterModalOpen(true);
          console.log('Printer modal opened successfully');
        } catch (pdfError) {
          console.error('Error during PDF generation process:', pdfError);
          console.error('PDF Error details:', {
            type: 'pdf_generation_error',
            cardId: card.id,
            error: pdfError,
            jpegFiles: result.files
          });
          throw new Error(`PDF generation failed: ${pdfError.message || pdfError}`);
        }
        
      } else {
        throw new Error(result.message || 'Failed to generate print files');
      }
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to generate print files. Please try again.');
    }
  };

  // Handle add gift
  const handleAddGift = (card: MyCard) => {
    console.log('Adding gift for card:', card.id);
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
                            {publishedStatuses.has(c.status || "") ? (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  // handleUnpublishDesign(c.id); // Temporarily disabled
                                }}
                                disabled={true}
                                className="w-full text-left block rounded px-2 py-1.5 text-gray-400 cursor-not-allowed opacity-50"
                                title="Unpublish is temporarily disabled"
                              >
                                Unpublish (Disabled)
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handlePublishDesign(c.id);
                                }}
                                className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                              >
                                Publish
                              </button>
                            )}
                          </MenuItem>
                          <MenuItem>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleDuplicate(c.id);
                              }}
                              disabled={duplicatingId === c.id}
                              className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {duplicatingId === c.id
                                ? "Duplicating..."
                                : "Duplicate"}
                            </button>
                          </MenuItem>
                          <MenuItem>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleSendECard(c);
                              }}
                              className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                              title="Send E-Card"
                            >
                              Send E-Card
                            </button>
                          </MenuItem>
                          <MenuItem>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handlePrint(c);
                              }}
                              className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50 hidden md:block"
                            >
                              Print
                            </button>
                          </MenuItem>
                          <MenuItem>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleAddGift(c);
                              }}
                              className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                            >
                              Add Gift
                            </button>
                          </MenuItem>
                          {/* Promote removed */}
                          <MenuItem>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                showDeleteConfirmation(c.id, c.name);
                              }}
                              disabled={deletingId === c.id}
                              className="w-full text-left block rounded px-2 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingId === c.id ? "Deleting..." : "Delete"}
                            </button>
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
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleSendECard(c);
                              }}
                              className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                              title="Send E-Card"
                             >
                               Send E-Card
                            </button>
                          </MenuItem>
                          <MenuItem>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handlePrint(c);
                              }}
                              className="w-full text-left block rounded px-2 py-1.5 text-gray-700 hover:bg-gray-50"
                            >
                              Print
                            </button>
                          </MenuItem>
                          <MenuItem>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                // handleUnpublishDesign(c.id); // Temporarily disabled
                              }}
                              disabled={true}
                              className="w-full text-left block rounded px-2 py-1.5 text-gray-400 cursor-not-allowed opacity-50"
                              title="Unpublish is temporarily disabled"
                            >
                              Unpublish (Disabled)
                            </button>
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
