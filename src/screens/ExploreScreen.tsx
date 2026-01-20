import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Place, FilterOptions, RootTabParamList } from '../types';
import SearchBar from '../components/SearchBar';
import PlaceCard from '../components/PlaceCard';
import GradientBackground from '../components/GradientBackground';
import { COLORS } from '../theme/colors';
import ImageCarousel from '../components/ImageCarousel';
import { 
  loadPlaces, 
  searchPlaces, 
  filterPlaces,
  searchPlacesFromAPI
} from '../services/placesService';
import { getCurrentLocation, Location } from '../services/locationService';
import { useScreenImagePreloader } from '../hooks/useImagePreloader';

const categories = ['beach', 'camps', 'hotel', 'sauna', 'other'];
const priceRanges = ['$', '$$', '$$$', '$$$$'];

type ExploreScreenNavigationProp = BottomTabNavigationProp<RootTabParamList, 'Explore'>;

const ExploreScreen: React.FC = () => {
  const navigation = useNavigation<ExploreScreenNavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [featuredPlaces, setFeaturedPlaces] = useState<Place[]>([]);
  const [featuredImages, setFeaturedImages] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    category: [],
    priceRange: [],
    rating: 0,
    distance: 100,
  });

  // Initialize image preloader for explore screen
  const { isImagePreloaded, getPreloadedImageUrl, getCacheStats } = useScreenImagePreloader(
    'explore',
    userLocation,
    {
      searchQuery,
      selectedCategory,
      currentPlaces: filteredPlaces,
    }
  );

  useEffect(() => {
    loadPlacesData();
  }, []);

  const loadPlacesData = async () => {
    try {
      setIsLoading(true);
      
      // Get user's current location
      const location = await getCurrentLocation();
      setUserLocation(location);
      
      // Load places with user location (from Firebase or local JSON)
      const places = await loadPlaces(location);
      setAllPlaces(places);
      setFilteredPlaces(places.slice(0, 50)); // Limit initial load for performance
      
      // Set featured places (top rated places with images)
      const featured = places
        .filter(p => p.rating >= 4 && (p.image || (p.images && p.images.length > 0)))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5);
      setFeaturedPlaces(featured);
      
      // Load featured images
      if (featured.length > 0) {
        const images: string[] = [];
        featured.forEach(place => {
          if (place.image && typeof place.image === 'string' && place.image.startsWith('http')) {
            images.push(place.image);
          } else if (place.images && place.images.length > 0) {
            const firstImage = place.images.find((img): img is string => 
              typeof img === 'string' && img.startsWith('http')
            );
            if (firstImage) images.push(firstImage);
          }
        });
        setFeaturedImages(images);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading places:', error);
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    // Use Google Places API for search if query is provided
    if (query.trim() && userLocation) {
      try {
        const searchResults = await searchPlacesFromAPI(query, userLocation);
        setFilteredPlaces(searchResults.slice(0, 100));
      } catch (error) {
        console.error('Error searching places:', error);
        // Fallback to local search
        applyFilters(query);
      }
    } else {
      applyFilters(query);
    }
  };

  const applyFilters = (query: string = searchQuery) => {
    if (!userLocation) return;
    
    let filtered = allPlaces;

    // Apply search query
    if (query.trim()) {
      filtered = searchPlaces(query, userLocation);
    }

    // Apply other filters
    filtered = filterPlaces(filtered, {
      category: filters.category.length > 0 ? filters.category : undefined,
      priceRange: filters.priceRange.length > 0 ? filters.priceRange : undefined,
      rating: filters.rating > 0 ? filters.rating : undefined,
      distance: filters.distance < 100 ? filters.distance : undefined,
    });

    setFilteredPlaces(filtered.slice(0, 100)); // Limit results for performance
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    applyFilters();
  };

  const handlePlacePress = (place: Place) => {
    // Navigate to Map screen with the selected place ID
    navigation.navigate('Map', { placeId: place.id });
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.category.includes(category)
      ? filters.category.filter(c => c !== category)
      : [...filters.category, category];
    handleFilterChange({ ...filters, category: newCategories });
  };

  const togglePriceRange = (priceRange: string) => {
    const newPriceRanges = filters.priceRange.includes(priceRange)
      ? filters.priceRange.filter(p => p !== priceRange)
      : [...filters.priceRange, priceRange];
    handleFilterChange({ ...filters, priceRange: newPriceRanges });
  };

  const renderPlace = ({ item }: { item: Place }) => (
    <View style={styles.placeCard}>
      <PlaceCard place={item} onPress={handlePlacePress} />
    </View>
  );

  const renderFilters = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.filterModal}>
        <View style={styles.filterHeader}>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.filterTitle}>Filters</Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={styles.applyButton}>Apply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.filterContent}>
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Category</Text>
            <View style={styles.filterOptions}>
              {categories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.filterOption,
                    filters.category.includes(category) && styles.filterOptionSelected,
                  ]}
                  onPress={() => toggleCategory(category)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filters.category.includes(category) && styles.filterOptionTextSelected,
                    ]}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Price Range</Text>
            <View style={styles.filterOptions}>
              {priceRanges.map(priceRange => (
                <TouchableOpacity
                  key={priceRange}
                  style={[
                    styles.filterOption,
                    filters.priceRange.includes(priceRange) && styles.filterOptionSelected,
                  ]}
                  onPress={() => togglePriceRange(priceRange)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filters.priceRange.includes(priceRange) && styles.filterOptionTextSelected,
                    ]}
                  >
                    {priceRange}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Minimum Rating</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map(rating => (
                <TouchableOpacity
                  key={rating}
                  style={[
                    styles.ratingOption,
                    filters.rating >= rating && styles.ratingOptionSelected,
                  ]}
                  onPress={() => handleFilterChange({ ...filters, rating })}
                >
                  <Text style={styles.ratingText}>{rating}+</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Explore Places</Text>
          <Text style={styles.subtitle}>
            {isLoading ? 'Loading...' : `${filteredPlaces.length} places found`}
          </Text>
        </View>

        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          onSearch={() => applyFilters()}
          showFilterButton
          onFilterPress={() => setShowFilters(true)}
          placeholder="Search places, locations..."
        />

        {!isLoading && featuredImages.length > 0 && (
          <View style={styles.featuredContainer}>
            <Text style={styles.featuredTitle}>Featured Places</Text>
            <View style={{ width: '100%', height: 200 }}>
              <ImageCarousel
                images={featuredImages}
                sliderBoxHeight={200}
                parentWidth={Dimensions.get('window').width - 32}
                dotColor={COLORS.primary.teal}
                inactiveDotColor="#90A4AE"
                paginationBoxVerticalPadding={20}
                autoplay={true}
                circleLoop={true}
                resizeMethod={'resize'}
                resizeMode={'cover'}
                onCurrentImagePressed={(index) => {
                  if (featuredPlaces[index]) {
                    handlePlacePress(featuredPlaces[index]);
                  }
                }}
              />
            </View>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading places...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredPlaces}
            renderItem={renderPlace}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {renderFilters()}
      </SafeAreaView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary.darkPurple,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.primary.blue,
  },
  listContent: {
    paddingVertical: 16,
  },
  placeCard: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  filterModal: {
    flex: 1,
    backgroundColor: 'white',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  applyButton: {
    fontSize: 16,
    color: COLORS.primary.teal,
    fontWeight: '600',
  },
  filterContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  filterSection: {
    marginVertical: 20,
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  filterOptionSelected: {
    backgroundColor: COLORS.primary.teal,
    borderColor: COLORS.primary.teal,
  },
  filterOptionText: {
    fontSize: 14,
    color: '#333',
  },
  filterOptionTextSelected: {
    color: 'white',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  ratingOptionSelected: {
    backgroundColor: COLORS.primary.teal,
    borderColor: COLORS.primary.teal,
  },
  ratingText: {
    fontSize: 14,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.white,
  },
  featuredContainer: {
    marginVertical: 16,
    marginHorizontal: 16,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary.darkPurple,
    marginBottom: 12,
  },
});

export default ExploreScreen;
