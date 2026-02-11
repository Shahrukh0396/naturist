/**
 * Naturism App
 * A React Native app for discovering naturist-friendly places
 *
 * @format
 */

import React, { useEffect, useRef } from 'react';
import { StatusBar, AppState, AppStateStatus, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { resetSession, SESSION_RESET_AFTER_MS_EXPORT } from './src/services/adSessionManager';
import { resolveWhenAdsModuleLoaded, setAdsReady } from './src/services/adsService';

function App() {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAtRef = useRef<number | null>(null);

  // Defer ad init until after first paint (requestIdleCallback; InteractionManager is deprecated)
  useEffect(() => {
    let cancelled = false;
    const runInit = () => {
      const initAds = async () => {
        try {
          if (Platform.OS === 'ios') {
            try {
              const { requestTrackingPermission } = await import('react-native-tracking-transparency');
              await requestTrackingPermission();
            } catch (_) {
              // ATT not available or user declined
            }
          }
          const { default: mobileAds } = await import('react-native-google-mobile-ads');
          if (!cancelled) {
            resolveWhenAdsModuleLoaded();
            await mobileAds().initialize();
            setAdsReady();
          }
        } catch (e) {
          resolveWhenAdsModuleLoaded();
          if (__DEV__) {
            console.warn('[App] Google Mobile Ads init skipped:', e);
          }
        }
      };
      initAds();
    };
    const g = globalThis as typeof globalThis & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const rIC = typeof g.requestIdleCallback === 'function' ? g.requestIdleCallback : null;
    const cIC = typeof g.cancelIdleCallback === 'function' ? g.cancelIdleCallback : null;
    const useIdle = rIC != null && cIC != null;
    const id = useIdle
      ? rIC(runInit, { timeout: 500 })
      : setTimeout(runInit, 100);
    return () => {
      cancelled = true;
      if (useIdle && cIC) cIC(id);
      else clearTimeout(id);
    };
  }, []);

  // Reset ad session when app returns to foreground after a long absence (>30 min)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const at = backgroundedAtRef.current;
        if (at != null && Date.now() - at >= SESSION_RESET_AFTER_MS_EXPORT) {
          resetSession();
        }
        backgroundedAtRef.current = null;
      }
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAtRef.current = Date.now();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default App;
