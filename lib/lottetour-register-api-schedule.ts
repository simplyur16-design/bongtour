/**
 * 롯데관광(lottetour) 등록 일정 표현 SSOT — routeText(a–g ` - `) · description(vibe 2~3문장).
 * plan_info는 route 명소·vibe profile 근거만 (일정설명에 장소 디테일·마케팅 덤프 금지).
 * REGRESSION-FREEZE[lottetour-schedule-expression]: routeText·description vibe — manifest
 * REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: description은 vibe 2~3문장 (plan_info는 route·profile 근거) — manifest
 * REGRESSION-FREEZE[lottetour-register-detail-collect]: parseLottetourScheduleDaysFromScheduleAjax — manifest
 */
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-lottetour'
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import {
  isRegisterSchedulePlanInfoMarketingLine,
  registerScheduleDescriptionHasMarketingNoise,
} from '@/lib/register-schedule-description-marketing-guard'
import { isRegisterScheduleRoutePlaceNoise, sanitizeRegisterScheduleRouteText, expandRegisterScheduleRoutePlaceCandidates } from '@/lib/register-schedule-route-place-noise'
import { composeRegisterScheduleDayTitleFromRoute } from '@/lib/register-schedule-day-title'
import {
  composeRegisterScheduleExtendedRegionVibeDescription,
  isRegisterScheduleGenericTourismDescription,
} from '@/lib/register-schedule-region-vibe-extended'

export const LOTTETOUR_SCHEDULE_ROUTE_MAX = 7

// REGRESSION-FREEZE[lottetour-schedule-route-admin-noise]: meal·포함일정·증명서 — manifest
const LOTTETOUR_ROUTE_PLACE_NOISE_RE =
  /^(?:호텔\s*조식|조식\s*후|중식|석식|자유\s*시간|체크\s*인|체크\s*아웃|공항\s*도착|공항\s*출발|출발|도착|이동|탑승|귀국|투숙|미팅|피켓|입국\s*수속|출국\s*수속|포함\s*일정|영문\s*가족관계|가족관계\s*증명서|증명서|면세\s*가능|면세(?:점|품)?(?:\s*\d+)?\s*(?:회\s*)?쇼핑|쇼핑\s*\d+\s*회|현지\s*가이드|현지\s*연락처|필수\s*서류|작성\s*및\s*제출|롯데관광\s*단독|^롯데$)|^\d+\s*시간(?:\s*\d+\s*분)?$|^\d{1,2}:\d{2}$|(?:가정식|쌀국수|분짜|반쎄오|갑오징어|양식|한식|특식).{0,12}(?:SET|세트)|(?:SET|세트)$|(?:소고기\s*)?쌀국수|분짜|반쎄오|가정식|갑오징어(?:\s*볶음)?|(?:양식|한식|특식|BBQ)\s*SET|에그\s*타르트|광동식|^이태원$|^칠리\s*크랩$|^바쿠테$|^송파$|^레드\s*하우스$|^[★☆◈◎○]|기상\s*악화|결항|대체|불가할|유의|안내|주의|※|→|특전|시차|국가번호|관광\s*시간|쇼핑점|침향|찻집|라텍스|공항\s*도착\s*후|가이드\s*미팅|세계\s*문화유산|세계\s*자연유산|멋진\s*풍경|전망대에서|모험의\s*땅|공존하는|귀환|여정$/i

const LOTTETOUR_ROUTE_LABEL_TRIM_RE =
  /(?:으로?\s*이동|으로?\s*출발|으로?\s*귀국|로\s*이동|방문|관광|투어|탐방|체험|승차|하차|탑승|도착|출발|미팅|피켓|조식\s*후|중식\s*후|석식\s*후)$/u

function cleanLottetourRoutePlaceLabel(raw: string): string {
  return String(raw ?? '')
    .replace(/^[\s·▪▶●\-–—]+/, '')
    .replace(/\s*\([^)]*\)\s*$/, (m) => (/\([A-Za-z]/.test(m) ? m : ' '))
    .replace(/\s+/g, ' ')
    .replace(LOTTETOUR_ROUTE_LABEL_TRIM_RE, '')
    .trim()
}

function isLottetourRoutePlaceNoise(label: string): boolean {
  if (isRegisterScheduleRoutePlaceNoise(label)) return true
  const t = label.trim()
  if (LOTTETOUR_ROUTE_PLACE_NOISE_RE.test(t)) return true
  return false
}

function normalizeLottetourRoutePlaceKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9가-힣]/g, '')
}

/** 순서 유지 중복 제거 — routeText·description 1줄 SSOT */
export function dedupeLottetourScheduleRoutePlaces(places: readonly string[]): string[] {
  const out: string[] = []
  const keys: string[] = []
  for (const raw of places) {
    for (const candidate of expandRegisterScheduleRoutePlaceCandidates(String(raw ?? ''))) {
      const label = cleanLottetourRoutePlaceLabel(candidate)
      if (!label || isLottetourRoutePlaceNoise(label)) continue
      const key = normalizeLottetourRoutePlaceKey(label)
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

export function joinLottetourScheduleRouteText(places: readonly string[], max = LOTTETOUR_SCHEDULE_ROUTE_MAX): string | null {
  return sanitizeRegisterScheduleRouteText(
    dedupeLottetourScheduleRoutePlaces(places).slice(0, max).join(' - '),
    max,
  )
}

function extractPlaceFromLottetourTmTitle(title: string): string | null {
  const t = String(title ?? '').trim()
  if (!t || isLottetourRoutePlaceNoise(t)) return null
  const arrow = t.match(/(?:▶|●)\s*(.+)/)
  if (arrow?.[1]) {
    const label = cleanLottetourRoutePlaceLabel(arrow[1])
    return label && !isLottetourRoutePlaceNoise(label) ? label : null
  }
  const tour = t.match(/^(.{2,48}?)\s*(?:관광|방문|체험|투어|탐방)/u)
  if (tour?.[1]) {
    const label = cleanLottetourRoutePlaceLabel(tour[1])
    return label && !isLottetourRoutePlaceNoise(label) ? label : null
  }
  if (t.length >= 2 && t.length <= 48) {
    const label = cleanLottetourRoutePlaceLabel(t)
    return label && !isLottetourRoutePlaceNoise(label) ? label : null
  }
  return null
}

/** scheduleAjax timeline `<strong>` city·spot labels — a–g order */
export function extractLottetourSchedulePlacesFromCityLabels(cities: readonly string[]): string[] {
  return dedupeLottetourScheduleRoutePlaces(cities)
}

/** 붙여넣기 블록 — ▶·불릿 줄 순서로 routeText 후보 */
export function extractLottetourSchedulePlacesFromPastedBlock(block: string): string[] {
  const out: string[] = []
  for (const line of block.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    const bullet = t.match(/^(?:▶|●|-\s*)\s*(.+)/)
    if (bullet?.[1]) {
      const label = cleanLottetourRoutePlaceLabel(bullet[1])
      if (label && !isLottetourRoutePlaceNoise(label)) out.push(label)
      continue
    }
    const fromTitle = extractPlaceFromLottetourTmTitle(t)
    if (fromTitle) out.push(fromTitle)
  }
  return dedupeLottetourScheduleRoutePlaces(out)
}

type LottetourScheduleVibeProfile =
  | 'return_calm'
  | 'return_transit'
  | 'arrival'
  | 'macau_daytrip'
  | 'hk_walking'
  | 'harbor_skyline'
  | 'spiritual_calm'
  | 'singapore_gardens'
  | 'singapore_uss'
  | 'nature_trek'
  | 'fiord_cruise'
  | 'desert_coast'
  | 'thermal_spa'
  | 'prague_old_town'
  | 'danube_cities'
  | 'alpine_lake'
  | 'germany_castles'
  | 'germany_rhine'
  | 'germany_romantic_road'
  | 'germany_berlin'
  | 'germany_medieval'
  | 'france_paris'
  | 'france_normandy'
  | 'france_loire'
  | 'france_bordeaux'
  | 'france_provence'
  | 'france_riviera'
  | 'italy_tuscany'
  | 'italy_rome'
  | 'italy_venice'
  | 'italy_amalfi'
  | 'italy_lakes'
  | 'italy_dolomites'
  | 'uk_london'
  | 'uk_scotland'
  | 'uk_ireland'
  | 'uk_countryside'
  | 'turkey_istanbul'
  | 'turkey_cappadocia'
  | 'turkey_pamukkale'
  | 'turkey_aegean'
  | 'turkey_antalya'
  | 'turkey_central'
  | 'vietnam_hanoi'
  | 'vietnam_halong'
  | 'generic_tourism'

const LOTTETOUR_SCHEDULE_VIBE_DESCRIPTIONS: Record<LottetourScheduleVibeProfile, readonly string[]> = {
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
  singapore_gardens: [
    '정원·전망·해안이 이어지는 핵심 동선으로, 걷기와 시야 확장이 균형을 이룹니다.',
    '도시 상징 랜드마크와 여유 구간을 하루 흐름에 맞춰 담아내는 구성입니다.',
  ],
  singapore_uss: [
    '테마파크 하루 자유 일정으로, 입장·동선·여유 시간을 스스로 짜는 플레이형 하루입니다.',
    '패키지 단체 일정과 분리된 자유 탐방 리듬이 중심이 됩니다.',
  ],
  nature_trek: [
    '대자연의 스케일을 천천히 걸으며 느끼는, 호흡이 깊어지는 트레킹형 하루입니다.',
    '산·호수·숲길이 이어져 이동보다 풍경의 리듬이 중심이 되는 구성입니다.',
  ],
  fiord_cruise: [
    '절벽과 바다가 맞닿은 피요르드 풍경이 하루의 하이라이트로 펼쳐지는 일정입니다.',
    '선상에서 시야가 넓게 열리며, 대자연의 장엄함이 흐름의 중심이 됩니다.',
  ],
  desert_coast: [
    '바다와 모래 언덕이 맞닿은 해안 모험 동선으로, 움직임과 풍경 변화가 큰 하루입니다.',
    '체험과 크루즈 리듬이 이어져 활기찬 분위기로 하루를 채우는 구성입니다.',
  ],
  thermal_spa: [
    '지열·온천 지대의 독특한 공기와 여유를 중심으로 하루의 템포를 낮추는 일정입니다.',
    '문화 체험과 휴식이 자연스럽게 이어져 감각이 편안해지는 흐름입니다.',
  ],
  prague_old_town: [
    '중세 골목과 광장이 이어지는, 걷는 리듬이 중심이 되는 중부 유럽의 하루입니다.',
    '성·다리·구시가지가 자연스럽게 연결되어 도시의 결을 천천히 느끼는 구성입니다.',
  ],
  danube_cities: [
    '강변 도시들이 이어지는 이동형 하루로, 국경을 넘는 풍경 변화가 돋보입니다.',
    '짧은 체류에도 각 도시의 분위기 차이가 분명하게 느껴지는 구성입니다.',
  ],
  alpine_lake: [
    '호수와 산자락이 맞닿은 풍경이 하루의 하이라이트로 펼쳐지는 일정입니다.',
    '이동보다 시야가 열리는 순간이 중심이 되어, 여운이 길게 남는 구성입니다.',
  ],
  germany_castles: [
    '성곽과 호수가 이어지는 바이에른의 하루로, 왕실의 규모감이 일정 리듬을 이끕니다.',
    '실내 관람과 이동이 번갈아 이어져, 풍경과 건축의 대비가 또렷한 구성입니다.',
  ],
  germany_rhine: [
    '강변 언덕과 와인 마을이 이어지는, 라인 유역의 여유로운 이동형 하루입니다.',
    '짧은 체류에도 강과 언덕의 분위기가 하루 흐름의 중심이 됩니다.',
  ],
  germany_romantic_road: [
    '중세 골목과 성벽 마을이 이어지는, 로맨틱 가도의 걷는 리듬이 돋보이는 하루입니다.',
    '작은 도시들의 분위기가 자연스럽게 연결되어 여정이 부드럽게 이어집니다.',
  ],
  germany_berlin: [
    '광장과 기념비가 이어지는 수도의 하루로, 역사와 현대가 교차하는 흐름입니다.',
    '도심을 천천히 가로지르며 도시의 결을 쌓아 가는 구성입니다.',
  ],
  germany_medieval: [
    '성벽·광장·구시가지가 이어지는 중세형 하루로, 걷는 리듬이 중심이 됩니다.',
    '짧은 이동에도 도시마다 결이 달라, 하루 안에서도 분위기가 분명하게 바뀝니다.',
  ],
  france_paris: [
    '상징 랜드마크와 거리가 이어지는 수도의 하루로, 걷기와 시야 확장이 균형을 이룹니다.',
    '광장·거리·전망이 자연스럽게 연결되어 도시의 결을 천천히 느끼는 구성입니다.',
  ],
  france_normandy: [
    '해안과 수도원 풍경이 이어지는, 노르망디의 여운이 길게 남는 하루입니다.',
    '이동보다 시야가 열리는 순간이 중심이 되어, 분위기가 또렷한 구성입니다.',
  ],
  france_loire: [
    '고성과 강변 풍경이 이어지는, 루아르의 걷는 리듬이 돋보이는 하루입니다.',
    '성 내부와 정원 분위기가 번갈아 이어져 여정이 부드럽게 흘러갑니다.',
  ],
  france_bordeaux: [
    '와인 마을과 강변 도시가 이어지는, 미식과 풍경이 함께하는 하루입니다.',
    '짧은 체류에도 마을과 와이너리의 분위기 차이가 분명하게 느껴지는 구성입니다.',
  ],
  france_provence: [
    '중세 성채와 구시가지가 이어지는, 프로방스의 빛과 돌결이 중심이 되는 하루입니다.',
    '실내 관람과 골목 산책이 번갈아 이어져 감각이 풍성해지는 구성입니다.',
  ],
  france_riviera: [
    '해변 산책로와 절벽 마을이 이어지는, 리비에라의 여유로운 하루입니다.',
    '바다와 언덕의 대비가 시야를 넓히며, 걷는 즐거움이 흐름의 중심이 됩니다.',
  ],
  // REGRESSION-FREEZE[lottetour-schedule-expression]: 이탈리아·영국 vibe 분화 — manifest
  italy_tuscany: [
    '중세 광장과 언덕 마을이 이어지는, 토스카나의 걷는 리듬이 돋보이는 하루입니다.',
    '짧은 이동에도 도시마다 결이 달라, 여정이 부드럽게 이어집니다.',
  ],
  italy_rome: [
    '유적과 광장이 이어지는 로마의 하루로, 역사의 밀도가 일정 리듬을 이끕니다.',
    '도심을 천천히 가로지르며 도시의 층을 쌓아 가는 구성입니다.',
  ],
  italy_venice: [
    '운하와 광장이 이어지는 베네토의 하루로, 물길 위 풍경이 중심이 됩니다.',
    '걷는 속도와 시야가 열리는 순간이 번갈아 이어져 여운이 길게 남습니다.',
  ],
  italy_amalfi: [
    '절벽 마을과 해안이 이어지는, 남이탈리아의 여유로운 하루입니다.',
    '바다와 언덕의 대비가 시야를 넓히며, 걷는 즐거움이 흐름의 중심이 됩니다.',
  ],
  italy_lakes: [
    '호수와 산자락이 맞닿은 풍경이 하루의 하이라이트로 펼쳐지는 일정입니다.',
    '이동보다 시야가 열리는 순간이 중심이 되어, 여운이 길게 남는 구성입니다.',
  ],
  italy_dolomites: [
    '봉우리와 고원 마을이 이어지는, 돌로미티의 트레킹형 하루입니다.',
    '산과 호수의 대비가 호흡을 깊게 만들며, 풍경의 리듬이 중심이 됩니다.',
  ],
  uk_london: [
    '상징 랜드마크와 거리가 이어지는 런던의 하루로, 걷기와 시야 확장이 균형을 이룹니다.',
    '광장·거리·전망이 자연스럽게 연결되어 도시의 결을 천천히 느끼는 구성입니다.',
  ],
  uk_scotland: [
    '성곽과 구시가지가 이어지는 스코틀랜드의 하루로, 역사의 밀도가 돋보입니다.',
    '짧은 체류에도 도시의 분위기 차이가 분명하게 느껴지는 구성입니다.',
  ],
  uk_ireland: [
    '항구 도시와 구시가지가 이어지는, 아일랜드의 여유로운 이동형 하루입니다.',
    '바다와 도심의 대비가 시야를 넓히며, 여정이 부드럽게 이어집니다.',
  ],
  uk_countryside: [
    '석회암 마을과 전원 풍경이 이어지는, 잉글랜드 시골의 걷는 리듬이 돋보이는 하루입니다.',
    '작은 마을들의 분위기가 자연스럽게 연결되어 여운이 길게 남습니다.',
  ],
  // REGRESSION-FREEZE[lottetour-schedule-expression]: 튀르키예 vibe 분화 — manifest
  turkey_istanbul: [
    '모스크와 궁전·골목이 이어지는 하루로, 역사의 층이 일정 리듬을 이끕니다.',
    '도심을 천천히 가로지르며 도시의 결을 쌓아 가는 구성입니다.',
  ],
  turkey_cappadocia: [
    '기암과 계곡이 이어지는 하루로, 풍경의 스케일이 중심이 됩니다.',
    '이동보다 시야가 열리는 순간이 이어져 여운이 길게 남는 구성입니다.',
  ],
  turkey_pamukkale: [
    '석회 계단과 유적이 이어지는 하루로, 하얀 풍경이 하이라이트입니다.',
    '관람과 이동이 번갈아 이어져 감각이 또렷해지는 구성입니다.',
  ],
  turkey_aegean: [
    '마을과 유적지가 이어지는 연안 하루로, 걷는 리듬이 돋보입니다.',
    '짧은 체류에도 분위기 차이가 분명하게 느껴지는 구성입니다.',
  ],
  turkey_antalya: [
    '구시가지와 해안 풍경이 이어지는 여유로운 하루입니다.',
    '바다와 유적의 대비가 시야를 넓히며 흐름의 중심이 됩니다.',
  ],
  turkey_central: [
    '호수와 초원이 이어지는 내륙 이동형 하루로, 풍경 변화가 돋보입니다.',
    '짧은 체류에도 지형의 결이 분명하게 느껴지는 구성입니다.',
  ],
  // REGRESSION-FREEZE[lottetour-schedule-expression]: 하노이·하롱 vibe — manifest
  vietnam_hanoi: [
    '호수와 사원·골목이 이어지는 하루로, 걷는 리듬이 일정 흐름을 이끕니다.',
    '도심을 천천히 가로지르며 도시의 결을 쌓아 가는 구성입니다.',
  ],
  vietnam_halong: [
    '석회 섬과 만이 이어지는 선상 하루로, 시야가 넓게 열리는 풍경이 중심입니다.',
    '유람과 짧은 상륙이 번갈아 이어져 여운이 길게 남는 구성입니다.',
  ],
  generic_tourism: [
    '하루 동안 여러 장면이 자연스럽게 이어지는, 보기와 걷기가 균형 잡힌 알찬 동선입니다.',
    '특정 장소보다 전체적인 흐름과 분위기를 중심으로 여행의 컨셉을 느끼기 좋은 일정입니다.',
  ],
}

function inferLottetourScheduleVibeProfile(day: number, maxDay: number, joinedBlob: string): LottetourScheduleVibeProfile {
  // REGRESSION-FREEZE[lottetour-schedule-expression]: 첫날 arrival·마지막날 return 고정 — manifest
  if (day === maxDay) {
    if (/사원|temple|럭키|행운|축원|기도|웡타이/i.test(joinedBlob)) return 'return_calm'
    return 'return_transit'
  }
  if (day === 1) return 'arrival'
  // REGRESSION-FREEZE[lottetour-singapore-register-quality]: 싱가포르 vibe — 전일 동일 generic 금지 — manifest
  if (/(?:유|우)니버설\s*스튜디오|Universal\s*Studios/i.test(joinedBlob)) return 'singapore_uss'
  if (
    /싱가포르|Singapore|가든스|Gardens\s*by|센토사|Sentosa|머르?라이언|Merlion|버드\s*파라다이스/i.test(
      joinedBlob,
    )
  ) {
    return 'singapore_gardens'
  }
  if (/밀포드|Milford|피요르드|fiord|호머\s*터널|마이터/i.test(joinedBlob)) return 'fiord_cruise'
  if (/포트\s*스테판|Port\s*Stephens|모래썰매|샌드보드|4WD|사륜|돌핀\s*크루즈/i.test(joinedBlob)) {
    return 'desert_coast'
  }
  if (/로토루아|Rotorua|와이아리키|와카?레와레와|온천|지열|마오리/i.test(joinedBlob)) return 'thermal_spa'
  if (
    /블루\s*마운틴|Blue\s*Mountain|마운트\s*쿡|Mount\s*Cook|트레킹|글래시어|캐슬힐|케즘|허니문\s*브릿지/i.test(
      joinedBlob,
    )
  ) {
    return 'nature_trek'
  }
  if (/할슈타트|Hallstatt|짤즈?\s*캄머|Salzkammergut|잘츠부르크|Salzburg|잘쯔/i.test(joinedBlob)) {
    return 'alpine_lake'
  }
  if (/프라하|Prague|Praha|카를\s*교|프라하\s*성|천문\s*시계/i.test(joinedBlob)) return 'prague_old_town'
  if (/부다페스트|Budapest|브라티슬라|Bratislava|비엔나|Vienna|Wien|다뉴브|Danube/i.test(joinedBlob)) {
    return 'danube_cities'
  }
  // REGRESSION-FREEZE[lottetour-schedule-expression]: 독일 일주 vibe 분화 — manifest
  if (
    /노이슈반슈타인|Neuschwanstein|헤렌킴제|Herrenchiemsee|퓌센|F[uü]ssen|킴제|Chiemsee/i.test(
      joinedBlob,
    )
  ) {
    return 'germany_castles'
  }
  if (/뤼데스하임|R[uü]desheim|라인\s*강|Rhine/i.test(joinedBlob)) return 'germany_rhine'
  if (/로텐부르크|Rothenburg|로맨틱\s*가도/i.test(joinedBlob)) return 'germany_romantic_road'
  if (/베를린|Berlin|포츠담|Potsdam|브란덴부르크|체칠리엔호프|상수시|Sanssouci/i.test(joinedBlob)) {
    return 'germany_berlin'
  }
  if (
    /뉘른베르크|Nuremberg|N[uü]rnberg|밤베르크|Bamberg|드레스덴|Dresden/i.test(joinedBlob)
  ) {
    return 'germany_medieval'
  }
  // REGRESSION-FREEZE[lottetour-schedule-expression]: 이탈리아·영국 vibe 분화 — manifest
  // 「베니스」 안의 「니스」 substring → 프랑스 리비에라 오매칭 금지
  if (
    /돌로미|Dolomit|오르티세이|Ortisei|코르티나|Cortina|볼차노|Bolzano|세시다|Seceda|트레\s*치메/i.test(
      joinedBlob,
    )
  ) {
    return 'italy_dolomites'
  }
  if (/꼬모|Como|가르다|Garda|마조레|Maggiore/i.test(joinedBlob)) return 'italy_lakes'
  if (/소렌토|Sorrento|나폴리|Naples|폼페이|Pompeii|아말피|Amalfi/i.test(joinedBlob)) {
    return 'italy_amalfi'
  }
  if (
    /피사|Pisa|시에나|Siena|피렌|플로렌스|Florence|Firenze|친퀘|Cinque\s*Terre|몬테카티니|Montecatini/i.test(
      joinedBlob,
    )
  ) {
    return 'italy_tuscany'
  }
  if (/베니스|Venice|Venezia|베로나|Verona|산\s*마르코/i.test(joinedBlob)) return 'italy_venice'
  if (/로마|Rome|Roma|바티칸|Vatican|콜로세|Colosseum|트레비|Trevi/i.test(joinedBlob)) {
    return 'italy_rome'
  }
  if (/에딘버러|Edinburgh|윈더미어|Windermere|글라스미어|Grasmere|스코틀랜드|Scotland/i.test(joinedBlob)) {
    return 'uk_scotland'
  }
  if (/벨파스트|Belfast|더블린|Dublin|아일랜드|Ireland/i.test(joinedBlob)) return 'uk_ireland'
  if (
    /옥스포드|Oxford|스트래트포드|Stratford|바스|Bath|솔즈베리|Salisbury|코츠월드|Cotswold|바이버리|Bibury|리버풀|Liverpool|체스터|Chester/i.test(
      joinedBlob,
    )
  ) {
    return 'uk_countryside'
  }
  if (/(?:^|[\s\-·,/])런던(?:$|[\s\-·,/])|London|타워\s*브릿지|빅벤|Big\s*Ben/i.test(joinedBlob)) {
    return 'uk_london'
  }
  // REGRESSION-FREEZE[lottetour-schedule-expression]: 프랑스 일주 vibe 분화 — manifest
  if (
    /(?:^|[\s\-·,/])니스(?:$|[\s\-·,/])|\bNice\b|모나코|Monaco|에즈|Eze|프롬나드|Promenade|(?:프랑스\s*)?리비에라|French\s*Riviera/i.test(
      joinedBlob,
    )
  ) {
    return 'france_riviera'
  }
  if (
    /빛의\s*채석|Carrieres?\s*des\s*Lumieres|아비뇽|Avignon|카르카손|Carcassonne|프로방스|Provence|레\s*보|Les\s*Baux|생폴드방스/i.test(
      joinedBlob,
    )
  ) {
    return 'france_provence'
  }
  if (/생테밀리옹|Saint[\s-]*Emilion|보르도|Bordeaux|와이너리/i.test(joinedBlob)) {
    return 'france_bordeaux'
  }
  if (/루아르|Loire|쉬농소|Chenonceau|앙부|Amboise/i.test(joinedBlob)) {
    return 'france_loire'
  }
  if (
    /에펠|Eiffel|개선문|오르세|Orsay|샹젤리제|루브르|Louvre|(?:^|[\s\-])파리(?:$|[\s\-])/i.test(
      joinedBlob,
    )
  ) {
    return 'france_paris'
  }
  if (/몽생미셸|Mont\s*Saint\s*Michel|지베르니|Giverny|노르망디|Normandy/i.test(joinedBlob)) {
    return 'france_normandy'
  }
  if (/마카오|macau|베네시an|세나도|코타이|유네스코/i.test(joinedBlob)) return 'macau_daytrip'
  if (/소호|soho|센트럴|central|헐리우드|hollywood|mid-?level|완차이|wan\s*chai|리퉁/i.test(joinedBlob)) {
    return 'hk_walking'
  }
  // REGRESSION-FREEZE[lottetour-schedule-expression]: 튀르키예 vibe 분화 — manifest
  if (/카파도키아|Cappadocia|괴레메|Goreme|데린쿠유|우치히사르|데브란트/i.test(joinedBlob)) {
    return 'turkey_cappadocia'
  }
  if (/파묵칼레|Pamukkale|히에라폴리스|Hierapolis/i.test(joinedBlob)) {
    return 'turkey_pamukkale'
  }
  if (/쉬린제|Sirince|에페소|Ephesus|아이발릭|Ayvalik/i.test(joinedBlob)) {
    return 'turkey_aegean'
  }
  if (/안탈리아|Antalya|오브룩|Obruk|올림포스|Olympos/i.test(joinedBlob)) {
    return 'turkey_antalya'
  }
  if (/이스탄불|Istanbul|성\s*소피아|Hagia|돌마바흐|Dolmabahce|지하물궁전|톱카프|Topkapi|보스포러스|Bosphorus|부르사|Bursa/i.test(joinedBlob)) {
    return 'turkey_istanbul'
  }
  if (/투즈골다|Lake\s*Tuz|앙카라|Ankara|콘야/i.test(joinedBlob)) {
    return 'turkey_central'
  }
  // REGRESSION-FREEZE[lottetour-schedule-expression]: 하노이·하롱 vibe — manifest
  if (/하롱|Halong|Ha\s*Long|티톱|Ti\s*Top|석회\s*동굴|Surprise\s*Cave/i.test(joinedBlob)) {
    return 'vietnam_halong'
  }
  if (/하노이|Hanoi|쩐꾸옥|바딘|한기둥|호안끼엠|옌뜨|Yen\s*Tu/i.test(joinedBlob)) {
    return 'vietnam_hanoi'
  }
  if (/피크|peak|하버|harbor|빅토리아|전망|야경|스타\s*페리|침사|오페라|본다이|시드니/i.test(joinedBlob)) {
    return 'harbor_skyline'
  }
  if (/사원|temple|럭키|웡타이/i.test(joinedBlob)) return 'spiritual_calm'
  return 'generic_tourism'
}

function lottetourHighlightLeakChunks(label: string): string[] {
  const bare = label.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  const chunks = bare
    .split(/[,，·]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
  return [...new Set([bare, ...chunks].filter((s) => s.length >= 4))]
}

/** vibe filler 감지 — plan_info 원문과 구분 */
export function isLottetourVibeFillerDescription(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return true
  return /하루 동안 여러 장면이 자연스럽게|특정 장소보다 전체적인 흐름과 분위기|정원·전망·해안이 이어지는 핵심 동선|테마파크 하루 자유 일정으로|홍콩의 세련된 번화가부터|스카이라인과 바다 풍경이 어우러지는|현지 도착 후 첫날, 도시의 리듬|여유로운 마무리 관광 뒤 귀국|현지를 정리하고 귀국길로|대자연의 스케일을 천천히|절벽과 바다가 맞닿은 피요르드|바다와 모래 언덕이 맞닿은|지열·온천 지대의 독특한|중세 골목과 광장이 이어지는|강변 도시들이 이어지는|호수와 산자락이 맞닿은|강변 언덕과 와인 마을이 이어지는|중세 골목과 성벽 마을이 이어지는|성곽과 호수가 이어지는 바이에른|광장과 기념비가 이어지는 수도|성벽·광장·구시가지가 이어지는 중세형|상징 랜드마크와 거리가 이어지는 수도|해안과 수도원 풍경이 이어지는|고성과 강변 풍경이 이어지는|와인 마을과 강변 도시가 이어지는|중세 성채와 구시가지가 이어지는|해변 산책로와 절벽 마을이 이어지는|모스크와 궁전·골목이 이어지는|기암과 계곡이 이어지는|석회 계단과 유적이 이어지는|마을과 유적지가 이어지는|구시가지와 해안 풍경이 이어지는|호수와 초원이 이어지는|호수와 사원·골목이 이어지는|석회 섬과 만이 이어지는/u.test(
    t,
  )
}

/** plan_info `[명소]` 라벨만 route 후보 — 산문 덤프는 routeText에 넣지 않음 */
export function extractLottetourBracketPlacesFromText(text: string | null | undefined): string[] {
  const out: string[] = []
  for (const m of String(text ?? '').matchAll(/\[([^\]]{2,36})\]/g)) {
    const t = m[1]?.trim()
    if (!t) continue
    if (
      /조식|중식|석식|특전|시차|국가번호|관광\s*시간|호텔식|가족관계|증명서|면세|포함\s*일정|가정식|쌀국수|갑오징어|\bSET\b|세트$|약\s*\d+|소요|편\s*이용/i.test(
        t,
      )
    ) {
      continue
    }
    out.push(t)
  }
  return dedupeLottetourScheduleRoutePlaces(out)
}

function splitLottetourPlanInfoSentences(raw: string): string[] {
  return raw
    .split(/(?<=[.!?。])\s+|[·•]\s+|\s{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
}

/**
 * plan_info 마케팅·특전 줄 필터 (route/profile 근거용).
 * 일정설명(description)에는 쓰지 않음 — vibe SSOT.
 */
export function summarizeLottetourPlanInfoForDescription(
  planInfoRaw: string | null | undefined,
): string | null {
  const raw = String(planInfoRaw ?? '')
    .replace(/\r/g, '\n')
    .replace(/[★☆◈◎○▪▶●◇◆]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (raw.length < 24) return null
  if (isLottetourVibeFillerDescription(raw)) return null
  if (registerScheduleDescriptionHasMarketingNoise(raw) && !/\[[^\]]{2,48}\]/.test(raw)) {
    return null
  }

  const kept = splitLottetourPlanInfoSentences(raw).filter((s) => !isRegisterSchedulePlanInfoMarketingLine(s))
  let body = kept.join(' ').trim()
  if (body.length < 24) {
    const bracketChunks = [...raw.matchAll(/\[[^\]]{2,48}\][^.!?]{0,120}[.!?]?/g)]
      .map((m) => m[0]?.trim())
      .filter((c): c is string => Boolean(c) && !isRegisterSchedulePlanInfoMarketingLine(c))
    if (bracketChunks.length > 0) body = bracketChunks.join(' ').trim()
  }
  if (body.length < 24) return null
  if (registerScheduleDescriptionHasMarketingNoise(body)) return null
  if (
    /^(?:포함\s*일정|조식|중식|석식|운항\s*소요|호텔식|기내식|자유식|특식)/u.test(body) &&
    body.length < 72
  ) {
    return null
  }
  const capped = splitLottetourPlanInfoSentences(body).slice(0, 3).join(' ').trim()
  return (capped.length >= 24 ? capped : body).slice(0, 320).trim()
}

/** 분위기·흐름 2~3문장 (장소 디테일 금지) */
export function composeLottetourScheduleVibeSentences(
  day: number,
  maxDay: number,
  routePlaces: readonly string[],
  joinedBlob: string,
): string {
  const profile = inferLottetourScheduleVibeProfile(day, maxDay, joinedBlob)
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: region vibe before generic — manifest
  if (profile === 'generic_tourism') {
    const regional = composeRegisterScheduleExtendedRegionVibeDescription(routePlaces, joinedBlob)
    if (regional) return regional
  }
  const sentences = [...LOTTETOUR_SCHEDULE_VIBE_DESCRIPTIONS[profile]].slice(0, 3)
  let desc = sentences.join(' ')
  for (const h of routePlaces) {
    for (const chunk of lottetourHighlightLeakChunks(h)) {
      if (desc.includes(chunk)) {
        const regional = composeRegisterScheduleExtendedRegionVibeDescription(routePlaces, joinedBlob)
        desc =
          regional ||
          LOTTETOUR_SCHEDULE_VIBE_DESCRIPTIONS.generic_tourism.slice(0, 2).join(' ')
        break
      }
    }
  }
  if (isRegisterScheduleGenericTourismDescription(desc)) {
    const regional = composeRegisterScheduleExtendedRegionVibeDescription(routePlaces, joinedBlob)
    if (regional) return regional
  }
  return desc.slice(0, 320).trim()
}

/**
 * description SSOT — 분위기·흐름 2~3문장만.
 * plan_info는 joinedBlob(profile)·route `[명소]` 추출에만 쓰고 본문에 넣지 않음.
 * REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: description은 vibe 2~3문장 (plan_info는 route·profile 근거) — manifest
 */
export function composeLottetourScheduleDescription(opts: {
  day: number
  maxDay: number
  routePlaces: readonly string[]
  joinedBlob: string
  planInfoRaw?: string | null
}): string {
  const profileBlob = [opts.joinedBlob, opts.planInfoRaw].filter(Boolean).join('\n')
  const vibe = composeLottetourScheduleVibeSentences(
    opts.day,
    opts.maxDay,
    opts.routePlaces,
    profileBlob,
  )
  return vibe || `${opts.day}일차`
}

export function lottetourFactDaysToRegisterSchedule(days: RegisterFactScheduleDay[]): RegisterScheduleDay[] {
  const maxDay = days.reduce((m, d) => Math.max(m, d.day), 0)
  return days.map((d) => {
    const fromNote = extractLottetourBracketPlacesFromText(d.transportNote)
    const routePlaces = dedupeLottetourScheduleRoutePlaces([...d.places, ...fromNote])
    const routeText = joinLottetourScheduleRouteText(routePlaces)
    const joinedBlob = [d.transportNote, routeText, ...routePlaces, ...d.places].filter(Boolean).join(' ')
    // REGRESSION-FREEZE[register-schedule-day-title-ssot]: short title from route — manifest
    const title = composeRegisterScheduleDayTitleFromRoute({
      day: d.day,
      maxDay,
      routeText,
      fallbacks: [d.hotels[0]],
      returnTitle: '귀국',
    })
    const description = composeLottetourScheduleDescription({
      day: d.day,
      maxDay,
      routePlaces,
      joinedBlob,
      planInfoRaw: d.transportNote,
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

/** 등록 schedule[] — routeText 보정 · description은 항상 vibe 재작성 */
export function applyLottetourScheduleExpressionToRows<T extends RegisterScheduleDay>(rows: T[]): T[] {
  const maxDay = rows.reduce((m, r) => Math.max(m, Number(r.day) || 0), 0)
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const fromRoute = row.routeText ? dedupeLottetourScheduleRoutePlaces(row.routeText.split(/\s*-\s*/)) : []
    const existingDesc = String(row.description ?? '').trim()
    // 산문 plan_info 덤프를 route로 쪼개지 않음 — [명소]·기존 route만
    const fromBrackets = extractLottetourBracketPlacesFromText(existingDesc)
    const routePlaces = dedupeLottetourScheduleRoutePlaces([...fromRoute, ...fromBrackets])
    // join 내부 sanitize — 전부 noise면 null (dirty row.routeText 되살리기 금지)
    const routeText = joinLottetourScheduleRouteText(routePlaces)
    const joinedBlob = [row.title, existingDesc, routeText].filter(Boolean).join('\n')
    // REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: description은 vibe 2~3문장 (plan_info는 route·profile 근거) — manifest
    const description = composeLottetourScheduleDescription({
      day,
      maxDay,
      routePlaces,
      joinedBlob,
      planInfoRaw: isLottetourVibeFillerDescription(existingDesc) ? null : existingDesc,
    })
    // REGRESSION-FREEZE[register-schedule-day-title-ssot]: short title from route — manifest
    const title = composeRegisterScheduleDayTitleFromRoute({
      day,
      maxDay,
      routeText,
      fallbacks: [row.title],
      returnTitle: '귀국',
    })
    return { ...row, routeText, description, title }
  })
}
