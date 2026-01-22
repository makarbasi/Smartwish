"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getYouTubeEmbedUrl } from "@/utils/screenSaverUtils";

interface VideoScreenSaverProps {
  url: string;
  onExit: (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => void;
  overlayText?: string;
}

/**
 * VideoScreenSaver - Fullscreen video player for screen saver
 * 
 * Features:
 * - Supports direct video URLs (MP4, WebM) and YouTube URLs
 * - Always muted (no sound)
 * - Autoplay with loop
 * - Fullscreen display
 * - Touch/click to dismiss (handled by parent)
 */
export default function VideoScreenSaver({ url, onExit, overlayText }: VideoScreenSaverProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isYouTube, setIsYouTube] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // Determine video type and prepare URL
  useEffect(() => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      setIsYouTube(true);
      const embed = getYouTubeEmbedUrl(url);
      setEmbedUrl(embed);
    } else {
      setIsYouTube(false);
      setEmbedUrl(null);
    }
    setHasError(false);
  }, [url]);

  // Handle video errors
  const handleVideoError = useCallback(() => {
    console.error("[VideoScreenSaver] Video failed to load:", url);
    setHasError(true);
  }, [url]);

  // Ensure video plays
  useEffect(() => {
    if (videoRef.current && !isYouTube) {
      videoRef.current.play().catch((err) => {
        console.warn("[VideoScreenSaver] Autoplay failed:", err);
      });
    }
  }, [isYouTube, url]);

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
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        onError={handleVideoError}
        style={{ pointerEvents: "none" }}
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
      {/* Tap to dismiss hint - fades out after a moment */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none animate-fade-out-delayed">
        <div className="px-6 py-3 rounded-full bg-black/40 backdrop-blur-sm text-white/70 text-sm">
          Tap anywhere to continue
        </div>
      </div>
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
