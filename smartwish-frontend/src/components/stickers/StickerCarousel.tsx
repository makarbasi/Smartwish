"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * StickerCarousel - Animated horizontal carousel showing available stickers
 * Auto-scrolls continuously to showcase variety
 */
export default function StickerCarousel({
  stickers,
  isLoading = false,
}: StickerCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-scroll animation
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || stickers.length === 0) return;

    let animationId: number;
    let scrollPosition = 0;
    const scrollSpeed = 0.5; // pixels per frame

    const animate = () => {
      if (!isPaused && scrollContainer) {
        scrollPosition += scrollSpeed;
        
        // Reset when reaching half (we duplicate items for seamless loop)
        const halfWidth = scrollContainer.scrollWidth / 2;
        if (scrollPosition >= halfWidth) {
          scrollPosition = 0;
        }
        
        scrollContainer.scrollLeft = scrollPosition;
      }
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [stickers, isPaused]);

  if (isLoading) {
    return (
      <div className="w-full py-4">
        <div className="flex gap-4 justify-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-20 h-20 rounded-full bg-gray-200 animate-pulse flex-shrink-0"
            />
          ))}
        </div>
      </div>
    );
  }

  if (stickers.length === 0) {
    return null;
  }

  // Duplicate stickers for seamless infinite scroll
  const duplicatedStickers = [...stickers, ...stickers];

  return (
    <div
      className="w-full py-4 overflow-hidden relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Gradient fades on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

      {/* Scrolling container */}
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
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-gray-200 group-hover:border-pink-400 transition-all duration-200 shadow-md group-hover:shadow-lg group-hover:scale-110 relative">
              <Image
                src={sticker.thumbnailUrl || sticker.imageUrl}
                alt={sticker.title}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Label */}
      <div className="text-center mt-3">
        <span className="text-sm text-gray-500">
          Click a circle above to browse and select stickers
        </span>
      </div>
    </div>
  );
}
