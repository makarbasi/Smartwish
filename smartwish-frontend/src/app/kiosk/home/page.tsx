"use client";

import { useRouter } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useKioskConfig } from "@/hooks/useKioskConfig";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import useSWR from "swr";

// Custom fetcher with caching support
const fetcher = async (url: string) => {
  // Check localStorage cache first
  const cacheKey = `swr_cache_${url}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    // Use cache if less than 24 hours old (1 day)
    if (Date.now() - timestamp < 86400000) {
      return data;
    }
  }
  
  // Fetch fresh data
  const response = await fetch(url, {
    cache: 'default', // Use browser cache
  });
  const data = await response.json();
  
  // Store in localStorage cache
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    // localStorage might be full, ignore error
    console.warn('Failed to cache data:', e);
  }
  
  return data;
};

// API response types
interface Template {
  id: string;
  title: string;
  cover_image: string;
  image_1?: string;
}

interface Sticker {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
}

interface TemplatesResponse {
  success: boolean;
  data: Template[];
}

interface StickersResponse {
  success: boolean;
  data: Sticker[];
}

export default function KioskHomePage() {
  const router = useRouter();
  const { isKiosk, isInitialized } = useDeviceMode();
  const { config: kioskConfig } = useKioskConfig();

  // Check if features are enabled (default to true if not set)
  const greetingCardsEnabled = kioskConfig?.greetingCardsEnabled !== false;
  const stickersEnabled = kioskConfig?.stickersEnabled !== false;

  // Fetch popular templates with aggressive caching
  const { data: templatesData } = useSWR<TemplatesResponse>(
    "/api/templates?limit=5&sort=popularity",
    fetcher,
    {
      revalidateOnFocus: false, // Don't revalidate when window regains focus
      revalidateOnReconnect: false, // Don't revalidate on reconnect
      dedupingInterval: 60000, // Dedupe requests within 60 seconds
      refreshInterval: 0, // Don't auto-refresh
      keepPreviousData: true, // Keep showing old data while fetching new
    }
  );

  // Fetch categories first
  const { data: categoriesData } = useSWR<{ success: boolean; data: string[] }>(
    "/api/stickers/categories",
    fetcher
  );
  const categories = categoriesData?.data || [];

  // Fetch stickers from multiple categories to get 30 unique ones
  const { data: stickersDataAll } = useSWR<StickersResponse>(
    categories.length > 0 ? `/api/stickers?limit=200` : null, // Fetch more to get variety
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      refreshInterval: 0,
      keepPreviousData: true,
    }
  );

  const templates = templatesData?.data || [];
  
  // Get 30 unique stickers from different categories
  const allStickers = stickersDataAll?.data || [];
  const uniqueStickers = useMemo(() => {
    if (allStickers.length === 0) return [];
    
    // Group by category
    const byCategory: Record<string, Sticker[]> = {};
    allStickers.forEach(sticker => {
      const cat = sticker.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(sticker);
    });
    
    // Pick stickers from different categories
    const selected: Sticker[] = [];
    const categoryKeys = Object.keys(byCategory);
    let categoryIndex = 0;
    let stickerIndex = 0;
    
    while (selected.length < 30 && allStickers.length > 0) {
      if (categoryKeys.length > 0) {
        // Try to get from different categories
        const category = categoryKeys[categoryIndex % categoryKeys.length];
        const categoryStickers = byCategory[category] || [];
        if (categoryStickers.length > 0) {
          const sticker = categoryStickers[stickerIndex % categoryStickers.length];
          if (!selected.find(s => s.id === sticker.id)) {
            selected.push(sticker);
          }
        }
        categoryIndex++;
      }
      
      // Fallback: just take from all stickers if we can't get enough from categories
      if (selected.length < 30 && stickerIndex < allStickers.length) {
        const sticker = allStickers[stickerIndex];
        if (!selected.find(s => s.id === sticker.id)) {
          selected.push(sticker);
        }
        stickerIndex++;
      } else {
        stickerIndex++;
      }
      
      if (stickerIndex >= allStickers.length && selected.length < 30) break;
    }
    
    return selected.slice(0, 30);
  }, [allStickers]);
  
  const stickers = uniqueStickers;

  // Redirect non-kiosk users away from this page (only after initialization)
  useEffect(() => {
    if (isInitialized && !isKiosk) {
      router.replace("/");
    }
  }, [isKiosk, isInitialized, router]);

  const handleSelectGreetingCards = () => {
    if (!greetingCardsEnabled) return;
    router.push("/templates");
  };

  const handleSelectStickers = () => {
    if (!stickersEnabled) return;
    router.push("/stickers");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-6 lg:p-10 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative text-center mb-10 lg:mb-14">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            SmartWish
          </span>
        </h1>
        <p className="text-xl md:text-2xl lg:text-3xl text-gray-300 font-light">
          What would you like to create today?
        </p>
      </div>

      {/* Product Selection Cards */}
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-7xl w-full">
        
        {/* Greeting Cards Option */}
        <button
          onClick={handleSelectGreetingCards}
          disabled={!greetingCardsEnabled}
          className={`group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-[2rem] shadow-2xl transition-all duration-500 transform overflow-hidden border focus:outline-none min-h-[480px] lg:min-h-[520px] ${
            greetingCardsEnabled
              ? 'hover:scale-[1.02] active:scale-[0.98] border-white/20 hover:border-indigo-400/50 cursor-pointer'
              : 'opacity-50 cursor-not-allowed border-white/10'
          }`}
        >
          {/* Glow effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/0 to-purple-600/0 group-hover:from-indigo-600/20 group-hover:to-purple-600/20 transition-all duration-500" />
          
          {/* Greeting Cards Display - Fanned cards */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full flex justify-center perspective-1000">
            <div className="relative w-80 h-56 lg:w-96 lg:h-64">
              {templates.slice(0, 5).map((template, i) => {
                const totalCards = Math.min(templates.length, 5);
                const middleIndex = Math.floor(totalCards / 2);
                const offset = i - middleIndex;
                const rotation = offset * 8;
                const translateX = offset * 55;
                const translateY = Math.abs(offset) * 12;
                const zIndex = totalCards - Math.abs(offset);
                const scale = 1 - Math.abs(offset) * 0.05;
                
                return (
                  <div
                    key={template.id}
                    className="absolute left-1/2 top-1/2 w-28 lg:w-32 rounded-xl shadow-2xl overflow-hidden border-2 border-white/40 transition-all duration-500 group-hover:shadow-indigo-500/40"
                    style={{
                      aspectRatio: '5 / 7',
                      transform: `translateX(calc(-50% + ${translateX}px)) translateY(calc(-50% + ${translateY}px)) rotate(${rotation}deg) scale(${scale})`,
                      zIndex,
                    }}
                  >
                    <Image
                      src={template.cover_image || template.image_1 || '/placeholder-card.png'}
                      alt={template.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      sizes="128px"
                      priority={i < 2} // Prioritize first 2 images
                      loading={i < 2 ? "eager" : "lazy"}
                      unoptimized={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  </div>
                );
              })}
              {/* Fallback if no templates loaded */}
              {templates.length === 0 && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 lg:w-32 rounded-xl bg-gradient-to-br from-indigo-400/30 to-purple-400/30 border-2 border-white/20 flex items-center justify-center" style={{ aspectRatio: '5 / 7' }}>
                  <div className="text-white/60 text-4xl">🎴</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="relative pt-72 lg:pt-80 pb-10 px-8 flex flex-col items-center text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 group-hover:text-indigo-200 transition-colors duration-300">
              Greeting Cards
            </h2>
            <p className="text-base md:text-lg text-gray-400 max-w-sm mb-6">
              Personalized cards for birthdays, holidays & special occasions
            </p>
            
            {/* CTA */}
            <div className={`flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 ${
              greetingCardsEnabled
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/40 group-hover:shadow-indigo-500/60'
                : 'bg-gray-600/50 text-gray-400'
            }`}>
              <span>{greetingCardsEnabled ? 'Create Now' : 'Coming Soon'}</span>
              {greetingCardsEnabled && (
                <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              )}
            </div>
          </div>
        </button>

        {/* Stickers Option */}
        <button
          onClick={handleSelectStickers}
          disabled={!stickersEnabled}
          className={`group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-[2rem] shadow-2xl transition-all duration-500 transform overflow-hidden border focus:outline-none min-h-[480px] lg:min-h-[520px] ${
            stickersEnabled
              ? 'hover:scale-[1.02] active:scale-[0.98] border-white/20 hover:border-pink-400/50 cursor-pointer'
              : 'opacity-50 cursor-not-allowed border-white/10'
          }`}
        >
          {/* Glow effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600/0 to-orange-600/0 group-hover:from-pink-600/20 group-hover:to-orange-600/20 transition-all duration-500" />
          
          {/* Stickers Display - Rain effect: falling from top, fading in/out */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full flex justify-center overflow-hidden">
            <div className="relative w-full h-full min-h-[400px] lg:min-h-[480px]">
              {(stickers.length > 0 ? stickers.slice(0, 30) : Array.from({ length: 30 }).map((_, i) => ({ id: `placeholder-${i}`, imageUrl: null }))).map((sticker, i) => {
                // Generate stable random values based only on sticker index (not time-based)
                // Round all values to avoid floating-point precision issues between server/client
                const seed = i * 137.5; // Prime number for better distribution
                const random1 = Math.abs(Math.sin(seed)) % 1;
                const random2 = Math.abs(Math.sin(seed * 2.7)) % 1;
                const random3 = Math.abs(Math.sin(seed * 3.1)) % 1;
                const random4 = Math.abs(Math.sin(seed * 4.3)) % 1;
                const random5 = Math.abs(Math.sin(seed * 5.9)) % 1;
                const random6 = Math.abs(Math.sin(seed * 7.2)) % 1;
                
                // Random horizontal positions - wider spread for 30 stickers (rounded)
                const xPos = Math.round((random1 * 300 - 150) * 100) / 100;
                
                // Random base sizes (100-140px) - some bigger than others (rounded to integer)
                const baseSize = Math.round(100 + (random2 * 40));
                const size = baseSize;
                
                // Size variation during fall (scale changes) - rounded to 3 decimals
                const minScale = Math.round((0.8 + (random3 * 0.2)) * 1000) / 1000;
                const maxScale = Math.round((1.0 + (random4 * 0.25)) * 1000) / 1000;
                
                // More varied rotations - rounded to 2 decimals
                const rotation = Math.round((random5 * 70 - 35) * 100) / 100;
                
                // Random delays - distributed across 0-20 seconds (rounded to 2 decimals)
                const delay = Math.round((random6 * 20) * 100) / 100;
                
                // More varied fall durations (4-7 seconds) - rounded to 2 decimals
                const duration = Math.round((4 + (random1 * 3)) * 100) / 100;
                
                // Random horizontal drift during fall (swaying effect) - rounded
                const driftAmount = Math.round((random2 * 60 - 30) * 100) / 100;
                
                // Random vertical speed variation - rounded to 3 decimals
                const speedVariation = Math.round((0.8 + (random3 * 0.4)) * 1000) / 1000;
                
                // Stable z-index based on index (not random) to prevent flickering
                const stableZIndex = 10 + (i % 10);
                
                // Calculate final duration with speed variation - rounded
                const finalDuration = Math.round((duration / speedVariation) * 100) / 100;
                
                return (
                  <div
                    key={`${sticker.id || `sticker-${i}`}-${i}`}
                    className="absolute left-1/2 sticker-rain"
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      '--start-x': `${xPos}px`,
                      '--drift-x': `${driftAmount}px`,
                      '--rotation': `${rotation}deg`,
                      '--fall-duration': `${finalDuration}s`,
                      '--fall-delay': `${delay}s`,
                      '--min-scale': `${minScale}`,
                      '--max-scale': `${maxScale}`,
                      transform: `translate3d(calc(-50% + var(--start-x, 0px)), -120px, 0) rotate(var(--rotation, 0deg)) scale(var(--min-scale, 1))`,
                      zIndex: stableZIndex,
                      animation: `stickerRain var(--fall-duration, 4s) linear infinite`,
                      animationDelay: `var(--fall-delay, 0s)`,
                      animationFillMode: 'forwards',
                      willChange: 'transform, opacity',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      opacity: '0',
                    } as React.CSSProperties}
                  >
                    {/* Circle container */}
                    <div 
                      className="w-full h-full rounded-full overflow-visible border-2 border-white/40 shadow-lg bg-white/5 backdrop-blur-sm"
                    >
                      {/* Image container */}
                      <div className="absolute inset-0 rounded-full">
                        <div className="absolute inset-0 flex items-center justify-center p-1.5">
                          <div className="relative w-full h-full">
                            {sticker.imageUrl ? (
                              <Image
                                src={sticker.imageUrl || sticker.thumbnailUrl || '/placeholder-sticker.png'}
                                alt={sticker.title || `Sticker ${i + 1}`}
                                fill
                                className="object-contain"
                                sizes="(max-width: 1024px) 85px, 96px"
                                priority={i < 3}
                                loading={i < 3 ? "eager" : "lazy"}
                                unoptimized={false}
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-400/30 to-orange-400/30" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Content */}
          <div className="relative pt-72 lg:pt-80 pb-10 px-8 flex flex-col items-center text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 group-hover:text-pink-200 transition-colors duration-300">
              Stickers
            </h2>
            <p className="text-base md:text-lg text-gray-400 max-w-sm mb-6">
              Custom round stickers for decorations, labels & fun designs
            </p>
            
            {/* CTA */}
            <div className={`flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 ${
              stickersEnabled
                ? 'bg-gradient-to-r from-pink-600 to-orange-500 text-white shadow-lg shadow-pink-500/40 group-hover:shadow-pink-500/60'
                : 'bg-gray-600/50 text-gray-400'
            }`}>
              <span>{stickersEnabled ? 'Create Now' : 'Coming Soon'}</span>
              {stickersEnabled && (
                <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Footer hint */}
      <div className="relative mt-10 lg:mt-14 text-center">
        <p className="text-gray-500 text-base flex items-center gap-3 justify-center">
          <span className="inline-block w-12 h-[1px] bg-gradient-to-r from-transparent to-gray-600" />
          Touch a card to begin
          <span className="inline-block w-12 h-[1px] bg-gradient-to-l from-transparent to-gray-600" />
        </p>
      </div>

      {/* Sticker rain animation styles - smooth, continuous fall with linear timing */}
      <style jsx global>{`
        @keyframes stickerRain {
          0% {
            transform: translate3d(calc(-50% + var(--start-x, 0px)), -120px, 0) rotate(var(--rotation, 0deg)) scale(var(--min-scale, 1));
            opacity: 0;
          }
          2% {
            opacity: 0.3;
          }
          5% {
            opacity: 0.8;
          }
          8% {
            opacity: 1;
            transform: translate3d(calc(-50% + var(--start-x, 0px) + var(--drift-x, 0px) * 0.1), -60px, 0) rotate(calc(var(--rotation, 0deg) + 12deg)) scale(calc(var(--min-scale, 1) + (var(--max-scale, 1) - var(--min-scale, 1)) * 0.08));
          }
          15% {
            transform: translate3d(calc(-50% + var(--start-x, 0px) + var(--drift-x, 0px) * 0.25), 40px, 0) rotate(calc(var(--rotation, 0deg) + 35deg)) scale(calc(var(--min-scale, 1) + (var(--max-scale, 1) - var(--min-scale, 1)) * 0.25));
          }
          30% {
            transform: translate3d(calc(-50% + var(--start-x, 0px) + var(--drift-x, 0px) * 0.4), 180px, 0) rotate(calc(var(--rotation, 0deg) + 70deg)) scale(calc(var(--min-scale, 1) + (var(--max-scale, 1) - var(--min-scale, 1)) * 0.5));
          }
          50% {
            transform: translate3d(calc(-50% + var(--start-x, 0px) + var(--drift-x, 0px) * 0.55), 300px, 0) rotate(calc(var(--rotation, 0deg) + 100deg)) scale(var(--max-scale, 1));
          }
          70% {
            transform: translate3d(calc(-50% + var(--start-x, 0px) + var(--drift-x, 0px) * 0.7), 420px, 0) rotate(calc(var(--rotation, 0deg) + 130deg)) scale(calc(var(--max-scale, 1) - (var(--max-scale, 1) - var(--min-scale, 1)) * 0.15));
          }
          85% {
            transform: translate3d(calc(-50% + var(--start-x, 0px) + var(--drift-x, 0px) * 0.85), 490px, 0) rotate(calc(var(--rotation, 0deg) + 155deg)) scale(calc(var(--min-scale, 1) + (var(--max-scale, 1) - var(--min-scale, 1)) * 0.2));
          }
          92% {
            opacity: 1;
            transform: translate3d(calc(-50% + var(--start-x, 0px) + var(--drift-x, 0px) * 0.92), 520px, 0) rotate(calc(var(--rotation, 0deg) + 170deg)) scale(var(--min-scale, 1));
          }
          95% {
            opacity: 0.8;
          }
          97% {
            opacity: 0.5;
          }
          99% {
            opacity: 0.2;
          }
          100% {
            transform: translate3d(calc(-50% + var(--start-x, 0px) + var(--drift-x, 0px)), 550px, 0) rotate(calc(var(--rotation, 0deg) + 180deg)) scale(calc(var(--min-scale, 1) * 0.85));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
