/**
 * Google Places API (New) Service
 * Uses the new Google Places API (v1)
 * Documentation: https://developers.google.com/maps/documentation/places/web-service/op-overview
 */

import axios, { AxiosError } from 'axios';
import { GOOGLE_PLACES_API_KEY, PLACES_API_CONFIG, NATURIST_KEYWORDS, CATEGORY_KEYWORDS } from '../config/environment';
import { Location } from './locationService';

// Google Places API Response Types
export interface GooglePlace {
  id: string;
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  displayName?: {
    text: string;
    languageCode?: string;
  };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  photos?: Array<{
    name: string;
    widthPx?: number;
    heightPx?: number;
  }>;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  editorialSummary?: {
    text: string;
    languageCode?: string;
  };
  businessStatus?: string;
}

export interface GooglePlacesSearchResponse {
  places: GooglePlace[];
  nextPageToken?: string;
}

export interface NearbySearchParams {
  location: Location;
  radius?: number; // in meters
  keyword?: string;
  type?: string;
  maxResults?: number;
}

export interface TextSearchParams {
  query: string;
  location?: Location;
  radius?: number;
  maxResults?: number;
}

/**
 * Performs a nearby search using Google Places API (New)
 */
export const searchNearbyPlaces = async (
  params: NearbySearchParams
): Promise<GooglePlace[]> => {
  try {
    const { location, radius = PLACES_API_CONFIG.defaultRadius, keyword, maxResults = PLACES_API_CONFIG.maxResults } = params;

    // Build the request body for the new API
    const requestBody: any = {
      includedTypes: ['tourist_attraction', 'campground', 'lodging', 'spa', 'beach'],
      maxResultCount: maxResults,
      locationRestriction: {
        circle: {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          radius: radius,
        },
      },
      languageCode: PLACES_API_CONFIG.language,
    };

    // Add keyword search if provided
    if (keyword) {
      requestBody.includedPrimaryTypes = [];
      requestBody.textQuery = keyword;
    }

    const response = await axios.post<GooglePlacesSearchResponse>(
      `${PLACES_API_CONFIG.baseUrl}/places:searchNearby`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.types,places.editorialSummary,places.websiteUri',
        },
      }
    );

    return response.data.places || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error('Google Places API Error:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
      
      if (axiosError.response?.status === 403) {
        console.error('API Key Error: Please check your Google Places API key and ensure the Places API (New) is enabled');
      }
    } else {
      console.error('Unexpected error in searchNearbyPlaces:', error);
    }
    return [];
  }
};

/**
 * Performs a text search using Google Places API (New)
 */
export const searchPlacesByText = async (
  params: TextSearchParams
): Promise<GooglePlace[]> => {
  try {
    const { query, location, radius, maxResults = PLACES_API_CONFIG.maxResults } = params;

    const requestBody: any = {
      textQuery: query,
      maxResultCount: maxResults,
      languageCode: PLACES_API_CONFIG.language,
    };

    // Add location bias if provided
    if (location) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          radius: radius || PLACES_API_CONFIG.defaultRadius,
        },
      };
    }

    const response = await axios.post<GooglePlacesSearchResponse>(
      `${PLACES_API_CONFIG.baseUrl}/places:searchText`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.types,places.editorialSummary,places.websiteUri,places.nationalPhoneNumber',
        },
      }
    );

    return response.data.places || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error('Google Places Text Search Error:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
    } else {
      console.error('Unexpected error in searchPlacesByText:', error);
    }
    return [];
  }
};

/**
 * Get place details by place ID
 */
export const getPlaceDetails = async (placeId: string): Promise<GooglePlace | null> => {
  try {
    const response = await axios.get<GooglePlace>(
      `${PLACES_API_CONFIG.baseUrl}/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': '*',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
};

/**
 * Get photo URL from Google Places photo reference
 */
export const getPhotoUrl = (photoName: string, maxWidth: number = 400): string => {
  if (!photoName) {
    console.warn('⚠️ getPhotoUrl: photoName is empty');
    return '';
  }
  
  // New API photo URL format: https://places.googleapis.com/v1/{photoName}/media?key=...&maxWidthPx=...
  // photoName format: places/{place_id}/photos/{photo_reference}
  const photoUrl = `${PLACES_API_CONFIG.baseUrl}/${photoName}/media?key=${GOOGLE_PLACES_API_KEY}&maxWidthPx=${maxWidth}`;
  
  if (__DEV__) {
    console.log('📷 Generated photo URL:', photoUrl);
    console.log('📷 Photo name:', photoName);
    console.log('📷 Max width:', maxWidth);
  }
  
  return photoUrl;
};

/**
 * Search for naturist places specifically
 */
export const searchNaturistPlaces = async (
  location: Location,
  category?: string,
  radius?: number
): Promise<GooglePlace[]> => {
  try {
    // Combine naturist keywords with category-specific keywords
    let searchQueries = [...NATURIST_KEYWORDS];
    
    if (category && CATEGORY_KEYWORDS[category]) {
      searchQueries = NATURIST_KEYWORDS.flatMap(naturistKeyword =>
        CATEGORY_KEYWORDS[category].map(categoryKeyword => 
          `${naturistKeyword} ${categoryKeyword}`
        )
      );
    }

    // Search with multiple keywords and combine results
    const allResults: GooglePlace[] = [];
    const seenIds = new Set<string>();

    for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries to avoid rate limits
      const results = await searchPlacesByText({
        query,
        location,
        radius: radius || PLACES_API_CONFIG.defaultRadius,
        maxResults: 10,
      });

      // Add unique results
      results.forEach(place => {
        if (!seenIds.has(place.id)) {
          seenIds.add(place.id);
          allResults.push(place);
        }
      });
    }

    return allResults;
  } catch (error) {
    console.error('Error searching naturist places:', error);
    return [];
  }
};

/**
 * Validate API key configuration
 */
export const validateApiKey = (): boolean => {
  const apiKey = GOOGLE_PLACES_API_KEY as string;
  const placeholderKey = 'YOUR_GOOGLE_PLACES_API_KEY_HERE';
  
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('YOUR_') || apiKey === placeholderKey) {
    console.warn('⚠️ Google Places API key is not configured. Please add your API key to src/config/environment.ts');
    return false;
  }
  return true;
};
