/**
 * Format helpers used across the app (country names, etc.)
 */

/**
 * Ensure country name starts with capital letter for each word.
 * e.g. "france" -> "France", "united states" -> "United States"
 */
export const capitalizeCountry = (name: string): string => {
  if (!name || typeof name !== 'string') return name;
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};
