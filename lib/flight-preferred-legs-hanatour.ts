import type { PreferredFlightLegs } from '@/lib/flight-preferred-legs-types'
import { splitFlightSectionLinesForPreferredLegs } from '@/lib/flight-preferred-legs-lines'

/**
 * 한 줄에 `출발 : …` 와 `도착 : …` 가 같이 붙은 경우(줄바꿈 유실 등) 선호 레그가 동일 줄로 잡혀 null이 되는 것을 막는다.
 */
function expandHanatourDualDepartureArrivalLines(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    if (/출발\s*[:：]/i.test(line) && /도착\s*[:：]/i.test(line)) {
      const parts = line.split(/(?=\s*도착\s*[:：])/i)
      if (parts.length >= 2) {
        const head = parts[0]!.replace(/\s+/g, ' ').trim()
        const tail = parts.slice(1).join('').replace(/\s+/g, ' ').trim()
        if (head && tail && /출발\s*[:：]/i.test(head) && /도착\s*[:：]/i.test(tail)) {
          out.push(head, tail)
          continue
        }
      }
    }
    out.push(line)
  }
  return out
}

/**
 * `OZ0581총 13시간…` — 편명 뒤 `총`이 곧바로 소요시간 `총 N시간…`의 앞글자일 때가 많다.
 * `총`을 지우면 소요 문구가 깨지므로 `OZ0581 총 13시간…`으로만 띄운다.
 */
export function stripHanatourFlightDurationTail(s: string): string {
  return s.replace(/([A-Z]{1,3}\d{2,5})총/iu, '$1 총 ').replace(/\s+/g, ' ').trim()
}

/**
 * 하나투어 정형: `출발 : … OZ…` / `도착 : … OZ…`
 * 소요시간 문구 유무와 무관하게 출발·도착 줄만 잡는다.
 */
export function tryPreferredFlightLegsHanatourLines(lines: string[]): PreferredFlightLegs | null {
  const going = lines.find((l) => /가는\s*편\s*[:：]/i.test(l))
  const back = lines.find((l) => /오는\s*편\s*[:：]/i.test(l))
  if (going && back && going.trim() !== back.trim()) {
    return {
      outRaw: stripHanatourFlightDurationTail(going),
      inRaw: stripHanatourFlightDurationTail(back),
    }
  }
  const outLine = lines.find((l) => /출발\s*[:：]/i.test(l))
  const inLine = lines.find((l) => /도착\s*[:：]/i.test(l))
  if (!outLine || !inLine) return null
  if (outLine.trim() === inLine.trim()) return null
  return {
    outRaw: stripHanatourFlightDurationTail(outLine),
    inRaw: stripHanatourFlightDurationTail(inLine),
  }
}

export function tryPreferredFlightLegsHanatourFromSection(section: string): PreferredFlightLegs | null {
  const lines = expandHanatourDualDepartureArrivalLines(splitFlightSectionLinesForPreferredLegs(section))
  if (lines.length < 2) return null
  return tryPreferredFlightLegsHanatourLines(lines)
}
