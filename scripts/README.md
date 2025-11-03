# Verification Script Output

## What You Get After Running

After running `npm run verify-places`, you'll get:

### 1. New Verified File

**`src/utils/natureism.places.verified.json`**

This is a NEW file containing:
- ✅ All original place data (preserved)
- ✅ Verified Google Places data merged in
- ✅ **Images**: Google Places photos + your existing images (merged together)
- ✅ Updated ratings, addresses, websites, phone numbers
- ✅ Verification metadata

### 2. Progress File

**`src/utils/verification_progress.json`**

Tracks progress so you can resume if interrupted.

### 3. Image Details

The verified file includes an `images` array for each place:

```json
{
  "title": "Hawksbill Bay",
  "images": [
    "https://places.googleapis.com/v1/places/.../media?...", // Google photo 1
    "https://places.googleapis.com/v1/places/.../media?...", // Google photo 2
    "https://naturismimage.s3.us-east-2.amazonaws.com/1_1589786022_tmp.jpg", // Your existing image
    // ... more images
  ],
  "googleImages": [
    "https://places.googleapis.com/v1/places/.../media?...", // Google photos only
  ],
  "verified": true,
  "googlePlaceId": "ChIJ...",
  // ... other fields
}
```

### Image Priority

1. **If Google Places has photos**: Up to 5 high-quality photos (800px) are added first
2. **Your existing images**: Valid local images are added after Google images
3. **No duplicates**: Same URL won't appear twice
4. **If no Google photos**: Your existing images are kept as-is

## File Size

The verified file will be similar in size to the original, potentially:
- **Larger**: If many places get verified with additional data
- **Smaller**: If duplicates are removed (when using `--clean` flag)

## Location

Both files are created in:
```
src/utils/
├── natureism.places.json              (original - unchanged)
├── natureism.places.verified.json     (NEW - verified data)
└── verification_progress.json         (NEW - progress tracking)
```

## Usage in App

The app automatically uses the verified file if it exists:

```typescript
// placesService.ts automatically loads verified file
// Falls back to original if verified doesn't exist
```

No code changes needed - it just works! 🎉

