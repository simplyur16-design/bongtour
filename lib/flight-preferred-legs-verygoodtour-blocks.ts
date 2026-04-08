import type { PreferredFlightLegs } from '@/lib/flight-preferred-legs-types'
import { splitFlightSectionLinesForPreferredLegs } from '@/lib/flight-preferred-legs-lines'

/** 참좋은: 출국/입국 블록 + 날짜·시간·공항·출발/도착 줄 */
export function tryPreferredFlightLegsVerygoodtourBlockLines(lines: string[]): PreferredFlightLegs | null {
  const linesN = lines.map((l) => l.replace(/\\+\s*$/g, '').trim())
  const headerOut = /^■?\s*출국\s*:?\s*$|^출국\s*:?\s*$|^출국편|^【\s*출국\s*】/i
  const headerIn = /^■?\s*입국\s*:?\s*$|^입국\s*:?\s*$|^입국편|^【\s*입국\s*】/i
  const idxOut = linesN.findIndex((l) => headerOut.test(l.trim()))
  const idxIn = linesN.findIndex((l) => headerIn.test(l.trim()))
  const pickPair = (from: number, to: number) =>
    linesN.slice(from, to).filter((l) => /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(l) && /(출발|도착)/.test(l))

  if (idxOut >= 0 && idxIn > idxOut) {
    const outPair = pickPair(idxOut + 1, idxIn)
    const inPair = pickPair(idxIn + 1, linesN.length)
    if (outPair.length >= 2 && inPair.length >= 2) {
      return { outRaw: outPair.slice(0, 2).join(' | '), inRaw: inPair.slice(0, 2).join(' | ') }
    }
  }

  if (idxOut >= 0 && idxIn >= 0 && idxIn < idxOut) {
    const inPair = pickPair(idxIn + 1, idxOut)
    const outPair = pickPair(idxOut + 1, linesN.length)
    if (outPair.length >= 2 && inPair.length >= 2) {
      return { outRaw: outPair.slice(0, 2).join(' | '), inRaw: inPair.slice(0, 2).join(' | ') }
    }
  }

  const dt = linesN.filter((l) => /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(l) && /(출발|도착)/.test(l))
  if (dt.length >= 4) {
    return { outRaw: dt.slice(0, 2).join(' | '), inRaw: dt.slice(2, 4).join(' | ') }
  }
  return null
}

export function tryPreferredFlightLegsVerygoodtourFromSection(section: string): PreferredFlightLegs | null {
  const lines = splitFlightSectionLinesForPreferredLegs(section)
  if (lines.length < 2) return null
  return tryPreferredFlightLegsVerygoodtourBlockLines(lines)
}
