/**
 * Places Example Screen
 * Demonstrates usage of usePlaces hook with FastImage
 * Shows instant cached loading and background sync
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { usePlaces } from '../hooks/usePlaces';

const PlacesExampleScreen = () => {
  const { places, loading, error, refresh } = usePlaces({
    limit: 200,
    maxImagesPerPlace: 5,
    autoSync: true,
  });

  const renderPlace = ({ item }) => (
    <View style={styles.placeCard}>
      <FastImage
        source={{
          uri: item.image || 'https://via.placeholder.com/400x300',
          priority: FastImage.priority.normal,
        }}
        style={styles.placeImage}
        resizeMode={FastImage.resizeMode.cover}
        defaultSource={require('../assets/naturistLand.jpg')} // Fallback placeholder
      />
      <View style={styles.placeInfo}>
        <Text style={styles.placeTitle} numberOfLines={2}>
          {item.title || 'Untitled Place'}
        </Text>
        <Text style={styles.placeDescription} numberOfLines={2}>
          {item.description || 'No description available'}
        </Text>
        <View style={styles.placeMeta}>
          {item.rating > 0 && (
            <Text style={styles.placeRating}>⭐ {item.rating.toFixed(1)}</Text>
          )}
          {item.country && (
            <Text style={styles.placeCountry}>{item.country}</Text>
          )}
        </View>
        {item.imageUrls && item.imageUrls.length > 0 && (
          <Text style={styles.imageCount}>
            {item.imageUrls.length} image{item.imageUrls.length !== 1 ? 's' : ''} available
          </Text>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {loading ? 'Loading places...' : 'No places found'}
      </Text>
      {error && (
        <Text style={styles.errorText}>
          Error: {error.message || 'Unknown error'}
        </Text>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Places</Text>
      <Text style={styles.headerSubtitle}>
        {places.length > 0
          ? `${places.length} place${places.length !== 1 ? 's' : ''} loaded`
          : 'Loading...'}
      </Text>
      {loading && places.length === 0 && (
        <ActivityIndicator size="small" color="#007AFF" style={styles.loadingIndicator} />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={places}
        renderItem={renderPlace}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && places.length > 0}
            onRefresh={refresh}
            tintColor="#007AFF"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  listContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  loadingIndicator: {
    marginTop: 8,
  },
  placeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  placeImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#E0E0E0',
  },
  placeInfo: {
    padding: 16,
  },
  placeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  placeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  placeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  placeRating: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  placeCountry: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  imageCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default PlacesExampleScreen;

