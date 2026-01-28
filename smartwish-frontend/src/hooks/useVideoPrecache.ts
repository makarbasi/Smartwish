"use client";

import { useEffect, useRef, useCallback } from "react";
import localAssetDB from "@/lib/LocalAssetDB";
import { ScreenSaverItem } from "@/utils/kioskConfig";

/**
 * Hook to pre-cache all videos from screen saver configuration
 * 
 * This hook:
 * 1. Extracts all video URLs from the screen saver config (both type="video" and HTML with videoUrl)
 * 2. Downloads and caches them in IndexedDB if not already cached
 * 3. Returns the caching status
 * 
 * Videos are cached using the existing localAssetDB infrastructure,
 * so VideoScreenSaver will automatically use cached versions.
 */
export function useVideoPrecache(screenSavers: ScreenSaverItem[]) {
    const isCachingRef = useRef(false);
    const cachedUrlsRef = useRef<Set<string>>(new Set());

    // Extract all video URLs from screen saver configuration
    const getVideoUrls = useCallback((items: ScreenSaverItem[]): string[] => {
        const urls: string[] = [];

        for (const item of items) {
            if (item.enabled === false) continue;

            // Video type screen savers
            if (item.type === "video" && item.url) {
                // Skip YouTube videos (can't be cached)
                if (!item.url.includes("youtube.com") && !item.url.includes("youtu.be")) {
                    urls.push(item.url);
                }
            }

            // HTML screen savers with embedded video
            if (item.type === "html" && item.videoUrl) {
                // Skip YouTube videos
                if (!item.videoUrl.includes("youtube.com") && !item.videoUrl.includes("youtu.be")) {
                    urls.push(item.videoUrl);
                }
            }
        }

        return [...new Set(urls)]; // Remove duplicates
    }, []);

    // Pre-cache a single video
    const cacheVideo = useCallback(async (videoUrl: string): Promise<boolean> => {
        // Skip if already cached in this session
        if (cachedUrlsRef.current.has(videoUrl)) {
            return true;
        }

        try {
            // Check if already in IndexedDB
            const existingBlob = await localAssetDB.getImageBlob(videoUrl);
            if (existingBlob) {
                console.log(`[VideoPrecache] ✅ Already cached: ${videoUrl.substring(0, 50)}...`);
                cachedUrlsRef.current.add(videoUrl);
                return true;
            }

            // Download and cache
            console.log(`[VideoPrecache] Downloading: ${videoUrl.substring(0, 50)}...`);
            const response = await fetch(videoUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const sizeMB = (blob.size / 1024 / 1024).toFixed(2);

            await localAssetDB.cacheImageBlob(videoUrl, blob);
            console.log(`[VideoPrecache] ✅ Cached (${sizeMB} MB): ${videoUrl.substring(0, 50)}...`);
            cachedUrlsRef.current.add(videoUrl);
            return true;

        } catch (error) {
            console.error(`[VideoPrecache] ❌ Failed to cache: ${videoUrl}`, error);
            return false;
        }
    }, []);

    // Pre-cache all videos
    const preCacheAll = useCallback(async (items: ScreenSaverItem[]) => {
        if (isCachingRef.current) {
            console.log("[VideoPrecache] Caching already in progress, skipping...");
            return;
        }

        isCachingRef.current = true;
        const videoUrls = getVideoUrls(items);

        if (videoUrls.length === 0) {
            console.log("[VideoPrecache] No videos to cache");
            isCachingRef.current = false;
            return;
        }

        console.log(`[VideoPrecache] Starting pre-cache of ${videoUrls.length} video(s)...`);

        let successCount = 0;
        for (const url of videoUrls) {
            const success = await cacheVideo(url);
            if (success) successCount++;
        }

        console.log(`[VideoPrecache] ✅ Pre-caching complete: ${successCount}/${videoUrls.length} videos cached`);
        isCachingRef.current = false;
    }, [getVideoUrls, cacheVideo]);

    // Run pre-caching when screen savers config changes
    useEffect(() => {
        if (screenSavers.length > 0) {
            preCacheAll(screenSavers);
        }
    }, [screenSavers, preCacheAll]);

    return {
        cacheVideo,
        preCacheAll,
    };
}

/**
 * Utility function to get a cached video blob URL
 * Call this to get a blob URL for a video that should be in the cache
 * Returns the original URL if not cached
 */
export async function getCachedVideoUrl(videoUrl: string): Promise<string> {
    try {
        const cachedBlob = await localAssetDB.getImageBlob(videoUrl);
        if (cachedBlob) {
            return URL.createObjectURL(cachedBlob);
        }
    } catch (error) {
        console.error("[getCachedVideoUrl] Error:", error);
    }
    return videoUrl;
}

export default useVideoPrecache;
