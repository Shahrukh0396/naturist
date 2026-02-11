import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type MapTypeOption = 'standard' | 'satellite' | 'hybrid' | 'terrain';
import { useRoute, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Place, RootTabParamList } from '../types';
import { loadPlaces } from '../services/placesService';
import { getCurrentLocation, Location } from '../services/locationService';
import GradientBackground from '../components/GradientBackground';
import { MapPlace } from '../components/mapPlace';
import { COLORS } from '../theme/colors';
import { useScreenImagePreloader } from '../hooks/useImagePreloader';
import { useRewardedInterstitialAd } from '../hooks/useRewardedInterstitialAd';
import { imagePreloader } from '../services/imagePreloaderService';
import Icon from 'react-native-vector-icons/MaterialIcons';

const INITIAL_PLACE_LIMIT = 50;
const PLACES_PER_REWARD = 20;

type MapScreenRouteProp = RouteProp<RootTabParamList, 'Map'>;

const MapScreen: React.FC = () => {
  const route = useRoute<MapScreenRouteProp>();
  const mapRef = useRef<MapView>(null);
  const locationUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [placeLimit, setPlaceLimit] = useState(INITIAL_PLACE_LIMIT);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const places = useMemo(() => allPlaces.slice(0, placeLimit), [allPlaces, placeLimit]);
  const hasMorePlaces = placeLimit < allPlaces.length;

  const [newlyAddedPlaces, setNewlyAddedPlaces] = useState<Place[] | null>(null);
  const newPlacesBannerAnim = useRef(new Animated.Value(0)).current;
  const newPlacesBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { show: showRewardedAd, isLoaded: isRewardedAdLoaded } = useRewardedInterstitialAd({
    onReward: () => {
      setPlaceLimit(prev => {
        const newLimit = prev + PLACES_PER_REWARD;
        const added = allPlaces.slice(prev, newLimit).filter(p => selectedCategories.includes(p.category));
        setNewlyAddedPlaces(added);
        newPlacesBannerAnim.setValue(0);
        Animated.spring(newPlacesBannerAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
        if (newPlacesBannerTimeoutRef.current) clearTimeout(newPlacesBannerTimeoutRef.current);
        newPlacesBannerTimeoutRef.current = setTimeout(() => {
          Animated.timing(newPlacesBannerAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setNewlyAddedPlaces(null));
          newPlacesBannerTimeoutRef.current = null;
        }, 5000);
        return newLimit;
      });
    },
  });

  useEffect(() => {
    return () => {
      if (newPlacesBannerTimeoutRef.current) clearTimeout(newPlacesBannerTimeoutRef.current);
    };
  }, []);

  // When user fetches 20 more places (selected categories only), preload images only for those
  useEffect(() => {
    if (newlyAddedPlaces?.length) {
      imagePreloader.preloadImagesForPlaces(newlyAddedPlaces);
    }
  }, [newlyAddedPlaces]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<Location>({
    latitude: 37.7749,
    longitude: -122.4194,
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'beach', 'camps', 'hotel', 'sauna'
  ]);
  const [mapType, setMapType] = useState<MapTypeOption>('standard');

  const mapTypeOptions: { value: MapTypeOption; label: string }[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'satellite', label: 'Satellite' },
    { value: 'hybrid', label: 'Hybrid' },
    ...(Platform.OS === 'android' ? [{ value: 'terrain' as const, label: 'Terrain' }] : []),
  ];

  const preloaderContext = useMemo(() => ({
    selectedCategory: selectedCategories.join(','),
    currentPlaces: filteredPlaces,
  }), [selectedCategories.join(','), filteredPlaces.length]);

  const { isImagePreloaded, getPreloadedImageUrl, getCacheStats } = useScreenImagePreloader(
    'map',
    userLocation,
    preloaderContext
  );

  useEffect(() => {
    loadPlacesData();
    requestLocationPermission();
    
    // Cleanup timeout on unmount
    return () => {
      if (locationUpdateTimeoutRef.current) {
        clearTimeout(locationUpdateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Filter places based on selected categories
    const filtered = places.filter(place => selectedCategories.includes(place.category));
    setFilteredPlaces(filtered);
  }, [places, selectedCategories]);

  // Handle navigation from ExploreScreen with placeId
  useEffect(() => {
    const placeId = route.params?.placeId;
    if (placeId && places.length > 0) {
      const place = places.find(p => p.id === placeId);
      if (place) {
        mapRef.current?.animateToRegion({
          latitude: place.location.latitude,
          longitude: place.location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
        setSelectedPlace(place);
        setIsModalVisible(true);
        if (!selectedCategories.includes(place.category)) {
          setSelectedCategories(prev => [...prev, place.category]);
        }
      }
    }
  }, [route.params?.placeId, places]);

  const loadPlacesData = async () => {
    try {
      // Get user's current location
      const location = await getCurrentLocation();
      setUserLocation(location);

      // Load places with user location (from Firebase or local JSON)
      const loaded = await loadPlaces(location);
      setAllPlaces(loaded);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading places:', error);
      setIsLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      // Location permission is now handled in the location service
      console.log('Requesting location permission...');
    } catch (error) {
      console.log('Location permission denied');
    }
  };

  const handleMarkerPress = (place: Place) => {
    setSelectedPlace(place);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedPlace(null);
  };


  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        // Remove category from selection
        return prev.filter(c => c !== category);
      } else {
        // Add category to selection
        return [...prev, category];
      }
    });
  };

  const toggleAllCategories = () => {
    const allCategories = ['beach', 'camps', 'hotel', 'sauna'];
    if (selectedCategories.length === allCategories.length) {
      // If all are selected, clear all
      setSelectedCategories([]);
    } else {
      // If not all are selected, select all
      setSelectedCategories(allCategories);
    }
  };

  const getMarkerColor = (category: string) => {
    switch (category) {
      case 'beach': return '#FF6B6B';
      case 'camps': return '#FFEAA7';
      case 'hotel': return '#A29BFE';
      case 'sauna': return '#FD79A8';
      default: return '#DDA0DD';
    }
  };

  const handleSearchPress = () => showRewardedAd();

  const handleMyLocationPress = useCallback(async () => {
    try {
      const location = await getCurrentLocation();
      setUserLocation(location);
      mapRef.current?.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }, 500);
    } catch (e) {
      // Fallback to current state
      mapRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }, 500);
    }
  }, [userLocation.latitude, userLocation.longitude]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'beach': return '🏖️';
      case 'camps': return '⛺';
      case 'hotel': return '🏨';
      case 'sauna': return '🧖';
      default: return '📍';
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Map View</Text>
          </View>
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>
              {isLoading ? 'Loading...' : 
               selectedCategories.length === 0 ? 'No categories selected' :
               `${filteredPlaces.length} places on map`}
            </Text>
          </View>
        </View>

        {newlyAddedPlaces && newlyAddedPlaces.length > 0 && (
          <Animated.View
            style={[
              styles.newPlacesBanner,
              {
                opacity: newPlacesBannerAnim,
                transform: [
                  {
                    translateY: newPlacesBannerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-120, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.newPlacesBannerHeader}>
              <Icon name="add-location" size={24} color={COLORS.primary.teal} />
              <Text style={styles.newPlacesBannerTitle}>
                {newlyAddedPlaces.length} new places!
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.newPlacesList}
              contentContainerStyle={styles.newPlacesListContent}
            >
              {newlyAddedPlaces.slice(0, 15).map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.newPlaceChip}
                  onPress={() => {
                    handleMarkerPress(place);
                    setNewlyAddedPlaces(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.newPlaceChipText} numberOfLines={1}>
                    {place.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {newlyAddedPlaces.length > 15 && (
                <Text style={styles.newPlacesMore}>
                  +{newlyAddedPlaces.length - 15} more
                </Text>
              )}
            </ScrollView>
          </Animated.View>
        )}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={[styles.map, { zIndex: 1 }]}
          mapType={mapType}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={Platform.OS === 'ios'}
          onUserLocationChange={(event) => {
            if (event.nativeEvent.coordinate) {
              const newLocation = {
                latitude: event.nativeEvent.coordinate.latitude,
                longitude: event.nativeEvent.coordinate.longitude,
              };
              
              // Debounce location updates to prevent excessive re-renders and API calls
              // Only update if location changed significantly (more than ~100m)
              const locationChanged = 
                Math.abs(newLocation.latitude - userLocation.latitude) > 0.001 ||
                Math.abs(newLocation.longitude - userLocation.longitude) > 0.001;
              
              if (locationChanged) {
                // Clear existing timeout
                if (locationUpdateTimeoutRef.current) {
                  clearTimeout(locationUpdateTimeoutRef.current);
                }
                
                // Update location after a short delay
                locationUpdateTimeoutRef.current = setTimeout(() => {
                  setUserLocation(newLocation);
                }, 1000); // 1 second debounce
              }
            }
          }}
        >
          {filteredPlaces.map((place) => (
            <Marker
              key={place.id}
              coordinate={{
                latitude: place.location.latitude,
                longitude: place.location.longitude,
              }}
              title={place.name}
              description={place.location.address}
              onPress={() => handleMarkerPress(place)}
              pinColor={getMarkerColor(place.category)}
            >
              <View style={styles.customMarker}>
                <Text style={styles.markerIcon}>
                  {getCategoryIcon(place.category)}
                </Text>
              </View>
            </Marker>
          ))}
        </MapView>
        {selectedCategories.length === 0 && (
          <View style={[styles.emptyStateOverlay, { zIndex: 2 }]}>
            <Text style={styles.emptyStateText}>Select categories to view places</Text>
          </View>
        )}
        <View style={[styles.legend, { zIndex: 2 }]}>
          <View style={styles.legendHeader}>
            <Text style={styles.legendTitle}>Categories</Text>
            <TouchableOpacity onPress={toggleAllCategories} style={styles.toggleAllButton}>
              <Text style={styles.toggleAllText}>
                {selectedCategories.length === 4 ? 'Clear' : 'All'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.legendItems}>
            <TouchableOpacity
              style={styles.legendItem}
              onPress={() => toggleCategory('beach')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.legendColor,
                { backgroundColor: '#FF6B6B' },
                !selectedCategories.includes('beach') && styles.legendColorDisabled
              ]} />
              <Text style={[
                styles.legendText,
                !selectedCategories.includes('beach') && styles.legendTextDisabled
              ]}>🏖️ Beach</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legendItem}
              onPress={() => toggleCategory('camps')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.legendColor,
                { backgroundColor: '#FFEAA7' },
                !selectedCategories.includes('camps') && styles.legendColorDisabled
              ]} />
              <Text style={[
                styles.legendText,
                !selectedCategories.includes('camps') && styles.legendTextDisabled
              ]}>⛺ Camps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legendItem}
              onPress={() => toggleCategory('hotel')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.legendColor,
                { backgroundColor: '#A29BFE' },
                !selectedCategories.includes('hotel') && styles.legendColorDisabled
              ]} />
              <Text style={[
                styles.legendText,
                !selectedCategories.includes('hotel') && styles.legendTextDisabled
              ]}>🏨 Hotel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legendItem}
              onPress={() => toggleCategory('sauna')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.legendColor,
                { backgroundColor: '#FD79A8' },
                !selectedCategories.includes('sauna') && styles.legendColorDisabled
              ]} />
              <Text style={[
                styles.legendText,
                !selectedCategories.includes('sauna') && styles.legendTextDisabled
              ]}>🧖 Sauna</Text>
            </TouchableOpacity>
          </View>
        </View>
        {hasMorePlaces && (
          <TouchableOpacity
            style={[styles.findPlacesButton, !isRewardedAdLoaded && styles.findPlacesButtonDisabled]}
            onPress={handleSearchPress}
            disabled={!isRewardedAdLoaded}
            activeOpacity={0.8}
            accessibilityLabel="Find 20 more places"
          >
            <Icon name="explore" size={22} color={COLORS.primary.teal} />
            <Text style={styles.findPlacesButtonText}>+20</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.myLocationButton, { zIndex: 2 }]}
          onPress={handleMyLocationPress}
          activeOpacity={0.8}
          accessibilityLabel="Center map on my location"
        >
          <Icon name="my-location" size={24} color={COLORS.primary.teal} />
        </TouchableOpacity>
        <View style={[styles.mapTypeSelector, { zIndex: 2 }]}>
          {mapTypeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.mapTypeButton,
                mapType === option.value && styles.mapTypeButtonActive,
              ]}
              onPress={() => setMapType(option.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.mapTypeButtonText,
                  mapType === option.value && styles.mapTypeButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <MapPlace
        modal={isModalVisible}
        setModal={handleCloseModal}
        data={selectedPlace}
        userLocation={userLocation}
      />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary.darkPurple,
    marginBottom: 4,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.primary.blue,
    flex: 1,
  },
  newPlacesBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  newPlacesBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  newPlacesBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary.darkPurple,
  },
  newPlacesList: {
    maxHeight: 80,
  },
  newPlacesListContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  newPlaceChip: {
    backgroundColor: 'rgba(0, 200, 180, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: 140,
  },
  newPlaceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary.teal,
  },
  newPlacesMore: {
    fontSize: 13,
    color: '#666',
    alignSelf: 'center',
    paddingLeft: 8,
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  map: {
    flex: 1,
  },
  emptyStateOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  findPlacesButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    gap: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  findPlacesButtonDisabled: {
    opacity: 0.6,
  },
  findPlacesButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary.teal,
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 95,
    right: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  mapTypeSelector: {
    position: 'absolute',
    bottom: 30,
    left: 12,
    right: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  mapTypeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  mapTypeButtonActive: {
    backgroundColor: COLORS.primary.teal,
    borderColor: COLORS.primary.teal,
  },
  mapTypeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  mapTypeButtonTextActive: {
    color: '#fff',
  },
  customMarker: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: COLORS.primary.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: {
    fontSize: 20,
  },
  legend: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    maxWidth: 130,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  toggleAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: COLORS.primary.teal,
    borderRadius: 4,
  },
  toggleAllText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  legendItems: {
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 9,
    color: '#666',
    flex: 1,
  },
  legendColorDisabled: {
    opacity: 0.3,
  },
  legendTextDisabled: {
    opacity: 0.5,
    color: '#999',
  },
});

export default MapScreen;
