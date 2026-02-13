/**
 * Post-action interstitial: preloads an interstitial and exposes showPostActionAd().
 * Use after user actions (e.g. save/favorite place) – respects session cap and 3-min gap.
 * Only call when you have a real user action; do not use on loading or error screens.
 *
 * TODO: When you add save/favorite place, call showPostActionAd() after the save
 * completes successfully (e.g. in the same handler that updates UI). Example:
 *   const { showPostActionAd } = usePostActionInterstitial('postSaveInterstitial');
 *   const handleSavePlace = async () => {
 *     await savePlace(placeId);
 *     await showPostActionAd(); // only shows if session allows (max 3, 3-min gap)
 *   }
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { canShowInterstitialAd, getAdsModule } from '../services/adsService';
import { recordInterstitialShown } from '../services/adSessionManager';

const POST_ACTION_DELAY_MS = 800;

type InterstitialAd = {
  load: () => void;
  show: () => Promise<void>;
  addAdEventListener: (event: string, handler: () => void) => () => void;
};

export function usePostActionInterstitial(adUnitIdKey: 'postSaveInterstitial' | 'searchInterstitial' = 'postSaveInterstitial') {
  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef<InterstitialAd | null>(null);
  const isShowingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unsubLoaded: (() => void) | undefined;
    let unsubClosed: (() => void) | undefined;

    const setup = async () => {
      try {
        const mod = await getAdsModule();
        const { InterstitialAd, AdEventType } = mod;
        const { AdUnitIds } = await import('../services/adsService');
        const unitId = adUnitIdKey === 'postSaveInterstitial' ? AdUnitIds.postSaveInterstitial : AdUnitIds.searchInterstitial;
        const ad = InterstitialAd.createForAdRequest(unitId);

        const reload = () => {
          if (!cancelled) ad.load();
        };

        unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
          if (!cancelled) {
            adRef.current = ad;
            setIsLoaded(true);
            if (__DEV__) console.log('[usePostActionInterstitial] Ad loaded');
          }
        });

        unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
          if (!cancelled) {
            isShowingRef.current = false;
            setIsLoaded(false);
            adRef.current = null;
            reload();
          }
        });

        ad.load();
      } catch (e) {
        if (__DEV__) console.warn('[usePostActionInterstitial]', e);
      }
    };

    setup();
    return () => {
      cancelled = true;
      unsubLoaded?.();
      unsubClosed?.();
    };
  }, [adUnitIdKey]);

  const showPostActionAd = useCallback(async (): Promise<void> => {
    if (isShowingRef.current) return;
    if (!canShowInterstitialAd()) {
      if (__DEV__) console.log('[usePostActionInterstitial] Blocked by session manager');
      return;
    }
    const ad = adRef.current;
    if (!ad) {
      if (__DEV__) console.log('[usePostActionInterstitial] Ad not loaded yet');
      return;
    }
    isShowingRef.current = true;
    try {
      await new Promise((r) => setTimeout(r, POST_ACTION_DELAY_MS));
      await ad.show();
      recordInterstitialShown();
    } catch (e) {
      if (__DEV__) console.warn('[usePostActionInterstitial] Show failed', e);
    } finally {
      isShowingRef.current = false;
    }
  }, []);

  return { showPostActionAd, isLoaded };
}
