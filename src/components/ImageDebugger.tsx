/**
 * Image Debugger Component
 * Helps debug image loading issues
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Place } from '../types';

interface ImageDebuggerProps {
  place: Place;
}

const ImageDebugger: React.FC<ImageDebuggerProps> = ({ place }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const getCurrentImage = () => {
    if (place.images && place.images.length > 0) {
      return place.images[currentImageIndex] || place.images[0];
    }
    return place.image || '';
  };

  const currentImage = getCurrentImage();

  const testImageUrl = (url: string) => {
    console.log('Testing image URL:', url);
    console.log('URL type:', typeof url);
    console.log('URL starts with http:', url.startsWith('http'));
    console.log('URL length:', url.length);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Image Debugger for: {place.name}</Text>
      
      {/* Place Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Place Information</Text>
        <Text style={styles.infoText}>Name: {place.name}</Text>
        <Text style={styles.infoText}>Category: {place.category}</Text>
        <Text style={styles.infoText}>Main Image: {place.image || 'None'}</Text>
        <Text style={styles.infoText}>Images Array Length: {place.images?.length || 0}</Text>
      </View>

      {/* Current Image */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Image (Index: {currentImageIndex})</Text>
        <Text style={styles.infoText}>URL: {currentImage}</Text>
        <Text style={styles.infoText}>Type: {typeof currentImage}</Text>
        <Text style={styles.infoText}>Starts with http: {currentImage.startsWith('http') ? 'Yes' : 'No'}</Text>
        
        <TouchableOpacity
          style={styles.button}
          onPress={() => testImageUrl(currentImage)}
        >
          <Text style={styles.buttonText}>Test This URL</Text>
        </TouchableOpacity>
      </View>

      {/* Image Display */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Image Display</Text>
        <View style={styles.imageContainer}>
          {!imageError ? (
            <Image
              source={{ uri: currentImage }}
              style={styles.image}
              resizeMode="cover"
              onLoad={() => {
                console.log('✅ Image loaded successfully:', currentImage);
                setImageLoading(false);
              }}
              onError={(error) => {
                console.log('❌ Image load error:', currentImage);
                console.log('Error details:', error.nativeEvent.error);
                setImageError(true);
                setImageLoading(false);
              }}
            />
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>❌ Image Failed to Load</Text>
              <Text style={styles.errorUrl}>{currentImage}</Text>
            </View>
          )}
          
          {imageLoading && !imageError && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Image Navigation */}
      {place.images && place.images.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Image Navigation</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, currentImageIndex === 0 && styles.disabledButton]}
              onPress={() => {
                if (currentImageIndex > 0) {
                  setCurrentImageIndex(currentImageIndex - 1);
                  setImageError(false);
                  setImageLoading(true);
                }
              }}
              disabled={currentImageIndex === 0}
            >
              <Text style={styles.buttonText}>Previous</Text>
            </TouchableOpacity>
            
            <Text style={styles.imageCounter}>
              {currentImageIndex + 1} / {place.images.length}
            </Text>
            
            <TouchableOpacity
              style={[styles.button, currentImageIndex >= place.images.length - 1 && styles.disabledButton]}
              onPress={() => {
                if (currentImageIndex < place.images.length - 1) {
                  setCurrentImageIndex(currentImageIndex + 1);
                  setImageError(false);
                  setImageLoading(true);
                }
              }}
              disabled={currentImageIndex >= place.images.length - 1}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* All Images List */}
      {place.images && place.images.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Images</Text>
          {place.images.map((imageUrl, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.imageItem,
                index === currentImageIndex && styles.activeImageItem
              ]}
              onPress={() => {
                setCurrentImageIndex(index);
                setImageError(false);
                setImageLoading(true);
              }}
            >
              <Text style={styles.imageItemText}>
                {index + 1}. {imageUrl.substring(0, 50)}...
              </Text>
              <Text style={styles.imageItemType}>
                Type: {typeof imageUrl} | HTTP: {imageUrl.startsWith('http') ? 'Yes' : 'No'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Test Default Images */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Default Images</Text>
        {[
          'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
          'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=400',
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
        ].map((url, index) => (
          <TouchableOpacity
            key={index}
            style={styles.button}
            onPress={() => {
              setCurrentImageIndex(0);
              setImageError(false);
              setImageLoading(true);
              // This would need to be handled by parent component
              console.log('Testing default image:', url);
            }}
          >
            <Text style={styles.buttonText}>Test Default {index + 1}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageCounter: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorUrl: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
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
  imageItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginBottom: 8,
  },
  activeImageItem: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  imageItemText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
  imageItemType: {
    fontSize: 10,
    color: '#666',
  },
});

export default ImageDebugger;


