/**
 * 동선지도 구간 교통수단 — 원문·일정 텍스트 결정론만 (추정 전용차량 금지).
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: inferBongtourRouteMapTransport — manifest
 */

export type BongtourRouteMapTransportMode =
  | 'flight'
  | 'domestic_flight'
  | 'coach'
  | 'rail'
  | 'private_car'
  | 'cable_car'
  | 'ferry'
  | 'walk'
  | 'transfer'

export const BONGTOUR_ROUTE_MAP_TRANSPORT_LABEL: Record<BongtourRouteMapTransportMode, string> = {
  flight: '항공',
  domestic_flight: '국내선 이동',
  coach: '버스',
  rail: '기차',
  private_car: '전용차량',
  cable_car: '케이블카',
  ferry: '선박',
  walk: '도보',
  transfer: '이동',
}

export type BongtourRouteMapTransportDay = {
  day?: number | null
  title?: string | null
  routeText?: string | null
  description?: string | null
}

export type BongtourRouteMapTransportEdge = {
  from: number
  to: number
  fromCity: string
  toCity: string
  mode: BongtourRouteMapTransportMode
  label: string
  /** 원문/일정에서 확정되면 true */
  inferredFromSchedule: boolean
}

export type InferBongtourRouteMapTransportOpts = {
  /** 포함사항·원문 붙여넣기 등 상품 본문 (대형버스·국내선 등) */
  sourceText?: string | null
}

/** 우선순위 고정 — 국내선이 국제선/항공보다 먼저 */
const MODE_RULES: Array<{ mode: BongtourRouteMapTransportMode; re: RegExp }> = [
  { mode: 'domestic_flight', re: /국내선(?:\s*이동|\s*항공|\s*편)?/u },
  { mode: 'cable_car', re: /케이블\s*카|케이블카|곤돌라|푸니쿨라/u },
  { mode: 'rail', re: /기차|KTX|철도|열차(?!\s*및\s*버스)/u },
  { mode: 'ferry', re: /선박|페리|페어리|유람선/u },
  { mode: 'coach', re: /대형\s*버스|관광\s*버스|전세\s*버스|45인승|\d+인승\s*(?:이상\s*)?버스|버스\s*이동|버스\s*탑승/u },
  { mode: 'private_car', re: /전용\s*차량|리무진|렌터카/u },
  { mode: 'flight', re: /직항|왕복\s*항공|국제선|항공편|항공\s*요금|비행기|출국|귀국|기내식|인천\s*(?:출발|도착)/u },
  { mode: 'walk', re: /도보|워킹\s*투어|걸어서/u },
]

export function inferTransportModeFromText(text: string): BongtourRouteMapTransportMode | null {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return null
  for (const rule of MODE_RULES) {
    if (rule.re.test(t)) return rule.mode
  }
  return null
}

/** 원문에 맞춘 표시 라벨 (국내선 이동·대형버스 등) */
export function transportLabelForMode(
  mode: BongtourRouteMapTransportMode,
  evidenceText?: string | null
): string {
  const t = String(evidenceText || '')
  if (mode === 'domestic_flight') return '국내선 이동'
  if (mode === 'coach') {
    if (/대형\s*버스|45인승|\d+인승/.test(t)) return '대형버스'
    if (/관광\s*버스/.test(t)) return '관광버스'
    if (/전세\s*버스/.test(t)) return '전세버스'
    return '버스'
  }
  if (mode === 'private_car') return '전용차량'
  if (mode === 'flight') {
    if (/직항|논\s*스탑|경유\s*없/.test(t)) return '직항'
    if (/국제선/.test(t)) return '국제선'
    return '항공'
  }
  return BONGTOUR_ROUTE_MAP_TRANSPORT_LABEL[mode]
}

function dayHaystack(d: BongtourRouteMapTransportDay): string {
  return [d.title, d.routeText, d.description].map((x) => String(x || '').trim()).filter(Boolean).join(' ')
}

/** 포함사항 등에서 현지 육상 기본 교통 (항공 제외) */
export function inferPackageLandTransportDefault(
  sourceText: string | null | undefined
): { mode: BongtourRouteMapTransportMode; label: string; evidence: string } | null {
  const t = String(sourceText || '').replace(/\s+/g, ' ')
  if (!t.trim()) return null
  // 전용차량이 명시되면 그것
  if (/전용\s*차량/.test(t)) {
    return { mode: 'private_car', label: '전용차량', evidence: t }
  }
  const coachHit = t.match(
    /45인승\s*이상\s*대형\s*버스\s*이동|대형\s*버스\s*이동|관광\s*버스|전세\s*버스|버스\s*이동/
  )
  if (coachHit) {
    const evidence = coachHit[0]
    return {
      mode: 'coach',
      label: transportLabelForMode('coach', evidence),
      evidence,
    }
  }
  return null
}

/**
 * cities[i] → cities[i+1] 구간 교통.
 * 1) 일차 원문 2) 포함/본문 육상 기본 3) 없으면 transfer (추측 금지)
 */
export function inferBongtourRouteMapTransport(
  cities: readonly string[],
  schedule: readonly BongtourRouteMapTransportDay[],
  opts?: InferBongtourRouteMapTransportOpts
): BongtourRouteMapTransportEdge[] {
  const list = cities.map((c) => c.trim()).filter(Boolean)
  if (list.length < 2) return []

  const source = String(opts?.sourceText || '')
  const landDefault = inferPackageLandTransportDefault(source)
  const scheduleWhole = schedule.map(dayHaystack).join(' ')

  const edges: BongtourRouteMapTransportEdge[] = []
  for (let i = 0; i < list.length - 1; i++) {
    const fromCity = list[i]!
    const toCity = list[i + 1]!
    let mode: BongtourRouteMapTransportMode | null = null
    let evidence = ''

    for (const day of schedule) {
      const hay = dayHaystack(day)
      if (!hay) continue
      if (hay.includes(fromCity) && hay.includes(toCity)) {
        const m = inferTransportModeFromText(hay)
        if (m) {
          mode = m
          evidence = hay
          break
        }
      }
    }

    if (!mode) {
      const day = schedule[Math.min(i, schedule.length - 1)]
      const hay = day ? dayHaystack(day) : ''
      // 출국/귀국 일차만 항공 — 광역 haystack으로 전 구간 항공 도배 금지
      if (hay && (/출국|귀국|인천\s*출발|기내/.test(hay) || /국내선/.test(hay))) {
        const m = inferTransportModeFromText(hay)
        if (m === 'flight' || m === 'domestic_flight') {
          mode = m
          evidence = hay
        }
      }
    }

    // 포함사항의 육상 기본(대형버스 등) — 항공 구간이 아닐 때
    if (!mode && landDefault) {
      mode = landDefault.mode
      evidence = landDefault.evidence
    }

    // 첫/끝 구간: 일정 전체에 출국·귀국·왕복항공만 있고 일차에 단서 없을 때 항공
    if (!mode) {
      if (i === 0 && /출국|인천\s*출발|왕복\s*항공/.test(scheduleWhole + source)) {
        if (/국내선/.test(scheduleWhole + source) && /김포|제주|부산|대구|청주/.test(fromCity + toCity)) {
          mode = 'domestic_flight'
          evidence = '국내선'
        } else if (/왕복\s*항공|국제선|인천/.test(source + scheduleWhole)) {
          mode = 'flight'
          evidence = '항공'
        }
      }
    }

    const resolved: BongtourRouteMapTransportMode = mode ?? 'transfer'
    const fromSource = mode != null && Boolean(evidence)
    edges.push({
      from: i + 1,
      to: i + 2,
      fromCity,
      toCity,
      mode: resolved,
      label: transportLabelForMode(resolved, evidence || landDefault?.evidence),
      inferredFromSchedule: fromSource,
    })
  }
  return edges
}

export function formatBongtourRouteMapTransportSummary(
  cities: readonly string[],
  edges: readonly BongtourRouteMapTransportEdge[]
): string {
  if (cities.length === 0) return ''
  if (cities.length === 1) return cities[0]!
  const parts: string[] = [cities[0]!]
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!
    parts.push(`—${e.label}→`, cities[i + 1]!)
  }
  return parts.join(' ')
}

export function isBongtourRouteMapTransportMode(v: unknown): v is BongtourRouteMapTransportMode {
  return (
    typeof v === 'string' &&
    (Object.keys(BONGTOUR_ROUTE_MAP_TRANSPORT_LABEL) as string[]).includes(v)
  )
}
