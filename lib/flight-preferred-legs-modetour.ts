import type { PreferredFlightLegs } from '@/lib/flight-preferred-legs-types'
import { splitFlightSectionLinesForPreferredLegs } from '@/lib/flight-preferred-legs-lines'

export function tryPreferredFlightLegsModetourLines(lines: string[]): PreferredFlightLegs | null {
  const out = lines.find((l) => /출발\s*[:：]/.test(l) && (/→|->/.test(l) || /[A-Z]{1,3}\d{2,5}/.test(l)))
  const inn = lines.find((l) => /도착\s*[:：]/.test(l) && (/→|->/.test(l) || /[A-Z]{1,3}\d{2,5}/.test(l)))
  if (out && inn && out !== inn) return { outRaw: out, inRaw: inn }
  return null
}

export function tryPreferredFlightLegsModetourFromSection(section: string): PreferredFlightLegs | null {
  const lines = splitFlightSectionLinesForPreferredLegs(section)
  if (lines.length < 2) return null
  return tryPreferredFlightLegsModetourLines(lines)
}
