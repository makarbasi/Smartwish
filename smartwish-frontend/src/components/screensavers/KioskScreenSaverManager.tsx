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
  // Pending screen saver that is being pre-loaded (rendered hidden until ready)
  const [pendingScreenSaver, setPendingScreenSaver] = useState<ScreenSaverItem | null>(null);
  // Cached screen savers (both HTML and video) to prevent re-mounting on rotation
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

  // Select and set a new screen saver (used for initial selection)
  const selectNewScreenSaver = useCallback(() => {
    const enabledScreenSavers = screenSavers.filter((ss: ScreenSaverItem) => ss.enabled !== false);

    if (enabledScreenSavers.length === 0) {
      // No enabled screen savers - don't show anything
      setCurrentScreenSaver(null);
      setPendingScreenSaver(null);
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
      (ss: ScreenSaverItem) => ss.id !== previousScreenSaverIdRef.current
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

  // Start pre-loading the next screen saver (renders hidden, waits for onReady)
  const startPreloadingNext = useCallback(() => {
    const enabledScreenSavers = screenSavers.filter((ss: ScreenSaverItem) => ss.enabled !== false);

    if (enabledScreenSavers.length <= 1) {
      // Only one screen saver - just restart the timer, no rotation needed
      return;
    }

    // Filter out the current screen saver to avoid showing the same one
    const currentId = currentScreenSaver?.id;
    const availableScreenSavers = enabledScreenSavers.filter(
      (ss: ScreenSaverItem) => ss.id !== currentId
    );

    const candidates = availableScreenSavers.length > 0 ? availableScreenSavers : enabledScreenSavers;
    const selected = selectWeightedScreenSaver(candidates);

    console.log("[ScreenSaverManager] Pre-loading next screen saver:", selected?.name || selected?.type);
    setPendingScreenSaver(selected);
  }, [screenSavers, currentScreenSaver?.id]);

  // Called when pending screen saver is ready - switch it to current
  // The caching system keeps both videos mounted, so transition is seamless
  const handlePendingReady = useCallback(() => {
    if (!pendingScreenSaver) return;

    console.log("[ScreenSaverManager] Pending screen saver ready - switching to it");
    previousScreenSaverIdRef.current = pendingScreenSaver.id;
    // Move pending to current - the cached video will fade in via CSS
    setCurrentScreenSaver(pendingScreenSaver);
    setPendingScreenSaver(null);
  }, [pendingScreenSaver]);

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
      console.log("[ScreenSaverManager] Rotation timer fired - pre-loading next screen saver");
      startPreloadingNext();
    }, duration * 1000);
  }, [clearRotationTimer, settings.enableRotation, settings.rotationInterval, currentScreenSaver?.duration, startPreloadingNext]);

  // Start or reset the interactive idle timer
  const startInteractiveIdleTimer = useCallback(() => {
    clearInteractiveIdleTimer();
    clearRotationTimer();

    if (!currentScreenSaver?.interactive) return;

    const idleTimeout = (currentScreenSaver.interactiveIdleTimeout || DEFAULT_INTERACTIVE_IDLE_TIMEOUT) * 1000;
    console.log(`[ScreenSaverManager] Starting interactive idle timer: ${idleTimeout / 1000}s`);

    interactiveIdleTimerRef.current = setTimeout(() => {
      console.log("[ScreenSaverManager] Interactive idle timeout - pre-loading next screen saver");

      // Check if there are other enabled screen savers to rotate to
      const enabledScreenSavers = screenSavers.filter((ss: ScreenSaverItem) => ss.enabled !== false);
      if (enabledScreenSavers.length > 1 && settings.enableRotation) {
        // Pre-load next screen saver (will switch when ready)
        startPreloadingNext();
      } else {
        // Only one screen saver or rotation disabled - exit entirely
        console.log("[ScreenSaverManager] No rotation available - exiting screen saver");
        hasExitedRef.current = true;
        clearRotationTimer();
        clearInteractiveIdleTimer();
        onExit();
      }
    }, idleTimeout);
  }, [currentScreenSaver, screenSavers, settings.enableRotation, clearInteractiveIdleTimer, clearRotationTimer, onExit, startPreloadingNext]);

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
      setCachedScreenSavers([]); // Clear cached screen savers on exit
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

  // Cache HTML and video screen savers so they don't reload on rotation
  useEffect(() => {
    if (!currentScreenSaver) return;
    // Only cache HTML and video types (default doesn't need caching)
    if (currentScreenSaver.type !== "html" && currentScreenSaver.type !== "video") return;
    setCachedScreenSavers((prev) => {
      if (prev.some((ss) => ss.id === currentScreenSaver.id)) {
        return prev;
      }
      console.log(`[ScreenSaverManager] Caching ${currentScreenSaver.type} screen saver: ${currentScreenSaver.id}`);
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

  // Helper to construct URL with query parameters for video advertisement screensavers
  const constructScreenSaverUrl = (screenSaver: ScreenSaverItem): string => {
    let url = screenSaver.url || "";

    // Add query parameters if videoUrl, text, or color are provided
    if (screenSaver.videoUrl || screenSaver.text || screenSaver.color) {
      const params = new URLSearchParams();
      if (screenSaver.videoUrl) params.append('videoUrl', screenSaver.videoUrl);
      if (screenSaver.text) params.append('text', screenSaver.text);
      if (screenSaver.color) params.append('color', screenSaver.color);

      // If url already has query params, append with &, otherwise use ?
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${params.toString()}`;
    }

    return url;
  };

  // Helper to render a single screen saver by type
  const renderSingleScreenSaver = (
    screenSaver: ScreenSaverItem,
    isPreloading: boolean = false,
    onReadyCallback?: () => void
  ) => {
    const overlayText = isPreloading ? undefined : settings.overlayText;

    switch (screenSaver.type) {
      case "video":
        return (
          <VideoScreenSaver
            key={screenSaver.id}
            url={screenSaver.url || ""}
            onExit={handleInteraction}
            overlayText={overlayText}
            isPreloading={isPreloading}
            onReady={onReadyCallback}
          />
        );

      case "html":
        // For HTML, check if it's already cached
        const isCached = cachedScreenSavers.some(ss => ss.id === screenSaver.id);
        if (isCached && !isPreloading) {
          // Render from cache for active HTML screen savers
          return null; // Will be handled in the cached section
        }

        return (
          <HtmlScreenSaver
            key={screenSaver.id}
            url={constructScreenSaverUrl(screenSaver)}
            onExit={handleInteraction}
            overlayText={overlayText}
            interactive={!isPreloading && isInteractive}
            onActivity={!isPreloading ? handleInteractiveActivity : undefined}
            isPreloading={isPreloading}
            onReady={onReadyCallback}
          />
        );

      case "default":
      default:
        // Default screen saver is instant - call onReady immediately
        if (onReadyCallback) {
          // Use setTimeout to avoid calling during render
          setTimeout(onReadyCallback, 0);
        }
        return (
          <DefaultScreenSaver
            key={screenSaver.id}
            isVisible={!isPreloading}
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

  // Render the appropriate screen saver based on type
  const renderScreenSaver = () => {
    const overlayText = settings.overlayText;

    // For HTML screen savers with caching
    if (currentScreenSaver.type === "html") {
      const cachedHtmlScreenSavers = cachedScreenSavers.filter(
        (ss) => ss.type === "html"
      );
      const activeHtmlId = currentScreenSaver.id;
      const activeHtmlIsCached = cachedHtmlScreenSavers.some(
        (ss) => ss.id === activeHtmlId
      );

      return (
        <div className="absolute inset-0">
          {/* Render cached HTML screen savers */}
          {cachedHtmlScreenSavers.map((ss) => {
            const isActive = ss.id === activeHtmlId;
            return (
              <div
                key={ss.id}
                className={`absolute inset-0 ${isActive ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
              >
                <HtmlScreenSaver
                  url={constructScreenSaverUrl(ss)}
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
              url={constructScreenSaverUrl(currentScreenSaver)}
              onExit={handleInteraction}
              overlayText={overlayText}
              interactive={isInteractive}
              onActivity={handleInteractiveActivity}
            />
          )}
          {/* Pre-load pending screen saver (hidden) */}
          {pendingScreenSaver && (
            <div className="absolute inset-0 opacity-0 pointer-events-none">
              {renderSingleScreenSaver(pendingScreenSaver, true, handlePendingReady)}
            </div>
          )}
        </div>
      );
    }

    // For video screen savers with caching (similar pattern to HTML)
    if (currentScreenSaver.type === "video") {
      const cachedVideoScreenSavers = cachedScreenSavers.filter(
        (ss) => ss.type === "video"
      );
      const activeVideoId = currentScreenSaver.id;
      const activeVideoIsCached = cachedVideoScreenSavers.some(
        (ss) => ss.id === activeVideoId
      );

      return (
        <div className="absolute inset-0">
          {/* Render all cached video screen savers - active one visible, others hidden */}
          {cachedVideoScreenSavers.map((ss) => {
            const isActive = ss.id === activeVideoId;
            return (
              <div
                key={ss.id}
                className={`absolute inset-0 transition-opacity duration-500 ${isActive ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
              >
                <VideoScreenSaver
                  url={ss.url || ""}
                  onExit={handleInteraction}
                  overlayText={isActive ? overlayText : undefined}
                />
              </div>
            );
          })}
          {/* If active video not yet cached, render it directly */}
          {!activeVideoIsCached && (
            <VideoScreenSaver
              url={currentScreenSaver.url || ""}
              onExit={handleInteraction}
              overlayText={overlayText}
            />
          )}
          {/* Pre-load pending screen saver (hidden) */}
          {pendingScreenSaver && (
            <div className="absolute inset-0 opacity-0 pointer-events-none">
              {renderSingleScreenSaver(pendingScreenSaver, true, handlePendingReady)}
            </div>
          )}
        </div>
      );
    }

    // For default screen savers (no caching needed)
    return (
      <div className="absolute inset-0">
        {renderSingleScreenSaver(currentScreenSaver, false)}

        {/* Pre-load pending screen saver (hidden) */}
        {pendingScreenSaver && (
          <div className="absolute inset-0 opacity-0 pointer-events-none">
            {renderSingleScreenSaver(pendingScreenSaver, true, handlePendingReady)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-[2147483647] select-none ${isInteractive ? "cursor-default" : "cursor-pointer touch-none"
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
