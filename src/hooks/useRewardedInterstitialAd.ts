/**
 * Loads a rewarded interstitial (video) ad and exposes show().
 * Use for opt-in rewards only (e.g. "Watch ad to unlock offline map").
 * onReward is called when the user completes the ad and earns the reward.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { AdUnitIds, getAdsModule } from '../services/adsService';

type RewardedInterstitialAd = {
  load: () => void;
  show: () => Promise<void>;
  addAdEventListener: (event: string, handler: (...args: unknown[]) => void) => () => void;
};

export type UseRewardedInterstitialAdOptions = {
  /** Called when user completes the ad and earns the reward – grant the reward here. */
  onReward?: () => void;
};

export function useRewardedInterstitialAd(options: UseRewardedInterstitialAdOptions = {}) {
  const { onReward } = options;
  const onRewardRef = useRef(onReward);
  onRewardRef.current = onReward;

  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef<RewardedInterstitialAd | null>(null);
  const isShowingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unsubLoaded: (() => void) | undefined;
    let unsubClosed: (() => void) | undefined;
    let unsubEarned: (() => void) | undefined;

    const setup = async () => {
      try {
        const mod = await getAdsModule();
        const { RewardedInterstitialAd, RewardedAdEventType, AdEventType } = mod;
        const ad = RewardedInterstitialAd.createForAdRequest(AdUnitIds.rewardedInterstitial);

        const reload = () => {
          if (!cancelled) ad.load();
        };

        unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          if (!cancelled) {
            adRef.current = ad;
            setIsLoaded(true);
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

        unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          if (!cancelled && onRewardRef.current) {
            onRewardRef.current();
            if (__DEV__) console.log('[useRewardedInterstitialAd] Reward earned');
          }
        });

        ad.load();
      } catch (e) {
        if (__DEV__) {
          console.warn('[useRewardedInterstitialAd]', e);
        }
      }
    };

    setup();
    return () => {
      cancelled = true;
      unsubLoaded?.();
      unsubClosed?.();
      unsubEarned?.();
    };
  }, []);

  const show = useCallback((): Promise<void> => {
    if (isShowingRef.current) return Promise.resolve();
    const ad = adRef.current;
    if (!ad) return Promise.resolve();
    isShowingRef.current = true;
    const result = ad.show();
    return Promise.resolve(result).catch(() => {
      isShowingRef.current = false;
    });
  }, []);

  return { show, isLoaded };
}
