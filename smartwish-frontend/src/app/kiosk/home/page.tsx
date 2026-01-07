"use client";

import { useRouter } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useKioskConfig } from "@/hooks/useKioskConfig";
import { useEffect, useState } from "react";
import Image from "next/image";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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

  // Fetch popular templates
  const { data: templatesData } = useSWR<TemplatesResponse>(
    "/api/templates?limit=5&sort=popularity",
    fetcher
  );

  // Fetch stickers
  const { data: stickersData } = useSWR<StickersResponse>(
    "/api/stickers?limit=6",
    fetcher
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
          
          {/* Stickers Display - Hexagonal/honeycomb pattern */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full flex justify-center">
            <div className="relative w-80 h-56 lg:w-96 lg:h-64">
              {stickers.slice(0, 6).map((sticker, i) => {
                // Honeycomb-style layout
                const positions = [
                  { x: -70, y: -50, size: 72 },
                  { x: 0, y: -65, size: 80 },
                  { x: 70, y: -50, size: 68 },
                  { x: -55, y: 30, size: 64 },
                  { x: 25, y: 20, size: 88 },
                  { x: 85, y: 35, size: 60 },
                ];
                const pos = positions[i] || positions[0];
                
                return (
                  <div
                    key={sticker.id}
                    className="absolute left-1/2 top-1/2 rounded-full shadow-xl overflow-hidden border-4 border-white/50 transition-all duration-500 group-hover:shadow-pink-500/40 group-hover:scale-110 group-hover:border-white/70"
                    style={{
                      width: pos.size,
                      height: pos.size,
                      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                      zIndex: 6 - i,
                    }}
                  >
                    <Image
                      src={sticker.imageUrl || sticker.thumbnailUrl || '/placeholder-sticker.png'}
                      alt={sticker.title}
                      fill
                      className="object-cover"
                      sizes="88px"
                    />
                  </div>
                );
              })}
              {/* Fallback if no stickers loaded */}
              {stickers.length === 0 && (
                <>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="absolute left-1/2 top-1/2 rounded-full bg-gradient-to-br from-pink-400/30 to-orange-400/30 border-4 border-white/20"
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
    </div>
  );
}
