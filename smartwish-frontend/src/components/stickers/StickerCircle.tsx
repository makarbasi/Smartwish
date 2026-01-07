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
  /** When true, circle fills its container (used for exact paper positioning) */
  useFullSize?: boolean;
}

export default function StickerCircle({
  index,
  imageUrl,
  isSelected,
  isCompact,
  onClick,
  onClear,
  onEdit,
  useFullSize = false,
}: StickerCircleProps) {
  const hasImage = !!imageUrl && imageUrl.length > 0;

  // Size based on mode - full size fills container, otherwise use fixed sizes
  const sizeClasses = useFullSize 
    ? "w-full h-full" 
    : isCompact 
      ? "w-16 h-16 md:w-20 md:h-20" 
      : "w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48";
  
  // Icon and button sizes scale with compact mode
  const iconSizeClasses = isCompact || useFullSize ? "w-1/3 h-1/3 min-w-4 min-h-4" : "w-10 h-10 md:w-12 md:h-12";
  const plusIconClasses = isCompact || useFullSize ? "w-1/2 h-1/2" : "w-6 h-6 md:w-8 md:h-8";
  const numberSize = isCompact || useFullSize ? "text-[8px] md:text-xs" : "text-sm";
  const numberPosition = isCompact || useFullSize ? "-top-0.5 -left-0.5" : "-top-2 -left-2";
  const numberDimensions = isCompact || useFullSize ? "w-4 h-4 md:w-5 md:h-5" : "w-7 h-7";
  const buttonSize = isCompact || useFullSize ? "w-4 h-4 md:w-5 md:h-5" : "w-6 h-6";
  const buttonIconSize = isCompact || useFullSize ? "w-2 h-2 md:w-3 md:h-3" : "w-4 h-4";
  const buttonPosition = isCompact || useFullSize ? "-1px" : "-8px";

  return (
    <div className={`relative group ${useFullSize ? "w-full h-full" : ""}`}>
      <button
        onClick={onClick}
        className={`
          ${sizeClasses}
          rounded-full
          overflow-hidden
          border-2
          transition-all
          duration-300
          flex
          items-center
          justify-center
          relative
          ${useFullSize ? "aspect-square" : ""}
          ${
            isSelected
              ? "border-pink-500 ring-4 ring-pink-200 shadow-lg shadow-pink-200/50"
              : hasImage
              ? "border-gray-300 hover:border-pink-400 hover:shadow-md bg-white"
              : "border-dashed border-gray-300 hover:border-pink-400 bg-gray-50 hover:bg-pink-50"
          }
        `}
      >
        {hasImage ? (
          <Image
            src={imageUrl}
            alt={`Sticker ${index + 1}`}
            fill
            className="object-cover rounded-full"
            sizes="(max-width: 768px) 128px, 192px"
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full">
            {/* Glowing + icon */}
            <div
              className={`
                ${iconSizeClasses}
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
              <PlusIcon className={plusIconClasses} strokeWidth={2.5} />
            </div>
          </div>
        )}

        {/* Circle number indicator */}
        <div
          className={`
            absolute
            ${numberPosition}
            ${numberDimensions}
            rounded-full
            bg-gray-800
            text-white
            ${numberSize}
            font-bold
            flex
            items-center
            justify-center
            shadow-md
            z-10
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
            ${buttonSize}
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
            z-10
          `}
          style={{
            bottom: buttonPosition,
            right: buttonPosition,
          }}
        >
          <PencilIcon className={buttonIconSize} strokeWidth={2.5} />
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
            ${buttonSize}
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
            z-10
          `}
          style={{
            top: buttonPosition,
            right: buttonPosition,
          }}
        >
          <XMarkIcon className={buttonIconSize} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
