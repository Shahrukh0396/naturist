/**
 * Ads service – Google Mobile Ads (AdMob)
 *
 * AdMob has 6 ad unit TYPES: Banner, Interstitial, Rewarded Interstitial, Rewarded, App Open, Native Advanced.
 * We use 3 types: Banner (2 placements), Interstitial (1), Rewarded Interstitial (1).
 *
 * Setup:
 * 1. app.json: android_app_id / ios_app_id (Apps → App settings).
 * 2. Below: PRODUCTION_IDS – create these in AdMob (Ads → By ad unit) and paste IDs.
 * 3. Run: yarn install && cd ios && pod install
 *
 * Native bridge: App.tsx defers ad init (requestIdleCallback) then calls setAdsReady() after initialize(). Components must use whenAdsReady or getAdsModule() before loading the native package
 * to avoid "NativeEventEmitter requires non-null argument" on iOS.
 */

import { Platform } from 'react-native';
import { canShowInterstitial } from './adSessionManager';

let _adsReady = false;
let _adsInitFailed = false;
let resolveAdsReady: () => void;
export const whenAdsReady: Promise<void> = new Promise((r) => {
  resolveAdsReady = r;
});
/** Call once App has loaded the ads module (so first load is after bridge ready). Resolves whenAdsReady so getAdsModule() can proceed. */
export function resolveWhenAdsModuleLoaded(): void {
  resolveAdsReady?.();
}
/** Call when native ads module init fails (e.g. RNGoogleMobileAdsModule not found). Prevents getAdsModule() from ever importing the package, avoiding crashes. */
export function setAdsInitFailed(): void {
  _adsInitFailed = true;
  resolveAdsReady?.();
}
/** Call after mobileAds().initialize() succeeds. Sets isAdMobAvailable() to true. */
export function setAdsReady(): void {
  _adsReady = true;
  resolveAdsReady?.();
}

/** Use this before any import('react-native-google-mobile-ads') so the first load happens in App after bridge is ready. */
export function getAdsModule(): Promise<typeof import('react-native-google-mobile-ads')> {
  return whenAdsReady.then(() => {
    if (_adsInitFailed) {
      return Promise.reject(new Error('AdMob native module not available (RNGoogleMobileAdsModule not found)'));
    }
    return import('react-native-google-mobile-ads');
  });
}

// Test Ad Unit IDs (development only – avoid policy violations)
const TEST_IDS = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/5354046379',
  SEARCH_INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  PLACE_DETAIL_BANNER: 'ca-app-pub-3940256099942544/6300978111', // Banner, size 300x250
  POST_SAVE_INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
};

/**
 * Production IDs – create in AdMob with the correct TYPE for each:
 * - BANNER / ADAPTIVE_BANNER / PLACE_DETAIL_BANNER → Ad unit type: Banner
 * - INTERSTITIAL / POST_SAVE_INTERSTITIAL / SEARCH_INTERSTITIAL → Ad unit type: Interstitial
 * - REWARDED_INTERSTITIAL → Ad unit type: Rewarded interstitial
 */
const PRODUCTION_IDS = {
  BANNER: Platform.OS === 'ios' ? 'ca-app-pub-9736404383949740/1097196182' : 'ca-app-pub-9736404383949740/2667290543',
  ADAPTIVE_BANNER: Platform.OS === 'ios' ? 'ca-app-pub-9736404383949740/3137762513' : 'ca-app-pub-9736404383949740/6581748730',
  INTERSTITIAL: Platform.OS === 'ios' ? 'ca-app-pub-9736404383949740/3364266879' : 'ca-app-pub-9736404383949740/9176122484',
  REWARDED: Platform.OS === 'ios' ? 'ca-app-pub-9736404383949740/1441537469' : 'ca-app-pub-9736404383949740/2986128390',
  REWARDED_INTERSTITIAL: Platform.OS === 'ios' ? 'ca-app-pub-9736404383949740/1121246916' : 'ca-app-pub-9736404383949740/1329422058',
  SEARCH_INTERSTITIAL: Platform.OS === 'ios' ? 'ca-app-pub-9736404383949740/3364266879' : 'ca-app-pub-9736404383949740/9176122484', // Interstitial (same type as INTERSTITIAL)
  PLACE_DETAIL_BANNER: Platform.OS === 'ios' ? 'ca-app-pub-9736404383949740/1049084981' : 'ca-app-pub-9736404383949740/7863040817', // Banner, show as 300x250
  POST_SAVE_INTERSTITIAL: Platform.OS === 'ios' ? 'ca-app-pub-9736404383949740/3364266879' : 'ca-app-pub-9736404383949740/9176122484', // Interstitial (not Rewarded!)
};

/** Pick ID for current platform; production IDs are shared so same value for both. */
function id(test: string, prod: string): string {
  return isDev ? test : prod;
}

const isDev = __DEV__;

/** Ad unit IDs – same ID works on both Android and iOS. */
export const AdUnitIds = {
  banner: id(TEST_IDS.ADAPTIVE_BANNER, PRODUCTION_IDS.ADAPTIVE_BANNER),
  mediumRectangle: id(TEST_IDS.PLACE_DETAIL_BANNER, PRODUCTION_IDS.PLACE_DETAIL_BANNER), // same as placeDetailBanner (Banner type, 300x250)
  interstitial: id(TEST_IDS.INTERSTITIAL, PRODUCTION_IDS.INTERSTITIAL),
  rewarded: id(TEST_IDS.REWARDED, PRODUCTION_IDS.REWARDED),
  rewardedInterstitial: id(TEST_IDS.REWARDED_INTERSTITIAL, PRODUCTION_IDS.REWARDED_INTERSTITIAL),
  searchInterstitial: id(TEST_IDS.SEARCH_INTERSTITIAL, PRODUCTION_IDS.SEARCH_INTERSTITIAL),
  placeDetailBanner: id(TEST_IDS.PLACE_DETAIL_BANNER, PRODUCTION_IDS.PLACE_DETAIL_BANNER),
  postSaveInterstitial: id(TEST_IDS.POST_SAVE_INTERSTITIAL, PRODUCTION_IDS.POST_SAVE_INTERSTITIAL),
};

/**
 * Use before showing any interstitial. Checks session manager (max 3 per session, 3-min gap).
 */
export function canShowInterstitialAd(): boolean {
  return canShowInterstitial();
}

export const isAdMobAvailable = (): boolean => _adsReady && !_adsInitFailed;

export { AdUnitIds as default };
