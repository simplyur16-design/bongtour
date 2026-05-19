/**
 * [항공 보조 — modetour 스택 **밖**] 한국어 `출발 :` / `도착 :` 한 줄 패턴 (ybtour 등 공유).
 *
 * 역할: 붙여넣기 본문에서 preferred raw leg 2줄만 빠르게 잡을 때(전체 structured 파서 이전·보조).
 * modetour 본문 SSOT는 `flight-modetour-parser.ts` → `flight-parser-modetour.ts` 체인. 이 파일로 대체하지 말 것.
 * 공급사 전용이 아니므로 `*-modetour` 파일명·modetour 계약(`modetour-parse-contract`)에 올리지 않음.
 */
import type { PreferredFlightLegs } from '@/lib/flight-preferred-legs-types'
import { splitFlightSectionLinesForPreferredLegs } from '@/lib/flight-preferred-legs-lines'

export function tryPreferredFlightLegsKrOutInLines(lines: string[]): PreferredFlightLegs | null {
  const out = lines.find((l) => /출발\s*[:：]/.test(l) && (/→|->/.test(l) || /[A-Z]{1,3}\d{2,5}/.test(l)))
  const inn = lines.find((l) => /도착\s*[:：]/.test(l) && (/→|->/.test(l) || /[A-Z]{1,3}\d{2,5}/.test(l)))
  if (out && inn && out !== inn) return { outRaw: out, inRaw: inn }
  return null
}

export function tryPreferredFlightLegsKrOutInFromSection(section: string): PreferredFlightLegs | null {
  const lines = splitFlightSectionLinesForPreferredLegs(section)
  if (lines.length < 2) return null
  return tryPreferredFlightLegsKrOutInLines(lines)
}

/** @deprecated `tryPreferredFlightLegsKrOutInLines` — ybtour 등 기존 import 호환 */
export const tryPreferredFlightLegsModetourLines = tryPreferredFlightLegsKrOutInLines

/** @deprecated `tryPreferredFlightLegsKrOutInFromSection` */
export const tryPreferredFlightLegsModetourFromSection = tryPreferredFlightLegsKrOutInFromSection
