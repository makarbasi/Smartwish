"use client";

import { useRouter } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useKioskConfig } from "@/hooks/useKioskConfig";
import { useEffect, useState } from "react";
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

  // Fetch stickers with aggressive caching
  const { data: stickersData } = useSWR<StickersResponse>(
    "/api/stickers?limit=6",
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
  const stickers = stickersData?.data || [];

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
          
          {/* Stickers Display - Professional overlapping design with breakout effect */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full flex justify-center">
            <div className="relative w-80 h-56 lg:w-96 lg:h-64">
              {stickers.slice(0, 6).map((sticker, i) => {
                // Refined overlapping positions with varied sizes for depth
                const positions = [
                  { x: -90, y: -50, size: 82, rotate: -8, breakout: false },
                  { x: 0, y: -70, size: 100, rotate: 0, breakout: true }, // Center top - breakout sticker
                  { x: 90, y: -50, size: 85, rotate: 8, breakout: false },
                  { x: -75, y: 40, size: 80, rotate: -5, breakout: false },
                  { x: 35, y: 30, size: 88, rotate: 5, breakout: false },
                  { x: 105, y: 45, size: 78, rotate: 10, breakout: false },
                ];
                const pos = positions[i] || positions[0];
                const isBreakout = pos.breakout;
                
                // Animation delays for scatter effect (different for each sticker)
                const animationDelays = [0, 0.3, 0.6, 0.9, 1.2, 1.5];
                const animationDurations = [4, 5, 4.5, 5.5, 4.8, 5.2];
                // Scatter offsets for each sticker (different directions)
                const scatterOffsets = [
                  { x: 5, y: -8 }, { x: -6, y: -10 }, { x: 8, y: -5 },
                  { x: -5, y: 7 }, { x: 6, y: 9 }, { x: -8, y: 6 }
                ];
                const scatter = scatterOffsets[i] || { x: 0, y: 0 };
                
                return (
                  <div
                    key={sticker.id}
                    className="absolute left-1/2 top-1/2 transition-all duration-500 group-hover:scale-105 sticker-float"
                    style={{
                      width: pos.size,
                      height: pos.size,
                      '--base-x': `${pos.x}px`,
                      '--base-y': `${pos.y}px`,
                      '--base-rotate': `${pos.rotate}deg`,
                      '--scatter-x': `${scatter.x}px`,
                      '--scatter-y': `${scatter.y}px`,
                      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) rotate(${pos.rotate}deg)`,
                      zIndex: isBreakout ? 10 : 6 - i,
                      animation: `stickerFloat ${animationDurations[i]}s ease-in-out infinite`,
                      animationDelay: `${animationDelays[i]}s`,
                    } as React.CSSProperties}
                  >
                    {/* Circle container with subtle border */}
                    <div 
                      className={`
                        w-full h-full rounded-full overflow-visible
                        ${isBreakout 
                          ? 'border-[3px] border-white/60 shadow-2xl shadow-pink-500/30' 
                          : 'border-2 border-white/40 shadow-lg'
                        }
                        transition-all duration-500
                        group-hover:border-white/80
                        ${isBreakout ? 'group-hover:shadow-pink-500/50' : 'group-hover:shadow-xl'}
                        bg-white/5 backdrop-blur-sm
                      `}
                    >
                      {/* Image container - allows breakout for center sticker */}
                      <div 
                        className={`
                          absolute inset-0 rounded-full
                          ${isBreakout ? 'scale-110' : 'scale-100'}
                          transition-transform duration-500
                        `}
                      >
                        <div className="absolute inset-0 flex items-center justify-center p-1.5">
                          <div className="relative w-full h-full">
                            <Image
                              src={sticker.imageUrl || sticker.thumbnailUrl || '/placeholder-sticker.png'}
                              alt={sticker.title}
                              fill
                              className="object-contain"
                              sizes="(max-width: 1024px) 85px, 96px"
                              priority={i < 3}
                              loading={i < 3 ? "eager" : "lazy"}
                              unoptimized={false}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Decorative glow for breakout sticker */}
                      {isBreakout && (
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-orange-500/20 blur-xl -z-10 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Fallback if no stickers loaded */}
              {stickers.length === 0 && (
                <>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="absolute left-1/2 top-1/2 rounded-full bg-gradient-to-br from-pink-400/30 to-orange-400/30 border-2 border-white/20"
                      style={{
                        width: 70 - i * 10,
                        height: 70 - i * 10,
                        transform: `translate(calc(-50% + ${(i - 1) * 60}px), calc(-50% + ${i * 15 - 20}px))`,
                      }}
                    />
                  ))}
                </>
              )}
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

      {/* Sticker floating animation styles */}
      <style jsx global>{`
        @keyframes stickerFloat {
          0%, 100% {
            transform: translate(calc(-50% + var(--base-x, 0px)), calc(-50% + var(--base-y, 0px))) 
                       rotate(var(--base-rotate, 0deg)) 
                       translate(0px, 0px);
          }
          25% {
            transform: translate(calc(-50% + var(--base-x, 0px)), calc(-50% + var(--base-y, 0px))) 
                       rotate(var(--base-rotate, 0deg)) 
                       translate(calc(var(--scatter-x, 0px) * 0.7), calc(var(--scatter-y, 0px) * 0.7));
          }
          50% {
            transform: translate(calc(-50% + var(--base-x, 0px)), calc(-50% + var(--base-y, 0px))) 
                       rotate(var(--base-rotate, 0deg)) 
                       translate(calc(var(--scatter-x, 0px) * -0.5), calc(var(--scatter-y, 0px) * -0.5));
          }
          75% {
            transform: translate(calc(-50% + var(--base-x, 0px)), calc(-50% + var(--base-y, 0px))) 
                       rotate(var(--base-rotate, 0deg)) 
                       translate(calc(var(--scatter-x, 0px) * 0.9), calc(var(--scatter-y, 0px) * 0.9));
          }
        }
      `}</style>
    </div>
  );
}
