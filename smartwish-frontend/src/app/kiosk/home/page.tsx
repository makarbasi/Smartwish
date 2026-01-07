"use client";

import { useRouter } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useEffect } from "react";
import {
  GiftIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export default function KioskHomePage() {
  const router = useRouter();
  const { isKiosk, isInitialized } = useDeviceMode();

  // Redirect non-kiosk users away from this page (only after initialization)
  useEffect(() => {
    if (isInitialized && !isKiosk) {
      router.replace("/");
    }
  }, [isKiosk, isInitialized, router]);

  const handleSelectGreetingCards = () => {
    router.push("/templates");
  };

  const handleSelectStickers = () => {
    router.push("/stickers");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
          Welcome to <span className="text-indigo-600">SmartWish</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-600">
          What would you like to create today?
        </p>
      </div>

      {/* Product Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 lg:gap-16 max-w-6xl w-full">
        {/* Greeting Cards Option */}
        <button
          onClick={handleSelectGreetingCards}
          className="group relative bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] overflow-hidden border-2 border-transparent hover:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-200"
        >
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-300" />
          
          <div className="relative p-8 md:p-12 lg:p-16 flex flex-col items-center text-center">
            {/* Icon */}
            <div className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-6 md:mb-8 group-hover:from-indigo-200 group-hover:to-purple-200 transition-all duration-300">
              <GiftIcon className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 text-indigo-600 group-hover:text-indigo-700 transition-colors duration-300" />
            </div>
            
            {/* Title */}
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 md:mb-4 group-hover:text-indigo-700 transition-colors duration-300">
              Greeting Cards
            </h2>
            
            {/* Description */}
            <p className="text-base md:text-lg lg:text-xl text-gray-600 max-w-sm">
              Create personalized greeting cards for birthdays, holidays, and special occasions
            </p>
            
            {/* Arrow indicator */}
            <div className="mt-6 md:mt-8 flex items-center justify-center text-indigo-600 group-hover:text-indigo-700 transition-colors duration-300">
              <span className="text-lg font-semibold mr-2">Get Started</span>
              <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </button>

        {/* Stickers Option */}
        <button
          onClick={handleSelectStickers}
          className="group relative bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] overflow-hidden border-2 border-transparent hover:border-pink-300 focus:outline-none focus:ring-4 focus:ring-pink-200"
        >
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-orange-500/0 group-hover:from-pink-500/5 group-hover:to-orange-500/5 transition-all duration-300" />
          
          <div className="relative p-8 md:p-12 lg:p-16 flex flex-col items-center text-center">
            {/* Icon */}
            <div className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 bg-gradient-to-br from-pink-100 to-orange-100 rounded-full flex items-center justify-center mb-6 md:mb-8 group-hover:from-pink-200 group-hover:to-orange-200 transition-all duration-300">
              <SparklesIcon className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 text-pink-600 group-hover:text-pink-700 transition-colors duration-300" />
            </div>
            
            {/* Title */}
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 md:mb-4 group-hover:text-pink-700 transition-colors duration-300">
              Stickers
            </h2>
            
            {/* Description */}
            <p className="text-base md:text-lg lg:text-xl text-gray-600 max-w-sm">
              Design and print custom stickers for decorations, labels, and fun
            </p>
            
            {/* Arrow indicator */}
            <div className="mt-6 md:mt-8 flex items-center justify-center text-pink-600 group-hover:text-pink-700 transition-colors duration-300">
              <span className="text-lg font-semibold mr-2">Get Started</span>
              <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </button>
      </div>

      {/* Footer hint */}
      <div className="mt-12 text-center">
        <p className="text-gray-400 text-sm">
          Touch or click a card to begin
        </p>
      </div>
    </div>
  );
}
