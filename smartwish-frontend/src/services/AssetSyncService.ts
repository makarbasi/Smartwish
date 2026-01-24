/**
 * AssetSyncService - Background sync service for stickers and templates
 * 
 * This service handles:
 * - Delta sync (fetching only updated items since last sync)
 * - Image blob caching
 * - Daily automatic sync scheduling
 * - WebSocket listener for admin-triggered sync commands
 * 
 * Used only in kiosk mode for local-first asset loading.
 */

import localAssetDB, { CachedSticker, CachedTemplate } from '@/lib/LocalAssetDB';

// Sync configuration
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const IMAGE_CACHE_BATCH_SIZE = 5; // How many images to cache in parallel
const WS_RECONNECT_DELAY_MS = 5000; // WebSocket reconnection delay

export interface SyncResult {
    success: boolean;
    itemsUpdated: number;
    imagesCached: number;
    error?: string;
}

export interface SyncStatus {
    stickers: {
        lastSyncedAt: Date | null;
        count: number;
        isSyncing: boolean;
    };
    templates: {
        lastSyncedAt: Date | null;
        count: number;
        isSyncing: boolean;
    };
}

class AssetSyncService {
    private isSyncingStickers = false;
    private isSyncingTemplates = false;
    private wsConnection: WebSocket | null = null;
    private wsReconnectTimer: NodeJS.Timeout | null = null;
    private dailySyncTimer: NodeJS.Timeout | null = null;
    private kioskId: string | null = null;

    // Event callbacks
    private onSyncStartCallbacks: Array<(type: 'stickers' | 'templates') => void> = [];
    private onSyncCompleteCallbacks: Array<(type: 'stickers' | 'templates', result: SyncResult) => void> = [];
    private onSyncStatusChangeCallbacks: Array<(status: SyncStatus) => void> = [];

    /**
     * Initialize the sync service with kiosk ID
     */
    async initialize(kioskId: string): Promise<void> {
        this.kioskId = kioskId;
        console.log(`[AssetSyncService] Initialized for kiosk: ${kioskId}`);

        // Open the database
        await localAssetDB.openDB();

        // Check if initial sync is needed
        const needsSync = await this.isSyncNeeded();
        if (needsSync) {
            console.log('[AssetSyncService] Initial sync needed, starting...');
            this.syncAll();
        }

        // Schedule daily sync
        this.scheduleDailySync();

        // Connect to WebSocket for admin commands
        this.connectWebSocket();
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }
        if (this.wsReconnectTimer) {
            clearTimeout(this.wsReconnectTimer);
            this.wsReconnectTimer = null;
        }
        if (this.dailySyncTimer) {
            clearTimeout(this.dailySyncTimer);
            this.dailySyncTimer = null;
        }
        console.log('[AssetSyncService] Destroyed');
    }

    // ============ SYNC OPERATIONS ============

    /**
     * Check if sync is needed (last sync > 24 hours ago or never synced)
     */
    async isSyncNeeded(): Promise<boolean> {
        const [stickerSync, templateSync] = await Promise.all([
            localAssetDB.getLastSyncTime('stickers'),
            localAssetDB.getLastSyncTime('templates'),
        ]);

        const now = Date.now();
        const stickerSyncNeeded = !stickerSync || (now - stickerSync.getTime()) > SYNC_INTERVAL_MS;
        const templateSyncNeeded = !templateSync || (now - templateSync.getTime()) > SYNC_INTERVAL_MS;

        return stickerSyncNeeded || templateSyncNeeded;
    }

    /**
     * Sync stickers from cloud - fetches only items updated after lastSyncedAt
     */
    async syncStickers(): Promise<SyncResult> {
        if (this.isSyncingStickers) {
            console.log('[AssetSyncService] Sticker sync already in progress');
            return { success: false, itemsUpdated: 0, imagesCached: 0, error: 'Sync already in progress' };
        }

        this.isSyncingStickers = true;
        this.notifySyncStart('stickers');

        try {
            console.log('[AssetSyncService] Starting sticker sync...');

            // Get last sync time
            const lastSyncTime = await localAssetDB.getLastSyncTime('stickers');
            const updatedAfter = lastSyncTime?.toISOString();

            // Build API URL
            const base = process.env.NEXT_PUBLIC_API_BASE ??
                (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://smartwish.onrender.com');

            let url = `${base}/stickers?limit=500`; // Get all stickers
            if (updatedAfter) {
                url += `&updated_after=${encodeURIComponent(updatedAfter)}`;
            }

            // Fetch from cloud
            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            const stickers = data.data || data || [];

            // Transform to cached format
            const cachedStickers: CachedSticker[] = stickers.map((s: any) => ({
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

            // Store in IndexedDB
            if (cachedStickers.length > 0) {
                await localAssetDB.putStickers(cachedStickers);
            }

            // Cache image blobs
            const imageUrls = cachedStickers
                .flatMap(s => [s.imageUrl, s.thumbnailUrl])
                .filter((url): url is string => !!url);

            const imagesCached = await this.cacheImages(imageUrls);

            // Update sync time
            const totalCount = await localAssetDB.getStickerCount();
            await localAssetDB.setLastSyncTime('stickers', new Date(), totalCount);

            const result: SyncResult = {
                success: true,
                itemsUpdated: cachedStickers.length,
                imagesCached,
            };

            console.log(`[AssetSyncService] Sticker sync complete: ${cachedStickers.length} items, ${imagesCached} images`);
            this.notifySyncComplete('stickers', result);

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[AssetSyncService] Sticker sync failed:', errorMessage);

            const result: SyncResult = {
                success: false,
                itemsUpdated: 0,
                imagesCached: 0,
                error: errorMessage,
            };

            this.notifySyncComplete('stickers', result);
            return result;
        } finally {
            this.isSyncingStickers = false;
        }
    }

    /**
     * Sync templates from cloud - fetches only items updated after lastSyncedAt
     */
    async syncTemplates(): Promise<SyncResult> {
        if (this.isSyncingTemplates) {
            console.log('[AssetSyncService] Template sync already in progress');
            return { success: false, itemsUpdated: 0, imagesCached: 0, error: 'Sync already in progress' };
        }

        this.isSyncingTemplates = true;
        this.notifySyncStart('templates');

        try {
            console.log('[AssetSyncService] Starting template sync...');

            // Get last sync time
            const lastSyncTime = await localAssetDB.getLastSyncTime('templates');
            const updatedAfter = lastSyncTime?.toISOString();

            // Build API URL - use the enhanced templates endpoint
            const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com';

            let url = `${base}/templates-enhanced/templates/search?limit=500`;
            if (updatedAfter) {
                url += `&updated_after=${encodeURIComponent(updatedAfter)}`;
            }

            // Fetch from cloud
            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            const templates = data.data || data || [];

            // Transform to cached format
            const cachedTemplates: CachedTemplate[] = templates.map((t: any) => ({
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

            // Store in IndexedDB
            if (cachedTemplates.length > 0) {
                await localAssetDB.putTemplates(cachedTemplates);
            }

            // Cache image blobs
            const imageUrls = cachedTemplates
                .flatMap(t => [t.image1, t.image2, t.image3, t.image4])
                .filter((url): url is string => !!url);

            const imagesCached = await this.cacheImages(imageUrls);

            // Update sync time
            const totalCount = await localAssetDB.getTemplateCount();
            await localAssetDB.setLastSyncTime('templates', new Date(), totalCount);

            const result: SyncResult = {
                success: true,
                itemsUpdated: cachedTemplates.length,
                imagesCached,
            };

            console.log(`[AssetSyncService] Template sync complete: ${cachedTemplates.length} items, ${imagesCached} images`);
            this.notifySyncComplete('templates', result);

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[AssetSyncService] Template sync failed:', errorMessage);

            const result: SyncResult = {
                success: false,
                itemsUpdated: 0,
                imagesCached: 0,
                error: errorMessage,
            };

            this.notifySyncComplete('templates', result);
            return result;
        } finally {
            this.isSyncingTemplates = false;
        }
    }

    /**
     * Sync all assets (stickers and templates)
     */
    async syncAll(): Promise<{ stickers: SyncResult; templates: SyncResult }> {
        console.log('[AssetSyncService] Starting full sync...');

        const [stickers, templates] = await Promise.all([
            this.syncStickers(),
            this.syncTemplates(),
        ]);

        console.log('[AssetSyncService] Full sync complete');
        return { stickers, templates };
    }

    /**
     * Cache image blobs for given URLs
     */
    async cacheImages(urls: string[]): Promise<number> {
        let cached = 0;

        // Process in batches to avoid overwhelming the network
        for (let i = 0; i < urls.length; i += IMAGE_CACHE_BATCH_SIZE) {
            const batch = urls.slice(i, i + IMAGE_CACHE_BATCH_SIZE);

            const results = await Promise.allSettled(
                batch.map(async (url) => {
                    // Skip if already cached
                    const isCached = await localAssetDB.hasImageBlob(url);
                    if (isCached) return false;

                    try {
                        const response = await fetch(url);
                        if (!response.ok) return false;

                        const blob = await response.blob();
                        await localAssetDB.cacheImageBlob(url, blob);
                        return true;
                    } catch {
                        return false;
                    }
                })
            );

            cached += results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        }

        return cached;
    }

    // ============ SCHEDULING ============

    /**
     * Schedule daily sync (at midnight or app startup)
     */
    scheduleDailySync(): void {
        // Calculate time until midnight
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const msUntilMidnight = midnight.getTime() - now.getTime();

        console.log(`[AssetSyncService] Scheduled daily sync in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

        this.dailySyncTimer = setTimeout(() => {
            console.log('[AssetSyncService] Daily sync triggered');
            this.syncAll().then(() => {
                // Schedule next sync
                this.scheduleDailySync();
            });
        }, msUntilMidnight);
    }

    // ============ WEBSOCKET ============

    /**
     * Connect to WebSocket for admin sync commands
     */
    connectWebSocket(): void {
        if (!this.kioskId) {
            console.warn('[AssetSyncService] Cannot connect WebSocket without kiosk ID');
            return;
        }

        // Build WebSocket URL
        const wsBase = process.env.NEXT_PUBLIC_WS_URL ??
            process.env.NEXT_PUBLIC_API_BASE?.replace('http', 'ws') ??
            'wss://smartwish.onrender.com';

        const wsUrl = `${wsBase}/ws/kiosk/${this.kioskId}`;

        try {
            console.log(`[AssetSyncService] Connecting to WebSocket: ${wsUrl}`);
            this.wsConnection = new WebSocket(wsUrl);

            this.wsConnection.onopen = () => {
                console.log('[AssetSyncService] WebSocket connected');
            };

            this.wsConnection.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('[AssetSyncService] Failed to parse WebSocket message:', error);
                }
            };

            this.wsConnection.onclose = () => {
                console.log('[AssetSyncService] WebSocket disconnected, reconnecting...');
                this.scheduleWebSocketReconnect();
            };

            this.wsConnection.onerror = (error) => {
                console.error('[AssetSyncService] WebSocket error:', error);
            };
        } catch (error) {
            console.error('[AssetSyncService] Failed to connect WebSocket:', error);
            this.scheduleWebSocketReconnect();
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    private handleWebSocketMessage(message: { type: string; data?: any }): void {
        console.log('[AssetSyncService] Received WebSocket message:', message.type);

        switch (message.type) {
            case 'sync_assets':
                console.log('[AssetSyncService] Admin triggered asset sync');
                this.syncAll();
                break;

            case 'sync_stickers':
                console.log('[AssetSyncService] Admin triggered sticker sync');
                this.syncStickers();
                break;

            case 'sync_templates':
                console.log('[AssetSyncService] Admin triggered template sync');
                this.syncTemplates();
                break;

            case 'clear_cache':
                console.log('[AssetSyncService] Admin triggered cache clear');
                localAssetDB.clearAll().then(() => this.syncAll());
                break;

            default:
                console.log('[AssetSyncService] Unknown message type:', message.type);
        }
    }

    /**
     * Schedule WebSocket reconnection
     */
    private scheduleWebSocketReconnect(): void {
        if (this.wsReconnectTimer) {
            clearTimeout(this.wsReconnectTimer);
        }

        this.wsReconnectTimer = setTimeout(() => {
            this.connectWebSocket();
        }, WS_RECONNECT_DELAY_MS);
    }

    // ============ STATUS & EVENTS ============

    /**
     * Get current sync status
     */
    async getStatus(): Promise<SyncStatus> {
        const [stickerMeta, templateMeta] = await Promise.all([
            localAssetDB.getSyncMeta('stickers'),
            localAssetDB.getSyncMeta('templates'),
        ]);

        return {
            stickers: {
                lastSyncedAt: stickerMeta?.lastSyncedAt || null,
                count: stickerMeta?.count || 0,
                isSyncing: this.isSyncingStickers,
            },
            templates: {
                lastSyncedAt: templateMeta?.lastSyncedAt || null,
                count: templateMeta?.count || 0,
                isSyncing: this.isSyncingTemplates,
            },
        };
    }

    /**
     * Register callback for sync start
     */
    onSyncStart(callback: (type: 'stickers' | 'templates') => void): () => void {
        this.onSyncStartCallbacks.push(callback);
        return () => {
            this.onSyncStartCallbacks = this.onSyncStartCallbacks.filter(cb => cb !== callback);
        };
    }

    /**
     * Register callback for sync complete
     */
    onSyncComplete(callback: (type: 'stickers' | 'templates', result: SyncResult) => void): () => void {
        this.onSyncCompleteCallbacks.push(callback);
        return () => {
            this.onSyncCompleteCallbacks = this.onSyncCompleteCallbacks.filter(cb => cb !== callback);
        };
    }

    private notifySyncStart(type: 'stickers' | 'templates'): void {
        this.onSyncStartCallbacks.forEach(cb => cb(type));
    }

    private notifySyncComplete(type: 'stickers' | 'templates', result: SyncResult): void {
        this.onSyncCompleteCallbacks.forEach(cb => cb(type, result));
    }
}

// Export singleton instance
export const assetSyncService = new AssetSyncService();
export default assetSyncService;
