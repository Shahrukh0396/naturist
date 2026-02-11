/**
 * AreaSearchOverlay - Translucent overlay with fixed central hole for area search.
 * User pans the map underneath to position the search center.
 * Hole size is fixed; search radius (1-50 km) is user-selectable.
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fixed hole size (central transparent area)
const HOLE_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.6;

// Radius presets (km)
const RADIUS_PRESETS = [1, 5, 10, 25, 50] as const;

export interface AreaSearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  searchRadiusKm: number;
  onRadiusChange: (km: number) => void;
  onSearch: () => void;
  isAdLoaded: boolean;
  placeCount?: number;
}

export const AreaSearchOverlay: React.FC<AreaSearchOverlayProps> = ({
  visible,
  onClose,
  searchRadiusKm,
  onRadiusChange,
  onSearch,
  isAdLoaded,
  placeCount = 0,
}) => {
  if (!visible) return null;

  const halfHole = HOLE_SIZE / 2;
  const topBarHeight = (SCREEN_HEIGHT - HOLE_SIZE) / 2;
  const sideBarWidth = (SCREEN_WIDTH - HOLE_SIZE) / 2;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 3 }]} pointerEvents="box-none">
      {/* Four translucent bars around central hole */}
      <View style={styles.frame} pointerEvents="box-none">
        {/* Top bar */}
        <View style={[styles.bar, styles.topBar, { height: topBarHeight }]} />
        {/* Bottom bar */}
        <View style={[styles.bar, styles.bottomBar, { height: topBarHeight }]} />
        {/* Left bar */}
        <View
          style={[
            styles.bar,
            styles.sideBar,
            {
              width: sideBarWidth,
              height: HOLE_SIZE,
              top: topBarHeight,
            },
          ]}
        />
        {/* Right bar */}
        <View
          style={[
            styles.bar,
            styles.sideBar,
            {
              width: sideBarWidth,
              height: HOLE_SIZE,
              top: topBarHeight,
              right: 0,
              left: undefined,
            },
          ]}
        />
      </View>

      {/* Fixed center pin - stays in place while map pans underneath */}
      <View style={styles.centerPin} pointerEvents="none">
        <Icon name="place" size={48} color={COLORS.primary.teal} />
      </View>

      {/* Top controls: close button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
        <Icon name="close" size={28} color={COLORS.primary.darkPurple} />
      </TouchableOpacity>

      {/* Bottom panel: radius selector + search button (hidden after results) */}
      <View style={styles.bottomPanel}>
        <Text style={styles.instruction}>
          {placeCount > 0
            ? `${placeCount} places found in this area`
            : 'Pan map to set center • Select radius • Request places'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.radiusRow}
        >
          {RADIUS_PRESETS.map((km) => (
            <TouchableOpacity
              key={km}
              style={[
                styles.radiusChip,
                searchRadiusKm === km && styles.radiusChipActive,
              ]}
              onPress={() => onRadiusChange(km)}
              activeOpacity={0.7}
              disabled={placeCount > 0}
            >
              <Text
                style={[
                  styles.radiusChipText,
                  searchRadiusKm === km && styles.radiusChipTextActive,
                  placeCount > 0 && styles.radiusChipTextDisabled,
                ]}
              >
                {km} km
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {placeCount === 0 ? (
          <TouchableOpacity
            style={[styles.searchButton, !isAdLoaded && styles.searchButtonDisabled]}
            onPress={onSearch}
            disabled={!isAdLoaded}
            activeOpacity={0.8}
          >
            <Icon name="play-circle-filled" size={24} color="white" />
            <Text style={styles.searchButtonText}>
              {isAdLoaded
                ? 'Watch ad to find places here'
                : 'Loading ad...'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.resultsBadge}>
            <Icon name="check-circle" size={24} color={COLORS.primary.teal} />
            <Text style={styles.resultsBadgeText}>Places revealed</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    ...StyleSheet.absoluteFillObject,
  },
  bar: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  topBar: {
    top: 0,
    left: 0,
    right: 0,
  },
  bottomBar: {
    bottom: 0,
    left: 0,
    right: 0,
  },
  sideBar: {
    left: 0,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  instruction: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
    textAlign: 'center',
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    paddingVertical: 4,
  },
  radiusChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  radiusChipActive: {
    backgroundColor: COLORS.primary.teal,
    borderColor: COLORS.primary.teal,
  },
  radiusChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  radiusChipTextActive: {
    color: 'white',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary.teal,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 10,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  placeCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 48,
    height: 48,
    marginTop: -24,
    marginLeft: -24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radiusChipTextDisabled: {
    opacity: 0.7,
  },
  resultsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 200, 180, 0.15)',
    gap: 10,
  },
  resultsBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary.teal,
  },
});
