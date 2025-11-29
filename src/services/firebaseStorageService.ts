/**
 * Firebase Storage Service
 * Fetches image URLs from Firebase Storage for places
 * Uses local JSON data for place metadata, Firebase Storage for images
 */

import storage from '@react-native-firebase/storage';

// Cache for Firebase Storage image URLs to avoid repeated lookups
const imageUrlCache = new Map<string, string[]>();

/**
 * Get Firebase Storage image URLs for a place
 * Storage path structure: places/{placeId}/images/{index}.{ext}
 * 
 * @param placeId The place ID (sql_id or _id)
 * @param maxImages Maximum number of images to fetch (default: 5)
 * @returns Array of Firebase Storage download URLs
 */
export const getPlaceImagesFromStorage = async (
  placeId: string | number,
  maxImages: number = 5
): Promise<string[]> => {
  const cacheKey = `${placeId}_${maxImages}`;
  
  // Check cache first
  if (imageUrlCache.has(cacheKey)) {
    const cached = imageUrlCache.get(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  try {
    const placeIdStr = placeId.toString();
    const imageUrls: string[] = [];
    
    // Try to get images from Firebase Storage
    // Path format: places/{placeId}/images/{index}.jpg
    for (let i = 0; i < maxImages; i++) {
      try {
        // Try common extensions
        const extensions = ['jpg', 'jpeg', 'png', 'webp'];
        let found = false;
        
        for (const ext of extensions) {
          const imagePath = `places/${placeIdStr}/images/${i}.${ext}`;
          const imageRef = storage().ref(imagePath);
          
          // Check if file exists by trying to get download URL
          try {
            const url = await imageRef.getDownloadURL();
            if (url) {
              imageUrls.push(url);
              found = true;
              break; // Found image with this extension, move to next index
            }
          } catch (error: any) {
            // File doesn't exist with this extension, try next
            if (error?.code !== 'storage/object-not-found') {
              // Some other error, log it but continue
              if (__DEV__ && i === 0) {
                console.log(`🔄 [FirebaseStorage] Checking ${imagePath}...`);
              }
            }
          }
        }
        
        // If no image found at this index, stop searching (images are sequential)
        if (!found && i === 0) {
          // No images at all for this place
          break;
        } else if (!found) {
          // Found some images but not at this index, stop
          break;
        }
      } catch (error) {
        // Error checking this image, continue to next
        if (__DEV__ && i === 0) {
          console.warn(`⚠️ [FirebaseStorage] Error checking image ${i} for place ${placeId}:`, error);
        }
      }
    }
    
    // Cache the results (even if empty)
    imageUrlCache.set(cacheKey, imageUrls);
    
    if (__DEV__ && imageUrls.length > 0) {
      console.log(`✅ [FirebaseStorage] Found ${imageUrls.length} images for place ${placeId}`);
    }
    
    return imageUrls;
  } catch (error) {
    console.error(`❌ [FirebaseStorage] Error fetching images for place ${placeId}:`, error);
    // Cache empty result to avoid repeated failed lookups
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
};

