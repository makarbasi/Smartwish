/**
 * LocalAssetDB - IndexedDB wrapper for local-first asset caching
 * 
 * This service provides persistent storage for stickers, templates, and image blobs
 * to enable instant loading and offline capability for kiosk mode.
 * 
 * Object Stores:
 * - stickers: Sticker metadata (id, title, category, imageUrl, etc.)
 * - templates: Template metadata (id, title, slug, category_id, images, etc.)
 * - imageBlobs: Cached image blobs keyed by URL
 * - syncMeta: Sync tracking (lastSyncedAt per asset type)
 */

const DB_NAME = 'SmartWishAssets';
const DB_VERSION = 1;

// Type definitions
export interface CachedSticker {
  id: string;
  title: string;
  slug?: string;
  category?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  tags?: string[];
  popularity?: number;
  updatedAt: string;
}

export interface CachedTemplate {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  categoryName?: string;
  description?: string;
  language?: string;
  region?: string;
  price?: number;
  image1: string;
  image2: string;
  image3: string;
  image4: string;
  tags?: string[];
  popularity?: number;
  updatedAt: string;
}

export interface CachedImageBlob {
  url: string;
  blob: Blob;
  cachedAt: Date;
}

export interface SyncMeta {
  type: 'stickers' | 'templates';
  lastSyncedAt: Date;
  count: number;
}

class LocalAssetDB {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Open/initialize the IndexedDB database
   */
  async openDB(): Promise<IDBDatabase> {
    // Return existing connection if available
    if (this.db) {
      return this.db;
    }

    // Return existing promise if initialization is in progress
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[LocalAssetDB] Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('[LocalAssetDB] Upgrading database schema...');

        // Create stickers store
        if (!db.objectStoreNames.contains('stickers')) {
          const stickersStore = db.createObjectStore('stickers', { keyPath: 'id' });
          stickersStore.createIndex('category', 'category', { unique: false });
          stickersStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          console.log('[LocalAssetDB] Created stickers store');
        }

        // Create templates store
        if (!db.objectStoreNames.contains('templates')) {
          const templatesStore = db.createObjectStore('templates', { keyPath: 'id' });
          templatesStore.createIndex('categoryId', 'categoryId', { unique: false });
          templatesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          console.log('[LocalAssetDB] Created templates store');
        }

        // Create imageBlobs store
        if (!db.objectStoreNames.contains('imageBlobs')) {
          db.createObjectStore('imageBlobs', { keyPath: 'url' });
          console.log('[LocalAssetDB] Created imageBlobs store');
        }

        // Create syncMeta store
        if (!db.objectStoreNames.contains('syncMeta')) {
          db.createObjectStore('syncMeta', { keyPath: 'type' });
          console.log('[LocalAssetDB] Created syncMeta store');
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
      console.log('[LocalAssetDB] Database connection closed');
    }
  }

  // ============ STICKERS ============

  /**
   * Get all stickers, optionally filtered by category
   */
  async getStickers(category?: string): Promise<CachedSticker[]> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('stickers', 'readonly');
      const store = transaction.objectStore('stickers');

      let request: IDBRequest;
      if (category) {
        const index = store.index('category');
        request = index.getAll(category);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to get stickers:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a single sticker by ID
   */
  async getSticker(id: string): Promise<CachedSticker | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('stickers', 'readonly');
      const store = transaction.objectStore('stickers');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to get sticker:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Upsert multiple stickers
   */
  async putStickers(stickers: CachedSticker[]): Promise<void> {
    if (stickers.length === 0) return;

    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('stickers', 'readwrite');
      const store = transaction.objectStore('stickers');

      transaction.oncomplete = () => {
        console.log(`[LocalAssetDB] Upserted ${stickers.length} stickers`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('[LocalAssetDB] Failed to put stickers:', transaction.error);
        reject(transaction.error);
      };

      for (const sticker of stickers) {
        store.put(sticker);
      }
    });
  }

  /**
   * Clear all stickers
   */
  async clearStickers(): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('stickers', 'readwrite');
      const store = transaction.objectStore('stickers');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[LocalAssetDB] Cleared all stickers');
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to clear stickers:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get sticker count
   */
  async getStickerCount(): Promise<number> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('stickers', 'readonly');
      const store = transaction.objectStore('stickers');
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============ TEMPLATES ============

  /**
   * Get all templates, optionally filtered by category
   */
  async getTemplates(categoryId?: string): Promise<CachedTemplate[]> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('templates', 'readonly');
      const store = transaction.objectStore('templates');

      let request: IDBRequest;
      if (categoryId) {
        const index = store.index('categoryId');
        request = index.getAll(categoryId);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to get templates:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<CachedTemplate | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('templates', 'readonly');
      const store = transaction.objectStore('templates');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to get template:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Upsert multiple templates
   */
  async putTemplates(templates: CachedTemplate[]): Promise<void> {
    if (templates.length === 0) return;

    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('templates', 'readwrite');
      const store = transaction.objectStore('templates');

      transaction.oncomplete = () => {
        console.log(`[LocalAssetDB] Upserted ${templates.length} templates`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('[LocalAssetDB] Failed to put templates:', transaction.error);
        reject(transaction.error);
      };

      for (const template of templates) {
        store.put(template);
      }
    });
  }

  /**
   * Clear all templates
   */
  async clearTemplates(): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('templates', 'readwrite');
      const store = transaction.objectStore('templates');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[LocalAssetDB] Cleared all templates');
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to clear templates:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get template count
   */
  async getTemplateCount(): Promise<number> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('templates', 'readonly');
      const store = transaction.objectStore('templates');
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============ IMAGE BLOBS ============

  /**
   * Cache an image blob by URL
   */
  async cacheImageBlob(url: string, blob: Blob): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('imageBlobs', 'readwrite');
      const store = transaction.objectStore('imageBlobs');

      const data: CachedImageBlob = {
        url,
        blob,
        cachedAt: new Date(),
      };

      const request = store.put(data);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to cache image blob:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a cached image blob by URL
   */
  async getImageBlob(url: string): Promise<Blob | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('imageBlobs', 'readonly');
      const store = transaction.objectStore('imageBlobs');
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result as CachedImageBlob | undefined;
        resolve(result?.blob || null);
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to get image blob:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Check if an image is cached
   */
  async hasImageBlob(url: string): Promise<boolean> {
    const blob = await this.getImageBlob(url);
    return blob !== null;
  }

  /**
   * Clear all cached images
   */
  async clearImageBlobs(): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('imageBlobs', 'readwrite');
      const store = transaction.objectStore('imageBlobs');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[LocalAssetDB] Cleared all image blobs');
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to clear image blobs:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get cached image count
   */
  async getImageBlobCount(): Promise<number> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('imageBlobs', 'readonly');
      const store = transaction.objectStore('imageBlobs');
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============ SYNC META ============

  /**
   * Get the last sync time for a given asset type
   */
  async getLastSyncTime(type: 'stickers' | 'templates'): Promise<Date | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('syncMeta', 'readonly');
      const store = transaction.objectStore('syncMeta');
      const request = store.get(type);

      request.onsuccess = () => {
        const result = request.result as SyncMeta | undefined;
        resolve(result?.lastSyncedAt || null);
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to get sync meta:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Set the last sync time for a given asset type
   */
  async setLastSyncTime(type: 'stickers' | 'templates', date: Date, count: number): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('syncMeta', 'readwrite');
      const store = transaction.objectStore('syncMeta');

      const data: SyncMeta = {
        type,
        lastSyncedAt: date,
        count,
      };

      const request = store.put(data);

      request.onsuccess = () => {
        console.log(`[LocalAssetDB] Updated sync meta for ${type}: ${date.toISOString()}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to set sync meta:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get sync meta for a type
   */
  async getSyncMeta(type: 'stickers' | 'templates'): Promise<SyncMeta | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('syncMeta', 'readonly');
      const store = transaction.objectStore('syncMeta');
      const request = store.get(type);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============ UTILITY ============

  /**
   * Clear all data from all stores
   */
  async clearAll(): Promise<void> {
    await this.clearStickers();
    await this.clearTemplates();
    await this.clearImageBlobs();
    console.log('[LocalAssetDB] Cleared all data');
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    stickers: number;
    templates: number;
    images: number;
    lastStickerSync: Date | null;
    lastTemplateSync: Date | null;
  }> {
    const [stickers, templates, images, stickerMeta, templateMeta] = await Promise.all([
      this.getStickerCount(),
      this.getTemplateCount(),
      this.getImageBlobCount(),
      this.getSyncMeta('stickers'),
      this.getSyncMeta('templates'),
    ]);

    return {
      stickers,
      templates,
      images,
      lastStickerSync: stickerMeta?.lastSyncedAt || null,
      lastTemplateSync: templateMeta?.lastSyncedAt || null,
    };
  }

  /**
   * Delete the entire database
   */
  static async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);

      request.onsuccess = () => {
        console.log('[LocalAssetDB] Database deleted');
        resolve();
      };

      request.onerror = () => {
        console.error('[LocalAssetDB] Failed to delete database:', request.error);
        reject(request.error);
      };
    });
  }
}

// Export singleton instance
export const localAssetDB = new LocalAssetDB();
export default localAssetDB;
