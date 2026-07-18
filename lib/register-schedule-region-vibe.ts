/**
 * 일정설명(description) 지역 vibe — 전 공급사 generic_tourism 과다 완화.
 * 공급사 전용 프로필(몰디브 휴양·홍콩 도보 등) 다음에만 사용.
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: region vibe before generic — manifest
 */
import { composeLottetourScheduleVibeSentences } from '@/lib/lottetour-register-api-schedule'
import {
  composeRegisterScheduleExtendedRegionVibeDescription,
  isRegisterScheduleGenericTourismDescription,
} from '@/lib/register-schedule-region-vibe-extended'

export {
  composeRegisterScheduleExtendedRegionVibeDescription,
  isRegisterScheduleGenericTourismDescription,
  pickScheduleVibeSentencesWithoutPlaceLeak,
} from '@/lib/register-schedule-region-vibe-extended'

/**
 * 공급사 전용 vibe가 generic일 때 — 유럽 등(lottetour 표) → 확장 지역 → null(호출측 generic).
 */
export function composeRegisterScheduleRegionVibeDescription(opts: {
  day: number
  maxDay: number
  routePlaces: readonly string[]
  joinedBlob: string
}): string | null {
  const { day, maxDay, routePlaces, joinedBlob } = opts
  const blob = joinedBlob.trim()
  if (!blob) return null

  // 확장 지역 프로필을 먼저 — day1 arrival 락·generic_tourism 모두 완화
  const extendedFirst = composeRegisterScheduleExtendedRegionVibeDescription(routePlaces, blob)
  if (extendedFirst) return extendedFirst

  // lottetour 표는 day===1 arrival·day===maxDay return 고정.
  // 공급사가 이미 generic_tourism으로 넘긴 날에는 지역 프로필만 쓰도록 마지막일 락을 푼다.
  if (day > 1) {
    const unlockMax = Math.max(maxDay, day + 1)
    const lotte = composeLottetourScheduleVibeSentences(day, unlockMax, routePlaces, blob)
    if (lotte && !isRegisterScheduleGenericTourismDescription(lotte)) {
      return lotte
    }
  }

  return null
}
