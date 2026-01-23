"use client";

import { useRouter } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useEffect, useState } from "react";
import { PrinterAlertBanner } from "@/components/PrinterAlertBanner";

export default function EventsAdvertisementPage() {
  const router = useRouter();
  const { isKiosk, isInitialized } = useDeviceMode();
  const [mounted, setMounted] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    setMounted(true);
    
    // Set viewport meta tag for kiosk display (1080x1920)
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=1080, height=1920, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    // Inject global styles for kiosk display
    const styleId = 'kiosk-events-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        * { box-sizing: border-box; }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 1080px !important;
          max-height: 1920px !important;
        }
        #__next {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Cleanup - restore default viewport on unmount
    return () => {
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=true');
      }
      const injectedStyle = document.getElementById(styleId);
      if (injectedStyle) {
        injectedStyle.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (!isKiosk) {
      router.replace("/");
      return;
    }
  }, [isKiosk, isInitialized, router]);

  // Reload iframe every 24 hours to get fresh data
  useEffect(() => {
    const interval = setInterval(() => {
      setIframeKey(prev => prev + 1);
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    return () => clearInterval(interval);
  }, []);

  const handleBackToHome = () => {
    router.push("/kiosk/home");
  };

  if (!mounted) {
    return null;
  }

  return (
    <div 
      className="bg-slate-900 flex flex-col overflow-hidden relative" 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        minWidth: '1080px',
        minHeight: '1920px',
        maxWidth: '1080px',
        maxHeight: '1920px',
        margin: '0', 
        padding: '0', 
        position: 'fixed', 
        top: '0', 
        left: '0',
        right: '0',
        bottom: '0',
      }}
    >
      <PrinterAlertBanner position="top" showWarnings={false} />

      {/* Back to Home Button */}
      <button
        onClick={handleBackToHome}
        className="absolute top-4 left-4 flex items-center gap-2 text-white/80 hover:text-white transition-all z-50 group bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-lg"
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

      {/* Events HTML Content in iframe */}
      <iframe
        key={iframeKey}
        src="/events/index.html"
        style={{
          width: '1080px',
          height: '1920px',
          border: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: '#f8fafc',
        }}
        title="San Diego Events"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
