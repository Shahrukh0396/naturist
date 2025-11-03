export const APP_CONFIG = {
  name: 'Naturism',
  version: '1.0.0',
  description: 'Discover amazing naturist-friendly places',
};

export const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#333333',
  textSecondary: '#666666',
  textTertiary: '#8E8E93',
  border: '#E5E5EA',
  shadow: '#000000',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    lineHeight: 34,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    lineHeight: 30,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

export const CATEGORIES = {
  beach: {
    name: 'Beach',
    icon: '🏖️',
    color: '#FF6B6B',
  },
  resort: {
    name: 'Resort',
    icon: '🏨',
    color: '#4ECDC4',
  },
  spa: {
    name: 'Spa',
    icon: '🧘',
    color: '#45B7D1',
  },
  park: {
    name: 'Park',
    icon: '🌳',
    color: '#96CEB4',
  },
  camping: {
    name: 'Camping',
    icon: '⛺',
    color: '#FFEAA7',
  },
  other: {
    name: 'Other',
    icon: '📍',
    color: '#DDA0DD',
  },
};

export const PRICE_RANGES = {
  '$': 'Budget',
  '$$': 'Moderate',
  '$$$': 'Expensive',
  '$$$$': 'Luxury',
};
