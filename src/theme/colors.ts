/**
 * App Theme Colors
 * Beautiful gradient color palette for the Naturism app
 */

export const COLORS = {
  // Primary color palette
  primary: {
    darkPurple: '#3a2f6b',  // Deep purple
    blue: '#36669c',         // Ocean blue
    teal: '#41a0ae',         // Teal
    mint: '#3ec995',         // Mint green
    lightGreen: '#77f07f',   // Light green
  },
  
  // Gradient combinations
  gradients: {
    primary: ['#3a2f6b', '#36669c', '#41a0ae'],
    secondary: ['#36669c', '#41a0ae', '#3ec995'],
    accent: ['#41a0ae', '#3ec995', '#77f07f'],
    full: ['#3a2f6b', '#36669c', '#41a0ae', '#3ec995', '#77f07f'],
  },
  
  // UI Colors
  background: '#f8f9fa',
  white: '#ffffff',
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
    light: '#999999',
    onDark: '#ffffff',
  },
  
  // Status colors
  success: '#3ec995',
  warning: '#ffc107',
  error: '#f44336',
  info: '#41a0ae',
};

export default COLORS;
