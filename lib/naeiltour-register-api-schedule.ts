/**
 * 내일투어(naeiltour) 등록 일정 표현 SSOT — routeText(a–g ` - `) · description(동선 1줄 + 분위기 2~3문장).
 * REGRESSION-FREEZE[naeiltour-schedule-expression]: routeText·description vibe — manifest
 * REGRESSION-FREEZE[naeiltour-schedule-expression]: PackageDetail itinerary — manifest
 */
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-naeiltour'
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import { isRegisterScheduleRoutePlaceNoise, sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'

export const NAEILTOUR_SCHEDULE_ROUTE_MAX = 7

const NAEILTOUR_ROUTE_PLACE_NOISE_RE =
  /^(?:호텔\s*조식|조식\s*후|중식|석식|자유\s*시간|체크\s*인|체크\s*아웃|공항\s*도착|공항\s*출발|출발|도착|이동|탑승|귀국|투숙|미팅|피켓|입국\s*수속|출국\s*수속)|^[★☆◈◎○]|기상\s*악화|결항|대체|불가할|유의|안내|주의|※|→|특전|시차|국가번호|관광\s*시간|쇼핑점|침향|찻집|라텍스/i

const NAEILTOUR_ROUTE_LABEL_TRIM_RE =
  /(?:으로?\s*이동|으로?\s*출발|으로?\s*귀국|로\s*이동|방문|관광|투어|탐방|체험|승차|하차|탑승|도착|출발|미팅|피켓|조식\s*후|중식\s*후|석식\s*후)$/u

function cleanNaeiltourRoutePlaceLabel(raw: string): string {
  return String(raw ?? '')
    .replace(/^#+\s*/, '')
    .replace(/^■+\s*/, '')
    .replace(/^[\s·▪▶●\-–—]+/, '')
    .replace(/\s*\([^)]*\)\s*$/, (m) => (/\([A-Za-z]/.test(m) ? m : ' '))
    .replace(/\s+/g, ' ')
    .replace(NAEILTOUR_ROUTE_LABEL_TRIM_RE, '')
    .trim()
}

function isNaeiltourRoutePlaceNoise(label: string): boolean {
  if (isRegisterScheduleRoutePlaceNoise(label)) return true
  const t = label.trim()
  if (!t || t.length < 2 || t.length > 80) return true
  if (/^\d{4}년\s*\d{1,2}월/.test(t)) return true
  if (NAEILTOUR_ROUTE_PLACE_NOISE_RE.test(t)) return true
  if (/^(?:조식|중식|석식|기내|기장|승무원)/i.test(t)) return true
  if (/^\[/.test(t) && /\]/.test(t)) return true
  if (/^POINT\d+/i.test(t)) return true
  if (/^\d+$/.test(t)) return true
  if (/연락처|전화\s*:|1644|단체항공|좌석\s*배정|선착순|참고부탁|요금\s*변경|마감\s*또는|체크사항|떨어진\s*좌석|일행과|출발\s*전|사전\s*입력|입국\s*카드|MDAC/.test(t)) return true
  if (t.length > 28 && /[,，]/.test(t)) return true
  if (t.length > 24 && /(?:있는|하는|이며|으로|에서|까지|지어진|대표적인|상징적인|최대\s*규모)/.test(t)) return true
  if (/^(?:인천|ICN|김포|GMP|부산|PUS|대구|TAE|청주|CJJ)(?:\s*국제)?\s*공항?$/i.test(t)) return true
  return false
}

function normalizeNaeiltourRoutePlaceKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9가-힣]/g, '')
}

/** 순서 유지 중복 제거 — routeText·description 1줄 SSOT */
export function dedupeNaeiltourScheduleRoutePlaces(places: readonly string[]): string[] {
  const out: string[] = []
  const keys: string[] = []
  for (const raw of places) {
    const label = cleanNaeiltourRoutePlaceLabel(String(raw ?? ''))
    if (!label || isNaeiltourRoutePlaceNoise(label)) continue
    const key = normalizeNaeiltourRoutePlaceKey(label)
    if (!key) continue
    const dupIdx = keys.findIndex(
      (k) => k === key || (k.length >= 4 && key.includes(k)) || (key.length >= 4 && k.includes(key)),
    )
    if (dupIdx >= 0) {
      if (label.length > out[dupIdx]!.length) out[dupIdx] = label
      continue
    }
    keys.push(key)
    out.push(label)
  }
  return out
}

export function joinNaeiltourScheduleRouteText(places: readonly string[], max = NAEILTOUR_SCHEDULE_ROUTE_MAX): string | null {
  const chain = dedupeNaeiltourScheduleRoutePlaces(places).slice(0, max)
  return chain.length > 0 ? chain.join(' - ') : null
}

function extractPlaceFromNaeiltourTmTitle(title: string): string | null {
  const t = String(title ?? '').trim()
  if (!t || isNaeiltourRoutePlaceNoise(t)) return null
  const arrow = t.match(/(?:▶|●)\s*(.+)/)
  if (arrow?.[1]) {
    const label = cleanNaeiltourRoutePlaceLabel(arrow[1])
    return label && !isNaeiltourRoutePlaceNoise(label) ? label : null
  }
  const tour = t.match(/^(.{2,48}?)\s*(?:관광|방문|체험|투어|탐방)/u)
  if (tour?.[1]) {
    const label = cleanNaeiltourRoutePlaceLabel(tour[1])
    return label && !isNaeiltourRoutePlaceNoise(label) ? label : null
  }
  if (t.length >= 2 && t.length <= 48) {
    const label = cleanNaeiltourRoutePlaceLabel(t)
    return label && !isNaeiltourRoutePlaceNoise(label) ? label : null
  }
  return null
}

/** scheduleAjax timeline `<strong>` city·spot labels — a–g order */
export function extractNaeiltourSchedulePlacesFromCityLabels(cities: readonly string[]): string[] {
  return dedupeNaeiltourScheduleRoutePlaces(cities)
}

/** 붙여넣기 블록 — ▶·불릿 줄 순서로 routeText 후보 */
export function extractNaeiltourSchedulePlacesFromPastedBlock(block: string): string[] {
  const out: string[] = []
  for (const line of block.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    const markdownCity = t.match(/^#+\s*(.+)/)
    if (markdownCity?.[1]) {
      const label = cleanNaeiltourRoutePlaceLabel(markdownCity[1])
      if (label && !isNaeiltourRoutePlaceNoise(label)) out.push(label)
      continue
    }
    const bullet = t.match(/^(?:▶|●|-\s*)\s*(.+)/)
    if (bullet?.[1]) {
      const label = cleanNaeiltourRoutePlaceLabel(bullet[1])
      if (label && !isNaeiltourRoutePlaceNoise(label)) out.push(label)
      continue
    }
    const fromTitle = extractPlaceFromNaeiltourTmTitle(t)
    if (fromTitle) {
      out.push(fromTitle)
      continue
    }
    if (t.length >= 2 && t.length <= 24 && !/[.!?]/.test(t)) {
      const label = cleanNaeiltourRoutePlaceLabel(t)
      if (label && !isNaeiltourRoutePlaceNoise(label)) out.push(label)
    }
  }
  return dedupeNaeiltourScheduleRoutePlaces(out)
}

type NaeiltourScheduleVibeProfile =
  | 'return_calm'
  | 'return_transit'
  | 'arrival'
  | 'macau_daytrip'
  | 'hk_walking'
  | 'harbor_skyline'
  | 'spiritual_calm'
  | 'generic_tourism'

const NAEILTOUR_SCHEDULE_VIBE_DESCRIPTIONS: Record<NaeiltourScheduleVibeProfile, readonly string[]> = {
  hk_walking: [
    '홍콩의 세련된 번화가부터 아기자기한 로컬 골목까지, 다채로운 매력을 하루에 만끽하는 알찬 도보 여행 동선입니다.',
    '화려한 현대적 감각과 서정적인 분위기가 자연스럽게 이어져 걷는 즐거움이 가득한 최적의 일정입니다.',
  ],
  macau_daytrip: [
    '홍콩을 거점으로 바다를 건너 이웃 도시의 이색적인 분위기를 체험하는 당일치기 동선입니다.',
    '낮에는 역사·문화의 깊이를 느끼고, 저녁에는 다시 익숙한 거점으로 돌아와 하루의 여정을 정리합니다.',
  ],
  harbor_skyline: [
    '스카이라인과 바다 풍경이 어우러지는, 시야가 넓게 펼쳐지는 감성적인 하루입니다.',
    '이동 동선마다 분위기가 달라져, 짧은 시간에도 여행의 깊이를 느끼기 좋은 구성입니다.',
  ],
  spiritual_calm: [
    '도심 속 전통과 여유가 공존하는, 차분한 리듬의 하루입니다.',
    '무거운 이동 없이 잔잔한 분위기 위주로, 여행의 마무리에 어울리는 구성입니다.',
  ],
  return_calm: [
    '여유로운 마무리 관광 뒤 귀국 동선으로, 여정의 여운을 정리하는 하루입니다.',
    '별도의 굵직한 이동 없이, 핵심 분위기만 가볍게 담아가며 여행을 마무리합니다.',
  ],
  return_transit: [
    '현지를 정리하고 귀국길로 이어지는, 이동 중심의 마무리 일정입니다.',
    '여행의 리듬을 늦추지 않고, 돌아오는 길까지 자연스럽게 이어지는 흐름입니다.',
  ],
  arrival: [
    '현지 도착 후 첫날, 도시의 리듬에 맞춰 걷고 둘러보는 알찬 입국·탐색 일정입니다.',
    '이동과 관광이 자연스럽게 이어지며, 이후 일정의 흐름을 미리 익혀 가는 구성입니다.',
  ],
  generic_tourism: [
    '하루 동안 여러 장면이 자연스럽게 이어지는, 보기와 걷기가 균형 잡힌 알찬 동선입니다.',
    '특정 장소보다 전체적인 흐름과 분위기를 중심으로 여행의 컨셉을 느끼기 좋은 일정입니다.',
  ],
}

function inferNaeiltourScheduleVibeProfile(day: number, maxDay: number, joinedBlob: string): NaeiltourScheduleVibeProfile {
  if (day === maxDay && /(?:도착|귀국|출국|해산)/u.test(joinedBlob)) {
    if (/사원|temple|럭키|행운|축원|기도|웡타이/i.test(joinedBlob)) return 'return_calm'
    return 'return_transit'
  }
  if (day === 1 && /(?:출발|도착|공항|입국)/u.test(joinedBlob)) return 'arrival'
  if (/마카오|macau|베네시an|세나도|코타이|유네스코/i.test(joinedBlob)) return 'macau_daytrip'
  if (/소호|soho|센트럴|central|헐리우드|hollywood|mid-?level|완차이|wan\s*chai|리퉁/i.test(joinedBlob)) {
    return 'hk_walking'
  }
  if (/피크|peak|하버|harbor|빅토리아|전망|야경|스타\s*페리|침사/i.test(joinedBlob)) return 'harbor_skyline'
  if (/사원|temple|럭키|웡타이/i.test(joinedBlob)) return 'spiritual_calm'
  return 'generic_tourism'
}

function naeiltourHighlightLeakChunks(label: string): string[] {
  const bare = label.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  const chunks = bare
    .split(/[,，·]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
  return [...new Set([bare, ...chunks].filter((s) => s.length >= 4))]
}

/** 분위기·흐름 2~3문장 — 장소 디테일 금지 */
export function composeNaeiltourScheduleVibeSentences(
  day: number,
  maxDay: number,
  routePlaces: readonly string[],
  joinedBlob: string,
): string {
  const profile = inferNaeiltourScheduleVibeProfile(day, maxDay, joinedBlob)
  const sentences = [...NAEILTOUR_SCHEDULE_VIBE_DESCRIPTIONS[profile]].slice(0, 3)
  let desc = sentences.join(' ')
  for (const h of routePlaces) {
    for (const chunk of naeiltourHighlightLeakChunks(h)) {
      if (desc.includes(chunk)) {
        desc = NAEILTOUR_SCHEDULE_VIBE_DESCRIPTIONS.generic_tourism.slice(0, 2).join(' ')
        break
      }
    }
  }
  return desc.slice(0, 320).trim()
}

/** description = routeText 1줄 + 분위기 2~3문장 */
export function composeNaeiltourScheduleDescription(opts: {
  day: number
  maxDay: number
  routePlaces: readonly string[]
  joinedBlob: string
}): string {
  const routeLine = joinNaeiltourScheduleRouteText(opts.routePlaces)
  const vibe = composeNaeiltourScheduleVibeSentences(
    opts.day,
    opts.maxDay,
    opts.routePlaces,
    opts.joinedBlob,
  )
  if (!routeLine) return vibe || `${opts.day}일차`
  if (!vibe) return routeLine
  return `${routeLine}\n${vibe}`.slice(0, 500).trim()
}

export function naeiltourFactDaysToRegisterSchedule(days: RegisterFactScheduleDay[]): RegisterScheduleDay[] {
  const maxDay = days.reduce((m, d) => Math.max(m, d.day), 0)
  return days.map((d) => {
    const routePlaces = dedupeNaeiltourScheduleRoutePlaces(d.places)
    const routeText = joinNaeiltourScheduleRouteText(routePlaces)
    const joinedBlob = [d.transportNote, routeText, ...routePlaces, ...d.places].filter(Boolean).join(' ')
    const title =
      routeText?.split(' - ')[0]?.trim() ||
      String(d.transportNote ?? '').split(';')[0]?.trim() ||
      (d.hotels[0] ?? '').trim() ||
      `${d.day}일차`
    const description = composeNaeiltourScheduleDescription({
      day: d.day,
      maxDay,
      routePlaces,
      joinedBlob,
    })
    const meals = parseFactMealsListToScheduleFields(d.meals)
    return {
      day: d.day,
      title,
      description,
      routeText,
      imageKeyword: '',
      imageKeyword2: null,
      hotelText: d.hotels.length > 0 ? d.hotels.join(' / ') : null,
      breakfastText: meals.breakfastText ?? null,
      lunchText: meals.lunchText ?? null,
      dinnerText: meals.dinnerText ?? null,
      mealSummaryText: meals.mealSummaryText ?? null,
    }
  })
}

/** 등록 schedule[] — routeText·description 일괄 보정 (붙여넣기 병합 후) */
export function applyNaeiltourScheduleExpressionToRows<T extends RegisterScheduleDay>(rows: T[]): T[] {
  const maxDay = rows.reduce((m, r) => Math.max(m, Number(r.day) || 0), 0)
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const fromExisting = row.routeText
      ? dedupeNaeiltourScheduleRoutePlaces(
          row.routeText
            .split(/\s*-\s*/)
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : []
    const fromPaste = extractNaeiltourSchedulePlacesFromPastedBlock(String(row.description ?? ''))
    const routePlaces =
      fromExisting.length >= 2
        ? fromExisting
        : dedupeNaeiltourScheduleRoutePlaces(fromPaste.length > 0 ? fromPaste : fromExisting)
    const routeText =
      sanitizeRegisterScheduleRouteText(joinNaeiltourScheduleRouteText(routePlaces) ?? row.routeText ?? null) ??
      row.routeText ??
      null
    const joinedBlob = [row.title, row.description, routeText].filter(Boolean).join('\n')
    const description = composeNaeiltourScheduleDescription({
      day,
      maxDay,
      routePlaces,
      joinedBlob,
    })
    return { ...row, routeText, description }
  })
}

