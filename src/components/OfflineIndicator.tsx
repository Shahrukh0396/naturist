/**
 * Offline Indicator Component
 * Shows a banner when the device is offline
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { COLORS } from '../theme/colors';

const OfflineIndicator: React.FC = () => {
  const { isOnline } = useOfflineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        📡 Offline - Showing cached data
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.warning || '#FFA500',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineIndicator;

