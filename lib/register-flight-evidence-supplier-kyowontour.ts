/** [kyowontour] register-flight-evidence-supplier */
/**
 * 등록 미리보기 correctionPreview — 항공 계열 evidence만.
 * 공급사 분기는 관리자 선택 brandKey만 사용(본문 항공사명으로 추정 금지).
 */
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'

const NOISE =
  /가격\s*예정|일정\s*예정|출발\s*예정|Image\b|이미지\s*[:：]|더보기|크게보기|유류할증료|입장료|차량|티오피|TOUR\s*POINT/i

const FN_RE = /\b[A-Z]{1,3}\d{2,5}\b/i

export type RegisterFlightEvidenceKind =
  | 'flight_info'
  | 'outbound_departure'
  | 'inbound_arrival'
  | 'flight_no'
  | 'outbound_flight_no'
  | 'inbound_flight_no'
  | 'carrier'
  | 'inbound_leg_places'

function cleanLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((l) => !NOISE.test(l))
}

function pickPasted(
  preview: Record<string, string | undefined | null> | null | undefined,
  key: string
): string | null {
  const v = preview?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** 1·2순위: flightRaw, airlineTransport 붙여넣기 — normalizedRaw 금지 */
function flightSourceTexts(
  parsed: RegisterParsed,
  preview: Record<string, string | undefined | null> | null | undefined
): string[] {
  const a = parsed.detailBodyStructured?.raw?.flightRaw
  const b = pickPasted(preview, 'airlineTransport')
  return [a, b].filter((s): s is string => Boolean(s?.trim()))
}

function trySources(
  parsed: RegisterParsed,
  preview: Record<string, string | undefined | null> | null | undefined,
  pick: (lines: string[]) => string | null
): string | null {
  for (const t of flightSourceTexts(parsed, preview)) {
    const hit = pick(cleanLines(t))
    if (hit?.trim()) return hit.trim()
  }
  return null
}

function modetourTrace(parsed: RegisterParsed) {
  return parsed.detailBodyStructured?.flightStructured?.debug?.modetourParseTrace ?? null
}

function modetourSnippet(
  kind: RegisterFlightEvidenceKind,
  parsed: RegisterParsed,
  preview: Record<string, string | undefined | null> | null | undefined
): string | null {
  const trace = modetourTrace(parsed)
  const outT = trace?.outboundLineRaw?.trim() || null
  const inT = trace?.inboundLineRaw?.trim() || null

  const airlineFrom = (): string | null => {
    for (const t of flightSourceTexts(parsed, preview)) {
      const a = cleanLines(t).find((l) => /^항공사\s*[:：]/i.test(l))
      if (a) return a
    }
    return null
  }

  const outFromText = () => trySources(parsed, preview, (lines) => lines.find((l) => /출발\s*[:：]/.test(l)) ?? null)
  const inFromText = () => trySources(parsed, preview, (lines) => lines.find((l) => /도착\s*[:：]/.test(l)) ?? null)

  const outL = outT ?? outFromText()
  const inL = inT ?? inFromText()
  const air = airlineFrom()

  switch (kind) {
    case 'flight_info': {
      if (!outL || !inL) return null
      const parts = [air, outL, inL].filter(Boolean) as string[]
      return parts.length >= 2 ? parts.join('\n') : null
    }
    case 'outbound_departure':
    case 'outbound_flight_no':
      return outL && (kind === 'outbound_flight_no' ? (FN_RE.test(outL) ? outL : null) : outL)
    case 'inbound_arrival':
    case 'inbound_leg_places':
    case 'inbound_flight_no':
      return inL && (kind === 'inbound_flight_no' ? (FN_RE.test(inL) ? inL : null) : inL)
    case 'flight_no': {
      const parts: string[] = []
      if (outL && FN_RE.test(outL)) parts.push(outL)
      if (inL && FN_RE.test(inL)) parts.push(inL)
      return parts.length ? parts.join('\n') : null
    }
    case 'carrier':
      return air
    default:
      return null
  }
}

/** 참좋은여행 — brandKey verygoodtour */
function verygoodtourSnippet(
  kind: RegisterFlightEvidenceKind,
  parsed: RegisterParsed,
  preview: Record<string, string | undefined | null> | null | undefined
): string | null {
  return trySources(parsed, preview, (lines) => {
    const idxOut = lines.findIndex((l) => /^출국\s*$/.test(l.trim()) || l.trim() === '출국')
    const idxIn = lines.findIndex((l) => /^입국\s*$/.test(l.trim()) || l.trim() === '입국')
    if (idxOut < 0 || idxIn <= idxOut) return null
    const outSeg = lines.slice(idxOut + 1, idxIn).filter((l) => /\d{4}/.test(l))
    const inSeg = lines.slice(idxIn + 1).filter((l) => /\d{4}/.test(l) && !NOISE.test(l)).slice(0, 6)
    const incheonDep = lines.find((l) => l.includes('인천') && l.includes('출발') && /\d{1,2}:\d{2}/.test(l))
    const incheonArr = lines.find((l) => l.includes('인천') && l.includes('도착') && /\d{1,2}:\d{2}/.test(l))
    switch (kind) {
      case 'flight_info':
        return outSeg.length + inSeg.length >= 2 ? [...outSeg, ...inSeg].join('\n') : null
      case 'outbound_departure':
      case 'outbound_flight_no':
        return kind === 'outbound_flight_no' ? null : incheonDep ?? null
      case 'inbound_arrival':
      case 'inbound_leg_places':
      case 'inbound_flight_no':
        return kind === 'inbound_flight_no' ? null : incheonArr ?? null
      case 'flight_no':
        return null
      case 'carrier': {
        if (idxOut <= 0) return null
        const before = lines.slice(0, idxOut).filter((l) => l.trim() && !/^출국|입국$/.test(l.trim()))
        const last = before[before.length - 1]
        return last && last.length <= 40 && !/\d{4}/.test(last) ? last : null
      }
      default:
        return null
    }
  })
}

/** 교보이지: 공항명 줄·시각 줄이 분리된 경우 인접 줄을 묶어 evidence로 쓴다 */
function kyowontourAirportWithAdjacentTime(
  block: string[],
  which: 'first' | 'last',
  airportMatch: (l: string) => boolean
): string | null {
  const timeRe = /\d{1,2}:\d{2}/
  const idxs: number[] = []
  for (let i = 0; i < block.length; i++) {
    if (airportMatch(block[i]!)) idxs.push(i)
  }
  if (!idxs.length) return null
  const i = which === 'first' ? idxs[0]! : idxs[idxs.length - 1]!
  const cur = block[i]!.trim()
  if (timeRe.test(cur)) return cur
  const next = block[i + 1]?.trim()
  if (next && timeRe.test(next)) return `${cur}\n${next}`
  const prev = block[i - 1]?.trim()
  if (prev && timeRe.test(prev)) return `${prev}\n${cur}`
  return null
}

/** 교보이지 */
function kyowontourSnippet(
  kind: RegisterFlightEvidenceKind,
  parsed: RegisterParsed,
  preview: Record<string, string | undefined | null> | null | undefined
): string | null {
  return trySources(parsed, preview, (lines) => {
    const iDep = lines.findIndex((l) => /^출발\s*$/.test(l.trim()))
    const iArr = lines.findIndex((l) => /^도착\s*$/.test(l.trim()))
    if (iDep < 0 || iArr <= iDep) return null
    const depBlock = lines.slice(iDep + 1, iArr).filter(Boolean)
    const arrBlock = lines.slice(iArr + 1).filter(Boolean).slice(0, 16)
    const depIncheon = kyowontourAirportWithAdjacentTime(depBlock, 'first', (l) => l.includes('인천'))
    const arrIncheon = kyowontourAirportWithAdjacentTime(arrBlock, 'last', (l) => l.includes('인천'))
    const fnDep = depBlock.find((l) => FN_RE.test(l))
    const fnArr = arrBlock.find((l) => FN_RE.test(l))
    switch (kind) {
      case 'flight_info':
        return depBlock.length && arrBlock.length ? [...depBlock, ...arrBlock].join('\n') : null
      case 'outbound_departure':
        return depIncheon ?? null
      case 'inbound_arrival':
      case 'inbound_leg_places':
        return arrIncheon ?? null
      case 'outbound_flight_no':
        return fnDep && FN_RE.test(fnDep) ? fnDep : null
      case 'inbound_flight_no':
        return fnArr && FN_RE.test(fnArr) ? fnArr : null
      case 'flight_no': {
        const bits = [fnDep, fnArr].filter(Boolean) as string[]
        return bits.length ? bits.join('\n') : null
      }
      case 'carrier':
        return depBlock.find((l) => /항공/.test(l) && !FN_RE.test(l)) ?? depBlock[0] ?? null
      default:
        return null
    }
  })
}

/** 하나투어 */
function hanatourSnippet(
  kind: RegisterFlightEvidenceKind,
  parsed: RegisterParsed,
  preview: Record<string, string | undefined | null> | null | undefined
): string | null {
  return trySources(parsed, preview, (lines) => {
    const dep = lines.find((l) => /출발\s*[:：]/.test(l))
    const arr = lines.find((l) => /도착\s*[:：]/.test(l))
    if (!dep || !arr) return null
    const depIdx = lines.indexOf(dep)
    const banner =
      depIdx > 0 ? lines.slice(0, depIdx).find((l) => /\d+\s*박\s*\d+\s*일/.test(l) && /항공/.test(l)) : null
    switch (kind) {
      case 'flight_info':
        return [banner, dep, arr].filter(Boolean).join('\n')
      case 'outbound_departure':
        return dep
      case 'inbound_arrival':
      case 'inbound_leg_places':
        return arr
      case 'outbound_flight_no':
        return FN_RE.test(dep) ? dep : null
      case 'inbound_flight_no':
        return FN_RE.test(arr) ? arr : null
      case 'flight_no': {
        const bits = [FN_RE.test(dep) ? dep : null, FN_RE.test(arr) ? arr : null].filter(Boolean) as string[]
        return bits.length ? bits.join('\n') : null
      }
      case 'carrier':
        return banner ?? null
      default:
        return null
    }
  })
}

/** 기타 공급사: 앵커만, normalized 미사용 */
function defaultSnippet(
  kind: RegisterFlightEvidenceKind,
  parsed: RegisterParsed,
  preview: Record<string, string | undefined | null> | null | undefined
): string | null {
  return trySources(parsed, preview, (lines) => {
    const airline = lines.find((l) => /^항공사\s*[:：]/i.test(l))
    const outL = lines.find((l) => /출발\s*[:：]/.test(l))
    const inL = lines.find((l) => /도착\s*[:：]/.test(l))
    const fnLines = lines.filter((l) => FN_RE.test(l))
    switch (kind) {
      case 'flight_info':
        if (outL && inL) return [airline, outL, inL].filter(Boolean).join('\n')
        return null
      case 'outbound_departure':
        return outL ?? null
      case 'inbound_arrival':
      case 'inbound_leg_places':
        return inL ?? null
      case 'flight_no':
        return fnLines.length ? fnLines.slice(0, 4).join('\n') : null
      case 'outbound_flight_no':
        return outL && FN_RE.test(outL) ? outL : null
      case 'inbound_flight_no':
        return inL && FN_RE.test(inL) ? inL : null
      case 'carrier':
        return airline ?? null
      default:
        return null
    }
  })
}

function normalizeBrandKey(brandKey: string | null | undefined): string {
  const canon = normalizeBrandKeyToCanonicalSupplierKey(brandKey)
  if (canon) return canon
  return (brandKey ?? '').trim().toLowerCase()
}

export function mapIssueFieldToFlightKind(field: string): RegisterFlightEvidenceKind | null {
  const f = field.toLowerCase()
  if (f.includes('outboundflightno')) return 'outbound_flight_no'
  if (f.includes('inboundflightno')) return 'inbound_flight_no'
  if (f.includes('flightno')) return 'flight_no'
  if (f.includes('carriername') || f === 'carrier' || f === 'airline' || f.includes('airlinename')) return 'carrier'
  if (f.includes('airline') && !f.includes('flightno')) return 'carrier'
  if (f.includes('inboundarrival')) return 'inbound_arrival'
  if (f.includes('outbounddepartureat') || f.includes('outbounddepartureplace') || f.includes('outbounddeparture'))
    return 'outbound_departure'
  if (f.includes('inbounddepartureplace')) return 'inbound_leg_places'
  if (f.includes('flight_info')) return 'flight_info'
  if (f.includes('inbound') && !f.includes('shopping')) return 'inbound_arrival'
  if (f.includes('outbound') && !f.includes('shopping')) return 'outbound_departure'
  if (f.includes('flight')) return 'flight_info'
  return null
}

export function buildSupplierFlightSnippet(
  brandKey: string | null | undefined,
  kind: RegisterFlightEvidenceKind,
  parsed: RegisterParsed,
  preview: Record<string, string | undefined | null> | null | undefined
): { rawSnippet: string | null; sourceKind: string } {
  const b = normalizeBrandKey(brandKey)
  let raw: string | null = null
  if (b === 'modetour') raw = modetourSnippet(kind, parsed, preview)
  else if (b === 'verygoodtour') raw = verygoodtourSnippet(kind, parsed, preview)
  else if (b === 'kyowontour') raw = kyowontourSnippet(kind, parsed, preview)
  else if (b === 'hanatour') raw = hanatourSnippet(kind, parsed, preview)
  else raw = defaultSnippet(kind, parsed, preview)

  const sourceKind = `flight_supplier:${b || 'unknown'}:${kind}`
  return { rawSnippet: raw, sourceKind }
}
