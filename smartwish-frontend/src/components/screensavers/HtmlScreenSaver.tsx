"use client";

import { useEffect, useState, useCallback } from "react";

interface HtmlScreenSaverProps {
  url: string;
  onExit: (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => void;
}

/**
 * HtmlScreenSaver - Fullscreen iframe renderer for HTML screen savers
 * 
 * Features:
 * - Loads HTML content via iframe
 * - Fullscreen display
 * - Touch/click overlay to dismiss (handled by parent)
 * - Error handling with fallback display
 */
export default function HtmlScreenSaver({ url, onExit }: HtmlScreenSaverProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset state when URL changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [url]);

  // Handle iframe load
  const handleLoad = useCallback(() => {
    console.log("[HtmlScreenSaver] Iframe loaded successfully");
    setIsLoading(false);
  }, []);

  // Handle iframe error
  const handleError = useCallback(() => {
    console.error("[HtmlScreenSaver] Failed to load HTML:", url);
    setHasError(true);
    setIsLoading(false);
  }, [url]);

  // Show error state
  if (hasError) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center text-white/60">
          <p className="text-lg">Screen saver could not be loaded</p>
          <p className="text-sm mt-2 text-white/40">Tap anywhere to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}
      
      {/* HTML content iframe */}
      <iframe
        src={url}
        className="w-full h-full"
        onLoad={handleLoad}
        onError={handleError}
        style={{ 
          border: "none", 
          pointerEvents: "none",
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease-in-out",
        }}
        sandbox="allow-scripts allow-same-origin"
        title="Screen Saver Content"
      />
      
      {/* Overlay to capture clicks - iframe won't receive them */}
      <div 
        className="absolute inset-0 z-10"
        style={{ pointerEvents: "auto" }}
      />
      
      {/* Tap to dismiss hint */}
      {!isLoading && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none animate-fade-out-delayed z-30">
          <div className="px-6 py-3 rounded-full bg-black/40 backdrop-blur-sm text-white/70 text-sm">
            Tap anywhere to continue
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes fadeOutDelayed {
          0%, 70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        .animate-fade-out-delayed {
          animation: fadeOutDelayed 5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
