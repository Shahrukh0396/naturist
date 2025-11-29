# Offline Support Guide

## ✅ Offline Support Implemented

Your app now has full offline support! Here's what's been set up:

### 1. **Firebase Offline Persistence**
- ✅ Enabled in `src/services/firebaseService.ts`
- ✅ Automatically caches all places data locally
- ✅ Works seamlessly when device goes offline
- ✅ Automatically syncs when connection is restored

### 2. **Offline Status Monitoring**
- ✅ `useOfflineStatus` hook to monitor network status
- ✅ `OfflineIndicator` component shows offline banner
- ✅ Real-time network status updates

### 3. **Graceful Fallbacks**
- ✅ Firebase → Local JSON fallback
- ✅ Cached data when offline
- ✅ Automatic sync when online

## 🔧 How It Works

### Firebase Offline Persistence

React Native Firebase automatically:
1. **Caches data locally** when you fetch from Firebase
2. **Returns cached data** when offline
3. **Syncs changes** when connection is restored
4. **Works transparently** - no code changes needed!

### Data Flow

```
Online:
  App → Firebase Realtime Database → Returns data + caches locally

Offline:
  App → Firebase Cache → Returns cached data immediately

Back Online:
  Firebase automatically syncs any changes
```

## 📱 Using Offline Features

### Offline Indicator

The `OfflineIndicator` component is already added to `HomeScreen`. It shows:
- "📡 Offline - Showing cached data" when offline
- Automatically hides when online

### Network Status Hook

You can use the `useOfflineStatus` hook in any component:

```typescript
import { useOfflineStatus } from '../hooks/useOfflineStatus';

const MyComponent = () => {
  const { isOnline, isConnected } = useOfflineStatus();
  
  return (
    <View>
      {!isOnline && <Text>You're offline</Text>}
    </View>
  );
};
```

### Force Sync

When coming back online, you can force a sync:

```typescript
import { syncPlacesFromFirebase } from '../services/firebaseOfflineService';

// Force sync from server
await syncPlacesFromFirebase();
```

## 🎯 What Works Offline

✅ **All Firebase queries** - Returns cached data
✅ **Place listings** - Shows cached places
✅ **Search** - Works on cached data
✅ **Filters** - All filters work offline
✅ **Map view** - Shows cached places on map
✅ **Place details** - Shows cached place information

## ⚠️ Limitations

- **New places** won't appear until online
- **Real-time updates** require connection
- **Google Places API searches** require connection (falls back to cached data)

## 🔍 Testing Offline Mode

1. **Enable Airplane Mode** on your device
2. **Open the app** - Should show cached data
3. **See offline indicator** at top of screen
4. **Browse places** - All cached data available
5. **Disable Airplane Mode** - Data syncs automatically

## 📊 Cache Management

Firebase automatically manages the cache:
- **Size**: Limited by device storage
- **Eviction**: Old data may be evicted if cache is full
- **Persistence**: Cache persists across app restarts
- **Sync**: Automatic when connection restored

## 🛠️ Configuration

Offline persistence is enabled by default in:
- `src/services/firebaseService.ts` - `database().setPersistenceEnabled(true)`

To disable (not recommended):
```typescript
database().setPersistenceEnabled(false);
```

## 💡 Best Practices

1. **First Load**: Always fetch data when online to populate cache
2. **Pull to Refresh**: Use to force sync when online
3. **Error Handling**: App gracefully falls back to cached data
4. **User Feedback**: Offline indicator informs users

## 🎉 Benefits

- ✅ **Works offline** - Users can browse places without internet
- ✅ **Fast loading** - Cached data loads instantly
- ✅ **Automatic sync** - No manual sync needed
- ✅ **Seamless experience** - Users don't notice offline/online transitions

