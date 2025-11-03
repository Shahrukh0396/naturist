/**
 * Simple Image Test Component
 * Tests basic image loading functionality
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

const SimpleImageTest: React.FC = () => {
  const [currentTest, setCurrentTest] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const testImages = [
    {
      name: 'Unsplash Beach',
      url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
    },
    {
      name: 'Unsplash Camps',
      url: 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=400',
    },
    {
      name: 'Unsplash Hotel',
      url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
    },
    {
      name: 'AWS S3 Test (from JSON)',
      url: 'https://naturismimage.s3.us-east-2.amazonaws.com/1_1589786022_tmp.jpg',
    },
    {
      name: 'Google Places Test',
      url: 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=test&key=test',
    },
  ];

  const currentImage = testImages[currentTest];

  const testNextImage = () => {
    setCurrentTest((prev) => (prev + 1) % testImages.length);
    setImageError(false);
    setImageLoading(true);
  };

  const testPreviousImage = () => {
    setCurrentTest((prev) => (prev - 1 + testImages.length) % testImages.length);
    setImageError(false);
    setImageLoading(true);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Simple Image Loading Test</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Test: {currentImage.name}</Text>
        <Text style={styles.infoText}>URL: {currentImage.url}</Text>
        <Text style={styles.infoText}>Type: {typeof currentImage.url}</Text>
        <Text style={styles.infoText}>Starts with http: {currentImage.url.startsWith('http') ? 'Yes' : 'No'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Image Display</Text>
        <View style={styles.imageContainer}>
          {!imageError ? (
            <Image
              source={{ uri: currentImage.url }}
              style={styles.image}
              resizeMode="cover"
              onLoad={() => {
                console.log('✅ Test image loaded successfully:', currentImage.url);
                setImageLoading(false);
              }}
              onError={(error) => {
                console.log('❌ Test image load error:', currentImage.url);
                console.log('Error details:', error.nativeEvent.error);
                setImageError(true);
                setImageLoading(false);
              }}
            />
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>❌ Image Failed to Load</Text>
              <Text style={styles.errorUrl}>{currentImage.url}</Text>
            </View>
          )}
          
          {imageLoading && !imageError && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navigation</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={testPreviousImage}>
            <Text style={styles.buttonText}>Previous</Text>
          </TouchableOpacity>
          
          <Text style={styles.counter}>
            {currentTest + 1} / {testImages.length}
          </Text>
          
          <TouchableOpacity style={styles.button} onPress={testNextImage}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Test Images</Text>
        {testImages.map((image, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.imageItem,
              index === currentTest && styles.activeImageItem
            ]}
            onPress={() => {
              setCurrentTest(index);
              setImageError(false);
              setImageLoading(true);
            }}
          >
            <Text style={styles.imageItemText}>
              {index + 1}. {image.name}
            </Text>
            <Text style={styles.imageItemUrl}>
              {image.url.substring(0, 60)}...
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Information</Text>
        <Text style={styles.infoText}>Image Loading: {imageLoading ? 'Yes' : 'No'}</Text>
        <Text style={styles.infoText}>Image Error: {imageError ? 'Yes' : 'No'}</Text>
        <Text style={styles.infoText}>Current Test Index: {currentTest}</Text>
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
  counter: {
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
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '600',
  },
  imageItemUrl: {
    fontSize: 12,
    color: '#666',
  },
});

export default SimpleImageTest;


