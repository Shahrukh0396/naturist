import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { fetchInitialData } from '../services/optimizedPlacesService';
import { initializeLightningServer } from '../services/lightningServer';

const { width, height } = Dimensions.get('window');

interface LandingScreenProps {
  onGetStarted: () => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ onGetStarted }) => {
  const [isPreloading, setIsPreloading] = useState(true);

  useEffect(() => {
    // Preload initial data in background while user sees landing screen
    preloadInitialData();
  }, []);

  const preloadInitialData = async () => {
    try {
      if (__DEV__) {
        console.log('🔄 [LandingScreen] Preloading initial data...');
      }

      // Step 1: Initialize Lightning Server (loads local JSON to AsyncStorage)
      if (__DEV__) {
        console.log('⚡ [LandingScreen] Initializing Lightning Server...');
      }
      await initializeLightningServer();

      // Step 2: Fetch and cache initial data (location + 10 places per category)
      // This happens in background while user sees the landing screen
      // All data comes from Lightning Server (AsyncStorage) - instant, no internet calls
      await fetchInitialData();

      if (__DEV__) {
        console.log('✅ [LandingScreen] Initial data preloaded and cached');
      }
    } catch (error) {
      console.error('❌ [LandingScreen] Error preloading initial data:', error);
      // Don't block the user - they can still proceed
    } finally {
      setIsPreloading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ImageBackground
        source={require('../assets/naturistLand.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.textContainer}>
              {/* <Text style={styles.title}>Welcome to Natourist</Text> */}
              <Text style={styles.title}>
                Discover wonderful naturist-friendly places around the world
              </Text>
              <Text style={styles.subtitle2}>
                Many of these places are unofficial, Please respect legal and cultural norms. We accept no liability for any actions you take.
              </Text>
            </View>

            <View style={styles.bottomSection}>
              <TouchableOpacity
                style={[
                  styles.getStartedButton,
                  isPreloading && styles.getStartedButtonDisabled,
                ]}
                onPress={onGetStarted}
                activeOpacity={0.8}
                disabled={isPreloading}
              >
                {isPreloading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={COLORS.white} />
                    <Text style={[styles.getStartedText, styles.loadingText]}>
                      Loading...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.getStartedText}>Get Started</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary.darkPurple,
  },
  backgroundImage: {
    flex: 1,
    width: width,
    height: height,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)', // Dark overlay for better text readability
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    letterSpacing: 0.5,
    marginBottom: 30,
  },
  subtitle: {
    fontSize: 24,
    color: COLORS.white,
    textAlign: 'left',
    lineHeight: 26,
    paddingHorizontal: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subtitle2: {
    fontSize: 16,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  bottomSection: {
    alignItems: 'center',
  },
  getStartedButton: {
    backgroundColor: COLORS.primary.teal,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  getStartedButtonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    marginLeft: 0,
  },
  getStartedText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tagline: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    opacity: 0.9,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});

export default LandingScreen;
