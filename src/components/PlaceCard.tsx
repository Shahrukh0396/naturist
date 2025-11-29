import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Place } from '../types';
import { COLORS } from '../theme/colors';
import { getPlaceImagesFromStorage } from '../services/firebaseStorageService';

// Lazy load ImageSlider to avoid Android initialization issues
let ImageSlider: any = null;
try {
  ImageSlider = require('react-native-image-slider-box').default;
} catch (error) {
  console.warn('Failed to load react-native-image-slider-box:', error);
}

interface PlaceCardProps {
  place: Place;
  onPress: (place: Place) => void;
}

const { width } = Dimensions.get('window');
const cardWidth = width * 0.8;

const PlaceCard: React.FC<PlaceCardProps> = ({ place, onPress }) => {
  const [images, setImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);

  // Load images from Firebase Storage when place changes
  useEffect(() => {
    loadImages();
  }, [place.id]);

  const loadImages = async () => {
    setLoadingImages(true);
    
    try {
      // First, try to get images from Firebase Storage
      const firebaseImages = await getPlaceImagesFromStorage(place.id, 5);
      
      if (firebaseImages && firebaseImages.length > 0) {
        // Use Firebase Storage images
        setImages(firebaseImages);
      } else {
        // Fallback to local images
        const localImages: string[] = [];
        
        // Add main image if available
        if (place.image && typeof place.image === 'string' && place.image.startsWith('http')) {
          localImages.push(place.image);
        }
        
        // Add images from images array
        if (place.images && Array.isArray(place.images)) {
          place.images.forEach((img) => {
            if (typeof img === 'string' && img.startsWith('http') && !localImages.includes(img)) {
              localImages.push(img);
            }
          });
        }
        
        // If no images found, use category default
        if (localImages.length === 0) {
          const categoryDefaults = {
            'beach': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
            'camps': 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=400',
            'hotel': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
            'sauna': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
            'other': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
          };
          localImages.push(categoryDefaults[place.category] || categoryDefaults['other']);
        }
        
        setImages(localImages);
      }
    } catch (error) {
      console.error('Error loading images:', error);
      // Fallback to local images
      const localImages: string[] = [];
      if (place.image && typeof place.image === 'string' && place.image.startsWith('http')) {
        localImages.push(place.image);
      } else if (place.images && place.images.length > 0) {
        localImages.push(...place.images.filter((img): img is string => 
          typeof img === 'string' && img.startsWith('http')
        ));
      }
      if (localImages.length === 0) {
        const categoryDefaults = {
          'beach': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
          'camps': 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=400',
          'hotel': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
          'sauna': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
          'other': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
        };
        localImages.push(categoryDefaults[place.category] || categoryDefaults['other']);
      }
      setImages(localImages);
    } finally {
      setLoadingImages(false);
    }
  };


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
        {loadingImages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary.teal} />
            <Text style={styles.loadingText}>Loading images...</Text>
          </View>
        ) : images.length > 0 ? (
          ImageSlider ? (
            <View style={{ width: '100%', height: 200 }}>
              <ImageSlider
                images={images}
                sliderBoxHeight={200}
                parentWidth={cardWidth}
                dotColor={COLORS.primary.teal}
                inactiveDotColor="#90A4AE"
                paginationBoxVerticalPadding={20}
                autoplay={images.length > 1}
                circleLoop={images.length > 1}
                resizeMethod={'resize'}
                resizeMode={'cover'}
              />
            </View>
          ) : (
            <View style={{ width: '100%', height: 200 }}>
              <Image
                source={{ uri: images[0] }}
                style={{ width: '100%', height: 200 }}
                resizeMode="cover"
              />
            </View>
          )
        ) : (
          <View style={styles.placeholderContainer}>
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
  loadingContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.primary.teal,
    fontWeight: '500',
    marginTop: 8,
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
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
