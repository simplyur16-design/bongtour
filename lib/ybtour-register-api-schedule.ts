/**
 * 노랑풍선(ybtour) 등록 일정 표현 SSOT — routeText(a–g ` - `) · description(동선 1줄 + 분위기 2~3문장).
 * REGRESSION-FREEZE[ybtour-register-detail-collect]: ybtourScheduleBundleToRegisterSchedule — manifest
 * REGRESSION-FREEZE[ybtour-register-api-schedule-tm-html-strip]: papi tmContent HTML strip — manifest
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: description vibe-only — manifest
 */
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'
import { classifyYbtourScheduleCardDayKind } from '@/lib/ybtour-schedule-image-keyword'
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import { expandRegisterScheduleRoutePlaceCandidates, isRegisterScheduleRoutePlaceNoise, sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'

export const YBTOUR_SCHEDULE_ROUTE_MAX = 7

/** papi notice·scheduleDetailTm HTML → plain text (routeText·description SSOT) */
export function stripYbtourHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&middot;/gi, '·')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const YBTOUR_ROUTE_PLACE_NOISE_RE =
  /^(?:호텔\s*조식|조식\s*후|중식|석식|자유\s*시간|체크\s*인|체크\s*아웃|공항\s*도착|공항\s*출발|출발|도착|이동|탑승|귀국|투숙|미팅|피켓|입국\s*수속|출국\s*수속)/i

const YBTOUR_ROUTE_LABEL_TRIM_RE =
  /(?:으로?\s*이동|으로?\s*출발|으로?\s*귀국|로\s*이동|방문|관광|투어|탐방|체험|승차|하차|탑승|도착|출발|미팅|피켓|조식\s*후|중식\s*후|석식\s*후)$/u

function cleanYbtourRoutePlaceLabel(raw: string): string {
  return String(raw ?? '')
    .replace(/^[\s·▪▶●\-–—]+/, '')
    .replace(/\s*\([^)]*\)\s*$/, (m) => (/\([A-Za-z]/.test(m) ? m : ' '))
    .replace(/\s+/g, ' ')
    .replace(YBTOUR_ROUTE_LABEL_TRIM_RE, '')
    .trim()
}

function isYbtourRoutePlaceNoise(label: string): boolean {
  if (isRegisterScheduleRoutePlaceNoise(label)) return true
  const t = label.trim()
  if (!t || t.length < 2 || t.length > 80) return true
  if (YBTOUR_ROUTE_PLACE_NOISE_RE.test(t)) return true
  if (/^(?:조식|중식|석식|기내|기장|승무원)/i.test(t)) return true
  if (/차별화\s*POINT|노랑풍선\s*차별화|<\/?\w+/i.test(t)) return true
  if (/항공\s*(?:사|편|요금)|터미널|탑승\s*수속|출발\s*시간|도착\s*시간|기내\s*식|수하물|연결\s*편/u.test(t)) return true
  if (/^(?:인천|ICN|김포|GMP|부산|PUS|대구|TAE|청주|CJJ)(?:\s*국제)?\s*공항?$/i.test(t)) return true
  return false
}

function normalizeYbtourRoutePlaceKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9가-힣]/g, '')
}

/** 순서 유지 중복 제거 — routeText·description 1줄 SSOT */
export function dedupeYbtourScheduleRoutePlaces(places: readonly string[]): string[] {
  const out: string[] = []
  const keys: string[] = []
  for (const raw of places) {
    const candidates = new Set<string>()
    const fromTitle = extractPlaceFromYbtourTmTitle(String(raw ?? ''))
    if (fromTitle) candidates.add(fromTitle)
    for (const c of expandRegisterScheduleRoutePlaceCandidates(String(raw ?? ''))) candidates.add(c)
    for (const candidate of candidates) {
      const label = cleanYbtourRoutePlaceLabel(candidate)
      if (!label || isYbtourRoutePlaceNoise(label)) continue
      const key = normalizeYbtourRoutePlaceKey(label)
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
  }
  return out
}

export function joinYbtourScheduleRouteText(places: readonly string[], max = YBTOUR_SCHEDULE_ROUTE_MAX): string | null {
  return sanitizeRegisterScheduleRouteText(
    dedupeYbtourScheduleRoutePlaces(places).slice(0, max).join(' - '),
    max,
  )
}

function isYbtourTmTitleMealOrNoise(title: string): boolean {
  const t = title.trim()
  if (!t) return true
  return /^(?:호텔\s*조식|조식\s*후|중식|석식|자유\s*시간|체크\s*인|체크\s*아웃)/i.test(t)
}

function extractPlaceFromYbtourTmTitle(title: string): string | null {
  const t = String(title ?? '').trim()
  if (!t || isYbtourRoutePlaceNoise(t)) return null
  const arrow = t.match(/(?:▶|●)\s*(.+)/)
  if (arrow?.[1]) {
    const label = cleanYbtourRoutePlaceLabel(arrow[1])
    return label && !isYbtourRoutePlaceNoise(label) ? label : null
  }
  const afterGuide = t.match(/(?:미팅|피켓)\s*후\s*(.+)/u)
  if (afterGuide?.[1]) {
    const label = cleanYbtourRoutePlaceLabel(afterGuide[1])
    return label && !isYbtourRoutePlaceNoise(label) ? label : null
  }
  const moveTo = t.match(/^(.{2,32}?)(?:으로|로)\s*이동/u)
  if (moveTo?.[1]) {
    const label = cleanYbtourRoutePlaceLabel(moveTo[1])
    return label && !isYbtourRoutePlaceNoise(label) ? label : null
  }
  const move = t.match(/(?:에서|후)\s*(.+?)(?:으로?\s*이동|으로?\s*출발|으로?\s*귀국|방문|관광|투어|탐방)/u)
  if (move?.[1]) {
    const label = cleanYbtourRoutePlaceLabel(move[1])
    return label && !isYbtourRoutePlaceNoise(label) ? label : null
  }
  const tour = t.match(/^(.{2,48}?)\s*(?:관광|방문|체험|투어|탐방)/u)
  if (tour?.[1]) {
    const label = cleanYbtourRoutePlaceLabel(tour[1])
    return label && !isYbtourRoutePlaceNoise(label) ? label : null
  }
  if (t.length >= 2 && t.length <= 48 && !/(?:조식|중식|석식|미팅)\s*후/u.test(t)) {
    const label = cleanYbtourRoutePlaceLabel(t)
    return label && !isYbtourRoutePlaceNoise(label) ? label : null
  }
  return null
}

export type YbtourScheduleTmPlaceRow = {
  tmNo?: number | null
  tmTitle?: string | null
  tmContent?: string | null
  cityNm?: string | null
}

/** scheduleDetailTm — tmNo 순서로 방문지 a–g 추출 */
export function extractYbtourSchedulePlacesFromTmRows(rows: readonly YbtourScheduleTmPlaceRow[]): string[] {
  const sorted = [...rows].sort((a, b) => Number(a.tmNo ?? 0) - Number(b.tmNo ?? 0))
  const out: string[] = []
  for (const row of sorted) {
    const titlePlain = stripYbtourHtmlText(String(row.tmTitle ?? ''))
    const fromTitle = extractPlaceFromYbtourTmTitle(titlePlain)
    if (fromTitle) {
      out.push(fromTitle)
    } else if (!titlePlain.trim() || !isYbtourTmTitleMealOrNoise(titlePlain)) {
      const city = String(row.cityNm ?? '').trim()
      if (city && !isYbtourRoutePlaceNoise(city)) out.push(city)
    }
    const content = stripYbtourHtmlText(String(row.tmContent ?? ''))
    if (content) {
      for (const line of content.split(/\n+/)) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const arrow = trimmed.match(/(?:▶|●|■)\s*(.+)/)
        if (arrow?.[1]) {
          const label = cleanYbtourRoutePlaceLabel(arrow[1])
          if (label && !isYbtourRoutePlaceNoise(label)) out.push(label)
          continue
        }
        const fromLine = extractPlaceFromYbtourTmTitle(trimmed)
        if (fromLine) out.push(fromLine)
      }
    }
  }
  return dedupeYbtourScheduleRoutePlaces(out)
}

/** 붙여넣기 블록 — ▶·불릿 줄 순서로 routeText 후보 */
export function extractYbtourSchedulePlacesFromPastedBlock(block: string): string[] {
  const out: string[] = []
  for (const line of block.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    const bullet = t.match(/^(?:▶|●|-\s*)\s*(.+)/)
    if (bullet?.[1]) {
      const label = cleanYbtourRoutePlaceLabel(bullet[1])
      if (label && !isYbtourRoutePlaceNoise(label)) out.push(label)
      continue
    }
    const fromTitle = extractPlaceFromYbtourTmTitle(t)
    if (fromTitle) out.push(fromTitle)
  }
  return dedupeYbtourScheduleRoutePlaces(out)
}

type YbtourScheduleVibeProfile =
  | 'return_calm'
  | 'return_transit'
  | 'arrival'
  | 'macau_daytrip'
  | 'hk_walking'
  | 'harbor_skyline'
  | 'spiritual_calm'
  | 'generic_tourism'

const YBTOUR_SCHEDULE_VIBE_DESCRIPTIONS: Record<YbtourScheduleVibeProfile, readonly string[]> = {
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

function inferYbtourScheduleVibeProfile(day: number, maxDay: number, joinedBlob: string): YbtourScheduleVibeProfile {
  const kind = classifyYbtourScheduleCardDayKind(day, maxDay, joinedBlob)
  if (kind === 'return_home') {
    if (/사원|temple|럭키|행운|축원|기도|웡타이/i.test(joinedBlob)) return 'return_calm'
    return 'return_transit'
  }
  if (kind === 'movement' && day === 1) return 'arrival'
  if (/마카오|macau|베네시an|세나도|코타이|유네스코/i.test(joinedBlob)) return 'macau_daytrip'
  if (/소호|soho|센트럴|central|헐리우드|hollywood|mid-?level|완차이|wan\s*chai|리퉁/i.test(joinedBlob)) {
    return 'hk_walking'
  }
  if (/피크|peak|하버|harbor|빅토리아|전망|야경|스타\s*페리|침사/i.test(joinedBlob)) return 'harbor_skyline'
  if (/사원|temple|럭키|웡타이/i.test(joinedBlob)) return 'spiritual_calm'
  return 'generic_tourism'
}

function ybtourHighlightLeakChunks(label: string): string[] {
  const bare = label.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  const chunks = bare
    .split(/[,，·]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
  return [...new Set([bare, ...chunks].filter((s) => s.length >= 4))]
}

/** 분위기·흐름 2~3문장 — 장소 디테일 금지 */
export function composeYbtourScheduleVibeSentences(
  day: number,
  maxDay: number,
  routePlaces: readonly string[],
  joinedBlob: string,
): string {
  const profile = inferYbtourScheduleVibeProfile(day, maxDay, joinedBlob)
  const sentences = [...YBTOUR_SCHEDULE_VIBE_DESCRIPTIONS[profile]].slice(0, 3)
  let desc = sentences.join(' ')
  for (const h of routePlaces) {
    for (const chunk of ybtourHighlightLeakChunks(h)) {
      if (desc.includes(chunk)) {
        desc = YBTOUR_SCHEDULE_VIBE_DESCRIPTIONS.generic_tourism.slice(0, 2).join(' ')
        break
      }
    }
  }
  return desc.slice(0, 320).trim()
}

/** description — 분위기·흐름 2~3문장 (장소 나열은 routeText 전용) */
export function composeYbtourScheduleDescription(opts: {
  day: number
  maxDay: number
  routePlaces: readonly string[]
  joinedBlob: string
}): string {
  const vibe = composeYbtourScheduleVibeSentences(
    opts.day,
    opts.maxDay,
    opts.routePlaces,
    opts.joinedBlob,
  )
  return vibe || `${opts.day}일차`
}

export function ybtourFactDaysToRegisterSchedule(days: RegisterFactScheduleDay[]): RegisterScheduleDay[] {
  const maxDay = days.reduce((m, d) => Math.max(m, d.day), 0)
  return days.map((d) => {
    const routePlaces = dedupeYbtourScheduleRoutePlaces(d.places)
    const routeText = joinYbtourScheduleRouteText(routePlaces)
    const joinedBlob = [d.transportNote, routeText, ...routePlaces, ...d.places].filter(Boolean).join(' ')
    const title =
      routeText?.split(' - ')[0]?.trim() ||
      String(d.transportNote ?? '').split(';')[0]?.trim() ||
      (d.hotels[0] ?? '').trim() ||
      `${d.day}일차`
    const description = composeYbtourScheduleDescription({
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
export function applyYbtourScheduleExpressionToRows<T extends RegisterScheduleDay>(rows: T[]): T[] {
  const maxDay = rows.reduce((m, r) => Math.max(m, Number(r.day) || 0), 0)
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const fromRoute = row.routeText ? dedupeYbtourScheduleRoutePlaces(row.routeText.split(/\s*-\s*/)) : []
    const routePlaces = dedupeYbtourScheduleRoutePlaces(fromRoute)
    const routeText =
      sanitizeRegisterScheduleRouteText(joinYbtourScheduleRouteText(routePlaces) ?? row.routeText ?? null) ??
      row.routeText ??
      null
    const joinedBlob = [row.title, row.description, routeText].filter(Boolean).join('\n')
    const description = composeYbtourScheduleDescription({
      day,
      maxDay,
      routePlaces,
      joinedBlob,
    })
    return { ...row, routeText, description }
  })
}
