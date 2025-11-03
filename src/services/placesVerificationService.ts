/**
 * Places Verification Service
 * 
 * This service verifies places from natureism.places.json against Google Places API
 * and creates a new verified JSON file with validated data.
 * 
 * Usage:
 *   - Run this as a Node.js script: npm run verify-places
 *   - Or import and call verifyPlaces() from your code
 * 
 * Options:
 *   --resume, -r: Resume from last checkpoint
 *   --clean, -c: Clean duplicates and invalid entries
 */

import fs from 'fs';
import path from 'path';
import axios, { AxiosError } from 'axios';
import { RawPlace } from '../types';
import { GOOGLE_PLACES_API_KEY, PLACES_API_CONFIG } from '../config/environment';
import { calculateDistance } from './locationService';

// Configuration
const CONFIG = {
  // Maximum distance in km to consider a match (100 meters = 0.1 km)
  MATCH_DISTANCE_THRESHOLD: 0.1,
  
  // Name similarity threshold (0-1, higher = more strict)
  NAME_SIMILARITY_THRESHOLD: 0.6,
  
  // Delay between API calls to avoid rate limiting (ms)
  API_DELAY: 100,
  
  // Batch size for processing
  BATCH_SIZE: 50,
  
  // Save progress every N places
  SAVE_PROGRESS_INTERVAL: 100,
  
  // Input and output file paths (relative to project root)
  INPUT_FILE: path.join(process.cwd(), 'src/utils/natureism.places.json'),
  OUTPUT_FILE: path.join(process.cwd(), 'src/utils/natureism.places.verified.json'),
  PROGRESS_FILE: path.join(process.cwd(), 'src/utils/verification_progress.json'),
};

// Verified place structure (same as RawPlace but with verified data)
export interface VerifiedPlace extends RawPlace {
  verified?: boolean;
  googlePlaceId?: string;
  verificationStatus?: 'verified' | 'not_found' | 'error' | 'pending';
  verificationDate?: string;
  verificationNote?: string;
  // Merged data from Google Places
  googleRating?: number;
  googleUserRatingCount?: number;
  googleFormattedAddress?: string;
  googleWebsite?: string;
  googlePhone?: string;
}

// Progress tracking
interface VerificationProgress {
  total: number;
  processed: number;
  verified: number;
  notFound: number;
  errors: number;
  skipped: number;
  lastProcessedIndex: number;
  startTime: string;
  lastUpdate: string;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Search for a place in Google Places API by coordinates
 */
async function searchPlaceByCoordinates(
  lat: number,
  lng: number,
  name: string
): Promise<{
  place: any | null;
  distance: number;
  similarity: number;
} | null> {
  try {
    // First, try nearby search
    const requestBody = {
      includedTypes: ['tourist_attraction', 'campground', 'lodging', 'spa', 'beach'],
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: 500, // 500 meters search radius
        },
      },
      languageCode: PLACES_API_CONFIG.language,
    };

    const response = await axios.post(
      `${PLACES_API_CONFIG.baseUrl}/places:searchNearby`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.types,places.editorialSummary,places.websiteUri,places.nationalPhoneNumber',
        },
      }
    );

    const places = response.data.places || [];
    
    // Find the best match by distance and name similarity
    let bestMatch: {
      place: any;
      distance: number;
      similarity: number;
    } | null = null;

    for (const place of places) {
      const placeLat = place.location?.latitude || 0;
      const placeLng = place.location?.longitude || 0;
      const placeName = place.displayName?.text || '';
      
      const distance = calculateDistance(lat, lng, placeLat, placeLng);
      const similarity = calculateSimilarity(name, placeName);
      
      // Only consider matches within threshold distance
      if (distance <= CONFIG.MATCH_DISTANCE_THRESHOLD) {
        const score = similarity * 0.7 + (1 - distance / CONFIG.MATCH_DISTANCE_THRESHOLD) * 0.3;
        
        if (!bestMatch || score > (bestMatch.similarity * 0.7 + (1 - bestMatch.distance / CONFIG.MATCH_DISTANCE_THRESHOLD) * 0.3)) {
          bestMatch = { place, distance, similarity };
        }
      }
    }

    // If no match found in nearby search, try text search
    if (!bestMatch || bestMatch.similarity < CONFIG.NAME_SIMILARITY_THRESHOLD) {
      const textSearchResponse = await axios.post(
        `${PLACES_API_CONFIG.baseUrl}/places:searchText`,
        {
          textQuery: name,
          maxResultCount: 5,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 1000, // 1km
            },
          },
          languageCode: PLACES_API_CONFIG.language,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.types,places.editorialSummary,places.websiteUri,places.nationalPhoneNumber',
          },
        }
      );

      const textPlaces = textSearchResponse.data.places || [];
      
      for (const place of textPlaces) {
        const placeLat = place.location?.latitude || 0;
        const placeLng = place.location?.longitude || 0;
        const placeName = place.displayName?.text || '';
        
        const distance = calculateDistance(lat, lng, placeLat, placeLng);
        const similarity = calculateSimilarity(name, placeName);
        
        if (distance <= CONFIG.MATCH_DISTANCE_THRESHOLD) {
          const score = similarity * 0.7 + (1 - distance / CONFIG.MATCH_DISTANCE_THRESHOLD) * 0.3;
          
          if (!bestMatch || score > (bestMatch.similarity * 0.7 + (1 - bestMatch.distance / CONFIG.MATCH_DISTANCE_THRESHOLD) * 0.3)) {
            bestMatch = { place, distance, similarity };
          }
        }
      }
    }

    return bestMatch;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 429) {
        // Rate limited - wait longer
        console.warn('⚠️ Rate limited, waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    console.error(`Error searching place "${name}":`, error);
    return null;
  }
}

/**
 * Merge local place data with Google Places data
 */
function mergePlaceData(
  localPlace: RawPlace,
  googlePlace: any | null,
  matchInfo: { distance: number; similarity: number } | null
): VerifiedPlace {
  const verifiedPlace: VerifiedPlace = {
    ...localPlace,
    verified: googlePlace !== null,
    verificationStatus: googlePlace ? 'verified' : 'not_found',
    verificationDate: new Date().toISOString(),
  };

  if (googlePlace && matchInfo) {
    // Verify match quality
    if (matchInfo.similarity >= CONFIG.NAME_SIMILARITY_THRESHOLD && matchInfo.distance <= CONFIG.MATCH_DISTANCE_THRESHOLD) {
      verifiedPlace.googlePlaceId = googlePlace.id;
      verifiedPlace.googleRating = googlePlace.rating;
      verifiedPlace.googleUserRatingCount = googlePlace.userRatingCount;
      verifiedPlace.googleFormattedAddress = googlePlace.formattedAddress;
      verifiedPlace.googleWebsite = googlePlace.websiteUri;
      verifiedPlace.googlePhone = googlePlace.nationalPhoneNumber || googlePlace.internationalPhoneNumber;
      
      // Update rating if Google has better data
      if (googlePlace.rating && googlePlace.rating > (localPlace.rating || 0)) {
        verifiedPlace.rating = googlePlace.rating;
      }
      
      // Update description if Google has better data and local is minimal
      if (googlePlace.editorialSummary?.text && 
          (!localPlace.description || localPlace.description.length < 50)) {
        verifiedPlace.description = googlePlace.editorialSummary.text;
      }
      
      // Update address if Google has better data
      if (googlePlace.formattedAddress && 
          (!localPlace.country || localPlace.country === 'unknown')) {
        // Extract country from Google address
        const addressParts = googlePlace.formattedAddress.split(',');
        verifiedPlace.country = addressParts[addressParts.length - 1]?.trim() || localPlace.country;
      }
      
      verifiedPlace.verificationNote = `Matched with ${(matchInfo.similarity * 100).toFixed(1)}% similarity, ${(matchInfo.distance * 1000).toFixed(0)}m away`;
    } else {
      verifiedPlace.verificationStatus = 'not_found';
      verifiedPlace.verificationNote = `No good match found (similarity: ${(matchInfo.similarity * 100).toFixed(1)}%, distance: ${(matchInfo.distance * 1000).toFixed(0)}m)`;
    }
  } else {
    verifiedPlace.verificationNote = 'Not found in Google Places API';
  }

  return verifiedPlace;
}

/**
 * Load verification progress
 */
function loadProgress(): VerificationProgress | null {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      const data = fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
  return null;
}

/**
 * Save verification progress
 */
function saveProgress(progress: VerificationProgress): void {
  try {
    fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

/**
 * Main verification function
 */
export async function verifyPlaces(
  resume: boolean = false,
  startIndex: number = 0
): Promise<VerifiedPlace[]> {
  console.log('🔍 Starting places verification...');
  console.log(`📁 Input file: ${CONFIG.INPUT_FILE}`);
  console.log(`📁 Output file: ${CONFIG.OUTPUT_FILE}`);

  // Load existing places
  if (!fs.existsSync(CONFIG.INPUT_FILE)) {
    throw new Error(`Input file not found: ${CONFIG.INPUT_FILE}`);
  }

  const rawData = fs.readFileSync(CONFIG.INPUT_FILE, 'utf-8');
  const places: RawPlace[] = JSON.parse(rawData);
  
  console.log(`📊 Total places to verify: ${places.length}`);

  // Load progress if resuming
  let progress: VerificationProgress;
  if (resume) {
    const savedProgress = loadProgress();
    if (savedProgress) {
      progress = savedProgress;
      startIndex = progress.lastProcessedIndex + 1;
      console.log(`📌 Resuming from index ${startIndex}`);
    } else {
      progress = {
        total: places.length,
        processed: 0,
        verified: 0,
        notFound: 0,
        errors: 0,
        skipped: 0,
        lastProcessedIndex: -1,
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
      };
    }
  } else {
    progress = {
      total: places.length,
      processed: 0,
      verified: 0,
      notFound: 0,
      errors: 0,
      skipped: 0,
      lastProcessedIndex: -1,
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };
  }

  const verifiedPlaces: VerifiedPlace[] = [];
  
  // Load existing verified places if resuming
  if (resume && fs.existsSync(CONFIG.OUTPUT_FILE)) {
    try {
      const existingData = fs.readFileSync(CONFIG.OUTPUT_FILE, 'utf-8');
      const existingPlaces: VerifiedPlace[] = JSON.parse(existingData);
      verifiedPlaces.push(...existingPlaces);
      console.log(`📦 Loaded ${existingPlaces.length} existing verified places`);
    } catch (error) {
      console.warn('Could not load existing verified places, starting fresh');
    }
  }

  // Filter out invalid places first
  const validPlaces = places.filter(place => 
    place.lat && 
    place.lng && 
    place.title &&
    !place.deleted &&
    place.state === 'Active'
  );

  console.log(`✅ Valid places to verify: ${validPlaces.length}`);
  console.log(`⏭️  Skipped invalid places: ${places.length - validPlaces.length}`);

  // Process places
  for (let i = startIndex; i < validPlaces.length; i++) {
    const place = validPlaces[i];
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lng);

    // Skip if coordinates are invalid
    if (isNaN(lat) || isNaN(lng)) {
      console.log(`⚠️  Skipping ${place.title}: Invalid coordinates`);
      progress.skipped++;
      progress.processed++;
      continue;
    }

    try {
      // Search in Google Places API
      const matchResult = await searchPlaceByCoordinates(lat, lng, place.title);
      
      // Merge data
      const verifiedPlace = mergePlaceData(
        place,
        matchResult?.place || null,
        matchResult || null
      );

      verifiedPlaces.push(verifiedPlace);

      // Update progress
      if (verifiedPlace.verified) {
        progress.verified++;
        console.log(`✅ [${i + 1}/${validPlaces.length}] Verified: ${place.title}`);
      } else {
        progress.notFound++;
        console.log(`❌ [${i + 1}/${validPlaces.length}] Not found: ${place.title}`);
      }

      progress.processed++;
      progress.lastProcessedIndex = i;
      progress.lastUpdate = new Date().toISOString();

      // Save progress periodically
      if (progress.processed % CONFIG.SAVE_PROGRESS_INTERVAL === 0) {
        saveProgress(progress);
        // Also save verified places so far
        fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(verifiedPlaces, null, 2));
        console.log(`💾 Progress saved: ${progress.processed}/${progress.total} (${((progress.processed / progress.total) * 100).toFixed(1)}%)`);
      }

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
    } catch (error) {
      console.error(`❌ Error processing ${place.title}:`, error);
      progress.errors++;
      progress.processed++;
      
      // Still add the place but mark as error
      const verifiedPlace: VerifiedPlace = {
        ...place,
        verified: false,
        verificationStatus: 'error',
        verificationDate: new Date().toISOString(),
        verificationNote: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      verifiedPlaces.push(verifiedPlace);
    }
  }

  // Final save
  saveProgress(progress);
  fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(verifiedPlaces, null, 2));

  console.log('\n✅ Verification complete!');
  console.log(`📊 Statistics:`);
  console.log(`   Total: ${progress.total}`);
  console.log(`   Verified: ${progress.verified}`);
  console.log(`   Not Found: ${progress.notFound}`);
  console.log(`   Errors: ${progress.errors}`);
  console.log(`   Skipped: ${progress.skipped}`);
  console.log(`📁 Output saved to: ${CONFIG.OUTPUT_FILE}`);

  return verifiedPlaces;
}

/**
 * Clean up verified places - remove duplicates and invalid entries
 */
export function cleanVerifiedPlaces(verifiedPlaces: VerifiedPlace[]): VerifiedPlace[] {
  console.log('🧹 Cleaning verified places...');
  
  const cleaned: VerifiedPlace[] = [];
  const seenIds = new Set<string>();
  const seenCoordinates = new Map<string, string>(); // "lat,lng" -> placeId

  for (const place of verifiedPlaces) {
    // Skip if already seen by ID
    if (seenIds.has(place._id.$oid)) {
      continue;
    }

    // Check for duplicates by coordinates (within 100m)
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lng);
    const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    let isDuplicate = false;
    for (const [existingCoord, existingId] of seenCoordinates.entries()) {
      const [existingLat, existingLng] = existingCoord.split(',').map(Number);
      const distance = calculateDistance(lat, lng, existingLat, existingLng);
      
      if (distance < CONFIG.MATCH_DISTANCE_THRESHOLD) {
        // Prefer verified places over unverified
        const existingPlace = verifiedPlaces.find(p => p._id.$oid === existingId);
        if (existingPlace && existingPlace.verified && !place.verified) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      // Prefer verified places
      if (place.verified) {
        cleaned.push(place);
      } else {
        // Only include unverified if they have valid data
        if (place.lat && place.lng && place.title && !place.deleted) {
          cleaned.push(place);
        }
      }
      
      seenIds.add(place._id.$oid);
      seenCoordinates.set(coordKey, place._id.$oid);
    }
  }

  console.log(`✅ Cleaned: ${verifiedPlaces.length} -> ${cleaned.length} places`);
  return cleaned;
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume') || args.includes('-r');
  const clean = args.includes('--clean') || args.includes('-c');
  
  verifyPlaces(resume)
    .then(places => {
      if (clean) {
        const cleaned = cleanVerifiedPlaces(places);
        fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(cleaned, null, 2));
        console.log(`✅ Cleaned file saved to: ${CONFIG.OUTPUT_FILE}`);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

