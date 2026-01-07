"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { MagnifyingGlassIcon, XMarkIcon, SparklesIcon } from "@heroicons/react/24/outline";
import useSWR from "swr";

export interface Sticker {
  id: string;
  title: string;
  slug?: string;
  category?: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  tags?: string[];
  searchKeywords?: string[];
  popularity?: number;
  similarity?: number;
}

interface StickersApiResponse {
  success: boolean;
  data: Array<{
    id: string;
    title: string;
    slug?: string;
    category?: string;
    description?: string;
    imageUrl?: string;
    image_url?: string;
    thumbnailUrl?: string;
    thumbnail_url?: string;
    tags?: string[];
    search_keywords?: string[];
    searchKeywords?: string[];
    popularity?: number;
    similarity?: number;
  }>;
  total?: number;
  count?: number;
  query?: string;
  mode?: string;
}

interface StickerGalleryProps {
  onSelectSticker: (sticker: Sticker) => void;
  onClose: () => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * StickerGallery - Search and browse stickers in a 3-column grid
 * Uses semantic search (AI-powered) when a search query is provided
 * All stickers are displayed in round containers
 */
export default function StickerGallery({
  onSelectSticker,
  onClose,
}: StickerGalleryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search query (slightly longer delay for semantic search)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build API URL - use semantic search when query provided
  const apiUrl = debouncedQuery
    ? `/api/stickers/search?q=${encodeURIComponent(debouncedQuery)}&limit=50&mode=hybrid`
    : "/api/stickers?limit=50";

  // Fetch stickers
  const { data, error, isLoading } = useSWR<StickersApiResponse>(apiUrl, fetcher);

  // Check if using semantic search
  const isSemanticSearch = !!debouncedQuery && data?.mode === 'hybrid';

  // Transform API response to Sticker format (handle both snake_case and camelCase)
  const stickers: Sticker[] = (data?.data || []).map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    category: s.category,
    description: s.description,
    imageUrl: s.imageUrl || s.image_url || '',
    thumbnailUrl: s.thumbnailUrl || s.thumbnail_url,
    tags: s.tags,
    searchKeywords: s.searchKeywords || s.search_keywords,
    popularity: s.popularity,
    similarity: s.similarity,
  }));

  const handleSelectSticker = useCallback(
    (sticker: Sticker) => {
      onSelectSticker(sticker);
    },
    [onSelectSticker]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>

          {/* Search input */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stickers..."
              className="w-full pl-12 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 px-2 flex items-center gap-2">
          {isLoading ? (
            <span className="text-sm text-gray-500">
              {debouncedQuery ? "🔍 AI searching..." : "Loading..."}
            </span>
          ) : error ? (
            <span className="text-sm text-red-500">Error loading stickers</span>
          ) : (
            <>
              <span className="text-sm text-gray-500">
                {stickers.length} sticker{stickers.length !== 1 ? "s" : ""} found
                {debouncedQuery && ` for "${debouncedQuery}"`}
              </span>
              {isSemanticSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs font-medium rounded-full">
                  <SparklesIcon className="w-3 h-3" />
                  AI Search
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stickers grid - 3 columns of round stickers */}
      <div className="flex-1 overflow-y-auto pt-4 pb-20">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gray-200 animate-pulse" />
                <div className="mt-2 h-3 w-16 bg-gray-200 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Failed to load stickers. Please try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : stickers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-gray-500">
              {debouncedQuery
                ? `No stickers found for "${debouncedQuery}"`
                : "No stickers available"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            {stickers
              .filter((sticker) => sticker.imageUrl && sticker.imageUrl.length > 0)
              .map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => handleSelectSticker(sticker)}
                className="flex flex-col items-center group focus:outline-none"
              >
                <div className="w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden border-2 border-gray-200 group-hover:border-pink-400 group-focus:border-pink-500 group-focus:ring-4 group-focus:ring-pink-200 transition-all duration-200 shadow-md group-hover:shadow-lg group-hover:scale-105 relative bg-gray-100">
                  <Image
                    src={sticker.thumbnailUrl || sticker.imageUrl}
                    alt={sticker.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 96px, 128px"
                  />
                </div>
                <span className="mt-2 text-xs md:text-sm text-gray-600 text-center line-clamp-1 group-hover:text-pink-600 transition-colors">
                  {sticker.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
