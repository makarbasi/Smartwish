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
        screenSaverTimerRef.current = setTimeout(() => {
            console.log("🖥️ [KioskInactivity] ⏰ 30s inactivity - showing screen saver");
            setShowScreenSaver(true);
            hideKeyboard();
        }, screenSaverTimeout);

        // Set reset timer (60 seconds total)
        resetTimerRef.current = setTimeout(() => {
            console.log("🖥️ [KioskInactivity] ⏰ 60s inactivity - setting reset flag");
            // Just set the flag - don't navigate yet
            setShouldResetOnExit(true);
        }, resetTimeout);
    }, [isKiosk, effectiveEnabled, clearTimers, screenSaverTimeout, resetTimeout, hideKeyboard]);

    // Exit screen saver and reset timers
    const exitScreenSaver = useCallback(() => {
        console.log("🖥️ [KioskInactivity] Exiting screen saver");

        // Check if we need to reset to /templates
        if (shouldResetOnExit) {
            console.log("🖥️ [KioskInactivity] 🔄 60s timeout reached - resetting to /templates");

            // Clear all localStorage and sessionStorage for a fresh start
            try {
                const keysToKeep = ['nextauth.message', 'next-auth.session-token', 'next-auth.csrf-token'];
                const allKeys = Object.keys(localStorage);
                allKeys.forEach(key => {
                    if (!keysToKeep.includes(key)) {
                        localStorage.removeItem(key);
                    }
                });
                sessionStorage.clear();
                console.log("🖥️ [KioskInactivity] 🧹 Cleared all data");
            } catch (error) {
                console.error("🖥️ [KioskInactivity] Error clearing storage:", error);
            }

            // Clear the flag
            setShouldResetOnExit(false);

            // Navigate to /templates with hard reload
            console.log("🖥️ [KioskInactivity] ✅ Navigating to /templates");
            window.location.href = "/templates";
            return;
        }

        // Normal exit - just hide screen saver and reset timers
        setShowScreenSaver(false);
        resetActivity();
    }, [shouldResetOnExit, resetActivity]);

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
            console.log("🖥️ [KioskInactivity] 👆 User interaction during screen saver:", event?.type, "- Exiting screen saver");
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

