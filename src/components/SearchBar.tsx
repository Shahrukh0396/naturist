import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import { COLORS } from '../theme/colors';

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSearch?: () => void;
  showFilterButton?: boolean;
  onFilterPress?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search places...',
  value,
  onChangeText,
  onSearch,
  showFilterButton = false,
  onFilterPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        {showFilterButton && (
          <TouchableOpacity style={styles.filterButton} onPress={onFilterPress}>
            <Text style={styles.filterText}>Filter</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.primary.mint,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.primary.darkPurple,
  },
  filterButton: {
    backgroundColor: COLORS.primary.teal,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  filterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SearchBar;
