# Places Verification Service

This service verifies places from `natureism.places.json` against Google Places API and creates a new verified JSON file with validated data.

## Overview

The verification service:
- ✅ Validates places against Google Places API
- ✅ Merges verified data (ratings, addresses, websites, etc.)
- ✅ Removes duplicates and invalid entries
- ✅ Saves progress periodically (can resume if interrupted)
- ✅ Creates a new verified JSON file: `natureism.places.verified.json`

## Usage

### Basic Usage

Run the verification script:

```bash
npm run verify-places
```

### Resume from Last Checkpoint

If the script is interrupted, you can resume from where it left off:

```bash
npm run verify-places:resume
```

### Clean and Verify

Remove duplicates and invalid entries after verification:

```bash
npm run verify-places:clean
```

### Full Verification with Cleanup

```bash
npm run verify-places:full
```

## How It Works

1. **Reads Input File**: Loads places from `src/utils/natureism.places.json`

2. **Validates Places**: Filters out invalid places (missing coordinates, deleted, inactive)

3. **Searches Google Places API**:
   - First tries nearby search (within 500m)
   - Falls back to text search if needed
   - Matches by proximity (within 100m) and name similarity (>60%)

4. **Merges Data**:
   - Keeps existing local data
   - Updates with verified Google Places data:
     - Ratings (if Google has better rating)
     - Addresses (if local is missing)
     - Websites and phone numbers
     - Descriptions (if local is minimal)

5. **Saves Progress**:
   - Progress saved every 100 places
   - Can resume from last checkpoint
   - Final output: `natureism.places.verified.json`

## Output Files

- **`natureism.places.verified.json`**: Verified places with merged Google Places data
  - Contains all original place data
  - Merged with verified Google Places information
  - **Includes images**: Google Places photos + existing local images (merged, no duplicates)
  - New file created in same directory as original
- **`verification_progress.json`**: Progress tracking (allows resuming)

## Verified Place Structure

Each verified place includes:

```typescript
{
  // ... original RawPlace fields (all preserved) ...
  images: string[];                    // Merged images: Google Places photos + local images
  googleImages?: string[];             // Google Places photos (separate reference)
  verified: boolean;                    // Whether place was found in Google Places
  verificationStatus: 'verified' | 'not_found' | 'error' | 'pending';
  verificationDate: string;             // ISO timestamp
  verificationNote?: string;            // Additional info
  googlePlaceId?: string;              // Google Place ID
  googleRating?: number;               // Rating from Google
  googleUserRatingCount?: number;      // Number of reviews
  googleFormattedAddress?: string;     // Full address from Google
  googleWebsite?: string;              // Website URL
  googlePhone?: string;                // Phone number
}
```

### Image Handling

- **Google Places Images**: If found, up to 5 high-quality photos (800px width) are added
- **Local Images**: Existing valid images are preserved and merged
- **No Duplicates**: Images are deduplicated (same URL won't appear twice)
- **Priority**: Google images appear first, then local images
- **Fallback**: If no Google images found, keeps existing local images

## Configuration

Edit `scripts/verify-places.js` to adjust:

- `MATCH_DISTANCE_THRESHOLD`: Maximum distance for matching (default: 0.1km = 100m)
- `NAME_SIMILARITY_THRESHOLD`: Minimum name similarity (default: 0.6 = 60%)
- `API_DELAY`: Delay between API calls in ms (default: 100ms)
- `SAVE_PROGRESS_INTERVAL`: Save progress every N places (default: 100)

## Rate Limiting

The script includes:
- 100ms delay between API calls
- Automatic retry on rate limit (429 errors)
- Progress saving to prevent data loss

## Using Verified Data

The app automatically uses `natureism.places.verified.json` if it exists. Update `placesService.ts` to prioritize verified data:

```typescript
// placesService.ts will automatically use verified file if available
import placesData from '../utils/natureism.places.verified.json';
// Falls back to original file if verified doesn't exist
```

## Benefits

1. **Data Quality**: Removes false/invalid entries
2. **Memory Savings**: Smaller file size after removing duplicates
3. **Verified Information**: Ratings, addresses, websites from Google
4. **Resumable**: Can pause and resume verification
5. **Non-destructive**: Original file remains unchanged

## Notes

- The verification process may take several hours for large datasets
- Google Places API has rate limits - the script handles this automatically
- Original file is never modified - verified data is in a new file
- Progress is saved periodically, so you can safely stop and resume

## Troubleshooting

### API Key Error

Make sure your Google Places API key is set in `src/config/environment.ts` or as environment variable:

```bash
export GOOGLE_PLACES_API_KEY=your_key_here
npm run verify-places
```

### Rate Limiting

If you hit rate limits frequently, increase `API_DELAY` in the script.

### Out of Memory

For very large files, process in batches by modifying the script to process a subset at a time.

