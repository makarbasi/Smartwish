"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon, FireIcon, SparklesIcon } from "@heroicons/react/24/solid";
import Image from "next/image";

export type CarouselCard = {
  id: string;
  name: string;
  imageSrc: string;
  popularity: number;
  pages?: string[];
  category_id?: string;
  category_name?: string;
  metadata?: Record<string, unknown>;
};

interface CategoryCarouselProps {
  categoryId: string;
  categoryName: string;
  cards: CarouselCard[];
  onCardClick: (card: CarouselCard) => void;
  onCategoryClick: (categoryId: string, categoryName: string) => void;
  isLoading?: boolean;
  index?: number; // For staggered animations
}

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
  birthday: "🎂",
  wedding: "💒",
  weddings: "💒",
  "thank you": "🙏",
  "thank-you": "🙏",
  thanks: "🙏",
  graduation: "🎓",
  graduations: "🎓",
  christmas: "🎄",
  holiday: "🎄",
  holidays: "🎄",
  valentine: "💝",
  valentines: "💝",
  "valentine's": "💝",
  easter: "🐣",
  mother: "👩",
  "mother's day": "👩",
  father: "👨",
  "father's day": "👨",
  baby: "👶",
  "baby shower": "👶",
  anniversary: "💑",
  congratulations: "🎉",
  "get well": "💐",
  sympathy: "🕊️",
  love: "❤️",
  friendship: "🤝",
  default: "✨",
};

function getCategoryIcon(categoryName: string): string {
  const lowerName = categoryName.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lowerName.includes(key)) {
      return icon;
    }
  }
  return CATEGORY_ICONS.default;
}

export default function CategoryCarousel({
  categoryId,
  categoryName,
  cards,
  onCardClick,
  onCategoryClick,
  isLoading = false,
  index = 0,
}: CategoryCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Staggered entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  // Check scroll position to update arrow visibility and progress
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    
    // Calculate scroll progress (0 to 1)
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
  }, [checkScrollPosition, cards]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.75;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Mouse/Touch drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setIsDragging(true);
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
    container.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    const container = scrollContainerRef.current;
    if (container) {
      container.style.cursor = "grab";
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      const container = scrollContainerRef.current;
      if (container) {
        container.style.cursor = "grab";
      }
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setIsDragging(true);
    setStartX(e.touches[0].pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const x = e.touches[0].pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    container.scrollLeft = scrollLeft - walk;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Prevent card click when dragging
  const handleCardClick = (card: CarouselCard, e: React.MouseEvent) => {
    if (Math.abs((e.pageX - scrollContainerRef.current!.offsetLeft) - startX) > 10) {
      return;
    }
    onCardClick(card);
  };

  // Sort cards by popularity (highest first)
  const sortedCards = [...cards].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // Get max popularity for badge threshold
  const maxPopularity = sortedCards.length > 0 ? sortedCards[0].popularity : 0;
  const popularityThreshold = maxPopularity * 0.7; // Top 30% get badges

  const categoryIcon = getCategoryIcon(categoryName);

  return (
    <div 
      className={`relative mb-10 transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between mb-5 px-1">
        <button
          onClick={() => onCategoryClick(categoryId, categoryName)}
          className="group flex items-center gap-3 transition-all duration-300 hover:scale-[1.02]"
        >
          {/* Category Icon with gradient background */}
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow duration-300">
              <span className="text-2xl">{categoryIcon}</span>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300" />
          </div>
          
          {/* Category Name */}
          <div className="flex flex-col items-start">
            <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent group-hover:from-indigo-600 group-hover:via-purple-600 group-hover:to-pink-600 transition-all duration-300">
              {categoryName}
            </span>
            <span className="text-sm text-gray-500 group-hover:text-indigo-500 transition-colors flex items-center gap-1">
              View all {cards.length} cards
              <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </span>
          </div>
        </button>

        {/* Card Count Badge */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-200/50 shadow-sm">
          <SparklesIcon className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-gray-700">{cards.length} designs</span>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative group/carousel">
        {/* Left Gradient Fade */}
        <div className={`absolute left-0 top-0 bottom-4 w-20 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
        
        {/* Right Gradient Fade */}
        <div className={`absolute right-0 top-0 bottom-4 w-20 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />

        {/* Left Arrow */}
        <button
          onClick={() => scroll("left")}
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${
            canScrollLeft 
              ? 'opacity-0 group-hover/carousel:opacity-100 translate-x-0' 
              : 'opacity-0 pointer-events-none -translate-x-4'
          }`}
          aria-label="Scroll left"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md shadow-xl border border-gray-200/50 flex items-center justify-center hover:bg-white hover:scale-110 hover:shadow-2xl transition-all duration-300">
              <ChevronLeftIcon className="w-6 h-6 text-gray-700" />
            </div>
            <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-lg opacity-0 hover:opacity-100 transition-opacity" />
          </div>
        </button>

        {/* Right Arrow */}
        <button
          onClick={() => scroll("right")}
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${
            canScrollRight 
              ? 'opacity-0 group-hover/carousel:opacity-100 translate-x-0' 
              : 'opacity-0 pointer-events-none translate-x-4'
          }`}
          aria-label="Scroll right"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md shadow-xl border border-gray-200/50 flex items-center justify-center hover:bg-white hover:scale-110 hover:shadow-2xl transition-all duration-300">
              <ChevronRightIcon className="w-6 h-6 text-gray-700" />
            </div>
            <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-lg opacity-0 hover:opacity-100 transition-opacity" />
          </div>
        </button>

        {/* Scrollable Cards Container */}
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
            // Premium Loading Skeletons
            Array(8)
              .fill(0)
              .map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="flex-shrink-0 w-40 sm:w-44 md:w-48 lg:w-52"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-shimmer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-300/50 to-transparent" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full animate-shimmer w-3/4" />
                    <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full animate-shimmer w-1/2" />
                  </div>
                </div>
              ))
          ) : sortedCards.length === 0 ? (
            <div className="flex-1 py-16 text-center">
              <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50">
                <SparklesIcon className="w-10 h-10 text-gray-300" />
                <p className="text-gray-500 font-medium">No cards in this category yet</p>
              </div>
            </div>
          ) : (
            sortedCards.map((card, cardIndex) => (
              <div
                key={card.id}
                className="flex-shrink-0 w-40 sm:w-44 md:w-48 lg:w-52 cursor-pointer select-none group/card"
                onClick={(e) => handleCardClick(card, e)}
                style={{ 
                  animationDelay: `${cardIndex * 50}ms`,
                }}
              >
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg group-hover/card:shadow-2xl transition-all duration-500 transform group-hover/card:scale-[1.03] group-hover/card:-translate-y-2">
                  {/* Card Image */}
                  <Image
                    src={card.imageSrc}
                    alt={card.name}
                    fill
                    className="object-cover pointer-events-none transition-transform duration-700 group-hover/card:scale-110"
                    sizes="(max-width: 640px) 160px, (max-width: 768px) 176px, (max-width: 1024px) 192px, 208px"
                    draggable={false}
                  />
                  
                  {/* Gradient Overlay - Always visible at bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover/card:opacity-90 transition-opacity duration-300" />
                  
                  {/* Popularity Badge */}
                  {card.popularity >= popularityThreshold && cardIndex < 5 && (
                    <div className="absolute top-3 left-3 z-10">
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/30">
                        <FireIcon className="w-3.5 h-3.5 text-white" />
                        <span className="text-xs font-bold text-white">Popular</span>
                      </div>
                    </div>
                  )}

                  {/* Shine Effect on Hover */}
                  <div className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent transform -translate-x-full group-hover/card:translate-x-full transition-transform duration-1000" />
                  </div>

                  {/* Card Info at Bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover/card:translate-y-0 transition-transform duration-300">
                    <p className="text-white text-sm font-semibold truncate drop-shadow-lg">
                      {card.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 delay-100">
                      <div className="flex items-center gap-1">
                        <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs text-white/80">{card.popularity || 0} likes</span>
                      </div>
                    </div>
                  </div>

                  {/* Border Glow on Hover */}
                  <div className="absolute inset-0 rounded-2xl ring-2 ring-transparent group-hover/card:ring-indigo-500/50 transition-all duration-300" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Scroll Progress Bar */}
        <div className="mt-4 mx-auto max-w-xs">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
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
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
