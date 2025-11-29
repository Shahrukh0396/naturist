import { RawPlace, Place } from '../types';
import { Location, DEFAULT_LOCATION, calculateDistance } from './locationService';
import {
  GooglePlace,
  searchNearbyPlaces,
  searchPlacesByText,
  searchNaturistPlaces,
  validateApiKey
} from './googlePlacesService';
import {
  getLimitedPlacesFromFirebase,
  FirebasePlace,
  getNearbyPlacesFromFirebase as getNearbyPlacesFromFirebaseService,
  subscribeToPlaces as subscribeToPlacesFirebase
} from './firebaseService';
import { getPlaceImagesFromStorage, getPlaceImageFromStorage } from './firebaseStorageService';

// Flag to enable/disable Firebase Realtime Database (set to false to use local JSON)
// We'll use Firebase Storage for images even when this is false
const USE_FIREBASE_DATABASE = false;

/**
 * Load places data - PRIORITY ORDER:
 * 1. Local JSON data (primary source)
 * 2. Firebase Storage for images (loaded asynchronously)
 * 2. Verified file (contains Google Places verified data + images)
 * 3. Original file (fallback)
 */
let placesData: RawPlace[] = [];
let firebaseAvailable = false;

// Load local JSON files (primary data source)
// Images will be loaded from Firebase Storage
try {
  // PRIMARY: Use verified file (contains Google Places verified data + images)
  placesData = require('../utils/natureism.places.verified.json');
  if (__DEV__) {
    console.log('✅ Using local JSON data (naturism.places.verified.json)');
    console.log('📷 Images will be loaded from Firebase Storage');
  }
} catch (e) {
  // FALLBACK: Use original file only if verified doesn't exist
  placesData = require('../utils/natureism.places.json');
  if (__DEV__) {
    console.warn('⚠️  Verified file not found, using original places data. Run: npm run verify-places');
    console.log('📷 Images will be loaded from Firebase Storage');
  }
}

// Place type mapping from JSON place_type to our categories
const PLACE_TYPE_MAPPING: { [key: string]: 'beach' | 'camps' | 'hotel' | 'sauna' | 'other' } = {
  'B': 'beach',      // Beach
  'C': 'camps',      // Camps
  'E': 'hotel',      // Hotel
  'F': 'sauna',      // Sauna
  'P': 'other',      // Park (mapped to other)
  'S': 'other',      // Spa (mapped to other)
  'R': 'other',      // Resort (mapped to other)
  'H': 'other',      // Hotel/Resort (fallback)
  'D': 'other',      // Other
};

// Default nearby radius in kilometers
const DEFAULT_NEARBY_RADIUS = 50;

// Transform raw place data to our Place interface
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

  // Determine if place is nearby (within default radius)
  const isNearby = distance <= DEFAULT_NEARBY_RADIUS;

  // Get category from place_type
  const category = PLACE_TYPE_MAPPING[rawPlace.place_type] || 'other';

  // Determine price range based on features or default to moderate
  const priceRange = determinePriceRange(rawPlace.features);

  // Get images: Priority 1) Firebase Storage, 2) Local images array, 3) Default
  // Note: Firebase Storage images are loaded asynchronously, so we'll use local images as initial
  // and update with Firebase Storage images when available
  const getMainImage = () => {
    // First, try local images array
    if (rawPlace.images && rawPlace.images.length > 0) {
      for (let i = 0; i < rawPlace.images.length; i++) {
        const imageUrl = rawPlace.images[i];
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
          return imageUrl;
        }
      }
    }

    // Fallback to category-specific default images
    const categoryDefaults = {
      'beach': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
      'camps': 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=400',
      'hotel': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
      'sauna': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
      'other': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    };

    return categoryDefaults[category] || categoryDefaults['other'];
  };
  
  const mainImage = getMainImage();
  
  // Start loading Firebase Storage images asynchronously (non-blocking)
  // The images will be available in the images array, but we use local images for immediate display
  const placeId = rawPlace.sql_id || rawPlace._id?.$oid;
  
  // For now, use local images. Firebase Storage images will be loaded and cached
  // by firebaseStorageService for future use
  if (placeId) {
    // Prefetch Firebase Storage images in background (non-blocking)
    getPlaceImagesFromStorage(placeId, 5).catch(() => {
      // Silently fail - local images will be used
    });
  }
  
  // Use local images for immediate display
  // Firebase Storage images will be available on subsequent loads via cache
  const allImages = rawPlace.images || [];
  const finalMainImage = mainImage;
  
  return {
    id: rawPlace._id.$oid,
    name: rawPlace.title,
    description: rawPlace.description || 'No description available',
    image: finalMainImage,
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
    distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
    country: rawPlace.country,
    placeType: rawPlace.place_type,
    featured: rawPlace.featured || false,
  };
};

// Determine price range based on features
const determinePriceRange = (features: string[]): '$' | '$$' | '$$$' | '$$$$' => {
  if (!features || features.length === 0) return '$$';

  const featureString = features.join(' ').toLowerCase();

  // Luxury indicators
  if (featureString.includes('luxury') || featureString.includes('vip') || featureString.includes('premium')) {
    return '$$$$';
  }

  // Expensive indicators
  if (featureString.includes('spa') || featureString.includes('resort') || featureString.includes('hotel')) {
    return '$$$';
  }

  // Budget indicators
  if (featureString.includes('camping') || featureString.includes('basic') || featureString.includes('free')) {
    return '$';
  }

  // Default to moderate
  return '$$';
};

/**
 * Convert FirebasePlace to Place format
 */
const transformFirebasePlace = (firebasePlace: FirebasePlace, userLocation: Location = DEFAULT_LOCATION): Place => {
  const latitude = parseFloat(firebasePlace.lat);
  const longitude = parseFloat(firebasePlace.lng);

  // Calculate distance from user location
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    latitude,
    longitude
  );

  // Determine if place is nearby (within default radius)
  const isNearby = distance <= DEFAULT_NEARBY_RADIUS;

  // Get category from place_type
  const category = PLACE_TYPE_MAPPING[firebasePlace.place_type || ''] || 'other';

  // Priority: Firebase Storage images > original images (no Google API images)
  const images = firebasePlace.firebaseImages && firebasePlace.firebaseImages.length > 0
    ? firebasePlace.firebaseImages
    : (firebasePlace.images || []);

  const mainImage = images.length > 0 && images[0]?.startsWith('http')
    ? images[0]
    : getDefaultImageForCategory(category);

  return {
    id: firebasePlace._id?.$oid || firebasePlace.sql_id?.toString() || 'unknown',
    name: firebasePlace.title,
    description: firebasePlace.description || 'No description available',
    image: mainImage,
    images: images,
    location: {
      latitude,
      longitude,
      address: firebasePlace.googleFormattedAddress || firebasePlace.country || '',
    },
    category,
    rating: firebasePlace.googleRating || firebasePlace.rating || 0,
    priceRange: determinePriceRange(firebasePlace.features || []),
    amenities: firebasePlace.features || [],
    isPopular: (firebasePlace.googleRating || firebasePlace.rating || 0) >= 4.0,
    isNearby,
    distance: Math.round(distance * 10) / 10,
    country: firebasePlace.country || '',
    placeType: firebasePlace.place_type || '',
    featured: firebasePlace.featured || false,
    googlePlaceId: firebasePlace.googlePlaceId,
    phone: firebasePlace.googleNationalPhoneNumber,
    website: firebasePlace.googleWebsiteUri,
    source: firebasePlace.googlePlaceId ? 'firebase' : 'local',
  };
};

/**
 * Get default image for category (helper function)
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
 * Enhance places with Firebase Storage images (background process)
 * Updates places in-place when Firebase Storage images are available
 */
const enhancePlacesWithFirebaseImages = async (places: Place[]): Promise<void> => {
  try {
    console.log(`🔄 [loadPlaces] Enhancing ${places.length} places with Firebase Storage images...`);
    
    // Enhance places in batches to avoid overwhelming Firebase
    const batchSize = 5;
    for (let i = 0; i < places.length; i += batchSize) {
      const batch = places.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (place) => {
          try {
            const firebaseImages = await getPlaceImagesFromStorage(place.id, 5);
            
            if (firebaseImages && firebaseImages.length > 0) {
              // Update place with Firebase Storage images
              place.image = firebaseImages[0];
              place.images = [
                ...firebaseImages,
                ...(place.images || []).filter(img => !firebaseImages.includes(img))
              ];
              
              if (__DEV__) {
                console.log(`✅ [loadPlaces] Enhanced place ${place.id} with ${firebaseImages.length} Firebase Storage images`);
              }
            }
          } catch (error) {
            // Silently continue - local images are already available
          }
        })
      );
      
      // Small delay between batches
      if (i + batchSize < places.length) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
      }
    }
    
    console.log(`✅ [loadPlaces] Enhanced ${places.length} places with Firebase Storage images`);
  } catch (error) {
    console.warn('⚠️ [loadPlaces] Error enhancing places with Firebase Storage images:', error);
  }
};

// Load and transform all places
// Uses local JSON data, enhances with Firebase Storage images in background
export const loadPlaces = async (userLocation: Location = DEFAULT_LOCATION): Promise<Place[]> => {
  console.log('🔄 [loadPlaces] Starting to load places...');
  console.log('🔄 [loadPlaces] Using local JSON data, Firebase Storage for images');
  
  // Use local JSON data (Firebase Storage for images is handled in transformPlace)
  if (USE_FIREBASE_DATABASE && firebaseAvailable) {
    try {
      console.log('🔄 [loadPlaces] Attempting to load from Firebase (limited query)...');
      console.log('🔄 [loadPlaces] Starting getLimitedPlacesFromFirebase()...');
      
      // Add timeout wrapper
      const timeoutPromise = new Promise<FirebasePlace[]>((_, reject) => {
        setTimeout(() => {
          reject(new Error('loadPlaces timeout waiting for Firebase'));
        }, 15000); // 15 second timeout
      });
      
      // Use limited query to prevent OutOfMemoryError
      const firebasePromise = getLimitedPlacesFromFirebase(200, 'rating');
      const firebasePlaces = await Promise.race([firebasePromise, timeoutPromise]);
      
      console.log('🔄 [loadPlaces] Firebase returned:', firebasePlaces?.length || 0, 'places');

      if (firebasePlaces && firebasePlaces.length > 0) {
        console.log(`✅ [loadPlaces] Loaded ${firebasePlaces.length} places from Firebase`);

        // Filter out deleted or inactive places
        const activePlaces = firebasePlaces.filter(place =>
          !place.deleted &&
          (place.state === 'Active' || place.state === 'active') &&
          place.lat &&
          place.lng &&
          place.title
        );
        console.log(`🔄 [loadPlaces] After filtering: ${activePlaces.length} active places`);

        // Transform all places
        const transformedPlaces = activePlaces.map(place => transformFirebasePlace(place, userLocation));
        console.log(`✅ [loadPlaces] Transformed ${transformedPlaces.length} places from Firebase`);

        // Sort by featured first, then by rating
        const sorted = transformedPlaces.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return b.rating - a.rating;
        });
        console.log(`✅ [loadPlaces] Returning ${sorted.length} places from Firebase`);
        return sorted;
      } else {
        console.log('⚠️ [loadPlaces] Firebase returned empty array, falling back to local data');
      }
    } catch (error: any) {
      console.error('❌ [loadPlaces] Error loading from Firebase, falling back to local data');
      console.error('❌ [loadPlaces] Error message:', error?.message);
      console.error('❌ [loadPlaces] Error type:', error?.constructor?.name);
      if (error?.message?.includes('timeout')) {
        console.error('❌ [loadPlaces] Firebase query timed out - will use local data');
      }
      // Fall through to local data
    }
  } else {
    console.log('🔄 [loadPlaces] Firebase not enabled, using local data');
  }
  
  // Fallback to local JSON data
  console.log('🔄 [loadPlaces] Loading from local JSON data...');
  const rawPlaces = placesData as RawPlace[];
  console.log('🔄 [loadPlaces] Raw places from JSON:', rawPlaces?.length || 0);

  // Filter out deleted or inactive places
  const activePlaces = rawPlaces.filter(place =>
    !place.deleted &&
    place.state === 'Active' &&
    place.lat &&
    place.lng &&
    place.title
  );
  console.log(`🔄 [loadPlaces] After filtering: ${activePlaces.length} active places`);

  // Transform all places (with local images for immediate display)
  const transformedPlaces = activePlaces.map(place => transformPlace(place, userLocation));
  console.log(`✅ [loadPlaces] Transformed ${transformedPlaces.length} places from local data`);

  // Enhance first 20 places with Firebase Storage images in background (non-blocking)
  // This improves images for the most visible places without blocking initial load
  const placesToEnhance = transformedPlaces.slice(0, 20);
  enhancePlacesWithFirebaseImages(placesToEnhance).catch(() => {
    // Silently fail - local images are already available
  });

  // Sort by featured first, then by rating
  const sorted = transformedPlaces.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return b.rating - a.rating;
  });
  console.log(`✅ [loadPlaces] Returning ${sorted.length} places from local data`);
  return sorted;
};

// Get places by category
export const getPlacesByCategory = async (category: string, userLocation: Location = DEFAULT_LOCATION): Promise<Place[]> => {
  const allPlaces = await loadPlaces(userLocation);
  return allPlaces.filter(place => place.category === category);
};

// Get popular places (featured or high-rated)
export const getPopularPlaces = async (userLocation: Location = DEFAULT_LOCATION): Promise<Place[]> => {
  console.log('🔄 [getPopularPlaces] Starting...');
  const allPlaces = await loadPlaces(userLocation);
  console.log('🔄 [getPopularPlaces] Loaded', allPlaces.length, 'total places');
  const popular = allPlaces.filter(place => place.featured || place.rating >= 4.0);
  console.log('✅ [getPopularPlaces] Found', popular.length, 'popular places');
  return popular;
};

// Get nearby places
export const getNearbyPlaces = async (userLocation: Location = DEFAULT_LOCATION, radiusKm: number = DEFAULT_NEARBY_RADIUS): Promise<Place[]> => {
  console.log('🔄 [getNearbyPlaces] Starting...', 'radius:', radiusKm, 'location:', userLocation);
  // Use local JSON data (Firebase Storage for images is handled in transformPlace)
  if (USE_FIREBASE_DATABASE && firebaseAvailable) {
    try {
      console.log('🔄 [getNearbyPlaces] Trying Firebase...');
      const firebasePlaces = await getNearbyPlacesFromFirebaseService(
        userLocation.latitude,
        userLocation.longitude,
        radiusKm
      );
      console.log('🔄 [getNearbyPlaces] Firebase returned:', firebasePlaces?.length || 0, 'places');
      
      if (firebasePlaces && firebasePlaces.length > 0) {
        const transformed = firebasePlaces.map(place => transformFirebasePlace(place, userLocation));
        console.log('✅ [getNearbyPlaces] Returning', transformed.length, 'places from Firebase');
        return transformed;
      }
    } catch (error) {
      console.warn('⚠️ [getNearbyPlaces] Error loading nearby places from Firebase, falling back to local data:', error);
    }
  }
  
  // Fallback to local data
  console.log('🔄 [getNearbyPlaces] Using local data...');
  const allPlaces = await loadPlaces(userLocation);
  const nearby = allPlaces.filter(place => place.distance && place.distance <= radiusKm);
  console.log('✅ [getNearbyPlaces] Found', nearby.length, 'nearby places from local data');
  return nearby;
};

// Get places within a specific radius (alternative implementation)
export const getPlacesWithinRadius = async (userLocation: Location, radiusKm: number): Promise<Place[]> => {
  const allPlaces = await loadPlaces(userLocation);
  return allPlaces.filter(place => {
    if (!place.distance) return false;
    return place.distance <= radiusKm;
  }).sort((a, b) => (a.distance || 0) - (b.distance || 0)); // Sort by distance
};

// Get explore places (not popular and not nearby)
export const getExplorePlaces = async (userLocation: Location = DEFAULT_LOCATION): Promise<Place[]> => {
  console.log('🔄 [getExplorePlaces] Starting...');
  const allPlaces = await loadPlaces(userLocation);
  console.log('🔄 [getExplorePlaces] Loaded', allPlaces.length, 'total places');
  const explore = allPlaces.filter(place => !place.featured && !place.isNearby);
  console.log('✅ [getExplorePlaces] Found', explore.length, 'explore places');
  return explore;
};

// Search places
export const searchPlaces = async (query: string, userLocation: Location = DEFAULT_LOCATION): Promise<Place[]> => {
  const allPlaces = await loadPlaces(userLocation);
  const lowercaseQuery = query.toLowerCase();

  return allPlaces.filter(place =>
    place.name.toLowerCase().includes(lowercaseQuery) ||
    place.description.toLowerCase().includes(lowercaseQuery) ||
    place.country.toLowerCase().includes(lowercaseQuery) ||
    place.location.address.toLowerCase().includes(lowercaseQuery)
  );
};

// Filter places
export const filterPlaces = (
  places: Place[],
  filters: {
    category?: string[];
    priceRange?: string[];
    rating?: number;
    distance?: number;
  }
): Place[] => {
  return places.filter(place => {
    // Category filter
    if (filters.category && filters.category.length > 0) {
      if (!filters.category.includes(place.category)) return false;
    }

    // Price range filter
    if (filters.priceRange && filters.priceRange.length > 0) {
      if (!filters.priceRange.includes(place.priceRange)) return false;
    }

    // Rating filter
    if (filters.rating && filters.rating > 0) {
      if (place.rating < filters.rating) return false;
    }

    // Distance filter
    if (filters.distance && filters.distance > 0) {
      if (place.distance && place.distance > filters.distance) return false;
    }

    return true;
  });
};

// Get unique countries
export const getCountries = async (userLocation: Location = DEFAULT_LOCATION): Promise<string[]> => {
  const allPlaces = await loadPlaces(userLocation);
  const countries = allPlaces.map(place => place.country);
  return [...new Set(countries)].sort();
};

// Filter marker function - maps category names to place_type codes
export const filterMarker = (category: string): string => {
  let place_type = "all";
  switch (category) {
    case "beach":
      place_type = "B";
      break;
    case "camps":
    case "camping": // Support both names
      place_type = "C";
      break;
    case "hotel":
      place_type = "E";
      break;
    case "sauna":
      place_type = "F";
      break;
    default:
      place_type = "all";
      break;
  }
  return place_type;
};

// Get place statistics
export const getPlaceStats = async (userLocation: Location = DEFAULT_LOCATION) => {
  const allPlaces = await loadPlaces(userLocation);
  const countries = await getCountries(userLocation);

  return {
    total: allPlaces.length,
    byCategory: {
      beach: allPlaces.filter(p => p.category === 'beach').length,
      camps: allPlaces.filter(p => p.category === 'camps').length,
      hotel: allPlaces.filter(p => p.category === 'hotel').length,
      sauna: allPlaces.filter(p => p.category === 'sauna').length,
      other: allPlaces.filter(p => p.category === 'other').length,
    },
    featured: allPlaces.filter(p => p.featured).length,
    nearby: allPlaces.filter(p => p.isNearby).length,
    countries: countries.length,
  };
};

// ============================================================================
// Google Places API Integration
// ============================================================================

/**
 * Transform Google Place to our Place interface
 */
const transformGooglePlace = (googlePlace: GooglePlace, userLocation: Location = DEFAULT_LOCATION): Place => {
  const latitude = googlePlace.location?.latitude || 0;
  const longitude = googlePlace.location?.longitude || 0;

  // Calculate distance from user location
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    latitude,
    longitude
  );

  // Determine category from Google types
  const category = getCategoryFromGoogleTypes(googlePlace.types || []);

  // Map price level to our price range
  const priceRange = mapGooglePriceLevel(googlePlace.priceLevel);

  // Note: After Firebase integration, we no longer use Google Places API for images
  // Use default category images instead. If this place exists in Firebase, 
  // it should be loaded from Firebase which will have Firebase Storage images.
  const mainImage = getDefaultImageForCategory(category);
  const images = [mainImage];

  // Debug logging (only for errors)
  // Removed verbose logging for each place transformation

  // Extract country from formatted address
  const country = extractCountryFromAddress(googlePlace.formattedAddress || '');

  // Determine if place is nearby (within 50km)
  const isNearby = distance <= DEFAULT_NEARBY_RADIUS;

  return {
    id: googlePlace.id,
    googlePlaceId: googlePlace.id,
    name: googlePlace.displayName?.text || 'Unknown Place',
    description: googlePlace.editorialSummary?.text || 'No description available',
    image: mainImage,
    images,
    location: {
      latitude,
      longitude,
      address: googlePlace.formattedAddress || '',
    },
    category,
    rating: googlePlace.rating || 0,
    priceRange,
    amenities: googlePlace.types || [],
    isPopular: (googlePlace.rating || 0) >= 4.0,
    isNearby,
    distance: Math.round(distance * 10) / 10,
    country,
    placeType: googlePlace.types?.[0] || 'unknown',
    featured: false,
    source: 'google',
    phone: googlePlace.nationalPhoneNumber || googlePlace.internationalPhoneNumber,
    website: googlePlace.websiteUri,
  };
};

/**
 * Determine category from Google place types
 */
const getCategoryFromGoogleTypes = (types: string[]): 'beach' | 'camps' | 'hotel' | 'sauna' | 'other' => {
  const typesString = types.join(' ').toLowerCase();

  if (typesString.includes('beach') || typesString.includes('seaside')) {
    return 'beach';
  }
  if (typesString.includes('campground') || typesString.includes('rv_park') || typesString.includes('camping')) {
    return 'camps';
  }
  if (typesString.includes('lodging') || typesString.includes('hotel') || typesString.includes('resort')) {
    return 'hotel';
  }
  if (typesString.includes('spa') || typesString.includes('sauna') || typesString.includes('wellness')) {
    return 'sauna';
  }

  return 'other';
};

/**
 * Map Google price level to our price range
 */
const mapGooglePriceLevel = (priceLevel?: string): '$' | '$$' | '$$$' | '$$$$' => {
  if (!priceLevel) return '$$';

  switch (priceLevel) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$';
    case 'PRICE_LEVEL_MODERATE':
      return '$$';
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$';
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$';
    default:
      return '$$';
  }
};

// Note: getDefaultImageForCategory is defined earlier in the file for Firebase places

/**
 * Extract country from formatted address
 */
const extractCountryFromAddress = (address: string): string => {
  if (!address) return 'Unknown';

  // Country is typically the last part of the address
  const parts = address.split(',').map(part => part.trim());
  return parts[parts.length - 1] || 'Unknown';
};

// ============================================================================
// Enhanced API Functions using Google Places API
// ============================================================================

/**
 * Get nearby places using Google Places API
 * This replaces the local JSON data for nearby searches
 */
export const getNearbyPlacesFromAPI = async (
  userLocation: Location,
  radiusKm: number = DEFAULT_NEARBY_RADIUS
): Promise<Place[]> => {
  try {
    // Validate API key
    if (!validateApiKey()) {
      console.warn('Google Places API not configured, falling back to local data');
      return getNearbyPlaces(userLocation, radiusKm);
    }

    // Search for naturist places nearby
    const googlePlaces = await searchNaturistPlaces(userLocation, undefined, radiusKm * 1000);

    // Transform to our Place interface
    const places = googlePlaces.map(googlePlace => transformGooglePlace(googlePlace, userLocation));

    // Filter by distance and sort
    return places
      .filter(place => place.distance && place.distance <= radiusKm)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (error) {
    console.error('Error fetching nearby places from Google API:', error);
    // Fallback to local data
    return getNearbyPlaces(userLocation, radiusKm);
  }
};

/**
 * Search places using Google Places API
 * This provides real-time search results from Google
 */
export const searchPlacesFromAPI = async (
  query: string,
  userLocation: Location = DEFAULT_LOCATION
): Promise<Place[]> => {
  try {
    // Validate API key
    if (!validateApiKey()) {
      console.warn('Google Places API not configured, falling back to local search');
      return searchPlaces(query, userLocation);
    }

    // Enhance query with naturist keywords (boolean operators are not supported in Places API v1)
    // Use simple space-separated terms to broaden matching
    const enhancedQuery = `${query} naturist nudist FKK`;

    // Search using Google Places API
    const googlePlaces = await searchPlacesByText({
      query: enhancedQuery,
      location: userLocation,
      maxResults: 20,
    });

    // Transform to our Place interface
    const places = googlePlaces.map(googlePlace => transformGooglePlace(googlePlace, userLocation));

    // Sort by relevance (rating and distance)
    return places.sort((a, b) => {
      const scoreA = (a.rating * 0.7) + ((100 - (a.distance || 100)) * 0.3);
      const scoreB = (b.rating * 0.7) + ((100 - (b.distance || 100)) * 0.3);
      return scoreB - scoreA;
    });
  } catch (error) {
    console.error('Error searching places from Google API:', error);
    // Fallback to local search
    return searchPlaces(query, userLocation);
  }
};

/**
 * Get places by category using Google Places API
 */
export const getPlacesByCategoryFromAPI = async (
  category: string,
  userLocation: Location = DEFAULT_LOCATION,
  radiusKm: number = 100
): Promise<Place[]> => {
  try {
    // Validate API key
    if (!validateApiKey()) {
      console.warn('Google Places API not configured, falling back to local data');
      return getPlacesByCategory(category, userLocation);
    }

    // Search for naturist places of specific category
    const googlePlaces = await searchNaturistPlaces(userLocation, category, radiusKm * 1000);

    // Transform to our Place interface
    const places = googlePlaces.map(googlePlace => transformGooglePlace(googlePlace, userLocation));

    // Filter by category
    return places
      .filter(place => place.category === category)
      .sort((a, b) => b.rating - a.rating);
  } catch (error) {
    console.error('Error fetching places by category from Google API:', error);
    // Fallback to local data
    return getPlacesByCategory(category, userLocation);
  }
};

/**
 * Hybrid approach: Merge local and Google Places results
 */
export const getHybridNearbyPlaces = async (
  userLocation: Location,
  radiusKm: number = DEFAULT_NEARBY_RADIUS
): Promise<Place[]> => {
  try {
    // Get both local and Google results
    const localPlaces = await getNearbyPlaces(userLocation, radiusKm);

    let googlePlaces: Place[] = [];
    if (validateApiKey()) {
      try {
        const googleResults = await searchNaturistPlaces(userLocation, undefined, radiusKm * 1000);
        googlePlaces = googleResults.map(googlePlace => transformGooglePlace(googlePlace, userLocation));
      } catch (error) {
        console.error('Error fetching Google places:', error);
      }
    }

    // Merge results, removing duplicates based on proximity
    const allPlaces = [...localPlaces, ...googlePlaces];
    const uniquePlaces = removeDuplicatesByProximity(allPlaces);

    // Sort by distance
    return uniquePlaces
      .filter(place => place.distance && place.distance <= radiusKm)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (error) {
    console.error('Error in hybrid nearby places:', error);
    return await getNearbyPlaces(userLocation, radiusKm);
  }
};

/**
 * Remove duplicate places based on proximity (within 100m)
 */
const removeDuplicatesByProximity = (places: Place[]): Place[] => {
  const unique: Place[] = [];
  const PROXIMITY_THRESHOLD = 0.1; // 100 meters in km

  places.forEach(place => {
    const isDuplicate = unique.some(existingPlace => {
      const dist = calculateDistance(
        place.location.latitude,
        place.location.longitude,
        existingPlace.location.latitude,
        existingPlace.location.longitude
      );
      return dist < PROXIMITY_THRESHOLD;
    });

    if (!isDuplicate) {
      unique.push(place);
    }
  });

  return unique;
};
