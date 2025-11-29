import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Text,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Place } from '../types';
import SearchBar from '../components/SearchBar';
import CategorySection from '../components/CategorySection';
import GradientBackground from '../components/GradientBackground';
import OfflineIndicator from '../components/OfflineIndicator';
import { COLORS } from '../theme/colors';
import { 
  loadPlaces,
  getPopularPlaces, 
  getNearbyPlaces, 
  getExplorePlaces,
  searchPlaces,
  getNearbyPlacesFromAPI,
  searchPlacesFromAPI
} from '../services/placesService';
import { getCurrentLocation, Location } from '../services/locationService';
import { useScreenImagePreloader } from '../hooks/useImagePreloader';

const HomeScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [popularPlaces, setPopularPlaces] = useState<Place[]>([]);
  const [explorePlaces, setExplorePlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<Location | null>(null);

  // Initialize image preloader for home screen
  const { isImagePreloaded, getPreloadedImageUrl, getCacheStats } = useScreenImagePreloader(
    'home',
    userLocation,
    {
      currentPlaces: [...nearbyPlaces, ...popularPlaces, ...explorePlaces],
    }
  );

  useEffect(() => {
    loadPlacesData();
  }, []);

  const loadPlacesData = async () => {
    try {
      console.log('🔄 [HomeScreen] Starting loadPlacesData...');
      setIsLoading(true);
      
      // Get user's current location
      console.log('🔄 [HomeScreen] Getting user location...');
      const location = await getCurrentLocation();
      console.log('✅ [HomeScreen] User location:', location);
      setUserLocation(location);
      
      // Load places with user location
      // Try Firebase first, fallback to Google Places API, then local data
      let nearby: Place[] = [];
      try {
        console.log('🔄 [HomeScreen] Loading nearby places...');
        // Try Firebase nearby places first
        nearby = await getNearbyPlaces(location, 50);
        console.log('🔄 [HomeScreen] Nearby places from getNearbyPlaces:', nearby.length);
        if (nearby.length === 0) {
          console.log('🔄 [HomeScreen] No nearby places, trying Google Places API...');
          // Fallback to Google Places API
          nearby = await getNearbyPlacesFromAPI(location, 50);
          console.log('🔄 [HomeScreen] Nearby places from Google API:', nearby.length);
        }
      } catch (error) {
        console.warn('⚠️ [HomeScreen] Error loading nearby places, using Google Places API:', error);
        nearby = await getNearbyPlacesFromAPI(location, 50);
      }
      
      // Use Firebase/local data for popular and explore (curated content)
      console.log('🔄 [HomeScreen] Loading popular places...');
      const popular = await getPopularPlaces(location);
      console.log('✅ [HomeScreen] Popular places:', popular.length);
      
      console.log('🔄 [HomeScreen] Loading explore places...');
      const explore = await getExplorePlaces(location);
      console.log('✅ [HomeScreen] Explore places:', explore.length);
      
      const nearbyLimited = nearby.slice(0, 10);
      const popularLimited = popular.slice(0, 10);
      const exploreLimited = explore.slice(0, 10);
      
      console.log('✅ [HomeScreen] Setting state - Nearby:', nearbyLimited.length, 'Popular:', popularLimited.length, 'Explore:', exploreLimited.length);
      
      setNearbyPlaces(nearbyLimited);
      setPopularPlaces(popularLimited);
      setExplorePlaces(exploreLimited);
      setIsLoading(false);
      console.log('✅ [HomeScreen] Finished loading places');
    } catch (error) {
      console.error('❌ [HomeScreen] Error loading places:', error);
      console.error('❌ [HomeScreen] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      setIsLoading(false);
    }
  };

  const handlePlacePress = (place: Place) => {
    // Navigate to place details
    console.log('Place pressed:', place.name);
  };

  const handleViewAll = (category: string) => {
    // Navigate to explore screen with category filter
    console.log('View all pressed for:', category);
  };

  const handleSearch = async () => {
    if (searchQuery.trim() && userLocation) {
      try {
        // Use Google Places API for search (real-time results)
        const searchResults = await searchPlacesFromAPI(searchQuery, userLocation);
        console.log('Search results:', searchResults.length, 'places found');
        
        // Update nearby places with search results for now
        // In a real app, you might navigate to a search results screen
        if (searchResults.length > 0) {
          setNearbyPlaces(searchResults.slice(0, 10));
        }
      } catch (error) {
        console.error('Error searching places:', error);
      }
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadPlacesData();
    setIsRefreshing(false);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <OfflineIndicator />
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome to Naturism</Text>
          <Text style={styles.subtitle}>Discover amazing naturist places</Text>
          {userLocation && (
            <Text style={styles.locationText}>
              📍 Location: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            </Text>
          )}
        </View>
        
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSearch={handleSearch}
          placeholder="Search places, locations..."
        />

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              title="Pull to refresh location"
              tintColor={COLORS.white}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading places...</Text>
            </View>
          ) : (
            <>
              <CategorySection
                title="📍 Nearby Places"
                places={nearbyPlaces}
                onPlacePress={handlePlacePress}
                onViewAllPress={() => handleViewAll('nearby')}
              />

              <CategorySection
                title="⭐ Popular Places"
                places={popularPlaces}
                onPlacePress={handlePlacePress}
                onViewAllPress={() => handleViewAll('popular')}
              />

              <CategorySection
                title="🌍 Explore More"
                places={explorePlaces}
                onPlacePress={handlePlacePress}
                onViewAllPress={() => handleViewAll('explore')}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary.darkPurple,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.primary.blue,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.primary.teal,
    marginTop: 4,
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.white,
  },
});

export default HomeScreen;
