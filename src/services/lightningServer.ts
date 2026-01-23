/**
 * Lightning Server
 * Local-first data server that serves data instantly from AsyncStorage
 * No internet calls required - works completely offline
 * 
 * Features:
 * - Loads data from local JSON files
 * - Stores in AsyncStorage for instant access
 * - Serves data instantly (no network latency)
 * - Works completely offline
 * - Pre-fetches and caches everything locally
 * - Lightweight and fast
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RawPlace, Place } from '../types';
import { Location, DEFAULT_LOCATION, calculateDistance } from './locationService';

// Storage keys
const STORAGE_KEYS = {
  ALL_PLACES: 'lightning_server_all_places',
  PLACES_VERSION: 'lightning_server_places_version',
  LAST_SYNC: 'lightning_server_last_sync',
  INITIALIZED: 'lightning_server_initialized',
};

const DATA_VERSION = 1; // Increment when data structure changes

// Place type mapping
const PLACE_TYPE_MAPPING: { [key: string]: 'beach' | 'camps' | 'hotel' | 'sauna' | 'other' } = {
  'B': 'beach',
  'C': 'camps',
  'E': 'hotel',
  'F': 'sauna',
  'P': 'other',
  'S': 'other',
  'R': 'other',
  'H': 'other',
  'D': 'other',
};

// Default nearby radius in kilometers
const DEFAULT_NEARBY_RADIUS = 50;

// In-memory cache for instant access (after first load)
let placesCache: Place[] | null = null;
let isInitialized = false;

/**
 * Load local JSON data
 */
const loadLocalJSONData = (): RawPlace[] => {
  try {
    // Try verified file first
    const verifiedData = require('../utils/natureism.places.verified.json');
    if (__DEV__) {
      console.log('✅ [LightningServer] Loaded verified places data');
    }
    return verifiedData as RawPlace[];
  } catch (e) {
    try {
      // Fallback to original file
      const originalData = require('../utils/natureism.places.json');
      if (__DEV__) {
        console.log('✅ [LightningServer] Loaded original places data');
      }
      return originalData as RawPlace[];
    } catch (error) {
      console.error('❌ [LightningServer] Error loading local JSON data:', error);
      return [];
    }
  }
};

/**
 * Determine price range based on features
 */
const determinePriceRange = (features: string[]): '$' | '$$' | '$$$' | '$$$$' => {
  if (!features || features.length === 0) return '$$';

  const featureString = features.join(' ').toLowerCase();

  if (featureString.includes('luxury') || featureString.includes('vip') || featureString.includes('premium')) {
    return '$$$$';
  }

  if (featureString.includes('spa') || featureString.includes('resort') || featureString.includes('hotel')) {
    return '$$$';
  }

  if (featureString.includes('camping') || featureString.includes('basic') || featureString.includes('free')) {
    return '$';
  }

  return '$$';
};

/**
 * Get default image for category
 */
const getDefaultImageForCategory = (category: string): string => {
  const categoryDefaults: Record<string, string> = {
    'beach': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
    'camps': 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=400',
    'hotel': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
    'sauna': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
    'other': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
  };
  return categoryDefaults[category] || categoryDefaults['other'];
};

/**
 * Transform raw place to Place interface
 */
const transformPlace = (rawPlace: RawPlace, userLocation: Location = DEFAULT_LOCATION): Place => {
  const latitude = parseFloat(rawPlace.lat);
  const longitude = parseFloat(rawPlace.lng);

  // Calculate distance from user location
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    latitude,
    longitude
  );

  // Determine if place is nearby
  const isNearby = distance <= DEFAULT_NEARBY_RADIUS;

  // Get category from place_type
  const category = PLACE_TYPE_MAPPING[rawPlace.place_type] || 'other';

  // Determine price range
  const priceRange = determinePriceRange(rawPlace.features);

  // Get main image (use local images from JSON)
  const getMainImage = () => {
    if (rawPlace.images && rawPlace.images.length > 0) {
      for (let i = 0; i < rawPlace.images.length; i++) {
        const imageUrl = rawPlace.images[i];
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
          return imageUrl;
        }
      }
    }
    return getDefaultImageForCategory(category);
  };

  const mainImage = getMainImage();
  const allImages = rawPlace.images || [];

  return {
    id: rawPlace._id.$oid,
    name: rawPlace.title,
    description: rawPlace.description || 'No description available',
    image: mainImage,
    images: allImages,
    location: {
      latitude,
      longitude,
      address: `${rawPlace.country}`,
    },
    category,
    rating: rawPlace.rating || 0,
    priceRange,
    amenities: rawPlace.features || [],
    isPopular: rawPlace.featured || false,
    isNearby,
    distance: Math.round(distance * 10) / 10,
    country: rawPlace.country,
    placeType: rawPlace.place_type,
    featured: rawPlace.featured || false,
    source: 'local',
  };
};

/**
 * Initialize Lightning Server
 * Loads data from local JSON and stores in AsyncStorage
 */
export const initializeLightningServer = async (): Promise<void> => {
  try {
    if (isInitialized) {
      if (__DEV__) {
        console.log('✅ [LightningServer] Already initialized');
      }
      return;
    }

    if (__DEV__) {
      console.log('🔄 [LightningServer] Initializing...');
    }

    // Check if data is already in AsyncStorage
    const storedVersion = await AsyncStorage.getItem(STORAGE_KEYS.PLACES_VERSION);
    const isDataStored = await AsyncStorage.getItem(STORAGE_KEYS.INITIALIZED);

    if (isDataStored === 'true' && storedVersion === DATA_VERSION.toString()) {
      if (__DEV__) {
        console.log('✅ [LightningServer] Data already in AsyncStorage');
      }
      isInitialized = true;
      return;
    }

    // Load from local JSON
    if (__DEV__) {
      console.log('🔄 [LightningServer] Loading from local JSON...');
    }
    const rawPlaces = loadLocalJSONData();

    if (rawPlaces.length === 0) {
      console.error('❌ [LightningServer] No data loaded from local JSON');
      return;
    }

    // Filter active places
    const activePlaces = rawPlaces.filter(
      place =>
        !place.deleted &&
        place.state === 'Active' &&
        place.lat &&
        place.lng &&
        place.title
    );

    if (__DEV__) {
      console.log(`🔄 [LightningServer] Processing ${activePlaces.length} active places...`);
    }

    // Transform places (without user location for now - will calculate on demand)
    const transformedPlaces = activePlaces.map(place => transformPlace(place, DEFAULT_LOCATION));

    // Debug: Check if images are being preserved
    if (__DEV__) {
      const placesWithImages = transformedPlaces.filter(p => p.images && p.images.length > 0);
      console.log(`✅ [LightningServer] ${placesWithImages.length}/${transformedPlaces.length} places have images`);
      if (placesWithImages.length > 0) {
        console.log(`📷 [LightningServer] Sample image URL: ${placesWithImages[0].images[0]}`);
      }
    }

    // Store in AsyncStorage
    const placesJSON = JSON.stringify(transformedPlaces);
    await AsyncStorage.setItem(STORAGE_KEYS.ALL_PLACES, placesJSON);
    await AsyncStorage.setItem(STORAGE_KEYS.PLACES_VERSION, DATA_VERSION.toString());
    await AsyncStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

    // Cache in memory for instant access
    placesCache = transformedPlaces;
    isInitialized = true;

    if (__DEV__) {
      console.log(`✅ [LightningServer] Initialized with ${transformedPlaces.length} places`);
    }
  } catch (error) {
    console.error('❌ [LightningServer] Error initializing:', error);
    throw error;
  }
};

/**
 * Load all places from AsyncStorage (instant, no network)
 */
const loadAllPlacesFromStorage = async (userLocation?: Location): Promise<Place[]> => {
  // Use memory cache if available
  if (placesCache) {
    if (userLocation) {
      // Recalculate distances with user location
      return placesCache.map(place => {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          place.location.latitude,
          place.location.longitude
        );
        return {
          ...place,
          distance: Math.round(distance * 10) / 10,
          isNearby: distance <= DEFAULT_NEARBY_RADIUS,
        };
      });
    }
    return placesCache;
  }

  // Load from AsyncStorage
  try {
    const placesJSON = await AsyncStorage.getItem(STORAGE_KEYS.ALL_PLACES);
    if (!placesJSON) {
      if (__DEV__) {
        console.log('⚠️ [LightningServer] No data in AsyncStorage, initializing...');
      }
      await initializeLightningServer();
      return loadAllPlacesFromStorage(userLocation);
    }

    const places: Place[] = JSON.parse(placesJSON);

    // Cache in memory
    placesCache = places;

    if (userLocation) {
      // Recalculate distances with user location
      return places.map(place => {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          place.location.latitude,
          place.location.longitude
        );
        return {
          ...place,
          distance: Math.round(distance * 10) / 10,
          isNearby: distance <= DEFAULT_NEARBY_RADIUS,
        };
      });
    }

    return places;
  } catch (error) {
    console.error('❌ [LightningServer] Error loading places from storage:', error);
    return [];
  }
};

/**
 * Lightning Server API
 */
export const lightningServer = () => {
  // Ensure initialized
  if (!isInitialized) {
    initializeLightningServer().catch(console.error);
  }

  return {
    /**
     * Get places by type (nearby, popular, explore)
     * Returns data instantly from AsyncStorage (no internet calls)
     */
    places: async (
      type: 'nearby' | 'popular' | 'explore',
      userLocation?: Location,
      limit: number = 10
    ): Promise<Place[]> => {
      try {
        if (__DEV__) {
          console.log(`⚡ [LightningServer] Getting ${type} places (limit: ${limit})`);
        }

        // Load all places from AsyncStorage (instant)
        const allPlaces = await loadAllPlacesFromStorage(userLocation);

        let filtered: Place[] = [];

        switch (type) {
          case 'nearby':
            if (!userLocation) {
              if (__DEV__) {
                console.warn('⚠️ [LightningServer] No user location provided for nearby places');
              }
              return [];
            }
            filtered = allPlaces
              .filter(place => place.isNearby)
              .sort((a, b) => (a.distance || 0) - (b.distance || 0));
            break;

          case 'popular':
            filtered = allPlaces
              .filter(place => place.featured || place.rating >= 4.0)
              .sort((a, b) => {
                if (a.featured && !b.featured) return -1;
                if (!a.featured && b.featured) return 1;
                return b.rating - a.rating;
              });
            break;

          case 'explore':
            filtered = allPlaces
              .filter(place => !place.featured && !place.isNearby)
              .sort((a, b) => b.rating - a.rating);
            break;

          default:
            filtered = allPlaces;
        }

        const result = filtered.slice(0, limit);

        if (__DEV__) {
          console.log(`✅ [LightningServer] Returning ${result.length} ${type} places`);
        }

        return result;
      } catch (error) {
        console.error(`❌ [LightningServer] Error getting ${type} places:`, error);
        return [];
      }
    },

    /**
     * Get all places (instant from AsyncStorage)
     */
    getAllPlaces: async (userLocation?: Location): Promise<Place[]> => {
      try {
        return await loadAllPlacesFromStorage(userLocation);
      } catch (error) {
        console.error('❌ [LightningServer] Error getting all places:', error);
        return [];
      }
    },

    /**
     * Search places (instant from AsyncStorage)
     */
    search: async (query: string, userLocation?: Location): Promise<Place[]> => {
      try {
        const allPlaces = await loadAllPlacesFromStorage(userLocation);
        const lowercaseQuery = query.toLowerCase();

        return allPlaces.filter(
          place =>
            place.name.toLowerCase().includes(lowercaseQuery) ||
            place.description.toLowerCase().includes(lowercaseQuery) ||
            place.country.toLowerCase().includes(lowercaseQuery) ||
            place.location.address.toLowerCase().includes(lowercaseQuery)
        );
      } catch (error) {
        console.error('❌ [LightningServer] Error searching places:', error);
        return [];
      }
    },

    /**
     * Get places by category (instant from AsyncStorage)
     */
    getByCategory: async (
      category: string,
      userLocation?: Location
    ): Promise<Place[]> => {
      try {
        const allPlaces = await loadAllPlacesFromStorage(userLocation);
        return allPlaces.filter(place => place.category === category);
      } catch (error) {
        console.error('❌ [LightningServer] Error getting places by category:', error);
        return [];
      }
    },

    /**
     * Get place by ID (instant from AsyncStorage)
     */
    getById: async (id: string): Promise<Place | null> => {
      try {
        const allPlaces = await loadAllPlacesFromStorage();
        return allPlaces.find(place => place.id === id) || null;
      } catch (error) {
        console.error('❌ [LightningServer] Error getting place by ID:', error);
        return null;
      }
    },

    /**
     * Clear cache and reinitialize
     */
    clearCache: async (): Promise<void> => {
      try {
        await AsyncStorage.removeItem(STORAGE_KEYS.ALL_PLACES);
        await AsyncStorage.removeItem(STORAGE_KEYS.PLACES_VERSION);
        await AsyncStorage.removeItem(STORAGE_KEYS.INITIALIZED);
        await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
        placesCache = null;
        isInitialized = false;
        if (__DEV__) {
          console.log('✅ [LightningServer] Cache cleared');
        }
      } catch (error) {
        console.error('❌ [LightningServer] Error clearing cache:', error);
      }
    },

    /**
     * Get server stats
     */
    getStats: async (): Promise<{
      totalPlaces: number;
      initialized: boolean;
      lastSync: number | null;
    }> => {
      try {
        const allPlaces = await loadAllPlacesFromStorage();
        const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);

        return {
          totalPlaces: allPlaces.length,
          initialized: isInitialized,
          lastSync: lastSync ? parseInt(lastSync, 10) : null,
        };
      } catch (error) {
        console.error('❌ [LightningServer] Error getting stats:', error);
        return {
          totalPlaces: 0,
          initialized: false,
          lastSync: null,
        };
      }
    },

    /**
     * Background sync (for future updates)
     * Can be called when app is idle or when network is available
     * This allows updating data from remote source without blocking UI
     */
    sync: async (updateCallback?: (places: Place[]) => Promise<Place[]>): Promise<void> => {
      try {
        if (__DEV__) {
          console.log('🔄 [LightningServer] Starting background sync...');
        }

        // If update callback provided, use it to get updated data
        if (updateCallback) {
          const currentPlaces = await loadAllPlacesFromStorage();
          const updatedPlaces = await updateCallback(currentPlaces);

          // Update storage with new data
          const placesJSON = JSON.stringify(updatedPlaces);
          await AsyncStorage.setItem(STORAGE_KEYS.ALL_PLACES, placesJSON);
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

          // Update memory cache
          placesCache = updatedPlaces;

          if (__DEV__) {
            console.log(`✅ [LightningServer] Synced ${updatedPlaces.length} places`);
          }
        } else {
          // Just update sync timestamp (data already in storage)
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
          if (__DEV__) {
            console.log('✅ [LightningServer] Sync timestamp updated');
          }
        }
      } catch (error) {
        console.error('❌ [LightningServer] Error during sync:', error);
      }
    },
  };
};

// Export singleton instance
export default lightningServer();
