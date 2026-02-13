/**
 * Image Preloader Service
 * Intelligently preloads images for places that users are likely to see next
 * based on their current screen, navigation patterns, and available data
 */

import { Place } from '../types';
import { Location } from './locationService';
import { 
  getNearbyPlacesFromAPI, 
  getPlacesByCategoryFromAPI, 
  searchPlacesFromAPI,
  getPopularPlaces,
  getExplorePlaces 
} from './placesService';

export interface PreloadConfig {
  maxImagesPerScreen: number;
  preloadRadius: number; // km
  cacheSize: number; // max number of images to cache
  preloadDelay: number; // ms delay before starting preload
}

export interface PreloadContext {
  currentScreen: 'home' | 'explore' | 'map' | 'search';
  userLocation: Location;
  searchQuery?: string;
  selectedCategory?: string;
  currentPlaces: Place[];
  navigationHistory: string[];
}

export interface PreloadedImage {
  url: string;
  placeId: string;
  priority: 'high' | 'medium' | 'low';
  loaded: boolean;
  error: boolean;
  timestamp: number;
}

class ImagePreloaderService {
  private config: PreloadConfig = {
    maxImagesPerScreen: 20,
    preloadRadius: 100, // 100km radius
    cacheSize: 100,
    preloadDelay: 500,
  };

  private imageCache = new Map<string, PreloadedImage>();
  private preloadQueue: string[] = [];
  private isPreloading = false;
  private preloadTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Main method to preload images based on current context
   */
  async preloadImagesForContext(context: PreloadContext): Promise<void> {
    try {
      // Clear any existing preload timeouts
      this.clearPreloadTimeouts();

      // Get predicted places based on context
      const predictedPlaces = await this.predictPlacesForContext(context);
      
      // Extract image URLs from predicted places
      const imageUrls = this.extractImageUrls(predictedPlaces);
      
      // Queue images for preloading with priority
      this.queueImagesForPreload(imageUrls, context);
      
      // Start preloading after delay
      setTimeout(() => {
        this.startPreloading();
      }, this.config.preloadDelay);

    } catch (error) {
      console.error('Error in preloadImagesForContext:', error);
    }
  }

  /**
   * Preload images only for the given places (no prediction, no API).
   * Use when e.g. user has selected categories and fetched 20 more places – preload only those.
   */
  async preloadImagesForPlaces(places: Place[]): Promise<void> {
    if (!places?.length) return;
    try {
      this.clearPreloadTimeouts();
      const urls = this.extractImageUrls(places);
      if (urls.length === 0) return;
      const minimalContext: PreloadContext = {
        currentScreen: 'map',
        userLocation: { latitude: 0, longitude: 0 },
        currentPlaces: places,
        navigationHistory: [],
      };
      this.queueImagesForPreload(urls, minimalContext);
      setTimeout(() => {
        this.startPreloading();
      }, this.config.preloadDelay);
    } catch (error) {
      if (__DEV__) console.warn('preloadImagesForPlaces:', error);
    }
  }

  /**
   * Predict which places user is likely to see next
   */
  private async predictPlacesForContext(context: PreloadContext): Promise<Place[]> {
    const { currentScreen, userLocation, searchQuery, selectedCategory, currentPlaces } = context;
    
    let predictedPlaces: Place[] = [];

    try {
      switch (currentScreen) {
        case 'home':
          // On home screen, preload for likely next actions
          predictedPlaces = await this.predictForHomeScreen(userLocation);
          break;
          
        case 'explore':
          // On explore screen, preload for category filters and "view all" actions
          predictedPlaces = await this.predictForExploreScreen(userLocation, selectedCategory);
          break;
          
        case 'map':
          // On map screen, use existing places first, then supplement with API calls if needed
          predictedPlaces = await this.predictForMapScreen(userLocation, currentPlaces);
          break;
          
        case 'search':
          // On search screen, preload for search results
          if (searchQuery) {
            predictedPlaces = await this.predictForSearchScreen(userLocation, searchQuery);
          }
          break;
      }

      // Limit results to prevent excessive API calls
      return predictedPlaces.slice(0, this.config.maxImagesPerScreen);
      
    } catch (error) {
      console.error('Error predicting places:', error);
      return [];
    }
  }

  /**
   * Predict places for home screen
   * Users likely to tap "View All" buttons or search
   */
  private async predictForHomeScreen(userLocation: Location): Promise<Place[]> {
    const places: Place[] = [];
    
    try {
      // Get popular places (likely to be in "View All" sections)
      const popularPlaces = await getPopularPlaces(userLocation);
      if (popularPlaces && Array.isArray(popularPlaces)) {
        places.push(...popularPlaces.slice(0, 10));
      }

      // Get explore places (likely to be in "Explore" section)
      const explorePlaces = await getExplorePlaces(userLocation);
      if (explorePlaces && Array.isArray(explorePlaces)) {
        places.push(...explorePlaces.slice(0, 10));
      }

      // Get nearby places for each category (likely "View All" content)
      const categories = ['beach', 'camps', 'hotel', 'sauna'];
      for (const category of categories) {
        try {
          const categoryPlaces = await getPlacesByCategoryFromAPI(category, userLocation, 50);
          if (categoryPlaces && Array.isArray(categoryPlaces)) {
            places.push(...categoryPlaces.slice(0, 5));
          }
        } catch (error) {
          console.warn(`Error fetching ${category} places for preload:`, error);
        }
      }

    } catch (error) {
      console.error('Error in predictForHomeScreen:', error);
    }

    return this.removeDuplicates(places);
  }

  /**
   * Predict places for explore screen
   * Users likely to change filters or view different categories
   */
  private async predictForExploreScreen(userLocation: Location, selectedCategory?: string): Promise<Place[]> {
    const places: Place[] = [];
    
    try {
      // If a category is selected, preload other categories
      const categories = ['beach', 'camps', 'hotel', 'sauna', 'other'];
      const categoriesToPreload = selectedCategory 
        ? categories.filter(cat => cat !== selectedCategory)
        : categories;

      for (const category of categoriesToPreload) {
        try {
          const categoryPlaces = await getPlacesByCategoryFromAPI(category, userLocation, 100);
          if (categoryPlaces && Array.isArray(categoryPlaces)) {
            places.push(...categoryPlaces.slice(0, 8));
          }
        } catch (error) {
          console.warn(`Error fetching ${category} places for preload:`, error);
        }
      }

      // Also preload nearby places for potential filter changes
      const nearbyPlaces = await getNearbyPlacesFromAPI(userLocation, 50);
      if (nearbyPlaces && Array.isArray(nearbyPlaces)) {
        places.push(...nearbyPlaces.slice(0, 10));
      }

    } catch (error) {
      console.error('Error in predictForExploreScreen:', error);
    }

    return this.removeDuplicates(places);
  }

  /**
   * Predict places for map screen
   * Users likely to tap markers or zoom to different areas
   * Uses existing places data first to avoid unnecessary API calls
   */
  private async predictForMapScreen(userLocation: Location, existingPlaces: Place[] = []): Promise<Place[]> {
    const places: Place[] = [];
    
    try {
      // First, use existing places from the map (already loaded)
      // This avoids making API calls when we already have data
      if (existingPlaces && existingPlaces.length > 0) {
        // Use existing places, prioritizing those with images
        const placesWithImages = existingPlaces
          .filter(place => place.image || (place.images && place.images.length > 0))
          .slice(0, this.config.maxImagesPerScreen);
        places.push(...placesWithImages);
        
        // If we have enough places, skip API calls
        if (places.length >= this.config.maxImagesPerScreen) {
          return this.removeDuplicates(places);
        }
      }

      // Only make API calls if we need more places
      // Limit to a single API call to reduce errors
      try {
        const nearbyPlaces = await getNearbyPlacesFromAPI(userLocation, 50);
        if (nearbyPlaces && Array.isArray(nearbyPlaces)) {
          places.push(...nearbyPlaces.slice(0, 10));
        }
      } catch (error) {
        // Silently fail - we already have places from existing data
        // Only log if we have no existing places
        if (existingPlaces.length === 0) {
          console.warn('⚠️ Could not fetch additional places for preloading:', error);
        }
      }

    } catch (error) {
      // Only log error if we have no existing places to fall back to
      if (existingPlaces.length === 0) {
        console.error('Error in predictForMapScreen:', error);
      }
    }

    return this.removeDuplicates(places);
  }

  /**
   * Predict places for search screen
   * Users likely to refine search or view results
   */
  private async predictForSearchScreen(userLocation: Location, searchQuery: string): Promise<Place[]> {
    const places: Place[] = [];
    
    try {
      // Preload variations of the search query
      const queryVariations = [
        searchQuery,
        `${searchQuery} naturist`,
        `${searchQuery} nudist`,
        `${searchQuery} beach`,
        `${searchQuery} resort`,
      ];

      for (const query of queryVariations) {
        try {
          const searchResults = await searchPlacesFromAPI(query, userLocation);
          if (searchResults && Array.isArray(searchResults)) {
            places.push(...searchResults.slice(0, 5));
          }
        } catch (error) {
          console.warn(`Error searching for "${query}":`, error);
        }
      }

      // Also preload nearby places as fallback
      const nearbyPlaces = await getNearbyPlacesFromAPI(userLocation, 50);
      if (nearbyPlaces && Array.isArray(nearbyPlaces)) {
        places.push(...nearbyPlaces.slice(0, 10));
      }

    } catch (error) {
      console.error('Error in predictForSearchScreen:', error);
    }

    return this.removeDuplicates(places);
  }

  /**
   * Extract image URLs from places
   */
  private extractImageUrls(places: Place[]): string[] {
    const urls: string[] = [];
    
    places.forEach(place => {
      // Add main image
      if (place.image && this.isValidImageUrl(place.image)) {
        urls.push(place.image);
      }
      
      // Add additional images (limit to first 3 to avoid excessive preloading)
      if (place.images && place.images.length > 0) {
        place.images.slice(0, 3).forEach(imageUrl => {
          if (this.isValidImageUrl(imageUrl)) {
            urls.push(imageUrl);
          }
        });
      }
    });

    return urls;
  }

  /**
   * Check if URL is a valid image URL
   */
  private isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    // Basic validation - must be HTTP URL
    if (!url.startsWith('http')) return false;
    
    // Check if it's a valid image URL (has image extension or is from known image services)
    const isValidImage = url.includes('.jpg') || 
                        url.includes('.jpeg') || 
                        url.includes('.png') || 
                        url.includes('.webp') ||
                        url.includes('googleapis.com') || // Google Places photos
                        url.includes('unsplash.com') ||   // Unsplash images
                        url.includes('images.unsplash.com'); // Unsplash CDN
    
    return isValidImage;
  }

  /**
   * Queue images for preloading with priority
   */
  private queueImagesForPreload(imageUrls: string[], context: PreloadContext): void {
    imageUrls.forEach((url, index) => {
      // Skip if already cached
      if (this.imageCache.has(url)) return;
      
      // Determine priority based on context and index
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (index < 5) priority = 'high';
      else if (index < 15) priority = 'medium';
      
      // Add to cache as pending
      this.imageCache.set(url, {
        url,
        placeId: '', // Will be filled when image loads
        priority,
        loaded: false,
        error: false,
        timestamp: Date.now(),
      });
      
      // Add to preload queue
      this.preloadQueue.push(url);
    });

    // Sort queue by priority
    this.preloadQueue.sort((a, b) => {
      const imageA = this.imageCache.get(a);
      const imageB = this.imageCache.get(b);
      if (!imageA || !imageB) return 0;
      
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[imageB.priority] - priorityOrder[imageA.priority];
    });
  }

  /**
   * Start preloading images from queue
   */
  private async startPreloading(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) return;
    
    this.isPreloading = true;
    
    // Process queue in batches to avoid overwhelming the network
    const batchSize = 3;
    const batches = [];
    
    for (let i = 0; i < this.preloadQueue.length; i += batchSize) {
      batches.push(this.preloadQueue.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      await this.preloadBatch(batch);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isPreloading = false;
    this.preloadQueue = [];
  }

  /**
   * Preload a batch of images
   */
  private async preloadBatch(urls: string[]): Promise<void> {
    const promises = urls.map(url => this.preloadSingleImage(url));
    await Promise.allSettled(promises);
  }

  /**
   * Preload a single image
   */
  private async preloadSingleImage(url: string): Promise<void> {
    const cachedImage = this.imageCache.get(url);
    if (!cachedImage || cachedImage.loaded) return;
    
    try {
      // Use Image.prefetch for React Native
      const { Image } = require('react-native');
      await Image.prefetch(url);
      
      // Update cache
      cachedImage.loaded = true;
      cachedImage.error = false;
      this.imageCache.set(url, cachedImage);
      
      console.log(`✅ Preloaded image: ${url.substring(0, 50)}...`);
      
    } catch (error) {
      console.warn(`❌ Failed to preload image: ${url.substring(0, 50)}...`, error);
      
      // Update cache with error
      cachedImage.loaded = false;
      cachedImage.error = true;
      this.imageCache.set(url, cachedImage);
    }
  }

  /**
   * Get preloaded image URL (returns immediately if cached)
   */
  getPreloadedImageUrl(url: string): string | null {
    const cachedImage = this.imageCache.get(url);
    if (cachedImage && cachedImage.loaded && !cachedImage.error) {
      return url;
    }
    return null;
  }

  /**
   * Check if image is preloaded
   */
  isImagePreloaded(url: string): boolean {
    const cachedImage = this.imageCache.get(url);
    return !!(cachedImage && cachedImage.loaded && !cachedImage.error);
  }

  /**
   * Clear preload timeouts
   */
  private clearPreloadTimeouts(): void {
    this.preloadTimeouts.forEach(timeout => clearTimeout(timeout));
    this.preloadTimeouts.clear();
  }

  /**
   * Remove duplicate places
   */
  private removeDuplicates(places: Place[]): Place[] {
    const seen = new Set<string>();
    return places.filter(place => {
      if (seen.has(place.id)) return false;
      seen.add(place.id);
      return true;
    });
  }

  /**
   * Clear cache (for memory management)
   */
  clearCache(): void {
    this.imageCache.clear();
    this.preloadQueue = [];
    this.clearPreloadTimeouts();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { total: number; loaded: number; errors: number } {
    const total = this.imageCache.size;
    let loaded = 0;
    let errors = 0;
    
    this.imageCache.forEach(image => {
      if (image.loaded) loaded++;
      if (image.error) errors++;
    });
    
    return { total, loaded, errors };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PreloadConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const imagePreloader = new ImagePreloaderService();

// Export types
export type { PreloadConfig, PreloadContext, PreloadedImage };
