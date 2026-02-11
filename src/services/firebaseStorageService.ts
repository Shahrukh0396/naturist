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

// Cache for Firebase Storage image URLs to avoid repeated lookups
const imageUrlCache = new Map<string, string[]>();

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
  const idsToTry = [placeId, ...alternatePlaceIds].map((id) => id.toString());
  const cacheKey = idsToTry.join('_') + `_${maxImages}`;

  if (imageUrlCache.has(cacheKey)) {
    const cached = imageUrlCache.get(cacheKey);
    if (cached && cached.length > 0) return cached;
    if (cached && cached.length === 0) return []; // Cached empty
  }

  try {
    for (const idStr of idsToTry) {
      const imageUrls = await fetchImagesForPlaceId(idStr, maxImages);
      if (imageUrls.length > 0) {
        imageUrlCache.set(cacheKey, imageUrls);
        if (__DEV__) {
          console.log(`✅ [FirebaseStorage] Found ${imageUrls.length} images for place ${idStr}`);
        }
        return imageUrls;
      }
    }
    imageUrlCache.set(cacheKey, []);
    return [];
  } catch (error) {
    console.error(`❌ [FirebaseStorage] Error fetching images for place ${placeId}:`, error);
    imageUrlCache.set(cacheKey, []);
    return [];
  }
};

/**
 * Get a single image URL from Firebase Storage
 * 
 * @param placeId The place ID
 * @param imageIndex Image index (default: 0 for first image)
 * @returns Firebase Storage download URL or null
 */
export const getPlaceImageFromStorage = async (
  placeId: string | number,
  imageIndex: number = 0
): Promise<string | null> => {
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
 * Clear the image URL cache
 */
export const clearImageUrlCache = (): void => {
  imageUrlCache.clear();
  if (__DEV__) {
    console.log('🗑️ [FirebaseStorage] Image URL cache cleared');
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

