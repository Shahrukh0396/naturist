import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type MapTypeOption = 'standard' | 'satellite' | 'hybrid' | 'terrain';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Place, RootTabParamList } from '../types';
import { loadPlaces } from '../services/placesService';
import { getCurrentLocation, Location } from '../services/locationService';
import GradientBackground from '../components/GradientBackground';
import { MapPlace } from '../components/mapPlace';
import { COLORS } from '../theme/colors';
import { useScreenImagePreloader } from '../hooks/useImagePreloader';
import { capitalizeCountry } from '../utils/format';
import Icon from 'react-native-vector-icons/MaterialIcons';

/** Max markers to render at once (viewport-based) to keep map performant */
const MAX_VISIBLE_MARKERS = Platform.OS === 'android' ? 200 : 350;
const REGION_BUFFER = 0.4; // extend visible region by 40% so panning doesn't flicker
const REGION_DEBOUNCE_MS = 280; // debounce region updates so panning doesn't re-render every frame

type MapScreenRouteProp = RouteProp<RootTabParamList, 'Map'>;

const MapScreen: React.FC = () => {
  const route = useRoute<MapScreenRouteProp>();
  const mapRef = useRef<MapView>(null);
  const locationUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** Current map region for viewport-based marker rendering (keeps perf with all places) */
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

  const places = useMemo(() => allPlaces, [allPlaces]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<Location>({
    latitude: 37.7749,
    longitude: -122.4194,
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'beach', 'camps', 'hotel', 'sauna'
  ]);
  const [mapType, setMapType] = useState<MapTypeOption>('standard');
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const categoryExpandAnim = useRef(new Animated.Value(0)).current;

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
    return () => {
      if (locationUpdateTimeoutRef.current) clearTimeout(locationUpdateTimeoutRef.current);
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    };
  }, []);

  // Fetch and center on user location every time screen comes into focus
  // Skip if navigating with a placeId (let the placeId effect handle centering)
  useFocusEffect(
    useCallback(() => {
      // Don't center if we're navigating to a specific place
      if (route.params?.placeId) {
        return;
      }
      
      const fetchAndCenterLocation = async () => {
        try {
          const location = await getCurrentLocation();
          setUserLocation(location);
          // Center map on user's current location
          mapRef.current?.animateToRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }, 500);
        } catch (error) {
          // If location fetch fails, keep current location
          console.log('Could not fetch location on focus:', error);
        }
      };
      
      fetchAndCenterLocation();
    }, [route.params?.placeId])
  );

  useEffect(() => {
    // Filter places based on selected categories (all places from verified JSON)
    const filtered = places.filter(place => selectedCategories.includes(place.category));
    setFilteredPlaces(filtered);
  }, [places, selectedCategories]);

  // Set initial map region so viewport filtering works before first pan/zoom
  useEffect(() => {
    if (mapRegion == null) {
      setMapRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
  }, [userLocation.latitude, userLocation.longitude]);

  // Only render markers in viewport (with buffer) so map stays fast with 10k+ places
  const visiblePlaces = useMemo(() => {
    if (!mapRegion) return filteredPlaces.slice(0, MAX_VISIBLE_MARKERS);
    const { latitude, longitude, latitudeDelta, longitudeDelta } = mapRegion;
    const latHalf = (latitudeDelta / 2) * (1 + REGION_BUFFER);
    const lngHalf = (longitudeDelta / 2) * (1 + REGION_BUFFER);
    const inView: Place[] = [];
    for (const place of filteredPlaces) {
      const lat = place.location.latitude;
      const lng = place.location.longitude;
      if (lat >= latitude - latHalf && lat <= latitude + latHalf &&
          lng >= longitude - lngHalf && lng <= longitude + lngHalf) {
        inView.push(place);
        if (inView.length >= MAX_VISIBLE_MARKERS) break;
      }
    }
    return inView;
  }, [filteredPlaces, mapRegion]);

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

  const toggleCategoryExpanded = () => {
    const toValue = isCategoryExpanded ? 0 : 1;
    setIsCategoryExpanded(!isCategoryExpanded);
    Animated.spring(categoryExpandAnim, {
      toValue,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start();
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
          onRegionChangeComplete={(region) => {
            if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
            regionDebounceRef.current = setTimeout(() => {
              regionDebounceRef.current = null;
              setMapRegion({
                latitude: region.latitude,
                longitude: region.longitude,
                latitudeDelta: region.latitudeDelta,
                longitudeDelta: region.longitudeDelta,
              });
            }, REGION_DEBOUNCE_MS);
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
          {visiblePlaces.map((place) => (
            <Marker
              key={place.id}
              coordinate={{
                latitude: place.location.latitude,
                longitude: place.location.longitude,
              }}
              title={place.name}
              description={capitalizeCountry(place.location.address || '')}
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
        <Animated.View 
          style={[
            styles.legend, 
            { 
              zIndex: 2,
              minWidth: 160,
              width: categoryExpandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [160, 240],
              }),
              maxWidth: categoryExpandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [160, 240],
              }),
              maxHeight: categoryExpandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 320],
              }),
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.legendHeader}
            onPress={toggleCategoryExpanded}
            activeOpacity={0.7}
          >
            <View style={styles.legendHeaderContent}>
              <Text style={styles.legendTitle} numberOfLines={1}>Categories</Text>
              {!isCategoryExpanded && (
                <Text style={styles.legendCount}>
                  {selectedCategories.length}/4
                </Text>
              )}
            </View>
            <View style={styles.legendHeaderIcon}>
              {isCategoryExpanded ? (
                <TouchableOpacity 
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleCategoryExpanded();
                  }}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close" size={20} color="#666" />
                </TouchableOpacity>
              ) : (
                <Icon name="expand-more" size={24} color={COLORS.primary.teal} />
              )}
            </View>
          </TouchableOpacity>
          
          <Animated.View
            style={{
              height: categoryExpandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 220],
              }),
              opacity: categoryExpandAnim,
              overflow: 'hidden',
            }}
          >
            <View style={styles.legendExpandedContent}>
              <TouchableOpacity 
                onPress={toggleAllCategories} 
                style={styles.toggleAllButtonExpanded}
              >
                <Text style={styles.toggleAllTextExpanded}>
                  {selectedCategories.length === 4 ? 'Clear All' : 'Select All'}
                </Text>
              </TouchableOpacity>
              <View style={styles.legendItems}>
                <TouchableOpacity
                  style={styles.legendItemExpanded}
                  onPress={() => toggleCategory('beach')}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.legendColorExpanded,
                    { backgroundColor: '#FF6B6B' },
                    !selectedCategories.includes('beach') && styles.legendColorDisabled
                  ]} />
                  <Text style={[
                    styles.legendTextExpanded,
                    !selectedCategories.includes('beach') && styles.legendTextDisabled
                  ]} numberOfLines={1}>🏖️ Beach</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.legendItemExpanded}
                  onPress={() => toggleCategory('camps')}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.legendColorExpanded,
                    { backgroundColor: '#FFEAA7' },
                    !selectedCategories.includes('camps') && styles.legendColorDisabled
                  ]} />
                  <Text style={[
                    styles.legendTextExpanded,
                    !selectedCategories.includes('camps') && styles.legendTextDisabled
                  ]} numberOfLines={1}>⛺ Camps</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.legendItemExpanded}
                  onPress={() => toggleCategory('hotel')}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.legendColorExpanded,
                    { backgroundColor: '#A29BFE' },
                    !selectedCategories.includes('hotel') && styles.legendColorDisabled
                  ]} />
                  <Text style={[
                    styles.legendTextExpanded,
                    !selectedCategories.includes('hotel') && styles.legendTextDisabled
                  ]} numberOfLines={1}>🏨 Hotel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.legendItemExpanded}
                  onPress={() => toggleCategory('sauna')}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.legendColorExpanded,
                    { backgroundColor: '#FD79A8' },
                    !selectedCategories.includes('sauna') && styles.legendColorDisabled
                  ]} />
                  <Text style={[
                    styles.legendTextExpanded,
                    !selectedCategories.includes('sauna') && styles.legendTextDisabled
                  ]} numberOfLines={1}>🧖 Sauna</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
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
    overflow: 'hidden',
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    gap: 12,
  },
  legendHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  legendTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  legendCount: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primary.teal,
  },
  legendHeaderIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  legendExpandedContent: {
    paddingTop: 8,
  },
  toggleAllButtonExpanded: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.primary.teal,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  toggleAllTextExpanded: {
    fontSize: 13,
    color: 'white',
    fontWeight: '600',
  },
  legendItems: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendItemExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendColorExpanded: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  legendText: {
    fontSize: 9,
    color: '#666',
    flex: 1,
  },
  legendTextExpanded: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
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
