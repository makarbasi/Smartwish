"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MagnifyingGlassIcon, XMarkIcon, SparklesIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import StickerCategoryCarousel, { StickerCarouselItem } from "./StickerCategoryCarousel";
import { FeaturedCategoryConfig, BundleGiftCardConfig } from "@/contexts/KioskContext";

interface StickersApiResponse {
  success: boolean;
  data: Array<{
    id: string;
    title: string;
    slug?: string;
    category?: string;
    imageUrl: string;
    thumbnailUrl?: string;
    tags?: string[];
    popularity?: number;
  }>;
  total?: number;
}

interface StickerCarouselsViewProps {
  featuredCategories: FeaturedCategoryConfig[];
  bundleGiftCards: BundleGiftCardConfig[];
  onStickerSelect: (sticker: StickerCarouselItem) => void;
  onUploadClick: () => void;
  onGiftCardStickerClick: (giftCard: BundleGiftCardConfig) => void;
  onGiftCardHubClick: () => void; // Navigate to gift card hub
  filledSlotsCount: number; // Number of slots currently filled (0-6)
}

export default function StickerCarouselsView({
  featuredCategories,
  bundleGiftCards,
  onStickerSelect,
  onUploadClick,
  onGiftCardStickerClick,
  onGiftCardHubClick,
  filledSlotsCount,
}: StickerCarouselsViewProps) {
  const [categoryStickers, setCategoryStickers] = useState<Record<string, StickerCarouselItem[]>>({});
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<StickerCarouselItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSlotFullMessage, setShowSlotFullMessage] = useState(false);
  
  // Check if all slots are filled (gift card needs 1 slot)
  const allSlotsFilled = filledSlotsCount >= 6;

  // Sort categories by displayOrder
  const sortedCategories = useMemo(() => 
    [...featuredCategories].sort((a, b) => a.displayOrder - b.displayOrder),
    [featuredCategories]
  );

  // Fetch stickers for each category
  useEffect(() => {
    const fetchCategoryStickers = async (category: FeaturedCategoryConfig) => {
      setLoadingCategories(prev => new Set(prev).add(category.categoryId));
      
      try {
        const response = await fetch(`/api/stickers?category=${encodeURIComponent(category.categoryName)}&limit=20`);
        const data: StickersApiResponse = await response.json();
        
        if (data.success && data.data) {
          const stickers: StickerCarouselItem[] = data.data.map((s) => ({
            id: s.id,
            title: s.title,
            imageUrl: s.imageUrl,
            thumbnailUrl: s.thumbnailUrl,
            category: s.category,
            popularity: s.popularity,
            tags: s.tags,
          }));
          
          setCategoryStickers(prev => ({
            ...prev,
            [category.categoryId]: stickers,
          }));
        }
      } catch (error) {
        console.error(`Error fetching stickers for category ${category.categoryName}:`, error);
      } finally {
        setLoadingCategories(prev => {
          const next = new Set(prev);
          next.delete(category.categoryId);
          return next;
        });
      }
    };

    sortedCategories.forEach((category) => {
      if (!categoryStickers[category.categoryId]) {
        fetchCategoryStickers(category);
      }
    });
  }, [sortedCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search for stickers when query changes - use semantic search API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const searchStickers = async () => {
      setIsSearching(true);
      try {
        // Use the semantic search endpoint (same as StickerGallery)
        const response = await fetch(`/api/stickers/search?q=${encodeURIComponent(searchQuery.trim())}&mode=hybrid&limit=30`);
        const data: StickersApiResponse = await response.json();
        
        if (data.success && data.data) {
          const stickers: StickerCarouselItem[] = data.data.map((s) => ({
            id: s.id,
            title: s.title,
            imageUrl: s.imageUrl,
            thumbnailUrl: s.thumbnailUrl,
            category: s.category,
            popularity: s.popularity,
            tags: s.tags,
          }));
          setSearchResults(stickers);
        }
      } catch (error) {
        console.error("Error searching stickers:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Slightly longer debounce for semantic search
    const debounce = setTimeout(searchStickers, 400);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Build "Quick Actions" row items
  const quickActionsItems: StickerCarouselItem[] = useMemo(() => {
    const items: StickerCarouselItem[] = [];
    
    // 1. Upload Your Photo action
    items.push({
      id: "upload-action",
      title: "Upload Your Photo",
      imageUrl: "",
      isUploadAction: true,
    });
    
    // 2. Gift Card Stickers from Bundle Discounts (filter for stickers)
    const stickerEligibleGiftCards = bundleGiftCards.filter(
      gc => gc.appliesTo?.includes('sticker') ?? true
    );
    
    stickerEligibleGiftCards.forEach((gc) => {
      items.push({
        id: `gift-card-${gc.id}`,
        title: gc.brandName,
        imageUrl: gc.brandLogo || "",
        isGiftCardSticker: true,
        giftCardBrandName: gc.brandName,
        giftCardBrandLogo: gc.brandLogo,
      });
    });
    
    // 3. Gift Card Hub action - browse all gift cards (LAST)
    items.push({
      id: "gift-card-hub-action",
      title: "All Gift Cards",
      imageUrl: "",
      isGiftCardHubAction: true,
    });
    
    return items;
  }, [bundleGiftCards]);

  // Handle sticker click from Quick Actions
  const handleQuickActionClick = useCallback((sticker: StickerCarouselItem) => {
    if (sticker.isUploadAction) {
      onUploadClick();
    } else if (sticker.isGiftCardHubAction) {
      // Check if all slots are filled - gift card needs 1 slot to print
      if (allSlotsFilled) {
        setShowSlotFullMessage(true);
        // Auto-hide after 3 seconds
        setTimeout(() => setShowSlotFullMessage(false), 3000);
        return;
      }
      onGiftCardHubClick();
    } else if (sticker.isGiftCardSticker) {
      // Check if all slots are filled - gift card needs 1 slot to print
      if (allSlotsFilled) {
        setShowSlotFullMessage(true);
        // Auto-hide after 3 seconds
        setTimeout(() => setShowSlotFullMessage(false), 3000);
        return;
      }
      const giftCard = bundleGiftCards.find(gc => `gift-card-${gc.id}` === sticker.id);
      if (giftCard) {
        onGiftCardStickerClick(giftCard);
      }
    } else {
      onStickerSelect(sticker);
    }
  }, [bundleGiftCards, onUploadClick, onGiftCardHubClick, onGiftCardStickerClick, onStickerSelect, allSlotsFilled]);

  // Handle category click - not used in this version but kept for interface
  const handleCategoryClick = useCallback(() => {
    // Categories don't navigate away in this design
  }, []);

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  // Is search active (showing results)
  const isSearchActive = searchQuery.trim().length > 0;

  if (sortedCategories.length === 0 && quickActionsItems.length <= 1) {
    return null;
  }

  return (
    <div className="mt-6">
      {/* Slot Full Warning Message */}
      {showSlotFullMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl shadow-amber-500/30 flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold">All slots are filled!</p>
              <p className="text-sm text-amber-100">Remove a sticker to add a gift card</p>
            </div>
            <button 
              onClick={() => setShowSlotFullMessage(false)}
              className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Search Bar - Always visible */}
      <div className="mb-6 px-2">
        <div className={`relative max-w-2xl mx-auto transition-all duration-300 ${isSearchFocused ? 'scale-[1.02]' : ''}`}>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <MagnifyingGlassIcon className={`w-5 h-5 transition-colors ${isSearchFocused ? 'text-pink-500' : 'text-gray-400'}`} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search stickers... e.g., 'cute cat' or 'birthday'"
            className={`w-full pl-12 pr-12 py-4 rounded-2xl border-2 transition-all duration-300 outline-none text-gray-900 placeholder:text-gray-400 text-lg ${
              isSearchFocused 
                ? 'border-pink-400 shadow-lg shadow-pink-500/20 bg-white' 
                : 'border-gray-200 bg-gray-50/80 hover:border-gray-300'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Search Results (when searching) */}
      {isSearchActive && (
        <div className="px-2 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <SparklesIcon className="w-5 h-5 text-pink-500" />
            <span className="text-lg font-semibold text-gray-700">
              {isSearching ? 'Searching...' : `Results for "${searchQuery}"`}
            </span>
            {!isSearching && searchResults.length > 0 && (
              <span className="text-sm text-gray-400">({searchResults.length} found)</span>
            )}
          </div>
          
          {isSearching ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                  <div className="mt-2 h-3 w-16 bg-gray-200 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-gray-50 border border-gray-100">
                <SparklesIcon className="w-10 h-10 text-gray-300" />
                <p className="text-gray-500 font-medium">No stickers found for &quot;{searchQuery}&quot;</p>
                <p className="text-sm text-gray-400">Try a different search term</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {searchResults.map((sticker) => (
                <button
                  key={sticker.id}
                  onClick={() => onStickerSelect(sticker)}
                  className="group flex flex-col items-center"
                >
                  {/* Round sticker preview */}
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                    <Image
                      src={sticker.thumbnailUrl || sticker.imageUrl}
                      alt={sticker.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 80px, (max-width: 768px) 96px, 96px"
                    />
                    {/* Shine on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent" />
                    </div>
                    {/* Ring */}
                    <div className="absolute inset-0 rounded-full ring-2 ring-white/50 group-hover:ring-pink-500/60 transition-all" />
                  </div>
                  {/* Title */}
                  <p className="mt-2 text-xs font-medium text-gray-600 text-center truncate max-w-[80px] sm:max-w-[96px]">
                    {sticker.title}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Original Content (when not searching) */}
      {!isSearchActive && (
        <>
          {/* Quick Actions Row (Special First Row) */}
          {quickActionsItems.length > 0 && (
            <StickerCategoryCarousel
              categoryId="quick-actions"
              categoryName="Quick Actions"
              categoryIcon="⚡"
              stickers={quickActionsItems}
              onStickerClick={handleQuickActionClick}
              onCategoryClick={() => {}}
              isLoading={false}
              index={0}
              isSpecialRow={true}
            />
          )}

          {/* Category Carousels */}
          <div className="space-y-2">
            {sortedCategories.map((category, index) => (
              <StickerCategoryCarousel
                key={category.categoryId}
                categoryId={category.categoryId}
                categoryName={category.categoryName}
                stickers={categoryStickers[category.categoryId] || []}
                onStickerClick={onStickerSelect}
                onCategoryClick={handleCategoryClick}
                isLoading={loadingCategories.has(category.categoryId)}
                index={index + 1}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
