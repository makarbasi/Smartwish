import { useState, useEffect, useRef, useCallback } from 'react';

interface StreamStatus {
    connected: boolean;
    kioskOnline: boolean;
    framesReceived: number;
    lastFrameAt: Date | null;
    error: string | null;
}

interface UseScreenStreamOptions {
    kioskId: string;
    enabled: boolean;
    onFrame?: (frame: Blob) => void;
}

/**
 * Hook for connecting to the screen WebSocket stream
 * 
 * Connects to the backend WebSocket server and subscribes to
 * a specific kiosk's screen stream. Frames are received as binary
 * data and can be displayed on a canvas or converted to data URLs.
 */
export function useScreenStream({
    kioskId,
    enabled,
    onFrame,
}: UseScreenStreamOptions) {
    const [status, setStatus] = useState<StreamStatus>({
        connected: false,
        kioskOnline: false,
        framesReceived: 0,
        lastFrameAt: null,
        error: null,
    });

    const [frameUrl, setFrameUrl] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const frameCountRef = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectDelayRef = useRef(1000);

    // Build WebSocket URL
    const getWsUrl = useCallback(() => {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';
        let wsUrl: string;

        if (apiBase.startsWith('https://')) {
            wsUrl = 'wss://' + apiBase.slice(8) + '/ws/screen';
        } else if (apiBase.startsWith('http://')) {
            wsUrl = 'ws://' + apiBase.slice(7) + '/ws/screen';
        } else {
            wsUrl = 'wss://' + apiBase + '/ws/screen';
        }

        return wsUrl;
    }, []);

    const connect = useCallback(() => {
        if (!enabled || !kioskId) return;

        // Clean up existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        const wsUrl = getWsUrl();
        console.log('[ScreenStream] Connecting to:', wsUrl);

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.binaryType = 'blob';

            ws.onopen = () => {
                console.log('[ScreenStream] Connected');
                reconnectDelayRef.current = 1000; // Reset reconnect delay

                // Subscribe to kiosk screen stream
                ws.send(JSON.stringify({
                    event: 'subscribe',
                    data: { kioskId }
                }));
            };

            ws.onmessage = (event) => {
                // Check if it's binary data (frame) or JSON message
                if (event.data instanceof Blob) {
                    // Binary frame data
                    frameCountRef.current++;

                    // Create object URL for the frame
                    const url = URL.createObjectURL(event.data);
                    setFrameUrl((prevUrl) => {
                        // Revoke previous URL to prevent memory leak
                        if (prevUrl) {
                            URL.revokeObjectURL(prevUrl);
                        }
                        return url;
                    });

                    setStatus((prev) => ({
                        ...prev,
                        framesReceived: frameCountRef.current,
                        lastFrameAt: new Date(),
                        error: null,
                    }));

                    onFrame?.(event.data);
                } else {
                    // JSON message
                    try {
                        const message = JSON.parse(event.data);

                        if (message.type === 'subscribed') {
                            console.log('[ScreenStream] Subscribed to:', message.kioskId);
                            setStatus((prev) => ({
                                ...prev,
                                connected: true,
                                kioskOnline: message.kioskOnline,
                                error: null,
                            }));
                        } else if (message.type === 'error') {
                            console.error('[ScreenStream] Error:', message.message);
                            setStatus((prev) => ({
                                ...prev,
                                error: message.message,
                            }));
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            };

            ws.onerror = (error) => {
                console.error('[ScreenStream] WebSocket error:', error);
                setStatus((prev) => ({
                    ...prev,
                    connected: false,
                    error: 'Connection error',
                }));
            };

            ws.onclose = () => {
                console.log('[ScreenStream] Disconnected');
                setStatus((prev) => ({
                    ...prev,
                    connected: false,
                }));

                // Reconnect with exponential backoff
                if (enabled) {
                    const delay = reconnectDelayRef.current;
                    reconnectDelayRef.current = Math.min(delay * 2, 30000); // Max 30 seconds

                    console.log(`[ScreenStream] Reconnecting in ${delay}ms...`);
                    reconnectTimeoutRef.current = setTimeout(connect, delay);
                }
            };

        } catch (error) {
            console.error('[ScreenStream] Failed to connect:', error);
            setStatus((prev) => ({
                ...prev,
                connected: false,
                error: 'Failed to connect',
            }));
        }
    }, [enabled, kioskId, getWsUrl, onFrame]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        if (frameUrl) {
            URL.revokeObjectURL(frameUrl);
            setFrameUrl(null);
        }

        setStatus({
            connected: false,
            kioskOnline: false,
            framesReceived: 0,
            lastFrameAt: null,
            error: null,
        });

        frameCountRef.current = 0;
    }, [frameUrl]);

    // Connect/disconnect based on enabled state
    useEffect(() => {
        if (enabled && kioskId) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [enabled, kioskId, connect, disconnect]);

    return {
        status,
        frameUrl,
        connect,
        disconnect,
    };
}

export default useScreenStream;
