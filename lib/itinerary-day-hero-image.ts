/**
 * ItineraryDay 기준 일차별 대표 이미지 1장 — Pexels 실사 우선, Gemini/Imagen은 fallback.
 * 파이프라인: 방문지 추출 → 정규화 → 대표 장소 1개 → Pexels 다중 후보 → 휴리스틱 평가 → (부적합 시) 생성.
 *
 * 정책: 하루 일정에 여러 방문지가 있거나, 한 구역·테마파크 안에 어트랙션이 여러 개여도
 * **그날을 대표하는 한 가지(가장 상징적인 한 요소)**만 고른 뒤, 그 한 곳만으로 검색·생성한다.
 * 복합 시설은 보통 `mapKoreanPoiSegment`·점수로 단일 stem(예: USJ 전체)으로 묶이며, 이미지도 그 대표 한 컷만 만든다.
 *
 * 이미지 목적: **경치·절경·파노라마**가 아니어도 된다. 그 관광지가 사람들에게 통상적으로 기억되는 **대표적인 모습**
 * (정문·랜드마크 각도·골목·야경 등 그 명소답게 보이는 한 컷)을 찾는 것이 우선이다.
 */

import type { PrismaClient } from '@prisma/client'
import {
  fetchPexelsPhotoObject,
  isPexelsFallbackUrl,
  searchPexelsHeroCandidates,
  type PexelsHeroCandidateMeta,
} from '@/lib/pexels-service'
import { generateImageWithGemini } from '@/lib/gemini-image-generate'
import {
  IMAGEN_ITINERARY_DAY_HERO_CONSTRAINTS,
  ITINERARY_DAY_HERO_REGENERATE_PROMPT_EN,
} from '@/lib/image-style'
import { savePhotoFromUrl, savePhotoToPool, type PoolPhotoRecord } from '@/lib/photo-pool'
import { buildHeroPexelsQuerySet, type PexelsQuerySet } from '@/lib/pexels-hero-query'
import {
  extractEnglishPoiFromLabel,
  extractLatinPhraseFromTitle,
  mapDestination,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
  sanitizeAttractionPhrase,
} from '@/lib/pexels-keyword'

export type { PexelsQuerySet } from '@/lib/pexels-hero-query'

// --- Types (저장 JSON = 사용자 요청 필드명) ---

export type DayHeroPhotoResult = {
  url: string
  source: string
  photographer: string
  originalLink: string
  externalId?: string
}

export type DayHeroImageBundle = {
  heroPlaceName: string
  heroPlaceReason: string
  heroPlaceQuery: string
  /** Pexels/Gemini 검색·디버그용 별칭(대표 장소 1곳 기준 쿼리 변형) */
  heroPlaceSearchAliases: string[]
  heroImageSource: 'pexels' | 'gemini'
  heroImageUrl: string
  heroImagePhotographer: string | null
  heroImageSelectionReason: string
  heroImagePexelsId: number | null
  heroImageMetaRaw: unknown
  heroFallbackUsed: boolean
  backupPlaceName: string | null
  imageCandidateCount: number
  heroGeneratedPrompt?: string
}

export type ExtractedPoi = {
  raw: string
  source: 'poiNamesRaw' | 'rawBlock' | 'summary' | 'product' | 'schedule'
}

export type NormalizedPlace = {
  label: string
  pexelsQueryStem: string
  semanticKey: string
}

export type DayHeroPlaceChoice = {
  chosenPlaceName: string
  chosenPlaceReason: string
  backupPlaceName: string | null
  semanticKey: string
  pexelsQueryStem: string
  /** 선정 직후·쿼리 생성 전 보조 별칭(영문 stem·도시 등) */
  placeSearchAliases: string[]
}

export type DayHeroResolveInput = {
  productId: string
  dayNum: number
  destination: string
  /** 이미지 생성에는 넣지 않음 — POI 후보 보조(상품명·라틴 구간 등) */
  productTitle: string | null
  city: string | null
  poiNamesRaw: string | null
  summaryTextRaw: string | null
  rawBlock: string | null
  scheduleTitle: string | null
  scheduleDescription: string | null
  usedHeroPlaceKeys: Set<string>
}

export type PhotoUsage = {
  isUsed: (p: { url: string; originalLink?: string; externalId?: string }) => boolean
  mark: (p: { url: string; originalLink?: string; externalId?: string }) => void
}

export type EvaluatedHeroImage = {
  candidate: PexelsHeroCandidateMeta
  score: number
  usable: boolean
  reason: string
}

// --- 1. 방문지 후보 추출 ---

export function extractDayPoiCandidates(input: {
  poiNamesRaw?: string | null
  rawBlock?: string | null
  summaryTextRaw?: string | null
  destination?: string | null
  /** Product.title — 보조(라틴 명소·세그먼트). 이미지 생성 입력과 분리 */
  productTitle?: string | null
  scheduleTitle?: string | null
  scheduleDescription?: string | null
}): ExtractedPoi[] {
  const out: ExtractedPoi[] = []
  const seen = new Set<string>()
  const push = (raw: string, source: ExtractedPoi['source']) => {
    const t = raw.trim()
    if (t.length < 2 || t.length > 120) return
    const k = `${source}:${normalizeSemanticPoiKey(t)}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ raw: t, source })
  }

  if (input.poiNamesRaw?.trim()) {
    for (const p of input.poiNamesRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)) {
      push(p, 'poiNamesRaw')
    }
  }
  if (input.rawBlock?.trim()) {
    const lines = input.rawBlock.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      const stripped = line
        .replace(/^[•\-\u2022\d.)\s]+/u, '')
        .replace(/^\[[^\]]+\]\s*/, '')
        .trim()
      if (stripped.length >= 2 && stripped.length < 90) push(stripped, 'rawBlock')
    }
  }
  if (input.summaryTextRaw?.trim()) {
    for (const p of input.summaryTextRaw.split(/[/／，,;；]/).map((s) => s.trim()).filter(Boolean)) {
      if (p.length >= 2 && p.length < 70) push(p, 'summary')
    }
  }
  if (input.scheduleTitle?.trim()) push(input.scheduleTitle.trim(), 'schedule')
  const desc = input.scheduleDescription?.trim()
  if (desc && desc.length < 120) push(desc, 'schedule')
  if (input.destination?.trim()) push(input.destination.trim(), 'product')
  if (input.productTitle?.trim()) {
    const latin = extractLatinPhraseFromTitle(input.productTitle)
    if (latin) push(latin, 'product')
    for (const seg of input.productTitle.split(/[|·/\\[\]()\n\r]+/).map((s) => s.trim()).filter(Boolean)) {
      if (seg.length >= 2 && seg.length <= 70 && !/^\d+박\s*\d+일$/.test(seg)) push(seg, 'product')
    }
  }
  return out
}

// --- 2. 정규화 ---

function stripParentheses(s: string): string {
  return s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
}

function stripQuotedFluff(s: string): string {
  return s
    .replace(/[''「」][^''「」]{1,40}[''」]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripActivitySuffix(s: string): string {
  return s
    .replace(/\s*(관람|관광|체험|방문|이동|자유일정|자유|선택가능|선택)\s*$/u, '')
    .replace(/\s*일정\s*$/u, '')
    .trim()
}

export function normalizePlaceCandidates(
  extracted: ExtractedPoi[],
  _city: string | null,
  _country: string | null
): NormalizedPlace[] {
  const map = new Map<string, NormalizedPlace>()
  for (const e of extracted) {
    let t = stripParentheses(e.raw)
    t = stripQuotedFluff(t)
    t = stripActivitySuffix(t)
    if (t.length < 2) continue
    const mappedEn = mapKoreanPoiSegment(t)
    const stemRaw = mappedEn ? sanitizeAttractionPhrase(mappedEn) : sanitizeAttractionPhrase(t)
    if (!stemRaw) continue
    const semanticKey = normalizeSemanticPoiKey(stemRaw)
    if (!map.has(semanticKey)) {
      map.set(semanticKey, {
        label: t.slice(0, 80),
        pexelsQueryStem: stemRaw,
        semanticKey,
      })
    }
  }
  return [...map.values()]
}

// --- 3. 대표 장소 (하루·한 구역당 대표 1곳만; 내부 어트랙션 여러 개여도 상징적 1요소로) ---

const LANDMARK_RE =
  /타워|전망대|성|사원|사찰|공원|궁|광장|박물관|전망|랜드마크|시장|거리|문화|유적|유네스코|tower|temple|shrine|castle|park|museum|market|bridge|plaza|square/i
const LOW_PRIORITY_RE =
  /공항|airport|호텔|hotel|리조트|resort|식당|레스토랑|맛집|조식|중식|석식|쇼핑|면세|duty|휴게소|페리|버스만|이동|미팅|가이드|기사|breakfast|lunch|dinner|terminal/i
const SHOP_RE = /쇼핑센터|면세점|아울렛|mall|outlet|duty\s*free/i

function scorePlaceForHero(np: NormalizedPlace): number {
  const hay = `${np.label} ${np.pexelsQueryStem}`
  let score = 8
  if (LANDMARK_RE.test(hay)) score += 28
  if (LOW_PRIORITY_RE.test(hay)) score -= 38
  if (SHOP_RE.test(hay)) score -= 55
  if (mapKoreanPoiSegment(np.label)) score += 14
  return score
}

function buildStemAliases(stem: string, city: string | null, destination: string): string[] {
  const cityEn = mapDestination(city || destination) || ''
  const destEn = mapDestination(destination) || destination
  const s = stem.trim()
  const out: string[] = []
  const add = (x: string) => {
    const t = x.trim()
    if (t && !out.includes(t)) out.push(t)
  }
  add(s)
  if (cityEn) add(`${s} ${cityEn}`)
  if (cityEn && destEn) add(`${s} ${cityEn} ${destEn}`)
  return out.slice(0, 8)
}

export function chooseDayHeroPlace(
  normalized: NormalizedPlace[],
  ctx: { usedHeroPlaceKeys: Set<string> },
  city: string | null,
  destination: string
): DayHeroPlaceChoice | null {
  if (normalized.length === 0) return null
  const ranked = normalized
    .map((n) => ({ n, score: scorePlaceForHero(n) }))
    .sort((a, b) => b.score - a.score)

  const maxScore = ranked[0]?.score ?? 0
  if (maxScore < -15) return null

  const pickFirst = (): NormalizedPlace | null => {
    for (const { n } of ranked) {
      if (ctx.usedHeroPlaceKeys.has(n.semanticKey)) continue
      return n
    }
    return ranked[0]?.n ?? null
  }

  const first = pickFirst()
  if (!first) return null
  const second = ranked.find((r) => r.n.semanticKey !== first.semanticKey)?.n ?? null
  return {
    chosenPlaceName: first.label,
    chosenPlaceReason:
      '그날 후보 중에서 가장 대표적이고 유명한 한 곳만 골랐습니다. 목표 이미지는 반드시 절경·경치일 필요는 없고, 그 명소의 대표적으로 알려진 모습을 찾는 것입니다. 한 시설 안에 여러 어트랙션이 있어도 상징적인 한 요소(stem)만 씁니다. 공항·호텔·식당·쇼핑·이동은 후순위입니다.',
    backupPlaceName: second?.label ?? null,
    semanticKey: first.semanticKey,
    pexelsQueryStem: first.pexelsQueryStem,
    placeSearchAliases: buildStemAliases(first.pexelsQueryStem, city, destination),
  }
}

export function chooseSyntheticLandmarkPlace(
  city: string | null,
  destination: string,
  usedHeroPlaceKeys: Set<string>
): DayHeroPlaceChoice {
  const cityEn = mapDestination(city || destination) || sanitizeAttractionPhrase(destination) || destination
  const stem = `${cityEn} landmark`.trim()
  let semanticKey = normalizeSemanticPoiKey(stem)
  if (usedHeroPlaceKeys.has(semanticKey)) {
    semanticKey = normalizeSemanticPoiKey(`${stem} alt`)
  }
  return {
    chosenPlaceName: cityEn,
    chosenPlaceReason:
      '당일 추출 POI가 없거나 공항·숙소·식사·쇼핑 위주로 판단되어, 도시 대표 랜드마크 검색으로 대체했습니다.',
    backupPlaceName: null,
    semanticKey,
    pexelsQueryStem: stem,
    placeSearchAliases: buildStemAliases(stem, city, destination),
  }
}

// --- 4. Pexels 검색어 ---

export function buildPexelsQueriesForPlace(
  place: DayHeroPlaceChoice,
  city: string | null,
  destination: string
): PexelsQuerySet {
  const fromLabel = extractEnglishPoiFromLabel(place.chosenPlaceName)
  const stem = (fromLabel || place.pexelsQueryStem).trim()
  return buildHeroPexelsQuerySet({
    stem,
    city,
    destination,
  })
}

// --- 5. 후보 수집 ---

export async function fetchPexelsCandidates(queries: PexelsQuerySet, limit: number): Promise<PexelsHeroCandidateMeta[]> {
  const cap = Math.min(Math.max(limit, 5), 15)
  const byId = new Map<number, PexelsHeroCandidateMeta>()
  const perQ = Math.min(8, Math.max(5, Math.ceil(cap / 2)))
  const ordered = [queries.primaryQuery, ...queries.secondaryQueries].filter(Boolean)
  for (const q of ordered) {
    if (byId.size >= cap) break
    const batch = await searchPexelsHeroCandidates(q, perQ, q)
    for (const c of batch) {
      if (!byId.has(c.pexelsId)) byId.set(c.pexelsId, c)
      if (byId.size >= cap) break
    }
  }
  return [...byId.values()].slice(0, cap)
}

// --- 6–7. 평가 및 선택 ---

const MIN_USABLE_SCORE = 40

export function evaluatePexelsCandidates(
  _dayContext: DayHeroResolveInput,
  imageCandidates: PexelsHeroCandidateMeta[]
): EvaluatedHeroImage[] {
  return imageCandidates.map((c, index) => {
    const w = c.width || 0
    const h = c.height || 0
    let score = 52 - index * 3
    const bits: string[] = ['순위·해상도·가로세로비']
    if (w > 0 && h > 0) {
      score += Math.min(w, h) / 85
      const ratio = w / Math.max(h, 1)
      if (ratio < 0.8) {
        score -= 28
        bits.push('세로편')
      }
      if (Math.min(w, h) < 800) {
        score -= 14
        bits.push('저해상도')
      }
    } else {
      score -= 6
      bits.push('메타크기없음')
    }
    if (isPexelsFallbackUrl(c.imageUrl)) score -= 1000
    const usable = score >= MIN_USABLE_SCORE && !isPexelsFallbackUrl(c.imageUrl)
    return { candidate: c, score, usable, reason: bits.join(', ') }
  })
}

export function selectBestPexelsImage(
  evaluated: EvaluatedHeroImage[],
  isUsed: (p: { url: string; originalLink: string; externalId?: string }) => boolean
): EvaluatedHeroImage | null {
  const sorted = [...evaluated].sort((a, b) => b.score - a.score)
  for (const e of sorted) {
    if (!e.usable) continue
    const ext = String(e.candidate.pexelsId)
    if (
      isUsed({
        url: e.candidate.imageUrl,
        originalLink: e.candidate.originalLink,
        externalId: ext,
      })
    )
      continue
    return e
  }
  return null
}

// --- 8. Gemini fallback ---

/**
 * 이미지 생성 입력: 선정된 대표 장소 1곳(영문 stem 우선) + 짧은 지리 맥락만.
 * 문장을 한 덩어리로 유지해 Imagen이 “여러 문단 = 여러 장면”으로 해석하지 않게 한다.
 */
function buildGeminiHeroPrompt(_input: DayHeroResolveInput, place: DayHeroPlaceChoice): string {
  const cityEn = mapDestination(_input.city ?? '') || ''
  const destEn = mapDestination(_input.destination) || ''
  const stemFromLabel = extractEnglishPoiFromLabel(place.chosenPlaceName)
  const stem = (stemFromLabel || place.pexelsQueryStem).trim()
  const geo = [cityEn, destEn].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i)
  const where = geo.length > 0 ? ` in ${geo.join(', ')}` : ''
  return `Photorealistic travel photo of only this one place: ${stem}${where}. One main subject, typical visitor view (facade, gate, or street context).`
}

export async function generateGeminiFallbackImage(opts: {
  prisma: PrismaClient
  destination: string
  attractionName: string
  promptLine: string
}): Promise<{ pool: PoolPhotoRecord | null; prompt: string } | null> {
  const primaryPrompt = `${opts.promptLine} ${IMAGEN_ITINERARY_DAY_HERO_CONSTRAINTS}`.trim()
  let buf = await generateImageWithGemini({
    prompt: primaryPrompt,
    stylePreset: 'single_landmark',
    aspectRatio: '4:3',
  })
  if (!buf) {
    const retryPrompt =
      `${ITINERARY_DAY_HERO_REGENERATE_PROMPT_EN} One place only: ${opts.attractionName.trim()}. ` +
      'A single photo of that place only. No text, no collage, no multi-panel. ' +
      IMAGEN_ITINERARY_DAY_HERO_CONSTRAINTS
    buf = await generateImageWithGemini({
      prompt: retryPrompt,
      stylePreset: 'single_landmark',
      aspectRatio: '4:3',
    })
  }
  if (!buf) return null
  const saved = await savePhotoToPool(opts.prisma, buf, opts.destination, opts.attractionName, 'Gemini', {
    convertToWebpFirst: true,
  })
  return saved ? { pool: saved, prompt: primaryPrompt } : null
}

// --- Orchestration & save ---

function poolToHeroPhoto(rec: PoolPhotoRecord): DayHeroPhotoResult {
  return {
    url: rec.filePath,
    source: rec.source,
    photographer: rec.source,
    originalLink: '',
  }
}

export async function resolveDayHeroWithFallback(
  input: DayHeroResolveInput,
  prisma: PrismaClient,
  usage: PhotoUsage
): Promise<{ photo: DayHeroPhotoResult; bundle: DayHeroImageBundle; semanticKey: string }> {
  const extracted = extractDayPoiCandidates({
    poiNamesRaw: input.poiNamesRaw,
    rawBlock: input.rawBlock,
    summaryTextRaw: input.summaryTextRaw,
    destination: input.destination,
    productTitle: input.productTitle,
    scheduleTitle: input.scheduleTitle,
    scheduleDescription: input.scheduleDescription,
  })
  const normalized = normalizePlaceCandidates(extracted, input.city, null)
  let place = chooseDayHeroPlace(normalized, { usedHeroPlaceKeys: input.usedHeroPlaceKeys }, input.city, input.destination)
  let heroFallbackUsed = false
  if (!place) {
    place = chooseSyntheticLandmarkPlace(input.city, input.destination, input.usedHeroPlaceKeys)
    heroFallbackUsed = true
  }

  const queries = buildPexelsQueriesForPlace(place, input.city, input.destination)
  const heroPlaceSearchAliases = [queries.primaryQuery, ...queries.secondaryQueries].filter(Boolean)
  const collected = await fetchPexelsCandidates(queries, 10)
  const evaluated = evaluatePexelsCandidates(input, collected)
  const picked = selectBestPexelsImage(evaluated, usage.isUsed)

  const metaRaw = {
    queries,
    evaluated: evaluated.map((e) => ({
      pexelsId: e.candidate.pexelsId,
      score: e.score,
      usable: e.usable,
      reason: e.reason,
      queryUsed: e.candidate.queryUsed,
    })),
  }

  let photo: DayHeroPhotoResult
  let bundle: DayHeroImageBundle

  if (picked) {
    const saved = await savePhotoFromUrl(
      prisma,
      picked.candidate.imageUrl,
      input.destination,
      place.pexelsQueryStem,
      'Pexels'
    )
    photo = saved
      ? poolToHeroPhoto(saved)
      : {
          url: picked.candidate.imageUrl,
          source: 'Pexels',
          photographer: picked.candidate.photographer,
          originalLink: picked.candidate.originalLink,
          externalId: String(picked.candidate.pexelsId),
        }
    usage.mark({
      url: photo.url,
      originalLink: photo.originalLink,
      externalId: photo.externalId ?? String(picked.candidate.pexelsId),
    })
    bundle = {
      heroPlaceName: place.chosenPlaceName,
      heroPlaceReason: place.chosenPlaceReason,
      heroPlaceQuery: queries.primaryQuery,
      heroPlaceSearchAliases,
      heroImageSource: 'pexels',
      heroImageUrl: photo.url,
      heroImagePhotographer: picked.candidate.photographer,
      heroImageSelectionReason: `Pexels 후보 ${collected.length}장 중 휴리스틱 최고점(${picked.score.toFixed(1)}): ${picked.reason}`,
      heroImagePexelsId: picked.candidate.pexelsId,
      heroImageMetaRaw: metaRaw,
      heroFallbackUsed: heroFallbackUsed,
      backupPlaceName: place.backupPlaceName,
      imageCandidateCount: collected.length,
    }
    return { photo, bundle, semanticKey: place.semanticKey }
  }

  const gemLine = buildGeminiHeroPrompt(input, place)
  const attractionEn = extractEnglishPoiFromLabel(place.chosenPlaceName) || place.pexelsQueryStem
  const gen = await generateGeminiFallbackImage({
    prisma,
    destination: input.destination,
    attractionName: attractionEn,
    promptLine: gemLine,
  })

  if (gen?.pool) {
    photo = poolToHeroPhoto(gen.pool)
    usage.mark(photo)
    bundle = {
      heroPlaceName: place.chosenPlaceName,
      heroPlaceReason: place.chosenPlaceReason,
      heroPlaceQuery: queries.primaryQuery,
      heroPlaceSearchAliases,
      heroImageSource: 'gemini',
      heroImageUrl: photo.url,
      heroImagePhotographer: null,
      heroImageSelectionReason:
        'Pexels 후보가 없거나 품질·가로형·해상도 기준을 통과한 이미지가 없어 Imagen/Gemini 실사풍 생성으로 대체했습니다.',
      heroImagePexelsId: null,
      heroImageMetaRaw: metaRaw,
      heroFallbackUsed: true,
      backupPlaceName: place.backupPlaceName,
      imageCandidateCount: collected.length,
      heroGeneratedPrompt: gen.prompt,
    }
    return { photo, bundle, semanticKey: place.semanticKey }
  }

  const pex = await fetchPexelsPhotoObject(queries.primaryQuery)
  heroFallbackUsed = true
  if (!isPexelsFallbackUrl(pex.url)) {
    const saved = await savePhotoFromUrl(prisma, pex.url, input.destination, place.pexelsQueryStem, 'Pexels')
    photo = saved ? poolToHeroPhoto(saved) : {
        url: pex.url,
        source: pex.source,
        photographer: pex.photographer,
        originalLink: pex.originalLink,
        externalId: pex.externalId,
      }
  } else {
    photo = {
      url: pex.url,
      source: pex.source,
      photographer: pex.photographer,
      originalLink: pex.originalLink,
      externalId: pex.externalId,
    }
  }
  usage.mark(photo)
  bundle = {
    heroPlaceName: place.chosenPlaceName,
    heroPlaceReason: place.chosenPlaceReason,
    heroPlaceQuery: queries.primaryQuery,
    heroPlaceSearchAliases,
    heroImageSource: 'pexels',
    heroImageUrl: photo.url,
    heroImagePhotographer: photo.photographer,
    heroImageSelectionReason:
      '다중 후보 평가에서 통과분이 없어 단일 Pexels 검색(또는 시스템 폴백 URL)으로 최소 보장했습니다.',
    heroImagePexelsId: pex.externalId ? Number(pex.externalId) || null : null,
    heroImageMetaRaw: metaRaw,
    heroFallbackUsed: heroFallbackUsed,
    backupPlaceName: place.backupPlaceName,
    imageCandidateCount: collected.length,
  }
  return { photo, bundle, semanticKey: place.semanticKey }
}

export async function saveDayHeroResult(
  prisma: PrismaClient,
  productId: string,
  day: number,
  bundle: DayHeroImageBundle
): Promise<void> {
  const row = await prisma.itineraryDay.findUnique({
    where: { productId_day: { productId, day } },
    select: { id: true },
  })
  if (!row) return
  await prisma.itineraryDay.update({
    where: { productId_day: { productId, day } },
    data: { heroImageBundle: JSON.stringify(bundle) },
  })
}

/** 명세 문서용 snake_case 별칭 */
export const extract_day_poi_candidates = extractDayPoiCandidates
export const normalize_place_candidates = normalizePlaceCandidates
export const choose_day_hero_place = chooseDayHeroPlace
export const build_pexels_queries_for_place = buildPexelsQueriesForPlace
export const fetch_pexels_candidates = fetchPexelsCandidates
export const evaluate_pexels_candidates = evaluatePexelsCandidates
export const select_best_pexels_image = selectBestPexelsImage
export const generate_gemini_fallback_image = generateGeminiFallbackImage
export const resolve_day_hero_with_fallback = resolveDayHeroWithFallback
export const save_day_hero_result = saveDayHeroResult
