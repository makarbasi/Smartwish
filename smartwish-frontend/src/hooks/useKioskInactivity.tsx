"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useVirtualKeyboard } from "@/contexts/VirtualKeyboardContext";

interface UseKioskInactivityOptions {
    screenSaverTimeout?: number; // milliseconds (default: 30 seconds)
    resetTimeout?: number; // milliseconds (default: 60 seconds)
    enabled?: boolean;
}

// Throttle constants to prevent interfering with Windows screen saver
// Only process movement events every 5 seconds, allowing Windows screen saver to activate
const MOUSE_MOVE_THROTTLE = 5000; // milliseconds
const TOUCH_MOVE_THROTTLE = 5000; // milliseconds

// Pages where screen saver should never appear
const EXCLUDED_PATHS = ['/admin', '/managers'];

export function useKioskInactivity({
    screenSaverTimeout = 30000, // 30 seconds
    resetTimeout = 60000, // 60 seconds (1 minute)
    enabled = true,
}: UseKioskInactivityOptions = {}) {
    const { isKiosk } = useDeviceMode();
    const pathname = usePathname();
    const { hideKeyboard } = useVirtualKeyboard();

    // Disable screen saver on admin pages and setup pages
    const isExcludedPath = EXCLUDED_PATHS.some(path => pathname.startsWith(path));
    const effectiveEnabled = enabled && !isExcludedPath;

    const [showScreenSaver, setShowScreenSaver] = useState(false);
    const [shouldResetOnExit, setShouldResetOnExit] = useState(false); // Flag for 60s timeout
    const screenSaverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<number>(Date.now());
    const lastMouseMoveRef = useRef<number>(0); // Track last mousemove processing time
    const lastTouchMoveRef = useRef<number>(0); // Track last touchmove processing time
    const isExitingRef = useRef<boolean>(false); // Prevent multiple exit calls

    // Clear all timers
    const clearTimers = useCallback(() => {
        if (screenSaverTimerRef.current) {
            clearTimeout(screenSaverTimerRef.current);
            screenSaverTimerRef.current = null;
        }
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }
    }, []);

    // Reset activity timers
    const resetActivity = useCallback(() => {
        if (!isKiosk || !effectiveEnabled) return;

        lastActivityRef.current = Date.now();
        clearTimers();

        // Set screen saver timer (30 seconds)
        console.log("🖥️ [KioskInactivity] ⏱️ Setting 30s screen saver timer");
        screenSaverTimerRef.current = setTimeout(() => {
            console.log("🖥️ [KioskInactivity] ⏰ 30s TIMER FIRED - showing screen saver");
            isExitingRef.current = false; // Reset exit guard for new screen saver session
            setShowScreenSaver(true);
            hideKeyboard();
        }, screenSaverTimeout);

        // Set reset timer (60 seconds total)
        console.log("🖥️ [KioskInactivity] ⏱️ Setting 60s reset timer");
        resetTimerRef.current = setTimeout(() => {
            console.log("🖥️ [KioskInactivity] ⏰ 60s TIMER FIRED - setting shouldResetOnExit=true");
            // Just set the flag - don't navigate yet
            setShouldResetOnExit(true);
        }, resetTimeout);
    }, [isKiosk, effectiveEnabled, clearTimers, screenSaverTimeout, resetTimeout, hideKeyboard]);

    // Exit screen saver and reset timers
    const exitScreenSaver = useCallback(() => {
        console.log("🖥️ [KioskInactivity] exitScreenSaver() called:", {
            isExitingRef: isExitingRef.current,
            shouldResetOnExit,
            showScreenSaver,
            timestamp: new Date().toISOString(),
        });
        
        // Prevent multiple exit calls (can happen on touch devices)
        if (isExitingRef.current) {
            console.log("🖥️ [KioskInactivity] ⚠️ BLOCKED - exit already in progress");
            return;
        }
        isExitingRef.current = true;
        
        console.log("🖥️ [KioskInactivity] ✅ Processing exit...");

        // Check if we need to reset
        if (shouldResetOnExit) {
            // If already on /kiosk/home, NO NEED to hard reset - just hide screen saver
            if (pathname === '/kiosk/home') {
                console.log("🖥️ [KioskInactivity] ✅ Already on /kiosk/home - skipping hard reset, just hiding screen saver");
                setShouldResetOnExit(false);
                setShowScreenSaver(false);
                isExitingRef.current = false;
                resetActivity();
                return;
            }
            
            console.log("🖥️ [KioskInactivity] 🔄 60s timeout - HARD RESET to /kiosk/home (was on:", pathname, ")");

            // Clear all localStorage and sessionStorage for a fresh start
            // But keep kiosk-related keys so the device remains in kiosk mode
            // Also keep API cache keys so kiosk home loads instantly
            try {
                const keysToKeep = [
                    'nextauth.message', 
                    'next-auth.session-token', 
                    'next-auth.csrf-token',
                    'smartwish_kiosk_id',      // Keep kiosk activation
                    'smartwish_kiosk_config',  // Keep kiosk config cache
                ];
                // Also keep SWR cache keys that start with these prefixes for instant kiosk home loading
                const cachePrefixesToKeep = [
                    'swr_cache_/api/templates',  // Keep templates cache
                    'swr_cache_/api/stickers',   // Keep stickers cache
                    'kiosk_sticker_properties',  // Keep sticker animation properties
                ];
                const allKeys = Object.keys(localStorage);
                allKeys.forEach(key => {
                    const shouldKeep = keysToKeep.includes(key) || 
                        cachePrefixesToKeep.some(prefix => key.startsWith(prefix));
                    if (!shouldKeep) {
                        localStorage.removeItem(key);
                    }
                });
                sessionStorage.clear();
                console.log("🖥️ [KioskInactivity] 🧹 Cleared user data (preserved kiosk activation + API cache)");
            } catch (error) {
                console.error("🖥️ [KioskInactivity] Error clearing storage:", error);
            }

            // Clear the flag
            setShouldResetOnExit(false);

            // Navigate to /kiosk/home with hard reload so user can choose product type
            console.log("🖥️ [KioskInactivity] ✅ Navigating to /kiosk/home");
            window.location.href = "/kiosk/home";
            return;
        }

        // Normal exit - just hide screen saver and reset timers
        console.log("🖥️ [KioskInactivity] 👋 Normal exit - hiding screen saver (no hard reset)");
        setShowScreenSaver(false);
        isExitingRef.current = false; // Reset for next time
        resetActivity();
    }, [shouldResetOnExit, resetActivity, showScreenSaver, pathname]);

    // Activity event handler
    const handleActivity = useCallback((event?: Event) => {
        // If screen saver is showing, only exit on explicit clicks/touches, not mouse movements
        if (showScreenSaver) {
            // Only exit screen saver on deliberate user interaction (clicks, touches)
            // Not on passive movements like mousemove or scroll
            if (event && (event.type === 'mousemove' || event.type === 'wheel' || event.type === 'scroll')) {
                // Ignore passive movements while screen saver is showing
                // (Don't log to reduce console noise)
                return;
            }
            console.log("🖥️ [KioskInactivity] 👆 handleActivity detected interaction:", event?.type, "- calling exitScreenSaver()");
            exitScreenSaver();
            return;
        }

        // Throttle mousemove and touchmove events to prevent interfering with Windows screen saver
        // Only process these events every 5 seconds, allowing Windows screen saver to activate
        const now = Date.now();
        if (event && event.type === 'mousemove') {
            if (now - lastMouseMoveRef.current < MOUSE_MOVE_THROTTLE) {
                // Skip this mousemove event - too soon since last one
                return;
            }
            lastMouseMoveRef.current = now;
        } else if (event && event.type === 'touchmove') {
            if (now - lastTouchMoveRef.current < TOUCH_MOVE_THROTTLE) {
                // Skip this touchmove event - too soon since last one
                return;
            }
            lastTouchMoveRef.current = now;
        }

        // Otherwise, just reset the timers (normal activity tracking)
        resetActivity();
    }, [showScreenSaver, exitScreenSaver, resetActivity]);


    // Start timers on initial mount only
    useEffect(() => {
        if (!isKiosk || !effectiveEnabled) {
            clearTimers();
            setShowScreenSaver(false);
            return;
        }

        console.log("🖥️ [KioskInactivity] Starting initial timers");
        resetActivity();

        return () => {
            clearTimers();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isKiosk, effectiveEnabled]); // Only run on mount or when kiosk mode changes

    // Set up activity listeners
    useEffect(() => {
        if (!isKiosk || !effectiveEnabled) {
            return;
        }

        console.log("🖥️ [KioskInactivity] Setting up activity listeners");

        // Activity events to track
        const events = [
            "mousedown",
            "mousemove",
            "keydown",
            "touchstart",
            "touchmove",
            "click",
            "scroll",
            "wheel",
        ];

        // Add event listeners with proper typing
        const activityHandler = (e: Event) => handleActivity(e);
        events.forEach((event) => {
            window.addEventListener(event, activityHandler, { passive: true });
        });

        // Cleanup
        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, activityHandler);
            });
        };
    }, [isKiosk, effectiveEnabled, handleActivity]);

    // Reset timers when pathname changes (navigation)
    useEffect(() => {
        if (isKiosk && effectiveEnabled) {
            console.log("🖥️ [KioskInactivity] Page changed, resetting activity");
            setShowScreenSaver(false);
            setShouldResetOnExit(false);
            resetActivity();
        }
    }, [pathname, isKiosk, effectiveEnabled, resetActivity]);

    return {
        showScreenSaver,
        exitScreenSaver,
        resetActivity,
    };
}

