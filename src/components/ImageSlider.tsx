/**
 * ImageSlider Component
 * Displays multiple images in a swipeable carousel with indicators
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Text,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface ImageSliderProps {
  images: string[];
  height?: number;
  showIndicators?: boolean;
  showNavigation?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  onImagePress?: (index: number) => void;
  placeholderImage?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export const ImageSlider: React.FC<ImageSliderProps> = ({
  images,
  height = 200,
  showIndicators = true,
  showNavigation = true,
  autoPlay = false,
  autoPlayInterval = 3000,
  onImagePress,
  placeholderImage,
  resizeMode = 'cover',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState<boolean[]>([]);
  const [imageErrors, setImageErrors] = useState<boolean[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize loading and error states
  useEffect(() => {
    setImageLoading(new Array(images.length).fill(true));
    setImageErrors(new Array(images.length).fill(false));
  }, [images.length]);

  // Auto-play functionality
  useEffect(() => {
    if (autoPlay && images.length > 1) {
      autoPlayTimerRef.current = setInterval(() => {
        const nextIndex = (currentIndex + 1) % images.length;
        scrollToIndex(nextIndex);
      }, autoPlayInterval);
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [autoPlay, currentIndex, images.length, autoPlayInterval]);

  const scrollToIndex = (index: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentIndex(index);
    }
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < images.length) {
      setCurrentIndex(index);
    }
  };

  const goToPrevious = () => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    scrollToIndex(prevIndex);
  };

  const goToNext = () => {
    const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    scrollToIndex(nextIndex);
  };

  const handleImageLoad = (index: number) => {
    setImageLoading((prev) => {
      const newState = [...prev];
      newState[index] = false;
      return newState;
    });
  };

  const handleImageError = (index: number) => {
    setImageLoading((prev) => {
      const newState = [...prev];
      newState[index] = false;
      return newState;
    });
    setImageErrors((prev) => {
      const newState = [...prev];
      newState[index] = true;
      return newState;
    });
  };

  if (!images || images.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        {placeholderImage ? (
          <Image
            source={placeholderImage}
            style={[styles.image, { height }]}
            resizeMode={resizeMode}
          />
        ) : (
          <View style={[styles.placeholder, { height }]}>
            <Icon name="image" size={40} color={COLORS.primary.teal} />
            <Text style={styles.placeholderText}>No images available</Text>
          </View>
        )}
      </View>
    );
  }

  if (images.length === 1) {
    return (
      <View style={[styles.container, { height }]}>
        <TouchableOpacity
          activeOpacity={onImagePress ? 0.8 : 1}
          onPress={() => onImagePress?.(0)}
          style={styles.singleImageContainer}
        >
          <FastImage
            source={{ uri: images[0] }}
            style={[styles.image, { height }]}
            resizeMode={FastImage.resizeMode[resizeMode]}
            onLoadStart={() => handleImageLoad(0)}
            onLoad={() => handleImageLoad(0)}
            onError={() => handleImageError(0)}
          />
          {imageLoading[0] && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.primary.teal} />
            </View>
          )}
          {imageErrors[0] && placeholderImage && (
            <Image
              source={placeholderImage}
              style={[styles.image, { height }]}
              resizeMode={resizeMode}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {images.map((imageUri, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={onImagePress ? 0.8 : 1}
            onPress={() => onImagePress?.(index)}
            style={styles.imageContainer}
          >
            <FastImage
              source={{ uri: imageUri }}
              style={[styles.image, { height, width: SCREEN_WIDTH }]}
              resizeMode={FastImage.resizeMode[resizeMode]}
              onLoadStart={() => {
                setImageLoading((prev) => {
                  const newState = [...prev];
                  newState[index] = true;
                  return newState;
                });
              }}
              onLoad={() => handleImageLoad(index)}
              onError={() => handleImageError(index)}
            />
            {imageLoading[index] && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={COLORS.primary.teal} />
              </View>
            )}
            {imageErrors[index] && placeholderImage && (
              <Image
                source={placeholderImage}
                style={[styles.image, { height, width: SCREEN_WIDTH }]}
                resizeMode={resizeMode}
              />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Navigation Arrows */}
      {showNavigation && images.length > 1 && (
        <>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonLeft]}
            onPress={goToPrevious}
            activeOpacity={0.7}
          >
            <Icon name="chevron-left" size={28} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonRight]}
            onPress={goToNext}
            activeOpacity={0.7}
          >
            <Icon name="chevron-right" size={28} color="white" />
          </TouchableOpacity>
        </>
      )}

      {/* Indicators */}
      {showIndicators && images.length > 1 && (
        <View style={styles.indicatorsContainer}>
          {images.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.indicator,
                index === currentIndex && styles.indicatorActive,
              ]}
              onPress={() => scrollToIndex(index)}
            />
          ))}
        </View>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <View style={styles.counterContainer}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  image: {
    width: SCREEN_WIDTH,
  },
  singleImageContainer: {
    width: '100%',
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
  navButtonLeft: {
    left: 10,
  },
  navButtonRight: {
    right: 10,
  },
  indicatorsContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  indicatorActive: {
    backgroundColor: COLORS.primary.teal,
    width: 20,
  },
  counterContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ImageSlider;

