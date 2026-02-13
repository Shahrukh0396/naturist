/**
 * Ad Session Manager – singleton to enforce interstitial caps and timing.
 * - Max 3 interstitials per session
 * - Minimum 3-minute gap between interstitials
 * - resetSession() for app background/foreground (call when resuming after long absence)
 */

const MAX_INTERSTITIALS_PER_SESSION = 3;
const MIN_GAP_MS = 3 * 60 * 1000; // 3 minutes
const SESSION_RESET_AFTER_MS = 30 * 60 * 1000; // 30 minutes (used by App.tsx)

let interstitialCount = 0;
let lastInterstitialShownAt: number = 0;

export function getInterstitialCount(): number {
  return interstitialCount;
}

export function getLastInterstitialShownAt(): number {
  return lastInterstitialShownAt;
}

/** Returns true if we can show another interstitial (under cap and past min gap). */
export function canShowInterstitial(): boolean {
  if (interstitialCount >= MAX_INTERSTITIALS_PER_SESSION) {
    if (__DEV__) {
      console.log('[AdSessionManager] Blocked: max interstitials reached', interstitialCount);
    }
    return false;
  }
  const now = Date.now();
  if (now - lastInterstitialShownAt < MIN_GAP_MS) {
    if (__DEV__) {
      console.log(
        '[AdSessionManager] Blocked: min gap not met',
        Math.ceil((MIN_GAP_MS - (now - lastInterstitialShownAt)) / 1000),
        's remaining'
      );
    }
    return false;
  }
  return true;
}

/** Call after successfully showing an interstitial. */
export function recordInterstitialShown(): void {
  interstitialCount += 1;
  lastInterstitialShownAt = Date.now();
  if (__DEV__) {
    console.log('[AdSessionManager] Interstitial shown', interstitialCount, '/', MAX_INTERSTITIALS_PER_SESSION);
  }
}

/** Reset session (e.g. app came to foreground after long background). */
export function resetSession(): void {
  interstitialCount = 0;
  lastInterstitialShownAt = 0;
  if (__DEV__) {
    console.log('[AdSessionManager] Session reset');
  }
}

/** When app returns to foreground, if last background was > this long ago, reset session. */
export const SESSION_RESET_AFTER_MS_EXPORT = SESSION_RESET_AFTER_MS;
