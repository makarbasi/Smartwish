"use client";

import { PlusIcon, XMarkIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import Image from "next/image";

interface StickerCircleProps {
  index: number;
  imageUrl: string | null;
  isSelected: boolean;
  isCompact: boolean;
  onClick: () => void;
  onClear?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  /** This circle is the source being copied from */
  isCopySource?: boolean;
  /** Another circle is being copied, this is a potential paste target */
  isCopyTarget?: boolean;
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
  onCopy,
  isCopySource = false,
  isCopyTarget = false,
  useFullSize = false,
}: StickerCircleProps) {
  const hasImage = !!imageUrl && imageUrl.length > 0;
  const showActions = hasImage && !isCopySource && !isCopyTarget;

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

  // Determine border/ring styling based on state
  const getBorderClasses = () => {
    if (isCopySource) {
      return "border-blue-500 ring-4 ring-blue-200 shadow-lg shadow-blue-200/50";
    }
    if (isCopyTarget) {
      return "border-cyan-400 border-dashed ring-2 ring-cyan-200 animate-pulse";
    }
    if (isSelected) {
      return "border-pink-500 ring-4 ring-pink-200 shadow-lg shadow-pink-200/50";
    }
    if (hasImage) {
      return "border-gray-200 bg-white shadow-md";
    }
    return "border-dashed border-gray-300 bg-gray-50";
  };

  return (
    <div className={`relative ${useFullSize ? "w-full h-full" : ""} flex flex-col items-center`}>
      {/* Copy source indicator badge */}
      {isCopySource && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md">
          Copying
        </div>
      )}

      {/* Main circle button */}
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
          ${getBorderClasses()}
          ${!hasImage && !isCopyTarget && "active:scale-95"}
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
                ${!isSelected && !isCopyTarget && "animate-pulse"}
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

      {/* Action bar - always visible when has image, positioned below circle */}
      {showActions && (
        <div 
          className={`
            flex items-center justify-center gap-1.5
            ${useFullSize ? "absolute -bottom-1 left-1/2 transform -translate-x-1/2" : "mt-2"}
            bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200
            px-2 py-1.5
            z-20
          `}
        >
          {/* Edit button - matches greeting card style */}
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="
                w-8 h-8
                rounded-full
                bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500
                text-white
                flex items-center justify-center
                active:scale-90
                transition-all duration-200
              "
              style={{
                boxShadow: '0 2px 10px rgba(124,58,237,0.4), 0 0 15px rgba(124,58,237,0.2)'
              }}
              title="Edit"
            >
              <svg
                className="w-4 h-4 text-white"
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
          )}

          {/* Copy button */}
          {onCopy && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className="
                w-8 h-8
                rounded-full
                bg-gradient-to-br from-blue-500 to-cyan-500
                text-white
                flex items-center justify-center
                active:scale-90
                transition-all duration-200
              "
              style={{
                boxShadow: '0 2px 10px rgba(59,130,246,0.4), 0 0 15px rgba(59,130,246,0.2)'
              }}
              title="Copy to other slots"
            >
              <DocumentDuplicateIcon className="w-4 h-4" strokeWidth={2} />
            </button>
          )}

          {/* Delete button */}
          {onClear && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="
                w-8 h-8
                rounded-full
                bg-gradient-to-br from-gray-500 to-gray-600
                text-white
                flex items-center justify-center
                active:scale-90
                transition-all duration-200
              "
              style={{
                boxShadow: '0 2px 10px rgba(107,114,128,0.4)'
              }}
              title="Remove"
            >
              <XMarkIcon className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
