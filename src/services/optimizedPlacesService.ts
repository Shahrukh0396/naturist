/**
 * Optimized Places Service
 * Uses Lightning Server for instant, offline-first data loading
 * All data comes from AsyncStorage - no internet calls required
 * 
 * Optimization Strategy:
 * 1. Lightning Server: All data served instantly from AsyncStorage (offline-first)
 * 2. Minimal data: Only fetches 10 places per category (not all places)
 * 3. Local images: Uses local images from JSON (no Firebase Storage calls)
 * 4. Zero network latency: Everything is local, instant access
 * 
 * Flow:
 * - LandingScreen: Initializes Lightning Server, fetches location + 10 places per category
 * - HomeScreen: Loads from Lightning Server instantly (no network calls)
 * - All data comes from user's phone storage (AsyncStorage)
 */

import { Place } from '../types';
import { Location, getCurrentLocation } from './locationService';
import lightningServer, { initializeLightningServer } from './lightningServer';
import {
  saveUserLocationToCache,
  loadUserLocationFromCache,
  saveCategorizedPlacesToCache,
  loadCategorizedPlacesFromCache,
  isInitialDataCacheValid,
} from '../cache/cacheService';

const PLACES_PER_CATEGORY = 10;
const CACHE_MAX_AGE = 6 * 60 * 60 * 1000; // 6 hours

export interface CategorizedPlaces {
  nearby: Place[];
  popular: Place[];
  explore: Place[];
}

export interface InitialData {
  location: Location;
  places: CategorizedPlaces;
}

/**
 * Load initial data from cache (instant)
 * Returns cached data if available and valid
 */
export const loadInitialDataFromCache = async (): Promise<InitialData | null> => {
  try {
    // Check if cache is valid
    const isValid = await isInitialDataCacheValid(CACHE_MAX_AGE);
    if (!isValid) {
      if (__DEV__) {
        console.log('ℹ️ [OptimizedPlaces] Cache expired or invalid');
      }
      return null;
    }

    // Load location and places from cache
    const location = await loadUserLocationFromCache();
    const places = await loadCategorizedPlacesFromCache();

    if (!location || !places) {
      if (__DEV__) {
        console.log('ℹ️ [OptimizedPlaces] No cached data found');
      }
      return null;
    }

    // Invalidate cache if places lack sqlId (needed for Firebase Storage images)
    const samplePlace = places.popular?.[0] ?? places.explore?.[0];
    if (samplePlace && samplePlace.sqlId == null) {
      if (__DEV__) {
        console.log('ℹ️ [OptimizedPlaces] Cached places lack sqlId, refetching for images');
      }
      return null;
    }

    if (__DEV__) {
      console.log('✅ [OptimizedPlaces] Loaded initial data from cache');
    }

    return {
      location,
      places,
    };
  } catch (error) {
    console.error('❌ [OptimizedPlaces] Error loading from cache:', error);
    return null;
  }
};

/**
 * Fetch initial data (location + 10 places per category)
 * Uses Lightning Server - instant, offline, no internet calls
 */
export const fetchInitialData = async (): Promise<InitialData> => {
  try {
    if (__DEV__) {
      console.log('🔄 [OptimizedPlaces] Fetching initial data from Lightning Server...');
    }

    // Step 1: Ensure Lightning Server is initialized
    await initializeLightningServer();

    // Step 2: Get user location
    const location = await getCurrentLocation();
    if (__DEV__) {
      console.log('✅ [OptimizedPlaces] Got user location:', location);
    }

    // Step 3: Fetch places from Lightning Server (instant, no network calls)
    // lightningServer is already a singleton instance (not a function)
    const [nearby, popular, explore] = await Promise.all([
      lightningServer.places('nearby', location, PLACES_PER_CATEGORY),
      lightningServer.places('popular', location, PLACES_PER_CATEGORY),
      lightningServer.places('explore', location, PLACES_PER_CATEGORY),
    ]);

    const categorizedPlaces: CategorizedPlaces = {
      nearby,
      popular,
      explore,
    };

    if (__DEV__) {
      console.log(`✅ [OptimizedPlaces] Fetched from Lightning Server - Nearby: ${categorizedPlaces.nearby.length}, Popular: ${categorizedPlaces.popular.length}, Explore: ${categorizedPlaces.explore.length}`);
    }

    // Step 4: Save to cache (non-blocking)
    saveToCache(location, categorizedPlaces).catch((error) => {
      console.warn('⚠️ [OptimizedPlaces] Failed to save to cache:', error);
    });

    return {
      location,
      places: categorizedPlaces,
    };
  } catch (error) {
    console.error('❌ [OptimizedPlaces] Error fetching initial data:', error);
    throw error;
  }
};

// Note: All fetching is now done through Lightning Server
// No separate fetch functions needed - Lightning Server handles everything

/**
 * Save data to cache (non-blocking)
 */
const saveToCache = async (location: Location, places: CategorizedPlaces): Promise<void> => {
  try {
    await Promise.all([
      saveUserLocationToCache(location),
      saveCategorizedPlacesToCache(places),
    ]);
    if (__DEV__) {
      console.log('✅ [OptimizedPlaces] Saved initial data to cache');
    }
  } catch (error) {
    console.error('❌ [OptimizedPlaces] Error saving to cache:', error);
    throw error;
  }
};

/**
 * Get initial data with cache-first strategy
 * Returns cached data immediately if available, otherwise fetches new data
 */
export const getInitialData = async (): Promise<InitialData> => {
  // Try cache first
  const cachedData = await loadInitialDataFromCache();
  if (cachedData) {
    if (__DEV__) {
      console.log('✅ [OptimizedPlaces] Using cached initial data');
    }
    return cachedData;
  }

  // Cache miss or invalid - fetch new data
  if (__DEV__) {
    console.log('🔄 [OptimizedPlaces] Cache miss, fetching new data...');
  }
  return await fetchInitialData();
};

/**
 * Refresh initial data (force fetch, update cache)
 * Use this when user explicitly refreshes
 */
export const refreshInitialData = async (): Promise<InitialData> => {
  if (__DEV__) {
    console.log('🔄 [OptimizedPlaces] Refreshing initial data...');
  }
  return await fetchInitialData();
};
