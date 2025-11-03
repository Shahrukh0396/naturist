import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface LocationError {
  code: number;
  message: string;
}

// Default location (San Francisco) as fallback
export const DEFAULT_LOCATION: Location = {
  latitude: 37.7749,
  longitude: -122.4194,
};

/**
 * Request location permission for Android
 */
const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return true; // iOS handles permissions automatically
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'This app needs access to your location to show nearby places.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Error requesting location permission:', err);
    return false;
  }
};

/**
 * Get current user location
 */
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Request permission first
      const hasPermission = await requestLocationPermission();
      
      if (!hasPermission) {
        console.log('Location permission denied, using default location');
        resolve(DEFAULT_LOCATION);
        return;
      }

      // Get current position
      Geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          console.log('Current location:', location);
          resolve(location);
        },
        (error: LocationError) => {
          console.warn('Error getting location:', error);
          
          // Show user-friendly error message
          let errorMessage = 'Unable to get your location. Using default location.';
          
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = 'Location permission denied. Using default location.';
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = 'Location information unavailable. Using default location.';
              break;
            case 3: // TIMEOUT
              errorMessage = 'Location request timed out. Using default location.';
              break;
          }
          
          Alert.alert('Location Error', errorMessage);
          resolve(DEFAULT_LOCATION);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    } catch (error) {
      console.error('Error in getCurrentLocation:', error);
      resolve(DEFAULT_LOCATION);
    }
  });
};

/**
 * Watch user location changes
 */
export const watchLocation = (
  onLocationUpdate: (location: Location) => void,
  onError?: (error: LocationError) => void
): number => {
  return Geolocation.watchPosition(
    (position) => {
      const location: Location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      onLocationUpdate(location);
    },
    (error: LocationError) => {
      console.warn('Error watching location:', error);
      if (onError) {
        onError(error);
      }
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 100, // Update every 100 meters
      interval: 10000, // Update every 10 seconds
    }
  );
};

/**
 * Stop watching location
 */
export const stopWatchingLocation = (watchId: number): void => {
  Geolocation.clearWatch(watchId);
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Check if a location is within a certain radius of another location
 */
export const isWithinRadius = (
  userLocation: Location,
  placeLocation: Location,
  radiusKm: number
): boolean => {
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    placeLocation.latitude,
    placeLocation.longitude
  );
  return distance <= radiusKm;
};
