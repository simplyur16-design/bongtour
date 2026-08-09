/**
 * EAS Update check — no-op in Expo Go / when updates disabled.
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: OTA check — manifest
 */
import * as Updates from 'expo-updates';

export async function checkSimplyurOtaUpdate(): Promise<void> {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;
  if (!Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // Network / channel misconfig — keep current bundle.
  }
}
