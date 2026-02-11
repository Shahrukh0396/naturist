# AdMob / Google Mobile Ads – app.json configuration

This document describes the `react-native-google-mobile-ads` section in **app.json** and how to extend it.

## What is in app.json

The block configures the **React Native Google Mobile Ads** library so that:

1. **App-level AdMob IDs** are set once and used by the native iOS/Android builds.
2. **SKAdNetwork IDs** are declared for iOS so conversion tracking and mediation work with Apple’s privacy framework (SKAdNetwork).

### Fields

| Field | Description |
|-------|-------------|
| **android_app_id** | Your AdMob Android app ID (from [AdMob](https://admob.google.com) → Apps → App settings). Format: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`. Use the test ID in development to avoid policy issues. |
| **ios_app_id** | Your AdMob iOS app ID (same place in AdMob). Same format. |
| **sk_ad_network_items** | List of **SKAdNetwork identifiers** for iOS. Each entry is a string like `xxxxx.skadnetwork`. These must be listed in your app’s **Info.plist** (the library can inject them from app.json) so that: (a) Google can attribute conversions, and (b) mediation partners (Meta, Unity, etc.) can participate in SKAdNetwork. If you omit networks you use in mediation, their postbacks may not work correctly. |

## Why so many SKAdNetwork IDs?

- **Google’s own** ID (`cstr6suwn9.skadnetwork`) is required for AdMob.
- **Mediation** uses many third-party networks (Meta, Unity, InMobi, Chartboost, etc.). Each has its own SKAdNetwork ID; Apple only allows attribution to networks that are declared in your app.
- Including **Google’s recommended list** (see [Google’s doc](https://developers.google.com/admob/ios/3p-skadnetworks)) ensures current and future mediation partners can work with SKAdNetwork. Missing IDs can mean lost attribution and lower fill.

## Adding more SKAdNetwork IDs

1. Get the official list: [Google and select third-party buyer SKAdNetwork identifiers](https://developers.google.com/admob/ios/3p-skadnetworks).
2. Add new entries to the **sk_ad_network_items** array in **app.json** (each value is a string, e.g. `"wg4vff78zm.skadnetwork"`).
3. Rebuild the iOS app so the updated list is written into Info.plist (e.g. run `pod install` and then build).

## Quick reference – networks and IDs (from Google’s list)

| Network | SKAdNetwork Identifier |
|---------|------------------------|
| Google | `cstr6suwn9.skadnetwork` |
| Aarki | `4fzdc2evr5.skadnetwork` |
| Adform | `2fnua5tdw4.skadnetwork` |
| Adikteev | `ydx93a7ass.skadnetwork` |
| Amazon | `p78axxw29g.skadnetwork` |
| Appier | `v72qych5uu.skadnetwork` |
| AppLovin | `ludvb6z3bs.skadnetwork` |
| Arpeely | `cp8zw746q7.skadnetwork` |
| Basis | `3sh42y64q3.skadnetwork` |
| Beeswax.io | `c6k4g5qg8m.skadnetwork` |
| Bidease | `s39g8k73mm.skadnetwork` |
| BidMachine | `wg4vff78zm.skadnetwork` |
| Bigabid Media | `3qy4746246.skadnetwork` |
| Chartboost | `f38h382jlk.skadnetwork` |
| Criteo | `hs6bdukanm.skadnetwork` |
| Digital Turbine DSP | `mlmmfzh3r3.skadnetwork` |
| i-mobile | `v4nxqhlyqp.skadnetwork` |
| InMobi | `wzmmz9fp6w.skadnetwork` |
| ironSource | `su67r6k2v3.skadnetwork` |
| Jampp | `yclnxrl5pm.skadnetwork` |
| LifeStreet Media | `t38b2kh725.skadnetwork` |
| Liftoff | `7ug5zh24hu.skadnetwork` |
| Liftoff Monetize | `gta9lk7p23.skadnetwork` |
| LINE Ads Network | `vutu7akeur.skadnetwork` |
| Mediaforce | `y5ghdn5j9k.skadnetwork` |
| Meta (1 of 2) | `v9wttpbfk9.skadnetwork` |
| Meta (2 of 2) | `n38lu8286q.skadnetwork` |
| MicroAd | `47vhws6wlr.skadnetwork` |
| Mintegral / Mobvista | `kbd757ywx3.skadnetwork` |
| Moloco | `9t245vhmpl.skadnetwork` |
| Opera | `a2p9lx4jpn.skadnetwork` |
| Pangle | `22mmun2rn5.skadnetwork` |
| Persona.ly | `44jx6755aq.skadnetwork` |
| PubMatic | `k674qkevps.skadnetwork` |
| Realtime Technologies | `4468km3ulz.skadnetwork` |
| Remerge | `2u9pt9hc89.skadnetwork` |
| RTB House | `8s468mfl3y.skadnetwork` |
| Sift Media | `klf5c3l5u5.skadnetwork` |
| Smadex | `ppxm28t8ap.skadnetwork` |
| StackAdapt | `kbmxgpxpgc.skadnetwork` |
| The Trade Desk | `uw77j35x4d.skadnetwork` |
| Unicorn | `578prtvx9j.skadnetwork` |
| Unity Ads | `4dzt52r2t5.skadnetwork` |
| Verve | `tl55sbb4fm.skadnetwork` |
| Viant | `c3frkrj4fj.skadnetwork` |
| Yahoo! | `e5fvkxwrpn.skadnetwork` |
| Yahoo! Japan Ads | `8c4e2ghe7u.skadnetwork` |
| YouAppi | `3rd42ekr43.skadnetwork` |
| Zemanta | `97r2b46745.skadnetwork` |
| Zucks | `3qcr597p9d.skadnetwork` |

*Source: [Google AdMob – 3p SKAdNetworks](https://developers.google.com/admob/ios/3p-skadnetworks).*

## Troubleshooting: `RNGoogleAdsModule` / `RNGoogleMobileAdsModule` could not be found

If you see:

```text
TurboModuleRegistry.getEnforcing(...) 'RNGoogleAdsModule' could not be found
```
or `'RNGoogleMobileAdsModule' could not be found`, the native ads module is not in the app binary. Fix it with a **clean native rebuild** (do not use Expo Go; use a dev build).

### iOS

1. From the project root:
   ```bash
   cd ios
   rm -rf Pods Podfile.lock build
   pod install
   cd ..
   ```
2. In Xcode: **Product → Clean Build Folder** (⇧⌘K), then build and run (⌘R).
3. Run the app with `yarn ios` or from Xcode.

### Android

1. From the project root:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```
2. Run the app with `yarn android` (or build from Android Studio).

### After adding or updating the library

Whenever you add or upgrade `react-native-google-mobile-ads`, run the steps above for the platform(s) you use. The module is native; a JS-only refresh is not enough.

## Test vs production IDs

- In **app.json** you can point `android_app_id` / `ios_app_id` to test IDs during development (e.g. `ca-app-pub-3940256099942544~3347511713` for Android).
- For **production**, replace with your real AdMob app IDs from the AdMob console. Your **ad unit IDs** (banner, interstitial, etc.) are configured in code (e.g. `src/services/adsService.ts`), not in app.json.
