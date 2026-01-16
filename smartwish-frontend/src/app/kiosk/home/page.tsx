"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useKioskConfig } from "@/hooks/useKioskConfig";
import { useKioskSession } from "@/contexts/KioskSessionContext";
import { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import useSWR from "swr";

// Gift card brand type
interface GiftCardBrand {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  description?: string;
}

// Cache keys
const TEMPLATES_CACHE_KEY = 'swr_cache_/api/templates?limit=5&sort=popularity';
const STICKERS_CACHE_KEY = 'swr_cache_/api/stickers?limit=200';
const STICKER_PROPS_CACHE_KEY = 'kiosk_sticker_properties_v2';

// Deterministic pseudo-random number generator based on seed
// This ensures consistent properties for each sticker index
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

// Generate sticker properties deterministically based on index
// This allows instant rendering without waiting for data
const generateStickerProps = (index: number, stickerId?: string) => {
  const seed = stickerId ? stickerId.charCodeAt(0) * 1000 + index : index * 12345;
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);
  const r4 = seededRandom(seed + 3);
  const r5 = seededRandom(seed + 4);
  const r6 = seededRandom(seed + 5);
  
  return {
    xPos: Math.round((r1 * 300 - 150) * 100) / 100,
    size: Math.round(100 + (r2 * 40)),
    minScale: Math.round((0.8 + (r3 * 0.2)) * 1000) / 1000,
    maxScale: Math.round((1.0 + (r4 * 0.25)) * 1000) / 1000,
    rotation: Math.round((r5 * 70 - 35) * 100) / 100,
    delay: Math.round((r6 * 20) * 100) / 100,
    duration: Math.round((4 + (r1 * 3)) * 100) / 100,
    driftAmount: Math.round((r2 * 60 - 30) * 100) / 100,
    speedVariation: Math.round((0.8 + (r3 * 0.4)) * 1000) / 1000,
    zIndex: 10 + (index % 10),
  };
};

// Pre-generate properties for 30 stickers (used as fallback)
const DEFAULT_STICKER_PROPERTIES: Record<string, ReturnType<typeof generateStickerProps>> = {};
for (let i = 0; i < 30; i++) {
  DEFAULT_STICKER_PROPERTIES[`sticker-${i}`] = generateStickerProps(i);
}

// Synchronous cache getter for initial data
const getCachedData = <T>(cacheKey: string): T | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Use cache if less than 24 hours old
      if (Date.now() - timestamp < 86400000) {
        return data;
      }
    }
  } catch (e) {
    // Ignore cache read errors
  }
  return undefined;
};

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
  const searchParams = useSearchParams();
  const { isKiosk, isInitialized } = useDeviceMode();
  const { config: kioskConfig } = useKioskConfig();
  const { startSession, trackTileSelect } = useKioskSession();
  
  // Debug logging for page lifecycle
  console.log("🏠 [KioskHome] Render:", {
    isKiosk,
    isInitialized,
    timestamp: new Date().toISOString(),
  });

  // Enter fullscreen when arriving from pairing
  useEffect(() => {
    const pairingComplete = searchParams.get('pairingComplete');
    if (pairingComplete === 'true') {
      // Remove the query parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('pairingComplete');
      window.history.replaceState({}, '', url.toString());
      
      // Enter fullscreen mode
      const enterFullscreen = () => {
        try {
          const doc = document.documentElement;
          if (doc.requestFullscreen) {
            doc.requestFullscreen();
          } else if ((doc as any).webkitRequestFullscreen) {
            // Safari
            (doc as any).webkitRequestFullscreen();
          } else if ((doc as any).msRequestFullscreen) {
            // IE/Edge
            (doc as any).msRequestFullscreen();
          } else if ((doc as any).mozRequestFullScreen) {
            // Firefox
            (doc as any).mozRequestFullScreen();
          }
        } catch (error) {
          console.error('Error entering fullscreen:', error);
        }
      };
      
      // Small delay to ensure page is fully loaded
      setTimeout(enterFullscreen, 500);
    }
  }, [searchParams]);

  // Check if features are enabled (default to true if not set)
  const greetingCardsEnabled = kioskConfig?.greetingCardsEnabled !== false;
  const stickersEnabled = kioskConfig?.stickersEnabled !== false;
  
  // Gift card tile configuration
  const giftCardTileConfig = kioskConfig?.giftCardTile;
  const giftCardTileEnabled = giftCardTileConfig?.enabled && giftCardTileConfig?.visibility === 'visible';
  const giftCardTileDisabled = giftCardTileConfig?.enabled && giftCardTileConfig?.visibility === 'disabled';
  const showGiftCardTile = giftCardTileEnabled || giftCardTileDisabled;

  // Fetch gift card brand info when brandId is set
  const [giftCardBrand, setGiftCardBrand] = useState<GiftCardBrand | null>(null);
  const [logoBackgroundColor, setLogoBackgroundColor] = useState<string>('#ffffff');
  
  // Extract dominant edge color from an image URL
  const extractEdgeColor = (imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve('#ffffff');
            return;
          }
          
          // Use small canvas for performance
          canvas.width = 50;
          canvas.height = 50;
          ctx.drawImage(img, 0, 0, 50, 50);
          
          // Sample colors from edges (corners and midpoints)
          const samplePoints = [
            [0, 0], [49, 0], [0, 49], [49, 49], // corners
            [25, 0], [25, 49], [0, 25], [49, 25], // edge midpoints
          ];
          
          const colors: number[][] = [];
          for (const [x, y] of samplePoints) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            // Skip fully transparent pixels
            if (pixel[3] > 50) {
              colors.push([pixel[0], pixel[1], pixel[2]]);
            }
          }
          
          if (colors.length === 0) {
            resolve('#ffffff');
            return;
          }
          
          // Average the sampled colors
          const avg = colors.reduce(
            (acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]],
            [0, 0, 0]
          ).map(v => Math.round(v / colors.length));
          
          const hex = `#${avg.map(v => v.toString(16).padStart(2, '0')).join('')}`;
          resolve(hex);
        } catch {
          resolve('#ffffff');
        }
      };
      img.onerror = () => resolve('#ffffff');
      img.src = imageUrl;
    });
  };
  
  useEffect(() => {
    if (giftCardTileConfig?.brandId) {
      fetch(`/api/admin/gift-card-brands/${giftCardTileConfig.brandId}`)
        .then((res) => res.ok ? res.json() : null)
        .then(async (data) => {
          if (data?.data) {
            setGiftCardBrand(data.data);
            // Extract background color from logo
            if (data.data.logo_url) {
              const color = await extractEdgeColor(data.data.logo_url);
              setLogoBackgroundColor(color);
            }
          }
        })
        .catch((err) => console.error('Failed to fetch gift card brand:', err));
    }
  }, [giftCardTileConfig?.brandId]);

  // Track if component has mounted (for hydration-safe rendering)
  const [hasMounted, setHasMounted] = useState(false);
  
  // Get cached data on first client render using a ref (avoids re-computation)
  // This is initialized to undefined on server, then populated on client mount
  const cachedDataRef = useRef<{
    templates?: TemplatesResponse;
    stickers?: StickersResponse;
  } | null>(null);
  
  // Initialize cached data ref on first client render
  if (typeof window !== 'undefined' && cachedDataRef.current === null) {
    cachedDataRef.current = {
      templates: getCachedData<TemplatesResponse>(TEMPLATES_CACHE_KEY),
      stickers: getCachedData<StickersResponse>(STICKERS_CACHE_KEY),
    };
  }
  
  useEffect(() => {
    console.log("🏠 [KioskHome] Component MOUNTED");
    setHasMounted(true);
    
    return () => {
      console.log("🏠 [KioskHome] Component UNMOUNTED");
    };
  }, []);

  // Fetch popular templates with aggressive caching and fallback data
  const { data: templatesData } = useSWR<TemplatesResponse>(
    "/api/templates?limit=5&sort=popularity",
    fetcher,
    {
      revalidateOnFocus: false, // Don't revalidate when window regains focus
      revalidateOnReconnect: false, // Don't revalidate on reconnect
      dedupingInterval: 60000, // Dedupe requests within 60 seconds
      refreshInterval: 0, // Don't auto-refresh
      keepPreviousData: true, // Keep showing old data while fetching new
      fallbackData: cachedDataRef.current?.templates, // Use cached data immediately
    }
  );

  // Fetch stickers directly - NO LONGER waiting for categories
  const { data: stickersDataAll } = useSWR<StickersResponse>(
    `/api/stickers?limit=200`, // Fetch directly without waiting
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      refreshInterval: 0,
      keepPreviousData: true,
      fallbackData: cachedDataRef.current?.stickers, // Use cached data immediately
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

  // Sticker properties - computed deterministically for instant rendering
  // Uses memoization to generate properties once per sticker set
  const stickerProperties = useMemo(() => {
    if (stickers.length === 0) {
      // Return default properties for placeholders while loading
      return DEFAULT_STICKER_PROPERTIES;
    }
    
    // Try to load cached properties first
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STICKER_PROPS_CACHE_KEY);
        if (cached) {
          const { props, stickerIds } = JSON.parse(cached);
          const currentIds = stickers.slice(0, 30).map(s => s.id).join(',');
          if (stickerIds === currentIds) {
            return props;
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    // Generate properties deterministically based on sticker IDs
    const props: Record<string, ReturnType<typeof generateStickerProps>> = {};
    stickers.slice(0, 30).forEach((sticker, i) => {
      const key = sticker.id || `sticker-${i}`;
      props[key] = generateStickerProps(i, sticker.id);
    });
    
    // Cache the generated properties
    if (typeof window !== 'undefined') {
      try {
        const stickerIds = stickers.slice(0, 30).map(s => s.id).join(',');
        localStorage.setItem(STICKER_PROPS_CACHE_KEY, JSON.stringify({ props, stickerIds }));
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    return props;
  }, [stickers]);

  // Preload images for faster display
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Preload first 5 template images
    templates.slice(0, 5).forEach((template) => {
      const img = template.cover_image || template.image_1;
      if (img) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = img;
        // Don't add duplicate preloads
        if (!document.querySelector(`link[href="${img}"]`)) {
          document.head.appendChild(link);
        }
      }
    });
    
    // Preload first 10 sticker images (most visible ones)
    stickers.slice(0, 10).forEach((sticker) => {
      const img = sticker.imageUrl || sticker.thumbnailUrl;
      if (img) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = img;
        // Don't add duplicate preloads
        if (!document.querySelector(`link[href="${img}"]`)) {
          document.head.appendChild(link);
        }
      }
    });
  }, [templates, stickers]);

  // Redirect non-kiosk users away from this page (only after initialization)
  useEffect(() => {
    console.log("🏠 [KioskHome] Redirect check:", { isInitialized, isKiosk });
    if (isInitialized && !isKiosk) {
      console.log("🏠 [KioskHome] ⚠️ NOT KIOSK MODE - redirecting to /");
      router.replace("/");
    }
  }, [isKiosk, isInitialized, router]);

  const handleSelectGreetingCards = async () => {
    if (!greetingCardsEnabled) return;
    // Start session and track tile selection
    await startSession();
    trackTileSelect('greeting_cards');
    router.push("/templates");
  };

  const handleSelectStickers = async () => {
    if (!stickersEnabled) return;
    // Start session and track tile selection
    await startSession();
    trackTileSelect('stickers');
    router.push("/stickers");
  };

  const handleSelectGiftCard = async () => {
    if (!giftCardTileEnabled || !giftCardTileConfig?.brandId) return;
    // Start session and track tile selection
    await startSession();
    trackTileSelect('gift_card', { brandId: giftCardTileConfig.brandId });
    router.push(`/kiosk/gift-card?brandId=${giftCardTileConfig.brandId}`);
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

      {/* Product Selection Cards - Main Row */}
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
              {/* Only render templates after mount to avoid hydration mismatch */}
              {hasMounted && templates.slice(0, 5).map((template, i) => {
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
                      priority={true} // Prioritize all template images
                      loading="eager"
                      unoptimized={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  </div>
                );
              })}
              {/* Fallback shown during SSR and while loading */}
              {(!hasMounted || templates.length === 0) && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 lg:w-32 rounded-xl bg-gradient-to-br from-indigo-400/30 to-purple-400/30 border-2 border-white/20 flex items-center justify-center" style={{ aspectRatio: '5 / 7' }}>
                  <div className="text-white/60 text-4xl">🎴</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Content with semi-transparent overlay for readability */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-32 pb-10 px-8">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 group-hover:text-indigo-200 transition-colors duration-300 drop-shadow-lg">
                Greeting Cards
              </h2>
              <p className="text-base md:text-lg text-gray-200 max-w-sm mb-6 drop-shadow-md">
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
              {/* Only render sticker rain after mount to avoid hydration mismatch */}
              {hasMounted && (stickers.length > 0 ? stickers.slice(0, 30) : Array.from({ length: 30 }).map((_, i) => ({ id: `sticker-${i}`, imageUrl: null, title: `Sticker ${i + 1}` } as Sticker))).map((sticker, i) => {
                // Get properties for this sticker - use fallback if not found
                const key = sticker.id || `sticker-${i}`;
                const props = stickerProperties[key] || DEFAULT_STICKER_PROPERTIES[`sticker-${i}`] || generateStickerProps(i);
                
                const {
                  xPos,
                  size,
                  minScale,
                  maxScale,
                  rotation,
                  delay,
                  duration,
                  driftAmount,
                  speedVariation,
                  zIndex: stableZIndex,
                } = props;
                
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
                                priority={i < 10} // Prioritize first 10 images
                                loading={i < 10 ? "eager" : "lazy"}
                                unoptimized={false}
                              />
                            ) : (
                              // Show animated placeholder while loading
                              <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-400/30 to-orange-400/30 animate-pulse" />
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
          
          {/* Content with semi-transparent overlay for readability */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-32 pb-10 px-8">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 group-hover:text-pink-200 transition-colors duration-300 drop-shadow-lg">
                Stickers
              </h2>
              <p className="text-base md:text-lg text-gray-200 max-w-sm mb-6 drop-shadow-md">
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
          </div>
        </button>
      </div>

      {/* Gift Card Option - Separate Row, Centered */}
      {showGiftCardTile && (
        <div className="relative flex justify-center w-full max-w-7xl mt-8 lg:mt-12">
          <button
            onClick={handleSelectGiftCard}
            disabled={giftCardTileDisabled || !giftCardTileConfig?.brandId}
            className={`group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-[2rem] shadow-2xl transition-all duration-500 transform overflow-hidden border focus:outline-none w-full max-w-xl min-h-[320px] lg:min-h-[360px] ${
              giftCardTileEnabled && giftCardTileConfig?.brandId
                ? 'hover:scale-[1.02] active:scale-[0.98] border-white/20 hover:border-emerald-400/50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed border-white/10'
            }`}
          >
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/0 to-teal-600/0 group-hover:from-emerald-600/20 group-hover:to-teal-600/20 transition-all duration-500" />
            
            {/* Discount badge */}
            {giftCardTileConfig?.discountPercent && giftCardTileConfig.discountPercent > 0 && (
              <div className="absolute top-4 right-4 z-20">
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg animate-pulse">
                  {giftCardTileConfig.discountPercent}% OFF!
                </div>
              </div>
            )}
            
            {/* Horizontal layout for gift card tile */}
            <div className="absolute inset-0 flex items-center">
              {/* Left side - Gift Card Brand Logo or Generic Visuals */}
              <div className="flex-shrink-0 w-1/2 h-full flex items-center justify-center">
                <div className="relative w-64 h-40 flex items-center justify-center">
                  {/* Show brand logo if available - fills the entire space */}
                  {hasMounted && giftCardBrand?.logo_url ? (
                    <div 
                      className="relative w-full h-full rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 group-hover:shadow-emerald-500/50 group-hover:scale-105"
                      style={{ backgroundColor: logoBackgroundColor }}
                    >
                      <Image
                        src={giftCardBrand.logo_url}
                        alt={giftCardBrand.name}
                        fill
                        className="object-contain"
                        sizes="256px"
                      />
                    </div>
                  ) : hasMounted ? (
                    /* Gift card stack animation - fallback when no brand logo */
                    <>
                      {/* Back card */}
                      <div 
                        className="absolute w-40 h-24 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-2xl border-2 border-white/30 transition-all duration-500 group-hover:shadow-emerald-500/40"
                        style={{
                          transform: 'translateY(-6px) rotate(-6deg) scale(0.9)',
                        }}
                      >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
                        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                          <div className="w-6 h-4 rounded bg-amber-300/60" />
                          <div className="w-10 h-1.5 rounded bg-white/30" />
                        </div>
                      </div>
                      
                      {/* Middle card */}
                      <div 
                        className="absolute w-40 h-24 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 shadow-2xl border-2 border-white/30 transition-all duration-500 group-hover:shadow-teal-500/40"
                        style={{
                          transform: 'translateY(0px) rotate(0deg) scale(0.95)',
                        }}
                      >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
                        <div className="absolute top-2 right-2">
                          <div className="text-white/60 text-lg">🎁</div>
                        </div>
                      </div>
                      
                      {/* Front card */}
                      <div 
                        className="absolute w-40 h-24 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-2xl border-2 border-white/40 transition-all duration-500 group-hover:shadow-emerald-500/50 group-hover:scale-105"
                        style={{
                          transform: 'translateY(6px) rotate(6deg)',
                        }}
                      >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
                        <div className="absolute top-2 left-2 text-white/90 font-bold text-xs">
                          Gift Card
                        </div>
                        <div className="absolute top-2 right-2">
                          <div className="text-white text-lg">💳</div>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-4 rounded bg-amber-400/80" />
                            <div className="w-12 h-1.5 rounded bg-white/40" />
                          </div>
                          <div className="text-white/80 text-[10px] font-mono">****</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Fallback shown during SSR */
                    <div className="w-40 h-24 rounded-xl bg-gradient-to-br from-emerald-400/30 to-teal-400/30 border-2 border-white/20 flex items-center justify-center">
                      <div className="text-white/60 text-3xl">🎁</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right side - Content */}
              <div className="flex-1 pr-8 py-8">
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 group-hover:text-emerald-200 transition-colors duration-300 drop-shadow-lg">
                  {giftCardTileConfig?.displayName || 'Gift Card'}
                </h2>
                <p className="text-sm md:text-base text-gray-300 mb-6 drop-shadow-md">
                  {giftCardTileConfig?.description || 'Purchase a gift card for yourself or a loved one'}
                </p>
                
                {/* CTA */}
                <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full font-semibold text-base transition-all duration-300 ${
                  giftCardTileEnabled && giftCardTileConfig?.brandId
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/40 group-hover:shadow-emerald-500/60'
                    : 'bg-gray-600/50 text-gray-400'
                }`}>
                  <span>{giftCardTileEnabled && giftCardTileConfig?.brandId ? 'Buy Now' : 'Coming Soon'}</span>
                  {giftCardTileEnabled && giftCardTileConfig?.brandId && (
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </button>
        </div>
      )}

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
