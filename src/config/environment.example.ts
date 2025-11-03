/**
 * Environment Configuration Example
 * 
 * Copy this file to environment.ts and add your actual API keys
 * DO NOT commit environment.ts to version control
 */

export const GOOGLE_PLACES_API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY_HERE';

// API Configuration
export const PLACES_API_CONFIG = {
  // Google Places API (New) base URL
  baseUrl: 'https://places.googleapis.com/v1',
  
  // Default radius for nearby search in meters (50km = 50000 meters)
  defaultRadius: 50000,
  
  // Maximum results per request
  maxResults: 20,
  
  // Language for results
  language: 'en',
};

// Naturist place types mapping for Google Places API
export const NATURIST_KEYWORDS = [
  'naturist',
  'nudist',
  'naturism',
  'nudism',
  'clothing optional',
  'nude beach',
  'FKK', // German term for naturism
];

// Category mappings
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  beach: ['beach', 'plage', 'strand', 'spiaggia'],
  camps: ['campsite', 'camping', 'campground', 'rv park'],
  hotel: ['hotel', 'resort', 'accommodation', 'lodging'],
  sauna: ['sauna', 'spa', 'wellness', 'thermal bath'],
};
