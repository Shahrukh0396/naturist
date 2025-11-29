# Optimized Data Loading Pipeline

## Overview

This implementation provides an optimized, offline-first data-loading pipeline that makes the UI feel instant on every app launch. It uses MMKV for high-performance caching, Firebase Realtime Database for data sync, and Firebase Storage for images.

## Key Features

✅ **Instant Cached Load** - Load places from local storage (MMKV/AsyncStorage) before Firebase fetch  
✅ **Firebase Realtime DB Sync** - Fetch latest data in background and convert to array models  
✅ **Firebase Storage Image URLs** - Batch fetch image download URLs (batches of 10)  
✅ **Image Preloading** - Use FastImage.preload for instant image display  
✅ **Local Caching** - Cache final place list with image URLs to MMKV  
✅ **Optimized Hook** - `usePlaces()` hook with instant cache and background sync  
✅ **Error Handling** - Retry with exponential backoff for throttling  
✅ **Clean Architecture** - Modular, production-ready code  

## File Structure

```
src/
├── cache/
│   └── cacheService.js          # MMKV/AsyncStorage cache service
├── services/
│   └── firebasePlacesService.js # Firebase sync & image URL resolution
├── hooks/
│   └── usePlaces.js             # Main hook for loading places
└── screens/
    └── PlacesExampleScreen.js   # Example usage screen
```

## Usage

### Basic Hook Usage

```javascript
import { usePlaces } from '../hooks/usePlaces';

const MyComponent = () => {
  const { places, loading, error, refresh } = usePlaces({
    limit: 200,
    maxImagesPerPlace: 5,
    autoSync: true,
  });

  if (loading && places.length === 0) {
    return <LoadingIndicator />;
  }

  return (
    <FlatList
      data={places}
      renderItem={({ item }) => <PlaceCard place={item} />}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} />
      }
    />
  );
};
```

### Hook API

#### `usePlaces(options)`

**Options:**
- `limit` (number, default: 200) - Maximum places to fetch
- `maxImagesPerPlace` (number, default: 5) - Max images per place
- `autoSync` (boolean, default: true) - Auto-sync from Firebase

**Returns:**
- `places` (Array) - Array of place objects (from cache immediately)
- `loading` (boolean) - `true` only on first launch or while syncing
- `error` (Error|null) - Error object if sync fails
- `refresh()` (Function) - Manual refresh function

### Cache Service

```javascript
import {
  savePlacesToCache,
  loadPlacesFromCache,
  clearPlacesCache,
  getCacheStats,
} from '../cache/cacheService';

// Save places to cache
await savePlacesToCache(places);

// Load places from cache
const cachedPlaces = await loadPlacesFromCache();

// Clear cache
await clearPlacesCache();

// Get cache stats
const stats = await getCacheStats();
// { storageType: 'mmkv', placeCount: 150, timestamp: 1234567890, isValid: true }
```

### Firebase Places Service

```javascript
import {
  fetchPlacesFromFirebase,
  syncPlacesFromFirebase,
  batchResolvePlaceImageUrls,
  getPlaceImageUrls,
} from '../services/firebasePlacesService';

// Fetch places from Realtime DB
const places = await fetchPlacesFromFirebase(200, 'rating');

// Sync places with image URLs
const placesWithImages = await syncPlacesFromFirebase(200, 5);

// Get image URLs for a single place
const imageUrls = await getPlaceImageUrls(placeId, 5);

// Batch resolve image URLs for multiple places
const placesWithImages = await batchResolvePlaceImageUrls(places, 5);
```

## How It Works

### 1. Instant Cached Load

On app launch:
1. Hook immediately loads cached places from MMKV/AsyncStorage
2. UI renders instantly with cached data
3. `loading` is set to `false` after cache load

### 2. Background Firebase Sync

After cache load:
1. Hook triggers background sync from Firebase Realtime Database
2. Fetches latest places data (converted from object to array)
3. Resolves Firebase Storage image URLs in batches of 10
4. Updates cache with new data
5. Updates UI when sync completes

### 3. Image Preloading

- FastImage.preload is called after cache load and sync
- Preloads up to 50 images for instant display
- Images are cached by FastImage for offline use

### 4. Error Handling

- Throttling errors are retried with exponential backoff (1s, 2s, 4s)
- Missing images default to placeholder
- Single image failures don't break the UI
- Errors are logged but don't crash the app

## Data Flow

```
App Launch
    ↓
Load from Cache (MMKV/AsyncStorage) ← Instant UI Render
    ↓
Background: Fetch from Firebase Realtime DB
    ↓
Background: Resolve Image URLs from Firebase Storage (batches of 10)
    ↓
Background: Update Cache & UI
    ↓
Background: Preload Images with FastImage
```

## Place Model Structure

```javascript
{
  id: string,                    // Place ID
  title: string,                 // Place title
  description: string,           // Place description
  lat: number,                   // Latitude
  lng: number,                   // Longitude
  country: string,               // Country
  place_type: string,            // Place type (B, C, E, F, etc.)
  rating: number,                // Rating
  state: string,                 // State/status
  images: string[],              // All images
  imageUrls: string[],           // Firebase Storage URLs
  firebaseImages: string[],      // Firebase Storage URLs (alias)
  image: string,                 // Main image URL
  featured: boolean,             // Is featured
  verified: boolean,             // Is verified
  // ... other fields
}
```

## Performance Optimizations

1. **MMKV Caching** - 30x faster than AsyncStorage
2. **Batch Processing** - Image URLs fetched in batches of 10
3. **FastImage Preloading** - Images cached for instant display
4. **Background Sync** - UI never blocked by network requests
5. **Retry with Backoff** - Handles Firebase throttling gracefully
6. **Placeholder Images** - Fallback for missing images

## Example Screen

See `src/screens/PlacesExampleScreen.js` for a complete implementation example showing:
- Using the `usePlaces` hook
- Rendering places with FastImage
- Pull-to-refresh functionality
- Loading states
- Error handling

## Installation Requirements

The following packages are already in your `package.json`:

- `react-native-mmkv` - High-performance caching (MMKV)
- `@react-native-async-storage/async-storage` - Fallback caching
- `@react-native-firebase/database` - Firebase Realtime Database
- `@react-native-firebase/storage` - Firebase Storage
- `react-native-fast-image` - Fast image loading and caching

## Notes

- MMKV is preferred but AsyncStorage is used as fallback
- Cache versioning ensures compatibility across app updates
- All async operations are properly awaited
- Code follows clean architecture principles
- Production-ready error handling

## Next Steps

1. Integrate `usePlaces` hook into your existing screens
2. Replace existing place loading logic with the optimized pipeline
3. Test on device to verify instant loading
4. Monitor cache stats to ensure proper caching

