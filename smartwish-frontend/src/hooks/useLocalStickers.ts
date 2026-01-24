/**
 * useLocalStickers - React hook for local-first sticker loading
 * 
 * This hook reads stickers from IndexedDB first (instant), then checks for updates
 * from the cloud in the background. Only used in kiosk mode.
 * 
 * Usage:
 * const { stickers, isLoading, isFromCache, syncNow } = useLocalStickers({ category: 'animals' });
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import localAssetDB, { CachedSticker } from '@/lib/LocalAssetDB';
import assetSyncService from '@/services/AssetSyncService';

export interface UseLocalStickersOptions {
    category?: string;
    enabled?: boolean; // Set to false to disable (for non-kiosk mode)
}

export interface UseLocalStickersResult {
    stickers: CachedSticker[];
    isLoading: boolean;
    isFromCache: boolean;
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    error: string | null;
    syncNow: () => Promise<void>;
    refresh: () => Promise<void>;
}

export function useLocalStickers(options: UseLocalStickersOptions = {}): UseLocalStickersResult {
    const { category, enabled = true } = options;

    const [stickers, setStickers] = useState<CachedSticker[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFromCache, setIsFromCache] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isMounted = useRef(true);

    // Load stickers from IndexedDB
    const loadFromCache = useCallback(async () => {
        if (!enabled) return;

        try {
            const cached = await localAssetDB.getStickers(category);
            const syncMeta = await localAssetDB.getSyncMeta('stickers');

            if (isMounted.current) {
                if (cached.length > 0) {
                    setStickers(cached);
                    setIsFromCache(true);
                    setIsLoading(false);
                }
                setLastSyncedAt(syncMeta?.lastSyncedAt || null);
            }

            return cached.length;
        } catch (err) {
            console.error('[useLocalStickers] Failed to load from cache:', err);
            return 0;
        }
    }, [category, enabled]);

    // Fallback to cloud API
    const loadFromCloud = useCallback(async () => {
        if (!enabled) return;

        try {
            const base = process.env.NEXT_PUBLIC_API_BASE ??
                (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://smartwish.onrender.com');

            let url = `${base}/stickers?limit=500`;
            if (category) {
                url += `&category=${encodeURIComponent(category)}`;
            }

            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            const cloudStickers = data.data || data || [];

            // Transform to cached format
            const cachedStickers: CachedSticker[] = cloudStickers.map((s: any) => ({
                id: s.id,
                title: s.title,
                slug: s.slug,
                category: s.category,
                imageUrl: s.imageUrl || s.image_url,
                thumbnailUrl: s.thumbnailUrl || s.thumbnail_url,
                tags: s.tags,
                popularity: s.popularity,
                updatedAt: s.updated_at || s.updatedAt || new Date().toISOString(),
            }));

            if (isMounted.current) {
                setStickers(cachedStickers);
                setIsFromCache(false);
                setIsLoading(false);
                setError(null);
            }

            // Cache the results
            if (cachedStickers.length > 0) {
                await localAssetDB.putStickers(cachedStickers);
                await localAssetDB.setLastSyncTime('stickers', new Date(), cachedStickers.length);

                if (isMounted.current) {
                    setLastSyncedAt(new Date());
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load stickers';
            console.error('[useLocalStickers] Failed to load from cloud:', errorMessage);

            if (isMounted.current) {
                setError(errorMessage);
                setIsLoading(false);
            }
        }
    }, [category, enabled]);

    // Manual sync trigger
    const syncNow = useCallback(async () => {
        if (!enabled || isSyncing) return;

        setIsSyncing(true);
        try {
            await assetSyncService.syncStickers();
            await loadFromCache();
        } finally {
            if (isMounted.current) {
                setIsSyncing(false);
            }
        }
    }, [enabled, isSyncing, loadFromCache]);

    // Refresh data
    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const cachedCount = await loadFromCache();
        if (!cachedCount || cachedCount === 0) {
            await loadFromCloud();
        }
    }, [loadFromCache, loadFromCloud]);

    // Initial load
    useEffect(() => {
        isMounted.current = true;

        if (!enabled) {
            setIsLoading(false);
            return;
        }

        const init = async () => {
            // First, try to load from cache (instant)
            const cachedCount = await loadFromCache();

            // If cache is empty, load from cloud
            if (!cachedCount || cachedCount === 0) {
                await loadFromCloud();
            }
        };

        init();

        return () => {
            isMounted.current = false;
        };
    }, [enabled, loadFromCache, loadFromCloud]);

    // Listen for sync events
    useEffect(() => {
        if (!enabled) return;

        const unsubscribeStart = assetSyncService.onSyncStart((type) => {
            if (type === 'stickers') {
                setIsSyncing(true);
            }
        });

        const unsubscribeComplete = assetSyncService.onSyncComplete((type, result) => {
            if (type === 'stickers') {
                setIsSyncing(false);
                if (result.success) {
                    loadFromCache();
                }
            }
        });

        return () => {
            unsubscribeStart();
            unsubscribeComplete();
        };
    }, [enabled, loadFromCache]);

    return {
        stickers,
        isLoading,
        isFromCache,
        isSyncing,
        lastSyncedAt,
        error,
        syncNow,
        refresh,
    };
}

export default useLocalStickers;
