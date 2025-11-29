/**
 * Firebase Offline Service
 * Provides utilities for managing offline data and sync status
 */

import database from '@react-native-firebase/database';
import NetInfo from '@react-native-community/netinfo';

export interface OfflineStatus {
  isConnected: boolean;
  isOnline: boolean;
  lastSyncTime?: Date;
}

/**
 * Check if device is online
 */
export const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch (error) {
    console.error('Error checking network status:', error);
    return false;
  }
};

/**
 * Get current offline/online status
 */
export const getOfflineStatus = async (): Promise<OfflineStatus> => {
  try {
    const state = await NetInfo.fetch();
    const connected = state.isConnected ?? false;
    
    return {
      isConnected: connected,
      isOnline: connected,
    };
  } catch (error) {
    console.error('Error getting offline status:', error);
    return {
      isConnected: false,
      isOnline: false,
    };
  }
};

/**
 * Subscribe to network status changes
 */
export const subscribeToNetworkStatus = (
  callback: (isOnline: boolean) => void
): () => void => {
  const unsubscribe = NetInfo.addEventListener(state => {
    const online = state.isConnected ?? false;
    callback(online);
    
    if (__DEV__) {
      console.log(`🌐 Network status: ${online ? 'Online' : 'Offline'}`);
    }
  });
  
  return unsubscribe;
};

/**
 * Force sync data from Firebase (useful when coming back online)
 */
export const syncPlacesFromFirebase = async (): Promise<boolean> => {
  try {
    const isConnected = await isOnline();
    if (!isConnected) {
      if (__DEV__) {
        console.log('📡 Offline - using cached data');
      }
      return false;
    }
    
    // Force a fresh fetch from server
    const snapshot = await database().ref('places').once('value', {
      source: 'server', // Force server fetch, not cache
    });
    
    if (__DEV__) {
      console.log('✅ Synced places from Firebase server');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error syncing from Firebase:', error);
    return false;
  }
};

/**
 * Get sync status information
 */
export const getSyncStatus = async (): Promise<{
  isOnline: boolean;
  hasCachedData: boolean;
  cacheSize?: number;
}> => {
  try {
    const online = await isOnline();
    
    // Check if we have cached data
    const snapshot = await database().ref('places').once('value');
    const hasCachedData = snapshot.exists();
    const cacheSize = hasCachedData ? Object.keys(snapshot.val() || {}).length : 0;
    
    return {
      isOnline: online,
      hasCachedData,
      cacheSize,
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return {
      isOnline: false,
      hasCachedData: false,
    };
  }
};

