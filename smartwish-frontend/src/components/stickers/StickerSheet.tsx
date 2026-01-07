"use client";

import StickerCircle from "./StickerCircle";

export interface StickerSlot {
  id: number;
  imageUrl: string | null;
  editedImageBlob: Blob | null;
  originalImageUrl?: string | null;
}

interface StickerSheetProps {
  slots: StickerSlot[];
  selectedIndex: number | null;
  isCompact: boolean;
  onSlotClick: (index: number) => void;
  onSlotClear: (index: number) => void;
  onSlotEdit?: (index: number) => void;
  onSlotCopy?: (index: number) => void;
  copySourceIndex?: number | null;
}

/**
 * StickerSheet - Displays 6 circular sticker slots in exact Avery 94513 layout
 * 
 * Avery 94513 specifications:
 * - Paper: Letter (8.5" x 11") - aspect ratio 0.7727
 * - 6 stickers per sheet
 * - Sticker diameter: 3 inches (35.29% of paper width, 27.27% of paper height)
 * - Layout: 2 columns x 3 rows
 * 
 * Precise positioning (as % of paper dimensions):
 * - Column 1 center: 32.35% from left
 * - Column 2 center: 67.65% from left  
 * - Row 1 center: 18.18% from top
 * - Row 2 center: 50% from top
 * - Row 3 center: 81.82% from top
 */

// Avery 94513 exact specifications
const PAPER_WIDTH_INCHES = 8.5;
const PAPER_HEIGHT_INCHES = 11;
const CIRCLE_DIAMETER_INCHES = 3;

// Calculate circle size as percentage of paper width
// This will be used with aspect-ratio: 1/1 to ensure perfect circles
const CIRCLE_SIZE_PERCENT = (CIRCLE_DIAMETER_INCHES / PAPER_WIDTH_INCHES) * 100; // 35.29%

// Column positions (center X as % of width)
const COL_1_CENTER = ((1.25 + 1.5) / PAPER_WIDTH_INCHES) * 100; // 32.35%
const COL_2_CENTER = ((PAPER_WIDTH_INCHES - 1.25 - 1.5) / PAPER_WIDTH_INCHES) * 100; // 67.65%

// Row positions (center Y as % of height)
// Adjusted for better vertical spacing - slightly more margin
const TOP_MARGIN = 0.75; // inches
const VERTICAL_PITCH = 3.5; // inches between row centers (3" circle + 0.5" gap)
const ROW_1_CENTER = ((TOP_MARGIN + 1.5) / PAPER_HEIGHT_INCHES) * 100; // ~20.45%
const ROW_2_CENTER = ((TOP_MARGIN + 1.5 + VERTICAL_PITCH) / PAPER_HEIGHT_INCHES) * 100; // ~52.27%
const ROW_3_CENTER = ((TOP_MARGIN + 1.5 + VERTICAL_PITCH * 2) / PAPER_HEIGHT_INCHES) * 100; // ~84.09%

// Circle positions: [colCenter, rowCenter] for each of 6 slots
const CIRCLE_POSITIONS = [
  [COL_1_CENTER, ROW_1_CENTER], // Slot 0: top-left
  [COL_2_CENTER, ROW_1_CENTER], // Slot 1: top-right
  [COL_1_CENTER, ROW_2_CENTER], // Slot 2: middle-left
  [COL_2_CENTER, ROW_2_CENTER], // Slot 3: middle-right
  [COL_1_CENTER, ROW_3_CENTER], // Slot 4: bottom-left
  [COL_2_CENTER, ROW_3_CENTER], // Slot 5: bottom-right
];

export default function StickerSheet({
  slots,
  selectedIndex,
  isCompact,
  onSlotClick,
  onSlotClear,
  onSlotEdit,
  onSlotCopy,
  copySourceIndex = null,
}: StickerSheetProps) {
  // Ensure we always have 6 slots
  const normalizedSlots = Array.from({ length: 6 }, (_, i) => slots[i] || {
    id: i,
    imageUrl: null,
    editedImageBlob: null,
  });

  return (
    <div className="flex flex-col items-center">
      {/* Paper preview header */}
      {!isCompact && (
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Sticker Sheet Preview</h3>
          <p className="text-sm text-gray-500 mt-1">
            6 round stickers • 3" diameter each • Avery 94513 compatible
          </p>
        </div>
      )}

      {/* Paper container with exact letter aspect ratio */}
      <div
        className={`
          relative
          bg-white
          rounded-lg
          shadow-lg
          border-2
          border-gray-300
          transition-all
          duration-500
          ease-in-out
          ${isCompact ? "w-48 md:w-56" : "w-72 md:w-80 lg:w-96"}
        `}
        style={{
          aspectRatio: `${PAPER_WIDTH_INCHES} / ${PAPER_HEIGHT_INCHES}`,
        }}
      >
        {/* Paper texture/pattern hint */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white rounded-lg opacity-50" />
        
        {/* Sticker circles - absolutely positioned with perfect 1:1 aspect ratio */}
        {normalizedSlots.map((slot, index) => {
          const [centerX, centerY] = CIRCLE_POSITIONS[index];
          
          return (
            <div
              key={slot.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${centerX}%`,
                top: `${centerY}%`,
                width: `${CIRCLE_SIZE_PERCENT}%`,
                aspectRatio: '1 / 1', // Ensures perfect circle
              }}
            >
              <StickerCircle
                index={index}
                imageUrl={slot.imageUrl}
                isSelected={selectedIndex === index}
                isCompact={isCompact}
                onClick={() => onSlotClick(index)}
                onClear={() => onSlotClear(index)}
                onEdit={onSlotEdit ? () => onSlotEdit(index) : undefined}
                onCopy={onSlotCopy ? () => onSlotCopy(index) : undefined}
                isCopySource={copySourceIndex === index}
                isCopyTarget={copySourceIndex !== null && copySourceIndex !== index}
                useFullSize
              />
            </div>
          );
        })}

        {/* Corner markers to indicate paper edges */}
        <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-gray-300 rounded-tl" />
        <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-gray-300 rounded-tr" />
        <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-gray-300 rounded-bl" />
        <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-gray-300 rounded-br" />
      </div>

      {/* Filled count indicator */}
      <div className={`text-center ${isCompact ? "mt-2" : "mt-4"}`}>
        <span className="text-sm text-gray-500">
          {normalizedSlots.filter((s) => s.imageUrl).length} of 6 stickers filled
        </span>
      </div>
    </div>
  );
}
