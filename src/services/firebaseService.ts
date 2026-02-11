/**
 * Firebase Service for React Native
 * Uses @react-native-firebase/database for Realtime Database access.
 *
 * Realtime DB structure: {databaseURL}/places/{sql_id} = place data (sync script uses sql_id as key).
 *
 * Offline Support:
 * - React Native Firebase automatically enables offline persistence
 * - Data is cached locally and available offline
 * - Changes are synced when connection is restored
 */

import database from '@react-native-firebase/database';
import app from '@react-native-firebase/app';

// Enable offline persistence (enabled by default in React Native Firebase)
// This caches data locally so it's available offline
try {
  database().setPersistenceEnabled(true);
} catch (error) {
  console.warn('⚠️ [Firebase] Could not set persistence:', error);
}

// React Native Firebase auto-initializes from:
// - Android: android/app/google-services.json
// - iOS: ios/naturism/GoogleService-Info.plist
// No manual initialization needed!
if (__DEV__) {
  console.log('🔥 Firebase Realtime Database ready');
  console.log('📱 Offline persistence enabled - data will be cached locally');
  
  // Check Firebase app initialization
  try {
    const defaultApp = app.app();
    console.log('✅ [Firebase] App initialized:', defaultApp.name);
    console.log('✅ [Firebase] App options:', {
      projectId: defaultApp.options.projectId,
      databaseURL: defaultApp.options.databaseURL,
      apiKey: defaultApp.options.apiKey ? '***' + defaultApp.options.apiKey.slice(-4) : 'missing',
    });
  } catch (error) {
    console.error('❌ [Firebase] App not initialized:', error);
  }
  
  // Test database connection with timeout
  try {
    const testRef = database().ref('.info/connected');
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection test timeout')), 5000);
    });
    
    Promise.race([
      testRef.once('value').then(snapshot => {
        console.log('✅ [Firebase] Database connection test:', snapshot.val() ? 'Connected' : 'Not connected');
      }),
      timeoutPromise
    ]).catch(err => {
      console.warn('⚠️ [Firebase] Could not test connection:', err);
    });
  } catch (error) {
    console.warn('⚠️ [Firebase] Database initialization check failed:', error);
  }
}

export interface FirebasePlace {
  sql_id?: number;
  _id?: { $oid: string };
  original_id?: string; // Sanitized _id from sync script
  title: string;
  description?: string;
  lat: string;
  lng: string;
  country?: string;
  place_type?: string;
  images?: string[]; // Primary images (Firebase Storage URLs preferred)
  firebaseImages?: string[]; // Firebase Storage URLs
  googleImages?: string[]; // Original Google Places API URLs
  rating?: number;
  state?: string;
  googlePlaceId?: string;
  googleRating?: number;
  googleUserRatingCount?: number;
  googleFormattedAddress?: string;
  googleDisplayName?: string;
  googleEditorialSummary?: string;
  googleTypes?: string[];
  googleWebsiteUri?: string;
  googleNationalPhoneNumber?: string;
  verified?: boolean;
  verificationStatus?: string;
  [key: string]: any;
}

/**
 * Get limited places from Firebase Realtime Database
 * WARNING: Do not fetch all places at once - it causes OutOfMemoryError!
 * Use targeted queries with limits instead.
 * 
 * @param limit Maximum number of places to fetch (default: 200)
 * @param orderBy Field to order by (default: 'rating')
 */
export const getLimitedPlacesFromFirebase = async (
  limit: number = 200,
  orderBy: string = 'rating'
): Promise<FirebasePlace[]> => {
  try {
    console.log(`🔄 [Firebase] Fetching up to ${limit} places ordered by ${orderBy}...`);
    
    // First, verify Firebase app is initialized
    try {
      const defaultApp = app.app();
      const dbUrl = defaultApp.options.databaseURL;
      
      if (!dbUrl) {
        console.error('❌ [Firebase] Database URL is not configured!');
        return [];
      }
    } catch (appError) {
      console.error('❌ [Firebase] Cannot access Firebase app:', appError);
      return [];
    }
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Firebase query timeout after 10 seconds'));
      }, 10000);
    });
    
    // Query with limit to prevent OOM
    const dbRef = database()
      .ref('places')
      .orderByChild(orderBy)
      .limitToLast(limit); // Get top-rated places
    
    console.log(`🔄 [Firebase] Query initiated with limit ${limit}...`);
    
    const snapshot = await Promise.race([dbRef.once('value'), timeoutPromise]);
    
    const placesData = snapshot.val();
    
    if (!placesData) {
      console.warn('⚠️ [Firebase] No places found in Firebase');
      return [];
    }
    
    // Convert object to array
    const places: FirebasePlace[] = Object.values(placesData);
    console.log(`✅ [Firebase] Loaded ${places.length} places from Firebase (limited)`);
    
    return places;
  } catch (error: any) {
    console.error('❌ [Firebase] Error fetching places from Firebase:', error?.message);
    return [];
  }
};

/**
 * @deprecated Use getLimitedPlacesFromFirebase instead
 * This function causes OutOfMemoryError when there are many places
 */
export const getAllPlacesFromFirebase = async (): Promise<FirebasePlace[]> => {
  console.warn('⚠️ [Firebase] getAllPlacesFromFirebase is deprecated - use getLimitedPlacesFromFirebase instead');
  // Return limited results to prevent OOM
  return getLimitedPlacesFromFirebase(200, 'rating');
};

/**
 * Get a single place by ID from Firebase
 */
export const getPlaceByIdFromFirebase = async (placeId: string | number): Promise<FirebasePlace | null> => {
  try {
    const snapshot = await database().ref(`places/${placeId}`).once('value');
    const place = snapshot.val();
    
    if (!place) {
      return null;
    }
    
    return place;
  } catch (error) {
    console.error(`❌ Error fetching place ${placeId} from Firebase:`, error);
    return null;
  }
};

/**
 * Get places by country from Firebase (with limit to prevent OOM)
 */
export const getPlacesByCountryFromFirebase = async (country: string, limit: number = 100): Promise<FirebasePlace[]> => {
  try {
    const snapshot = await database()
      .ref('places')
      .orderByChild('country')
      .equalTo(country.toLowerCase())
      .limitToFirst(limit)
      .once('value');
    
    const placesData = snapshot.val();
    
    if (!placesData) {
      return [];
    }
    
    return Object.values(placesData);
  } catch (error) {
    console.error(`❌ Error fetching places for country ${country} from Firebase:`, error);
    return [];
  }
};

/**
 * Get places by type from Firebase (with limit to prevent OOM)
 */
export const getPlacesByTypeFromFirebase = async (placeType: string, limit: number = 100): Promise<FirebasePlace[]> => {
  try {
    const snapshot = await database()
      .ref('places')
      .orderByChild('place_type')
      .equalTo(placeType)
      .limitToFirst(limit)
      .once('value');
    
    const placesData = snapshot.val();
    
    if (!placesData) {
      return [];
    }
    
    return Object.values(placesData);
  } catch (error) {
    console.error(`❌ Error fetching places for type ${placeType} from Firebase:`, error);
    return [];
  }
};

/**
 * Get verified places from Firebase (with limit to prevent OOM)
 */
export const getVerifiedPlacesFromFirebase = async (limit: number = 100): Promise<FirebasePlace[]> => {
  try {
    const snapshot = await database()
      .ref('places')
      .orderByChild('verified')
      .equalTo(true)
      .limitToFirst(limit)
      .once('value');
    
    const placesData = snapshot.val();
    
    if (!placesData) {
      return [];
    }
    
    return Object.values(placesData);
  } catch (error) {
    console.error('❌ Error fetching verified places from Firebase:', error);
    return [];
  }
};

/**
 * Search places by query (optimized with limits to prevent OOM)
 * Note: Firebase Realtime Database doesn't support full-text search natively
 * This searches a limited set of places client-side
 */
export const searchPlacesInFirebase = async (query: string, limit: number = 50): Promise<FirebasePlace[]> => {
  try {
    // Fetch limited places to search through
    const limitedPlaces = await getLimitedPlacesFromFirebase(limit * 2, 'rating');
    const searchTerm = query.toLowerCase();
    
    return limitedPlaces
      .filter(place => {
        const title = (place.title || '').toLowerCase();
        const description = (place.description || '').toLowerCase();
        const country = (place.country || '').toLowerCase();
        
        return title.includes(searchTerm) || 
               description.includes(searchTerm) || 
               country.includes(searchTerm);
      })
      .slice(0, limit); // Limit final results
  } catch (error) {
    console.error('❌ Error searching places in Firebase:', error);
    return [];
  }
};

/**
 * Listen to limited places changes in real-time (optimized to prevent OOM)
 * With offline support: Works offline with cached data, syncs when online
 * 
 * @param callback Callback function to receive places
 * @param limit Maximum number of places to subscribe to (default: 200)
 */
export const subscribeToPlaces = (
  callback: (places: FirebasePlace[]) => void,
  limit: number = 200
): () => void => {
  // Use limit to prevent OOM
  const ref = database()
    .ref('places')
    .orderByChild('rating')
    .limitToLast(limit);
  
  // .on('value') automatically works with offline persistence
  // It will fire with cached data immediately, then update when online
  const listener = ref.on('value', (snapshot) => {
    const placesData = snapshot.val();
    
    if (!placesData) {
      callback([]);
      return;
    }
    
    const places: FirebasePlace[] = Object.values(placesData);
    callback(places);
  }, (error) => {
    // Handle errors, but still try to use cached data
    console.error('❌ Error in places subscription:', error);
    // Try to get cached data with limit
    ref.once('value')
      .then(snapshot => {
        const cachedData = snapshot.val();
        if (cachedData) {
          const cachedPlaces: FirebasePlace[] = Object.values(cachedData);
          callback(cachedPlaces);
        } else {
          callback([]);
        }
      })
      .catch(() => callback([]));
  });
  
  // Return unsubscribe function
  return () => {
    ref.off('value', listener);
  };
};

/**
 * Get nearby places from Firebase (optimized with limits to prevent OOM)
 * Fetches a limited set of places and filters by distance client-side
 */
export const getNearbyPlacesFromFirebase = async (
  latitude: number,
  longitude: number,
  radiusKm: number = 50,
  maxResults: number = 100
): Promise<FirebasePlace[]> => {
  try {
    console.log('🔄 [getNearbyPlacesFromFirebase] Starting...', { latitude, longitude, radiusKm, maxResults });
    
    // Fetch limited places to prevent OOM (prioritize verified/high-rated places)
    const limitedPlaces = await getLimitedPlacesFromFirebase(maxResults * 2, 'rating');
    console.log('🔄 [getNearbyPlacesFromFirebase] Got', limitedPlaces.length, 'places from Firebase');
    
    // Filter by distance and limit results
    const filtered = limitedPlaces
      .filter(place => {
        if (!place.lat || !place.lng) {
          return false;
        }
        
        const placeLat = parseFloat(place.lat);
        const placeLng = parseFloat(place.lng);
        
        if (isNaN(placeLat) || isNaN(placeLng)) {
          return false;
        }
        
        const distance = calculateDistance(latitude, longitude, placeLat, placeLng);
        return distance <= radiusKm;
      })
      .sort((a, b) => {
        const distA = calculateDistance(
          latitude,
          longitude,
          parseFloat(a.lat),
          parseFloat(a.lng)
        );
        const distB = calculateDistance(
          latitude,
          longitude,
          parseFloat(b.lat),
          parseFloat(b.lng)
        );
        return distA - distB;
      })
      .slice(0, maxResults); // Limit final results
    
    console.log('✅ [getNearbyPlacesFromFirebase] Found', filtered.length, 'nearby places');
    return filtered;
  } catch (error: any) {
    console.error('❌ [getNearbyPlacesFromFirebase] Error:', error?.message);
    return [];
  }
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

