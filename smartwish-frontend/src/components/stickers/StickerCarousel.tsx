"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";

export interface StickerItem {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
}

interface StickerCarouselProps {
  stickers: StickerItem[];
  isLoading?: boolean;
}

// Single carousel row component
function CarouselRow({
  stickers,
  speed,
  reverse,
  initialOffset,
  isPaused,
}: {
  stickers: StickerItem[];
  speed: number;
  reverse: boolean;
  initialOffset: number;
  isPaused: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll animation
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || stickers.length === 0) return;

    let animationId: number;
    let scrollPosition = initialOffset;
    const scrollSpeed = speed;
    const direction = reverse ? -1 : 1;

    const animate = () => {
      if (!isPaused && scrollContainer) {
        scrollPosition += scrollSpeed * direction;
        
        // Reset when reaching half (we duplicate items for seamless loop)
        const halfWidth = scrollContainer.scrollWidth / 2;
        if (!reverse && scrollPosition >= halfWidth) {
          scrollPosition = 0;
        } else if (reverse && scrollPosition <= 0) {
          scrollPosition = halfWidth;
        }
        
        scrollContainer.scrollLeft = scrollPosition;
      }
      animationId = requestAnimationFrame(animate);
    };

    // Set initial position
    scrollContainer.scrollLeft = initialOffset;
    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [stickers, isPaused, speed, reverse, initialOffset]);

  // Duplicate stickers for seamless infinite scroll
  const duplicatedStickers = useMemo(() => [...stickers, ...stickers, ...stickers], [stickers]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-x-hidden"
      style={{ scrollBehavior: "auto" }}
    >
      {duplicatedStickers
        .filter((sticker) => sticker.imageUrl && sticker.imageUrl.length > 0)
        .map((sticker, index) => (
        <div
          key={`${sticker.id}-${index}`}
          className="flex-shrink-0 group cursor-pointer"
        >
          {/* Premium sticker preview with glow */}
          <div className="relative">
            {/* Subtle glow on hover */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
            
            {/* Sticker circle */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-gray-100 group-hover:ring-pink-300 transition-all duration-300 shadow-md group-hover:shadow-xl group-hover:scale-110 bg-white flex items-center justify-center">
              <div className="relative" style={{ width: '80%', height: '80%' }}>
                <Image
                  src={sticker.thumbnailUrl || sticker.imageUrl}
                  alt={sticker.title}
                  fill
                  className="object-contain transition-transform duration-300 group-hover:scale-105"
                  sizes="96px"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * StickerCarousel - Multi-row animated carousel showing available stickers
 * Multiple rows with different speeds and directions for dynamic effect
 */
export default function StickerCarousel({
  stickers,
  isLoading = false,
}: StickerCarouselProps) {
  const [isPaused, setIsPaused] = useState(false);

  // Row configurations: speed, reverse direction, initial offset (stagger)
  const rowConfigs = useMemo(() => [
    { speed: 0.4, reverse: false, offsetMultiplier: 0 },
    { speed: 0.6, reverse: true, offsetMultiplier: 0.25 },
    { speed: 0.35, reverse: false, offsetMultiplier: 0.5 },
    { speed: 0.55, reverse: true, offsetMultiplier: 0.75 },
  ], []);

  // Distribute stickers across rows for maximum variety
  // With 200 stickers, each row gets ~50 unique stickers
  const rowStickers = useMemo(() => {
    if (stickers.length === 0) return [[], [], [], []];
    
    const numRows = rowConfigs.length;
    const stickersPerRow = Math.ceil(stickers.length / numRows);
    
    return rowConfigs.map((_, rowIndex) => {
      // Each row gets a different slice of stickers
      const startIdx = rowIndex * stickersPerRow;
      const endIdx = Math.min(startIdx + stickersPerRow, stickers.length);
      const rowSlice = stickers.slice(startIdx, endIdx);
      
      // Shuffle within the slice for variety
      const shuffled = [...rowSlice];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = (i + rowIndex * 13 + 7) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      return shuffled;
    });
  }, [stickers, rowConfigs]);

  if (isLoading) {
    return (
      <div className="w-full py-4 space-y-4">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex gap-4 justify-center">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-20 h-20 rounded-full bg-gray-200 animate-pulse flex-shrink-0"
                style={{ animationDelay: `${(row * 8 + i) * 50}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (stickers.length === 0) {
    return null;
  }

  return (
    <div
      className="w-full py-2 overflow-hidden relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Premium gradient fades on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-20 sm:w-32 bg-gradient-to-r from-slate-50 via-slate-50/95 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 sm:w-32 bg-gradient-to-l from-slate-50 via-slate-50/95 to-transparent z-10 pointer-events-none" />

      {/* Multiple carousel rows */}
      <div className="space-y-3 sm:space-y-4">
        {rowConfigs.map((config, rowIndex) => (
          <CarouselRow
            key={rowIndex}
            stickers={rowStickers[rowIndex]}
            speed={config.speed}
            reverse={config.reverse}
            initialOffset={config.offsetMultiplier * 500}
            isPaused={isPaused}
          />
        ))}
      </div>
    </div>
  );
}
