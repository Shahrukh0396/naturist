import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../theme/colors';

interface GradientBackgroundProps {
  children?: React.ReactNode;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle;
}

const GradientBackground: React.FC<GradientBackgroundProps> = ({
  children,
  colors = COLORS.gradients.full,
  start = { x: 0, y: 0 },
  end = { x: 0, y: 1 },
  style,
}) => {
  return (
    <LinearGradient
      colors={colors}
      start={start}
      end={end}
      style={[styles.gradient, style]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
});

export default GradientBackground;
