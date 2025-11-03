# Naturism App 🌊

A React Native mobile application for discovering naturist places worldwide including beaches, camps, hotels, and saunas. The app integrates with Google's new Places API for real-time search and discovery.

## ✨ Features

- 🗺️ **Real-time Place Discovery**: Find naturist places near you using Google Places API
- 🔍 **Smart Search**: Search for places with natural language queries
- 📍 **Location-based**: Automatically shows nearby places based on your location
- 🏖️ **Category Filters**: Browse by beaches, camps, hotels, saunas, and more
- ⭐ **Ratings & Reviews**: View ratings and reviews from Google Places
- 📱 **Cross-platform**: Works on both iOS and Android
- 🌍 **Global Coverage**: Access to places worldwide

## 🚀 Getting Started

### Prerequisites

- Node.js (>= 20)
- React Native development environment setup
- iOS: Xcode and CocoaPods
- Android: Android Studio and SDK
- Google Places API key (see setup guide below)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd naturism
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install iOS dependencies**
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Configure Google Places API**
   
   See [GOOGLE_PLACES_SETUP.md](./GOOGLE_PLACES_SETUP.md) for detailed instructions.
   
   Quick setup:
   - Get an API key from [Google Cloud Console](https://console.cloud.google.com/)
   - Copy `src/config/environment.example.ts` to `src/config/environment.ts`
   - Add your API key to `environment.ts`

5. **Run the app**
   
   iOS:
   ```bash
   npm run ios
   ```
   
   Android:
   ```bash
   npm run android
   ```

## 📚 Documentation

- [Google Places API Setup Guide](./GOOGLE_PLACES_SETUP.md) - Complete guide for API integration
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)

## 📁 Project Structure

```
naturism/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── CategorySection.tsx
│   │   ├── PlaceCard.tsx
│   │   └── SearchBar.tsx
│   ├── config/              # Configuration files
│   │   ├── environment.ts   # API keys (not committed)
│   │   └── environment.example.ts
│   ├── navigation/          # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── screens/             # Screen components
│   │   ├── ContactScreen.tsx
│   │   ├── ExploreScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   └── MapScreen.tsx
│   ├── services/            # Business logic and API calls
│   │   ├── googlePlacesService.ts  # Google Places API integration
│   │   ├── locationService.ts      # Location services
│   │   └── placesService.ts        # Places data management
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts
│   └── utils/               # Utility functions and constants
│       ├── constants.ts
│       └── natureism.places.json
├── android/                 # Android native code
├── ios/                     # iOS native code
├── App.tsx                  # Root component
└── package.json

```

## 🛠️ Available Scripts

- `npm start` - Start Metro bundler
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## 🔑 Key Services

### Google Places Service
Location: `src/services/googlePlacesService.ts`

Provides direct integration with Google Places API (New):
- `searchNearbyPlaces()` - Find places near a location
- `searchPlacesByText()` - Text-based search
- `searchNaturistPlaces()` - Specialized naturist place search
- `getPlaceDetails()` - Get detailed information about a place
- `getPhotoUrl()` - Get photo URLs from Google Places

### Places Service
Location: `src/services/placesService.ts`

Business logic layer that combines local and API data:
- `getNearbyPlacesFromAPI()` - Get nearby places from Google API
- `searchPlacesFromAPI()` - Search places using Google API
- `getHybridNearbyPlaces()` - Merge local and Google data
- `getPlacesByCategory()` - Filter places by category
- Legacy functions for local data fallback

### Location Service
Location: `src/services/locationService.ts`

Handles device location and distance calculations:
- `getCurrentLocation()` - Get user's current location
- `calculateDistance()` - Calculate distance between two points

## 🏗️ Architecture

### Data Flow

```
User Location
    ↓
Google Places API
    ↓
Transform Data
    ↓
Business Logic (Filtering, Sorting)
    ↓
UI Components
    ↓
User Interface
```

### Fallback Strategy

The app implements a graceful fallback strategy:

1. Try Google Places API first (if configured)
2. Fall back to local data if API fails
3. Display error messages for debugging
4. Continue functioning with cached/local data

## 🔒 Security

- API keys are stored in `src/config/environment.ts` (not committed to git)
- Example configuration in `src/config/environment.example.ts`
- See [GOOGLE_PLACES_SETUP.md](./GOOGLE_PLACES_SETUP.md) for security best practices

## 🧪 Testing

```bash
npm test
```

The app includes unit tests for core functionality. Add more tests as needed.

## 📱 Platform-Specific Notes

### iOS

- Requires iOS 13.0 or later
- Uses CocoaPods for dependency management
- Google Maps SDK integrated for map view

### Android

- Minimum SDK version: 23 (Android 6.0)
- Target SDK version: 34
- Google Maps API key required in AndroidManifest.xml

## 🌐 API Integration

This app uses:
- **Google Places API (New)** - For real-time place search and discovery
- **Google Maps SDK** - For displaying maps and markers
- **Geolocation API** - For user location tracking

### API Costs

Google Places API has usage-based pricing:
- Text Search: $32 per 1,000 requests
- Nearby Search: $32 per 1,000 requests
- Place Details: $17 per 1,000 requests
- Place Photos: $7 per 1,000 requests

Google provides $200 free credit monthly. See [pricing details](https://developers.google.com/maps/billing-and-pricing/pricing).

## 🐛 Troubleshooting

### Common Issues

**Metro bundler not starting**
```bash
npm start -- --reset-cache
```

**iOS build fails**
```bash
cd ios && pod install && cd ..
npm run ios
```

**Android build fails**
```bash
cd android && ./gradlew clean && cd ..
npm run android
```

**No places showing up**
- Check if API key is configured correctly
- Verify internet connection
- Check console logs for API errors
- Ensure Places API (New) is enabled in Google Cloud Console

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Check [GOOGLE_PLACES_SETUP.md](./GOOGLE_PLACES_SETUP.md) for API setup help
- Review console logs for detailed error messages
- Open an issue on GitHub

## 🎉 Acknowledgments

- Google Places API for providing comprehensive place data
- React Native community for excellent tooling and libraries
- All contributors who help improve this project

---

Built with ❤️ using React Native