"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

interface GiftCardData {
  storeName: string;
  storeLogo?: string;
  amount: number;
  qrCode?: string;
  redemptionLink?: string;
  status?: 'pending' | 'issued';
  isIssued?: boolean;
  brandSlug?: string;
}

interface StickerGiftCardSlotProps {
  index: number;
  giftCardData: GiftCardData;
  pendingQrCode?: string;
  isSelected: boolean;
  isCompact: boolean;
  onClick: () => void;
  onClear?: () => void;
  useFullSize?: boolean;
}

/**
 * StickerGiftCardSlot - Displays a gift card (QR code + logo) inside a sticker circle
 * Shows pending QR code before payment, actual QR code after payment
 */
export default function StickerGiftCardSlot({
  index,
  giftCardData,
  pendingQrCode,
  isSelected,
  isCompact,
  onClick,
  onClear,
  useFullSize = false,
}: StickerGiftCardSlotProps) {
  // Check if gift card is pending (not yet issued)
  const isPending = giftCardData.isIssued === false || giftCardData.status === 'pending';
  
  // Get the QR code to display (pending or real)
  const displayQrCode = isPending ? pendingQrCode : giftCardData.qrCode;

  // Size based on mode
  const sizeClasses = useFullSize 
    ? "w-full h-full" 
    : isCompact 
      ? "w-16 h-16 md:w-20 md:h-20" 
      : "w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48";
  
  const numberSize = isCompact || useFullSize ? "text-[8px] md:text-xs" : "text-sm";
  const numberPosition = isCompact || useFullSize ? "-top-0.5 -left-0.5" : "-top-2 -left-2";
  const numberDimensions = isCompact || useFullSize ? "w-4 h-4 md:w-5 md:h-5" : "w-7 h-7";

  // Border styling based on state
  const getBorderClasses = () => {
    if (isSelected) {
      return isPending
        ? "border-amber-500 ring-4 ring-amber-200 shadow-lg shadow-amber-200/50"
        : "border-green-500 ring-4 ring-green-200 shadow-lg shadow-green-200/50";
    }
    return isPending
      ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md"
      : "border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md";
  };

  return (
    <div className={`relative ${useFullSize ? "w-full h-full" : ""} flex flex-col items-center`}>
      {/* Status badge */}
      <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 z-20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md ${
        isPending ? "bg-amber-500" : "bg-green-500"
      }`}>
        {isPending ? "🎁 Pending" : "🎁 Ready"}
      </div>

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
          active:scale-95
        `}
      >
        {/* Gift Card Content - QR Code + Logo */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
          {/* QR Code (takes most of the space) */}
          {displayQrCode ? (
            <div className="relative w-[55%] aspect-square mb-1">
              <img
                src={displayQrCode}
                alt="Gift Card QR Code"
                className={`w-full h-full object-contain rounded-md ${
                  isPending ? "border-2 border-amber-300" : "border-2 border-green-300"
                }`}
              />
            </div>
          ) : (
            <div className="w-[55%] aspect-square mb-1 bg-gray-100 rounded-md flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          {/* Store Logo + Amount */}
          <div className="flex items-center gap-1.5 max-w-[90%]">
            {giftCardData.storeLogo ? (
              <div className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 bg-white rounded-md shadow-sm overflow-hidden">
                <img
                  src={giftCardData.storeLogo}
                  alt={giftCardData.storeName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = '<span class="text-xs">🎁</span>';
                  }}
                />
              </div>
            ) : (
              <span className="text-xs">🎁</span>
            )}
            <div className="flex flex-col items-start min-w-0">
              <span className={`font-bold text-gray-800 truncate max-w-full ${
                useFullSize ? "text-[10px] sm:text-xs" : "text-[8px] sm:text-[10px]"
              }`}>
                ${giftCardData.amount}
              </span>
              <span className={`text-gray-600 truncate max-w-full ${
                useFullSize ? "text-[8px] sm:text-[10px]" : "text-[6px] sm:text-[8px]"
              }`}>
                {giftCardData.storeName}
              </span>
            </div>
          </div>
        </div>

        {/* Circle number indicator */}
        <div
          className={`
            absolute
            ${numberPosition}
            ${numberDimensions}
            rounded-full
            ${isPending ? "bg-amber-600" : "bg-green-600"}
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

      {/* Action bar - remove button */}
      {onClear && (
        <div 
          className={`
            flex items-center justify-center gap-1.5
            ${useFullSize ? "absolute -bottom-1 left-1/2 transform -translate-x-1/2" : "mt-2"}
            bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200
            px-2 py-1.5
            z-20
          `}
        >
          {/* Change button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={`
              w-8 h-8
              rounded-full
              ${isPending 
                ? "bg-gradient-to-br from-amber-500 to-orange-500"
                : "bg-gradient-to-br from-green-500 to-emerald-500"
              }
              text-white
              flex items-center justify-center
              active:scale-90
              transition-all duration-200
            `}
            style={{
              boxShadow: isPending
                ? '0 2px 10px rgba(245,158,11,0.4), 0 0 15px rgba(245,158,11,0.2)'
                : '0 2px 10px rgba(34,197,94,0.4), 0 0 15px rgba(34,197,94,0.2)'
            }}
            title="Change Gift Card"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Delete button */}
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
            title="Remove Gift Card"
          >
            <XMarkIcon className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
