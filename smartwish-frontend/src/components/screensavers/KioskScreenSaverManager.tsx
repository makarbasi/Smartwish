"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useKiosk } from "@/contexts/KioskContext";
import { useKioskSessionSafe } from "@/contexts/KioskSessionContext";
import {
  ScreenSaverItem,
  DEFAULT_SCREEN_SAVER,
  DEFAULT_SCREEN_SAVER_SETTINGS,
} from "@/utils/kioskConfig";
import { selectWeightedScreenSaver } from "@/utils/screenSaverUtils";
import DefaultScreenSaver from "./DefaultScreenSaver";
import VideoScreenSaver from "./VideoScreenSaver";
import HtmlScreenSaver from "./HtmlScreenSaver";

interface KioskScreenSaverManagerProps {
  isVisible: boolean;
  onExit: () => void;
}

/**
 * KioskScreenSaverManager - Orchestrates multiple screen savers with weighted rotation
 * 
 * This component:
 * - Reads screen saver configuration from kiosk context
 * - Implements weighted random selection for screen saver rotation
 * - Manages rotation timing based on duration settings
 * - Renders the appropriate screen saver type (video, html, default, none)
 * - Only shows screen savers when there is NO active kiosk session
 */
export default function KioskScreenSaverManager({
  isVisible,
  onExit,
}: KioskScreenSaverManagerProps) {
  const { kioskInfo } = useKiosk();
  const kioskSession = useKioskSessionSafe();
  const pathname = usePathname();
  
  // Get screen saver configuration from kiosk config
  const screenSavers = useMemo(() => {
    const configuredScreenSavers = kioskInfo?.config?.screenSavers;
    console.log("[ScreenSaverManager] Configured screenSavers:", configuredScreenSavers);
    if (configuredScreenSavers && configuredScreenSavers.length > 0) {
      return configuredScreenSavers;
    }
    // Fallback to default screen saver
    console.log("[ScreenSaverManager] Using default screen saver");
    return [DEFAULT_SCREEN_SAVER];
  }, [kioskInfo?.config?.screenSavers]);

  const settings = useMemo(() => {
    const merged = {
      ...DEFAULT_SCREEN_SAVER_SETTINGS,
      ...kioskInfo?.config?.screenSaverSettings,
    };
    console.log("[ScreenSaverManager] Settings:", merged);
    return merged;
  }, [kioskInfo?.config?.screenSaverSettings]);

  // Current screen saver state
  const [currentScreenSaver, setCurrentScreenSaver] = useState<ScreenSaverItem | null>(null);
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasExitedRef = useRef(false);
  const previousScreenSaverIdRef = useRef<string | null>(null);

  // Check if there's an active session - don't show screen saver if so
  // EXCEPT on /kiosk/home where sessions are automatically ended
  const isOnKioskHome = pathname === '/kiosk/home';
  const hasActiveSession = isOnKioskHome ? false : (kioskSession?.isSessionActive ?? false);

  // Clear rotation timer
  const clearRotationTimer = useCallback(() => {
    if (rotationTimerRef.current) {
      clearTimeout(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }
  }, []);

  // Select and set a new screen saver
  const selectNewScreenSaver = useCallback(() => {
    const enabledScreenSavers = screenSavers.filter(ss => ss.enabled !== false);
    
    if (enabledScreenSavers.length === 0) {
      // No enabled screen savers - don't show anything
      setCurrentScreenSaver(null);
      previousScreenSaverIdRef.current = null;
      return;
    }

    // If we only have one screen saver, use it
    if (enabledScreenSavers.length === 1) {
      const selected = enabledScreenSavers[0];
      console.log("[ScreenSaverManager] Only one screen saver available:", selected?.name || selected?.type);
      setCurrentScreenSaver(selected);
      previousScreenSaverIdRef.current = selected.id;
      return;
    }

    // Filter out the previous screen saver to avoid immediate repeats
    const availableScreenSavers = enabledScreenSavers.filter(
      ss => ss.id !== previousScreenSaverIdRef.current
    );

    // If we filtered out the only option, use all screen savers (fallback)
    const candidates = availableScreenSavers.length > 0 ? availableScreenSavers : enabledScreenSavers;

    const selected = selectWeightedScreenSaver(candidates);
    console.log("[ScreenSaverManager] Selected screen saver:", selected?.name || selected?.type, {
      previousId: previousScreenSaverIdRef.current,
      selectedId: selected?.id,
      totalAvailable: enabledScreenSavers.length,
      candidatesCount: candidates.length
    });
    
    setCurrentScreenSaver(selected);
    previousScreenSaverIdRef.current = selected?.id || null;
  }, [screenSavers]);

  // Start rotation timer for the current screen saver
  const startRotationTimer = useCallback(() => {
    clearRotationTimer();
    
    if (!settings.enableRotation) {
      return;
    }

    // Get duration from current screen saver or use default rotation interval
    const duration = currentScreenSaver?.duration || settings.rotationInterval || 30;
    
    console.log(`[ScreenSaverManager] Starting rotation timer: ${duration}s`);
    
    rotationTimerRef.current = setTimeout(() => {
      console.log("[ScreenSaverManager] Rotation timer fired - selecting new screen saver");
      selectNewScreenSaver();
    }, duration * 1000);
  }, [clearRotationTimer, settings.enableRotation, settings.rotationInterval, currentScreenSaver?.duration, selectNewScreenSaver]);

  // Initialize screen saver when becoming visible
  useEffect(() => {
    if (isVisible && !hasActiveSession) {
      console.log("[ScreenSaverManager] Screen saver visible - selecting initial screen saver", {
        isOnKioskHome,
        pathname,
        hasActiveSession,
        rawSessionActive: kioskSession?.isSessionActive,
      });
      hasExitedRef.current = false;
      // Reset previous screen saver when starting fresh
      previousScreenSaverIdRef.current = null;
      selectNewScreenSaver();
    } else if (!isVisible || hasActiveSession) {
      clearRotationTimer();
      setCurrentScreenSaver(null);
      // Don't reset previousScreenSaverIdRef here - keep it for next time
    }
    
    return () => {
      clearRotationTimer();
    };
  }, [isVisible, hasActiveSession, selectNewScreenSaver, clearRotationTimer, isOnKioskHome, pathname, kioskSession?.isSessionActive]);

  // Start rotation timer when current screen saver changes
  useEffect(() => {
    if (isVisible && currentScreenSaver && !hasActiveSession) {
      startRotationTimer();
    }
    
    return () => {
      clearRotationTimer();
    };
  }, [isVisible, currentScreenSaver, hasActiveSession, startRotationTimer, clearRotationTimer]);

  // Handle interaction to exit screen saver
  const handleInteraction = useCallback((e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    console.log("[ScreenSaverManager] handleInteraction called:", e.type);
    
    // Prevent double-exit
    if (hasExitedRef.current) {
      console.log("[ScreenSaverManager] BLOCKED - already exiting");
      return;
    }
    hasExitedRef.current = true;
    
    e.stopPropagation();
    e.preventDefault();
    
    clearRotationTimer();
    console.log("[ScreenSaverManager] Calling onExit()");
    onExit();
  }, [onExit, clearRotationTimer]);

  // Don't render if not visible, has active session, or no screen saver selected
  if (!isVisible || hasActiveSession) {
    console.log("[ScreenSaverManager] Not rendering:", {
      isVisible,
      hasActiveSession,
      isOnKioskHome,
      rawSessionActive: kioskSession?.isSessionActive,
      currentScreenSaver: !!currentScreenSaver,
      pathname,
    });
    return null;
  }

  // Handle "none" type - hide the overlay
  if (currentScreenSaver?.type === "none") {
    console.log("[ScreenSaverManager] 'none' type selected - hiding overlay");
    return null;
  }

  // No screen saver to show
  if (!currentScreenSaver) {
    return null;
  }

  // Render the appropriate screen saver based on type
  const renderScreenSaver = () => {
    const overlayText = settings.overlayText;
    
    switch (currentScreenSaver.type) {
      case "video":
        return (
          <VideoScreenSaver
            url={currentScreenSaver.url || ""}
            onExit={handleInteraction}
            overlayText={overlayText}
          />
        );
      
      case "html":
        return (
          <HtmlScreenSaver
            url={currentScreenSaver.url || ""}
            onExit={handleInteraction}
            overlayText={overlayText}
          />
        );
      
      case "default":
      default:
        return (
          <DefaultScreenSaver
            isVisible={true}
            onExit={() => {
              if (!hasExitedRef.current) {
                hasExitedRef.current = true;
                clearRotationTimer();
                onExit();
              }
            }}
            overlayText={overlayText}
          />
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2147483647] cursor-pointer select-none touch-none"
      onClick={handleInteraction}
      onTouchEnd={handleInteraction}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          handleInteraction(e);
        }
      }}
      tabIndex={0}
    >
      {renderScreenSaver()}
    </div>
  );
}
