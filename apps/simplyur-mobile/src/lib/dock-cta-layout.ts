/**
 * Shared purchase chrome metrics — product and checkout must place the CTA at the same Y.
 * REGRESSION-FREEZE[simplyur-purchase-dock-cta]: same dock height + pad — manifest
 */
export const SIMPLYUR_DOCK_CTA_HEIGHT = 56
export const SIMPLYUR_DOCK_HINT_SLOT = 18
export const SIMPLYUR_DOCK_PAD_H = 22
export const SIMPLYUR_SCREEN_TOP_EXTRA = 16

export function simplyurDockScrollPad(bottomInset: number): number {
  return Math.max(bottomInset, 10) + SIMPLYUR_DOCK_CTA_HEIGHT + SIMPLYUR_DOCK_HINT_SLOT + 24
}

export function simplyurScreenPadTop(topInset: number): number {
  return topInset + SIMPLYUR_SCREEN_TOP_EXTRA
}
