"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDeviceMode } from "@/contexts/DeviceModeContext";
import { useKioskSessionSafe } from "@/contexts/KioskSessionContext";
import { useKiosk } from "@/contexts/KioskContext";
import { DEFAULT_SCREEN_SAVER_SETTINGS } from "@/utils/kioskConfig";

interface UseKioskInactivityOptions {
    screenSaverTimeout?: number; // milliseconds (default: from config or 60 seconds)
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

// Payment timeout multiplier
const PAYMENT_TIMEOUT_MULTIPLIER = 2; // Double timeout during payment

export function useKioskInactivity({
    screenSaverTimeout: propScreenSaverTimeout,
    resetTimeout = 90000, // 90 seconds (1.5 minutes)
    enabled = true,
}: UseKioskInactivityOptions = {}) {
    const { isKiosk } = useDeviceMode();
    const { kioskInfo } = useKiosk();
    const pathname = usePathname();
    const router = useRouter();
    const kioskSession = useKioskSessionSafe();
    
    // Get screen saver settings from kiosk config
    const screenSaverSettings = useMemo(() => {
        return {
            ...DEFAULT_SCREEN_SAVER_SETTINGS,
            ...kioskInfo?.config?.screenSaverSettings,
        };
    }, [kioskInfo?.config?.screenSaverSettings]);
    
    // Use config timeout if available, otherwise use prop or default
    const screenSaverTimeout = propScreenSaverTimeout ?? 
        (screenSaverSettings.inactivityTimeout ? screenSaverSettings.inactivityTimeout * 1000 : 60000);
    
    // Check if screen savers are configured
    const hasScreenSavers = useMemo(() => {
        const screenSavers = kioskInfo?.config?.screenSavers;
        const has = screenSavers && screenSavers.length > 0 && screenSavers.some(ss => ss.enabled !== false);
        console.log("🖥️ [KioskInactivity] hasScreenSavers check:", {
            has,
            screenSavers,
            enabledCount: screenSavers?.filter(ss => ss.enabled !== false).length || 0,
            totalCount: screenSavers?.length || 0,
            kioskInfo: !!kioskInfo,
            config: !!kioskInfo?.config,
        });
        return has;
    }, [kioskInfo?.config?.screenSavers]);

    // Disable screen saver on admin pages and setup pages
    const isExcludedPath = EXCLUDED_PATHS.some(path => pathname.startsWith(path));
    // Check if on /kiosk/home - timeout modal disabled but screen saver still active
    const isKioskHome = pathname === '/kiosk/home';
    // Screen saver is enabled everywhere except excluded paths (admin, etc.)
    const screenSaverEnabled = enabled && !isExcludedPath;
    // Timeout modal is disabled on kiosk home (user is already at home)
    const timeoutEnabled = screenSaverEnabled && !isKioskHome;

    const [showScreenSaver, setShowScreenSaver] = useState(false);
    const [showTimeoutModal, setShowTimeoutModal] = useState(false);
    const screenSaverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<number>(Date.now());
    const lastMouseMoveRef = useRef<number>(0); // Track last mousemove processing time
    const lastTouchMoveRef = useRef<number>(0); // Track last touchmove processing time
    const isExitingRef = useRef<boolean>(false); // Prevent multiple exit calls
    
    // Store timeout values in refs to avoid recreating resetActivity when they change
    const screenSaverTimeoutRef = useRef(screenSaverTimeout);
    const resetTimeoutRef = useRef(resetTimeout);
    
    // Update refs when values change
    useEffect(() => {
        screenSaverTimeoutRef.current = screenSaverTimeout;
        resetTimeoutRef.current = resetTimeout;
    }, [screenSaverTimeout, resetTimeout]);
    
    // Activity pause states
    const isPausedRef = useRef<boolean>(false);
    const pauseReasonRef = useRef<string | null>(null);
    const customTimeoutRef = useRef<number | null>(null);
    
    // Timeout multiplier (used during payment to give user more time)
    const timeoutMultiplierRef = useRef<number>(1);

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
                
                // Clear sessionStorage but preserve chat session key (already reset by resetSession)
                const sessionKeysToKeep = ['kiosk_chat_session_'];
                const sessionKeys = Object.keys(sessionStorage);
                sessionKeys.forEach(key => {
                    const shouldKeep = sessionKeysToKeep.some(prefix => key.startsWith(prefix));
                    if (!shouldKeep) {
                        sessionStorage.removeItem(key);
                    }
                });
                console.log("🖥️ [KioskInactivity] 🧹 Cleared user data (preserved chat session)");
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
        if (!isKiosk || !screenSaverEnabled) return;
        
        // If paused, don't reset timers
        if (isPausedRef.current) {
            console.log("🖥️ [KioskInactivity] ⏸️ Activity paused for:", pauseReasonRef.current, "- ignoring reset");
            return;
        }

        lastActivityRef.current = Date.now();
        clearTimers();

        // Apply timeout multiplier (used during payment)
        const multiplier = timeoutMultiplierRef.current;
        
        // Use custom timeout if set, otherwise use defaults with multiplier
        const effectiveScreenSaverTimeout = customTimeoutRef.current || (screenSaverTimeoutRef.current * multiplier);
        const effectiveResetTimeout = customTimeoutRef.current || (resetTimeoutRef.current * multiplier);

        // Set screen saver timer (only if screen savers are configured)
        if (hasScreenSavers) {
            console.log("🖥️ [KioskInactivity] ⏱️ Setting screen saver timer:", effectiveScreenSaverTimeout / 1000, "s", multiplier > 1 ? `(${multiplier}x multiplier)` : '');
            screenSaverTimerRef.current = setTimeout(() => {
                console.log("🖥️ [KioskInactivity] ⏰ Screen saver timer fired - showing screen saver");
                isExitingRef.current = false;
                setShowScreenSaver(true);
            }, effectiveScreenSaverTimeout);
        } else {
            console.log("🖥️ [KioskInactivity] 🚫 No screen savers configured - skipping visual display");
        }

        // Set reset timer - show confirmation modal (only if not on kiosk home)
        if (timeoutEnabled) {
            console.log("🖥️ [KioskInactivity] ⏱️ Setting reset timer:", effectiveResetTimeout / 1000, "s", multiplier > 1 ? `(${multiplier}x multiplier)` : '');
            resetTimerRef.current = setTimeout(() => {
                console.log("🖥️ [KioskInactivity] ⏰ Reset timer fired - showing timeout confirmation modal");
                setShowTimeoutModal(true);
            }, effectiveResetTimeout);
        } else {
            console.log("🖥️ [KioskInactivity] 🏠 On kiosk home - skipping timeout modal");
        }
    }, [isKiosk, screenSaverEnabled, timeoutEnabled, clearTimers, hasScreenSavers]);

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

    // Extend timeout for payment (double the normal timeout)
    const pauseForPayment = useCallback(() => {
        console.log("🖥️ [KioskInactivity] 💳 Extending timeout for payment (2x multiplier)");
        timeoutMultiplierRef.current = PAYMENT_TIMEOUT_MULTIPLIER;
        resetActivity();
    }, [resetActivity]);

    // Resume normal timeout after payment
    const resumeFromPayment = useCallback(() => {
        console.log("🖥️ [KioskInactivity] 💳 Resuming normal timeout after payment");
        timeoutMultiplierRef.current = 1;
        resetActivity();
    }, [resetActivity]);

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

    // Timeout modal handlers
    const handleStillHere = useCallback(() => {
        console.log("🖥️ [KioskInactivity] ✅ User confirmed they are still present");
        setShowTimeoutModal(false);
        resetActivity();
    }, [resetActivity]);

    const handleStartFresh = useCallback(() => {
        console.log("🖥️ [KioskInactivity] 🔄 User chose to start fresh");
        setShowTimeoutModal(false);
        navigateToHome();
    }, [navigateToHome]);

    const handleModalTimeout = useCallback(() => {
        console.log("🖥️ [KioskInactivity] ⏰ Timeout modal countdown reached zero");
        setShowTimeoutModal(false);
        navigateToHome();
    }, [navigateToHome]);

    // Activity event handler
    const handleActivity = useCallback((event?: Event) => {
        // If paused, ignore all activity
        if (isPausedRef.current) {
            return;
        }
        
        // If timeout modal is showing, any activity closes it and restarts timer
        if (showTimeoutModal) {
            console.log("🖥️ [KioskInactivity] 👆 Activity detected during timeout modal - closing modal and restarting timer");
            setShowTimeoutModal(false);
            resetActivity();
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
    }, [showScreenSaver, showTimeoutModal, exitScreenSaver, resetActivity]);


    // Start timers on initial mount only
    useEffect(() => {
        console.log("🖥️ [KioskInactivity] Initial mount check:", {
            isKiosk,
            screenSaverEnabled,
            timeoutEnabled,
            isKioskHome,
            hasScreenSavers,
            pathname,
            hasActiveSession: kioskSession?.isSessionActive,
            kioskInfoLoaded: !!kioskInfo,
            configLoaded: !!kioskInfo?.config,
        });
        
        if (!isKiosk || !screenSaverEnabled) {
            console.log("🖥️ [KioskInactivity] Not starting timers:", !isKiosk ? "not in kiosk mode" : "screen saver disabled");
            clearTimers();
            setShowScreenSaver(false);
            setShowTimeoutModal(false);
            return;
        }

        if (!hasScreenSavers) {
            console.log("🖥️ [KioskInactivity] ⚠️ No screen savers configured - timers won't start");
            return;
        }

        console.log("🖥️ [KioskInactivity] ✅ Starting initial timers (kiosk home:", isKioskHome, ")");
        resetActivity();

        return () => {
            clearTimers();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isKiosk, screenSaverEnabled]);

    // Set up activity listeners
    useEffect(() => {
        if (!isKiosk || !screenSaverEnabled) {
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
    }, [isKiosk, screenSaverEnabled, handleActivity]);

    // Reset timers when pathname changes (navigation)
    useEffect(() => {
        if (isKiosk && screenSaverEnabled && !isPausedRef.current) {
            console.log("🖥️ [KioskInactivity] Page changed to:", pathname, "- resetting activity");
            setShowScreenSaver(false);
            resetActivity();
        }
    }, [pathname, isKiosk, screenSaverEnabled, resetActivity]);

    // Expose test function for debugging (only in development)
    useEffect(() => {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            (window as any).__testScreenSaver = () => {
                console.log("🖥️ [KioskInactivity] TEST: Forcing screen saver to show");
                setShowScreenSaver(true);
            };
            (window as any).__testScreenSaverDebug = () => {
                console.log("🖥️ [KioskInactivity] DEBUG INFO:", {
                    isKiosk,
                    screenSaverEnabled,
                    timeoutEnabled,
                    isKioskHome,
                    hasScreenSavers,
                    showScreenSaver,
                    hasActiveSession: kioskSession?.isSessionActive,
                    screenSavers: kioskInfo?.config?.screenSavers,
                    settings: kioskInfo?.config?.screenSaverSettings,
                    pathname,
                });
            };
        }
    }, [isKiosk, screenSaverEnabled, timeoutEnabled, isKioskHome, hasScreenSavers, showScreenSaver, kioskSession?.isSessionActive, kioskInfo?.config?.screenSavers, kioskInfo?.config?.screenSaverSettings, pathname]);

    return {
        showScreenSaver: hasScreenSavers ? showScreenSaver : false, // Only show if screen savers are configured
        showTimeoutModal,
        exitScreenSaver,
        resetActivity,
        pauseInactivity,
        resumeInactivity,
        pauseForQRUpload,
        pauseForPrinting,
        pauseForPayment,
        resumeFromPayment,
        handleStillHere,
        handleStartFresh,
        handleModalTimeout,
    };
}
