/**
 * Firebase Storage Service
 * Fetches image URLs from Firebase Storage for places.
 * Uses local JSON data for place metadata, Firebase Storage for images.
 *
 * Firebase structure (both Realtime DB and Storage use sql_id as the folder key):
 * - Realtime DB: {databaseURL}/places/{sql_id}  → place document (title, description, images, etc.)
 * - Storage:    {storageURL}/places/{sql_id}/images/{0|1|2...}.{jpg|jpeg|png|webp}  → place images
 * Always use place.sqlId (sql_id) when resolving paths; fall back to place.id (_id.$oid) if needed.
 */

import storage from '@react-native-firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys for persistent storage
const STORAGE_KEYS = {
  IMAGE_URL_CACHE: 'firebase_storage_image_url_cache',
  CACHE_VERSION: 'firebase_storage_cache_version',
};

const CACHE_VERSION = 1; // Increment when cache structure changes
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory cache for Firebase Storage image URLs (fast access)
// Format: Map<cacheKey, { urls: string[], timestamp: number }>
const imageUrlCache = new Map<string, { urls: string[]; timestamp: number }>();

// Load cache from AsyncStorage on initialization
let cacheLoaded = false;

/**
 * Load image URL cache from AsyncStorage (persistent storage)
 */
const loadImageUrlCache = async (): Promise<void> => {
  if (cacheLoaded) return;
  
  try {
    const [cachedData, storedVersion] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.IMAGE_URL_CACHE),
      AsyncStorage.getItem(STORAGE_KEYS.CACHE_VERSION),
    ]);

    // Check if cache version matches
    if (storedVersion !== CACHE_VERSION.toString()) {
      if (__DEV__) {
        console.log('🔄 [FirebaseStorage] Cache version mismatch, clearing old cache');
      }
      await clearImageUrlCache();
      cacheLoaded = true;
      return;
    }

    if (cachedData) {
      const parsedCache: Record<string, { urls: string[]; timestamp: number }> = JSON.parse(cachedData);
      const now = Date.now();
      
      // Load valid (non-expired) entries into memory cache
      let loadedCount = 0;
      let expiredCount = 0;
      
      for (const [key, value] of Object.entries(parsedCache)) {
        if (now - value.timestamp < CACHE_EXPIRY_MS) {
          imageUrlCache.set(key, value);
          loadedCount++;
        } else {
          expiredCount++;
        }
      }
      
      if (__DEV__) {
        console.log(`✅ [FirebaseStorage] Loaded ${loadedCount} cached image URLs${expiredCount > 0 ? `, ${expiredCount} expired` : ''}`);
      }
    }
    
    cacheLoaded = true;
  } catch (error) {
    console.error('❌ [FirebaseStorage] Error loading image URL cache:', error);
    cacheLoaded = true; // Mark as loaded to prevent retry loops
  }
};

/**
 * Save image URL cache to AsyncStorage (persistent storage)
 */
const saveImageUrlCache = async (): Promise<void> => {
  try {
    const cacheObject: Record<string, { urls: string[]; timestamp: number }> = {};
    
    // Convert Map to object for JSON serialization
    imageUrlCache.forEach((value, key) => {
      cacheObject[key] = value;
    });

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.IMAGE_URL_CACHE, JSON.stringify(cacheObject)),
      AsyncStorage.setItem(STORAGE_KEYS.CACHE_VERSION, CACHE_VERSION.toString()),
    ]);
    
    if (__DEV__) {
      console.log(`💾 [FirebaseStorage] Saved ${imageUrlCache.size} image URLs to persistent cache`);
    }
  } catch (error) {
    console.error('❌ [FirebaseStorage] Error saving image URL cache:', error);
  }
};

// Initialize cache on module load
loadImageUrlCache();

/** Firebase Storage host used for image URLs - only these should be loaded/rendered */
const FIREBASE_STORAGE_HOST = 'firebasestorage.googleapis.com';

/**
 * Returns true only for Firebase Storage image URLs. Use this to avoid loading
 * images from other domains (Google API, AWS, Unsplash, etc.).
 */
export const isFirebaseStorageUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
  try {
    return new URL(url).hostname === FIREBASE_STORAGE_HOST;
  } catch {
    return false;
  }
};

/**
 * Filter an array of URLs to only Firebase Storage URLs.
 */
export const filterFirebaseStorageUrls = (urls: string[]): string[] => {
  return (urls || []).filter((u): u is string => isFirebaseStorageUrl(u));
};

/**
 * Fetch images for a single placeId from Firebase Storage
 * Path format: places/{placeId}/images/{index}.{ext}
 */
const fetchImagesForPlaceId = async (
  placeIdStr: string,
  maxImages: number
): Promise<string[]> => {
  const imageUrls: string[] = [];
  for (let i = 0; i < maxImages; i++) {
    let found = false;
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      const imagePath = `places/${placeIdStr}/images/${i}.${ext}`;
      const imageRef = storage().ref(imagePath);
      try {
        const url = await imageRef.getDownloadURL();
        if (url) {
          imageUrls.push(url);
          found = true;
          break;
        }
      } catch (error: any) {
        if (error?.code !== 'storage/object-not-found' && __DEV__ && i === 0) {
          console.log(`🔄 [FirebaseStorage] Checking ${imagePath}...`);
        }
      }
    }
    if (!found && i === 0) break;
    if (!found) break;
  }
  return imageUrls;
};

/**
 * Get Firebase Storage image URLs for a place
 * Storage path structure: places/{placeId}/images/{index}.{ext}
 * Sync script uses sql_id first, so try placeIds in order (e.g. sqlId then id).
 *
 * @param placeId Primary place ID (use sql_id when available to match sync script)
 * @param maxImages Maximum number of images to fetch (default: 5)
 * @param alternatePlaceIds If primary returns no images, try these (e.g. _id.$oid)
 * @returns Array of Firebase Storage download URLs
 */
export const getPlaceImagesFromStorage = async (
  placeId: string | number,
  maxImages: number = 5,
  ...alternatePlaceIds: (string | number)[]
): Promise<string[]> => {
  // Ensure cache is loaded from persistent storage
  await loadImageUrlCache();
  
  const idsToTry = [placeId, ...alternatePlaceIds].map((id) => id.toString());
  const cacheKey = idsToTry.join('_') + `_${maxImages}`;

  // Check in-memory cache first
  if (imageUrlCache.has(cacheKey)) {
    const cached = imageUrlCache.get(cacheKey);
    if (cached && cached.urls && cached.urls.length > 0) {
      if (__DEV__) {
        console.log(`✅ [FirebaseStorage] Using cached URLs for place ${placeId} (${cached.urls.length} images)`);
      }
      return cached.urls;
    }
    if (cached && cached.urls && cached.urls.length === 0) {
      return []; // Cached empty result
    }
  }

  try {
    for (const idStr of idsToTry) {
      const imageUrls = await fetchImagesForPlaceId(idStr, maxImages);
      if (imageUrls.length > 0) {
        // Save to in-memory cache with timestamp
        imageUrlCache.set(cacheKey, { urls: imageUrls, timestamp: Date.now() });
        
        // Save to persistent storage (debounced - don't await)
        saveImageUrlCache().catch(() => {
          // Silently fail - cache save is non-critical
        });
        
        if (__DEV__) {
          console.log(`✅ [FirebaseStorage] Found ${imageUrls.length} images for place ${idStr}`);
        }
        return imageUrls;
      }
    }
    
    // Cache empty result to avoid repeated failed lookups
    imageUrlCache.set(cacheKey, { urls: [], timestamp: Date.now() });
    saveImageUrlCache().catch(() => {});
    
    return [];
  } catch (error) {
    console.error(`❌ [FirebaseStorage] Error fetching images for place ${placeId}:`, error);
    // Cache empty result on error
    imageUrlCache.set(cacheKey, { urls: [], timestamp: Date.now() });
    saveImageUrlCache().catch(() => {});
    return [];
  }
};

/**
 * Get a single image URL from Firebase Storage
 * Uses cache if available (checks cache for maxImages=1 first)
 * 
 * @param placeId The place ID
 * @param imageIndex Image index (default: 0 for first image)
 * @returns Firebase Storage download URL or null
 */
export const getPlaceImageFromStorage = async (
  placeId: string | number,
  imageIndex: number = 0
): Promise<string | null> => {
  // For first image (index 0), check cache first
  if (imageIndex === 0) {
    await loadImageUrlCache();
    const cacheKey = `${placeId}_1`; // Check cache for maxImages=1
    
    if (imageUrlCache.has(cacheKey)) {
      const cached = imageUrlCache.get(cacheKey);
      if (cached && cached.urls && cached.urls.length > 0) {
        return cached.urls[0];
      }
    }
    
    // Try fetching 1 image (will use cache if available)
    const images = await getPlaceImagesFromStorage(placeId, 1);
    return images.length > 0 ? images[0] : null;
  }
  
  // For other indices, fetch directly
  try {
    const placeIdStr = placeId.toString();
    const extensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    for (const ext of extensions) {
      const imagePath = `places/${placeIdStr}/images/${imageIndex}.${ext}`;
      const imageRef = storage().ref(imagePath);
      
      try {
        const url = await imageRef.getDownloadURL();
        if (url) {
          return url;
        }
      } catch (error: any) {
        if (error?.code !== 'storage/object-not-found') {
          // Some other error
          if (__DEV__) {
            console.warn(`⚠️ [FirebaseStorage] Error getting image ${imageIndex} for place ${placeId}:`, error);
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [FirebaseStorage] Error fetching image ${imageIndex} for place ${placeId}:`, error);
    return null;
  }
};

/**
 * Clear the image URL cache (both in-memory and persistent storage)
 */
export const clearImageUrlCache = async (): Promise<void> => {
  imageUrlCache.clear();
  
  try {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.IMAGE_URL_CACHE),
      AsyncStorage.removeItem(STORAGE_KEYS.CACHE_VERSION),
    ]);
    
    if (__DEV__) {
      console.log('🗑️ [FirebaseStorage] Image URL cache cleared (memory + persistent storage)');
    }
  } catch (error) {
    console.error('❌ [FirebaseStorage] Error clearing persistent cache:', error);
    if (__DEV__) {
      console.log('🗑️ [FirebaseStorage] Image URL cache cleared (memory only)');
    }
  }
};

/**
 * Preload images for multiple places (batch operation)
 * 
 * @param placeIds Array of place IDs
 * @param maxImagesPerPlace Maximum images per place
 * @returns Map of placeId -> image URLs
 */
export const preloadPlaceImages = async (
  placeIds: (string | number)[],
  maxImagesPerPlace: number = 3
): Promise<Map<string | number, string[]>> => {
  const results = new Map<string | number, string[]>();
  
  // Process in batches to avoid overwhelming Firebase
  const batchSize = 10;
  for (let i = 0; i < placeIds.length; i += batchSize) {
    const batch = placeIds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (placeId) => {
      const images = await getPlaceImagesFromStorage(placeId, maxImagesPerPlace);
      results.set(placeId, images);
    });
    
    await Promise.all(batchPromises);
    
    // Small delay between batches
    if (i + batchSize < placeIds.length) {
      await new Promise(resolve => setTimeout(() => resolve(true), 100));
    }
  }
  
  return results;
};

/**
 * Two-phase image fetching for optimal performance:
 * Phase 1: Fetch 1 image per place for all visible places (fast initial render)
 * Phase 2: Fetch 5+ images per place in background (enhancement)
 * 
 * @param places Array of places to enhance
 * @param maxImagesPerPlace Maximum images to fetch in phase 2 (default: 5)
 * @param onPhase1Complete Callback when phase 1 completes (for UI updates)
 * @returns Promise that resolves when phase 2 completes
 */
export const enhancePlacesWithTwoPhaseImageFetch = async (
  places: Array<{ id: string | number; sqlId?: string | number | null }>,
  maxImagesPerPlace: number = 5,
  onPhase1Complete?: (enhancedPlaces: Array<{ id: string | number; sqlId?: string | number | null; image?: string; images?: string[] }>) => void
): Promise<Array<{ id: string | number; sqlId?: string | number | null; image?: string; images?: string[] }>> => {
  if (!places.length) return [];

  // Phase 1: Fetch 1 image per place for all visible places
  // Process in larger batches since we're only fetching 1 image each
  const phase1BatchSize = 20; // Larger batch since only 1 image per place
  const phase1Results: Array<{ id: string | number; sqlId?: string | number | null; image?: string; images?: string[] }> = [];

  if (__DEV__) {
    console.log(`🔄 [FirebaseStorage] Phase 1: Fetching 1 image per place for ${places.length} places...`);
  }

  for (let i = 0; i < places.length; i += phase1BatchSize) {
    const batch = places.slice(i, i + phase1BatchSize);
    
    const batchPromises = batch.map(async (place) => {
      try {
        const storageId = place.sqlId != null ? String(place.sqlId) : place.id;
        const alternateId = place.sqlId != null ? place.id : undefined;
        
        // Fetch only 1 image in phase 1
        const firstImage = await getPlaceImageFromStorage(storageId, 0);
        
        if (!firstImage && alternateId) {
          // Try alternate ID if primary didn't work
          const altImage = await getPlaceImageFromStorage(alternateId, 0);
          if (altImage) {
            return { ...place, image: altImage, images: [altImage] };
          }
        }
        
        if (firstImage) {
          return { ...place, image: firstImage, images: [firstImage] };
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`⚠️ [FirebaseStorage] Phase 1 error for place ${place.id}:`, error);
        }
      }
      return { ...place };
    });

    const batchResults = await Promise.all(batchPromises);
    phase1Results.push(...batchResults);

    // Small delay between batches to avoid overwhelming Firebase
    if (i + phase1BatchSize < places.length) {
      await new Promise(resolve => setTimeout(() => resolve(true), 50));
    }
  }

  if (__DEV__) {
    const placesWithImages = phase1Results.filter(p => p.image).length;
    console.log(`✅ [FirebaseStorage] Phase 1 complete: ${placesWithImages}/${places.length} places have images`);
  }

  // Callback for UI update after phase 1
  if (onPhase1Complete) {
    onPhase1Complete(phase1Results);
  }

  // Phase 2: Fetch 5+ images per place in background
  if (__DEV__) {
    console.log(`🔄 [FirebaseStorage] Phase 2: Fetching ${maxImagesPerPlace} images per place in background...`);
  }

  const phase2BatchSize = 10; // Smaller batch for phase 2 since we're fetching more images
  const phase2Results: Array<{ id: string | number; sqlId?: string | number | null; image?: string; images?: string[] }> = [];

  for (let i = 0; i < phase1Results.length; i += phase2BatchSize) {
    const batch = phase1Results.slice(i, i + phase2BatchSize);
    
    const batchPromises = batch.map(async (place) => {
      try {
        const storageId = place.sqlId != null ? String(place.sqlId) : place.id;
        const alternateId = place.sqlId != null ? place.id : undefined;
        
        // Fetch full set of images in phase 2
        const allImages = await getPlaceImagesFromStorage(storageId, maxImagesPerPlace, ...(alternateId ? [alternateId] : []));
        
        if (allImages.length > 0) {
          return {
            ...place,
            image: allImages[0], // Update main image with first from full set
            images: allImages,
          };
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`⚠️ [FirebaseStorage] Phase 2 error for place ${place.id}:`, error);
        }
      }
      return place; // Keep phase 1 result if phase 2 fails
    });

    const batchResults = await Promise.all(batchPromises);
    phase2Results.push(...batchResults);

    // Delay between batches for phase 2
    if (i + phase2BatchSize < phase1Results.length) {
      await new Promise(resolve => setTimeout(() => resolve(true), 100));
    }
  }

  if (__DEV__) {
    const placesWithMultipleImages = phase2Results.filter(p => p.images && p.images.length > 1).length;
    console.log(`✅ [FirebaseStorage] Phase 2 complete: ${placesWithMultipleImages}/${phase2Results.length} places have multiple images`);
  }

  return phase2Results;
};

