"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
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
}

export default function CategoryCarousel({
  categoryId,
  categoryName,
  cards,
  onCardClick,
  onCategoryClick,
  isLoading = false,
}: CategoryCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Check scroll position to update arrow visibility
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollPosition();
    container.addEventListener("scroll", checkScrollPosition);
    
    // Also check on resize
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

    const scrollAmount = container.clientWidth * 0.8;
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
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
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

  // Touch handlers for mobile
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
    // If we just finished dragging, don't trigger card click
    if (Math.abs((e.pageX - scrollContainerRef.current!.offsetLeft) - startX) > 10) {
      return;
    }
    onCardClick(card);
  };

  // Sort cards by popularity (highest first)
  const sortedCards = [...cards].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  return (
    <div className="relative mb-8">
      {/* Category Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <button
          onClick={() => onCategoryClick(categoryId, categoryName)}
          className="group flex items-center gap-2 text-xl font-bold text-gray-900 hover:text-indigo-600 transition-colors"
        >
          <span>{categoryName}</span>
          <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
        </button>
        <span className="text-sm text-gray-500">{cards.length} cards</span>
      </div>

      {/* Carousel Container */}
      <div className="relative group">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -ml-2"
            aria-label="Scroll left"
          >
            <ChevronLeftIcon className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -mr-2"
            aria-label="Scroll right"
          >
            <ChevronRightIcon className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* Scrollable Cards Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
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
            // Loading skeletons
            Array(8)
              .fill(0)
              .map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48"
                >
                  <div className="aspect-[3/4] rounded-xl bg-gray-200 animate-pulse" />
                  <div className="mt-2 h-4 bg-gray-200 rounded animate-pulse" />
                </div>
              ))
          ) : sortedCards.length === 0 ? (
            <div className="flex-1 py-12 text-center text-gray-500">
              No cards in this category
            </div>
          ) : (
            sortedCards.map((card) => (
              <div
                key={card.id}
                className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 cursor-pointer select-none"
                onClick={(e) => handleCardClick(card, e)}
              >
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 bg-gray-100">
                  <Image
                    src={card.imageSrc}
                    alt={card.name}
                    fill
                    className="object-cover pointer-events-none"
                    sizes="(max-width: 640px) 144px, (max-width: 768px) 160px, (max-width: 1024px) 176px, 192px"
                    draggable={false}
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-sm font-medium truncate">
                        {card.name}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Scroll indicator dots (optional, for mobile) */}
      <div className="flex justify-center gap-1.5 mt-3 sm:hidden">
        {Array(Math.min(5, Math.ceil(sortedCards.length / 2)))
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-300"
            />
          ))}
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
