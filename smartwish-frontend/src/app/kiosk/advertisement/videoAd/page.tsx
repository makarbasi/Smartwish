"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";

/**
 * Video Advertisement Page
 * 
 * This page displays a full-screen video with a promotional banner overlay.
 * It's designed to be used as a screensaver with customizable content.
 * 
 * Query Parameters:
 * - videoUrl: URL of the video to display
 * - text: Promotional text to show in the banner
 * 
 * Example URL:
 * /kiosk/advertisement/videoAd?videoUrl=https://example.com/video.mp4&text=Buy your Ice cream with a gift card and save 5%
 */
export default function VideoAdPage() {
    const searchParams = useSearchParams();
    const videoUrl = searchParams.get("videoUrl");
    const text = searchParams.get("text");

    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [mounted, setMounted] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Handle video load
    const handleVideoLoad = () => {
        console.log("[VideoAd] Video loaded successfully");
        setIsLoading(false);
        setHasError(false);
    };

    // Handle video error
    const handleVideoError = () => {
        console.error("[VideoAd] Failed to load video:", videoUrl);
        setHasError(true);
        setIsLoading(false);
    };

    // Auto-play video when loaded
    useEffect(() => {
        if (videoRef.current && !isLoading && !hasError) {
            videoRef.current.play().catch((err) => {
                console.error("[VideoAd] Auto-play failed:", err);
            });
        }
    }, [isLoading, hasError]);

    // Show error state
    if (!videoUrl) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                <div className="text-center text-white/60">
                    <p className="text-lg">No video URL provided</p>
                    <p className="text-sm mt-2 text-white/40">Please specify a videoUrl parameter</p>
                </div>
            </div>
        );
    }

    if (hasError) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                <div className="text-center text-white/60">
                    <p className="text-lg">Failed to load video</p>
                    <p className="text-sm mt-2 text-white/40">{videoUrl}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black overflow-hidden">
            {/* Loading indicator */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
                </div>
            )}

            {/* Full-screen video */}
            <video
                ref={videoRef}
                src={videoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                onLoadedData={handleVideoLoad}
                onError={handleVideoError}
                loop
                muted
                playsInline
                autoPlay
                style={{
                    opacity: isLoading ? 0 : 1,
                    transition: "opacity 0.5s ease-in-out",
                }}
            />

            {/* Promotional Banner - Premium Design (only show if text is provided) */}
            {text && !isLoading && (
                <div className="absolute top-0 left-0 right-0 z-50 flex justify-center pt-20 px-6">
                    <div
                        className="relative bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-center py-5 px-8 rounded-2xl overflow-hidden shadow-2xl max-w-4xl w-full"
                        style={{
                            animation: mounted ? 'pulseGlow 2s ease-in-out 0.5s infinite' : 'none',
                            boxShadow: '0 0 20px rgba(255, 193, 7, 0.6), 0 0 40px rgba(255, 152, 0, 0.4)',
                        }}
                    >
                        {/* Animated shine overlay */}
                        <div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                            style={{
                                animation: mounted ? 'shine 2s infinite' : 'none',
                            }}
                        />

                        {/* Content */}
                        <div className="relative">
                            <p
                                className="text-white font-black text-3xl lg:text-4xl tracking-tight drop-shadow-lg"
                                style={{
                                    textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(255, 200, 0, 0.6)',
                                }}
                            >
                                {text}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulseGlow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(255, 193, 7, 0.6), 0 0 40px rgba(255, 152, 0, 0.4); 
          }
          50% { 
            box-shadow: 0 0 40px rgba(255, 193, 7, 1), 0 0 80px rgba(255, 152, 0, 0.8), 0 0 120px rgba(255, 87, 34, 0.4); 
          }
        }
      `}</style>
        </div>
    );
}
