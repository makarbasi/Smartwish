"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useVirtualKeyboard } from "@/contexts/VirtualKeyboardContext";
import { useKioskSessionSafe } from "@/contexts/KioskSessionContext";

interface UseKioskInactivityOptions {
    screenSaverTimeout?: number; // milliseconds (default: 60 seconds)
    resetTimeout?: number; // milliseconds (default: 90 seconds)
    enabled?: boolean;
}

// Throttle constants to prevent interfering with Windows screen saver
// Only process movement events every 5 seconds, allowing Windows screen saver to activate
const MOUSE_MOVE_THROTTLE = 5000; // milliseconds
const TOUCH_MOVE_THROTTLE = 5000; // milliseconds

// Pages where screen saver and timeout should never appear
const EXCLUDED_PATHS = ['/admin', '/manager', '/managers'];

// QR code upload timeout (matches the session TTL)
const QR_UPLOAD_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Print job timeout
const PRINT_JOB_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Flag to temporarily disable screen saver display (but keep redirect logic)
const SCREEN_SAVER_DISABLED = true; // Set to false to re-enable screen saver

export function useKioskInactivity({
    screenSaverTimeout = 60000, // 60 seconds (1 minute)
    resetTimeout = 90000, // 90 seconds (1.5 minutes)
    enabled = true,
}: UseKioskInactivityOptions = {}) {
    const { isKiosk } = useDeviceMode();
    const pathname = usePathname();
    const router = useRouter();
    const { hideKeyboard } = useVirtualKeyboard();
    const kioskSession = useKioskSessionSafe();

    // Disable screen saver on admin pages and setup pages
    const isExcludedPath = EXCLUDED_PATHS.some(path => pathname.startsWith(path));
    const effectiveEnabled = enabled && !isExcludedPath;

    const [showScreenSaver, setShowScreenSaver] = useState(false);
    const screenSaverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<number>(Date.now());
    const lastMouseMoveRef = useRef<number>(0); // Track last mousemove processing time
    const lastTouchMoveRef = useRef<number>(0); // Track last touchmove processing time
    const isExitingRef = useRef<boolean>(false); // Prevent multiple exit calls
    
    // Activity pause states
    const isPausedRef = useRef<boolean>(false);
    const pauseReasonRef = useRef<string | null>(null);
    const customTimeoutRef = useRef<number | null>(null);

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

    // Navigate to kiosk home and clear user data
    const navigateToHome = useCallback(async () => {
        console.log("🖥️ [KioskInactivity] navigateToHome() - current path:", pathname);
        
        // Dispatch event to clear chat history
        window.dispatchEvent(new CustomEvent('kiosk-timeout'));
        
        // End the kiosk session due to timeout
        // Always call handleTimeout - the service has its own guard for inactive sessions
        if (kioskSession) {
            console.log("🖥️ [KioskInactivity] Calling handleTimeout (service will check if session is active)");
            await kioskSession.handleTimeout();
        } else {
            console.log("🖥️ [KioskInactivity] No kioskSession context available");
        }
        
        // If not on /kiosk/home, navigate there
        if (pathname !== '/kiosk/home') {
            console.log("🖥️ [KioskInactivity] 🔄 Navigating to /kiosk/home");
            
            // Clear user data first
            try {
                const keysToKeep = [
                    'nextauth.message', 
                    'next-auth.session-token', 
                    'next-auth.csrf-token',
                    'smartwish_kiosk_id',
                    'smartwish_kiosk_config',
                ];
                const cachePrefixesToKeep = [
                    'swr_cache_/api/templates',
                    'swr_cache_/api/stickers',
                    'kiosk_sticker_properties',
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
                console.log("🖥️ [KioskInactivity] 🧹 Cleared user data");
            } catch (error) {
                console.error("🖥️ [KioskInactivity] Error clearing storage:", error);
            }
            
            // Navigate to /kiosk/home
            router.replace('/kiosk/home');
            console.log("🖥️ [KioskInactivity] ✅ Navigation complete");
        } else {
            console.log("🖥️ [KioskInactivity] ✅ Already on /kiosk/home");
        }
    }, [pathname, router, kioskSession]);

    // Reset activity timers
    const resetActivity = useCallback(() => {
        if (!isKiosk || !effectiveEnabled) return;
        
        // If paused, don't reset timers
        if (isPausedRef.current) {
            console.log("🖥️ [KioskInactivity] ⏸️ Activity paused for:", pauseReasonRef.current, "- ignoring reset");
            return;
        }

        lastActivityRef.current = Date.now();
        clearTimers();

        // Use custom timeout if set, otherwise use defaults
        const effectiveScreenSaverTimeout = customTimeoutRef.current || screenSaverTimeout;
        const effectiveResetTimeout = customTimeoutRef.current || resetTimeout;

        // Set screen saver timer (only if screen saver is enabled)
        if (!SCREEN_SAVER_DISABLED) {
            console.log("🖥️ [KioskInactivity] ⏱️ Setting screen saver timer:", effectiveScreenSaverTimeout / 1000, "s");
            screenSaverTimerRef.current = setTimeout(() => {
                console.log("🖥️ [KioskInactivity] ⏰ Screen saver timer fired - showing screen saver");
                isExitingRef.current = false;
                setShowScreenSaver(true);
                hideKeyboard();
            }, effectiveScreenSaverTimeout);
        } else {
            console.log("🖥️ [KioskInactivity] 🚫 Screen saver disabled - skipping visual display");
        }

        // Set reset timer - navigate to home
        console.log("🖥️ [KioskInactivity] ⏱️ Setting reset timer:", effectiveResetTimeout / 1000, "s");
        resetTimerRef.current = setTimeout(() => {
            console.log("🖥️ [KioskInactivity] ⏰ Reset timer fired");
            navigateToHome();
        }, effectiveResetTimeout);
    }, [isKiosk, effectiveEnabled, clearTimers, screenSaverTimeout, resetTimeout, hideKeyboard, navigateToHome]);

    // Pause inactivity tracking (for QR upload, printing, etc.)
    const pauseInactivity = useCallback((reason: string, customTimeout?: number) => {
        console.log("🖥️ [KioskInactivity] ⏸️ Pausing inactivity for:", reason, customTimeout ? `(${customTimeout / 1000}s timeout)` : '(indefinite)');
        isPausedRef.current = true;
        pauseReasonRef.current = reason;
        clearTimers();
        
        // If a custom timeout is provided, set a timer to navigate home after that time
        if (customTimeout) {
            customTimeoutRef.current = customTimeout;
            resetTimerRef.current = setTimeout(() => {
                console.log("🖥️ [KioskInactivity] ⏰ Custom timeout expired for:", reason);
                isPausedRef.current = false;
                pauseReasonRef.current = null;
                customTimeoutRef.current = null;
                navigateToHome();
            }, customTimeout);
        }
    }, [clearTimers, navigateToHome]);

    // Resume inactivity tracking
    const resumeInactivity = useCallback(() => {
        console.log("🖥️ [KioskInactivity] ▶️ Resuming inactivity tracking from:", pauseReasonRef.current);
        isPausedRef.current = false;
        pauseReasonRef.current = null;
        customTimeoutRef.current = null;
        resetActivity();
    }, [resetActivity]);

    // Pause for QR code upload (10 minutes)
    const pauseForQRUpload = useCallback(() => {
        pauseInactivity('qr-upload', QR_UPLOAD_TIMEOUT);
    }, [pauseInactivity]);

    // Pause for print job (5 minutes)
    const pauseForPrinting = useCallback(() => {
        pauseInactivity('printing', PRINT_JOB_TIMEOUT);
    }, [pauseInactivity]);

    // Exit screen saver and reset timers
    const exitScreenSaver = useCallback(() => {
        console.log("🖥️ [KioskInactivity] exitScreenSaver() called");
        
        // Prevent multiple exit calls
        if (isExitingRef.current) {
            console.log("🖥️ [KioskInactivity] ⚠️ BLOCKED - exit already in progress");
            return;
        }
        isExitingRef.current = true;
        
        // Hide screen saver
        console.log("🖥️ [KioskInactivity] 👋 Hiding screen saver");
        setShowScreenSaver(false);
        isExitingRef.current = false;
        resetActivity();
    }, [resetActivity]);

    // Activity event handler
    const handleActivity = useCallback((event?: Event) => {
        // If paused, ignore all activity
        if (isPausedRef.current) {
            return;
        }
        
        // If screen saver is showing, only exit on explicit clicks/touches, not mouse movements
        if (showScreenSaver) {
            if (event && (event.type === 'mousemove' || event.type === 'wheel' || event.type === 'scroll')) {
                return;
            }
            console.log("🖥️ [KioskInactivity] 👆 Activity detected:", event?.type);
            exitScreenSaver();
            return;
        }

        // Throttle mousemove and touchmove events
        const now = Date.now();
        if (event && event.type === 'mousemove') {
            if (now - lastMouseMoveRef.current < MOUSE_MOVE_THROTTLE) {
                return;
            }
            lastMouseMoveRef.current = now;
        } else if (event && event.type === 'touchmove') {
            if (now - lastTouchMoveRef.current < TOUCH_MOVE_THROTTLE) {
                return;
            }
            lastTouchMoveRef.current = now;
        }

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
    }, [isKiosk, effectiveEnabled]);

    // Set up activity listeners
    useEffect(() => {
        if (!isKiosk || !effectiveEnabled) {
            return;
        }

        console.log("🖥️ [KioskInactivity] Setting up activity listeners");

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

        const activityHandler = (e: Event) => handleActivity(e);
        events.forEach((event) => {
            window.addEventListener(event, activityHandler, { passive: true });
        });

        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, activityHandler);
            });
        };
    }, [isKiosk, effectiveEnabled, handleActivity]);

    // Reset timers when pathname changes (navigation)
    useEffect(() => {
        if (isKiosk && effectiveEnabled && !isPausedRef.current) {
            console.log("🖥️ [KioskInactivity] Page changed to:", pathname, "- resetting activity");
            setShowScreenSaver(false);
            resetActivity();
        }
    }, [pathname, isKiosk, effectiveEnabled, resetActivity]);

    return {
        showScreenSaver: SCREEN_SAVER_DISABLED ? false : showScreenSaver, // Always false if disabled
        exitScreenSaver,
        resetActivity,
        pauseInactivity,
        resumeInactivity,
        pauseForQRUpload,
        pauseForPrinting,
    };
}
