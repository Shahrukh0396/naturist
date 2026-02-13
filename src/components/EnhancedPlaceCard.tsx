/**
 * Enhanced PlaceCard with Image Preloading Support
 * Uses preloaded images for better performance and user experience
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Place } from '../types';
import { COLORS } from '../theme/colors';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { getPlaceImagesFromStorage, isFirebaseStorageUrl } from '../services/firebaseStorageService';
import { capitalizeCountry } from '../utils/format';

interface EnhancedPlaceCardProps {
  place: Place;
  onPress: (place: Place) => void;
  preloadImages?: boolean;
}

const { width } = Dimensions.get('window');
const cardWidth = width * 0.8;

const EnhancedPlaceCard: React.FC<EnhancedPlaceCardProps> = ({
  place,
  onPress,
  preloadImages = true
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [imageSource, setImageSource] = useState<string>('');
  const [firebaseImage, setFirebaseImage] = useState<string>('');

  const { isImagePreloaded, getPreloadedImageUrl } = useImagePreloader();

  // Fetch Firebase Storage images when place has no Firebase image
  useEffect(() => {
    let cancelled = false;
    const hasFirebaseImage = (place.image && isFirebaseStorageUrl(place.image)) ||
      (place.images?.length && isFirebaseStorageUrl(place.images[0]));
    if (hasFirebaseImage) {
      setFirebaseImage('');
      return;
    }
    const storageId = place.sqlId != null ? String(place.sqlId) : place.id;
    const alternateId = place.sqlId != null ? place.id : undefined;
    getPlaceImagesFromStorage(storageId, 5, ...(alternateId ? [alternateId] : []))
      .then((urls) => {
        if (!cancelled && urls?.length > 0) setFirebaseImage(urls[0]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [place.id, place.sqlId, place.image, place.images]);

  // Resolve image source: Firebase only, no Unsplash
  const getImageSource = (): string => {
    if (firebaseImage) return firebaseImage;
    if (place.image && typeof place.image === 'string' && isFirebaseStorageUrl(place.image)) {
      return place.image;
    }
    if (place.images && place.images.length > 0) {
      const imageFromArray = place.images[currentImageIndex] || place.images[0];
      if (imageFromArray && isFirebaseStorageUrl(imageFromArray)) return imageFromArray;
    }
    return '';
  };

  // Update image source when place, firebaseImage, or currentImageIndex changes
  useEffect(() => {
    const newImageSource = getImageSource();
    setImageSource(newImageSource);
    setImageError(false);
    setImageLoading(!newImageSource);
    setRetryCount(0);
  }, [place, firebaseImage, currentImageIndex]);

  // Check if image is preloaded and update loading state
  useEffect(() => {
    if (preloadImages && isImagePreloaded(imageSource)) {
      setImageLoading(false);
    }
  }, [imageSource, preloadImages, isImagePreloaded]);

  const handleImageError = (error: any) => {
    console.log('Image load error for:', imageSource);
    console.log('Error details:', error.nativeEvent.error);
    console.log('Retry count:', retryCount);
    
    // Try to retry the same image first (network issues)
    if (retryCount < 2) {
      setRetryCount(retryCount + 1);
      setImageLoading(true);
      return;
    }
    
    // Try next image in array if available
    if (place.images && place.images.length > currentImageIndex + 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      setRetryCount(0);
      setImageLoading(true);
    } else {
      setImageError(true);
      setImageLoading(false);
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const hasImage = imageSource.length > 0;
  const showPlaceholder = !hasImage || imageError;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(place)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {!showPlaceholder ? (
          <Image 
            source={{ uri: imageSource }} 
            resizeMode='cover' 
            style={styles.image}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>
              {place.category === 'beach' ? '🏖️' : 
               place.category === 'camps' ? '⛺' : 
               place.category === 'hotel' ? '🏨' : 
               place.category === 'sauna' ? '🧖' : '📍'}
            </Text>
            <Text style={styles.placeholderSubtext}>No Image Available</Text>
          </View>
        )}
        
        {/* Loading indicator */}
        {imageLoading && hasImage && !imageError && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {/* Preload indicator */}
        {hasImage && preloadImages && isImagePreloaded(imageSource) && !imageLoading && (
          <View style={styles.preloadIndicator}>
            <Text style={styles.preloadText}>⚡</Text>
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={styles.name}>{place.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {place.description || 'No description available'}
        </Text>
        <View style={styles.locationContainer}>
          <Text style={styles.location}>📍 {capitalizeCountry(place.location.address || '')}</Text>
        </View>
        {place.distance && (
          <Text style={styles.distance}>{place.distance.toFixed(1)} km away</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: cardWidth,
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  preloadIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  preloadText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary.darkPurple,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  locationContainer: {
    marginBottom: 12,
  },
  location: {
    fontSize: 12,
    color: '#888',
  },
  distance: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default EnhancedPlaceCard;
