"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";

export type SlotMode = "sticker" | "upload" | "gift-card";

interface StickerSlotModeSelectorProps {
  slotIndex: number;
  onSelectMode: (mode: SlotMode) => void;
  onClose: () => void;
  hasGiftCard?: boolean; // Whether a gift card is already selected
}

/**
 * StickerSlotModeSelector - Modal for choosing between existing stickers, phone upload, or gift card
 * Displays three options:
 * - Mode A: Browse existing sticker designs
 * - Mode B: Upload a photo from phone via QR code
 * - Mode C: Add a gift card (QR code + logo)
 */
export default function StickerSlotModeSelector({
  slotIndex,
  onSelectMode,
  onClose,
  hasGiftCard = false,
}: StickerSlotModeSelectorProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold">Sticker #{slotIndex + 1}</h2>
          <p className="text-white/80 mt-1">How would you like to add your sticker?</p>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4">
          {/* Mode A: Browse Stickers */}
          <button
            onClick={() => onSelectMode("sticker")}
            className="w-full p-5 bg-gradient-to-br from-pink-50 to-purple-50 hover:from-pink-100 hover:to-purple-100 rounded-2xl border-2 border-pink-200 hover:border-pink-400 transition-all group text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-pink-600 transition-colors">
                  Browse Designs
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Choose from hundreds of beautiful pre-made sticker designs
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2 py-1 bg-pink-100 text-pink-600 text-xs font-medium rounded-full">
                    ✨ Recommended
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    Instant
                  </span>
                </div>
              </div>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-pink-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Mode B: Upload from Phone */}
          <button
            onClick={() => onSelectMode("upload")}
            className="w-full p-5 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-2xl border-2 border-blue-200 hover:border-blue-400 transition-all group text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                  Upload from Phone
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Scan a QR code to upload your own photo from your phone
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">
                    📷 Your Photos
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    Camera or Gallery
                  </span>
                </div>
              </div>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Mode C: Add Gift Card */}
          <button
            onClick={() => onSelectMode("gift-card")}
            className={`w-full p-5 bg-gradient-to-br rounded-2xl border-2 transition-all group text-left ${
              hasGiftCard
                ? "from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-green-300 hover:border-green-400"
                : "from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border-amber-200 hover:border-amber-400"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg ${
                hasGiftCard
                  ? "bg-gradient-to-br from-green-500 to-emerald-600"
                  : "bg-gradient-to-br from-amber-400 to-orange-500"
              }`}>
                <span className="text-2xl">🎁</span>
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold transition-colors ${
                  hasGiftCard
                    ? "text-gray-800 group-hover:text-green-600"
                    : "text-gray-800 group-hover:text-amber-600"
                }`}>
                  {hasGiftCard ? "Change Gift Card" : "Add Gift Card"}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {hasGiftCard
                    ? "Change or remove your attached gift card"
                    : "Add a gift card with QR code & store logo"}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {hasGiftCard ? (
                    <span className="px-2 py-1 bg-green-100 text-green-600 text-xs font-medium rounded-full">
                      ✓ Gift Card Attached
                    </span>
                  ) : (
                    <>
                      <span className="px-2 py-1 bg-amber-100 text-amber-600 text-xs font-medium rounded-full">
                        🎁 500+ Brands
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                        Amazon, Target & more
                      </span>
                    </>
                  )}
                </div>
              </div>
              <svg className={`w-6 h-6 group-hover:translate-x-1 transition-all flex-shrink-0 mt-4 ${
                hasGiftCard
                  ? "text-gray-400 group-hover:text-green-500"
                  : "text-gray-400 group-hover:text-amber-500"
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Footer hint */}
        <div className="px-6 pb-6">
          <p className="text-center text-xs text-gray-400">
            Tap an option to continue
          </p>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
