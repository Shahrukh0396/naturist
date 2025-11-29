/**
 * usePlaces Hook
 * Provides instant cached place loading with background Firebase sync
 * Returns: { places, loading }
 * - places: from cache immediately
 * - loading: true only on first launch OR while syncing
 */

import { useState, useEffect, useRef } from 'react';
import FastImage from 'react-native-fast-image';
import { loadPlacesFromCache, savePlacesToCache } from '../cache/cacheService';
import { syncPlacesFromFirebase } from '../services/firebasePlacesService';

/**
 * Preload images using FastImage
 * @param {Array} places - Array of places with image URLs
 * @returns {Promise<void>}
 */
const preloadImages = async (places) => {
  if (!places || places.length === 0) {
    return;
  }

  try {
    // Collect all image URLs from places
    const imageUrls = [];
    places.forEach((place) => {
      // Add main image
      if (place.image && place.image.startsWith('http')) {
        imageUrls.push({ uri: place.image });
      }
      
      // Add imageUrls (Firebase Storage URLs)
      if (place.imageUrls && Array.isArray(place.imageUrls)) {
        place.imageUrls.forEach((url) => {
          if (url && url.startsWith('http') && !imageUrls.find((img) => img.uri === url)) {
            imageUrls.push({ uri: url });
          }
        });
      }
      
      // Add first few images from images array
      if (place.images && Array.isArray(place.images)) {
        place.images.slice(0, 3).forEach((url) => {
          if (url && url.startsWith('http') && !imageUrls.find((img) => img.uri === url)) {
            imageUrls.push({ uri: url });
          }
        });
      }
    });

    // Limit to first 50 images to avoid overwhelming the system
    const imagesToPreload = imageUrls.slice(0, 50);

    if (imagesToPreload.length > 0) {
      if (__DEV__) {
        console.log(`🔄 [usePlaces] Preloading ${imagesToPreload.length} images...`);
      }

      await FastImage.preload(imagesToPreload);

      if (__DEV__) {
        console.log(`✅ [usePlaces] Preloaded ${imagesToPreload.length} images`);
      }
    }
  } catch (error) {
    console.error('❌ [usePlaces] Error preloading images:', error);
    // Don't throw - image preloading is non-critical
  }
};

/**
 * usePlaces Hook
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Maximum number of places to fetch (default: 200)
 * @param {number} options.maxImagesPerPlace - Maximum images per place (default: 5)
 * @param {boolean} options.autoSync - Automatically sync from Firebase (default: true)
 * @returns {Object} - { places, loading, error, refresh }
 */
export const usePlaces = ({
  limit = 200,
  maxImagesPerPlace = 5,
  autoSync = true,
} = {}) => {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);
  const hasLoadedCacheRef = useRef(false);
  const syncInProgressRef = useRef(false);

  /**
   * Load places from cache (instant)
   */
  const loadCachedPlaces = async () => {
    try {
      const cachedPlaces = await loadPlacesFromCache();
      
      if (cachedPlaces && cachedPlaces.length > 0 && isMountedRef.current) {
        setPlaces(cachedPlaces);
        hasLoadedCacheRef.current = true;
        
        // Preload images in background
        preloadImages(cachedPlaces).catch(() => {
          // Silently fail - non-critical
        });
        
        if (__DEV__) {
          console.log(`✅ [usePlaces] Loaded ${cachedPlaces.length} places from cache (instant)`);
        }
      }
      
      return cachedPlaces;
    } catch (err) {
      console.error('❌ [usePlaces] Error loading cached places:', err);
      return null;
    }
  };

  /**
   * Sync places from Firebase (background)
   */
  const syncPlaces = async () => {
    // Prevent multiple simultaneous syncs
    if (syncInProgressRef.current) {
      if (__DEV__) {
        console.log('ℹ️ [usePlaces] Sync already in progress, skipping...');
      }
      return;
    }

    syncInProgressRef.current = true;

    try {
      if (__DEV__) {
        console.log('🔄 [usePlaces] Starting background sync from Firebase...');
      }

      // Sync from Firebase with image URL resolution
      const syncedPlaces = await syncPlacesFromFirebase(limit, maxImagesPerPlace);

      if (syncedPlaces && syncedPlaces.length > 0) {
        // Save to cache
        await savePlacesToCache(syncedPlaces);

        // Update places if component is still mounted
        if (isMountedRef.current) {
          setPlaces(syncedPlaces);
          
          // Preload images for newly synced places
          preloadImages(syncedPlaces).catch(() => {
            // Silently fail - non-critical
          });
          
          if (__DEV__) {
            console.log(`✅ [usePlaces] Background sync completed: ${syncedPlaces.length} places`);
          }
        }
      } else {
        if (__DEV__) {
          console.warn('⚠️ [usePlaces] No places returned from sync');
        }
      }
    } catch (err) {
      console.error('❌ [usePlaces] Error syncing places:', err);
      
      if (isMountedRef.current) {
        setError(err);
      }
    } finally {
      syncInProgressRef.current = false;
      
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  /**
   * Manual refresh function
   */
  const refresh = async () => {
    setLoading(true);
    setError(null);
    await syncPlaces();
  };

  /**
   * Initial load effect
   */
  useEffect(() => {
    isMountedRef.current = true;
    let mounted = true;

    const initialize = async () => {
      try {
        // Step 1: Load from cache immediately (instant)
        const cachedPlaces = await loadCachedPlaces();

        // Step 2: Set loading to false after cache load (UI can render immediately)
        if (mounted) {
          setLoading(false);
        }

        // Step 3: Sync from Firebase in background (if enabled)
        if (autoSync && mounted) {
          // Don't wait for sync - it happens in background
          syncPlaces().catch(() => {
            // Error already handled in syncPlaces
          });
        }
      } catch (err) {
        console.error('❌ [usePlaces] Error during initialization:', err);
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMountedRef.current = false;
      mounted = false;
    };
  }, [autoSync, limit, maxImagesPerPlace]);

  return {
    places,
    loading,
    error,
    refresh,
  };
};

export default usePlaces;

