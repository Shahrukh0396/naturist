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

interface PlaceCardProps {
  place: Place;
  onPress: (place: Place) => void;
}

const { width } = Dimensions.get('window');
const cardWidth = width * 0.8;

const PlaceCard: React.FC<PlaceCardProps> = ({ place, onPress }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  // Reset loading state when place changes
  useEffect(() => {
    setImageLoading(true);
    setImageError(false);
    setRetryCount(0);
    setCurrentImageIndex(0);
    
    // Fallback: Hide loading after 10 seconds if image doesn't fire onLoad
    const timeout = setTimeout(() => {
      console.log('⏰ Loading timeout - forcing hide overlay for:', place.name);
      setImageLoading(false);
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [place.id, place.image]);

  // Get the best available image
  const getImageSource = () => {
    // Try the main image first (if it exists and is valid)
    if (place.image && typeof place.image === 'string' && place.image.startsWith('http')) {
      return place.image;
    }
    
    // Try images array
    if (place.images && place.images.length > 0) {
      const imageFromArray = place.images[currentImageIndex] || place.images[0];
      if (imageFromArray && typeof imageFromArray === 'string' && imageFromArray.startsWith('http')) {
        return imageFromArray;
      }
    }
    
    // Fallback to category-specific default images
    const categoryDefaults = {
      'beach': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
      'camps': 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=400',
      'hotel': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
      'sauna': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
      'other': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    };
    
    return categoryDefaults[place.category] || categoryDefaults['other'];
  };

  const imageSource = getImageSource();

  // Handle image load errors with retry logic
  const handleImageLoadError = () => {
    if (retryCount < 2) {
      console.log(`🔄 Retrying image load (attempt ${retryCount + 1}/2)...`);
      setTimeout(() => {
        setRetryCount(retryCount + 1);
        setImageLoading(true);
      }, 1000);
      return;
    }
    
    // Try next image in array if available
    if (place.images && place.images.length > currentImageIndex + 1) {
      console.log('🔄 Trying next image in array...');
      setCurrentImageIndex(currentImageIndex + 1);
      setRetryCount(0);
      setImageLoading(true);
    } else {
      console.log('❌ No more images to try, showing placeholder');
      setImageError(true);
      setImageLoading(false);
    }
  };

  // Debug logging (only in development)
  if (__DEV__) {
    console.log('📸 Place:', place.name);
    console.log('📸 Main image:', place.image);
    console.log('📸 Images array length:', place.images?.length || 0);
    console.log('📸 Using image source:', imageSource);
    console.log('📸 Image source type:', typeof imageSource);
    console.log('📸 Image source valid:', typeof imageSource === 'string' && imageSource.startsWith('http'));
    console.log('📸 Image error state:', imageError);
    console.log('📸 Image loading state:', imageLoading);
  }

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={styles.star}>
          {i <= rating ? '★' : '☆'}
        </Text>
      );
    }
    return stars;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(place)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {!imageError && imageSource ? (
          <>
            <Image 
              key={imageSource}
              source={{ uri: imageSource }}
              resizeMode='cover' 
              style={styles.image}
              onLoad={(event) => {
                console.log('✅ Image loaded successfully:', imageSource);
                console.log('✅ Image dimensions:', {
                  width: event.nativeEvent.source.width,
                  height: event.nativeEvent.source.height,
                });
                setImageLoading(false);
                setImageError(false);
              }}
              onLoadStart={() => {
                console.log('🔄 Image load started:', imageSource);
                setImageLoading(true);
              }}
              onError={(error) => {
                console.log('❌ Image load error for:', imageSource);
                console.log('❌ Error details:', JSON.stringify(error.nativeEvent || {}));
                handleImageLoadError();
              }}
            />
            {imageLoading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}
          </>
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
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{place.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {place.description}
        </Text>
        <View style={styles.locationContainer}>
          <Text style={styles.location}>📍 {place.location.address}</Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.ratingContainer}>
            <View style={styles.stars}>
              {renderStars(place.rating)}
            </View>
            <Text style={styles.ratingText}>({place.rating})</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{place.priceRange}</Text>
          </View>
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
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
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
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // Reduced opacity to see image underneath
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    marginRight: 4,
  },
  star: {
    fontSize: 16,
    color: '#FFD700',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
  },
  priceContainer: {
    backgroundColor: COLORS.primary.mint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  price: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
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

export default PlaceCard;
