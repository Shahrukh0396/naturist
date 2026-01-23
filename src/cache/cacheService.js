/**
 * Cache Service for React Native
 * Uses MMKV (preferred) or AsyncStorage (fallback) for local storage
 * Provides instant cached data loading for places
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Try to use MMKV if available, fallback to AsyncStorage
let mmkvInstance = null;
let storageType = 'asyncstorage';

try {
  // Try to import MMKV
  const { MMKV: MMKVClass } = require('react-native-mmkv');
  if (MMKVClass) {
    mmkvInstance = new MMKVClass({
      id: 'naturism-cache',
      // encryptionKey: undefined, // Optional: add encryption key for sensitive data
    });
    storageType = 'mmkv';
    if (__DEV__) {
      console.log('✅ [Cache] Using MMKV for caching');
    }
  }
} catch (error) {
  if (__DEV__) {
    console.log('⚠️ [Cache] MMKV not available, using AsyncStorage fallback:', error?.message);
  }
}

// Cache keys
const CACHE_KEYS = {
  PLACES: 'places_cache',
  PLACES_TIMESTAMP: 'places_cache_timestamp',
  PLACES_VERSION: 'places_cache_version',
  // New keys for optimized caching
  USER_LOCATION: 'user_location_cache',
  NEARBY_PLACES: 'nearby_places_cache',
  POPULAR_PLACES: 'popular_places_cache',
  EXPLORE_PLACES: 'explore_places_cache',
  INITIAL_DATA_TIMESTAMP: 'initial_data_timestamp',
};

const CACHE_VERSION = 2; // Increment when cache structure changes

/**
 * Get cache instance (MMKV or AsyncStorage wrapper)
 */
const getCache = () => {
  if (mmkvInstance) {
    return {
      setString: (key, value) => {
        try {
          mmkvInstance.set(key, value);
          return Promise.resolve();
        } catch (error) {
          console.error(`[Cache] Error setting ${key}:`, error);
          return Promise.reject(error);
        }
      },
      getString: (key) => {
        try {
          const value = mmkvInstance.getString(key);
          return Promise.resolve(value || null);
        } catch (error) {
          console.error(`[Cache] Error getting ${key}:`, error);
          return Promise.resolve(null);
        }
      },
      remove: (key) => {
        try {
          mmkvInstance.delete(key);
          return Promise.resolve();
        } catch (error) {
          console.error(`[Cache] Error removing ${key}:`, error);
          return Promise.reject(error);
        }
      },
      clear: () => {
        try {
          mmkvInstance.clearAll();
          return Promise.resolve();
        } catch (error) {
          console.error('[Cache] Error clearing cache:', error);
          return Promise.reject(error);
        }
      },
    };
  }

  // AsyncStorage fallback
  return {
    setString: async (key, value) => {
      try {
        await AsyncStorage.setItem(key, value);
      } catch (error) {
        console.error(`[Cache] Error setting ${key}:`, error);
        throw error;
      }
    },
    getString: async (key) => {
      try {
        return await AsyncStorage.getItem(key);
      } catch (error) {
        console.error(`[Cache] Error getting ${key}:`, error);
        return null;
      }
    },
    remove: async (key) => {
      try {
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error(`[Cache] Error removing ${key}:`, error);
        throw error;
      }
    },
    clear: async () => {
      try {
        await AsyncStorage.clear();
      } catch (error) {
        console.error('[Cache] Error clearing cache:', error);
        throw error;
      }
    },
  };
};

const cache = getCache();

/**
 * Save places to cache
 * @param {Array} places - Array of place objects
 * @returns {Promise<void>}
 */
export const savePlacesToCache = async (places) => {
  try {
    const timestamp = Date.now();
    const dataToCache = {
      version: CACHE_VERSION,
      timestamp,
      places,
    };

    const jsonString = JSON.stringify(dataToCache);
    await cache.setString(CACHE_KEYS.PLACES, jsonString);
    await cache.setString(CACHE_KEYS.PLACES_TIMESTAMP, timestamp.toString());
    await cache.setString(CACHE_KEYS.PLACES_VERSION, CACHE_VERSION.toString());

    if (__DEV__) {
      console.log(`✅ [Cache] Saved ${places.length} places to cache`);
    }
  } catch (error) {
    console.error('❌ [Cache] Error saving places to cache:', error);
    throw error;
  }
};

/**
 * Load places from cache
 * @returns {Promise<Array|null>} - Array of places or null if not found/invalid
 */
export const loadPlacesFromCache = async () => {
  try {
    const cachedData = await cache.getString(CACHE_KEYS.PLACES);

    if (!cachedData) {
      if (__DEV__) {
        console.log('ℹ️ [Cache] No cached places found');
      }
      return null;
    }

    const parsed = JSON.parse(cachedData);

    // Check cache version
    if (parsed.version !== CACHE_VERSION) {
      if (__DEV__) {
        console.log('⚠️ [Cache] Cache version mismatch, clearing old cache');
      }
      await clearPlacesCache();
      return null;
    }

    if (!parsed.places || !Array.isArray(parsed.places)) {
      if (__DEV__) {
        console.log('⚠️ [Cache] Invalid cache format');
      }
      return null;
    }

    if (__DEV__) {
      const timestamp = new Date(parsed.timestamp).toISOString();
      console.log(`✅ [Cache] Loaded ${parsed.places.length} places from cache (cached at: ${timestamp})`);
    }

    return parsed.places;
  } catch (error) {
    console.error('❌ [Cache] Error loading places from cache:', error);
    return null;
  }
};

/**
 * Get cache timestamp
 * @returns {Promise<number|null>} - Timestamp or null
 */
export const getCacheTimestamp = async () => {
  try {
    const timestamp = await cache.getString(CACHE_KEYS.PLACES_TIMESTAMP);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    console.error('❌ [Cache] Error getting cache timestamp:', error);
    return null;
  }
};

/**
 * Check if cache is valid (not expired)
 * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
 * @returns {Promise<boolean>}
 */
export const isCacheValid = async (maxAge = 24 * 60 * 60 * 1000) => {
  try {
    const timestamp = await getCacheTimestamp();
    if (!timestamp) {
      return false;
    }

    const age = Date.now() - timestamp;
    return age < maxAge;
  } catch (error) {
    console.error('❌ [Cache] Error checking cache validity:', error);
    return false;
  }
};

/**
 * Clear places cache
 * @returns {Promise<void>}
 */
export const clearPlacesCache = async () => {
  try {
    await cache.remove(CACHE_KEYS.PLACES);
    await cache.remove(CACHE_KEYS.PLACES_TIMESTAMP);
    await cache.remove(CACHE_KEYS.PLACES_VERSION);
    if (__DEV__) {
      console.log('🗑️ [Cache] Places cache cleared');
    }
  } catch (error) {
    console.error('❌ [Cache] Error clearing places cache:', error);
    throw error;
  }
};

/**
 * Clear all cache
 * @returns {Promise<void>}
 */
export const clearAllCache = async () => {
  try {
    await cache.clear();
    if (__DEV__) {
      console.log('🗑️ [Cache] All cache cleared');
    }
  } catch (error) {
    console.error('❌ [Cache] Error clearing all cache:', error);
    throw error;
  }
};

/**
 * Get cache stats
 * @returns {Promise<Object>}
 */
export const getCacheStats = async () => {
  try {
    const places = await loadPlacesFromCache();
    const timestamp = await getCacheTimestamp();

    return {
      storageType,
      placeCount: places ? places.length : 0,
      timestamp,
      isValid: await isCacheValid(),
    };
  } catch (error) {
    console.error('❌ [Cache] Error getting cache stats:', error);
    return {
      storageType,
      placeCount: 0,
      timestamp: null,
      isValid: false,
    };
  }
};

/**
 * Save user location to cache
 * @param {Object} location - Location object with latitude and longitude
 * @returns {Promise<void>}
 */
export const saveUserLocationToCache = async (location) => {
  try {
    const dataToCache = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      location,
    };
    const jsonString = JSON.stringify(dataToCache);
    await cache.setString(CACHE_KEYS.USER_LOCATION, jsonString);
    if (__DEV__) {
      console.log(`✅ [Cache] Saved user location to cache`);
    }
  } catch (error) {
    console.error('❌ [Cache] Error saving user location to cache:', error);
    throw error;
  }
};

/**
 * Load user location from cache
 * @returns {Promise<Object|null>} - Location object or null
 */
export const loadUserLocationFromCache = async () => {
  try {
    const cachedData = await cache.getString(CACHE_KEYS.USER_LOCATION);
    if (!cachedData) {
      return null;
    }
    const parsed = JSON.parse(cachedData);
    if (parsed.version !== CACHE_VERSION || !parsed.location) {
      return null;
    }
    if (__DEV__) {
      console.log(`✅ [Cache] Loaded user location from cache`);
    }
    return parsed.location;
  } catch (error) {
    console.error('❌ [Cache] Error loading user location from cache:', error);
    return null;
  }
};

/**
 * Save categorized places to cache
 * @param {Object} categorizedPlaces - Object with nearby, popular, explore arrays
 * @returns {Promise<void>}
 */
export const saveCategorizedPlacesToCache = async (categorizedPlaces) => {
  try {
    const timestamp = Date.now();
    const dataToCache = {
      version: CACHE_VERSION,
      timestamp,
      nearby: categorizedPlaces.nearby || [],
      popular: categorizedPlaces.popular || [],
      explore: categorizedPlaces.explore || [],
    };

    const jsonString = JSON.stringify(dataToCache);
    await cache.setString(CACHE_KEYS.NEARBY_PLACES, JSON.stringify(dataToCache.nearby || []));
    await cache.setString(CACHE_KEYS.POPULAR_PLACES, JSON.stringify(dataToCache.popular || []));
    await cache.setString(CACHE_KEYS.EXPLORE_PLACES, JSON.stringify(dataToCache.explore || []));
    await cache.setString(CACHE_KEYS.INITIAL_DATA_TIMESTAMP, timestamp.toString());

    if (__DEV__) {
      console.log(`✅ [Cache] Saved categorized places to cache - Nearby: ${dataToCache.nearby.length}, Popular: ${dataToCache.popular.length}, Explore: ${dataToCache.explore.length}`);
    }
  } catch (error) {
    console.error('❌ [Cache] Error saving categorized places to cache:', error);
    throw error;
  }
};

/**
 * Load categorized places from cache
 * @returns {Promise<Object|null>} - Object with nearby, popular, explore arrays or null
 */
export const loadCategorizedPlacesFromCache = async () => {
  try {
    const nearbyData = await cache.getString(CACHE_KEYS.NEARBY_PLACES);
    const popularData = await cache.getString(CACHE_KEYS.POPULAR_PLACES);
    const exploreData = await cache.getString(CACHE_KEYS.EXPLORE_PLACES);

    if (!nearbyData && !popularData && !exploreData) {
      if (__DEV__) {
        console.log('ℹ️ [Cache] No categorized places found in cache');
      }
      return null;
    }

    const result = {
      nearby: nearbyData ? JSON.parse(nearbyData) : [],
      popular: popularData ? JSON.parse(popularData) : [],
      explore: exploreData ? JSON.parse(exploreData) : [],
    };

    if (__DEV__) {
      const timestamp = await cache.getString(CACHE_KEYS.INITIAL_DATA_TIMESTAMP);
      const cachedAt = timestamp ? new Date(parseInt(timestamp, 10)).toISOString() : 'unknown';
      console.log(`✅ [Cache] Loaded categorized places from cache (cached at: ${cachedAt}) - Nearby: ${result.nearby.length}, Popular: ${result.popular.length}, Explore: ${result.explore.length}`);
    }

    return result;
  } catch (error) {
    console.error('❌ [Cache] Error loading categorized places from cache:', error);
    return null;
  }
};

/**
 * Check if initial data cache is valid
 * @param {number} maxAge - Maximum age in milliseconds (default: 6 hours)
 * @returns {Promise<boolean>}
 */
export const isInitialDataCacheValid = async (maxAge = 6 * 60 * 60 * 1000) => {
  try {
    const timestamp = await cache.getString(CACHE_KEYS.INITIAL_DATA_TIMESTAMP);
    if (!timestamp) {
      return false;
    }
    const age = Date.now() - parseInt(timestamp, 10);
    return age < maxAge;
  } catch (error) {
    console.error('❌ [Cache] Error checking initial data cache validity:', error);
    return false;
  }
};

/**
 * Clear initial data cache
 * @returns {Promise<void>}
 */
export const clearInitialDataCache = async () => {
  try {
    await cache.remove(CACHE_KEYS.USER_LOCATION);
    await cache.remove(CACHE_KEYS.NEARBY_PLACES);
    await cache.remove(CACHE_KEYS.POPULAR_PLACES);
    await cache.remove(CACHE_KEYS.EXPLORE_PLACES);
    await cache.remove(CACHE_KEYS.INITIAL_DATA_TIMESTAMP);
    if (__DEV__) {
      console.log('🗑️ [Cache] Initial data cache cleared');
    }
  } catch (error) {
    console.error('❌ [Cache] Error clearing initial data cache:', error);
    throw error;
  }
};

// Legacy exports for backwards compatibility
export const saveProductsToCache = savePlacesToCache;
export const loadProductsFromCache = loadPlacesFromCache;
export const clearProductsCache = clearPlacesCache;

