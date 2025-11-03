# Image Preloading System Guide

This guide explains how to use the intelligent image preloading system in your React Native naturism app. The system predicts which images users are likely to see next and preloads them in the background for a smooth user experience.

## 🚀 Features

- **Smart Prediction**: Automatically predicts which images users will need based on their current screen and navigation patterns
- **Background Preloading**: Downloads images in the background without blocking the UI
- **Memory Management**: Intelligent cache management to prevent memory issues
- **Performance Monitoring**: Real-time performance metrics and optimization recommendations
- **Easy Integration**: Simple hooks and components for easy integration

## 📁 File Structure

```
src/
├── services/
│   ├── imagePreloaderService.ts    # Core preloading logic
│   └── performanceOptimizer.ts     # Memory and performance management
├── hooks/
│   └── useImagePreloader.ts        # React hooks for easy integration
├── components/
│   └── EnhancedPlaceCard.tsx       # PlaceCard with preloading support
├── examples/
│   └── ImagePreloadingExample.tsx  # Usage examples
└── screens/
    ├── HomeScreen.tsx              # Updated with preloading
    ├── ExploreScreen.tsx           # Updated with preloading
    └── MapScreen.tsx               # Updated with preloading
```

## 🎯 How It Works

### 1. Navigation Prediction
The system analyzes the current screen and user context to predict likely next actions:

- **Home Screen**: Preloads images for "View All" buttons and popular places
- **Explore Screen**: Preloads images for different categories and filters
- **Map Screen**: Preloads images for visible markers and nearby places
- **Search Screen**: Preloads images for search results and variations

### 2. Smart Image Selection
Based on the prediction, the system:
- Fetches place data from Google Places API
- Extracts image URLs from place objects
- Prioritizes images based on likelihood of being viewed
- Skips placeholder/default images

### 3. Background Preloading
Images are downloaded in the background using:
- Batched requests to avoid overwhelming the network
- Priority-based queuing (high, medium, low)
- Error handling and retry logic
- React Native's `Image.prefetch()` for efficient caching

## 🔧 Usage

### Basic Integration

```tsx
import { useScreenImagePreloader } from '../hooks/useImagePreloader';

const MyScreen = () => {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [currentPlaces, setCurrentPlaces] = useState<Place[]>([]);

  // Initialize preloader for current screen
  const { isImagePreloaded, getPreloadedImageUrl } = useScreenImagePreloader(
    'home', // current screen
    userLocation,
    {
      currentPlaces,
      searchQuery: 'naturist beach',
      selectedCategory: 'beach',
    }
  );

  // Images will be automatically preloaded based on context
  return (
    // Your screen content
  );
};
```

### Using Enhanced PlaceCard

```tsx
import EnhancedPlaceCard from '../components/EnhancedPlaceCard';

const PlaceList = ({ places }) => {
  return (
    <FlatList
      data={places}
      renderItem={({ item }) => (
        <EnhancedPlaceCard
          place={item}
          onPress={handlePlacePress}
          preloadImages={true} // Enable preloading
        />
      )}
    />
  );
};
```

### Manual Preloading

```tsx
import { imagePreloader } from '../services/imagePreloaderService';

const preloadSpecificImages = async () => {
  await imagePreloader.preloadImagesForContext({
    currentScreen: 'explore',
    userLocation: myLocation,
    selectedCategory: 'beach',
    currentPlaces: myPlaces,
    navigationHistory: ['home', 'explore'],
  });
};
```

## ⚙️ Configuration

### Preloader Configuration

```tsx
import { imagePreloader } from '../services/imagePreloaderService';

// Update configuration
imagePreloader.updateConfig({
  maxImagesPerScreen: 20,    // Max images to preload per screen
  preloadRadius: 100,        // Search radius in km
  cacheSize: 100,            // Max cached images
  preloadDelay: 500,         // Delay before starting preload (ms)
});
```

### Performance Optimization

```tsx
import { performanceOptimizer } from '../services/performanceOptimizer';

// Update optimization settings
performanceOptimizer.updateConfig({
  maxMemoryUsage: 100,           // Max memory usage in MB
  cacheCleanupThreshold: 80,     // Cache cleanup threshold (%)
  preloadBatchSize: 5,           // Images per batch
  memoryCheckInterval: 30000,    // Memory check interval (ms)
  enableMemoryOptimization: true,
  enableCacheOptimization: true,
});
```

## 📊 Monitoring and Debugging

### Performance Metrics

```tsx
import { performanceOptimizer } from '../services/performanceOptimizer';

const metrics = performanceOptimizer.getPerformanceMetrics();
console.log('Memory Usage:', metrics.memoryUsage.used, 'MB');
console.log('Cache Hit Rate:', metrics.cacheStats.hitRate);
console.log('Average Preload Time:', metrics.preloadStats.averagePreloadTime, 'ms');
```

### Cache Statistics

```tsx
import { imagePreloader } from '../services/imagePreloaderService';

const stats = imagePreloader.getCacheStats();
console.log('Total cached:', stats.total);
console.log('Successfully loaded:', stats.loaded);
console.log('Errors:', stats.errors);
```

### Optimization Recommendations

```tsx
const recommendations = performanceOptimizer.getOptimizationRecommendations();
console.log('Recommendations:', recommendations);
```

## 🎨 Customization

### Custom Image Validation

```tsx
// In imagePreloaderService.ts
private isValidImageUrl(url: string): boolean {
  // Add your custom validation logic
  return url.startsWith('http') && 
         !url.includes('placeholder') &&
         (url.includes('.jpg') || url.includes('.png'));
}
```

### Custom Prediction Logic

```tsx
// In imagePreloaderService.ts
private async predictForCustomScreen(userLocation: Location): Promise<Place[]> {
  // Add your custom prediction logic
  const customPlaces = await getCustomPlaces(userLocation);
  return customPlaces.slice(0, 10);
}
```

## 🚨 Best Practices

### 1. Memory Management
- Monitor memory usage regularly
- Clear cache when app goes to background
- Use appropriate cache size limits

### 2. Network Optimization
- Use batch processing for preloading
- Implement retry logic for failed downloads
- Consider user's network conditions

### 3. User Experience
- Show loading indicators for images
- Provide fallback images for failed loads
- Preload only relevant images

### 4. Performance
- Monitor preload times
- Optimize image sizes
- Use appropriate preload delays

## 🔍 Troubleshooting

### Common Issues

1. **Images not preloading**
   - Check API key configuration
   - Verify network connectivity
   - Check image URL validity

2. **High memory usage**
   - Reduce cache size
   - Enable memory optimization
   - Clear cache more frequently

3. **Slow preloading**
   - Reduce batch size
   - Check network speed
   - Optimize image sizes

### Debug Mode

```tsx
// Enable debug logging
console.log('Preloading images for context:', context);
console.log('Predicted places:', predictedPlaces.length);
console.log('Image URLs to preload:', imageUrls.length);
```

## 📈 Performance Tips

1. **Optimize Image Sizes**: Use appropriate image dimensions for your use case
2. **Batch Processing**: Process images in small batches to avoid overwhelming the network
3. **Priority Management**: Use high priority for likely-to-be-viewed images
4. **Memory Monitoring**: Regularly check and optimize memory usage
5. **Cache Strategy**: Implement smart cache eviction policies

## 🔮 Future Enhancements

- Machine learning-based prediction
- User behavior analysis
- Adaptive preloading based on usage patterns
- Advanced caching strategies
- Network-aware preloading

## 📝 Example Implementation

See `src/examples/ImagePreloadingExample.tsx` for a complete working example of the image preloading system.

## 🤝 Contributing

When adding new features or screens:
1. Update the prediction logic in `imagePreloaderService.ts`
2. Add new screen types to the hook
3. Update the example component
4. Add tests for new functionality

---

This image preloading system will significantly improve your app's user experience by ensuring images are ready when users need them, without any visible loading delays!
