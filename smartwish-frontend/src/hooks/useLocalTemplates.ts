/**
 * useLocalTemplates - React hook for local-first template loading
 * 
 * This hook reads templates from IndexedDB first (instant), then checks for updates
 * from the cloud in the background. Only used in kiosk mode.
 * 
 * Usage:
 * const { templates, isLoading, isFromCache, syncNow } = useLocalTemplates({ categoryId: 'abc123' });
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import localAssetDB, { CachedTemplate } from '@/lib/LocalAssetDB';
import assetSyncService from '@/services/AssetSyncService';

export interface UseLocalTemplatesOptions {
    categoryId?: string;
    enabled?: boolean; // Set to false to disable (for non-kiosk mode)
}

export interface UseLocalTemplatesResult {
    templates: CachedTemplate[];
    isLoading: boolean;
    isFromCache: boolean;
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    error: string | null;
    syncNow: () => Promise<void>;
    refresh: () => Promise<void>;
}

export function useLocalTemplates(options: UseLocalTemplatesOptions = {}): UseLocalTemplatesResult {
    const { categoryId, enabled = true } = options;

    const [templates, setTemplates] = useState<CachedTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFromCache, setIsFromCache] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isMounted = useRef(true);

    // Load templates from IndexedDB
    const loadFromCache = useCallback(async () => {
        if (!enabled) return;

        try {
            const cached = await localAssetDB.getTemplates(categoryId);
            const syncMeta = await localAssetDB.getSyncMeta('templates');

            if (isMounted.current) {
                if (cached.length > 0) {
                    setTemplates(cached);
                    setIsFromCache(true);
                    setIsLoading(false);
                }
                setLastSyncedAt(syncMeta?.lastSyncedAt || null);
            }

            return cached.length;
        } catch (err) {
            console.error('[useLocalTemplates] Failed to load from cache:', err);
            return 0;
        }
    }, [categoryId, enabled]);

    // Fallback to cloud API
    const loadFromCloud = useCallback(async () => {
        if (!enabled) return;

        try {
            const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com';

            let url = `${base}/templates-enhanced/templates/search?limit=500`;
            if (categoryId) {
                url += `&category_id=${encodeURIComponent(categoryId)}`;
            }

            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            const cloudTemplates = data.data || data || [];

            // Transform to cached format
            const cachedTemplates: CachedTemplate[] = cloudTemplates.map((t: any) => ({
                id: t.id,
                title: t.title || t.name,
                slug: t.slug,
                categoryId: t.category_id || t.categoryId,
                categoryName: t.category_name || t.categoryName,
                description: t.description,
                language: t.language,
                region: t.region,
                price: t.price,
                image1: t.image_1 || t.image1,
                image2: t.image_2 || t.image2,
                image3: t.image_3 || t.image3,
                image4: t.image_4 || t.image4,
                tags: t.tags,
                popularity: t.popularity,
                updatedAt: t.updated_at || t.updatedAt || new Date().toISOString(),
            }));

            if (isMounted.current) {
                setTemplates(cachedTemplates);
                setIsFromCache(false);
                setIsLoading(false);
                setError(null);
            }

            // Cache the results
            if (cachedTemplates.length > 0) {
                await localAssetDB.putTemplates(cachedTemplates);
                await localAssetDB.setLastSyncTime('templates', new Date(), cachedTemplates.length);

                if (isMounted.current) {
                    setLastSyncedAt(new Date());
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load templates';
            console.error('[useLocalTemplates] Failed to load from cloud:', errorMessage);

            if (isMounted.current) {
                setError(errorMessage);
                setIsLoading(false);
            }
        }
    }, [categoryId, enabled]);

    // Manual sync trigger
    const syncNow = useCallback(async () => {
        if (!enabled || isSyncing) return;

        setIsSyncing(true);
        try {
            await assetSyncService.syncTemplates();
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
            if (type === 'templates') {
                setIsSyncing(true);
            }
        });

        const unsubscribeComplete = assetSyncService.onSyncComplete((type, result) => {
            if (type === 'templates') {
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
        templates,
        isLoading,
        isFromCache,
        isSyncing,
        lastSyncedAt,
        error,
        syncNow,
        refresh,
    };
}

export default useLocalTemplates;
