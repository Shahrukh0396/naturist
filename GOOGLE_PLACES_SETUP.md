# Google Places API Integration Guide

This guide will help you set up and use Google's new Places API in your Naturism app.

## 🚀 Quick Start

### 1. Get a Google Places API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API (New)** for your project
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > API Key**
6. Copy your API key

### 2. Configure Your API Key

Open the file `src/config/environment.ts` and replace the placeholder with your actual API key:

```typescript
export const GOOGLE_PLACES_API_KEY = 'YOUR_ACTUAL_API_KEY_HERE';
```

⚠️ **Important Security Notes:**
- Never commit your API key to version control
- Add `src/config/environment.ts` to your `.gitignore`
- For production, use environment variables or a secure key management system
- Consider restricting your API key to specific services and IP addresses in the Google Cloud Console

### 3. Install Dependencies

The required dependencies are already in `package.json`:

```bash
npm install
# or
yarn install
```

## 📚 API Features

### Nearby Search

Find naturist places near a specific location:

```typescript
import { getNearbyPlacesFromAPI } from '../services/placesService';

const nearbyPlaces = await getNearbyPlacesFromAPI(userLocation, radiusKm);
```

### Text Search

Search for places using natural language queries:

```typescript
import { searchPlacesFromAPI } from '../services/placesService';

const results = await searchPlacesFromAPI('naturist beach', userLocation);
```

### Category Search

Search for places by category:

```typescript
import { getPlacesByCategoryFromAPI } from '../services/placesService';

const beaches = await getPlacesByCategoryFromAPI('beach', userLocation);
```

### Hybrid Search

Combine local data with Google Places API results:

```typescript
import { getHybridNearbyPlaces } from '../services/placesService';

const allPlaces = await getHybridNearbyPlaces(userLocation);
```

## 🏗️ Architecture

### Service Layers

1. **googlePlacesService.ts** - Direct Google Places API integration
   - Handles API requests
   - Manages authentication
   - Provides low-level API access

2. **placesService.ts** - Business logic layer
   - Transforms Google Places data to app format
   - Merges with local data
   - Provides fallback mechanisms
   - Implements search and filtering logic

3. **HomeScreen.tsx** - UI layer
   - Displays places to users
   - Handles user interactions
   - Manages loading states

### Data Flow

```
User Location → Google Places API → Transform Data → Display in UI
                       ↓
                 (Fallback to local data if API fails)
```

## 🔍 Search Keywords

The app automatically enhances searches with naturist-specific keywords:

- naturist
- nudist
- naturism
- nudism
- clothing optional
- nude beach
- FKK (German term)

## 📱 Platform Support

### iOS Setup

The Google Places API works on iOS without additional configuration. Make sure you have:

```bash
cd ios && pod install
```

### Android Setup

The Google Places API works on Android without additional configuration. Make sure your `AndroidManifest.xml` has internet permissions (already configured).

## 🧪 Testing

### Test Without API Key

If you haven't configured the API key yet, the app will automatically fall back to local data:

```
⚠️ Google Places API key is not configured. Please add your API key to src/config/environment.ts
```

### Test With API Key

1. Configure your API key
2. Run the app
3. Pull to refresh on the home screen
4. Check console logs for API responses
5. Search for places using the search bar

## 📊 API Limits & Costs

### Google Places API (New) Pricing

- **Text Search**: $32 per 1,000 requests
- **Nearby Search**: $32 per 1,000 requests
- **Place Details**: $17 per 1,000 requests
- **Place Photos**: $7 per 1,000 requests

**Free Tier**: Google provides $200 of free usage per month.

### Optimization Tips

1. **Caching**: Results are not currently cached. Consider implementing caching for better performance
2. **Pagination**: Limit results to reduce API calls
3. **Debouncing**: Search requests are not debounced. Consider adding debouncing to reduce API calls
4. **Fallback**: The app falls back to local data when API fails, reducing costs

## 🛠️ Configuration Options

Edit `src/config/environment.ts` to customize:

```typescript
export const PLACES_API_CONFIG = {
  baseUrl: 'https://places.googleapis.com/v1',
  defaultRadius: 50000, // 50km in meters
  maxResults: 20,
  language: 'en',
};
```

## 🐛 Troubleshooting

### Common Issues

**Error: 403 Forbidden**
- Check if your API key is correct
- Ensure Places API (New) is enabled in Google Cloud Console
- Verify your API key restrictions

**Error: API key not configured**
- Make sure you've added your API key to `src/config/environment.ts`
- Restart the Metro bundler after updating the config

**No results returned**
- Check your internet connection
- Verify the search location is valid
- Try a broader search radius
- Check console logs for detailed error messages

**Rate limit exceeded**
- Implement caching to reduce API calls
- Add debouncing to search inputs
- Consider using the hybrid approach to combine local and API data

## 📖 API Documentation

- [Google Places API (New) Documentation](https://developers.google.com/maps/documentation/places/web-service/op-overview)
- [Places API Reference](https://developers.google.com/maps/documentation/places/web-service/reference/rest)
- [Field Masks](https://developers.google.com/maps/documentation/places/web-service/place-details#fields)

## 🔐 Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** in production
3. **Restrict API keys** in Google Cloud Console:
   - Restrict by API (Places API only)
   - Restrict by IP address or app identifier
4. **Monitor usage** in Google Cloud Console
5. **Set up billing alerts** to avoid unexpected charges

## 📝 Example Usage

### Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { getNearbyPlacesFromAPI } from '../services/placesService';
import { getCurrentLocation } from '../services/locationService';

const MyComponent = () => {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlaces = async () => {
      try {
        const location = await getCurrentLocation();
        const nearbyPlaces = await getNearbyPlacesFromAPI(location, 50);
        setPlaces(nearbyPlaces);
      } catch (error) {
        console.error('Error loading places:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlaces();
  }, []);

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <FlatList
      data={places}
      renderItem={({ item }) => (
        <View>
          <Text>{item.name}</Text>
          <Text>{item.distance} km away</Text>
        </View>
      )}
      keyExtractor={(item) => item.id}
    />
  );
};

export default MyComponent;
```

## 🎯 Next Steps

1. **Add Caching**: Implement caching to reduce API calls and improve performance
2. **Add Pagination**: Implement pagination for large result sets
3. **Add Filters**: Add more filters (price, rating, amenities)
4. **Add Maps**: Show places on a map with markers
5. **Add Place Details**: Create a detailed place view with reviews, photos, etc.
6. **Add Favorites**: Allow users to save favorite places
7. **Add Reviews**: Let users rate and review places

## 📞 Support

If you encounter any issues:

1. Check the console logs for detailed error messages
2. Review the troubleshooting section above
3. Check the Google Places API documentation
4. Verify your API key and billing settings in Google Cloud Console

---

**Happy coding! 🎉**
