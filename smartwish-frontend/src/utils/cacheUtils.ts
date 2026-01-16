// Utility functions for cache management

/**
 * Add cache-busting parameter to an image URL
 */
export function addCacheBusting(url: string): string {
  if (!url) return url;
  
  const timestamp = Date.now();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${timestamp}`;
}

/**
 * Remove cache-busting parameters from URL
 */
export function removeCacheBusting(url: string): string {
  if (!url) return url;
  
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('v');
    urlObj.searchParams.delete('_');
    urlObj.searchParams.delete('cache');
    urlObj.searchParams.delete('t');
    return urlObj.toString();
  } catch {
    // If URL parsing fails, try simple string replacement
    return url.replace(/[?&](?:v|_|cache|t)=[^&]*/g, '');
  }
}

/**
 * Force refresh an image element by adding cache-busting parameter
 */
export function forceImageRefresh(imageElement: HTMLImageElement): void {
  if (!imageElement || !imageElement.src) return;
  
  const originalSrc = imageElement.src;
  const cleanUrl = removeCacheBusting(originalSrc);
  const cacheBustedUrl = addCacheBusting(cleanUrl);
  
  imageElement.src = cacheBustedUrl;
}

/**
 * Force refresh all images on the page that match a URL pattern
 */
export function forceRefreshImagesMatching(urlPattern: string): void {
  const images = document.querySelectorAll('img');
  images.forEach((img) => {
    if (img.src && img.src.includes(urlPattern)) {
      forceImageRefresh(img);
    }
  });
}

/**
 * Preload an image with cache-busting to ensure it's fresh
 */
export function preloadImageWithCacheBusting(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cacheBustedUrl = addCacheBusting(url);
    
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to preload image: ${cacheBustedUrl}`));
    
    img.src = cacheBustedUrl;
  });
}
