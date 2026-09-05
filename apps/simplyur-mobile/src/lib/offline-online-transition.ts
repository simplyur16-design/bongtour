/**
 * Offline banner may probe on every focus/AppState tick.
 * Only the offline → online edge should refetch catalogs/orders.
 * REGRESSION-FREEZE[simplyur-mobile-offline-reload-once]: no onOnline while already online — manifest
 */
export function shouldFireOnOnline(wasOffline: boolean, nowOnline: boolean): boolean {
  return wasOffline && nowOnline
}
