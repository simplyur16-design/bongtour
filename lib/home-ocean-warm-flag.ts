/**
 * Ocean Warm 홈 셸 플래그 (P4 홈 한정).
 * - HOME_OCEAN_WARM=1 → ON
 * - HOME_OCEAN_WARM=0 → OFF
 * - 미설정: ON (실홈 기본 적용; 끄려면 명시적 0)
 */

export function isHomeOceanWarmEnabled(): boolean {
  const raw = (process.env.HOME_OCEAN_WARM ?? '').trim().toLowerCase()
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  return true
}
