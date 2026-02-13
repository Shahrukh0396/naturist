/**
 * Lightning Server - Instagram-Level Image Loading Optimizations
 * Local-first data server with progressive image loading and pre-fetching
 * 
 * Performance Features:
 * - Progressive image loading (thumbnail → medium → full)
 * - Multiple image size variants (thumbnail, medium, full)
 * - Pre-fetching images ahead of viewport for smooth scrolling
 * - Optimized for FlatList virtualization
 * - Immutable cache control for FastImage
 * - Offline-first caching strategy
 * - Minimal network bandwidth usage
 * 
 * Image Loading Strategy:
 * 1. Thumbnail (150x150): Instant display, minimal bandwidth
 * 2. Medium (400x400): Progressive enhancement for feed
 * 3. Full (original): Load on demand for detail views
 * 
 * FlatList Optimization:
 * - Pre-fetches images for items slightly ahead of viewport
 * - Batch image URL transformations
 * - Efficient memory management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RawPlace, Place } from '../types';
import { Location, DEFAULT_LOCATION, calculateDistance } from './locationService';
import { isFirebaseStorageUrl } from './firebaseStorageService';
import { capitalizeCountry } from '../utils/format';
import FastImage from 'react-native-fast-image';

// Storage keys
const STORAGE_KEYS = {
  ALL_PLACES: 'lightning_server_all_places',
  PLACES_VERSION: 'lightning_server_places_version',
  LAST_SYNC: 'lightning_server_last_sync',
  INITIALIZED: 'lightning_server_initialized',
  IMAGE_CACHE: 'lightning_server_image_cache', // Cache for optimized image URLs
};

const DATA_VERSION = 2; // Increment when data structure changes (v2: add sqlId for Firebase Storage)

// Image size variants for progressive loading
export type ImageSize = 'thumbnail' | 'medium' | 'full';

const IMAGE_SIZES: Record<ImageSize, { width: number; height: number; quality?: number }> = {
  thumbnail: { width: 150, height: 150, quality: 70 }, // Fast initial load
  medium: { width: 400, height: 400, quality: 85 }, // Feed quality
  full: { width: 1080, height: 1080, quality: 95 }, // Detail view quality
};

// Pre-fetch window for FlatList (number of items ahead to preload)
const PREFETCH_WINDOW = 5;

// Image URL cache for transformed URLs
const imageUrlCache = new Map<string, Map<ImageSize, string>>();

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
 * No default image — use Firebase Storage only; callers show placeholder when empty
 */
const getDefaultImageForCategory = (_category: string, _size: ImageSize = 'medium'): string => {
  return '';
};

/**
 * Transform image URL to support size variants
 * Handles various URL patterns (Unsplash, Firebase Storage, CDN, etc.)
 * Only transforms URLs that are known to support size parameters
 */
const transformImageUrl = (url: string, size: ImageSize = 'medium'): string => {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return url;
  }

  // For 'full' size, return original URL without transformation
  if (size === 'full') {
    return url;
  }

  // Check cache first
  const cacheKey = url;
  if (imageUrlCache.has(cacheKey)) {
    const cached = imageUrlCache.get(cacheKey);
    if (cached?.has(size)) {
      return cached.get(size)!;
    }
  }

  const { width, height, quality } = IMAGE_SIZES[size];
  let transformedUrl = url;

  try {
    const urlObj = new URL(url);

    // Unsplash images - safely add parameters
    if (urlObj.hostname.includes('unsplash.com') || urlObj.hostname.includes('images.unsplash.com')) {
      urlObj.searchParams.set('w', width.toString());
      urlObj.searchParams.set('h', height.toString());
      urlObj.searchParams.set('q', (quality || 85).toString());
      urlObj.searchParams.set('fit', 'crop');
      transformedUrl = urlObj.toString();
    }
    // Firebase Storage - don't modify, return original
    // Firebase Storage URLs are already optimized and modifying them might break
    else if (urlObj.hostname.includes('firebasestorage.googleapis.com')) {
      // Return original URL - Firebase Storage URLs are already optimized
      transformedUrl = url;
    }
    // For other URLs, only transform if they're known to support size parameters
    // Otherwise, return original to avoid breaking the URL
    else {
      // Only transform if URL already has query parameters (likely supports them)
      // Or if it's a known CDN that supports size parameters
      const knownCDNs = ['cloudinary.com', 'imgix.net', 'imagekit.io'];
      const isKnownCDN = knownCDNs.some(cdn => urlObj.hostname.includes(cdn));
      
      if (isKnownCDN || urlObj.search) {
        // Safe to add parameters
        if (!urlObj.searchParams.has('w') && !urlObj.searchParams.has('width')) {
          urlObj.searchParams.set('w', width.toString());
        }
        if (!urlObj.searchParams.has('q') && !urlObj.searchParams.has('quality')) {
          urlObj.searchParams.set('q', (quality || 85).toString());
        }
        transformedUrl = urlObj.toString();
      } else {
        // Unknown URL format - return original to avoid breaking
        transformedUrl = url;
      }
    }

    // Cache the transformed URL
    if (!imageUrlCache.has(cacheKey)) {
      imageUrlCache.set(cacheKey, new Map());
    }
    imageUrlCache.get(cacheKey)!.set(size, transformedUrl);

    return transformedUrl;
  } catch (error) {
    // If URL parsing fails, return original
    if (__DEV__) {
      console.warn(`⚠️ [LightningServer] Failed to transform image URL: ${url}`, error);
    }
    return url;
  }
};

/**
 * Get optimized image URLs for a place with progressive loading support
 * Returns thumbnail, medium, and full URLs
 */
const getOptimizedImageUrls = (imageUrl: string): { thumbnail: string; medium: string; full: string } => {
  return {
    thumbnail: transformImageUrl(imageUrl, 'thumbnail'),
    medium: transformImageUrl(imageUrl, 'medium'),
    full: transformImageUrl(imageUrl, 'full'),
  };
};

/**
 * Pre-fetch images for FastImage cache
 * Uses FastImage's preload for efficient caching
 */
const prefetchImages = async (urls: string[]): Promise<void> => {
  try {
    const validUrls = urls.filter(url => url && typeof url === 'string' && isFirebaseStorageUrl(url));
    if (validUrls.length === 0) return;

    // FastImage preload expects array of objects with uri property
    // Limit to 50 images to avoid overwhelming the system
    const imagesToPreload = validUrls.slice(0, 50).map(url => ({
      uri: url,
      priority: FastImage.priority.normal,
      cache: FastImage.cacheControl.immutable,
    }));

    await FastImage.preload(imagesToPreload);

    if (__DEV__) {
      console.log(`✅ [LightningServer] Pre-fetched ${imagesToPreload.length} images`);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('⚠️ [LightningServer] Error pre-fetching images:', error);
    }
    // Don't throw - image preloading is non-critical
  }
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

  // Only expose Firebase Storage image URLs (no Google API, AWS, Unsplash, etc.)
  const allImages = (rawPlace.images || [])
    .filter((img: string) => img && typeof img === 'string' && isFirebaseStorageUrl(img)) as string[];
  const mainImage = allImages[0] || '';

  return {
    id: rawPlace._id.$oid,
    sqlId: rawPlace.sql_id,
    name: rawPlace.title,
    description: rawPlace.description || 'No description available',
    image: mainImage,
    images: allImages, // Firebase Storage URLs only
    location: {
      latitude,
      longitude,
      address: capitalizeCountry(rawPlace.country || ''),
    },
    category,
    rating: rawPlace.rating || 0,
    priceRange,
    amenities: rawPlace.features || [],
    isPopular: rawPlace.featured || false,
    isNearby,
    distance: Math.round(distance * 10) / 10,
    country: capitalizeCountry(rawPlace.country || ''),
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

  const api = {
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
            // If no places within radius, show closest places by distance so section isn't empty
            if (filtered.length === 0) {
              filtered = [...allPlaces]
                .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
                .slice(0, limit);
            }
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

    /**
     * Get optimized image URL for a specific size
     * Supports progressive loading: thumbnail → medium → full
     */
    getImageUrl: (imageUrl: string, size: ImageSize = 'medium'): string => {
      return transformImageUrl(imageUrl, size);
    },

    /**
     * Get all image size variants for progressive loading
     * Returns thumbnail, medium, and full URLs
     */
    getImageVariants: (imageUrl: string): { thumbnail: string; medium: string; full: string } => {
      return getOptimizedImageUrls(imageUrl);
    },

    /**
     * Pre-fetch images for a list of places (optimized for FlatList)
     * Pre-loads images for items ahead of viewport for smooth scrolling
     * 
     * @param places Array of places to pre-fetch images for
     * @param startIndex Starting index in the list
     * @param endIndex Ending index in the list
     * @param size Image size to pre-fetch (default: medium for feed)
     */
    prefetchPlaceImages: async (
      places: Place[],
      startIndex: number = 0,
      endIndex?: number,
      size: ImageSize = 'medium'
    ): Promise<void> => {
      try {
        const actualEndIndex = endIndex !== undefined ? endIndex : places.length;
        const placesToPrefetch = places.slice(startIndex, Math.min(actualEndIndex + PREFETCH_WINDOW, places.length));

        const imageUrls: string[] = [];
        placesToPrefetch.forEach(place => {
          if (place.image && isFirebaseStorageUrl(place.image)) {
            imageUrls.push(transformImageUrl(place.image, size));
          }
          if (place.images?.length) {
            place.images.slice(0, 3).forEach(img => {
              if (img && isFirebaseStorageUrl(img)) {
                imageUrls.push(transformImageUrl(img, size));
              }
            });
          }
        });

        await prefetchImages(imageUrls);

        if (__DEV__) {
          console.log(`✅ [LightningServer] Pre-fetched images for ${placesToPrefetch.length} places`);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('⚠️ [LightningServer] Error pre-fetching place images:', error);
        }
      }
    },

    /**
     * Pre-fetch images for FlatList with viewport awareness
     * Automatically pre-loads images for items slightly ahead of visible range
     * 
     * @param places All places in the list
     * @param visibleStartIndex First visible item index
     * @param visibleEndIndex Last visible item index
     * @param size Image size to pre-fetch
     */
    prefetchForViewport: async (
      places: Place[],
      visibleStartIndex: number,
      visibleEndIndex: number,
      size: ImageSize = 'medium'
    ): Promise<void> => {
      // Pre-fetch images for items ahead of viewport
      const prefetchStart = Math.max(0, visibleStartIndex);
      const prefetchEnd = Math.min(places.length, visibleEndIndex + PREFETCH_WINDOW);

      return api.prefetchPlaceImages(places, prefetchStart, prefetchEnd, size);
    },

    /**
     * Get optimized place with image URLs transformed for feed display
     * Returns place with medium-sized images for optimal feed performance
     */
    getOptimizedPlace: (place: Place, size: ImageSize = 'medium'): Place => {
      return {
        ...place,
        image: transformImageUrl(place.image, size),
        images: (place.images ?? []).map(img => transformImageUrl(img, size)),
      };
    },

    /**
     * Get optimized places array with transformed image URLs
     * Batch processes image URLs for better performance
     */
    getOptimizedPlaces: (places: Place[], size: ImageSize = 'medium'): Place[] => {
      return places.map(place => api.getOptimizedPlace(place, size));
    },

    /**
     * Clear image URL cache
     * Useful when memory is constrained or after significant updates
     */
    clearImageCache: (): void => {
      imageUrlCache.clear();
      if (__DEV__) {
        console.log('🗑️ [LightningServer] Image URL cache cleared');
      }
    },

    /**
     * Get image cache statistics
     */
    getImageCacheStats: (): { cachedUrls: number; cacheSize: number } => {
      let totalVariants = 0;
      imageUrlCache.forEach(variants => {
        totalVariants += variants.size;
      });

      return {
        cachedUrls: imageUrlCache.size,
        cacheSize: totalVariants,
      };
    },
  };
  return api;
};

// Export singleton instance
export default lightningServer();
