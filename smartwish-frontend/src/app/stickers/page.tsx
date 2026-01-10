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
import CardPaymentModal from "@/components/CardPaymentModal";
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
  const { config: kioskConfig, kioskInfo } = useKiosk();

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

  // Fetch stickers for carousel - get all 200 for variety across 4 rows
  const { data: stickersData, isLoading: isLoadingStickers } = useSWR<StickersApiResponse>(
    "/api/stickers?limit=200",
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

  // Handle print button click - generate JPG and open payment modal
  const handlePrintClick = async () => {
    if (filledSlotsCount === 0) {
      console.log("⚠️ Please add at least one sticker before printing.");
      return;
    }
    
    setIsPrinting(true);
    try {
      // Generate JPG (no PDF for stickers)
      await generateStickerJPGOnly();
      setIsPrinting(false);
      
      // Also open the payment modal for payment flow
      setShowPaymentModal(true);
    } catch (error) {
      console.error("❌ Error generating JPG:", error);
      setIsPrinting(false);
    }
  };

  // Handle payment success
  const handlePaymentSuccess = async () => {
    setIsPrinting(true);
    
    try {
      // Generate JPG and print
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
      
      console.log("✅ Your sticker sheet is printing!");
    } catch (error) {
      console.error("❌ Print error:", error);
      setIsPrinting(false);
    }
  };

  // Generate JPG only (no PDF) - returns blob for printing
  const generateStickerJPGOnly = async (): Promise<Blob> => {
    console.log("🖼️ Generating sticker sheet JPG...");

    // Exact specifications for JPG
    const IMAGE_WIDTH = 1275; // pixels
    const IMAGE_HEIGHT = 1650; // pixels
    const DPI = 150;
    // Sticker size: 2.5 inches at 150 DPI = 375px
    const CIRCLE_DIAMETER_PX = 375; // 2.5 in × 150 dpi = 375 px
    const CIRCLE_RADIUS_PX = CIRCLE_DIAMETER_PX / 2;

    // Exact center coordinates for each circle (in pixels, top-left origin)
    const CIRCLE_CENTERS = [
      [318.5, 318.5],   // Row 1, Top-Left
      [956.5, 318.5],   // Row 1, Top-Right
      [318.5, 825.0],   // Row 2, Middle-Left
      [956.5, 825.0],   // Row 2, Middle-Right
      [318.5, 1331.5],  // Row 3, Bottom-Left
      [956.5, 1331.5],  // Row 3, Bottom-Right
    ];

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

    // Create canvas with exact dimensions
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_WIDTH;
    canvas.height = IMAGE_HEIGHT;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Fill white background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each sticker on the canvas
    for (let i = 0; i < 6; i++) {
      const imageData = imageBase64Array[i];
      const [centerX, centerY] = CIRCLE_CENTERS[i];

      if (imageData) {
        try {
          // Load image
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = imageData;
          });

          // Calculate aspect ratio
          const imgAspect = img.width / img.height;

          // Calculate scale factor to fit within 375px circle (2.5 inches at 150 DPI)
          // Both width and height must fit within the circle diameter
          // Image should be centered at (centerX, centerY)
          let drawWidth: number;
          let drawHeight: number;
          let drawX: number;
          let drawY: number;

          if (imgAspect > 1) {
            // Image is wider than tall - fit to width (375px) to ensure it fits
            // This ensures width = 375px and height < 375px
            drawWidth = CIRCLE_DIAMETER_PX;
            drawHeight = CIRCLE_DIAMETER_PX / imgAspect;
            drawX = centerX - drawWidth / 2; // Center horizontally at circle center
            drawY = centerY - drawHeight / 2; // Center vertically at circle center
          } else {
            // Image is taller than wide or square - fit to height (375px) to ensure it fits
            // This ensures height = 375px and width < 375px
            drawHeight = CIRCLE_DIAMETER_PX;
            drawWidth = CIRCLE_DIAMETER_PX * imgAspect;
            drawX = centerX - drawWidth / 2; // Center horizontally at circle center
            drawY = centerY - drawHeight / 2; // Center vertically at circle center
          }

          // Draw image perfectly centered in the 3" circle
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        } catch (error) {
          console.error(`Error adding sticker ${i + 1} to JPG:`, error);
        }
      }
    }

    // Convert canvas to JPG blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to convert canvas to blob"));
            return;
          }
          console.log(`✅ JPG generated successfully`);
          resolve(blob);
        },
        "image/jpeg",
        0.95 // High quality (95%)
      );
    });
  };

  // Generate and save sticker sheet PDF and JPG
  const generateStickerPDF = async () => {
    console.log("📄 Generating sticker sheet PDF and JPG...");

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

    // Generate timestamp for filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    // Create PDF with letter size in inches
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: "letter",
    });

    // Add each sticker to the PDF
    for (let i = 0; i < 6; i++) {
      const imageData = imageBase64Array[i];
      const [centerX, centerY] = CIRCLE_POSITIONS[i];

      if (imageData) {
        try {
          // Load image to get dimensions for proper centering
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = imageData;
          });

          // Calculate aspect ratio
          const imgAspect = img.width / img.height;
          
          // Calculate scale factor to fit within 3" circle
          // Both width and height must fit within the 3" diameter
          // Scale based on the larger dimension to ensure both fit
          let drawWidth: number;
          let drawHeight: number;
          let x: number;
          let y: number;

          if (imgAspect > 1) {
            // Image is wider than tall - fit to width (3") to ensure it fits
            // This ensures width = 3" and height < 3"
            drawWidth = STICKER_DIAMETER;
            drawHeight = STICKER_DIAMETER / imgAspect;
            x = centerX - drawWidth / 2; // Center horizontally at circle center
            y = centerY - drawHeight / 2; // Center vertically at circle center
          } else {
            // Image is taller than wide or square - fit to height (3") to ensure it fits
            // This ensures height = 3" and width < 3"
            drawHeight = STICKER_DIAMETER;
            drawWidth = STICKER_DIAMETER * imgAspect;
            x = centerX - drawWidth / 2; // Center horizontally at circle center
            y = centerY - drawHeight / 2; // Center vertically at circle center
          }

          // Add the image perfectly centered in the 3" circle
          pdf.addImage(
            imageData,
            "PNG",
            x,
            y,
            drawWidth,
            drawHeight
          );
        } catch (error) {
          console.error(`Error adding sticker ${i + 1} to PDF:`, error);
        }
      }
    }

    // Save the PDF
    const pdfFilename = `sticker-sheet-${timestamp}.pdf`;
    pdf.save(pdfFilename);
    console.log(`✅ PDF saved as ${pdfFilename}`);

    // Generate JPG from canvas using exact pixel coordinates
    await generateStickerJPG(imageBase64Array, timestamp);
  };

  // Generate and save sticker sheet JPG
  // Uses exact pixel coordinates: 1275 × 1650 px at 150 DPI
  const generateStickerJPG = async (
    imageBase64Array: (string | null)[],
    timestamp: string
  ) => {
    console.log("🖼️ Generating sticker sheet JPG...");

    // Exact specifications for JPG
    const IMAGE_WIDTH = 1275; // pixels
    const IMAGE_HEIGHT = 1650; // pixels
    const DPI = 150;
    // Sticker size: 2.5 inches at 150 DPI = 375px
    const CIRCLE_DIAMETER_PX = 375; // 2.5 in × 150 dpi = 375 px
    const CIRCLE_RADIUS_PX = CIRCLE_DIAMETER_PX / 2;

    // Exact center coordinates for each circle (in pixels, top-left origin)
    const CIRCLE_CENTERS = [
      [318.5, 318.5],   // Row 1, Top-Left
      [956.5, 318.5],   // Row 1, Top-Right
      [318.5, 825.0],   // Row 2, Middle-Left
      [956.5, 825.0],   // Row 2, Middle-Right
      [318.5, 1331.5],  // Row 3, Bottom-Left
      [956.5, 1331.5],  // Row 3, Bottom-Right
    ];

    // Create canvas with exact dimensions
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_WIDTH;
    canvas.height = IMAGE_HEIGHT;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error("Failed to get canvas context");
      return;
    }

    // Fill white background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each sticker on the canvas
    for (let i = 0; i < 6; i++) {
      const imageData = imageBase64Array[i];
      const [centerX, centerY] = CIRCLE_CENTERS[i];

      if (imageData) {
        try {
          // Load image
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = imageData;
          });

          // Calculate aspect ratio
          const imgAspect = img.width / img.height;

          // Calculate scale factor to fit within 375px circle (2.5 inches at 150 DPI)
          // Both width and height must fit within the circle diameter
          // Image should be centered at (centerX, centerY)
          let drawWidth: number;
          let drawHeight: number;
          let drawX: number;
          let drawY: number;

          if (imgAspect > 1) {
            // Image is wider than tall - fit to width (375px) to ensure it fits
            // This ensures width = 375px and height < 375px
            drawWidth = CIRCLE_DIAMETER_PX;
            drawHeight = CIRCLE_DIAMETER_PX / imgAspect;
            drawX = centerX - drawWidth / 2; // Center horizontally at circle center
            drawY = centerY - drawHeight / 2; // Center vertically at circle center
          } else {
            // Image is taller than wide or square - fit to height (375px) to ensure it fits
            // This ensures height = 375px and width < 375px
            drawHeight = CIRCLE_DIAMETER_PX;
            drawWidth = CIRCLE_DIAMETER_PX * imgAspect;
            drawX = centerX - drawWidth / 2; // Center horizontally at circle center
            drawY = centerY - drawHeight / 2; // Center vertically at circle center
          }

          // Draw image perfectly centered in the circle
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        } catch (error) {
          console.error(`Error adding sticker ${i + 1} to JPG:`, error);
        }
      }
    }

    // Convert canvas to JPG blob
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error("Failed to convert canvas to blob");
          return;
        }

        // Create download link for JPG
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `sticker-sheet-${timestamp}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log(`✅ JPG saved as sticker-sheet-${timestamp}.jpg`);
      },
      "image/jpeg",
      0.95 // High quality (95%)
    );
  };

  // Print sticker sheet function - generates JPG and sends to backend for IPP printing
  const printStickerSheet = async () => {
    // Get printer name from kiosk config (must be set in /admin/kiosks)
    if (!kioskConfig?.printerName) {
      console.error('❌ Printer not configured. Please set printer name in /admin/kiosks');
      return;
    }
    const printerName = kioskConfig.printerName;
    
    console.log(`🖨️ Generating JPG and sending to printer: ${printerName}`);

    // Generate JPG blob
    const jpgBlob = await generateStickerJPGOnly();

    // Convert blob to base64 for sending to backend
    const base64Jpg = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(jpgBlob);
    });

    // Send to backend print endpoint for IPP printing
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE || "https://smartwish.onrender.com"}/print-sticker-jpg`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jpgBase64: base64Jpg,
          printerName: printerName,
          kioskId: kioskInfo?.id, // Send kiosk UUID to fetch printer IP from config
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
    <div className="h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 overflow-hidden">
      {/* ==================== PREMIUM HEADER ==================== */}
      <div className="flex-shrink-0 relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600" />
        
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="sticker-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect fill="url(#sticker-dots)" width="100%" height="100%" />
          </svg>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Back button */}
            <button
              onClick={handleBackToHome}
              className="flex items-center gap-2 px-3 py-1.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="font-medium text-sm">Back</span>
            </button>
            
            {/* Title */}
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Sticker Studio
              </h1>
              <p className="text-xs sm:text-sm text-white/70 hidden sm:block">
                Design your custom sticker sheet
              </p>
            </div>
            
            {/* Price badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
              <span className="text-white/70 text-xs">Sheet</span>
              <span className="text-white font-bold">${STICKER_SHEET_PRICE.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 flex flex-col min-h-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 overflow-y-auto">
        
        {/* Copy Mode Banner */}
        {copySourceIndex !== null && (
          <div className="flex-shrink-0 mb-3 flex items-center justify-center">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-5 py-2.5 rounded-full shadow-lg shadow-blue-500/25 flex items-center gap-3">
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

        {/* ==================== STICKER SHEET SECTION ==================== */}
        <div
          className={`
            flex-shrink-0 transition-all duration-500 ease-in-out
            ${viewMode === "selection" ? "transform scale-[0.6] origin-top -mb-20" : ""}
          `}
        >
          {/* Premium card wrapper for the sticker sheet */}
          {viewMode === "initial" && (
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 justify-center">
              {/* Sheet container - LARGER for portrait displays */}
              <div className="relative">
                {/* Decorative glow */}
                <div className="absolute -inset-6 bg-gradient-to-r from-pink-200 via-purple-200 to-indigo-200 rounded-3xl blur-2xl opacity-50" />
                
                <div className="relative bg-white rounded-2xl shadow-2xl p-5 ring-1 ring-gray-100">
                  {/* Make sheet larger on portrait/kiosk displays */}
                  <div className="[&>div]:!w-80 [&>div]:sm:!w-96 [&>div]:lg:!w-[420px]">
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
                </div>
              </div>
              
              {/* Side panel with instructions - NOW VISIBLE on all screens, below on mobile */}
              <div className="flex flex-col gap-4 w-full max-w-sm lg:w-64">
                {/* Progress card - always visible */}
                <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-4 ring-1 ring-pink-100/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Your Progress</span>
                    <span className="text-lg font-bold text-gray-900">{filledSlotsCount}/6</span>
                  </div>
                  <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-600 rounded-full transition-all duration-500"
                      style={{ width: `${(filledSlotsCount / 6) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {filledSlotsCount === 0 ? 'Tap a circle to get started!' : 
                     filledSlotsCount === 6 ? '🎉 Sheet complete! Ready to print!' :
                     `${6 - filledSlotsCount} more sticker${6 - filledSlotsCount === 1 ? '' : 's'} to fill`}
                  </p>
                </div>
                
                {/* How it works - horizontal on mobile, vertical on desktop */}
                <div className="bg-white rounded-xl shadow-md p-4 ring-1 ring-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
                    <span className="w-6 h-6 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">?</span>
                    How it works
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 text-xs lg:text-sm text-gray-600">
                    <div className="flex items-center gap-2 p-2 bg-pink-50/50 rounded-lg">
                      <span className="w-5 h-5 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                      <span>Tap circle to add</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-purple-50/50 rounded-lg">
                      <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                      <span>Browse designs</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-indigo-50/50 rounded-lg">
                      <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                      <span>Edit or copy</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-green-50/50 rounded-lg">
                      <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                      <span>Print instantly!</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Compact view for selection mode */}
          {viewMode === "selection" && (
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
          )}
        </div>

        {/* ==================== PRINT BUTTON ==================== */}
        {viewMode === "initial" && (
          <div className="flex-shrink-0 mt-8 mb-6">
            <div className="max-w-lg mx-auto">
              {/* Button with glow effect - LARGER */}
              <div className="relative group">
                {filledSlotsCount > 0 && (
                  <div className="absolute -inset-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                )}
                <button
                  onClick={handlePrintClick}
                  disabled={filledSlotsCount === 0 || isPrinting}
                  className={`
                    relative w-full flex items-center justify-center gap-4 px-8 py-5 rounded-2xl font-bold text-lg transition-all duration-300
                    ${filledSlotsCount > 0
                      ? "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }
                  `}
                >
                  {isPrinting ? (
                    <>
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Printing...</span>
                    </>
                  ) : (
                    <>
                      <PrinterIcon className="w-6 h-6" />
                      <span>Print Sticker Sheet</span>
                      <span className="ml-2 px-3 py-1 bg-white/20 rounded-full text-base">
                        ${STICKER_SHEET_PRICE.toFixed(2)}
                      </span>
                    </>
                  )}
                </button>
              </div>
              
              {filledSlotsCount === 0 && (
                <p className="text-center text-sm text-gray-500 mt-4 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tap any circle above to add your first sticker
                </p>
              )}
            </div>
          </div>
        )}

        {/* ==================== CAROUSEL SECTION - MULTI-ROW ==================== */}
        {viewMode === "initial" && (
          <div className="flex-1 min-h-0 flex flex-col mt-6">
            {/* Section header */}
            <div className="flex-shrink-0 flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-50 to-purple-50 rounded-full shadow-sm">
                <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="text-sm font-semibold text-gray-700">Popular Designs</span>
              </div>
              <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-purple-200 to-transparent" />
            </div>
            
            {/* Carousel container - multi-row, fills remaining space */}
            <div className="flex-1 flex flex-col justify-center overflow-hidden">
              <StickerCarousel
                stickers={carouselStickers}
                isLoading={isLoadingStickers}
              />
            </div>
            
            {/* Helpful tip */}
            <div className="flex-shrink-0 text-center py-3">
              <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
                Tap a circle above to browse & add stickers
              </p>
            </div>
          </div>
        )}

        {/* ==================== GALLERY (Selection Mode) ==================== */}
        {viewMode === "selection" && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex flex-col overflow-hidden">
            <StickerGallery
              onSelectSticker={handleSelectSticker}
              onClose={handleGalleryClose}
            />
          </div>
        )}
      </div>
      
      {/* ==================== TRUST FOOTER ==================== */}
      {viewMode === "initial" && (
        <div className="flex-shrink-0 py-3 border-t border-gray-100 bg-white/50">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Premium Quality</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Instant Print</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>3" Round Stickers</span>
            </div>
          </div>
        </div>
      )}

      {/* Sticker Editor Modal - using same Pintura as greeting cards */}
      {showEditor && editorImageSrc && (
        <PinturaEditorModal
          imageSrc={editorImageSrc}
          isVisible={showEditor}
          onHide={handleEditorHide}
          onProcess={handleEditorProcess}
        />
      )}

      {/* Payment Modal - Uses shared CardPaymentModal with sticker-specific settings */}
      <CardPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={() => handlePaymentSuccess()}
        cardId={`sticker-sheet-${Date.now()}`}
        cardName="Sticker Sheet"
        action="print"
        productType="stickers"
        stickerCount={filledSlotsCount}
      />
    </div>
  );
}
