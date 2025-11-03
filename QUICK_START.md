# 🚀 Quick Start Guide - Google Places API Integration

Get your Naturism app running with Google Places API in 5 minutes!

## Step 1: Get Your API Key (2 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a Project"** → **"New Project"**
3. Name it "Naturism App" and click **Create**
4. Wait for the project to be created (you'll see a notification)
5. Go to **"APIs & Services"** → **"Library"**
6. Search for **"Places API (New)"**
7. Click on it and press **"Enable"**
8. Go to **"APIs & Services"** → **"Credentials"**
9. Click **"Create Credentials"** → **"API Key"**
10. Copy your API key (looks like: `AIzaSyAbc123...`)

## Step 2: Configure Your App (1 minute)

Open your terminal in the project directory and run:

```bash
# Copy the example configuration
cp src/config/environment.example.ts src/config/environment.ts
```

Now open `src/config/environment.ts` and replace the placeholder with your actual API key:

```typescript
export const GOOGLE_PLACES_API_KEY = 'AIzaSyAbc123...'; // Paste your key here
```

## Step 3: Install Dependencies (1 minute)

```bash
npm install
```

For iOS, also run:
```bash
cd ios && pod install && cd ..
```

## Step 4: Run Your App (1 minute)

**For iOS:**
```bash
npm run ios
```

**For Android:**
```bash
npm run android
```

## Step 5: Test It! (30 seconds)

1. Open the app on your device/simulator
2. The app will ask for location permission - **Allow it**
3. Pull down on the home screen to refresh
4. You should see nearby places loaded from Google Places API!
5. Try searching for "beach" or "hotel" in the search bar

## 🎉 You're Done!

The app is now using Google Places API for:
- ✅ Finding nearby naturist places
- ✅ Searching for places worldwide
- ✅ Real-time place information
- ✅ Photos from Google

## 🐛 Troubleshooting

### "No places showing up"

**Check console logs:**
```
⚠️ Google Places API key is not configured
```
→ Make sure you added your API key to `src/config/environment.ts`

**Check console logs:**
```
API Key Error: 403
```
→ Make sure you enabled "Places API (New)" in Google Cloud Console

### "App crashes on startup"

**Clear cache and rebuild:**
```bash
# Clean Metro cache
npm start -- --reset-cache

# For iOS
cd ios && pod install && cd ..
npm run ios

# For Android
cd android && ./gradlew clean && cd ..
npm run android
```

### "Location not detected"

**iOS:**
- Go to Settings → Privacy → Location Services
- Find your app and set to "While Using App"

**Android:**
- Go to Settings → Apps → Your App → Permissions
- Enable Location permission

## 💰 Cost Estimation

Google provides **$200 free credit per month**, which covers:
- ~6,000 text searches per month
- ~6,000 nearby searches per month  
- ~11,000 place details requests per month

For a typical user:
- ~5 API calls per session
- ~100 sessions per month
- **Total: ~500 calls/month = ~$16/month**
- **Well within the free tier! 🎉**

## 🔐 Security Note

⚠️ **IMPORTANT**: Never commit `src/config/environment.ts` to git!

It's already in `.gitignore`, but double-check:
```bash
git status
# Should NOT show src/config/environment.ts
```

## 📚 Learn More

- **Full Setup Guide**: [GOOGLE_PLACES_SETUP.md](./GOOGLE_PLACES_SETUP.md)
- **Implementation Details**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Project Overview**: [README.md](./README.md)

## 🎯 Next Steps

1. **Restrict Your API Key** (Recommended):
   - Go to Google Cloud Console → Credentials
   - Click on your API key
   - Under "API restrictions", select "Restrict key"
   - Choose "Places API (New)"
   - Save

2. **Set Up Billing Alerts**:
   - Go to Billing → Budgets & alerts
   - Create a budget
   - Set alert at 50%, 90%, 100% of $200

3. **Monitor Usage**:
   - Go to Google Cloud Console → APIs & Services → Dashboard
   - View your API usage in real-time

## 🤝 Need Help?

1. Check the console logs for detailed error messages
2. Review [GOOGLE_PLACES_SETUP.md](./GOOGLE_PLACES_SETUP.md) troubleshooting section
3. Make sure you enabled "Places API (New)" (not the old Places API)
4. Verify your API key is correct

---

**Happy coding! 🎉** If you run into issues, check the documentation files or the console logs for clues.
