import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRoute, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Place, RootTabParamList } from '../types';
import { loadPlaces } from '../services/placesService';
import { getCurrentLocation, Location } from '../services/locationService';
import GradientBackground from '../components/GradientBackground';
import { MapPlace } from '../components/mapPlace';
import { COLORS } from '../theme/colors';
import { useScreenImagePreloader } from '../hooks/useImagePreloader';

type MapScreenRouteProp = RouteProp<RootTabParamList, 'Map'>;

const MapScreen: React.FC = () => {
  const route = useRoute<MapScreenRouteProp>();
  const mapRef = useRef<MapView>(null);
  const locationUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<Location>({
    latitude: 37.7749,
    longitude: -122.4194,
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'beach', 'camps', 'hotel', 'sauna'
  ]);

  // Initialize image preloader for map screen
  const { isImagePreloaded, getPreloadedImageUrl, getCacheStats } = useScreenImagePreloader(
    'map',
    userLocation,
    {
      selectedCategory: selectedCategories.join(','),
      currentPlaces: filteredPlaces,
    }
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
        // Center map on the selected place
        mapRef.current?.animateToRegion({
          latitude: place.location.latitude,
          longitude: place.location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
        
        // Select the place and show modal
        setSelectedPlace(place);
        setIsModalVisible(true);
        
        // Ensure the place's category is selected
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
      const allPlaces = await loadPlaces(location);
      // Limit to 100 places for map performance
      setPlaces(allPlaces.slice(0, 100));
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
          <Text style={styles.title}>Map View</Text>
          <Text style={styles.subtitle}>
            {isLoading ? 'Loading...' : 
             selectedCategories.length === 0 ? 'No categories selected' :
             `${filteredPlaces.length} places on map`}
          </Text>
        </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
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
          <View style={styles.emptyStateOverlay}>
            <Text style={styles.emptyStateText}>Select categories to view places</Text>
          </View>
        )}
      </View>

      <MapPlace
        modal={isModalVisible}
        setModal={handleCloseModal}
        data={selectedPlace}
        userLocation={userLocation}
      />

      <View style={styles.legend}>
        <View style={styles.legendHeader}>
          <Text style={styles.legendTitle}>Categories:</Text>
          <TouchableOpacity onPress={toggleAllCategories} style={styles.toggleAllButton}>
            <Text style={styles.toggleAllText}>
              {selectedCategories.length === 4 ? 'Clear All' : 'Select All'}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary.darkPurple,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.primary.blue,
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
    top: 100,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    maxHeight: 300,
    width: 140,
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
