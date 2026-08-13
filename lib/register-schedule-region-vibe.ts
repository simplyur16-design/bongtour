/**
 * 일정설명(description) 지역 vibe — 전 공급사 generic_tourism 과다 완화.
 * 공급사 전용 프로필(몰디브 휴양·홍콩 도보 등) 다음에만 사용.
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: region vibe before generic — manifest
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]: 3문장+ 특성, 명소명 금지 — manifest
 */
import { composeRegisterScheduleExtendedRegionVibeDescription } from '@/lib/register-schedule-region-vibe-extended'

export {
  composeRegisterScheduleExtendedRegionVibeDescription,
  isRegisterScheduleGenericTourismDescription,
  pickScheduleVibeSentencesWithoutPlaceLeak,
} from '@/lib/register-schedule-region-vibe-extended'

export { composeRegisterScheduleCharacteristicDescription } from '@/lib/register-schedule-description-characteristic-ssot'

/**
 * 일정요약 SSOT — 3문장+ 특성(명소명 금지). 지역 프로필 + 일차 변주.
 */
export function composeRegisterScheduleRegionVibeDescription(opts: {
  day: number
  maxDay: number
  routePlaces: readonly string[]
  joinedBlob: string
}): string | null {
  const { day, maxDay, routePlaces, joinedBlob } = opts
  const blob = joinedBlob.trim() || routePlaces.filter(Boolean).join(' - ')
  if (!blob && !(day === 1 || (maxDay >= 2 && day === maxDay))) return null

  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: region vibe before generic — manifest
  return composeRegisterScheduleExtendedRegionVibeDescription(routePlaces, blob, day, maxDay)
}
