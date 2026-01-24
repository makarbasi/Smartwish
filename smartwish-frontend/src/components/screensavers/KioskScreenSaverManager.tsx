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

// Default idle timeout for interactive screen savers (seconds)
const DEFAULT_INTERACTIVE_IDLE_TIMEOUT = 30;

/**
 * KioskScreenSaverManager - Orchestrates multiple screen savers with weighted rotation
 * 
 * This component:
 * - Reads screen saver configuration from kiosk context
 * - Implements weighted random selection for screen saver rotation
 * - Manages rotation timing based on duration settings
 * - Renders the appropriate screen saver type (video, html, default, none)
 * - Only shows screen savers when there is NO active kiosk session
 * - Supports interactive mode where clicking doesn't dismiss but tracks idle time
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
  const [cachedScreenSavers, setCachedScreenSavers] = useState<ScreenSaverItem[]>([]);
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const interactiveIdleTimerRef = useRef<NodeJS.Timeout | null>(null);
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

  // Clear interactive idle timer
  const clearInteractiveIdleTimer = useCallback(() => {
    if (interactiveIdleTimerRef.current) {
      clearTimeout(interactiveIdleTimerRef.current);
      interactiveIdleTimerRef.current = null;
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

  // Start or reset the interactive idle timer
  const startInteractiveIdleTimer = useCallback(() => {
    clearInteractiveIdleTimer();
    clearRotationTimer();
    
    if (!currentScreenSaver?.interactive) return;
    
    const idleTimeout = (currentScreenSaver.interactiveIdleTimeout || DEFAULT_INTERACTIVE_IDLE_TIMEOUT) * 1000;
    console.log(`[ScreenSaverManager] Starting interactive idle timer: ${idleTimeout / 1000}s`);
    
    interactiveIdleTimerRef.current = setTimeout(() => {
      console.log("[ScreenSaverManager] Interactive idle timeout - rotating to next screen saver");
      
      // Check if there are other enabled screen savers to rotate to
      const enabledScreenSavers = screenSavers.filter(ss => ss.enabled !== false);
      if (enabledScreenSavers.length > 1 && settings.enableRotation) {
        // Rotate to next screen saver
        selectNewScreenSaver();
      } else {
        // Only one screen saver or rotation disabled - exit entirely
        console.log("[ScreenSaverManager] No rotation available - exiting screen saver");
        hasExitedRef.current = true;
        clearRotationTimer();
        clearInteractiveIdleTimer();
        onExit();
      }
    }, idleTimeout);
  }, [currentScreenSaver, screenSavers, settings.enableRotation, clearInteractiveIdleTimer, clearRotationTimer, onExit, selectNewScreenSaver]);

  // Handle interaction on interactive screen saver (reset idle timer)
  const handleInteractiveActivity = useCallback(() => {
    if (!currentScreenSaver?.interactive) return;
    
    console.log("[ScreenSaverManager] Interactive activity detected - resetting idle timer");
    startInteractiveIdleTimer();
  }, [currentScreenSaver?.interactive, startInteractiveIdleTimer]);

  // Track activity at document level for interactive screen savers
  // Note: iframe content activity is tracked directly in HtmlScreenSaver component
  // This handles activity outside the iframe (e.g., clicking around the edges)
  useEffect(() => {
    if (!isVisible || !currentScreenSaver?.interactive) return;

    const handleDirectActivity = () => {
      console.log("[ScreenSaverManager] Activity detected outside iframe - resetting idle timer");
      startInteractiveIdleTimer();
    };

    console.log("[ScreenSaverManager] Setting up document-level activity tracking for interactive mode");

    document.addEventListener('mousedown', handleDirectActivity, { passive: true });
    document.addEventListener('touchstart', handleDirectActivity, { passive: true });
    document.addEventListener('keydown', handleDirectActivity, { passive: true });
    document.addEventListener('click', handleDirectActivity, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleDirectActivity);
      document.removeEventListener('touchstart', handleDirectActivity);
      document.removeEventListener('keydown', handleDirectActivity);
      document.removeEventListener('click', handleDirectActivity);
    };
  }, [isVisible, currentScreenSaver?.interactive, startInteractiveIdleTimer]);

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
      clearInteractiveIdleTimer();
      setCurrentScreenSaver(null);
      // Don't reset previousScreenSaverIdRef here - keep it for next time
    }
    
    return () => {
      clearRotationTimer();
      clearInteractiveIdleTimer();
    };
  }, [isVisible, hasActiveSession, selectNewScreenSaver, clearRotationTimer, clearInteractiveIdleTimer, isOnKioskHome, pathname, kioskSession?.isSessionActive]);

  // Start rotation timer when current screen saver changes
  useEffect(() => {
    if (isVisible && currentScreenSaver && !hasActiveSession) {
      // For interactive screen savers, start the idle timer instead of rotation timer
      if (currentScreenSaver.interactive) {
        console.log("[ScreenSaverManager] Interactive screen saver - starting idle timer");
        startInteractiveIdleTimer();
      } else {
        startRotationTimer();
      }
    }
    
    return () => {
      clearRotationTimer();
      clearInteractiveIdleTimer();
    };
  }, [isVisible, currentScreenSaver, hasActiveSession, startRotationTimer, startInteractiveIdleTimer, clearRotationTimer, clearInteractiveIdleTimer]);

  // Cache HTML screen savers so they don't reload on rotation
  useEffect(() => {
    if (!currentScreenSaver || currentScreenSaver.type !== "html") return;
    setCachedScreenSavers((prev) => {
      if (prev.some((ss) => ss.id === currentScreenSaver.id)) {
        return prev;
      }
      return [...prev, currentScreenSaver];
    });
  }, [currentScreenSaver]);

  // Handle interaction to exit screen saver
  const handleInteraction = useCallback((e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    console.log("[ScreenSaverManager] handleInteraction called:", e.type, {
      interactive: currentScreenSaver?.interactive,
    });
    
    // If this is an interactive screen saver, don't exit - just reset idle timer
    if (currentScreenSaver?.interactive) {
      console.log("[ScreenSaverManager] Interactive mode - resetting idle timer instead of exiting");
      handleInteractiveActivity();
      return;
    }
    
    // Prevent double-exit
    if (hasExitedRef.current) {
      console.log("[ScreenSaverManager] BLOCKED - already exiting");
      return;
    }
    hasExitedRef.current = true;
    
    e.stopPropagation();
    e.preventDefault();
    
    clearRotationTimer();
    clearInteractiveIdleTimer();
    console.log("[ScreenSaverManager] Calling onExit()");
    onExit();
  }, [onExit, clearRotationTimer, clearInteractiveIdleTimer, currentScreenSaver?.interactive, handleInteractiveActivity]);

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

  // Check if current screen saver is interactive
  const isInteractive = currentScreenSaver.interactive === true;

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
        const cachedHtmlScreenSavers = cachedScreenSavers.filter(
          (ss) => ss.type === "html"
        );
        const activeHtmlId = currentScreenSaver.id;
        const activeHtmlIsCached = cachedHtmlScreenSavers.some(
          (ss) => ss.id === activeHtmlId
        );

        return (
          <div className="absolute inset-0">
            {cachedHtmlScreenSavers.map((ss) => {
              const isActive = ss.id === activeHtmlId;
              return (
                <div
                  key={ss.id}
                  className={`absolute inset-0 ${
                    isActive ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  <HtmlScreenSaver
                    url={ss.url || ""}
                    onExit={handleInteraction}
                    overlayText={isActive ? overlayText : undefined}
                    interactive={isActive ? isInteractive : false}
                    onActivity={isActive ? handleInteractiveActivity : undefined}
                  />
                </div>
              );
            })}
            {!activeHtmlIsCached && (
              <HtmlScreenSaver
                url={currentScreenSaver.url || ""}
                onExit={handleInteraction}
                overlayText={overlayText}
                interactive={isInteractive}
                onActivity={handleInteractiveActivity}
              />
            )}
          </div>
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
                clearInteractiveIdleTimer();
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
      className={`fixed inset-0 z-[2147483647] select-none ${
        isInteractive ? "cursor-default" : "cursor-pointer touch-none"
      }`}
      onClick={handleInteraction}
      onTouchStart={isInteractive ? handleInteractiveActivity : undefined}
      onTouchEnd={isInteractive ? undefined : handleInteraction}
      onMouseMove={isInteractive ? handleInteractiveActivity : undefined}
      onKeyDown={(e) => {
        if (isInteractive) {
          handleInteractiveActivity();
        } else if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          handleInteraction(e);
        }
      }}
      tabIndex={0}
    >
      {renderScreenSaver()}
    </div>
  );
}
