"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon } from "@heroicons/react/24/outline";
import useSWR from "swr";
import jsPDF from "jspdf";

import StickerSheet, { StickerSlot } from "@/components/stickers/StickerSheet";
import StickerCarousel, { StickerItem } from "@/components/stickers/StickerCarousel";
import StickerGallery, { Sticker } from "@/components/stickers/StickerGallery";
import PinturaEditorModal from "@/components/PinturaEditorModal";
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

  // Copy mode state
  const [copySourceIndex, setCopySourceIndex] = useState<number | null>(null);

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

  // Exit copy mode
  const handleExitCopyMode = useCallback(() => {
    setCopySourceIndex(null);
  }, []);

  // Handle paste to target slot
  const handleCopyToSlot = useCallback((targetIndex: number) => {
    if (copySourceIndex === null) return;
    
    const sourceSlot = slots[copySourceIndex];
    if (!sourceSlot.imageUrl) return;

    // Copy the sticker to the target slot
    setSlots((prev) =>
      prev.map((slot, i) =>
        i === targetIndex
          ? {
              ...slot,
              imageUrl: sourceSlot.imageUrl,
              editedImageBlob: sourceSlot.editedImageBlob,
              originalImageUrl: sourceSlot.originalImageUrl,
            }
          : slot
      )
    );
    // Stay in copy mode to allow multiple pastes
  }, [copySourceIndex, slots]);

  // Handle slot click - enter selection mode or paste if in copy mode
  const handleSlotClick = useCallback((index: number) => {
    // If in copy mode, handle paste
    if (copySourceIndex !== null) {
      if (index === copySourceIndex) {
        // Clicking the source exits copy mode
        handleExitCopyMode();
      } else {
        // Paste to this slot
        handleCopyToSlot(index);
      }
      return;
    }
    
    // Normal mode - enter selection
    setSelectedSlotIndex(index);
    setViewMode("selection");
  }, [copySourceIndex, handleExitCopyMode, handleCopyToSlot]);

  // Handle slot clear
  const handleSlotClear = useCallback((index: number) => {
    setSlots((prev) =>
      prev.map((slot, i) =>
        i === index ? { ...slot, imageUrl: null, editedImageBlob: null, originalImageUrl: null } : slot
      )
    );
  }, []);

  // Handle copy button click - enter copy mode
  const handleSlotCopy = useCallback((index: number) => {
    setCopySourceIndex(index);
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

  // Handle print button click - generate PDF and open payment modal
  const handlePrintClick = async () => {
    if (filledSlotsCount === 0) {
      alert("Please add at least one sticker before printing.");
      return;
    }
    
    setIsPrinting(true);
    try {
      // Generate and save PDF immediately
      await generateStickerPDF();
      setIsPrinting(false);
      
      // Also open the payment modal for payment flow
      setShowPaymentModal(true);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
      setIsPrinting(false);
    }
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

  // Generate and save sticker sheet PDF
  const generateStickerPDF = async () => {
    console.log("📄 Generating sticker sheet PDF...");

    // Avery 94513 specifications (in inches)
    const PAPER_WIDTH = 8.5;
    const PAPER_HEIGHT = 11;
    const STICKER_DIAMETER = 3;
    const STICKER_RADIUS = STICKER_DIAMETER / 2;

    // Column centers (in inches from left edge)
    const COL_1_CENTER = 1.25 + 1.5; // 2.75"
    const COL_2_CENTER = PAPER_WIDTH - 1.25 - 1.5; // 5.75"

    // Row centers (in inches from top edge)
    const TOP_MARGIN = 0.75;
    const VERTICAL_PITCH = 3.5;
    const ROW_1_CENTER = TOP_MARGIN + 1.5; // 2.25"
    const ROW_2_CENTER = TOP_MARGIN + 1.5 + VERTICAL_PITCH; // 5.75"
    const ROW_3_CENTER = TOP_MARGIN + 1.5 + VERTICAL_PITCH * 2; // 9.25"

    // Circle positions: [centerX, centerY] for each of 6 slots
    const CIRCLE_POSITIONS = [
      [COL_1_CENTER, ROW_1_CENTER],
      [COL_2_CENTER, ROW_1_CENTER],
      [COL_1_CENTER, ROW_2_CENTER],
      [COL_2_CENTER, ROW_2_CENTER],
      [COL_1_CENTER, ROW_3_CENTER],
      [COL_2_CENTER, ROW_3_CENTER],
    ];

    // Create PDF with letter size in inches
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: "letter",
    });

    // Convert all slot images to base64
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

    // Add each sticker to the PDF
    for (let i = 0; i < 6; i++) {
      const imageData = imageBase64Array[i];
      const [centerX, centerY] = CIRCLE_POSITIONS[i];

      if (imageData) {
        // Calculate position so that image is centered in the circle
        // For object-contain behavior, we place a square image area and let the image fit
        const x = centerX - STICKER_RADIUS;
        const y = centerY - STICKER_RADIUS;

        // Add the image - jsPDF will scale it to fit the dimensions
        // Using addImage with fit option to contain the entire image within the circle area
        try {
          pdf.addImage(
            imageData,
            "PNG",
            x,
            y,
            STICKER_DIAMETER,
            STICKER_DIAMETER
          );
        } catch (error) {
          console.error(`Error adding sticker ${i + 1} to PDF:`, error);
        }
      }
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `sticker-sheet-${timestamp}.pdf`;

    // Save the PDF
    pdf.save(filename);
    console.log(`✅ PDF saved as ${filename}`);
  };

  // Print sticker sheet function (for backend printing)
  // Print agent handles duplex, paper size settings locally
  const printStickerSheet = async () => {
    // Get printer name from kiosk config
    const printerName = kioskConfig?.printerName || "HP OfficeJet Pro 9130e Series [HPIE4B65B]";
    
    console.log(`🖨️ Sending sticker print job to: ${printerName}`);

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

    // Send to backend print endpoint with printer name
    // Print agent handles duplex, paper size locally
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE || "https://smartwish.onrender.com"}/print-stickers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stickers: imageBase64Array,
          printerName: printerName,
          layout: "avery-94513", // 6 circles, 3" diameter, 2x3 grid
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to send print job");
    }

    const result = await response.json();
    console.log("✅ Sticker print job queued successfully!", result);
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-pink-50 via-white to-purple-50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white/90 backdrop-blur-sm border-b border-gray-200 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={handleBackToHome}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <h1 className="text-lg font-bold text-gray-900">Create Stickers</h1>
            <div className="w-20" /> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      {/* Main content - flex column to fill remaining space */}
      <div className="flex-1 flex flex-col min-h-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        {/* Copy Mode Banner */}
        {copySourceIndex !== null && (
          <div className="flex-shrink-0 mb-3 flex items-center justify-center">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              <span className="font-semibold text-sm">
                Tap any circle to paste sticker #{copySourceIndex + 1}
              </span>
              <button
                onClick={handleExitCopyMode}
                className="ml-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Sticker Sheet - compact when in selection mode */}
        <div
          className={`
            flex-shrink-0 transition-all duration-500 ease-in-out
            ${viewMode === "selection" ? "transform scale-[0.6] origin-top -mb-20" : ""}
          `}
        >
          <StickerSheet
            slots={slots}
            selectedIndex={selectedSlotIndex}
            isCompact={viewMode === "selection"}
            onSlotClick={handleSlotClick}
            onSlotClear={handleSlotClear}
            onSlotEdit={handleSlotEdit}
            onSlotCopy={handleSlotCopy}
            copySourceIndex={copySourceIndex}
          />
        </div>

        {/* Print button - below the sheet */}
        {viewMode === "initial" && (
          <div className="flex-shrink-0 mt-4 mb-4">
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
                  px-6
                  py-3
                  rounded-xl
                  font-semibold
                  text-base
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
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Printing...</span>
                  </>
                ) : (
                  <>
                    <PrinterIcon className="w-5 h-5" />
                    <span>Print Sticker Sheet • ${STICKER_SHEET_PRICE.toFixed(2)}</span>
                  </>
                )}
              </button>
              {filledSlotsCount === 0 && (
                <p className="text-center text-xs text-gray-500 mt-1.5">
                  Tap a circle to add stickers
                </p>
              )}
            </div>
          </div>
        )}

        {/* Carousel - only show in initial mode */}
        {viewMode === "initial" && (
          <div className="flex-shrink-0 mt-2">
            <StickerCarousel
              stickers={carouselStickers}
              isLoading={isLoadingStickers}
            />
          </div>
        )}

        {/* Gallery - takes the rest of the screen in selection mode */}
        {viewMode === "selection" && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-lg border border-gray-200 p-4 flex flex-col overflow-hidden">
            <StickerGallery
              onSelectSticker={handleSelectSticker}
              onClose={handleGalleryClose}
            />
          </div>
        )}
      </div>

      {/* Sticker Editor Modal - using same Pintura as greeting cards */}
      {showEditor && editorImageSrc && (
        <PinturaEditorModal
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
