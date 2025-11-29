/**
 * Hook to monitor offline/online status
 */

import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface OfflineStatus {
  isOnline: boolean;
  isConnected: boolean;
  type?: string;
}

/**
 * Hook to monitor network status
 * Returns current online/offline status
 */
export const useOfflineStatus = (): OfflineStatus => {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: true,
    isConnected: true,
  });

  useEffect(() => {
    // Get initial status
    NetInfo.fetch().then(state => {
      setStatus({
        isOnline: state.isConnected ?? false,
        isConnected: state.isConnected ?? false,
        type: state.type,
      });
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected ?? false;
      setStatus({
        isOnline: isConnected,
        isConnected: isConnected,
        type: state.type,
      });

      if (__DEV__) {
        console.log(`🌐 Network status changed: ${isConnected ? 'Online' : 'Offline'}`);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return status;
};

