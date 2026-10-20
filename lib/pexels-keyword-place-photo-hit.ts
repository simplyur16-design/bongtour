/**
 * imageKeyword → Pexels 결과가 「실제 그 장소」인지 판정 (언어 무관: 정규화 후 검증).
 * REGRESSION-FREEZE[register-pre-photo-pexels-keyword-must-hit]: 0건·오장소 모두 miss — manifest
 */
import {
  finalizeScheduleImageKeyword,
  isBareCityOrCountryKeyword,
  isLikelyTourismLandmarkKeyword,
  isScheduleImageKeywordLandmarkEligible,
  normalizeToPlaceName,
} from '@/lib/pexels-place-name-keyword'
import { firstMatchingSchedulePoiEn } from '@/lib/schedule-poi-regex-ssot'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'

/** 장소 고유명으로 쓰기 어려운 장면·수식 토큰 */
const SCENE_STOPWORDS = new Set([
  'white',
  'walled',
  'wall',
  'walls',
  'storehouse',
  'storehouses',
  'warehouse',
  'warehouses',
  'lumber',
  'street',
  'streets',
  'view',
  'views',
  'night',
  'scenic',
  'landscape',
  'landscapes',
  'travel',
  'tour',
  'photo',
  'photograph',
  'skyline',
  'cityscape',
  'aerial',
  'exterior',
  'interior',
  'facade',
  'architecture',
  'building',
  'buildings',
  'old',
  'town',
  'city',
  'historic',
  'ancient',
  'beautiful',
  'famous',
  'traditional',
  'modern',
  'coastal',
  'tropical',
  'urban',
  'rural',
  'nature',
  'park',
  'garden',
  'beach',
  'temple',
  'shrine',
  'palace',
  'castle',
  'museum',
  'bridge',
  'tower',
  'market',
  'square',
  'plaza',
  'harbour',
  'harbor',
  'island',
  'lake',
  'river',
  'mountain',
  'mountains',
  'hill',
  'hills',
  'road',
  'avenue',
  'the',
  'of',
  'and',
  'at',
  'in',
  'on',
  'de',
  'la',
  'le',
  'el',
])

const GEO_TAG_RULES: ReadonlyArray<{ tag: string; re: RegExp }> = [
  {
    tag: 'japan',
    re: /\b(japan|tokyo|osaka|kyoto|hokkaido|okinawa|tottori|kurayoshi|shirakabe|nara|nagoya|fukuoka|yokohama|hiroshima|beppu|yufuin|yonago|matsue|shimane|izumo|nagasaki|kanazawa|hakone|nikko|sapporo|dozogun|akagawara)\b/i,
  },
  {
    tag: 'usa',
    re: /\b(usa|u\.s\.a\.|united\s+states|california|newhall|los\s+angeles|new\s+york|texas|florida|chicago|nevada|arizona|utah|seattle|boston|miami|hollywood(?!\s+road)|lumber\s+yard|lumber\s+company)\b/i,
  },
  {
    tag: 'korea',
    re: /\b(korea|seoul|busan|jeju|incheon|gangnam|myeongdong)\b/i,
  },
  {
    tag: 'france',
    re: /\b(france|paris|lyon|marseille|nice|eiffel|louvre|bordeaux|provence)\b/i,
  },
  {
    tag: 'italy',
    re: /\b(italy|rome|venice|florence|milan|naples|pisa|tuscany|colosseum|vatican)\b/i,
  },
  {
    tag: 'china',
    re: /\b(china|beijing|shanghai|guangzhou|shenzhen|xian|hangzhou|chengdu|forbidden\s+city)\b/i,
  },
  {
    tag: 'taiwan',
    re: /\b(taiwan|taipei|jiufen|kaohsiung|tainan|sun\s+moon\s+lake)\b/i,
  },
  {
    tag: 'thailand',
    re: /\b(thailand|bangkok|phuket|chiang\s+mai|pattaya|ayutthaya|wat\s+arun)\b/i,
  },
  {
    tag: 'vietnam',
    re: /\b(vietnam|hanoi|da\s+nang|danang|hoi\s+an|ho\s+chi\s+minh|nha\s+trang|halong|ha\s+long)\b/i,
  },
  {
    tag: 'hongkong',
    re: /\b(hong\s+kong|victoria\s+peak|lantau|tsim\s+sha\s+tsui|hollywood\s+road)\b/i,
  },
  {
    tag: 'singapore',
    re: /\b(singapore|marina\s+bay|gardens\s+by\s+the\s+bay|merlion|sentosa)\b/i,
  },
  {
    tag: 'uk',
    re: /\b(england|london|scotland|edinburgh|manchester|liverpool|big\s+ben|thames)\b/i,
  },
  {
    tag: 'australia',
    re: /\b(australia|sydney|melbourne|brisbane|perth|uluru|great\s+barrier)\b/i,
  },
  {
    tag: 'uae',
    re: /\b(dubai|abu\s+dhabi|uae|united\s+arab|burj\s+khalifa|sheikh\s+zayed)\b/i,
  },
  {
    tag: 'turkey',
    re: /\b(turkey|t[uü]rkiye|istanbul|cappadocia|antalya|pamukkale)\b/i,
  },
]

export type PexelsPlacePhotoSample = {
  alt?: string | null
  url?: string | null
}

export type PexelsPlacePhotoHitVerdict = {
  ok: boolean
  reason: 'ok' | 'empty' | 'no_place_identity' | 'blocked' | 'unresolved_script' | 'wrong_place'
  searchKeyword: string
}

/** 한글·한자 등 — Pexels 검색 전 영문 장소명으로 풀려야 함 */
function hasUnresolvedNonLatinScript(s: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(s)
}

export function resolvePexelsImageKeywordForSearch(raw: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  try {
    const fin = finalizeScheduleImageKeyword(t)
    if (fin && !hasUnresolvedNonLatinScript(fin)) return fin
  } catch {
    /* assertCleanPlaceKeyword */
  }
  const normalized = normalizeToPlaceName(t)
  if (normalized && !hasUnresolvedNonLatinScript(normalized)) return normalized
  // 한글·한자 키워드 — POI/도시 SSOT로 영문 장소명 해석 (아부다비→Abu Dhabi)
  if (hasUnresolvedNonLatinScript(t)) {
    const poi = firstMatchingSchedulePoiEn(t)
    if (poi) {
      try {
        const fin = finalizeScheduleImageKeyword(poi)
        if (fin) return fin
      } catch {
        /* */
      }
      const n = normalizeToPlaceName(poi)
      if (n) return n
      return poi
    }
  }
  return normalized || t
}

export function geoTagsFromText(text: string): Set<string> {
  const t = String(text ?? '')
  const out = new Set<string>()
  for (const { tag, re } of GEO_TAG_RULES) {
    if (re.test(t)) out.add(tag)
  }
  return out
}

/** 키워드 지오와 사진 메타 지오가 겹치지 않고 사진만 다른 권역이면 오장소 */
export function pexelsHaystackConflictsWithKeywordGeo(keyword: string, haystack: string): boolean {
  const k = geoTagsFromText(keyword)
  const p = geoTagsFromText(haystack)
  if (k.size === 0 || p.size === 0) return false
  for (const tag of k) {
    if (p.has(tag)) return false
  }
  return true
}

export function distinctivePlaceTokensFromImageKeyword(keyword: string): string[] {
  const n = resolvePexelsImageKeywordForSearch(keyword) || String(keyword ?? '').trim()
  if (!n) return []
  const words = n.split(/[\s,/|·]+/).map((w) => w.trim()).filter(Boolean)
  const out: string[] = []
  for (const w of words) {
    const bare = w.replace(/[^A-Za-z0-9\-']/g, '')
    if (!bare) continue
    const lower = bare.toLowerCase()
    if (SCENE_STOPWORDS.has(lower)) continue
    if (bare.length < 3) continue
    // 3글자는 고유명(Arun·Bay)만 — 전부 소문자 일반어면 스킵
    if (bare.length === 3 && bare === lower) continue
    out.push(bare)
  }
  return out
}

export function imageKeywordHasPlaceIdentity(keyword: string): boolean {
  const search = resolvePexelsImageKeywordForSearch(keyword)
  if (!search) return false
  if (isBlockedScheduleImageKeyword(keyword) || isBlockedScheduleImageKeyword(search)) return false
  if (hasUnresolvedNonLatinScript(search)) return false
  // Tower Bridge·Yu Garden·Ba Na Hills — landmark hint/고유명은 장소성 있음
  if (isScheduleImageKeywordLandmarkEligible(search)) return true
  if (isLikelyTourismLandmarkKeyword(search)) return true
  // Paris·Tokyo 맨도시도 Pexels 실장소 검색 가능 (스케줄 landmark 품질 가드와 분리)
  if (isBareCityOrCountryKeyword(search)) return true
  return distinctivePlaceTokensFromImageKeyword(search).length > 0
}

function sampleHaystack(s: PexelsPlacePhotoSample): string {
  return `${String(s.alt ?? '')} ${String(s.url ?? '')}`
}

/**
 * API 없이 샘플(alt·url)만으로 장소 적합성 판정 — vitest SSOT.
 */
export function evaluatePexelsKeywordPlacePhotoSamples(
  keyword: string,
  samples: readonly PexelsPlacePhotoSample[],
): PexelsPlacePhotoHitVerdict {
  const searchKeyword = resolvePexelsImageKeywordForSearch(keyword)
  if (!searchKeyword) {
    return { ok: false, reason: 'empty', searchKeyword: '' }
  }
  if (isBlockedScheduleImageKeyword(keyword) || isBlockedScheduleImageKeyword(searchKeyword)) {
    return { ok: false, reason: 'blocked', searchKeyword }
  }
  if (hasUnresolvedNonLatinScript(searchKeyword)) {
    return { ok: false, reason: 'unresolved_script', searchKeyword }
  }
  if (!imageKeywordHasPlaceIdentity(searchKeyword)) {
    return { ok: false, reason: 'no_place_identity', searchKeyword }
  }
  if (!samples.length) {
    return { ok: false, reason: 'empty', searchKeyword }
  }

  const tokens = distinctivePlaceTokensFromImageKeyword(searchKeyword).map((t) => t.toLowerCase())
  let tokenHits = 0
  let conflicts = 0
  for (const s of samples) {
    const hay = sampleHaystack(s)
    if (!hay.trim()) continue
    if (pexelsHaystackConflictsWithKeywordGeo(searchKeyword, hay)) conflicts += 1
    const lower = hay.toLowerCase()
    if (tokens.some((t) => lower.includes(t))) tokenHits += 1
  }

  // 키워드 장소 토큰이 상위 결과에 1장이라도 있으면 통과
  // (Tokyo Disneyland 결과에 Disneyland Paris가 섞여도 Tokyo 컷이 있으면 OK)
  if (tokenHits >= 1) {
    return { ok: true, reason: 'ok', searchKeyword }
  }

  // 장소 토큰 0 + 오권역 과반 → 거절 (Kurayoshi → Newhall Lumber)
  if (conflicts >= 2 && conflicts >= Math.ceil(samples.length / 2)) {
    return { ok: false, reason: 'wrong_place', searchKeyword }
  }
  // 장소 토큰 0 + 오권역 신호 1+ → 거절
  if (conflicts >= 1) {
    return { ok: false, reason: 'wrong_place', searchKeyword }
  }

  return { ok: true, reason: 'ok', searchKeyword }
}
