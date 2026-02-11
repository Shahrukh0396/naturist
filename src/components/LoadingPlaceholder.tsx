/**
 * Shared loading state: spinning ring, breathing glow, cycling messages, bouncing dots.
 * Use on Home and Explore when fetching places.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import { COLORS } from '../theme/colors';

const LOADING_MESSAGES = [
  'Loading places...',
  'Finding spots near you...',
  'Fetching images...',
  'Almost there...',
  'Preparing your feed...',
  'One moment please...',
];

function useLoadingAnimations(isActive: boolean) {
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0.4)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) return;

    const spinLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(spin, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(spin, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    spin.setValue(0);
    spinLoop.start();

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 0.9,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0.4,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    breathe.setValue(0.4);
    breatheLoop.start();

    const bounce = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ])
      );

    dot1.setValue(0);
    dot2.setValue(0);
    dot3.setValue(0);
    const b1 = bounce(dot1, 0);
    const b2 = bounce(dot2, 150);
    const b3 = bounce(dot3, 300);
    b1.start();
    b2.start();
    b3.start();

    return () => {
      spinLoop.stop();
      breatheLoop.stop();
      b1.stop();
      b2.stop();
      b3.stop();
    };
  }, [isActive, spin, breathe, dot1, dot2, dot3]);

  return { spin, breathe, dot1, dot2, dot3 };
}

type LoadingPlaceholderProps = {
  /** When false, animations stop (e.g. when loading finishes). */
  active?: boolean;
};

export const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({ active = true }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { spin, breathe, dot1, dot2, dot3 } = useLoadingAnimations(active);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    const runPulseAndNextMessage = () => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
      pulseAnim.setValue(1);
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    };
    intervalRef.current = setInterval(runPulseAndNextMessage, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, pulseAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.loadingRing,
          {
            transform: [
              {
                rotate: spin.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View style={[styles.loadingGlow, { opacity: breathe }]} />
      <Animated.View style={[styles.loadingContent, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.loadingText}>{LOADING_MESSAGES[messageIndex]}</Text>
        <View style={styles.loadingDots}>
          <Animated.View
            style={[
              styles.loadingDot,
              {
                transform: [
                  {
                    translateY: dot1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.loadingDot,
              {
                transform: [
                  {
                    translateY: dot2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.loadingDot,
              {
                transform: [
                  {
                    translateY: dot3.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    position: 'relative',
  },
  loadingRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: COLORS.primary.mint,
    borderRightColor: COLORS.primary.teal,
  },
  loadingGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary.teal,
  },
  loadingContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 12,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary.mint,
  },
});

export default LoadingPlaceholder;
