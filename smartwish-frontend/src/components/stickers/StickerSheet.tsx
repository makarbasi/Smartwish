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
}

/**
 * StickerSheet - Displays 6 circular sticker slots in Avery Presta 94513 layout
 * 
 * Avery 94513 specifications:
 * - Paper: Letter (8.5" x 11")
 * - 6 stickers per sheet
 * - Sticker diameter: 3 inches
 * - Layout: 2 columns x 3 rows
 * - Margins: ~0.75" top/bottom, ~1.25" left/right
 * - Gap: ~0.5" between stickers
 */
export default function StickerSheet({
  slots,
  selectedIndex,
  isCompact,
  onSlotClick,
  onSlotClear,
  onSlotEdit,
}: StickerSheetProps) {
  // Ensure we always have 6 slots
  const normalizedSlots = Array.from({ length: 6 }, (_, i) => slots[i] || {
    id: i,
    imageUrl: null,
    editedImageBlob: null,
  });

  return (
    <div
      className={`
        bg-white
        rounded-2xl
        shadow-lg
        border
        border-gray-200
        transition-all
        duration-500
        ease-in-out
        ${isCompact ? "p-4" : "p-6 md:p-8 lg:p-10"}
      `}
    >
      {/* Paper preview header */}
      {!isCompact && (
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Sticker Sheet Preview</h3>
          <p className="text-sm text-gray-500 mt-1">
            6 round stickers • 3" diameter each • Avery 94513 compatible
          </p>
        </div>
      )}

      {/* Sticker grid - 2 columns x 3 rows */}
      <div
        className={`
          grid
          grid-cols-2
          ${isCompact ? "gap-3 md:gap-4" : "gap-6 md:gap-8 lg:gap-10"}
          justify-items-center
          ${isCompact ? "" : "max-w-md mx-auto"}
        `}
      >
        {normalizedSlots.map((slot, index) => (
          <StickerCircle
            key={slot.id}
            index={index}
            imageUrl={slot.imageUrl}
            isSelected={selectedIndex === index}
            isCompact={isCompact}
            onClick={() => onSlotClick(index)}
            onClear={() => onSlotClear(index)}
            onEdit={onSlotEdit ? () => onSlotEdit(index) : undefined}
          />
        ))}
      </div>

      {/* Filled count indicator */}
      <div className={`text-center ${isCompact ? "mt-3" : "mt-6"}`}>
        <span className="text-sm text-gray-500">
          {normalizedSlots.filter((s) => s.imageUrl).length} of 6 stickers filled
        </span>
      </div>
    </div>
  );
}
