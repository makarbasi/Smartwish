"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon } from "@heroicons/react/24/outline";
import useSWR from "swr";

import StickerSheet, { StickerSlot } from "@/components/stickers/StickerSheet";
import StickerCarousel, { StickerItem } from "@/components/stickers/StickerCarousel";
import StickerGallery, { Sticker } from "@/components/stickers/StickerGallery";
import StickerEditorModal from "@/components/stickers/StickerEditorModal";
import StickerPaymentModal from "@/components/stickers/StickerPaymentModal";
import { useKiosk } from "@/contexts/KioskContext";
import { useDeviceMode } from "@/contexts/DeviceModeContext";

// Page view modes
type ViewMode = "initial" | "selection" | "editing";

// Stickers API response
interface StickersApiResponse {
  success: boolean;
  data: Array<{
    id: string;
    title: string;
    slug?: string;
    category?: string;
    imageUrl: string;
    thumbnailUrl?: string;
    tags?: string[];
    popularity?: number;
  }>;
  total: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Sticker sheet price
const STICKER_SHEET_PRICE = 3.99;

export default function StickersPage() {
  const router = useRouter();
  const { isKiosk } = useDeviceMode();
  const { config: kioskConfig } = useKiosk();

  // Sticker slots state (6 slots for Avery 94513)
  const [slots, setSlots] = useState<StickerSlot[]>(
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      imageUrl: null,
      editedImageBlob: null,
      originalImageUrl: null,
    }))
  );

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("initial");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editorImageSrc, setEditorImageSrc] = useState<string>("");

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch stickers for carousel
  const { data: stickersData, isLoading: isLoadingStickers } = useSWR<StickersApiResponse>(
    "/api/stickers?limit=20",
    fetcher
  );

  // Transform API data for carousel
  const carouselStickers: StickerItem[] = (stickersData?.data || []).map((s) => ({
    id: s.id,
    title: s.title,
    imageUrl: s.imageUrl,
    thumbnailUrl: s.thumbnailUrl,
  }));

  // Count filled slots
  const filledSlotsCount = slots.filter((s) => s.imageUrl).length;

  // Handle back to home
  const handleBackToHome = () => {
    router.push("/kiosk/home");
  };

  // Handle slot click - enter selection mode
  const handleSlotClick = useCallback((index: number) => {
    setSelectedSlotIndex(index);
    setViewMode("selection");
  }, []);

  // Handle slot clear
  const handleSlotClear = useCallback((index: number) => {
    setSlots((prev) =>
      prev.map((slot, i) =>
        i === index ? { ...slot, imageUrl: null, editedImageBlob: null } : slot
      )
    );
  }, []);

  // Handle sticker selection from gallery - add directly to slot
  const handleSelectSticker = useCallback((sticker: Sticker) => {
    if (selectedSlotIndex === null) return;

    // Add sticker directly to the slot without opening editor
    setSlots((prev) =>
      prev.map((slot, i) =>
        i === selectedSlotIndex
          ? { ...slot, imageUrl: sticker.imageUrl, editedImageBlob: null, originalImageUrl: sticker.imageUrl }
          : slot
      )
    );

    // Return to initial view
    setSelectedSlotIndex(null);
    setViewMode("initial");
  }, [selectedSlotIndex]);

  // Handle gallery close - return to initial view
  const handleGalleryClose = useCallback(() => {
    setSelectedSlotIndex(null);
    setViewMode("initial");
  }, []);

  // Handle edit button click on a sticker slot
  const handleSlotEdit = useCallback(async (index: number) => {
    const slot = slots[index];
    if (!slot.imageUrl) return;

    setSelectedSlotIndex(index);
    setViewMode("editing");
    
    // Use the current imageUrl (which includes any edits) - NOT the original
    const imageUrl = slot.imageUrl;
    
    // If it's already a blob or data URL, use it directly
    if (imageUrl.startsWith("blob:") || imageUrl.startsWith("data:")) {
      setEditorImageSrc(imageUrl);
      setShowEditor(true);
      return;
    }
    
    // For external URLs, use our proxy to avoid CORS issues with Pintura
    try {
      // Use the proxy endpoint to fetch the external image
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Proxy failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditorImageSrc(reader.result as string);
        setShowEditor(true);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error loading image for edit:", error);
      // Fallback to direct URL (may not work due to CORS)
      setEditorImageSrc(imageUrl);
      setShowEditor(true);
    }
  }, [slots]);

  // Handle editor process (save)
  const handleEditorProcess = useCallback(
    (result: { dest: File }) => {
      if (selectedSlotIndex === null) return;

      // Create a blob URL from the processed image
      const blobUrl = URL.createObjectURL(result.dest);

      // Update the slot with the edited image, keeping the original URL
      setSlots((prev) =>
        prev.map((slot, i) => {
          if (i !== selectedSlotIndex) return slot;
          return {
            ...slot,
            imageUrl: blobUrl,
            editedImageBlob: result.dest,
            // Preserve original URL for future edits
            originalImageUrl: slot.originalImageUrl || editorImageSrc,
          };
        })
      );

      // Close editor and return to initial view
      setShowEditor(false);
      setEditorImageSrc("");
      setSelectedSlotIndex(null);
      setViewMode("initial");
    },
    [selectedSlotIndex, editorImageSrc]
  );

  // Handle editor hide (cancel)
  const handleEditorHide = useCallback(() => {
    setShowEditor(false);
    setEditorImageSrc("");
    setSelectedSlotIndex(null);
    // Return to initial view
    setViewMode("initial");
  }, []);

  // Handle print button click
  const handlePrintClick = () => {
    if (filledSlotsCount === 0) {
      alert("Please add at least one sticker before printing.");
      return;
    }
    setShowPaymentModal(true);
  };

  // Handle payment success
  const handlePaymentSuccess = async () => {
    setIsPrinting(true);
    
    try {
      // Generate composite image and print
      await printStickerSheet();
      
      setShowPaymentModal(false);
      setIsPrinting(false);
      
      // Reset state after successful print
      setSlots(
        Array.from({ length: 6 }, (_, i) => ({
          id: i,
          imageUrl: null,
          editedImageBlob: null,
          originalImageUrl: null,
        }))
      );
      
      alert("Your sticker sheet is printing!");
    } catch (error) {
      console.error("Print error:", error);
      setIsPrinting(false);
      alert("Failed to print. Please try again.");
    }
  };

  // Print sticker sheet function
  const printStickerSheet = async () => {
    // Get printer settings from kiosk config
    const printerName = kioskConfig?.printerName || "HP OfficeJet Pro 9130e Series";
    const trays = kioskConfig?.printerTrays || [];
    const tray = trays.find((t) => t.paperType === "sticker");
    const trayNumber = tray?.trayNumber;
    const paperSize = tray?.paperSize || "letter";

    console.log(`🖨️ Printing sticker sheet to: ${printerName}`);

    // Convert blob URLs to base64 for all filled slots
    const imageBase64Array: (string | null)[] = await Promise.all(
      slots.map(async (slot) => {
        if (!slot.imageUrl) return null;
        
        try {
          const response = await fetch(slot.imageUrl);
          const blob = await response.blob();
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error("Error converting image to base64:", error);
          return null;
        }
      })
    );

    // Send to backend print endpoint
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE || "https://smartwish.onrender.com"}/print-stickers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stickers: imageBase64Array,
          printerName,
          paperSize,
          trayNumber,
          layout: "avery-94513", // 6 circles, 3" diameter, 2x3 grid
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to send print job");
    }

    const result = await response.json();
    console.log("✅ Sticker print job sent successfully!", result);
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      slots.forEach((slot) => {
        if (slot.imageUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(slot.imageUrl);
        }
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={handleBackToHome}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">Create Stickers</h1>
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div
          className={`
            transition-all duration-500 ease-in-out
            ${viewMode !== "initial" ? "mb-4" : "mb-8"}
          `}
        >
          {/* Sticker Sheet - shrinks when in selection mode */}
          <div
            className={`
              transition-all duration-500 ease-in-out
              ${viewMode !== "initial" ? "transform scale-75 origin-top" : ""}
            `}
          >
            <StickerSheet
              slots={slots}
              selectedIndex={selectedSlotIndex}
              isCompact={viewMode !== "initial"}
              onSlotClick={handleSlotClick}
              onSlotClear={handleSlotClear}
              onSlotEdit={handleSlotEdit}
            />
          </div>
        </div>

        {/* Carousel - only show in initial mode */}
        {viewMode === "initial" && (
          <div className="mt-6">
            <StickerCarousel
              stickers={carouselStickers}
              isLoading={isLoadingStickers}
            />
          </div>
        )}

        {/* Gallery - show in selection mode */}
        {viewMode === "selection" && (
          <div className="mt-4 bg-white rounded-2xl shadow-lg border border-gray-200 p-4 max-h-[50vh] overflow-hidden">
            <StickerGallery
              onSelectSticker={handleSelectSticker}
              onClose={handleGalleryClose}
            />
          </div>
        )}
      </div>

      {/* Print button - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pb-6 pt-10 px-4 z-10">
        <div className="max-w-md mx-auto">
          <button
            onClick={handlePrintClick}
            disabled={filledSlotsCount === 0 || isPrinting}
            className={`
              w-full
              flex
              items-center
              justify-center
              gap-3
              px-8
              py-4
              rounded-2xl
              font-semibold
              text-lg
              shadow-lg
              transition-all
              duration-300
              ${
                filledSlotsCount > 0
                  ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }
            `}
          >
            {isPrinting ? (
              <>
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Printing...</span>
              </>
            ) : (
              <>
                <PrinterIcon className="w-6 h-6" />
                <span>Print Sticker Sheet • ${STICKER_SHEET_PRICE.toFixed(2)}</span>
              </>
            )}
          </button>
          {filledSlotsCount === 0 && (
            <p className="text-center text-sm text-gray-500 mt-2">
              Add at least one sticker to print
            </p>
          )}
        </div>
      </div>

      {/* Sticker Editor Modal with circular crop */}
      {showEditor && editorImageSrc && (
        <StickerEditorModal
          imageSrc={editorImageSrc}
          isVisible={showEditor}
          onHide={handleEditorHide}
          onProcess={handleEditorProcess}
        />
      )}

      {/* Sticker Payment Modal */}
      <StickerPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        stickerCount={filledSlotsCount}
      />
    </div>
  );
}
