import type { PreferredFlightLegs } from '@/lib/flight-preferred-legs-types'
import { splitFlightSectionLinesForPreferredLegs } from '@/lib/flight-preferred-legs-lines'
import { tryPreferredFlightLegsHanatourLines } from '@/lib/flight-preferred-legs-hanatour'
import { tryPreferredFlightLegsYbtourLines } from '@/lib/flight-preferred-legs-ybtour'

/** 전용 detail-body 파이프라인이 없는 브랜드(하나·노랑 등)만 — 키는 canonical */
const PREFERRED_LEGS_BY_CANONICAL: Partial<Record<string, (lines: string[]) => PreferredFlightLegs | null>> = {
  hanatour: tryPreferredFlightLegsHanatourLines,
  ybtour: tryPreferredFlightLegsYbtourLines,
  yellowballoon: tryPreferredFlightLegsYbtourLines,
}

export function tryPreferredFlightLegsLegacyOtherBrand(
  section: string,
  brandCanonical: string | null
): PreferredFlightLegs | null {
  if (!brandCanonical) return null
  const fn = PREFERRED_LEGS_BY_CANONICAL[brandCanonical]
  if (!fn) return null
  const lines = splitFlightSectionLinesForPreferredLegs(section)
  if (lines.length < 2) return null
  return fn(lines)
}
