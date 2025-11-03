/**
 * React Hook for Image Preloading
 * Provides easy integration of image preloading into React components
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { imagePreloader, PreloadContext } from '../services/imagePreloaderService';
import { Place } from '../types';
import { Location } from '../services/locationService';

interface UseImagePreloaderOptions {
  enabled?: boolean;
  preloadDelay?: number;
  maxImagesPerScreen?: number;
}

interface UseImagePreloaderReturn {
  preloadImages: (context: PreloadContext) => Promise<void>;
  isImagePreloaded: (url: string) => boolean;
  getPreloadedImageUrl: (url: string) => string | null;
  clearCache: () => void;
  getCacheStats: () => { total: number; loaded: number; errors: number };
}

export const useImagePreloader = (options: UseImagePreloaderOptions = {}): UseImagePreloaderReturn => {
  const {
    enabled = true,
    preloadDelay = 500,
    maxImagesPerScreen = 20,
  } = options;

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update preloader config when options change
  useEffect(() => {
    if (enabled) {
      imagePreloader.updateConfig({
        preloadDelay,
        maxImagesPerScreen,
      });
    }
  }, [enabled, preloadDelay, maxImagesPerScreen]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, clear cache to free memory
        imagePreloader.clearCache();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  const preloadImages = useCallback(async (context: PreloadContext): Promise<void> => {
    if (!enabled) return;

    // Clear any existing preload timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Set new timeout for preloading
    preloadTimeoutRef.current = setTimeout(async () => {
      try {
        await imagePreloader.preloadImagesForContext(context);
      } catch (error) {
        console.error('Error in preloadImages:', error);
      }
    }, preloadDelay);
  }, [enabled, preloadDelay]);

  const isImagePreloaded = useCallback((url: string): boolean => {
    return imagePreloader.isImagePreloaded(url);
  }, []);

  const getPreloadedImageUrl = useCallback((url: string): string | null => {
    return imagePreloader.getPreloadedImageUrl(url);
  }, []);

  const clearCache = useCallback((): void => {
    imagePreloader.clearCache();
  }, []);

  const getCacheStats = useCallback(() => {
    return imagePreloader.getCacheStats();
  }, []);

  return {
    preloadImages,
    isImagePreloaded,
    getPreloadedImageUrl,
    clearCache,
    getCacheStats,
  };
};

/**
 * Hook for preloading images based on current screen and navigation
 */
export const useScreenImagePreloader = (
  currentScreen: 'home' | 'explore' | 'map' | 'search',
  userLocation: Location | null,
  additionalContext?: {
    searchQuery?: string;
    selectedCategory?: string;
    currentPlaces?: Place[];
    navigationHistory?: string[];
  }
) => {
  const { preloadImages, isImagePreloaded, getPreloadedImageUrl, clearCache, getCacheStats } = useImagePreloader();

  // Preload images when context changes
  useEffect(() => {
    if (!userLocation) return;

    const context: PreloadContext = {
      currentScreen,
      userLocation,
      searchQuery: additionalContext?.searchQuery,
      selectedCategory: additionalContext?.selectedCategory,
      currentPlaces: additionalContext?.currentPlaces || [],
      navigationHistory: additionalContext?.navigationHistory || [],
    };

    preloadImages(context);
  }, [
    currentScreen,
    userLocation,
    additionalContext?.searchQuery,
    additionalContext?.selectedCategory,
    additionalContext?.currentPlaces,
    additionalContext?.navigationHistory,
    preloadImages,
  ]);

  return {
    isImagePreloaded,
    getPreloadedImageUrl,
    clearCache,
    getCacheStats,
  };
};

export default useImagePreloader;
