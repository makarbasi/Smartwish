"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  GiftIcon,
  SparklesIcon,
  HomeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

type ProductType = "greeting-cards" | "stickers";

export default function KioskProductSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Determine current product type based on path
  const getCurrentProduct = (): ProductType => {
    if (pathname.startsWith("/stickers")) return "stickers";
    return "greeting-cards";
  };

  const currentProduct = getCurrentProduct();

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

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2.5 shadow-lg border border-gray-200 hover:bg-white hover:shadow-xl transition-all duration-200 group"
        aria-label="Switch product type"
      >
        {currentProduct === "greeting-cards" ? (
          <>
            <GiftIcon className="w-5 h-5 text-indigo-600" />
            <span className="font-medium text-gray-900 hidden sm:inline">Greeting Cards</span>
          </>
        ) : (
          <>
            <SparklesIcon className="w-5 h-5 text-pink-600" />
            <span className="font-medium text-gray-900 hidden sm:inline">Stickers</span>
          </>
        )}
        <svg
          className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Switch Product</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Product Options */}
            <div className="space-y-3">
              {/* Greeting Cards */}
              <button
                onClick={() => handleNavigate("greeting-cards")}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 ${
                  currentProduct === "greeting-cards"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  currentProduct === "greeting-cards"
                    ? "bg-indigo-100"
                    : "bg-gray-100"
                }`}>
                  <GiftIcon className={`w-7 h-7 ${
                    currentProduct === "greeting-cards"
                      ? "text-indigo-600"
                      : "text-gray-500"
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-gray-900">Greeting Cards</h3>
                  <p className="text-sm text-gray-500">Personalized cards for every occasion</p>
                </div>
                {currentProduct === "greeting-cards" && (
                  <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Stickers */}
              <button
                onClick={() => handleNavigate("stickers")}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 ${
                  currentProduct === "stickers"
                    ? "border-pink-500 bg-pink-50"
                    : "border-gray-200 hover:border-pink-300 hover:bg-pink-50/50"
                }`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  currentProduct === "stickers"
                    ? "bg-pink-100"
                    : "bg-gray-100"
                }`}>
                  <SparklesIcon className={`w-7 h-7 ${
                    currentProduct === "stickers"
                      ? "text-pink-600"
                      : "text-gray-500"
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-gray-900">Stickers</h3>
                  <p className="text-sm text-gray-500">Custom stickers and labels</p>
                </div>
                {currentProduct === "stickers" && (
                  <div className="w-6 h-6 bg-pink-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-gray-200" />

            {/* Home Button */}
            <button
              onClick={handleGoHome}
              className="w-full flex items-center justify-center gap-2 p-4 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
            >
              <HomeIcon className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-700">Back to Product Selection</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
