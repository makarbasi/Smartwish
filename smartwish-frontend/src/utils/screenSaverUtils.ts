/**
 * Screen Saver Utility Functions
 */

import { ScreenSaverItem } from './kioskConfig';

/**
 * Select a screen saver based on weighted random selection
 * Higher weight = higher probability of being selected
 */
export function selectWeightedScreenSaver(
  screenSavers: ScreenSaverItem[]
): ScreenSaverItem | null {
  // Filter to only enabled screen savers
  const enabledScreenSavers = screenSavers.filter(ss => ss.enabled !== false);
  
  if (enabledScreenSavers.length === 0) {
    return null;
  }
  
  if (enabledScreenSavers.length === 1) {
    return enabledScreenSavers[0];
  }
  
  // Calculate total weight
  const totalWeight = enabledScreenSavers.reduce((sum, ss) => sum + (ss.weight || 1), 0);
  
  // Generate random number between 0 and totalWeight
  const random = Math.random() * totalWeight;
  
  // Find the screen saver that corresponds to this random number
  let cumulativeWeight = 0;
  for (const screenSaver of enabledScreenSavers) {
    cumulativeWeight += screenSaver.weight || 1;
    if (random < cumulativeWeight) {
      return screenSaver;
    }
  }
  
  // Fallback to last screen saver (should not happen)
  return enabledScreenSavers[enabledScreenSavers.length - 1];
}

/**
 * Get the next screen saver in rotation (round-robin based on index)
 */
export function getNextScreenSaverIndex(
  currentIndex: number,
  screenSavers: ScreenSaverItem[]
): number {
  const enabledScreenSavers = screenSavers.filter(ss => ss.enabled !== false);
  
  if (enabledScreenSavers.length === 0) {
    return -1;
  }
  
  return (currentIndex + 1) % enabledScreenSavers.length;
}

/**
 * Generate a unique ID for a new screen saver
 */
export function generateScreenSaverId(): string {
  return `ss-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate a screen saver configuration
 */
export function validateScreenSaver(screenSaver: Partial<ScreenSaverItem>): string[] {
  const errors: string[] = [];
  
  if (!screenSaver.type) {
    errors.push('Screen saver type is required');
  }
  
  if (screenSaver.type === 'video' || screenSaver.type === 'html') {
    if (!screenSaver.url || screenSaver.url.trim() === '') {
      errors.push('URL is required for video and HTML screen savers');
    }
  }
  
  if (screenSaver.weight !== undefined && (screenSaver.weight < 1 || screenSaver.weight > 100)) {
    errors.push('Weight must be between 1 and 100');
  }
  
  if (screenSaver.duration !== undefined && screenSaver.duration < 5) {
    errors.push('Duration must be at least 5 seconds');
  }
  
  return errors;
}

/**
 * Check if a URL is a valid video URL
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url) return false;
  
  // Check for common video file extensions
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  const hasVideoExtension = videoExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );
  
  // Check for YouTube URLs
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  
  // Check for Vimeo URLs
  const isVimeo = url.includes('vimeo.com');
  
  return hasVideoExtension || isYouTube || isVimeo;
}

/**
 * Convert YouTube URL to embeddable format
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  // Handle youtu.be format
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${shortMatch[1]}&controls=0&showinfo=0&rel=0`;
  }
  
  // Handle youtube.com format
  const longMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (longMatch) {
    return `https://www.youtube.com/embed/${longMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${longMatch[1]}&controls=0&showinfo=0&rel=0`;
  }
  
  // Handle youtube.com/embed format (already embeddable)
  if (url.includes('youtube.com/embed/')) {
    // Add autoplay and mute parameters if not present
    const hasParams = url.includes('?');
    const separator = hasParams ? '&' : '?';
    if (!url.includes('autoplay=')) {
      url += `${separator}autoplay=1&mute=1&loop=1&controls=0`;
    }
    return url;
  }
  
  return null;
}

/**
 * Get display-friendly type name
 */
export function getScreenSaverTypeName(type: string): string {
  switch (type) {
    case 'video':
      return 'Video';
    case 'html':
      return 'HTML Page';
    case 'default':
      return 'Card Showcase';
    case 'none':
      return 'No Screen Saver';
    default:
      return type;
  }
}
