"use client";

import { PlusIcon, XMarkIcon, PencilIcon } from "@heroicons/react/24/outline";
import Image from "next/image";

interface StickerCircleProps {
  index: number;
  imageUrl: string | null;
  isSelected: boolean;
  isCompact: boolean;
  onClick: () => void;
  onClear?: () => void;
  onEdit?: () => void;
}

export default function StickerCircle({
  index,
  imageUrl,
  isSelected,
  isCompact,
  onClick,
  onClear,
  onEdit,
}: StickerCircleProps) {
  const hasImage = !!imageUrl && imageUrl.length > 0;

  // Size based on compact mode
  const size = isCompact ? "w-16 h-16 md:w-20 md:h-20" : "w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48";
  const iconSize = isCompact ? "w-6 h-6" : "w-10 h-10 md:w-12 md:h-12";
  const numberSize = isCompact ? "text-xs" : "text-sm";
  const clearButtonSize = isCompact ? "w-5 h-5" : "w-6 h-6";

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`
          ${size}
          rounded-full
          overflow-hidden
          border-2
          transition-all
          duration-300
          flex
          items-center
          justify-center
          relative
          ${
            isSelected
              ? "border-pink-500 ring-4 ring-pink-200 shadow-lg shadow-pink-200/50"
              : hasImage
              ? "border-gray-300 hover:border-pink-400 hover:shadow-md"
              : "border-dashed border-gray-300 hover:border-pink-400 bg-gray-50 hover:bg-pink-50"
          }
        `}
      >
        {hasImage ? (
          <Image
            src={imageUrl}
            alt={`Sticker ${index + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 128px, 192px"
          />
        ) : (
          <div className="flex flex-col items-center justify-center">
            {/* Glowing + icon */}
            <div
              className={`
                ${iconSize}
                rounded-full
                flex
                items-center
                justify-center
                ${isSelected ? "bg-pink-500 text-white" : "bg-gradient-to-br from-pink-400 to-purple-500 text-white"}
                shadow-lg
                ${!isSelected && "animate-pulse"}
              `}
              style={{
                boxShadow: isSelected
                  ? "0 0 20px rgba(236, 72, 153, 0.6)"
                  : "0 0 15px rgba(236, 72, 153, 0.4), 0 0 30px rgba(168, 85, 247, 0.2)",
              }}
            >
              <PlusIcon className={isCompact ? "w-4 h-4" : "w-6 h-6 md:w-8 md:h-8"} strokeWidth={2.5} />
            </div>
          </div>
        )}

        {/* Circle number indicator */}
        <div
          className={`
            absolute
            ${isCompact ? "-top-1 -left-1" : "-top-2 -left-2"}
            ${isCompact ? "w-5 h-5" : "w-7 h-7"}
            rounded-full
            bg-gray-800
            text-white
            ${numberSize}
            font-bold
            flex
            items-center
            justify-center
            shadow-md
          `}
        >
          {index + 1}
        </div>
      </button>

      {/* Edit button - only show when has image */}
      {hasImage && onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className={`
            absolute
            ${isCompact ? "-bottom-1 -right-1" : "-bottom-2 -right-2"}
            ${clearButtonSize}
            rounded-full
            bg-pink-500
            text-white
            flex
            items-center
            justify-center
            opacity-0
            group-hover:opacity-100
            transition-opacity
            duration-200
            hover:bg-pink-600
            shadow-md
          `}
        >
          <PencilIcon className={isCompact ? "w-3 h-3" : "w-4 h-4"} strokeWidth={2.5} />
        </button>
      )}

      {/* Clear button - only show when has image */}
      {hasImage && onClear && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className={`
            absolute
            ${isCompact ? "-top-1 -right-1" : "-top-2 -right-2"}
            ${clearButtonSize}
            rounded-full
            bg-red-500
            text-white
            flex
            items-center
            justify-center
            opacity-0
            group-hover:opacity-100
            transition-opacity
            duration-200
            hover:bg-red-600
            shadow-md
          `}
        >
          <XMarkIcon className={isCompact ? "w-3 h-3" : "w-4 h-4"} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
