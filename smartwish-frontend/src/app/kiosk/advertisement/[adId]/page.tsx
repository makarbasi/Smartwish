"use client";

import { useRouter, useParams } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useKioskConfig } from "@/hooks/useKioskConfig";
import { useKioskSession } from "@/contexts/KioskSessionContext";
import { useEffect, useState } from "react";
import { PrinterAlertBanner } from "@/components/PrinterAlertBanner";

/**
 * Ad content configuration. Extend this map to add Ad2, Ad3, etc.
 */
const AD_CONTENT: Record<
  string,
  {
    partner: string;
    logo: string;
    logoAlt: string;
    offer: string;
    offerHighlight: string;
  }
> = {
  Ad1: {
    partner: "Cold Stone Creamery",
    logo: "/ads/cold-stone-logo.png",
    logoAlt: "Cold Stone Creamery",
    offer: "10% off when you print any greeting card or sticker",
    offerHighlight: "10% OFF",
  },
};

export default function KioskAdvertisementPage() {
  const router = useRouter();
  const params = useParams();
  const adId = typeof params?.adId === "string" ? params.adId : null;
  const [mounted, setMounted] = useState(false);

  const { isKiosk, isInitialized } = useDeviceMode();
  const { config: kioskConfig } = useKioskConfig();
  const { startSession, trackTileSelect } = useKioskSession();

  const greetingCardsEnabled = kioskConfig?.greetingCardsEnabled !== false;
  const stickersEnabled = kioskConfig?.stickersEnabled !== false;

  const ad = adId ? AD_CONTENT[adId] : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (!isKiosk) {
      router.replace("/");
      return;
    }
  }, [isKiosk, isInitialized, router]);

  const handleBackToHome = () => {
    router.push("/kiosk/home");
  };

  const handleCreateGreetingCard = async () => {
    if (!greetingCardsEnabled) return;
    await startSession();
    trackTileSelect("greeting_cards");
    router.push("/templates");
  };

  const handleCreateSticker = async () => {
    if (!stickersEnabled) return;
    await startSession();
    trackTileSelect("stickers");
    router.push("/stickers");
  };

  if (!ad) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <PrinterAlertBanner position="top" showWarnings={false} />
        <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl p-8 max-w-md text-center border border-white/20">
          <h1 className="text-2xl font-bold text-white mb-4">Advertisement</h1>
          <p className="text-gray-300 mb-6">
            {adId ? `Ad "${adId}" is not configured yet.` : "No advertisement selected."}
          </p>
          <button
            onClick={handleBackToHome}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-gradient-to-br from-amber-950 via-slate-900 to-orange-950 flex flex-col overflow-hidden relative" 
      style={{ 
        width: '1080px', 
        height: '1920px', 
        margin: '0', 
        padding: '0', 
        position: 'absolute', 
        top: '0', 
        left: '0',
        marginLeft: '0',
        marginRight: '0',
        paddingLeft: '0',
        paddingRight: '0'
      }}
    >
      <PrinterAlertBanner position="top" showWarnings={false} />

      {/* Animated background particles - optimized for portrait */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ left: '0', right: '0' }}>
        {/* Floating ice cream scoops - fewer for portrait */}
        {mounted && Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-15"
            style={{
              left: `${(i * 16) % 100}%`,
              top: `${(i * 18 + 10) % 90}%`,
              width: `${50 + (i % 3) * 25}px`,
              height: `${50 + (i % 3) * 25}px`,
              background: i % 2 === 0 
                ? 'radial-gradient(circle, #FFD700 0%, #FFA500 100%)' 
                : 'radial-gradient(circle, #FFF8DC 0%, #FFE4B5 100%)',
              animation: `float ${6 + (i % 4) * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
        
        {/* Animated gradient orbs - positioned for portrait */}
        <div className="absolute top-1/6 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/15 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-orange-500/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-red-900/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "3s" }}
        />
      </div>

      {/* Back to Home - smaller for portrait */}
      <button
        onClick={handleBackToHome}
        className="absolute top-4 left-4 flex items-center gap-2 text-white/80 hover:text-white transition-all z-20 group"
        aria-label="Back to home"
      >
        <svg 
          className="w-5 h-5 transition-transform group-hover:-translate-x-1" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-base font-medium">Home</span>
      </button>

      {/* Main Content - Optimized for 1080x1920 portrait */}
      <div className="flex-1 flex flex-col items-center justify-between py-6 z-10" style={{ width: '100%', margin: '0', paddingLeft: '0', paddingRight: '0' }}>
        
        {/* Top Section: Offer Badge */}
        <div className="w-full mt-8" style={{ maxWidth: '1000px', marginLeft: 'auto', marginRight: 'auto', paddingLeft: '20px', paddingRight: '20px' }}>
          <div 
            className="relative bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-center py-5 px-6 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              animation: mounted ? 'pulseGlow 2s ease-in-out 0.5s infinite' : 'none',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine" />
            <div className="relative">
              <span 
                className="text-white font-black text-5xl tracking-tight drop-shadow-lg block"
                style={{
                  animation: mounted ? 'flyInFromTopExtreme 1.5s cubic-bezier(0.25, 0.46, 0.45, 1.4) 0.2s both, bounce-subtle 2s ease-in-out 1.7s infinite' : 'none',
                  textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(255, 200, 0, 0.6)',
                }}
              >
                {ad.offerHighlight}
              </span>
              <div 
                className="mt-2 text-white/95 text-lg font-bold"
                style={{
                  animation: mounted ? 'flyInFromBottomExtreme 1.2s cubic-bezier(0.25, 0.46, 0.45, 1.4) 0.5s both' : 'none',
                }}
              >
                EXCLUSIVE OFFER
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section: Logo and Partner Info */}
        <div className="flex-1 flex flex-col items-center justify-center w-full" style={{ maxWidth: '1000px', marginLeft: 'auto', marginRight: 'auto', paddingLeft: '20px', paddingRight: '20px' }}>
          {/* Partner logo - Large and prominent */}
          <div 
            className="w-full max-w-[600px] mb-8 transform transition-all duration-700"
            style={{
              animation: mounted ? 'fadeInDown 0.8s ease-out 0.2s both' : 'none',
            }}
          >
            <div className="relative">
              {/* Glow effect behind logo */}
              <div className="absolute inset-0 bg-amber-500/25 blur-3xl rounded-full animate-pulse" />
              <div className="relative bg-white/10 rounded-3xl p-8 backdrop-blur-md border-2 border-white/30 shadow-2xl">
                <img
                  src={ad.logo}
                  alt={ad.logoAlt}
                  className="w-full h-auto object-contain drop-shadow-2xl"
                  style={{
                    maxHeight: '300px',
                    width: 'auto',
                    margin: '0 auto',
                    display: 'block'
                  }}
                  onError={(e) => {
                    console.error('Logo image failed to load:', ad.logo);
                    // Try alternative paths
                    const img = e.target as HTMLImageElement;
                    if (!img.src.includes('cold-stone')) {
                      img.src = '/ads/cold-stone-logo.png';
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Partner name */}
          <h2 
            className="text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-amber-200 via-orange-200 to-amber-200 bg-clip-text text-transparent text-center"
            style={{
              animation: mounted ? 'fadeIn 1s ease-out 0.5s both' : 'none',
            }}
          >
            {ad.partner}
          </h2>

          {/* Offer description */}
          <p 
            className="text-gray-200 text-center text-2xl mb-8 max-w-[800px] leading-relaxed font-medium px-4"
            style={{
              animation: mounted ? 'fadeIn 1s ease-out 0.7s both' : 'none',
            }}
          >
            {ad.offer}
          </p>

          {/* Decorative divider */}
          <div 
            className="w-48 h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full mb-6"
            style={{
              animation: mounted ? 'fadeIn 1s ease-out 0.9s both' : 'none',
            }}
          />
        </div>

        {/* Bottom Section: CTAs */}
        <div className="w-full mb-8" style={{ maxWidth: '1000px', marginLeft: 'auto', marginRight: 'auto', paddingLeft: '20px', paddingRight: '20px' }}>
          <div 
            className="flex flex-col gap-6 animate-fadeIn"
            style={{
              animation: mounted ? 'fadeInUp 1s ease-out 1.1s both' : 'none',
            }}
          >
            <button
              onClick={handleCreateGreetingCard}
              disabled={!greetingCardsEnabled}
              className={`group relative w-full px-10 py-6 rounded-2xl font-bold text-2xl transition-all duration-300 overflow-hidden ${
                greetingCardsEnabled
                  ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl"
                  : "bg-white/10 text-gray-400 cursor-not-allowed"
              }`}
            >
              {greetingCardsEnabled && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              )}
              <span className="relative flex items-center justify-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Create Greeting Card
              </span>
            </button>
            
            <button
              onClick={handleCreateSticker}
              disabled={!stickersEnabled}
              className={`group relative w-full px-10 py-6 rounded-2xl font-bold text-2xl transition-all duration-300 overflow-hidden ${
                stickersEnabled
                  ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl"
                  : "bg-white/10 text-gray-400 cursor-not-allowed"
              }`}
            >
              {stickersEnabled && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              )}
              <span className="relative flex items-center justify-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Create Sticker
              </span>
            </button>
          </div>

          {(!greetingCardsEnabled || !stickersEnabled) && (
            <p className="text-amber-300/70 text-base mt-4 text-center font-medium">
              Some options may be unavailable at this kiosk.
            </p>
          )}

          {/* Trust indicators - compact for portrait */}
          <div className="mt-8 flex items-center justify-center gap-8 text-white/70 text-base">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Instant Print</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>Premium Quality</span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom animations */}
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden;
          width: 1080px;
          height: 1920px;
        }
        
        #__next {
          margin: 0 !important;
          padding: 0 !important;
          width: 1080px;
          height: 1920px;
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }
        
        @keyframes shine {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 193, 7, 0.6), 0 0 40px rgba(255, 152, 0, 0.4);
          }
          50% {
            box-shadow: 0 0 40px rgba(255, 193, 7, 1), 0 0 80px rgba(255, 152, 0, 0.8), 0 0 120px rgba(255, 87, 34, 0.4);
          }
        }
        
        @keyframes flyInFromTopExtreme {
          0% {
            opacity: 0;
            transform: translateY(-400px) translateX(-200px) scale(0.2) rotate(-45deg);
            filter: blur(20px);
          }
          30% {
            opacity: 0.8;
            transform: translateY(50px) translateX(30px) scale(1.5) rotate(15deg);
            filter: blur(5px);
          }
          50% {
            opacity: 1;
            transform: translateY(-20px) translateX(-10px) scale(1.2) rotate(-5deg);
            filter: blur(0px);
          }
          70% {
            transform: translateY(10px) translateX(5px) scale(1.05) rotate(2deg);
          }
          85% {
            transform: translateY(-3px) translateX(-2px) scale(0.98) rotate(-1deg);
          }
          100% {
            opacity: 1;
            transform: translateY(0) translateX(0) scale(1) rotate(0deg);
            filter: blur(0px);
          }
        }
        
        @keyframes flyInFromBottomExtreme {
          0% {
            opacity: 0;
            transform: translateY(150px) scale(0.3) rotate(25deg);
            filter: blur(15px);
          }
          40% {
            opacity: 0.9;
            transform: translateY(-15px) scale(1.3) rotate(-8deg);
            filter: blur(3px);
          }
          60% {
            transform: translateY(8px) scale(1.1) rotate(3deg);
            filter: blur(0px);
          }
          80% {
            transform: translateY(-4px) scale(0.95) rotate(-1deg);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
            filter: blur(0px);
          }
        }
        
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
        
        .animate-shine {
          animation: shine 2s infinite;
        }
        
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
