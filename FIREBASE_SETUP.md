# Firebase Setup Guide

This guide will help you set up Firebase Realtime Database and sync your places data with Google Places images.

**Note:** This project uses **React Native Firebase** (`@react-native-firebase`) for the mobile app, which provides native Firebase integration. The sync script uses the regular Firebase SDK for Node.js.

## 🚀 Quick Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or select an existing project
3. Follow the setup wizard
4. Enable **Realtime Database** (not Firestore):
   - Go to **Build** > **Realtime Database**
   - Click **"Create Database"**
   - Choose your location
   - Start in **test mode** (we'll secure it later)

### 2. Configure Sync Script (Two Options)

The sync script runs on Node.js and needs Firebase credentials. You have **two options**:

#### Option 1: Use Environment Variables (RECOMMENDED - No Web App Needed!)

You can extract values from your existing mobile app config files:

**Quick way (if you have `jq` installed):**
```bash
./scripts/get-firebase-config.sh
```

**Manual way:**
1. Open `android/app/google-services.json`
2. Extract these values:
   - `project_info.project_id` → `FIREBASE_PROJECT_ID`
   - `project_info.project_number` → `FIREBASE_MESSAGING_SENDER_ID`
   - `client[0].api_key[0].current_key` → `FIREBASE_API_KEY`
   - Construct `FIREBASE_DATABASE_URL`: `https://PROJECT_ID-default-rtdb.firebaseio.com`
   - Construct `FIREBASE_STORAGE_BUCKET`: `PROJECT_ID.appspot.com` or use `project_info.storage_bucket`
   - Construct `FIREBASE_AUTH_DOMAIN`: `PROJECT_ID.firebaseapp.com`
   - `FIREBASE_APP_ID`: Can be any value like `1:PROJECT_NUMBER:web:sync-script`

3. Set environment variables:
```bash
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_DATABASE_URL="https://your-project-default-rtdb.firebaseio.com"
export FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
export FIREBASE_API_KEY="your-api-key"
export FIREBASE_MESSAGING_SENDER_ID="123456789"
export FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
export FIREBASE_APP_ID="1:123456789:web:sync-script"
```

#### Option 2: Create a Web App (Alternative)

If you prefer, you can create a web app in Firebase Console:

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **"Your apps"** section
3. Click **"Add app"** > **Web** (</> icon)
4. Register your app (you can use any name)
5. Copy the configuration and update `FIREBASE_CONFIG` in `src/config/environment.ts`

### 3. Add Firebase to Your React Native App

#### For Android:

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **"Your apps"** section
3. Click **"Add app"** > **Android** (Android icon)
4. Register your app:
   - **Android package name**: `com.naturism` (check your `android/app/build.gradle` for the actual package name)
   - **App nickname**: Naturism Android (optional)
   - **Debug signing certificate**: Optional for now
5. Download `google-services.json`
6. Place it in `android/app/google-services.json`

#### For iOS:

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **"Your apps"** section
3. Click **"Add app"** > **iOS** (Apple icon)
4. Register your app:
   - **iOS bundle ID**: `com.naturism` (check your `ios/naturism/Info.plist` for the actual bundle ID)
   - **App nickname**: Naturism iOS (optional)
5. Download `GoogleService-Info.plist`
6. Place it in `ios/naturism/GoogleService-Info.plist`

### 4. Install Native Dependencies

**For iOS:**
```bash
cd ios && pod install && cd ..
```

**For Android:**
The Gradle plugin should automatically handle the setup. If you encounter issues, check that `google-services.json` is in the correct location.

### 5. Verify Configuration

**For React Native App:**
- React Native Firebase automatically reads from `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
- No code configuration needed!

**For Sync Script:**
- If using environment variables: Make sure they're set (check with `echo $FIREBASE_PROJECT_ID`)
- If using `environment.ts`: Update `FIREBASE_CONFIG` with your values

Open `src/config/environment.ts` and update the `FIREBASE_CONFIG` section:

```typescript
export const FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY_HERE',
  authDomain: 'your-project.firebaseapp.com',
  databaseURL: 'https://your-project-default-rtdb.firebaseio.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};
```

**Or use environment variables:**

```bash
export FIREBASE_API_KEY="your-api-key"
export FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
export FIREBASE_DATABASE_URL="https://your-project-default-rtdb.firebaseio.com"
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
export FIREBASE_MESSAGING_SENDER_ID="123456789"
export FIREBASE_APP_ID="1:123456789:web:abcdef"
```

### 4. Set Up Database Rules (Important!)

In Firebase Console, go to **Realtime Database** > **Rules** and update:

```json
{
  "rules": {
    "places": {
      ".read": true,
      ".write": false
    }
  }
}
```

For production, you should add authentication and restrict write access.

## 📊 Running the Sync Script

### Basic Usage

```bash
# Sync all places from verified.json
npm run sync-firebase

# Test with first 5 places
npm run sync-firebase:test

# Resume from a specific index
npm run sync-firebase:resume -- --start-from-index=100

# Skip places that already exist in Firebase
npm run sync-firebase -- --skip-existing
```

### Advanced Options

```bash
# Process only 10 places starting from index 50
node scripts/sync-places-to-firebase.js --start-from-index=50 --limit=10

# Skip existing places and process 20 new ones
node scripts/sync-places-to-firebase.js --limit=20 --skip-existing
```

## 🔍 What the Script Does

1. **Reads Places**: Loads from `natureism.places.verified.json` (or `natureism.places.json` as fallback)
2. **Searches Google Places**: For each place, searches Google Places API by latitude/longitude
3. **Fetches Images**: Gets all photos from Google Places API
4. **Saves to Firebase**: Stores complete place data in Firebase Realtime Database under `places/{placeId}`

## 📁 Data Structure in Firebase

Each place is stored at `places/{placeId}` with the following structure:

```json
{
  "sql_id": 1,
  "title": "Place Name",
  "description": "Description",
  "lat": "17.1098056",
  "lng": "-61.9010833",
  "country": "antigua",
  "place_type": "B",
  "images": ["url1", "url2"],
  "googlePlaceId": "ChIJ...",
  "googleRating": 4.5,
  "googleUserRatingCount": 13,
  "googleFormattedAddress": "Address",
  "googleImages": ["url1", "url2"],
  "verified": true,
  "verificationStatus": "verified",
  ...
}
```

## ⚠️ Important Notes

1. **API Rate Limits**: The script includes delays between API calls to respect Google Places API rate limits
2. **Progress Saving**: Progress is saved to `src/utils/firebase_sync_progress.json` every 10 places
3. **Resume Capability**: You can resume from any index if the script is interrupted
4. **Costs**: Google Places API charges per request. Monitor your usage in Google Cloud Console

## 🐛 Troubleshooting

### "Firebase configuration is missing"
- Make sure you've added Firebase config to `src/config/environment.ts`
- Check that all values are filled (no placeholders like `YOUR_FIREBASE_API_KEY`)

### "Permission denied" errors
- Check your Firebase Realtime Database rules
- Make sure write access is enabled (for initial sync)

### "API key error" from Google Places
- Verify your Google Places API key is correct in `environment.ts`
- Check that Places API (New) is enabled in Google Cloud Console

### Script stops unexpectedly
- Check the progress file: `src/utils/firebase_sync_progress.json`
- Resume from the last processed index using `--start-from-index`

## 🔒 Security Best Practices

1. **Never commit** `src/config/environment.ts` to version control
2. **Use environment variables** in production
3. **Restrict Firebase rules** to authenticated users in production
4. **Set up API key restrictions** in Google Cloud Console
5. **Monitor usage** to avoid unexpected costs

## 📱 Using Firebase in Your React Native App

The app now includes a Firebase service at `src/services/firebaseService.ts` that uses React Native Firebase.

### Example Usage:

```typescript
import { 
  getAllPlacesFromFirebase, 
  getNearbyPlacesFromFirebase,
  subscribeToPlaces 
} from '../services/firebaseService';

// Get all places
const places = await getAllPlacesFromFirebase();

// Get nearby places
const nearbyPlaces = await getNearbyPlacesFromFirebase(latitude, longitude, 50);

// Subscribe to real-time updates
const unsubscribe = subscribeToPlaces((places) => {
  console.log('Places updated:', places.length);
  // Update your UI
});

// Don't forget to unsubscribe when component unmounts
// unsubscribe();
```

### Integration with Places Service

You can update `src/services/placesService.ts` to use Firebase as the primary data source:

```typescript
import { getAllPlacesFromFirebase } from './firebaseService';

// Use Firebase instead of local JSON
const firebasePlaces = await getAllPlacesFromFirebase();
```

## 📚 Next Steps

After syncing places to Firebase:

1. ✅ **Firebase service created** - `src/services/firebaseService.ts` is ready to use
2. **Update your screens** - Modify your screens to use Firebase instead of local JSON
3. **Implement real-time updates** - Use `subscribeToPlaces()` for live data
4. **Add authentication** - For write access in production
5. **Set up proper database rules** - Secure your database for production

## 🔧 Troubleshooting

### "Firebase App named '[DEFAULT]' already exists"
- React Native Firebase auto-initializes from config files
- You don't need to manually initialize it in your code

### "google-services.json not found" (Android)
- Make sure `google-services.json` is in `android/app/` directory
- Rebuild the app: `npm run android`

### "GoogleService-Info.plist not found" (iOS)
- Make sure `GoogleService-Info.plist` is in `ios/naturism/` directory
- Run `cd ios && pod install && cd ..`
- Rebuild the app: `npm run ios`

### Pod install fails (iOS)
- Make sure you've run `pod install` after installing React Native Firebase
- Try cleaning: `cd ios && rm -rf Pods Podfile.lock && pod install && cd ..`

