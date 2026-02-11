import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Text,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Place } from '../types';
import { RootTabParamList } from '../types';
import SearchBar from '../components/SearchBar';
import CategorySection from '../components/CategorySection';
import GradientBackground from '../components/GradientBackground';
import OfflineIndicator from '../components/OfflineIndicator';
import LoadingPlaceholder from '../components/LoadingPlaceholder';
import { COLORS } from '../theme/colors';
import { searchPlacesFromAPI, enhancePlacesWithFirebaseStorageImages } from '../services/placesService';
import { Location } from '../services/locationService';
import { getInitialData, refreshInitialData, InitialData } from '../services/optimizedPlacesService';
import { useScreenImagePreloader } from '../hooks/useImagePreloader';
import AdBanner from '../components/AdBanner';

type HomeScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
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
      currentPlaces: [...searchResults, ...popularPlaces, ...explorePlaces],
    }
  );

  useEffect(() => {
    loadPlacesData();
  }, []);

  const loadPlacesData = async () => {
    try {
      console.log('🔄 [HomeScreen] Starting loadPlacesData...');
      setIsLoading(true);

      const initialData: InitialData = await getInitialData();
      console.log('✅ [HomeScreen] Loaded initial data - Popular:', initialData.places.popular.length, 'Explore:', initialData.places.explore.length);

      setUserLocation(initialData.location);

      // Fetch Firebase Storage images for home sections (same as Explore screen)
      const [enhancedPopular, enhancedExplore] = await Promise.all([
        enhancePlacesWithFirebaseStorageImages(initialData.places.popular),
        enhancePlacesWithFirebaseStorageImages(initialData.places.explore),
      ]);

      setPopularPlaces(enhancedPopular);
      setExplorePlaces(enhancedExplore);
      setIsLoading(false);
      console.log('✅ [HomeScreen] Finished loading places with images');
    } catch (error) {
      console.error('❌ [HomeScreen] Error loading places:', error);
      setIsLoading(false);
    }
  };

  const handlePlacePress = (place: Place) => {
    // Navigate to place details
    console.log('Place pressed:', place.name);
  };

  const handleViewAll = (category: string) => {
    if (category === 'explore') {
      navigation.navigate('Explore');
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim() && userLocation) {
      try {
        // Use Google Places API for search (real-time results)
        const results = await searchPlacesFromAPI(searchQuery, userLocation);
        console.log('Search results:', results.length, 'places found');
        setSearchResults(results.slice(0, 10));
      } catch (error) {
        console.error('Error searching places:', error);
      }
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      const initialData: InitialData = await refreshInitialData();
      setUserLocation(initialData.location);
      const [enhancedPopular, enhancedExplore] = await Promise.all([
        enhancePlacesWithFirebaseStorageImages(initialData.places.popular),
        enhancePlacesWithFirebaseStorageImages(initialData.places.explore),
      ]);
      setPopularPlaces(enhancedPopular);
      setExplorePlaces(enhancedExplore);
    } catch (error) {
      console.error('❌ [HomeScreen] Error refreshing places:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <OfflineIndicator />
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome to Natourist</Text>
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
          contentContainerStyle={isLoading ? styles.scrollContentLoading : undefined}
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
            <LoadingPlaceholder active={true} />
          ) : (
            <>
              {searchResults.length > 0 && (
                <CategorySection
                  title="🔍 Search Results"
                  places={searchResults}
                  onPlacePress={handlePlacePress}
                />
              )}

              <CategorySection
                title="⭐ Popular Places"
                places={popularPlaces}
                onPlacePress={handlePlacePress}
              />

              <AdBanner variant="compact" inline style={styles.banner} />

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
  scrollContentLoading: {
    flexGrow: 1,
    minHeight: Dimensions.get('window').height - 200,
  },
  banner: {
    marginVertical: 8,
  },
});

export default HomeScreen;
