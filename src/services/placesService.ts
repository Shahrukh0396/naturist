import { RawPlace, Place } from '../types';

/**
 * Load places data - ALWAYS prefers verified file with Google Places enrichment
 * Verified file includes: verified data, Google Places photos, ratings, addresses
 * Falls back to original file only if verified doesn't exist
 */
let placesData: RawPlace[];
try {
  // PRIMARY: Use verified file (contains Google Places verified data + images)
  placesData = require('../utils/natureism.places.verified.json');
  if (__DEV__) {
    console.log('✅ Using verified places data (with Google Places enrichment)');
  }
} catch (e) {
  // FALLBACK: Use original file only if verified doesn't exist
  placesData = require('../utils/natureism.places.json');
  if (__DEV__) {
    console.warn('⚠️  Verified file not found, using original places data. Run: npm run verify-places');
  }
}
import { Location, DEFAULT_LOCATION, calculateDistance } from './locationService';
import { 
  GooglePlace, 
  searchNearbyPlaces, 
  searchPlacesByText, 
  searchNaturistPlaces,
  getPhotoUrl,
  validateApiKey 
} from './googlePlacesService';

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

  // Use first image as main image, fallback to a default
  const getMainImage = () => {
    // Try to get a valid image from the images array
    if (rawPlace.images && rawPlace.images.length > 0) {
      console.log(`Checking ${rawPlace.images.length} images for place: ${rawPlace.title}`);
      // Find the first valid image URL
      for (let i = 0; i < rawPlace.images.length; i++) {
        const imageUrl = rawPlace.images[i];
        console.log(`Image ${i}:`, imageUrl, 'Type:', typeof imageUrl, 'Starts with http:', imageUrl?.startsWith('http'));
        
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
          console.log(`Using image ${i} for place: ${rawPlace.title}`);
          return imageUrl;
        }
      }
      console.log(`No valid images found for place: ${rawPlace.title}`);
    } else {
      console.log(`No images array for place: ${rawPlace.title}`);
    }
    
    // Fallback to category-specific default images
    const categoryDefaults = {
      'beach': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
      'camps': 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=400',
      'hotel': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
      'sauna': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
      'other': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    };
    
    const fallbackImage = categoryDefaults[category] || categoryDefaults['other'];
    console.log(`Using fallback image for place: ${rawPlace.title} - ${fallbackImage}`);
    return fallbackImage;
  };
  
  const mainImage = getMainImage();
  
  // Debug logging for image issues
  if (!rawPlace.images || rawPlace.images.length === 0) {
    console.log(`No images for place: ${rawPlace.title}`);
  } else {
    console.log(`Found ${rawPlace.images.length} images for place: ${rawPlace.title}`);
    console.log('First image URL:', rawPlace.images[0]);
  }

  return {
    id: rawPlace._id.$oid,
    name: rawPlace.title,
    description: rawPlace.description || 'No description available',
    image: mainImage,
    images: rawPlace.images || [],
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

// Load and transform all places
export const loadPlaces = (userLocation: Location = DEFAULT_LOCATION): Place[] => {
  const rawPlaces = placesData as RawPlace[];
  
  // Filter out deleted or inactive places
  const activePlaces = rawPlaces.filter(place => 
    !place.deleted && 
    place.state === 'Active' && 
    place.lat && 
    place.lng &&
    place.title
  );

  // Transform all places
  const transformedPlaces = activePlaces.map(place => transformPlace(place, userLocation));

  // Sort by featured first, then by rating
  return transformedPlaces.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return b.rating - a.rating;
  });
};

// Get places by category
export const getPlacesByCategory = (category: string, userLocation: Location = DEFAULT_LOCATION): Place[] => {
  const allPlaces = loadPlaces(userLocation);
  return allPlaces.filter(place => place.category === category);
};

// Get popular places (featured or high-rated)
export const getPopularPlaces = (userLocation: Location = DEFAULT_LOCATION): Place[] => {
  const allPlaces = loadPlaces(userLocation);
  return allPlaces.filter(place => place.featured || place.rating >= 4.0);
};

// Get nearby places
export const getNearbyPlaces = (userLocation: Location = DEFAULT_LOCATION, radiusKm: number = DEFAULT_NEARBY_RADIUS): Place[] => {
  const allPlaces = loadPlaces(userLocation);
  return allPlaces.filter(place => place.distance && place.distance <= radiusKm);
};

// Get places within a specific radius (alternative implementation)
export const getPlacesWithinRadius = (userLocation: Location, radiusKm: number): Place[] => {
  const allPlaces = loadPlaces(userLocation);
  return allPlaces.filter(place => {
    if (!place.distance) return false;
    return place.distance <= radiusKm;
  }).sort((a, b) => (a.distance || 0) - (b.distance || 0)); // Sort by distance
};

// Get explore places (not popular and not nearby)
export const getExplorePlaces = (userLocation: Location = DEFAULT_LOCATION): Place[] => {
  const allPlaces = loadPlaces(userLocation);
  return allPlaces.filter(place => !place.featured && !place.isNearby);
};

// Search places
export const searchPlaces = (query: string, userLocation: Location = DEFAULT_LOCATION): Place[] => {
  const allPlaces = loadPlaces(userLocation);
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
export const getCountries = (userLocation: Location = DEFAULT_LOCATION): string[] => {
  const allPlaces = loadPlaces(userLocation);
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
export const getPlaceStats = (userLocation: Location = DEFAULT_LOCATION) => {
  const allPlaces = loadPlaces(userLocation);
  
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
    countries: getCountries(userLocation).length,
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

  // Get main image from photos
  // Google Places API returns photo objects with 'name' property
  // We convert the photo name to a full URL using getPhotoUrl()
  const mainImage = googlePlace.photos && googlePlace.photos.length > 0
    ? getPhotoUrl(googlePlace.photos[0].name, 400)
    : getDefaultImageForCategory(category);

  // Get all image URLs (convert all photo names to URLs)
  const images = googlePlace.photos
    ? googlePlace.photos.map(photo => getPhotoUrl(photo.name, 800))
    : [mainImage];

  // Debug logging
  if (__DEV__) {
    console.log('🔄 Transforming Google Place:', googlePlace.displayName?.text);
    console.log('📸 Photos from API:', googlePlace.photos?.length || 0);
    if (googlePlace.photos && googlePlace.photos.length > 0) {
      console.log('📸 First photo name:', googlePlace.photos[0].name);
      console.log('📸 Generated main image URL:', mainImage);
    }
  }

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

/**
 * Get default image for a category
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
    const localPlaces = getNearbyPlaces(userLocation, radiusKm);
    
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
    return getNearbyPlaces(userLocation, radiusKm);
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
