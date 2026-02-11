/**
 * Inline banner ad – use in ScrollView/FlatList or anchored at top/bottom.
 * Uses adaptive banner for best fill. On iOS, reload when app returns to foreground.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { AdUnitIds, getAdsModule } from '../services/adsService';

const PLACEHOLDER_HEIGHT = 50;

type AdBannerProps = {
  /** Optional style for the wrapper (e.g. margin for list spacing) */
  style?: object;
  /** Use inline size when inside scrolling content; otherwise anchored. */
  inline?: boolean;
  /** Use medium rectangle (300x250) for place detail; uses placeDetailBanner unit ID. */
  /** Use compact for small 320x50 banner (e.g. between sections on home). */
  variant?: 'banner' | 'mediumRectangle' | 'compact';
  /** When true, render nothing (no placeholder) when ad module is unavailable. Use in modals to avoid empty space on Android. */
  collapseWhenUnavailable?: boolean;
};

export const AdBanner: React.FC<AdBannerProps> = ({ style, inline = false, variant = 'banner', collapseWhenUnavailable = false }) => {
  const bannerRef = useRef<{ load?: () => void } | null>(null);
  const [AdModule, setAdModule] = React.useState<{
    BannerAd: React.ComponentType<{
      ref?: React.Ref<{ load?: () => void }>;
      unitId: string;
      size: string;
      requestOptions?: object;
    }>;
    BannerAdSize: {
      ANCHORED_ADAPTIVE_BANNER: string;
      INLINE_ADAPTIVE_BANNER: string;
      MEDIUM_RECTANGLE?: string;
      BANNER?: string;
    };
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await getAdsModule();
        if (mounted) {
          setAdModule({
            BannerAd: mod.BannerAd,
            BannerAdSize: mod.BannerAdSize,
          });
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('[AdBanner] react-native-google-mobile-ads not available:', e);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // iOS: reload banner when app comes to foreground (avoids empty banner after suspend)
  useEffect(() => {
    if (Platform.OS !== 'ios' || !AdModule) return;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        bannerRef.current?.load?.();
      }
    });
    return () => sub.remove();
  }, [AdModule]);

  const isCompact = variant === 'compact';
  const isMediumRect = variant === 'mediumRectangle';
  if (!AdModule?.BannerAd) {
    if (collapseWhenUnavailable) return null;
    const placeholderHeight = isMediumRect ? 250 : isCompact ? 50 : PLACEHOLDER_HEIGHT;
    return <View style={[styles.placeholder, style, { height: placeholderHeight }]} />;
  }

  const { BannerAd, BannerAdSize } = AdModule;
  const sizes = BannerAdSize ?? {};
  const size =
    isMediumRect && sizes.MEDIUM_RECTANGLE
      ? (sizes.MEDIUM_RECTANGLE ?? 'MEDIUM_RECTANGLE')
      : isCompact && sizes.BANNER
        ? (sizes.BANNER ?? 'BANNER')
        : inline
          ? (sizes.INLINE_ADAPTIVE_BANNER ?? 'INLINE_ADAPTIVE_BANNER')
          : (sizes.ANCHORED_ADAPTIVE_BANNER ?? 'ANCHORED_ADAPTIVE_BANNER');
  const unitId = isMediumRect ? AdUnitIds.placeDetailBanner : AdUnitIds.banner;

  return (
    <View style={[styles.wrapper, style]}>
      <BannerAd
        ref={bannerRef as React.Ref<{ load?: () => void }>}
        unitId={unitId}
        size={size}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  placeholder: {
    backgroundColor: 'transparent',
  },
});

export default AdBanner;
