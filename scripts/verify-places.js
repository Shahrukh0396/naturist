/**
 * Places Verification Script
 * 
 * This script verifies places from natureism.places.json against Google Places API
 * using a coordinate-first approach that handles typos in place names.
 * 
 * Key Features:
 * - Coordinate-based matching (prioritizes distance over name similarity)
 * - Handles typos: accepts matches < 50m away regardless of name
 * - Gets full place details including all photos
 * - Processes all places in the file
 * 
 * Run with: node scripts/verify-places.js [--resume] [--clean]
 * 
 * Matching Logic:
 * - Very close (< 50m): Accept regardless of name (handles typos like "Niklassee" vs "Nikolassee")
 * - Close (< 100m): Accept with 30%+ name similarity
 * - Far (< 500m): Accept with 60%+ name similarity
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const CONFIG = {
  // Distance thresholds - prioritize coordinate matching
  VERY_CLOSE_DISTANCE: 0.05, // 50 meters - accept without name check
  CLOSE_DISTANCE: 0.1, // 100 meters - accept with lower name similarity
  FAR_DISTANCE: 0.5, // 500 meters - only accept with high name similarity
  NAME_SIMILARITY_THRESHOLD: 0.6, // For normal matches
  LOW_NAME_SIMILARITY_THRESHOLD: 0.3, // For very close coordinate matches
  API_DELAY: 100,
  SAVE_PROGRESS_INTERVAL: 100,
  INPUT_FILE: path.join(__dirname, '../src/utils/natureism.places.json'),
  OUTPUT_FILE: path.join(__dirname, '../src/utils/natureism.places.verified.json'),
  PROGRESS_FILE: path.join(__dirname, '../src/utils/verification_progress.json'),
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || (() => {
    try {
      // Try to read from environment.ts file directly
      const envFile = fs.readFileSync(path.join(__dirname, '../src/config/environment.ts'), 'utf-8');
      const match = envFile.match(/GOOGLE_PLACES_API_KEY\s*=\s*['"]([^'"]+)['"]/);
      if (match) {
        return match[1];
      }
    } catch (e) {
      // Ignore
    }
    throw new Error('GOOGLE_PLACES_API_KEY not found. Set it in environment.ts or as an environment variable.');
  })(),
  PLACES_API_BASE_URL: 'https://places.googleapis.com/v1',
};

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate string similarity using Levenshtein distance
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
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

// Get full place details by place ID (includes all photos)
async function getPlaceDetails(placeId) {
  try {
    const response = await axios.get(
      `${CONFIG.PLACES_API_BASE_URL}/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': CONFIG.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': '*', // Get all fields including all photos
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.warn('⚠️  Rate limited, waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    console.error(`Error fetching place details for ${placeId}:`, error.message);
    return null;
  }
}

// Search for a place in Google Places API - coordinate-first approach
async function searchPlaceByCoordinates(lat, lng, name) {
  try {
    // Step 1: Try nearby search with increasing radius
    const searchRadii = [500, 1000, 2000]; // 500m, 1km, 2km
    let bestMatch = null;

    for (const radius of searchRadii) {
      try {
        const requestBody = {
          includedTypes: ['tourist_attraction', 'campground', 'lodging', 'spa', 'beach', 'park', 'establishment'],
          maxResultCount: 20, // Get more results
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radius,
            },
          },
          languageCode: 'en',
        };

        const response = await axios.post(
          `${CONFIG.PLACES_API_BASE_URL}/places:searchNearby`,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': CONFIG.GOOGLE_PLACES_API_KEY,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.types,places.editorialSummary,places.websiteUri,places.nationalPhoneNumber',
            },
          }
        );

        const places = response.data.places || [];
        
        // Find best match prioritizing distance over name
        for (const place of places) {
          const placeLat = place.location?.latitude || 0;
          const placeLng = place.location?.longitude || 0;
          const placeName = place.displayName?.text || '';
          
          const distance = calculateDistance(lat, lng, placeLat, placeLng);
          const similarity = calculateSimilarity(name, placeName);
          
          // Prioritize coordinate matching:
          // - Very close (< 50m): accept regardless of name (handles typos)
          // - Close (< 100m): accept with lower name similarity
          // - Far (< 500m): require good name similarity
          let shouldAccept = false;
          
          if (distance <= CONFIG.VERY_CLOSE_DISTANCE) {
            // Very close - accept even with typos
            shouldAccept = true;
          } else if (distance <= CONFIG.CLOSE_DISTANCE) {
            // Close - accept with lower similarity (handles minor typos)
            shouldAccept = similarity >= CONFIG.LOW_NAME_SIMILARITY_THRESHOLD;
          } else if (distance <= CONFIG.FAR_DISTANCE) {
            // Far - require good name similarity
            shouldAccept = similarity >= CONFIG.NAME_SIMILARITY_THRESHOLD;
          }
          
          if (shouldAccept) {
            // Score: distance is more important than name similarity
            const distanceScore = 1 - (distance / CONFIG.FAR_DISTANCE); // 0-1, closer = higher
            const nameScore = similarity; // 0-1
            const totalScore = distanceScore * 0.7 + nameScore * 0.3; // Prioritize distance
            
            if (!bestMatch || totalScore > (bestMatch.distanceScore * 0.7 + bestMatch.similarity * 0.3)) {
              bestMatch = { 
                place, 
                distance, 
                similarity,
                distanceScore,
                totalScore
              };
            }
          }
        }

        // If we found a very close match, stop searching
        if (bestMatch && bestMatch.distance <= CONFIG.VERY_CLOSE_DISTANCE) {
          break;
        }
      } catch (radiusError) {
        // Continue to next radius if this one fails
        continue;
      }
    }

    // Step 2: If we found a match, get full details including all photos
    if (bestMatch && bestMatch.place.id) {
      const fullDetails = await getPlaceDetails(bestMatch.place.id);
      if (fullDetails) {
        // Merge full details into the place
        bestMatch.place = {
          ...bestMatch.place,
          ...fullDetails,
          // Keep original photos if full details has more
          photos: fullDetails.photos || bestMatch.place.photos || [],
        };
      }
    }

    // Step 3: If still no match, try text search as last resort
    if (!bestMatch) {
      try {
        const textSearchResponse = await axios.post(
          `${CONFIG.PLACES_API_BASE_URL}/places:searchText`,
          {
            textQuery: name,
            maxResultCount: 10,
            locationBias: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: 2000, // 2km
              },
            },
            languageCode: 'en',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': CONFIG.GOOGLE_PLACES_API_KEY,
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
          
          // Use same logic as nearby search
          let shouldAccept = false;
          
          if (distance <= CONFIG.VERY_CLOSE_DISTANCE) {
            shouldAccept = true;
          } else if (distance <= CONFIG.CLOSE_DISTANCE) {
            shouldAccept = similarity >= CONFIG.LOW_NAME_SIMILARITY_THRESHOLD;
          } else if (distance <= CONFIG.FAR_DISTANCE) {
            shouldAccept = similarity >= CONFIG.NAME_SIMILARITY_THRESHOLD;
          }
          
          if (shouldAccept) {
            const distanceScore = 1 - (distance / CONFIG.FAR_DISTANCE);
            const totalScore = distanceScore * 0.7 + similarity * 0.3;
            
            if (!bestMatch || totalScore > (bestMatch.distanceScore * 0.7 + bestMatch.similarity * 0.3)) {
              bestMatch = { 
                place, 
                distance, 
                similarity,
                distanceScore,
                totalScore
              };
              
              // Get full details for text search match too
              if (place.id) {
                const fullDetails = await getPlaceDetails(place.id);
                if (fullDetails) {
                  bestMatch.place = {
                    ...bestMatch.place,
                    ...fullDetails,
                    photos: fullDetails.photos || bestMatch.place.photos || [],
                  };
                }
              }
            }
          }
        }
      } catch (textError) {
        // Text search failed, continue with nearby results
      }
    }

    return bestMatch;
  } catch (error) {
    if (error.response?.status === 429) {
      console.warn('⚠️  Rate limited, waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    console.error(`Error searching place "${name}":`, error.message);
    return null;
  }
}

// Get photo URL from Google Places photo reference
function getPhotoUrl(photoName, maxWidth = 400) {
  if (!photoName) return '';
  // New API photo URL format: https://places.googleapis.com/v1/{photoName}/media?key=...&maxWidthPx=...
  return `${CONFIG.PLACES_API_BASE_URL}/${photoName}/media?key=${CONFIG.GOOGLE_PLACES_API_KEY}&maxWidthPx=${maxWidth}`;
}

// Merge local place with Google Places data
function mergePlaceData(localPlace, googlePlace, matchInfo) {
  const verifiedPlace = {
    ...localPlace,
    verified: googlePlace !== null,
    verificationStatus: googlePlace ? 'verified' : 'not_found',
    verificationDate: new Date().toISOString(),
  };

  if (googlePlace && matchInfo) {
    // Accept match if:
    // 1. Very close (< 50m) - regardless of name
    // 2. Close (< 100m) with some name similarity
    // 3. Far (< 500m) with good name similarity
    const isVeryClose = matchInfo.distance <= CONFIG.VERY_CLOSE_DISTANCE;
    const isCloseWithLowSimilarity = matchInfo.distance <= CONFIG.CLOSE_DISTANCE && matchInfo.similarity >= CONFIG.LOW_NAME_SIMILARITY_THRESHOLD;
    const isFarWithGoodSimilarity = matchInfo.distance <= CONFIG.FAR_DISTANCE && matchInfo.similarity >= CONFIG.NAME_SIMILARITY_THRESHOLD;
    
    if (isVeryClose || isCloseWithLowSimilarity || isFarWithGoodSimilarity) {
      verifiedPlace.googlePlaceId = googlePlace.id;
      verifiedPlace.googleRating = googlePlace.rating;
      verifiedPlace.googleUserRatingCount = googlePlace.userRatingCount;
      verifiedPlace.googleFormattedAddress = googlePlace.formattedAddress;
      verifiedPlace.googleWebsite = googlePlace.websiteUri;
      verifiedPlace.googlePhone = googlePlace.nationalPhoneNumber || googlePlace.internationalPhoneNumber;
      
      // Merge images: combine Google Places photos with existing images
      const googleImages = [];
      if (googlePlace.photos && googlePlace.photos.length > 0) {
        // Get up to 10 photos from Google (high quality) - we now have full details
        const photosToGet = googlePlace.photos.slice(0, 10);
        googleImages.push(...photosToGet.map(photo => getPhotoUrl(photo.name, 800)));
      }
      
      // Merge images: prefer Google images if available, otherwise keep local images
      const existingImages = localPlace.images || [];
      const validExistingImages = existingImages.filter(img => img && typeof img === 'string' && img.startsWith('http'));
      
      if (googleImages.length > 0) {
        // If we have Google images, use them first, then add any valid local images that aren't duplicates
        const allImages = [...googleImages];
        for (const localImg of validExistingImages) {
          // Check if local image is not already in Google images (avoid duplicates)
          if (!allImages.some(googleImg => googleImg === localImg)) {
            allImages.push(localImg);
          }
        }
        verifiedPlace.images = allImages;
        verifiedPlace.googleImages = googleImages; // Store separately for reference
      } else if (validExistingImages.length > 0) {
        // No Google images, keep existing local images
        verifiedPlace.images = validExistingImages;
      } else {
        // No images at all
        verifiedPlace.images = [];
      }
      
      if (googlePlace.rating && googlePlace.rating > (localPlace.rating || 0)) {
        verifiedPlace.rating = googlePlace.rating;
      }
      
      if (googlePlace.editorialSummary?.text && (!localPlace.description || localPlace.description.length < 50)) {
        verifiedPlace.description = googlePlace.editorialSummary.text;
      }
      
      if (googlePlace.formattedAddress && (!localPlace.country || localPlace.country === 'unknown')) {
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

// Load progress
function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
  return null;
}

// Save progress
function saveProgress(progress) {
  try {
    fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

// Clean verified places
function cleanVerifiedPlaces(verifiedPlaces) {
  console.log('🧹 Cleaning verified places...');
  
  const cleaned = [];
  const seenIds = new Set();
  const seenCoordinates = new Map();

  for (const place of verifiedPlaces) {
    if (seenIds.has(place._id.$oid)) {
      continue;
    }

    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lng);
    const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    let isDuplicate = false;
    for (const [existingCoord, existingId] of seenCoordinates.entries()) {
      const [existingLat, existingLng] = existingCoord.split(',').map(Number);
      const distance = calculateDistance(lat, lng, existingLat, existingLng);
      
      if (distance < CONFIG.CLOSE_DISTANCE) {
        const existingPlace = verifiedPlaces.find(p => p._id.$oid === existingId);
        if (existingPlace && existingPlace.verified && !place.verified) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      if (place.verified) {
        cleaned.push(place);
      } else if (place.lat && place.lng && place.title && !place.deleted) {
        cleaned.push(place);
      }
      
      seenIds.add(place._id.$oid);
      seenCoordinates.set(coordKey, place._id.$oid);
    }
  }

  console.log(`✅ Cleaned: ${verifiedPlaces.length} -> ${cleaned.length} places`);
  return cleaned;
}

// Main verification function
async function verifyPlaces(resume = false, clean = false) {
  console.log('🔍 Starting places verification...');
  console.log(`📁 Input file: ${CONFIG.INPUT_FILE}`);
  console.log(`📁 Output file: ${CONFIG.OUTPUT_FILE}`);

  if (!fs.existsSync(CONFIG.INPUT_FILE)) {
    throw new Error(`Input file not found: ${CONFIG.INPUT_FILE}`);
  }

  const rawData = fs.readFileSync(CONFIG.INPUT_FILE, 'utf-8');
  const places = JSON.parse(rawData);
  
  console.log(`📊 Total places to verify: ${places.length}`);

  let progress;
  if (resume) {
    const savedProgress = loadProgress();
    if (savedProgress) {
      progress = savedProgress;
      console.log(`📌 Resuming from index ${progress.lastProcessedIndex + 1}`);
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

  const verifiedPlaces = [];
  
  if (resume && fs.existsSync(CONFIG.OUTPUT_FILE)) {
    try {
      const existingData = fs.readFileSync(CONFIG.OUTPUT_FILE, 'utf-8');
      const existingPlaces = JSON.parse(existingData);
      verifiedPlaces.push(...existingPlaces);
      console.log(`📦 Loaded ${existingPlaces.length} existing verified places`);
    } catch (error) {
      console.warn('Could not load existing verified places, starting fresh');
    }
  }

  const validPlaces = places.filter(place => 
    place.lat && 
    place.lng && 
    place.title &&
    !place.deleted &&
    (place.state === 'Active' || place.state === 'active' || !place.state) // Handle case variations, include places without state
  );

  console.log(`✅ Valid places to verify: ${validPlaces.length}`);
  console.log(`⏭️  Skipped invalid places: ${places.length - validPlaces.length}`);

  const startIndex = resume && progress ? progress.lastProcessedIndex + 1 : 0;

  for (let i = startIndex; i < validPlaces.length; i++) {
    const place = validPlaces[i];
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lng);

    if (isNaN(lat) || isNaN(lng)) {
      console.log(`⚠️  Skipping ${place.title}: Invalid coordinates`);
      progress.skipped++;
      progress.processed++;
      continue;
    }

    try {
      const matchResult = await searchPlaceByCoordinates(lat, lng, place.title);
      const verifiedPlace = mergePlaceData(
        place,
        matchResult?.place || null,
        matchResult || null
      );

      verifiedPlaces.push(verifiedPlace);

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

      if (progress.processed % CONFIG.SAVE_PROGRESS_INTERVAL === 0) {
        saveProgress(progress);
        fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(verifiedPlaces, null, 2));
        console.log(`💾 Progress saved: ${progress.processed}/${progress.total} (${((progress.processed / progress.total) * 100).toFixed(1)}%)`);
      }

      await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
    } catch (error) {
      console.error(`❌ Error processing ${place.title}:`, error.message);
      progress.errors++;
      progress.processed++;
      
      const verifiedPlace = {
        ...place,
        verified: false,
        verificationStatus: 'error',
        verificationDate: new Date().toISOString(),
        verificationNote: `Error: ${error.message}`,
      };
      verifiedPlaces.push(verifiedPlace);
    }
  }

  saveProgress(progress);
  
  let finalPlaces = verifiedPlaces;
  if (clean) {
    finalPlaces = cleanVerifiedPlaces(verifiedPlaces);
  }
  
  fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(finalPlaces, null, 2));

  console.log('\n✅ Verification complete!');
  console.log(`📊 Statistics:`);
  console.log(`   Total: ${progress.total}`);
  console.log(`   Verified: ${progress.verified}`);
  console.log(`   Not Found: ${progress.notFound}`);
  console.log(`   Errors: ${progress.errors}`);
  console.log(`   Skipped: ${progress.skipped}`);
  console.log(`📁 Output saved to: ${CONFIG.OUTPUT_FILE}`);
}

// Run script
const args = process.argv.slice(2);
const resume = args.includes('--resume') || args.includes('-r');
const clean = args.includes('--clean') || args.includes('-c');

verifyPlaces(resume, clean)
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });

