/**
 * Image Preloading Example
 * Demonstrates how to use the image preloading system in your React Native app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useScreenImagePreloader } from '../hooks/useImagePreloader';
import { performanceOptimizer } from '../services/performanceOptimizer';
import { imagePreloader } from '../services/imagePreloaderService';
import { getCurrentLocation, Location } from '../services/locationService';

const ImagePreloadingExample: React.FC = () => {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'explore' | 'map' | 'search'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('beach');
  const [performanceMetrics, setPerformanceMetrics] = useState(performanceOptimizer.getPerformanceMetrics());

  // Initialize image preloader
  const { isImagePreloaded, getPreloadedImageUrl, getCacheStats, clearCache } = useScreenImagePreloader(
    currentScreen,
    userLocation,
    {
      searchQuery,
      selectedCategory,
      currentPlaces: [], // Your current places array
    }
  );

  useEffect(() => {
    initializeLocation();
    startPerformanceMonitoring();
  }, []);

  const initializeLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setUserLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const startPerformanceMonitoring = () => {
    // Update performance metrics every 5 seconds
    const interval = setInterval(() => {
      setPerformanceMetrics(performanceOptimizer.getPerformanceMetrics());
    }, 5000);

    return () => clearInterval(interval);
  };

  const handleScreenChange = (screen: 'home' | 'explore' | 'map' | 'search') => {
    setCurrentScreen(screen);
    console.log(`Switched to ${screen} screen - images will be preloaded automatically`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log(`Searching for "${query}" - related images will be preloaded`);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    console.log(`Category changed to ${category} - category images will be preloaded`);
  };

  const testImagePreloading = async () => {
    if (!userLocation) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    try {
      // Manually trigger preloading for a specific context
      await imagePreloader.preloadImagesForContext({
        currentScreen,
        userLocation,
        searchQuery,
        selectedCategory,
        currentPlaces: [],
        navigationHistory: [],
      });

      Alert.alert('Success', 'Image preloading started!');
    } catch (error) {
      Alert.alert('Error', 'Failed to start image preloading');
    }
  };

  const testImageCheck = () => {
    const testUrl = 'https://example.com/test-image.jpg';
    const isPreloaded = isImagePreloaded(testUrl);
    const preloadedUrl = getPreloadedImageUrl(testUrl);
    
    Alert.alert(
      'Image Check',
      `URL: ${testUrl}\nPreloaded: ${isPreloaded}\nPreloaded URL: ${preloadedUrl || 'N/A'}`
    );
  };

  const showCacheStats = () => {
    const stats = getCacheStats();
    Alert.alert(
      'Cache Statistics',
      `Total: ${stats.total}\nLoaded: ${stats.loaded}\nErrors: ${stats.errors}`
    );
  };

  const showPerformanceMetrics = () => {
    const recommendations = performanceOptimizer.getOptimizationRecommendations();
    Alert.alert(
      'Performance Metrics',
      `Memory Usage: ${performanceMetrics.memoryUsage.used.toFixed(2)}MB\n` +
      `Cache Hit Rate: ${(performanceMetrics.cacheStats.hitRate * 100).toFixed(1)}%\n` +
      `Average Preload Time: ${performanceMetrics.preloadStats.averagePreloadTime.toFixed(0)}ms\n\n` +
      `Recommendations:\n${recommendations.join('\n') || 'No recommendations'}`
    );
  };

  const clearImageCache = () => {
    clearCache();
    Alert.alert('Success', 'Image cache cleared');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Image Preloading Example</Text>
      
      {/* Screen Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Screen</Text>
        <View style={styles.buttonRow}>
          {(['home', 'explore', 'map', 'search'] as const).map((screen) => (
            <TouchableOpacity
              key={screen}
              style={[
                styles.button,
                currentScreen === screen && styles.activeButton
              ]}
              onPress={() => handleScreenChange(screen)}
            >
              <Text style={[
                styles.buttonText,
                currentScreen === screen && styles.activeButtonText
              ]}>
                {screen.charAt(0).toUpperCase() + screen.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search Query */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search Query</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleSearch('naturist beach')}
        >
          <Text style={styles.buttonText}>Test Search: "naturist beach"</Text>
        </TouchableOpacity>
      </View>

      {/* Category Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.buttonRow}>
          {['beach', 'camps', 'hotel', 'sauna'].map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.button,
                selectedCategory === category && styles.activeButton
              ]}
              onPress={() => handleCategoryChange(category)}
            >
              <Text style={[
                styles.buttonText,
                selectedCategory === category && styles.activeButtonText
              ]}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Test Functions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Functions</Text>
        <TouchableOpacity style={styles.button} onPress={testImagePreloading}>
          <Text style={styles.buttonText}>Start Image Preloading</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={testImageCheck}>
          <Text style={styles.buttonText}>Check Image Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={showCacheStats}>
          <Text style={styles.buttonText}>Show Cache Stats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={showPerformanceMetrics}>
          <Text style={styles.buttonText}>Show Performance Metrics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={clearImageCache}>
          <Text style={styles.buttonText}>Clear Image Cache</Text>
        </TouchableOpacity>
      </View>

      {/* Current Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Status</Text>
        <Text style={styles.statusText}>
          Screen: {currentScreen}
        </Text>
        <Text style={styles.statusText}>
          Search: {searchQuery || 'None'}
        </Text>
        <Text style={styles.statusText}>
          Category: {selectedCategory}
        </Text>
        <Text style={styles.statusText}>
          Location: {userLocation ? 'Available' : 'Not available'}
        </Text>
      </View>

      {/* Performance Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        <Text style={styles.metricText}>
          Memory Usage: {performanceMetrics.memoryUsage.used.toFixed(2)}MB
        </Text>
        <Text style={styles.metricText}>
          Cache Hit Rate: {(performanceMetrics.cacheStats.hitRate * 100).toFixed(1)}%
        </Text>
        <Text style={styles.metricText}>
          Total Preloaded: {performanceMetrics.preloadStats.totalPreloaded}
        </Text>
        <Text style={styles.metricText}>
          Average Preload Time: {performanceMetrics.preloadStats.averagePreloadTime.toFixed(0)}ms
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  activeButton: {
    backgroundColor: '#0056CC',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  activeButtonText: {
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  metricText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
});

export default ImagePreloadingExample;
