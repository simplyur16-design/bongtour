import type { PreferredFlightLegs } from '@/lib/flight-preferred-legs-types'
import { tryPreferredFlightLegsModetourLines } from '@/lib/flight-preferred-legs-modetour'
import {
  tryParseYbtourFlightBlocks,
  ybtourSynthesizePreferredRaw,
} from '@/lib/flight-ybtour-blocks'

/** 노랑풍선: 4~6줄 윈도우 중 편명·시간·공항 코드가 함께 있는 블록을 두 번(가/편) */
function tryYbtourWindowBlocks(lines: string[]): PreferredFlightLegs | null {
  const blocks: string[] = []
  for (let i = 0; i < lines.length; i++) {
    for (const w of [4, 5, 6]) {
      const slice = lines.slice(i, i + w)
      if (slice.length < w) continue
      const block = slice.join(' | ')
      if (
        /[A-Z]{1,3}\d{2,5}/.test(block) &&
        /[0-2]?\d:[0-5]\d/.test(block) &&
        (/\b([A-Z]{3})\b/.test(block) || /(출발|도착|공항)/.test(block))
      ) {
        blocks.push(block)
      }
    }
  }
  if (blocks.length >= 2) {
    const a = blocks[0]!
    const b = blocks.find((x) => x !== a) ?? blocks[1]!
    if (a !== b) return { outRaw: a, inRaw: b }
  }
  return null
}

export function tryPreferredFlightLegsYbtourFromSection(section: string): PreferredFlightLegs | null {
  const b = tryParseYbtourFlightBlocks(section)
  if (b?.outbound && b?.inbound) {
    return {
      outRaw: ybtourSynthesizePreferredRaw(b.outbound, '가는편'),
      inRaw: ybtourSynthesizePreferredRaw(b.inbound, '오는편'),
    }
  }
  return null
}

export function tryPreferredFlightLegsYbtourLines(lines: string[]): PreferredFlightLegs | null {
  const fromBlocks = tryPreferredFlightLegsYbtourFromSection(lines.join('\n'))
  if (fromBlocks) return fromBlocks
  return tryYbtourWindowBlocks(lines) ?? tryPreferredFlightLegsModetourLines(lines)
}
