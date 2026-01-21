"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  
  // Get screen saver configuration from kiosk config
  const screenSavers = useMemo(() => {
    const configuredScreenSavers = kioskInfo?.config?.screenSavers;
    if (configuredScreenSavers && configuredScreenSavers.length > 0) {
      return configuredScreenSavers;
    }
    // Fallback to default screen saver
    return [DEFAULT_SCREEN_SAVER];
  }, [kioskInfo?.config?.screenSavers]);

  const settings = useMemo(() => {
    return {
      ...DEFAULT_SCREEN_SAVER_SETTINGS,
      ...kioskInfo?.config?.screenSaverSettings,
    };
  }, [kioskInfo?.config?.screenSaverSettings]);

  // Current screen saver state
  const [currentScreenSaver, setCurrentScreenSaver] = useState<ScreenSaverItem | null>(null);
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasExitedRef = useRef(false);

  // Check if there's an active session - don't show screen saver if so
  const hasActiveSession = kioskSession?.isSessionActive ?? false;

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
      return;
    }

    const selected = selectWeightedScreenSaver(enabledScreenSavers);
    console.log("[ScreenSaverManager] Selected screen saver:", selected?.name || selected?.type);
    setCurrentScreenSaver(selected);
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
      console.log("[ScreenSaverManager] Screen saver visible - selecting initial screen saver");
      hasExitedRef.current = false;
      selectNewScreenSaver();
    } else if (!isVisible || hasActiveSession) {
      clearRotationTimer();
      setCurrentScreenSaver(null);
    }
    
    return () => {
      clearRotationTimer();
    };
  }, [isVisible, hasActiveSession, selectNewScreenSaver, clearRotationTimer]);

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
    switch (currentScreenSaver.type) {
      case "video":
        return (
          <VideoScreenSaver
            url={currentScreenSaver.url || ""}
            onExit={handleInteraction}
          />
        );
      
      case "html":
        return (
          <HtmlScreenSaver
            url={currentScreenSaver.url || ""}
            onExit={handleInteraction}
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
