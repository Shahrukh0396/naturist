/**
 * ImageCarousel Component
 * Uses react-native-reanimated-carousel for smooth, performant image carousels.
 * API compatible with the previous react-native-image-slider-box usage.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';

export interface ImageCarouselProps {
  images: string[];
  sliderBoxHeight?: number;
  parentWidth?: number;
  dotColor?: string;
  inactiveDotColor?: string;
  paginationBoxVerticalPadding?: number;
  autoplay?: boolean;
  circleLoop?: boolean;
  resizeMethod?: 'resize' | 'scale' | 'auto';
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  onCurrentImagePressed?: (index: number) => void;
  /** Optional placeholder when an image URL is empty or invalid */
  placeholderImage?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  sliderBoxHeight = 200,
  parentWidth = SCREEN_WIDTH,
  dotColor = COLORS.primary.teal,
  inactiveDotColor = '#90A4AE',
  paginationBoxVerticalPadding = 20,
  autoplay = false,
  circleLoop = true,
  resizeMode = 'cover',
  onCurrentImagePressed,
  placeholderImage,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const onSnapToItem = useCallback(
    (index: number) => setCurrentIndex(index),
    []
  );

  const isValidImage = (uri: string) =>
    typeof uri === 'string' && uri.length > 0 && uri.startsWith('http');

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const content = !isValidImage(item) ? (
        <View style={[styles.placeholder, { height: sliderBoxHeight }]}>
          {placeholderImage ? (
            <Image
              source={placeholderImage}
              style={[styles.placeholderImg, { height: sliderBoxHeight }]}
              resizeMode={resizeMode}
            />
          ) : (
            <Icon name="image" size={48} color={COLORS.primary.teal} />
          )}
        </View>
      ) : (
        <FastImage
          source={{ uri: item }}
          style={[styles.image, { width: parentWidth, height: sliderBoxHeight }]}
          resizeMode={FastImage.resizeMode[resizeMode]}
        />
      );

      if (onCurrentImagePressed) {
        return (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => onCurrentImagePressed(index)}
            style={styles.slide}
          >
            {content}
          </TouchableOpacity>
        );
      }
      return <View style={styles.slide}>{content}</View>;
    },
    [
      sliderBoxHeight,
      parentWidth,
      resizeMode,
      onCurrentImagePressed,
      placeholderImage,
    ]
  );

  if (!images || images.length === 0) {
    return (
      <View style={[styles.container, { width: parentWidth, height: sliderBoxHeight }]}>
        {placeholderImage ? (
          <Image
            source={placeholderImage}
            style={[styles.image, { width: parentWidth, height: sliderBoxHeight }]}
            resizeMode={resizeMode}
          />
        ) : (
          <View style={[styles.placeholder, { height: sliderBoxHeight }]}>
            <Icon name="image" size={48} color={COLORS.primary.teal} />
          </View>
        )}
      </View>
    );
  }

  if (images.length === 1) {
    return (
      <View style={[styles.container, { width: parentWidth, height: sliderBoxHeight }]}>
        {renderItem({ item: images[0], index: 0 })}
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: parentWidth, height: sliderBoxHeight }]}>
      <Carousel
        width={parentWidth}
        height={sliderBoxHeight}
        data={images}
        renderItem={renderItem}
        loop={circleLoop}
        autoPlay={autoplay}
        autoPlayInterval={4000}
        onSnapToItem={onSnapToItem}
        pagingEnabled
        scrollAnimationDuration={300}
      />
      {/* Pagination dots */}
      <View
        style={[
          styles.pagination,
          { paddingVertical: paginationBoxVerticalPadding },
        ]}
      >
        {images.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === currentIndex ? dotColor : inactiveDotColor },
              i === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  slide: {
    flex: 1,
  },
  image: {
    backgroundColor: '#000',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderImg: {
    width: '100%',
  },
  pagination: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 20,
  },
});

export default ImageCarousel;
