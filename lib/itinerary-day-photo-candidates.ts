/**
 * process-images 일정 슬롯(대표 사진 1~4)용 검색어 후보 — 일차별 핵심 POI 우선.
 * 2차 분류 등은 사용하지 않음.
 */

import {
  extractLatinPhraseFromTitle,
  firstPoiSearchTermExcluding,
  mapDestination,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
  sanitizeAttractionPhrase,
} from '@/lib/pexels-keyword'

export type DayPhotoCandidateOrigin =
  | 'poi_raw'
  | 'summary_text'
  | 'raw_block'
  | 'schedule_image_keyword'
  | 'schedule_title'
  | 'schedule_description'
  | 'city_landmark'
  | 'destination_landmark'
  | 'destination_attraction'
  | 'pool'
  | 'fallback'

export type DayPhotoCandidate = {
  semanticKey: string
  attractionPart: string
  origin: DayPhotoCandidateOrigin
}

export function isPoiFirstOrigin(origin: DayPhotoCandidateOrigin): boolean {
  return (
    origin === 'poi_raw' ||
    origin === 'summary_text' ||
    origin === 'raw_block' ||
    origin === 'schedule_image_keyword' ||
    origin === 'schedule_title' ||
    origin === 'schedule_description'
  )
}

function extractPoiHintFromSummary(summaryTextRaw: string | null | undefined, excludeKeys: Set<string>): string | null {
  if (!summaryTextRaw?.trim()) return null
  const t = summaryTextRaw.trim()
  for (const seg of splitPoiSegments(t)) {
    const mappedSeg = mapKoreanPoiSegment(seg)
    if (mappedSeg) {
      const q = sanitizeAttractionPhrase(mappedSeg)
      if (q && !excludeKeys.has(normalizeSemanticPoiKey(q))) return q
    }
    const latinSeg = extractLatinPhraseFromTitle(seg)
    if (latinSeg && !excludeKeys.has(normalizeSemanticPoiKey(latinSeg))) return latinSeg
  }
  const mapped = mapKoreanPoiSegment(t)
  if (mapped) {
    const q = sanitizeAttractionPhrase(mapped)
    if (q && !excludeKeys.has(normalizeSemanticPoiKey(q))) return q
  }
  const latin = extractLatinPhraseFromTitle(t)
  if (latin && !excludeKeys.has(normalizeSemanticPoiKey(latin))) return latin
  return null
}

function splitPoiSegments(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  return text
    .replace(/\r/g, '\n')
    .split(/[,\n|/;，·→>\-]/)
    .map((s) => s.replace(/["'`[\](){}]/g, ' ').trim())
    .map((s) => s.replace(/\s+/g, ' '))
    .filter((s) => s.length >= 2 && s.length <= 40)
}

function parsePoiLikeTermsFromRawBlock(rawBlock: string | null | undefined, excludeKeys: Set<string>): string[] {
  if (!rawBlock?.trim()) return []
  const picked: string[] = []
  const seen = new Set<string>()
  const maybeJson = rawBlock.trim()
  const source =
    maybeJson.startsWith('{') || maybeJson.startsWith('[')
      ? (() => {
          try {
            const j = JSON.parse(maybeJson) as Record<string, unknown>
            return [
              String(j.title ?? ''),
              String(j.description ?? ''),
              String(j.imageKeyword ?? ''),
              Array.isArray(j.items) ? j.items.map((x) => String(x ?? '')).join(', ') : '',
            ]
              .filter(Boolean)
              .join(', ')
          } catch {
            return rawBlock
          }
        })()
      : rawBlock

  for (const seg of splitPoiSegments(source)) {
    if (/(공항|출발|도착|미팅|호텔|체크인|체크아웃|조식|중식|석식|자유일정|쇼핑)/.test(seg)) continue
    const mapped = mapKoreanPoiSegment(seg)
    const candidate = mapped ? sanitizeAttractionPhrase(mapped) : sanitizeAttractionPhrase(seg)
    if (!candidate) continue
    const sk = normalizeSemanticPoiKey(candidate)
    if (excludeKeys.has(sk) || seen.has(sk)) continue
    // 영문/매핑 명소 우선, 일반 문장은 제외
    const looksLikePoi = Boolean(mapped) || /[a-z]/i.test(candidate)
    if (!looksLikePoi) continue
    seen.add(sk)
    picked.push(candidate)
    if (picked.length >= 3) break
  }
  return picked
}

function pushCandidate(
  out: DayPhotoCandidate[],
  attractionPart: string,
  origin: DayPhotoCandidateOrigin,
  excludeKeys: Set<string>
): void {
  const part = sanitizeAttractionPhrase(attractionPart)
  if (!part) return
  const sk = normalizeSemanticPoiKey(part)
  if (excludeKeys.has(sk)) return
  if (out.some((o) => o.semanticKey === sk)) return
  out.push({ semanticKey: sk, attractionPart: part, origin })
}

/**
 * 한 일차에 대해 Pexels/Gemini 검색에 쓸 attraction 후보를 우선순위 순으로 나열.
 * excludeKeys: 이전 일차에서 이미 사용한 semantic key(동일·유사 장소 반복 방지).
 */
export function buildItineraryDayPhotoCandidates(opts: {
  destination: string
  city: string | null
  poiNamesRaw?: string | null
  summaryTextRaw?: string | null
  rawBlock?: string | null
  scheduleTitle?: string
  scheduleDescription?: string
  scheduleImageKeyword?: string
  excludeKeys: Set<string>
}): DayPhotoCandidate[] {
  const {
    destination,
    city,
    summaryTextRaw,
    rawBlock,
    scheduleTitle,
    scheduleDescription,
    scheduleImageKeyword,
    excludeKeys,
  } = opts
  const out: DayPhotoCandidate[] = []

  const fromPoi = firstPoiSearchTermExcluding(opts.poiNamesRaw, excludeKeys)
  if (fromPoi) pushCandidate(out, fromPoi, 'poi_raw', excludeKeys)

  const fromSummary = extractPoiHintFromSummary(summaryTextRaw, excludeKeys)
  if (fromSummary) pushCandidate(out, fromSummary, 'summary_text', excludeKeys)

  const fromRawBlock = parsePoiLikeTermsFromRawBlock(rawBlock, excludeKeys)
  for (const rawPoi of fromRawBlock) {
    pushCandidate(out, rawPoi, 'raw_block', excludeKeys)
  }

  const kw = (scheduleImageKeyword ?? '').trim()
  if (kw) {
    const mapped = mapKoreanPoiSegment(kw)
    const part = mapped ? sanitizeAttractionPhrase(mapped) : sanitizeAttractionPhrase(kw)
    if (part) pushCandidate(out, part, 'schedule_image_keyword', excludeKeys)
  }

  const titleLatin = extractLatinPhraseFromTitle((scheduleTitle ?? '').trim() || null)
  if (titleLatin) pushCandidate(out, titleLatin, 'schedule_title', excludeKeys)

  const descLatin = extractLatinPhraseFromTitle((scheduleDescription ?? '').trim() || null)
  if (descLatin) pushCandidate(out, descLatin, 'schedule_description', excludeKeys)

  const destEn = mapDestination(destination)
  const cityEn = mapDestination(city) || ''
  const cityLandmark = cityEn ? `${cityEn} landmark` : ''
  const destLandmark = destEn ? `${destEn} landmark` : ''

  if (cityLandmark) pushCandidate(out, cityLandmark, 'city_landmark', excludeKeys)
  if (destLandmark) {
    if (!cityLandmark || normalizeSemanticPoiKey(cityLandmark) !== normalizeSemanticPoiKey(destLandmark)) {
      pushCandidate(out, destLandmark, 'destination_landmark', excludeKeys)
    }
  }
  if (destEn) pushCandidate(out, `${destEn} attraction`, 'destination_attraction', excludeKeys)

  return out
}
