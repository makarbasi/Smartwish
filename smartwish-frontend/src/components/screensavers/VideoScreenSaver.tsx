"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getYouTubeEmbedUrl } from "@/utils/screenSaverUtils";
import localAssetDB from "@/lib/LocalAssetDB";

interface VideoScreenSaverProps {
  url: string;
  onExit: (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => void;
  overlayText?: string;
  /** Called when video is loaded and ready to display - used for pre-loading */
  onReady?: () => void;
  /** If true, video is hidden (used for pre-loading in background) */
  isPreloading?: boolean;
  /** If true, video was pre-loaded and should not show loading spinner */
  initiallyLoaded?: boolean;
}

/**
 * VideoScreenSaver - Fullscreen video player for screen saver
 * 
 * Features:
 * - Supports direct video URLs (MP4, WebM) and YouTube URLs
 * - **IndexedDB caching** - Videos are cached locally for instant loading
 * - Always muted (no sound)
 * - Autoplay with loop
 * - Fullscreen display
 * - Touch/click to dismiss (handled by parent)
 * - **Pre-loading support** - onReady callback when loaded
 */
export default function VideoScreenSaver({ url, onExit, overlayText, onReady, isPreloading, initiallyLoaded }: VideoScreenSaverProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isYouTube, setIsYouTube] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  // Start with loading=false if the video was preloaded
  const [isLoading, setIsLoading] = useState(!initiallyLoaded);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const onReadyCalledRef = useRef(initiallyLoaded || false);

  // Determine video type and load from cache or cloud
  useEffect(() => {
    onReadyCalledRef.current = false; // Reset on URL change
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      // YouTube videos can't be cached, use embed
      setIsYouTube(true);
      const embed = getYouTubeEmbedUrl(url);
      setEmbedUrl(embed);
      setIsLoading(false);
      // YouTube is ready immediately (iframe loads async but we can't track it)
      if (onReady && !onReadyCalledRef.current) {
        onReadyCalledRef.current = true;
        onReady();
      }
    } else {
      // Direct video URL - try to load from cache first
      setIsYouTube(false);
      setEmbedUrl(null);
      setIsLoading(true);
      loadVideoWithCache(url);
    }
    setHasError(false);
  }, [url]);

  // Load video from IndexedDB cache, or fetch from cloud and cache it
  const loadVideoWithCache = useCallback(async (videoUrl: string) => {
    try {
      console.log('[VideoScreenSaver] Loading video:', videoUrl);

      // Try to get from cache first
      const cachedBlob = await localAssetDB.getImageBlob(videoUrl);

      if (cachedBlob) {
        console.log('[VideoScreenSaver] ✅ Loaded from cache');
        const blobUrl = URL.createObjectURL(cachedBlob);
        setVideoSrc(blobUrl);
        setIsLoading(false);
        return;
      }

      console.log('[VideoScreenSaver] Cache miss - fetching from cloud...');

      // Fetch from cloud
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const blob = await response.blob();
      console.log(`[VideoScreenSaver] Downloaded ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      // Cache for next time
      await localAssetDB.cacheImageBlob(videoUrl, blob);
      console.log('[VideoScreenSaver] ✅ Cached for future use');

      // Create blob URL and play
      const blobUrl = URL.createObjectURL(blob);
      setVideoSrc(blobUrl);
      setIsLoading(false);

    } catch (error) {
      console.error('[VideoScreenSaver] Failed to load video:', error);
      // Fallback to direct URL (streaming without cache)
      setVideoSrc(url);
      setIsLoading(false);
    }
  }, []);

  // Cleanup blob URLs on unmount or URL change
  useEffect(() => {
    return () => {
      if (videoSrc && videoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  // Handle video errors
  const handleVideoError = useCallback(() => {
    console.error("[VideoScreenSaver] Video failed to load:", url);
    setHasError(true);
    setIsLoading(false);
  }, [url]);

  // Ensure video plays when src is set
  useEffect(() => {
    if (videoRef.current && videoSrc && !isYouTube) {
      videoRef.current.play().catch((err) => {
        console.warn("[VideoScreenSaver] Autoplay failed:", err);
      });
    }
  }, [isYouTube, videoSrc]);

  // Show error state
  if (hasError) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center text-white/60">
          <p className="text-lg">Video could not be loaded</p>
          <p className="text-sm mt-2 text-white/40">Tap anywhere to continue</p>
        </div>
      </div>
    );
  }

  // Render YouTube embed
  if (isYouTube && embedUrl) {
    return (
      <div className="absolute inset-0 bg-black">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ border: "none", pointerEvents: "none" }}
          title="Screen Saver Video"
        />
        {/* Overlay Text */}
        {overlayText && (
          <div className="absolute top-8 left-0 right-0 z-20 flex justify-center pointer-events-none">
            <div className="px-8 py-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 shadow-2xl max-w-4xl mx-4 overlay-text-glow">
              <p className="text-3xl md:text-4xl font-semibold text-white text-center leading-tight tracking-wide">
                {overlayText}
              </p>
            </div>
          </div>
        )}
        {/* Overlay to capture clicks - YouTube iframe won't receive them */}
        <div
          className="absolute inset-0 z-10"
          style={{ pointerEvents: "auto" }}
        />
      </div>
    );
  }

  // Render direct video
  return (
    <div className={`absolute inset-0 bg-black ${isPreloading ? 'opacity-0 pointer-events-none' : ''}`}>
      {/* Loading indicator - only show if not preloading */}
      {isLoading && !isPreloading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}

      {/* Video element - uses cached blob URL or falls back to direct URL */}
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-cover"
          autoPlay={!isPreloading}
          loop
          muted
          playsInline
          onError={handleVideoError}
          onCanPlay={() => {
            console.log('[VideoScreenSaver] Video can play - calling onReady');
            setIsLoading(false);
            if (onReady && !onReadyCalledRef.current) {
              onReadyCalledRef.current = true;
              onReady();
            }
          }}
          style={{ pointerEvents: "none", opacity: isLoading ? 0 : 1 }}
        />
      )}

      {/* Overlay Text */}
      {overlayText && !isLoading && (
        <div className="absolute top-8 left-0 right-0 z-20 flex justify-center pointer-events-none">
          <div className="px-8 py-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 shadow-2xl max-w-4xl mx-4 overlay-text-glow">
            <p className="text-3xl md:text-4xl font-semibold text-white text-center leading-tight tracking-wide">
              {overlayText}
            </p>
          </div>
        </div>
      )}

      {/* Tap to dismiss hint - fades out after a moment */}
      {!isLoading && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none animate-fade-out-delayed">
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
