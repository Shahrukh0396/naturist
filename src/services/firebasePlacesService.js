/**
 * Optimized Firebase Places Service
 * Handles Firebase Realtime Database sync and Storage image URL fetching
 * with batching, caching, and error handling
 */

import database from '@react-native-firebase/database';
import storage from '@react-native-firebase/storage';

// Place model structure
const createPlaceModel = (id, data) => ({
  id: id || data._id?.$oid || data.sql_id?.toString() || 'unknown',
  title: data.title || '',
  description: data.description || '',
  lat: parseFloat(data.lat) || 0,
  lng: parseFloat(data.lng) || 0,
  country: data.country || '',
  place_type: data.place_type || '',
  rating: data.rating || data.googleRating || 0,
  state: data.state || '',
  googlePlaceId: data.googlePlaceId,
  googleRating: data.googleRating,
  googleUserRatingCount: data.googleUserRatingCount,
  googleFormattedAddress: data.googleFormattedAddress,
  googleWebsiteUri: data.googleWebsiteUri,
  googleNationalPhoneNumber: data.googleNationalPhoneNumber,
  verified: data.verified || false,
  featured: data.featured || false,
  images: data.images || [],
  firebaseImages: data.firebaseImages || [],
  imageUrls: [], // Will be populated with Firebase Storage URLs
  ...data, // Include any other fields
});

/**
 * Fetch places from Firebase Realtime Database
 * Converts object-based responses into array of place models with IDs
 * @param {number} limit - Maximum number of places to fetch
 * @param {string} orderBy - Field to order by (default: 'rating')
 * @returns {Promise<Array>} - Array of place models
 */
export const fetchPlacesFromFirebase = async (limit = 200, orderBy = 'rating') => {
  try {
    if (__DEV__) {
      console.log(`🔄 [FirebasePlaces] Fetching up to ${limit} places ordered by ${orderBy}...`);
    }

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Firebase query timeout after 10 seconds'));
      }, 10000);
    });

    // Query with limit
    const dbRef = database()
      .ref('places')
      .orderByChild(orderBy)
      .limitToLast(limit);

    const snapshot = await Promise.race([dbRef.once('value'), timeoutPromise]);
    const placesData = snapshot.val();

    if (!placesData) {
      if (__DEV__) {
        console.warn('⚠️ [FirebasePlaces] No places found in Firebase');
      }
      return [];
    }

    // Convert object to array of places with IDs
    const places = Object.keys(placesData).map((key) => {
      const data = placesData[key];
      return createPlaceModel(key, data);
    });

    // Filter out invalid places
    const validPlaces = places.filter(
      (place) =>
        !place.deleted &&
        (place.state === 'Active' || place.state === 'active' || !place.state) &&
        place.lat &&
        place.lng &&
        place.title
    );

    if (__DEV__) {
      console.log(`✅ [FirebasePlaces] Loaded ${validPlaces.length} valid places from Firebase`);
    }

    return validPlaces;
  } catch (error) {
    console.error('❌ [FirebasePlaces] Error fetching places from Firebase:', error?.message || error);
    return [];
  }
};

/**
 * Batch helper for processing URLs in batches
 * @param {Array} items - Array of items to process
 * @param {Function} processor - Function to process each item
 * @param {number} batchSize - Size of each batch (default: 10)
 * @returns {Promise<Array>} - Array of processed results
 */
const processInBatches = async (items, processor, batchSize = 10) => {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(processor);
    
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } catch (error) {
      console.error(`❌ [FirebasePlaces] Error processing batch ${i / batchSize + 1}:`, error);
      // Continue with next batch even if this one fails
      results.push(...batch.map(() => null));
    }
    
    // Small delay between batches to avoid throttling
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  
  return results;
};

/**
 * Resolve Firebase Storage image download URL with retry and backoff
 * @param {string} storagePath - Path to the image in Firebase Storage
 * @param {number} retries - Number of retries (default: 3)
 * @returns {Promise<string|null>} - Download URL or null if not found
 */
const resolveImageUrlWithRetry = async (storagePath, retries = 3) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const imageRef = storage().ref(storagePath);
      const url = await imageRef.getDownloadURL();
      return url;
    } catch (error) {
      // Check if it's a throttling error
      const isThrottled =
        error?.code === 'storage/retry-limit-exceeded' ||
        error?.code === 'storage/quota-exceeded' ||
        error?.message?.includes('quota') ||
        error?.message?.includes('throttle');

      if (isThrottled && attempt < retries) {
        // Exponential backoff: 1s, 2s, 4s
        const backoffDelay = Math.pow(2, attempt) * 1000;
        if (__DEV__) {
          console.log(
            `⚠️ [FirebasePlaces] Throttled, retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${retries + 1})`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        continue;
      }

      // Not a throttling error or out of retries
      if (error?.code !== 'storage/object-not-found') {
        if (__DEV__ && attempt === 0) {
          console.warn(`⚠️ [FirebasePlaces] Error resolving image ${storagePath}:`, error?.code || error?.message);
        }
      }
      return null;
    }
  }
  return null;
};

/**
 * Get image download URLs for a place from Firebase Storage
 * Processes images in batches of 10 to avoid throttling
 * @param {string|number} placeId - Place ID
 * @param {number} maxImages - Maximum number of images to fetch (default: 5)
 * @returns {Promise<Array<string>>} - Array of download URLs
 */
export const getPlaceImageUrls = async (placeId, maxImages = 5) => {
  const placeIdStr = placeId.toString();
  const imageUrls = [];

  // Try common image paths
  const imagePaths = [];
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];

  for (let i = 0; i < maxImages; i++) {
    for (const ext of extensions) {
      imagePaths.push(`places/${placeIdStr}/images/${i}.${ext}`);
    }
  }

  // Process image paths in batches of 10
  const resolvedUrls = await processInBatches(
    imagePaths,
    async (path) => {
      const url = await resolveImageUrlWithRetry(path);
      return { path, url };
    },
    10
  );

  // Extract valid URLs and remove duplicates
  const foundUrls = resolvedUrls
    .filter((result) => result && result.url)
    .map((result) => result.url);

  // Remove duplicates while preserving order
  const uniqueUrls = [...new Set(foundUrls)];

  // Stop at first sequential gap (if index 0 doesn't exist, stop)
  for (let i = 0; i < maxImages; i++) {
    const indexUrls = foundUrls.filter((_, idx) => {
      const pathIdx = Math.floor(idx / extensions.length);
      return pathIdx === i;
    });
    if (indexUrls.length === 0 && i === 0) {
      break; // No images at all
    }
    if (indexUrls.length > 0) {
      imageUrls.push(indexUrls[0]);
    } else {
      break; // Gap in sequence
    }
  }

  return imageUrls;
};

/**
 * Batch fetch image URLs for multiple places
 * Processes places in batches to avoid overwhelming Firebase
 * @param {Array} places - Array of place objects
 * @param {number} maxImagesPerPlace - Maximum images per place (default: 5)
 * @returns {Promise<Array>} - Places with imageUrls populated
 */
export const batchResolvePlaceImageUrls = async (places, maxImagesPerPlace = 5) => {
  if (!places || places.length === 0) {
    return places;
  }

  if (__DEV__) {
    console.log(`🔄 [FirebasePlaces] Resolving image URLs for ${places.length} places...`);
  }

  // Process places in batches of 10
  const placesWithImages = await processInBatches(
    places,
    async (place) => {
      try {
        const imageUrls = await getPlaceImageUrls(place.id, maxImagesPerPlace);
        
        // Use Firebase Storage URLs if available, otherwise use existing images
        if (imageUrls.length > 0) {
          place.imageUrls = imageUrls;
          place.firebaseImages = imageUrls;
          // Set main image if not already set
          if (!place.image || !place.image.startsWith('http')) {
            place.image = imageUrls[0];
          }
          // Merge with existing images, avoiding duplicates
          const allImages = [
            ...imageUrls,
            ...(place.images || []).filter((img) => !imageUrls.includes(img)),
          ];
          place.images = allImages;
        } else {
          // No Firebase images found, use placeholder if no existing image
          if (!place.image || !place.image.startsWith('http')) {
            place.image = getPlaceholderImage(place.place_type || 'other');
          }
          place.imageUrls = [];
        }
        
        return place;
      } catch (error) {
        console.error(`❌ [FirebasePlaces] Error resolving images for place ${place.id}:`, error);
        // Return place with placeholder
        if (!place.image || !place.image.startsWith('http')) {
          place.image = getPlaceholderImage(place.place_type || 'other');
        }
        place.imageUrls = [];
        return place;
      }
    },
    10 // Batch size: 10 places at a time
  );

  if (__DEV__) {
    const placesWithImagesCount = placesWithImages.filter((p) => p.imageUrls?.length > 0).length;
    console.log(`✅ [FirebasePlaces] Resolved images for ${placesWithImagesCount}/${places.length} places`);
  }

  return placesWithImages;
};

/**
 * Get placeholder image for category
 * @param {string} placeType - Place type/category
 * @returns {string} - Placeholder image URL
 */
const getPlaceholderImage = () => {
  return ''; // No Unsplash — use Firebase Storage only; UI shows placeholder when empty
};

/**
 * Sync places from Firebase with image URL resolution
 * This is the main function that orchestrates the entire sync process
 * @param {number} limit - Maximum number of places to fetch
 * @param {number} maxImagesPerPlace - Maximum images per place
 * @returns {Promise<Array>} - Places with all image URLs resolved
 */
export const syncPlacesFromFirebase = async (limit = 200, maxImagesPerPlace = 5) => {
  try {
    if (__DEV__) {
      console.log('🔄 [FirebasePlaces] Starting place sync from Firebase...');
    }

    // Step 1: Fetch places from Realtime Database
    const places = await fetchPlacesFromFirebase(limit);

    if (places.length === 0) {
      return [];
    }

    // Step 2: Resolve image URLs from Firebase Storage in batches
    const placesWithImages = await batchResolvePlaceImageUrls(places, maxImagesPerPlace);

    if (__DEV__) {
      console.log(`✅ [FirebasePlaces] Sync completed: ${placesWithImages.length} places`);
    }

    return placesWithImages;
  } catch (error) {
    console.error('❌ [FirebasePlaces] Error syncing places:', error);
    return [];
  }
};

