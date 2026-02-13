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
import { getPlaceImagesFromStorage, isFirebaseStorageUrl } from '../services/firebaseStorageService';
import { capitalizeCountry } from '../utils/format';
import ImageCarousel from './ImageCarousel';

interface PlaceCardProps {
  place: Place;
  onPress: (place: Place) => void;
}

const { width } = Dimensions.get('window');
const cardWidth = width * 0.9;

const getPlaceFirebaseImages = (place: Place): string[] => {
  const out: string[] = [];
  if (place.image && isFirebaseStorageUrl(place.image)) out.push(place.image);
  if (place.images?.length) {
    place.images.forEach((img) => {
      if (isFirebaseStorageUrl(img) && !out.includes(img)) out.push(img);
    });
  }
  return out;
};

const PlaceCard: React.FC<PlaceCardProps> = ({ place, onPress }) => {
  const existingUrls = getPlaceFirebaseImages(place);
  const [images, setImages] = useState<string[]>(existingUrls);
  const [loadingImages, setLoadingImages] = useState(existingUrls.length === 0);

  // Load images when place changes (id or image/images from enhancement)
  useEffect(() => {
    const urls = getPlaceFirebaseImages(place);
    if (urls.length > 0) {
      setImages(urls);
      setLoadingImages(false);
      return;
    }
    loadImages();
  }, [place.id, place.image, place.images?.length]);

  const loadImages = async () => {
    setLoadingImages(true);
    try {
      const localImages = getPlaceFirebaseImages(place);
      // Priority 1: Fetch from Firebase Storage (sync script uses sql_id)
      try {
        const storageId = place.sqlId != null ? String(place.sqlId) : place.id;
        const alternateId = place.sqlId != null ? place.id : undefined;
        const firebaseImages = await getPlaceImagesFromStorage(storageId, 5, ...(alternateId ? [alternateId] : []));
        if (firebaseImages?.length > 0) {
          setImages(firebaseImages);
          setLoadingImages(false);
          return;
        }
      } catch (e) {
        if (__DEV__) console.warn(`⚠️ [PlaceCard] Firebase Storage error for ${place.name}:`, e);
      }
      // Priority 2: Use any Firebase URLs already on place
      if (localImages.length > 0) {
        setImages(localImages);
      } else {
        setImages([]);
      }
    } catch (error) {
      console.error(`❌ [PlaceCard] Error loading images for ${place.name}:`, error);
      setImages([]);
    }
    setLoadingImages(false);
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
          <View style={{ width: '100%', height: 200 }}>
            <ImageCarousel
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
