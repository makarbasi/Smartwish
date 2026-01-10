"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  HomeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import useSWR from "swr";

type ProductType = "greeting-cards" | "stickers";

// Cache keys for localStorage
const SWITCHER_TEMPLATES_CACHE_KEY = 'kiosk_switcher_templates_v1';
const SWITCHER_STICKERS_CACHE_KEY = 'kiosk_switcher_stickers_v1';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// API response types
interface TemplatesResponse {
  success: boolean;
  data: Array<{
    id: string;
    title: string;
    cover_image?: string;
    image_1?: string;
    image_2?: string;
    image_3?: string;
    image_4?: string;
  }>;
}

interface StickersResponse {
  success: boolean;
  data: Array<{
    id: string;
    title: string;
    imageUrl: string;
    thumbnailUrl?: string;
  }>;
}

// Fallback placeholders
const GREETING_CARD_FALLBACKS = [
  { emoji: "🎂", bg: "from-pink-400 to-rose-500" },
  { emoji: "💝", bg: "from-red-400 to-pink-500" },
  { emoji: "🎉", bg: "from-purple-400 to-indigo-500" },
  { emoji: "🌸", bg: "from-pink-300 to-purple-400" },
];

const STICKER_FALLBACKS = [
  { emoji: "⭐", bg: "from-yellow-400 to-orange-500" },
  { emoji: "🦋", bg: "from-blue-400 to-purple-500" },
  { emoji: "🌈", bg: "from-pink-400 to-yellow-400" },
  { emoji: "🎀", bg: "from-pink-400 to-rose-500" },
];

// Fetcher with error handling
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

// Get cached data from localStorage
const getCachedData = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
};

// Set cached data in localStorage
const setCachedData = <T,>(key: string, data: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // Ignore storage errors
  }
};

export default function KioskProductSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Determine current product type based on path
  const getCurrentProduct = (): ProductType => {
    if (pathname.startsWith("/stickers")) return "stickers";
    return "greeting-cards";
  };

  const currentProduct = getCurrentProduct();

  // Get cached data for initial render
  const cachedTemplates = useMemo(() => getCachedData<string[]>(SWITCHER_TEMPLATES_CACHE_KEY), []);
  const cachedStickers = useMemo(() => getCachedData<string[]>(SWITCHER_STICKERS_CACHE_KEY), []);

  // Fetch templates - only when modal is open
  const { data: templatesData } = useSWR<TemplatesResponse>(
    isOpen ? "/api/templates?limit=8&sort=popularity" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      fallbackData: cachedTemplates ? { success: true, data: cachedTemplates.map((url, i) => ({ id: `cached-${i}`, title: '', cover_image: url })) } : undefined,
    }
  );

  // Fetch stickers - only when modal is open
  const { data: stickersData } = useSWR<StickersResponse>(
    isOpen ? "/api/stickers?limit=8" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      fallbackData: cachedStickers ? { success: true, data: cachedStickers.map((url, i) => ({ id: `cached-${i}`, title: '', imageUrl: url })) } : undefined,
    }
  );

  // Extract template images (use cover_image or image_1)
  const templateImages = useMemo(() => {
    const templates = templatesData?.data || [];
    const images = templates
      .slice(0, 4)
      .map(t => t.cover_image || t.image_1)
      .filter((url): url is string => !!url);
    return images;
  }, [templatesData]);

  // Extract sticker images
  const stickerImages = useMemo(() => {
    const stickers = stickersData?.data || [];
    const images = stickers
      .slice(0, 4)
      .map(s => s.thumbnailUrl || s.imageUrl)
      .filter((url): url is string => !!url);
    return images;
  }, [stickersData]);

  // Cache images when loaded
  useEffect(() => {
    if (templateImages.length > 0) {
      setCachedData(SWITCHER_TEMPLATES_CACHE_KEY, templateImages);
    }
  }, [templateImages]);

  useEffect(() => {
    if (stickerImages.length > 0) {
      setCachedData(SWITCHER_STICKERS_CACHE_KEY, stickerImages);
    }
  }, [stickerImages]);

  const handleNavigate = (product: ProductType) => {
    setIsOpen(false);
    if (product === "greeting-cards") {
      router.push("/templates");
    } else if (product === "stickers") {
      router.push("/stickers");
    }
  };

  const handleGoHome = () => {
    setIsOpen(false);
    router.push("/kiosk/home");
  };

  const handleImageError = (key: string) => {
    setImageErrors(prev => ({ ...prev, [key]: true }));
  };

  return (
    <>
      {/* Floating Toggle Button - Large round button aligned with search bar */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed top-[22px] left-4 sm:left-6 z-50 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full shadow-xl border-3 hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 group ${
          currentProduct === "greeting-cards"
            ? "bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 border-white/30"
            : "bg-gradient-to-br from-pink-500 via-rose-500 to-rose-600 border-white/30"
        }`}
        aria-label="Switch product type"
        title={currentProduct === "greeting-cards" ? "Click to switch to Stickers" : "Click to switch to Greeting Cards"}
      >
        {/* Product emoji with switch indicator */}
        <div className="relative">
          <span className="text-2xl sm:text-3xl">
            {currentProduct === "greeting-cards" ? "🎁" : "✨"}
          </span>
          {/* Small switch badge */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full flex items-center justify-center shadow-md">
            <svg 
              className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-700" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
        </div>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative bg-gradient-to-br from-white via-purple-50 to-pink-50 rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-200/40 to-purple-200/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-pink-200/40 to-rose-200/40 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            {/* Content */}
            <div className="relative p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎨</span>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      What would you like to create?
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Choose your creative adventure</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded-xl transition-all duration-200 shadow-sm hover:shadow"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Product Options Grid */}
              <div className="grid md:grid-cols-2 gap-5">
                {/* Greeting Cards Option */}
                <button
                  onClick={() => handleNavigate("greeting-cards")}
                  className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                    currentProduct === "greeting-cards"
                      ? "border-indigo-500 ring-4 ring-indigo-200 shadow-xl shadow-indigo-200/50"
                      : "border-gray-200 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-100/50"
                  }`}
                >
                  {/* Card Preview - Real Images or Fallback */}
                  <div className="relative h-40 bg-gradient-to-br from-indigo-100 via-purple-50 to-violet-100 overflow-hidden">
                    <div className="absolute inset-0 grid grid-cols-4 gap-2 p-4 transform group-hover:scale-105 transition-transform duration-500">
                      {(templateImages.length > 0 ? templateImages : [null, null, null, null]).map((imgUrl, i) => (
                        <div 
                          key={`template-${i}`}
                          className={`relative rounded-xl overflow-hidden shadow-lg flex items-center justify-center transform transition-all duration-300 group-hover:shadow-xl ${
                            !imgUrl || imageErrors[`template-${i}`] 
                              ? `bg-gradient-to-br ${GREETING_CARD_FALLBACKS[i % GREETING_CARD_FALLBACKS.length].bg}` 
                              : 'bg-gray-100'
                          }`}
                          style={{ transform: `rotate(${(i - 1.5) * 4}deg)` }}
                        >
                          {imgUrl && !imageErrors[`template-${i}`] ? (
                            <Image
                              src={imgUrl}
                              alt={`Greeting card ${i + 1}`}
                              fill
                              className="object-cover"
                              sizes="80px"
                              onError={() => handleImageError(`template-${i}`)}
                            />
                          ) : (
                            <span className="text-3xl drop-shadow-md">
                              {GREETING_CARD_FALLBACKS[i % GREETING_CARD_FALLBACKS.length].emoji}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
                    
                    {/* Floating emoji decorations */}
                    <div className="absolute top-2 right-3 text-2xl animate-bounce" style={{ animationDelay: '0.1s' }}>🎉</div>
                    <div className="absolute bottom-10 left-3 text-xl animate-bounce" style={{ animationDelay: '0.3s' }}>💌</div>
                  </div>
                  
                  {/* Card Content */}
                  <div className="p-5 bg-white/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg ${
                        currentProduct === "greeting-cards"
                          ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                          : "bg-gradient-to-br from-indigo-400 to-purple-500"
                      }`}>
                        🎁
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-xl font-bold text-gray-900">Greeting Cards</h3>
                        <p className="text-sm text-gray-500">Beautiful cards for every occasion</p>
                      </div>
                      {currentProduct === "greeting-cards" && (
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">Birthday</span>
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Anniversary</span>
                      <span className="px-2.5 py-1 bg-pink-100 text-pink-700 text-xs font-medium rounded-full">Love</span>
                    </div>
                  </div>
                </button>

                {/* Stickers Option */}
                <button
                  onClick={() => handleNavigate("stickers")}
                  className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                    currentProduct === "stickers"
                      ? "border-pink-500 ring-4 ring-pink-200 shadow-xl shadow-pink-200/50"
                      : "border-gray-200 hover:border-pink-400 hover:shadow-xl hover:shadow-pink-100/50"
                  }`}
                >
                  {/* Sticker Preview - Real Images or Fallback */}
                  <div className="relative h-40 bg-gradient-to-br from-pink-100 via-rose-50 to-orange-100 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center gap-3 p-4 transform group-hover:scale-105 transition-transform duration-500">
                      {(stickerImages.length > 0 ? stickerImages : [null, null, null, null]).map((imgUrl, i) => (
                        <div 
                          key={`sticker-${i}`}
                          className={`relative w-16 h-16 rounded-full overflow-hidden shadow-lg border-4 border-white flex items-center justify-center transform transition-all duration-300 group-hover:shadow-xl ${
                            !imgUrl || imageErrors[`sticker-${i}`]
                              ? `bg-gradient-to-br ${STICKER_FALLBACKS[i % STICKER_FALLBACKS.length].bg}`
                              : 'bg-gray-100'
                          }`}
                          style={{ transform: `rotate(${(i - 1.5) * 8}deg) translateY(${Math.sin(i) * 8}px)` }}
                        >
                          {imgUrl && !imageErrors[`sticker-${i}`] ? (
                            <Image
                              src={imgUrl}
                              alt={`Sticker ${i + 1}`}
                              fill
                              className="object-cover"
                              sizes="64px"
                              onError={() => handleImageError(`sticker-${i}`)}
                            />
                          ) : (
                            <span className="text-2xl drop-shadow-md">
                              {STICKER_FALLBACKS[i % STICKER_FALLBACKS.length].emoji}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent" />
                    
                    {/* Floating emoji decorations */}
                    <div className="absolute top-2 left-3 text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>✨</div>
                    <div className="absolute top-3 right-3 text-xl animate-bounce" style={{ animationDelay: '0.4s' }}>🌟</div>
                    <div className="absolute bottom-10 right-4 text-lg animate-bounce" style={{ animationDelay: '0.5s' }}>💫</div>
                  </div>
                  
                  {/* Card Content */}
                  <div className="p-5 bg-white/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg ${
                        currentProduct === "stickers"
                          ? "bg-gradient-to-br from-pink-500 to-rose-600"
                          : "bg-gradient-to-br from-pink-400 to-rose-500"
                      }`}>
                        ✨
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-xl font-bold text-gray-900">Stickers</h3>
                        <p className="text-sm text-gray-500">Fun custom stickers & labels</p>
                      </div>
                      {currentProduct === "stickers" && (
                        <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2.5 py-1 bg-pink-100 text-pink-700 text-xs font-medium rounded-full">3&quot; Round</span>
                      <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-medium rounded-full">Premium</span>
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">6 Pack</span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Divider with decoration */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-dashed border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-gradient-to-br from-white via-purple-50 to-pink-50 px-4 text-gray-400 text-sm">or</span>
                </div>
              </div>

              {/* Home Button - More stylish */}
              <button
                onClick={handleGoHome}
                className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 rounded-2xl transition-all duration-300 border-2 border-gray-200 hover:border-gray-300 group shadow-sm hover:shadow"
              >
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow transition-shadow">
                  <HomeIcon className="w-5 h-5 text-gray-600" />
                </div>
                <span className="font-semibold text-gray-700">Back to Product Selection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
