"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface HtmlScreenSaverProps {
  url: string;
  onExit: (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => void;
  overlayText?: string;
  interactive?: boolean;
  onActivity?: () => void;
}

/**
 * HtmlScreenSaver - Fullscreen iframe renderer for HTML screen savers
 * 
 * Features:
 * - Loads HTML content via iframe
 * - Fullscreen display
 * - Touch/click overlay to dismiss (handled by parent) - unless interactive mode
 * - Interactive mode: allows user to interact with iframe content
 * - Error handling with fallback display
 */
export default function HtmlScreenSaver({ url, onExit, overlayText, interactive, onActivity }: HtmlScreenSaverProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cleanupActivityListenersRef = useRef<(() => void) | null>(null);
  
  // Use ref to always have the latest onActivity callback
  // This prevents stale closure issues when iframe event handlers call onActivity
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  // Reset state when URL changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [url]);

  const attachActivityListeners = useCallback(() => {
    if (!iframeRef.current) return;
    try {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!iframeDoc) return;

      console.log("[HtmlScreenSaver] Attaching activity listeners to iframe content");
      cleanupActivityListenersRef.current?.();

      // Use ref to always call the latest onActivity (prevents stale closure)
      const activityHandler = () => {
        console.log("[HtmlScreenSaver] Activity inside iframe detected");
        onActivityRef.current?.();
      };

      // Listen for all user interactions inside the iframe
      // Use capture to catch events even if inner content stops propagation
      const listenerOptions: AddEventListenerOptions = { passive: true, capture: true };
      iframeDoc.addEventListener('pointermove', activityHandler, listenerOptions);
      iframeDoc.addEventListener('pointerdown', activityHandler, listenerOptions);
      iframeDoc.addEventListener('pointerup', activityHandler, listenerOptions);
      iframeDoc.addEventListener('mousemove', activityHandler, listenerOptions);
      iframeDoc.addEventListener('mousedown', activityHandler, listenerOptions);
      iframeDoc.addEventListener('touchstart', activityHandler, listenerOptions);
      iframeDoc.addEventListener('touchmove', activityHandler, listenerOptions);
      iframeDoc.addEventListener('keydown', activityHandler, listenerOptions);
      iframeDoc.addEventListener('scroll', activityHandler, listenerOptions);
      iframeDoc.addEventListener('wheel', activityHandler, listenerOptions);
      iframeDoc.addEventListener('click', activityHandler, listenerOptions);

      // Store cleanup function
      cleanupActivityListenersRef.current = () => {
        iframeDoc.removeEventListener('pointermove', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('pointerdown', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('pointerup', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('mousemove', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('mousedown', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('touchstart', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('touchmove', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('keydown', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('scroll', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('wheel', activityHandler, listenerOptions);
        iframeDoc.removeEventListener('click', activityHandler, listenerOptions);
      };
    } catch (e) {
      // Cross-origin iframe - can't access content
      console.log("[HtmlScreenSaver] Cannot access iframe content (cross-origin):", e);
    }
  }, []);

  // Handle iframe load - attach activity listeners to iframe content for interactive mode
  const handleLoad = useCallback(() => {
    console.log("[HtmlScreenSaver] Iframe loaded successfully");
    setIsLoading(false);

    if (interactive) {
      attachActivityListeners();
    }
  }, [interactive, attachActivityListeners]);

  // Handle iframe error
  const handleError = useCallback(() => {
    console.error("[HtmlScreenSaver] Failed to load HTML:", url);
    setHasError(true);
    setIsLoading(false);
  }, [url]);

  // Handle activity tracking for interactive mode
  const handleActivityTracking = useCallback(() => {
    if (interactive) {
      onActivityRef.current?.();
    }
  }, [interactive]);

  // Toggle iframe activity listeners when interactive changes
  useEffect(() => {
    if (interactive) {
      attachActivityListeners();
    } else {
      cleanupActivityListenersRef.current?.();
    }
  }, [interactive, attachActivityListeners]);

  // Cleanup iframe activity listeners on unmount
  useEffect(() => {
    return () => {
      cleanupActivityListenersRef.current?.();
    };
  }, []);

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
    <div 
      className="absolute inset-0 bg-black"
      onMouseMove={interactive ? handleActivityTracking : undefined}
      onTouchStart={interactive ? handleActivityTracking : undefined}
      onClick={interactive ? handleActivityTracking : undefined}
    >
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}
      
      {/* HTML content iframe */}
      <iframe
        ref={iframeRef}
        src={url}
        className="w-full h-full"
        onLoad={handleLoad}
        onError={handleError}
        style={{ 
          border: "none", 
          pointerEvents: interactive ? "auto" : "none",
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease-in-out",
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="Screen Saver Content"
      />
      
      {/* Overlay Text */}
      {overlayText && !isLoading && (
        <div className="absolute top-8 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="px-8 py-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 shadow-2xl max-w-4xl mx-4 overlay-text-glow">
            <p className="text-3xl md:text-4xl font-semibold text-white text-center leading-tight tracking-wide">
              {overlayText}
            </p>
          </div>
        </div>
      )}
      
      {/* Overlay to capture clicks - only when NOT interactive */}
      {!interactive && (
        <div 
          className="absolute inset-0 z-10"
          style={{ pointerEvents: "auto" }}
        />
      )}
      
      {/* Tap to dismiss hint - only show when not interactive */}
      {!isLoading && !interactive && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none animate-fade-out-delayed z-30">
          <div className="px-6 py-3 rounded-full bg-black/40 backdrop-blur-sm text-white/70 text-sm">
            Tap anywhere to continue
          </div>
        </div>
      )}
      
      {/* Interactive mode indicator */}
      {!isLoading && interactive && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none z-30">
          <div className="px-6 py-3 rounded-full bg-black/40 backdrop-blur-sm text-white/70 text-sm animate-fade-out-delayed">
            Interactive mode - content will rotate after inactivity
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

        .overlay-text-glow {
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.15),
                      0 0 40px rgba(255, 255, 255, 0.1),
                      0 0 60px rgba(255, 255, 255, 0.05),
                      inset 0 0 20px rgba(255, 255, 255, 0.05);
          animation: subtleGlow 3s ease-in-out infinite;
        }

        @keyframes subtleGlow {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.15),
                        0 0 40px rgba(255, 255, 255, 0.1),
                        0 0 60px rgba(255, 255, 255, 0.05),
                        inset 0 0 20px rgba(255, 255, 255, 0.05);
          }
          50% {
            box-shadow: 0 0 30px rgba(255, 255, 255, 0.2),
                        0 0 50px rgba(255, 255, 255, 0.15),
                        0 0 70px rgba(255, 255, 255, 0.08),
                        inset 0 0 25px rgba(255, 255, 255, 0.08);
          }
        }
      `}</style>
    </div>
  );
}
