/**
 * Sync Places to Firebase Script
 * 
 * This script:
 * 1. Reads places from natureism.places.verified.json (or natureism.places.json as fallback)
 * 2. For each place, searches Google Places API by lat/lng to find matching places
 * 3. Fetches images from Google Places API
 * 4. Saves the complete place data to Firebase Realtime Database
 * 
 * Run with: node scripts/sync-places-to-firebase.js [--start-from-index=N] [--limit=N]
 * 
 * Options:
 * --start-from-index=N: Start processing from a specific index (useful for resuming)
 * --limit=N: Process only N places (useful for testing)
 * --skip-existing: Skip places that already exist in Firebase
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get } = require('firebase/database');
const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');

// Configuration
const CONFIG = {
  API_DELAY: 200, // Delay between API calls in ms
  SAVE_PROGRESS_INTERVAL: 10, // Save progress every N places
  VERIFIED_FILE: path.join(__dirname, '../src/utils/natureism.places.verified.json'),
  ORIGINAL_FILE: path.join(__dirname, '../src/utils/natureism.places.json'),
  PROGRESS_FILE: path.join(__dirname, '../src/utils/firebase_sync_progress.json'),
  GOOGLE_PLACES_API_KEY: (() => {
    try {
      const envFile = fs.readFileSync(path.join(__dirname, '../src/config/environment.ts'), 'utf-8');
      const match = envFile.match(/GOOGLE_PLACES_API_KEY\s*=\s*['"]([^'"]+)['"]/);
      if (match) {
        return match[1];
      }
    } catch (e) {
      // Ignore
    }
    throw new Error('GOOGLE_PLACES_API_KEY not found. Set it in environment.ts');
  })(),
  FIREBASE_CONFIG: (() => {
    // Priority: 1. Environment variables, 2. environment.ts file
    const config = {};
    
    // Get from environment variables first (recommended)
    const envVars = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    };
    
    // Check if all required env vars are set
    const allEnvVarsSet = Object.values(envVars).every(v => v && !v.startsWith('YOUR_'));
    
    if (allEnvVarsSet) {
      console.log('✅ Using Firebase config from environment variables');
      return envVars;
    }
    
    // Fallback: Try to read from environment.ts
    try {
      const envFile = fs.readFileSync(path.join(__dirname, '../src/config/environment.ts'), 'utf-8');
      
      // Extract Firebase config values - handle process.env.FIREBASE_XXX || 'value' format
      const keyMapping = {
        apiKey: 'FIREBASE_API_KEY',
        authDomain: 'FIREBASE_AUTH_DOMAIN',
        databaseURL: 'FIREBASE_DATABASE_URL',
        projectId: 'FIREBASE_PROJECT_ID',
        storageBucket: 'FIREBASE_STORAGE_BUCKET',
        messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
        appId: 'FIREBASE_APP_ID',
      };
      
      Object.keys(keyMapping).forEach(key => {
        const envVarName = keyMapping[key];
        // Match: key: process.env.FIREBASE_XXX || 'value'
        const pattern = new RegExp(`${key}:\\s*process\\.env\\.${envVarName}\\s*\\|\\|\\s*['"]([^'"]+)['"]`, 'i');
        const match = envFile.match(pattern);
        
        if (match) {
          // Check environment variable first, then use matched value
          config[key] = process.env[envVarName] || match[1];
        } else {
          // Try simple string format: key: 'value'
          const simplePattern = new RegExp(`${key}:\\s*['"]([^'"]+)['"]`, 'i');
          const simpleMatch = envFile.match(simplePattern);
          if (simpleMatch) {
            config[key] = process.env[envVarName] || simpleMatch[1];
          }
        }
      });
      
      // Check if any config is still placeholder
      const hasPlaceholder = Object.values(config).some(val => val && (val.startsWith('YOUR_') || val === ''));
      if (hasPlaceholder || Object.keys(config).length === 0) {
        console.warn('⚠️  Firebase config contains placeholders or is missing.');
        console.warn('\n📝 To configure Firebase for the sync script, you have two options:');
        console.warn('\nOption 1: Use environment variables (RECOMMENDED - no web app needed):');
        console.warn('   Get values from your mobile app config files:');
        console.warn('   - Android: android/app/google-services.json');
        console.warn('   - iOS: ios/naturism/GoogleService-Info.plist');
        console.warn('\n   Then set environment variables:');
        console.warn('   export FIREBASE_API_KEY="your-api-key"');
        console.warn('   export FIREBASE_DATABASE_URL="https://your-project-default-rtdb.firebaseio.com"');
        console.warn('   export FIREBASE_PROJECT_ID="your-project-id"');
        console.warn('   # ... and other values');
        console.warn('\nOption 2: Create a Web app in Firebase Console');
        console.warn('   Firebase Console > Project Settings > Your apps > Add app > Web');
        console.warn('   Then update FIREBASE_CONFIG in src/config/environment.ts');
        return null;
      }
      
      console.log('✅ Using Firebase config from environment.ts');
      return config;
    } catch (e) {
      console.error('Error reading Firebase config:', e.message);
      return null;
    }
  })(),
  PLACES_API_BASE_URL: 'https://places.googleapis.com/v1',
};

// Initialize Firebase
let db = null;
let storage = null;
if (CONFIG.FIREBASE_CONFIG && !Object.values(CONFIG.FIREBASE_CONFIG).some(v => v.startsWith('YOUR_'))) {
  try {
    const app = initializeApp(CONFIG.FIREBASE_CONFIG);
    db = getDatabase(app);
    storage = getStorage(app);
    console.log('✅ Firebase initialized successfully');
    console.log('✅ Firebase Storage initialized');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    process.exit(1);
  }
} else {
  console.error('❌ Firebase configuration is missing or incomplete');
  console.error('   Please add Firebase config to src/config/environment.ts');
  process.exit(1);
}

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

// Search Google Places API by location
async function searchPlacesByLocation(lat, lng, title) {
  try {
    // First, try nearby search
    const requestBody = {
      includedTypes: ['tourist_attraction', 'campground', 'lodging', 'spa', 'beach', 'park'],
      maxResultCount: 5,
      locationRestriction: {
        circle: {
          center: {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
          },
          radius: 100, // 100 meters radius
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
    
    // Find the closest match
    let bestMatch = null;
    let minDistance = Infinity;
    
    for (const place of places) {
      if (place.location) {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          place.location.latitude,
          place.location.longitude
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = { ...place, distanceKm: distance };
        }
      }
    }
    
    // If we found a match within 200m, use it
    if (bestMatch && bestMatch.distanceKm < 0.2) {
      return bestMatch;
    }
    
    // Otherwise, try text search with the place title
    if (title) {
      const textSearchBody = {
        textQuery: title,
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: {
              latitude: parseFloat(lat),
              longitude: parseFloat(lng),
            },
            radius: 500, // 500 meters
          },
        },
        languageCode: 'en',
      };

      const textResponse = await axios.post(
        `${CONFIG.PLACES_API_BASE_URL}/places:searchText`,
        textSearchBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': CONFIG.GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.types,places.editorialSummary,places.websiteUri,places.nationalPhoneNumber',
          },
        }
      );

      const textPlaces = textResponse.data.places || [];
      
      // Find the closest match from text search
      for (const place of textPlaces) {
        if (place.location) {
          const distance = calculateDistance(
            parseFloat(lat),
            parseFloat(lng),
            place.location.latitude,
            place.location.longitude
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            bestMatch = { ...place, distanceKm: distance };
          }
        }
      }
    }
    
    return bestMatch;
  } catch (error) {
    console.error(`Error searching places for ${title}:`, error.response?.data || error.message);
    return null;
  }
}

// Get place details with all photos
async function getPlaceDetails(placeId) {
  try {
    const response = await axios.get(
      `${CONFIG.PLACES_API_BASE_URL}/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': CONFIG.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': '*',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Error getting place details for ${placeId}:`, error.response?.data || error.message);
    return null;
  }
}

// Generate photo URLs from photo names (Google Places API URLs)
function generatePhotoUrls(photos, maxWidth = 800) {
  if (!photos || !Array.isArray(photos)) {
    return [];
  }
  
  return photos.map(photo => {
    if (typeof photo === 'string') {
      // Already a URL
      return photo;
    }
    
    const photoName = photo.name || photo;
    return `${CONFIG.PLACES_API_BASE_URL}/${photoName}/media?key=${CONFIG.GOOGLE_PLACES_API_KEY}&maxWidthPx=${maxWidth}`;
  });
}

/**
 * Download image from URL and upload to Firebase Storage
 * Returns Firebase Storage download URL
 */
async function uploadImageToFirebaseStorage(imageUrl, placeId, imageIndex) {
  try {
    // Download image from Google Places API
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
    });
    
    const imageBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    // Determine file extension from content type
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    if (contentType.includes('webp')) extension = 'webp';
    
    // Create storage path: places/{placeId}/images/{index}.{ext}
    const storagePath = `places/${placeId}/images/${imageIndex}.${extension}`;
    const imageRef = storageRef(storage, storagePath);
    
    // Upload to Firebase Storage
    await uploadBytes(imageRef, imageBuffer, {
      contentType: contentType,
      cacheControl: 'public, max-age=31536000', // Cache for 1 year
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(imageRef);
    
    console.log(`    📤 Uploaded image ${imageIndex + 1} to Firebase Storage: ${storagePath}`);
    
    return downloadURL;
  } catch (error) {
    console.error(`    ❌ Error uploading image ${imageIndex + 1} to Firebase Storage:`, error.message);
    // Return original URL as fallback
    return imageUrl;
  }
}

/**
 * Upload multiple images to Firebase Storage
 * Returns array of Firebase Storage URLs
 */
async function uploadImagesToFirebaseStorage(imageUrls, placeId) {
  if (!imageUrls || imageUrls.length === 0) {
    return [];
  }
  
  console.log(`  📤 Uploading ${imageUrls.length} images to Firebase Storage...`);
  
  const firebaseUrls = [];
  
  // Upload images sequentially to avoid overwhelming the API
  for (let i = 0; i < imageUrls.length; i++) {
    const firebaseUrl = await uploadImageToFirebaseStorage(imageUrls[i], placeId, i);
    firebaseUrls.push(firebaseUrl);
    
    // Small delay between uploads
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
    }
  }
  
  return firebaseUrls;
}

/**
 * Sanitize data for Firebase Realtime Database
 * Firebase doesn't allow keys with special characters: $, ., #, /, [, ]
 */
function sanitizeForFirebase(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirebase(item));
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip invalid keys (Firebase doesn't allow these characters in keys)
    if (key.includes('.') || key.includes('#') || key.includes('$') || 
        key.includes('/') || key.includes('[') || key.includes(']')) {
      // Convert special keys to safe alternatives
      const safeKey = key.replace(/\$/g, '_dollar_')
                         .replace(/\./g, '_dot_')
                         .replace(/#/g, '_hash_')
                         .replace(/\//g, '_slash_')
                         .replace(/\[/g, '_lbracket_')
                         .replace(/\]/g, '_rbracket_');
      sanitized[safeKey] = sanitizeForFirebase(value);
      continue;
    }
    
    // Handle MongoDB-style objects like { $oid: "..." } or { $date: "..." }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (value.$oid) {
        // Convert { $oid: "..." } to just the string value
        sanitized[key] = value.$oid;
      } else if (value.$date) {
        // Convert { $date: "..." } to ISO string
        sanitized[key] = typeof value.$date === 'string' ? value.$date : new Date(value.$date).toISOString();
      } else {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeForFirebase(value);
      }
    } else {
      // Recursively sanitize arrays and primitives
      sanitized[key] = sanitizeForFirebase(value);
    }
  }
  
  return sanitized;
}

// Process a single place
async function processPlace(place, index, total) {
  console.log(`\n[${index + 1}/${total}] Processing: ${place.title || 'Unknown'}`);
  
  // Check if place already exists in Firebase (if --skip-existing flag is set)
  if (process.argv.includes('--skip-existing')) {
    try {
      const placeRef = ref(db, `places/${place.sql_id || place._id?.$oid || index}`);
      const snapshot = await get(placeRef);
      if (snapshot.exists()) {
        console.log(`  ⏭️  Skipping (already exists in Firebase)`);
        return { skipped: true };
      }
    } catch (error) {
      // Continue if check fails
    }
  }
  
  const lat = place.lat;
  const lng = place.lng;
  const title = place.title;
  
  if (!lat || !lng) {
    console.log(`  ⚠️  Missing coordinates, skipping`);
    return { skipped: true, reason: 'missing_coordinates' };
  }
  
  // If place already has googlePlaceId, use it
  let googlePlace = null;
  if (place.googlePlaceId) {
    console.log(`  🔍 Found existing Google Place ID: ${place.googlePlaceId}`);
    googlePlace = await getPlaceDetails(place.googlePlaceId);
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  } else {
    // Search for the place
    console.log(`  🔍 Searching Google Places API...`);
    googlePlace = await searchPlacesByLocation(lat, lng, title);
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  // Prepare the place data for Firebase
  // Extract _id.$oid to a simple string field
  const originalId = place._id?.$oid || place._id || null;
  const createdAtDate = place.createdAt?.$date || place.createdAt || new Date().toISOString();
  const updatedAtDate = place.updatedAt?.$date || new Date().toISOString();
  
  const firebasePlace = {
    // Preserve original fields (but sanitize nested objects)
    sql_id: place.sql_id,
    original_id: originalId, // Convert _id.$oid to simple string
    title: place.title,
    description: place.description,
    lat: place.lat,
    lng: place.lng,
    country: place.country,
    place_type: place.place_type,
    images: place.images || [],
    rating: place.rating || 0,
    state: place.state || 'Active',
    createdAt: typeof createdAtDate === 'string' ? createdAtDate : new Date(createdAtDate).toISOString(),
    updatedAt: typeof updatedAtDate === 'string' ? updatedAtDate : new Date(updatedAtDate).toISOString(),
    // Preserve other fields
    features: place.features || [],
    featured: place.featured || false,
    deleted: place.deleted || false,
    likes: place.likes || [],
    admin: place.admin || false,
    rank: place.rank || 0,
    booking: place.booking || 'deactive',
    link: place.link || '',
    thumbnail: place.thumbnail || '',
  };
  
  // Add Google Places data if found
  if (googlePlace) {
    console.log(`  ✅ Found Google Place: ${googlePlace.displayName?.text || 'Unknown'}`);
    
    firebasePlace.googlePlaceId = googlePlace.id;
    firebasePlace.googleRating = googlePlace.rating;
    firebasePlace.googleUserRatingCount = googlePlace.userRatingCount;
    firebasePlace.googleFormattedAddress = googlePlace.formattedAddress;
    firebasePlace.googleDisplayName = googlePlace.displayName?.text;
    firebasePlace.googleTypes = googlePlace.types;
    firebasePlace.googleWebsiteUri = googlePlace.websiteUri;
    firebasePlace.googleNationalPhoneNumber = googlePlace.nationalPhoneNumber;
    firebasePlace.googleEditorialSummary = googlePlace.editorialSummary?.text;
    firebasePlace.googleLocation = googlePlace.location;
    firebasePlace.googleDistanceKm = googlePlace.distanceKm;
    
    // Get images from Google Places and upload to Firebase Storage
    if (googlePlace.photos && googlePlace.photos.length > 0) {
      const googleImageUrls = generatePhotoUrls(googlePlace.photos);
      console.log(`  📷 Found ${googleImageUrls.length} Google Places images`);
      
      // Upload images to Firebase Storage
      const placeId = place.sql_id || originalId || `place_${index}`;
      const firebaseStorageUrls = await uploadImagesToFirebaseStorage(googleImageUrls, placeId);
      
      // Store both original Google URLs and Firebase Storage URLs
      firebasePlace.googleImages = googleImageUrls; // Keep original URLs for reference
      firebasePlace.firebaseImages = firebaseStorageUrls; // Firebase Storage URLs (primary)
      
      // Use Firebase Storage URLs as primary images, fallback to Google URLs if upload failed
      const primaryImages = firebaseStorageUrls.length > 0 
        ? firebaseStorageUrls 
        : googleImageUrls;
      
      // Merge with existing images (Firebase images first, then Google, then original)
      firebasePlace.images = [
        ...primaryImages,
        ...(place.images || []).filter(img => 
          !googleImageUrls.includes(img) && !firebaseStorageUrls.includes(img)
        )
      ].filter((img, idx, arr) => 
        arr.indexOf(img) === idx // Remove duplicates
      );
      
      const uploadedCount = firebaseStorageUrls.filter(url => url && url.startsWith('https://firebasestorage')).length;
      console.log(`  ✅ Uploaded ${uploadedCount}/${googleImageUrls.length} images to Firebase Storage`);
    }
    
    // Mark as verified
    firebasePlace.verified = true;
    firebasePlace.verificationStatus = 'verified';
    firebasePlace.verificationDate = new Date().toISOString();
  } else {
    console.log(`  ⚠️  No Google Place found`);
    firebasePlace.verified = false;
    firebasePlace.verificationStatus = 'not_found';
  }
  
  // Sanitize data before saving (remove invalid keys for Firebase)
  const sanitizedPlace = sanitizeForFirebase(firebasePlace);
  
  // Save to Firebase
  try {
    const placeId = place.sql_id || originalId || `place_${index}`;
    const placeRef = ref(db, `places/${placeId}`);
    await set(placeRef, sanitizedPlace);
    console.log(`  💾 Saved to Firebase: places/${placeId}`);
    
    return { success: true, placeId, hasGoogleData: !!googlePlace };
  } catch (error) {
    console.error(`  ❌ Error saving to Firebase:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  console.log('🚀 Starting Places to Firebase Sync\n');
  
  // Parse command line arguments
  const startFromIndex = process.argv.find(arg => arg.startsWith('--start-from-index='))?.split('=')[1] || 0;
  const limit = process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  
  // Load places
  let places = [];
  let sourceFile = CONFIG.VERIFIED_FILE;
  
  if (fs.existsSync(CONFIG.VERIFIED_FILE)) {
    console.log(`📂 Loading from: ${path.basename(CONFIG.VERIFIED_FILE)}`);
    const verifiedData = JSON.parse(fs.readFileSync(CONFIG.VERIFIED_FILE, 'utf-8'));
    places = Array.isArray(verifiedData) ? verifiedData : [];
  } else if (fs.existsSync(CONFIG.ORIGINAL_FILE)) {
    console.log(`📂 Loading from: ${path.basename(CONFIG.ORIGINAL_FILE)}`);
    sourceFile = CONFIG.ORIGINAL_FILE;
    const originalData = JSON.parse(fs.readFileSync(CONFIG.ORIGINAL_FILE, 'utf-8'));
    places = Array.isArray(originalData) ? originalData : [];
  } else {
    console.error('❌ No places file found!');
    process.exit(1);
  }
  
  console.log(`📊 Total places: ${places.length}\n`);
  
  // Load progress
  let progress = { lastIndex: parseInt(startFromIndex), stats: { success: 0, failed: 0, skipped: 0 } };
  if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
    const savedProgress = JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
    progress = { ...progress, ...savedProgress };
  }
  
  // Determine range
  const startIndex = parseInt(startFromIndex) || progress.lastIndex || 0;
  const endIndex = limit ? Math.min(startIndex + parseInt(limit), places.length) : places.length;
  const placesToProcess = places.slice(startIndex, endIndex);
  
  console.log(`📍 Processing places ${startIndex} to ${endIndex - 1} (${placesToProcess.length} places)\n`);
  
  // Process places
  for (let i = 0; i < placesToProcess.length; i++) {
    const place = placesToProcess[i];
    const globalIndex = startIndex + i;
    
    const result = await processPlace(place, globalIndex, places.length);
    
    // Update stats
    if (result.skipped) {
      progress.stats.skipped++;
    } else if (result.success) {
      progress.stats.success++;
    } else {
      progress.stats.failed++;
    }
    
    progress.lastIndex = globalIndex + 1;
    
    // Save progress periodically
    if ((i + 1) % CONFIG.SAVE_PROGRESS_INTERVAL === 0) {
      fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
      console.log(`\n💾 Progress saved: ${progress.stats.success} success, ${progress.stats.failed} failed, ${progress.stats.skipped} skipped`);
    }
    
    // Delay between requests
    if (i < placesToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
    }
  }
  
  // Final progress save
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
  
  console.log('\n✅ Sync completed!');
  console.log(`📊 Statistics:`);
  console.log(`   ✅ Success: ${progress.stats.success}`);
  console.log(`   ❌ Failed: ${progress.stats.failed}`);
  console.log(`   ⏭️  Skipped: ${progress.stats.skipped}`);
  console.log(`\n💾 Progress saved to: ${CONFIG.PROGRESS_FILE}`);
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

