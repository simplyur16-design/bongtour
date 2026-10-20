/**
 * 동선 번호 핀 색상 SSOT (지도·범례 동일).
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: bongtourRouteMapPinColor — manifest
 */

const PIN_COLORS = [
  '#0b6bcb', // 1 blue
  '#0d9488', // 2 teal
  '#c2410c', // 3 orange
  '#7c3aed', // 4 purple
  '#be185d', // 5 pink
  '#15803d', // 6 green
  '#b45309', // 7 amber
  '#0369a1', // 8 sky
  '#a21caf', // 9 fuchsia
  '#4f46e5', // 10 indigo
] as const

export function bongtourRouteMapPinColor(order: number): string {
  const i = Math.max(0, Math.floor(order) - 1)
  return PIN_COLORS[i % PIN_COLORS.length]!
}
