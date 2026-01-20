"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon, FireIcon, SparklesIcon, CameraIcon, GiftIcon } from "@heroicons/react/24/solid";
import Image from "next/image";

export type StickerCarouselItem = {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  category?: string;
  popularity?: number;
  tags?: string[];
  // Special item types
  isUploadAction?: boolean;
  isGiftCardHubAction?: boolean; // Opens gift card hub to browse all gift cards
  isGiftCardSticker?: boolean;
  giftCardBrandName?: string;
  giftCardBrandLogo?: string;
};

interface StickerCategoryCarouselProps {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  stickers: StickerCarouselItem[];
  onStickerClick: (sticker: StickerCarouselItem) => void;
  onCategoryClick: (categoryId: string, categoryName: string) => void;
  isLoading?: boolean;
  index?: number;
  isSpecialRow?: boolean; // For the "Quick Actions" row
}

// Category emoji mapping
const STICKER_CATEGORY_ICONS: Record<string, string> = {
  animals: "🐾",
  cats: "🐱",
  dogs: "🐕",
  nature: "🌿",
  flowers: "🌸",
  love: "💕",
  hearts: "❤️",
  birthday: "🎂",
  holidays: "🎄",
  christmas: "🎅",
  halloween: "🎃",
  easter: "🐰",
  thanksgiving: "🦃",
  food: "🍕",
  drinks: "🍹",
  sports: "⚽",
  music: "🎵",
  stars: "⭐",
  emoji: "😊",
  cute: "🥰",
  funny: "😂",
  cool: "😎",
  vintage: "📷",
  retro: "🕹️",
  space: "🚀",
  ocean: "🌊",
  travel: "✈️",
  art: "🎨",
  school: "📚",
  graduation: "🎓",
  "thank you": "🙏",
  congratulations: "🎉",
  "get well": "💐",
  baby: "👶",
  wedding: "💒",
  anniversary: "💑",
  "quick actions": "⚡",
  upload: "📸",
  "gift cards": "🎁",
  default: "✨",
};

function getCategoryIcon(categoryName: string): string {
  const lowerName = categoryName.toLowerCase();
  for (const [key, icon] of Object.entries(STICKER_CATEGORY_ICONS)) {
    if (lowerName.includes(key)) {
      return icon;
    }
  }
  return STICKER_CATEGORY_ICONS.default;
}

export default function StickerCategoryCarousel({
  categoryId,
  categoryName,
  categoryIcon,
  stickers,
  onStickerClick,
  onCategoryClick,
  isLoading = false,
  index = 0,
  isSpecialRow = false,
}: StickerCategoryCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasDragged, setHasDragged] = useState(false); // Track if actual dragging occurred

  // Staggered entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  // Check scroll position
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    
    const maxScroll = scrollWidth - clientWidth;
    setScrollProgress(maxScroll > 0 ? scrollLeft / maxScroll : 0);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollPosition();
    container.addEventListener("scroll", checkScrollPosition);
    
    const resizeObserver = new ResizeObserver(checkScrollPosition);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", checkScrollPosition);
      resizeObserver.disconnect();
    };
  }, [checkScrollPosition, stickers]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.75;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setIsDragging(true);
    setHasDragged(false); // Reset drag flag on new interaction
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
    container.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    
    // Mark as dragged if moved more than 5px
    if (Math.abs(walk) > 5) {
      setHasDragged(true);
    }
    
    container.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    const container = scrollContainerRef.current;
    if (container) container.style.cursor = "grab";
    // Reset hasDragged after a short delay to allow click to process
    setTimeout(() => setHasDragged(false), 50);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setHasDragged(false);
      const container = scrollContainerRef.current;
      if (container) container.style.cursor = "grab";
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setIsDragging(true);
    setHasDragged(false);
    setStartX(e.touches[0].pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const x = e.touches[0].pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    
    // Mark as dragged if moved more than 5px
    if (Math.abs(walk) > 5) {
      setHasDragged(true);
    }
    
    container.scrollLeft = scrollLeft - walk;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTimeout(() => setHasDragged(false), 50);
  };

  // Prevent sticker click when dragging - use hasDragged flag for accurate detection
  const handleStickerClick = (sticker: StickerCarouselItem, e: React.MouseEvent) => {
    // Only block click if user actually dragged
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onStickerClick(sticker);
  };

  // Sort by popularity (highest first) - only for regular stickers
  const sortedStickers = isSpecialRow 
    ? stickers 
    : [...stickers].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // Get max popularity for badge threshold
  const maxPopularity = sortedStickers.length > 0 ? Math.max(...sortedStickers.map(s => s.popularity || 0)) : 0;
  const popularityThreshold = maxPopularity * 0.7;

  const displayIcon = categoryIcon || getCategoryIcon(categoryName);

  // Gradient colors based on whether it's a special row
  const gradientColors = isSpecialRow 
    ? "from-amber-500 via-orange-500 to-red-500"
    : "from-pink-500 via-purple-500 to-indigo-500";

  const shadowColor = isSpecialRow ? "shadow-amber-500/30" : "shadow-pink-500/30";

  return (
    <div 
      className={`relative mb-10 transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between mb-5 px-1">
        <button
          onClick={() => !isSpecialRow && onCategoryClick(categoryId, categoryName)}
          className={`group flex items-center gap-3 transition-all duration-300 ${!isSpecialRow ? 'hover:scale-[1.02]' : ''}`}
          disabled={isSpecialRow}
        >
          {/* Category Icon */}
          <div className="relative">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradientColors} flex items-center justify-center shadow-lg ${shadowColor} ${!isSpecialRow ? 'group-hover:shadow-xl' : ''} transition-shadow duration-300`}>
              <span className="text-2xl">{displayIcon}</span>
            </div>
            {!isSpecialRow && (
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradientColors} opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300`} />
            )}
          </div>
          
          {/* Category Name */}
          <div className="flex flex-col items-start">
            <span className={`text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent ${!isSpecialRow ? 'group-hover:from-pink-600 group-hover:via-purple-600 group-hover:to-indigo-600' : ''} transition-all duration-300`}>
              {categoryName}
            </span>
            {!isSpecialRow && (
              <span className="text-sm text-gray-500 group-hover:text-pink-500 transition-colors flex items-center gap-1">
                View all {stickers.length} stickers
                <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
            )}
            {isSpecialRow && (
              <span className="text-sm text-gray-500">
                Upload photos or add gift cards
              </span>
            )}
          </div>
        </button>

        {/* Sticker Count Badge */}
        {!isSpecialRow && (
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-200/50 shadow-sm">
            <SparklesIcon className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-medium text-gray-700">{stickers.length} stickers</span>
          </div>
        )}
      </div>

      {/* Carousel Container */}
      <div className="relative group/carousel">
        {/* Gradient Fades */}
        <div className={`absolute left-0 top-0 bottom-4 w-20 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute right-0 top-0 bottom-4 w-20 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />

        {/* Navigation Arrows */}
        <button
          onClick={() => scroll("left")}
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${
            canScrollLeft ? 'opacity-0 group-hover/carousel:opacity-100 translate-x-0' : 'opacity-0 pointer-events-none -translate-x-4'
          }`}
          aria-label="Scroll left"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md shadow-xl border border-gray-200/50 flex items-center justify-center hover:bg-white hover:scale-110 hover:shadow-2xl transition-all duration-300">
              <ChevronLeftIcon className="w-6 h-6 text-gray-700" />
            </div>
          </div>
        </button>

        <button
          onClick={() => scroll("right")}
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${
            canScrollRight ? 'opacity-0 group-hover/carousel:opacity-100 translate-x-0' : 'opacity-0 pointer-events-none translate-x-4'
          }`}
          aria-label="Scroll right"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md shadow-xl border border-gray-200/50 flex items-center justify-center hover:bg-white hover:scale-110 hover:shadow-2xl transition-all duration-300">
              <ChevronRightIcon className="w-6 h-6 text-gray-700" />
            </div>
          </div>
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth pb-4 px-1"
          style={{ cursor: "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {isLoading ? (
            // Loading Skeletons - CIRCULAR
            Array(8).fill(0).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="flex-shrink-0 w-32 sm:w-36 md:w-40 lg:w-44 flex flex-col items-center"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-shimmer" />
                </div>
                <div className="mt-3 h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full animate-shimmer w-20" />
              </div>
            ))
          ) : sortedStickers.length === 0 ? (
            <div className="flex-1 py-16 text-center">
              <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50">
                <SparklesIcon className="w-10 h-10 text-gray-300" />
                <p className="text-gray-500 font-medium">No stickers in this category yet</p>
              </div>
            </div>
          ) : (
            sortedStickers.map((sticker, stickerIndex) => (
              <div
                key={sticker.id}
                className="flex-shrink-0 w-32 sm:w-36 md:w-40 lg:w-44 cursor-pointer select-none group/sticker"
                onClick={(e) => handleStickerClick(sticker, e)}
                style={{ animationDelay: `${stickerIndex * 50}ms` }}
              >
                {/* Special Upload Action Card - CIRCULAR */}
                {sticker.isUploadAction ? (
                  <div className="flex flex-col items-center">
                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full overflow-hidden shadow-lg group-hover/sticker:shadow-2xl transition-all duration-500 transform group-hover/sticker:scale-[1.08] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover/sticker:scale-110 transition-transform">
                          <CameraIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </div>
                      </div>
                      {/* Animated border */}
                      <div className="absolute inset-0 rounded-full ring-4 ring-white/30 group-hover/sticker:ring-white/50 transition-all" />
                      {/* Shine effect */}
                      <div className="absolute inset-0 opacity-0 group-hover/sticker:opacity-100 transition-opacity duration-500 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent transform -translate-x-full group-hover/sticker:translate-x-full transition-transform duration-1000" />
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-700 text-center">Upload Photo</p>
                  </div>
                ) : sticker.isGiftCardHubAction ? (
                  /* Gift Card Hub Action - CIRCULAR with gradient */
                  <div className="flex flex-col items-center">
                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full overflow-hidden shadow-lg group-hover/sticker:shadow-2xl transition-all duration-500 transform group-hover/sticker:scale-[1.08] bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600">
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover/sticker:scale-110 transition-transform">
                          <GiftIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </div>
                        <span className="mt-1 text-xs font-medium text-white/90">Browse All</span>
                      </div>
                      {/* Animated border */}
                      <div className="absolute inset-0 rounded-full ring-4 ring-white/30 group-hover/sticker:ring-white/50 transition-all" />
                      {/* Shine effect */}
                      <div className="absolute inset-0 opacity-0 group-hover/sticker:opacity-100 transition-opacity duration-500 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent transform -translate-x-full group-hover/sticker:translate-x-full transition-transform duration-1000" />
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-700 text-center">Gift Card Hub</p>
                  </div>
                ) : sticker.isGiftCardSticker ? (
                  /* Gift Card Sticker Card - CIRCULAR with logo filling */
                  <div className="flex flex-col items-center">
                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full overflow-hidden shadow-lg group-hover/sticker:shadow-2xl transition-all duration-500 transform group-hover/sticker:scale-[1.08]">
                      {sticker.giftCardBrandLogo ? (
                        /* Logo fills the entire circle */
                        <>
                          <Image
                            src={sticker.giftCardBrandLogo}
                            alt={sticker.giftCardBrandName || "Gift Card"}
                            fill
                            className="object-cover"
                          />
                          {/* Subtle gradient overlay for text readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        </>
                      ) : (
                        /* Fallback gradient with icon */
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center">
                          <GiftIcon className="w-12 h-12 sm:w-14 sm:h-14 text-white" />
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-full ring-4 ring-white/40 group-hover/sticker:ring-white/60 transition-all" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-700 text-center truncate max-w-[120px]">
                      {sticker.giftCardBrandName || "Gift Card"}
                    </p>
                  </div>
                ) : (
                  /* Regular Sticker Card - CIRCULAR (matching final round sticker product) */
                  <div className="flex flex-col items-center">
                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full overflow-hidden shadow-lg group-hover/sticker:shadow-2xl transition-all duration-500 transform group-hover/sticker:scale-[1.08]">
                      <Image
                        src={sticker.thumbnailUrl || sticker.imageUrl}
                        alt={sticker.title}
                        fill
                        className="object-cover pointer-events-none transition-transform duration-700 group-hover/sticker:scale-110"
                        sizes="(max-width: 640px) 112px, (max-width: 768px) 128px, (max-width: 1024px) 144px, 144px"
                        draggable={false}
                      />
                      
                      {/* Popularity Badge */}
                      {!isSpecialRow && (sticker.popularity || 0) >= popularityThreshold && stickerIndex < 5 && (
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10">
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/30">
                            <FireIcon className="w-3 h-3 text-white" />
                            <span className="text-xs font-bold text-white">Hot</span>
                          </div>
                        </div>
                      )}

                      {/* Shine Effect */}
                      <div className="absolute inset-0 opacity-0 group-hover/sticker:opacity-100 transition-opacity duration-500 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent transform -translate-x-full group-hover/sticker:translate-x-full transition-transform duration-1000" />
                      </div>

                      {/* Border ring */}
                      <div className="absolute inset-0 rounded-full ring-3 ring-white/40 group-hover/sticker:ring-pink-500/60 transition-all duration-300" />
                    </div>
                    {/* Sticker title below */}
                    <p className="mt-2 text-xs font-medium text-gray-600 text-center truncate max-w-[120px]">
                      {sticker.title}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Scroll Progress Bar */}
        <div className="mt-4 mx-auto max-w-xs">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${gradientColors} rounded-full transition-all duration-300 ease-out`}
              style={{ width: `${Math.max(10, scrollProgress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
