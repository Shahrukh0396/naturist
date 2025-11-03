import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Place } from '../types';
import PlaceCard from './PlaceCard';
import { COLORS } from '../theme/colors';

interface CategorySectionProps {
  title: string;
  places: Place[];
  onPlacePress: (place: Place) => void;
  onViewAllPress?: () => void;
  horizontal?: boolean;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  title,
  places,
  onPlacePress,
  onViewAllPress,
  horizontal = true,
}) => {
  const renderPlace = ({ item }: { item: Place }) => (
    <PlaceCard place={item} onPress={onPlacePress} />
  );

  const renderPlaceVertical = ({ item }: { item: Place }) => (
    <View style={styles.verticalCard}>
      <PlaceCard place={item} onPress={onPlacePress} />
    </View>
  );

  if (places.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onViewAllPress && (
          <TouchableOpacity onPress={onViewAllPress}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        )}
      </View>
      {horizontal ? (
        <FlatList
          data={places}
          renderItem={renderPlace}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      ) : (
        <FlatList
          data={places}
          renderItem={renderPlaceVertical}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  viewAll: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: '600',
  },
  horizontalList: {
    paddingLeft: 8,
  },
  verticalCard: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
});

export default CategorySection;
