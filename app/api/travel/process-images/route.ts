import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fetchPexelsPhotoObject, isPexelsFallbackUrl, type PexelsPhotoObject } from '@/lib/pexels-service'
import { extractPexelsPhotoIdFromCdnUrl } from '@/lib/product-pexels-image-rehost'
import { generateImageWithGemini } from '@/lib/gemini-image-generate'
import { buildImageCacheFromDb, getCachedPhoto, type CachedPhotoObject } from '@/lib/image-cache'
import { mapDestination } from '@/lib/pexels-keyword'
import {
  buildHeroKeywordInputsFromSchedule,
  selectProductHeroPlaceKeyword,
} from '@/lib/product-hero-image-keyword'
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'
import { getPreMadeImageSet } from '@/lib/destination-image-set'
import {
  getPoolPhotosForDestination,
  savePhotoFromUrl,
  savePhotoToPool,
  type PhotoPoolAttribution,
  type PoolPhotoRecord,
} from '@/lib/photo-pool'
import { resolveDayHeroWithFallback, saveDayHeroResult } from '@/lib/itinerary-day-hero-image'
import { normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import { recordAssetUsage } from '@/lib/asset-usage-log'
import { requireAdmin } from '@/lib/require-admin'
import {
  pickRepresentativeCoverScheduleDay,
  type ScheduleImageLike,
} from '@/lib/final-image-selection'
import { isObjectStorageConfigured } from '@/lib/object-storage'
import { rehostPexelsUrlsInScheduleEntries, type ScheduleEntryRecord } from '@/lib/schedule-day-image-rehost'
import {
  internalizeProductCoverImageUrl,
  isExternalHttpProductImageUrl,
} from '@/lib/travel-product-image-internalize'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import {
  finalizeRegisterScheduleImageKeywords,
  resolveScheduleImageKeywordForDb,
} from '@/lib/schedule-image-keyword-persist'
import { scheduleRouteTextFromRow } from '@/lib/register-schedule-image-keyword-prompt'

/**
 * 이미지 톤: lib/image-style 공통 (실사·다큐, 건물 지현창조 금지).
 * 일정 슬롯: ItineraryDay POI·요약 → schedule 키워드 → city/destination landmark 순, 일차 간 semantic key·URL 중복 제거.
 */

const SCHEDULE_PHOTOS = 4
const LOG_PREFIX = '[DEBUG]'

/** schedule JSON 한 항목 — imageKeyword는 검색에 쓴 대표 명소/구문(캐시 키·추적용) */
type ScheduleEntry = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string
  imageKeyword2?: string
  imageUrl?: string | null
  imageUrl2?: string | null
  imageSource?: { source: string; photographer: string; originalLink: string; externalId?: string }
  imageSource2?: { source: string; photographer: string; originalLink: string; externalId?: string }
  imagePhotographer?: string | null
  imageSourcePageUrl?: string | null
  imageManualSelected?: boolean
  imageSelectionMode?: string | null
  imageCandidateOrigin?: string | null
}

type ProductRow = {
  id: string | number
  destination?: string | null
  title?: string | null
  schedule: string | null
  [k: string]: unknown
}

type PhotoResult = {
  url: string
  source: string
  photographer: string
  originalLink: string
  externalId?: string
}

type ItineraryRowLite = {
  day: number
  city: string | null
  poiNamesRaw: string | null
  summaryTextRaw: string | null
  rawBlock: string | null
}

function pexelsPoolAttribution(p: PexelsPhotoObject): PhotoPoolAttribution {
  return {
    photographer: p.photographer,
    sourceUrl: p.originalLink,
    sourcePhotoId: p.externalId ?? null,
  }
}

function normAssetUrl(u: string): string {
  try {
    const x = new URL(u)
    x.search = ''
    return x.href.toLowerCase()
  } catch {
    return (u ?? '').trim().toLowerCase()
  }
}

function createPhotoUsage() {
  const urls = new Set<string>()
  const links = new Set<string>()
  const ids = new Set<string>()
  return {
    isUsed(p: { url: string; originalLink?: string; externalId?: string }): boolean {
      if (urls.has(normAssetUrl(p.url))) return true
      const ol = p.originalLink ?? ''
      if (ol && links.has(normAssetUrl(ol))) return true
      if (p.externalId && ids.has(p.externalId)) return true
      return false
    },
    mark(p: { url: string; originalLink?: string; externalId?: string }) {
      urls.add(normAssetUrl(p.url))
      const ol = p.originalLink ?? ''
      if (ol) links.add(normAssetUrl(ol))
      if (p.externalId) ids.add(p.externalId)
    },
  }
}

function scheduleMetaForProcessImages(
  day: number,
  row: ScheduleEntryRecord,
  destination: string,
  itineraryRows: ItineraryRowLite[]
) {
  const itRow = itineraryRows.find((r) => r.day === day) ?? null
  const kw = typeof row.imageKeyword === 'string' ? row.imageKeyword.trim() : ''
  const placeFromPoi = itRow?.poiNamesRaw?.split(/[|,\n]/)?.[0]?.trim() || null
  const placeGuess = placeFromPoi || (kw ? kw.split(/[|,]/)[0]?.trim() || null : null)
  const cityName =
    itRow?.city?.trim() ||
    destination.split(',')[0]?.trim() ||
    destination.trim() ||
    null
  return {
    placeName: placeGuess,
    cityName,
    searchKeyword: kw || placeGuess || cityName,
  }
}

async function stringifyScheduleWithPexelsRehost(
  productId: string,
  entries: ScheduleEntry[],
  destination: string,
  itineraryRows: ItineraryRowLite[]
): Promise<string> {
  if (!isObjectStorageConfigured()) {
    throw new Error('Object Storage(NCLOUD_*)가 설정되지 않았습니다.')
  }
  const rehosted = await rehostPexelsUrlsInScheduleEntries(
    prisma,
    productId,
    entries as ScheduleEntryRecord[],
    (day, row) => scheduleMetaForProcessImages(day, row, destination, itineraryRows)
  )
  return JSON.stringify(rehosted)
}

function parseSchedule(schedule: string | null): ScheduleEntry[] {
  if (!schedule || typeof schedule !== 'string') return []
  try {
    const parsed = JSON.parse(schedule) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: Record<string, unknown>) => ({
      day: Number(item.day) ?? 0,
      title: typeof item.title === 'string' ? item.title : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      routeText: scheduleRouteTextFromRow(item),
      imageKeyword: typeof item.imageKeyword === 'string' ? item.imageKeyword : undefined,
      imageKeyword2: typeof item.imageKeyword2 === 'string' ? item.imageKeyword2 : undefined,
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : (item.imageUrl as null) ?? null,
      imageUrl2: typeof item.imageUrl2 === 'string' ? item.imageUrl2 : (item.imageUrl2 as null) ?? null,
      imageSource:
        item.imageSource && typeof item.imageSource === 'object'
          ? {
              source: String((item.imageSource as Record<string, unknown>).source ?? 'Pexels'),
              photographer: String((item.imageSource as Record<string, unknown>).photographer ?? 'Pexels'),
              originalLink: String((item.imageSource as Record<string, unknown>).originalLink ?? 'https://www.pexels.com'),
              ...(typeof (item.imageSource as Record<string, unknown>).externalId === 'string' ||
              (item.imageSource as Record<string, unknown>).externalId != null
                ? { externalId: String((item.imageSource as Record<string, unknown>).externalId) }
                : {}),
            }
          : undefined,
      imagePhotographer:
        typeof item.imagePhotographer === 'string'
          ? item.imagePhotographer
          : (item.imagePhotographer as null) ?? null,
      imageSourcePageUrl:
        typeof item.imageSourcePageUrl === 'string'
          ? item.imageSourcePageUrl
          : (item.imageSourcePageUrl as null) ?? null,
      imageManualSelected: item.imageManualSelected === true,
      imageSelectionMode: typeof item.imageSelectionMode === 'string' ? item.imageSelectionMode : null,
      imageCandidateOrigin: typeof item.imageCandidateOrigin === 'string' ? item.imageCandidateOrigin : null,
    }))
  } catch {
    return []
  }
}

function toPoolResult(rec: PoolPhotoRecord): PhotoResult {
  return {
    url: rec.filePath,
    source: rec.source,
    photographer: rec.photographer?.trim() || rec.source,
    originalLink: rec.sourceUrl?.trim() || '',
    externalId: rec.sourcePhotoId ?? undefined,
  }
}

function cachedToResult(c: CachedPhotoObject): PhotoResult {
  return {
    url: c.url,
    source: c.source,
    photographer: c.photographer,
    originalLink: c.originalLink,
  }
}

function pexelsToResult(p: PexelsPhotoObject): PhotoResult {
  return {
    url: p.url,
    source: p.source,
    photographer: p.photographer,
    originalLink: p.originalLink,
    externalId: p.externalId,
  }
}

function photoFromPoolSave(saved: PoolPhotoRecord | null): PhotoResult | null {
  return saved ? toPoolResult(saved) : null
}

function retainScheduleImageUrl(
  resolved: string | null | undefined,
  existing: string | null | undefined
): string | null {
  if (resolved) return resolved
  const prev = existing != null ? String(existing).trim() : ''
  if (!prev) return null
  return isExternalHttpProductImageUrl(prev) ? null : prev
}

async function sealProductCoverPhoto(
  prisma: PrismaClient,
  destination: string,
  photo: PhotoResult,
  poolAttractionLabel: string,
  poolSource?: string
): Promise<PhotoResult> {
  if (!isObjectStorageConfigured()) {
    throw new Error('Object Storage(NCLOUD_*)가 설정되지 않았습니다.')
  }
  if (!isExternalHttpProductImageUrl(photo.url)) {
    return photo
  }
  const extId = photo.externalId != null ? Number(String(photo.externalId).trim()) : NaN
  const pidFromUrl = extractPexelsPhotoIdFromCdnUrl(photo.url)
  const pexelsPhotoId =
    Number.isInteger(extId) && extId > 0 ? extId : pidFromUrl != null && pidFromUrl > 0 ? pidFromUrl : null
  const cityLine = destination.split(',')[0]?.trim() || destination.trim() || null
  const url = await internalizeProductCoverImageUrl(prisma, {
    remoteUrl: photo.url,
    destination,
    poolAttractionLabel: poolAttractionLabel.slice(0, 80) || 'Landmark',
    poolSource: poolSource ?? photo.source,
    pexelsPhotoId,
    photographer: photo.photographer,
    pexelsPageUrl: photo.originalLink?.trim() || null,
    searchKeyword: poolAttractionLabel,
    placeName: null,
    cityName: cityLine,
  })
  return { ...photo, url }
}

async function sealPexelsPhotoObjectForScheduleSlot(
  prisma: PrismaClient,
  destination: string,
  p: PexelsPhotoObject,
  poolAttractionLabel: string
): Promise<PexelsPhotoObject> {
  if (!isObjectStorageConfigured() || !isExternalHttpProductImageUrl(p.url)) return p
  const extId = p.externalId != null ? Number(String(p.externalId).trim()) : NaN
  const pidFromUrl = extractPexelsPhotoIdFromCdnUrl(p.url)
  const pexelsPhotoId =
    Number.isInteger(extId) && extId > 0 ? extId : pidFromUrl != null && pidFromUrl > 0 ? pidFromUrl : null
  const cityLine = destination.split(',')[0]?.trim() || destination.trim() || null
  const url = await internalizeProductCoverImageUrl(prisma, {
    remoteUrl: p.url,
    destination,
    poolAttractionLabel: poolAttractionLabel.slice(0, 80) || 'day',
    poolSource: p.source,
    pexelsPhotoId,
    photographer: p.photographer,
    pexelsPageUrl: p.originalLink?.trim() || null,
    searchKeyword: poolAttractionLabel,
    placeName: poolAttractionLabel,
    cityName: cityLine,
  })
  return { ...p, url }
}

/** 일정 슬롯 수를 ItineraryDay/최소 4일 중 큰 값으로 맞춤 */
function padSchedule(entries: ScheduleEntry[], minSlots: number): ScheduleEntry[] {
  const out = [...entries]
  let maxDay = out.reduce((m, e) => Math.max(m, Number(e.day) || 0), 0)
  while (out.length < minSlots) {
    maxDay += 1
    out.push({ day: maxDay })
  }
  return out
}

export const maxDuration = 60

/**
 * Phase 2: productId 기반 이미지 수확.
 * 메인 1 = 상품 대표(landmark). 일정 1~4 = 일차별 POI 우선, 메인·타 일차와 URL/출처/id 중복 제외.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin)
    return jsonWithLeakGuard({ success: false, error: '인증이 필요합니다.' }, 'travel.process-images.auth', {
      status: 401,
    })
  try {
    const body = await req.json().catch(() => ({}))
    const productId = body.productId ?? body.id
    const debugMode = body.debug === true
    if (productId == null) {
      return jsonWithLeakGuard({ success: false, error: 'productId 필요' }, 'travel.process-images.no-id', {
        status: 400,
      })
    }

    const product = (await prisma.product.findUnique({
      where: { id: productId as string },
      select: {
        id: true,
        destination: true,
        primaryDestination: true,
        title: true,
        schedule: true,
        bgImageRehostSearchLabel: true,
      },
    })) as ProductRow | null

    if (!product) {
      return jsonWithLeakGuard({ success: false, error: '상품을 찾을 수 없습니다.' }, 'travel.process-images.not-found', {
        status: 404,
      })
    }

    const destination = (product.destination ?? '').trim() || '미지정'
    const scheduleArrRaw = parseSchedule(product.schedule)
    const scheduleArr = finalizeRegisterScheduleImageKeywords(
      scheduleArrRaw.map((item) => ({
        day: item.day,
        title: item.title ?? '',
        description: item.description ?? '',
        routeText: item.routeText ?? null,
        imageKeyword: item.imageKeyword ?? '',
        imageKeyword2: item.imageKeyword2 ?? null,
        imageUrl: item.imageUrl ?? null,
        imageUrl2: item.imageUrl2 ?? null,
      })),
    ).map((row, i) => ({
      ...scheduleArrRaw[i]!,
      routeText: row.routeText ?? scheduleArrRaw[i]?.routeText ?? null,
      imageKeyword: row.imageKeyword,
      imageKeyword2: row.imageKeyword2 ?? scheduleArrRaw[i]?.imageKeyword2,
    }))
    if (scheduleArr.length === 0) {
      return jsonWithLeakGuard({ success: false, error: '일정 데이터 없음' }, 'travel.process-images.no-schedule', {
        status: 400,
      })
    }

    const itineraryRows: ItineraryRowLite[] = await prisma.itineraryDay.findMany({
      where: { productId: product.id as string },
      orderBy: { day: 'asc' },
      select: { day: true, city: true, poiNamesRaw: true, summaryTextRaw: true, rawBlock: true },
    })

    console.log(`[STEP 3] productId ${product.id} 기반 사진 수확/재사용 시작`)
    console.log(`${LOG_PREFIX} productId: ${product.id} 로딩 완료`)

    const poolList = await getPoolPhotosForDestination(prisma, destination)

    /** 풀 5장 이상: 메인 1 + 일정 4, URL·출처 중복 없이 순서대로 소비 */
    if (poolList.length >= 5) {
      console.log(`[POOL] ${destination} 풀 사진 5장 사용 (중복 제외)`)
      const usage = createPhotoUsage()
      const mainRec = poolList[0]
      const mainUrl = mainRec.filePath
      usage.mark(toPoolResult(mainRec))
      const picked: PoolPhotoRecord[] = []
      for (let i = 1; i < poolList.length && picked.length < SCHEDULE_PHOTOS; i++) {
        const rec = poolList[i]
        const pr = toPoolResult(rec)
        if (!usage.isUsed(pr)) {
          usage.mark(pr)
          picked.push(rec)
        }
      }

      const updatedSchedule: ScheduleEntry[] = scheduleArr.map((item, i) => {
        const rec = picked[i]
        const poolKw = rec?.attractionName?.trim() || `day_${item.day ?? i + 1}`
        return {
          day: item.day,
          title: item.title,
          description: item.description,
          imageKeyword: resolveScheduleImageKeywordForDb(item.imageKeyword, poolKw, `day_${item.day ?? i + 1}`),
          imageKeyword2: item.imageKeyword2,
          imageUrl: rec?.filePath ?? item.imageUrl ?? null,
          imageSource: rec
            ? { source: rec.source, photographer: rec.source, originalLink: '' }
            : item.imageSource,
        }
      })
      const scheduleStr = await stringifyScheduleWithPexelsRehost(
        product.id as string,
        updatedSchedule,
        destination,
        itineraryRows
      )
      await prisma.product.update({
        where: { id: product.id as string },
        data: {
          bgImageUrl: mainUrl,
          schedule: scheduleStr,
        },
      })
      return jsonWithLeakGuard({ success: true, source: 'pool', cacheHit: 5, newFetch: 0 }, 'travel.process-images.pool')
    }

    const poolBySlot = new Map<number, PoolPhotoRecord>()
    poolList.forEach((rec, i) => {
      if (i === 0) poolBySlot.set(-1, rec)
      else poolBySlot.set(i - 1, rec)
    })

    const preMade = poolList.length === 0 ? await getPreMadeImageSet(prisma, destination) : null
    if (preMade) {
      console.log(`[PRE-MADE] ${destination} 미리 저장 세트 사용 (메인·일정 URL 중복 제외)`)
      const usage = createPhotoUsage()
      usage.mark({ url: preMade.mainPhoto.url, originalLink: preMade.mainPhoto.originalLink })
      const schedPhotos: typeof preMade.schedulePhotos = []
      for (const ph of preMade.schedulePhotos) {
        if (schedPhotos.length >= SCHEDULE_PHOTOS) break
        const pr = { url: ph.url, originalLink: ph.originalLink }
        if (!usage.isUsed(pr)) {
          usage.mark(pr)
          schedPhotos.push(ph)
        }
      }
      let pad = 0
      while (schedPhotos.length < SCHEDULE_PHOTOS && preMade.schedulePhotos.length > 0 && pad < 32) {
        schedPhotos.push(preMade.schedulePhotos[pad % preMade.schedulePhotos.length])
        pad++
      }
      const mainSealed = await sealPexelsPhotoObjectForScheduleSlot(
        prisma,
        destination,
        preMade.mainPhoto,
        'premade_main'
      )
      const schedSealed: PexelsPhotoObject[] = []
      for (let i = 0; i < schedPhotos.length; i++) {
        schedSealed.push(
          await sealPexelsPhotoObjectForScheduleSlot(prisma, destination, schedPhotos[i]!, `premade_${i + 1}`)
        )
      }
      const updatedSchedule: ScheduleEntry[] = scheduleArr.map((item, i) => {
        const photo = schedSealed[i] ?? null
        const premadeKw = photo ? `premade_${i + 1}` : `day_${item.day ?? i + 1}`
        return {
          day: item.day,
          title: item.title,
          description: item.description,
          imageKeyword: resolveScheduleImageKeywordForDb(item.imageKeyword, premadeKw, `day_${item.day ?? i + 1}`),
          imageKeyword2: item.imageKeyword2,
          imageUrl: photo?.url ?? item.imageUrl ?? null,
          imageSource: photo
            ? { source: photo.source, photographer: photo.photographer, originalLink: photo.originalLink }
            : item.imageSource,
        }
      })
      const scheduleStrPre = await stringifyScheduleWithPexelsRehost(
        product.id as string,
        updatedSchedule,
        destination,
        itineraryRows
      )
      await prisma.product.update({
        where: { id: product.id as string },
        data: {
          bgImageUrl: mainSealed.url,
          schedule: scheduleStrPre,
        },
      })
      return jsonWithLeakGuard(
        {
          success: true,
          source: 'pre-made',
          cacheHit: 5,
          newFetch: 0,
        },
        'travel.process-images.premade',
      )
    }

    const cache = await buildImageCacheFromDb(prisma, destination)
    let cacheHitCount = 0
    let newFetchCount = 0

    const usage = createPhotoUsage()
    const usedSemanticKeys = new Set<string>()
    const slotDebug: Array<{
      day: number
      imageUrl: string
      imageSource: string
      candidateOrigin: string
      semanticKey: string
      fallbackUsed: boolean
      fallbackReason?: string
    }> = []

    const heroPick = await selectProductHeroPlaceKeyword({
      productId: String(product.id),
      itineraryDays: buildHeroKeywordInputsFromSchedule(product.schedule, itineraryRows),
      destinationKr: destination,
      cityEn: mapDestination((product as { primaryDestination?: string | null }).primaryDestination ?? destination),
      cachedHeroPlaceKeyword: (product as { bgImageRehostSearchLabel?: string | null }).bgImageRehostSearchLabel,
    })
    const mainQuery =
      heroPick.keyword ||
      normalizeToPlaceName(
        mapDestination((product as { primaryDestination?: string | null }).primaryDestination ?? destination),
      ) ||
      destination

    let mainPhoto: PhotoResult
    const poolMain = poolBySlot.get(-1)
    if (poolMain) {
      mainPhoto = toPoolResult(poolMain)
      cacheHitCount++
      console.log(`[POOL] 메인 사진 사용`)
    } else {
      const cachedMain = await getCachedPhoto(cache, destination, mainQuery, true)
      if (cachedMain) {
        mainPhoto = cachedToResult(cachedMain)
        cacheHitCount++
      } else {
        const pexelsMain = await fetchPexelsPhotoObject(mainQuery)
        newFetchCount++
        if (isPexelsFallbackUrl(pexelsMain.url)) {
          const geminiBuffer = await generateImageWithGemini({ prompt: mainQuery })
          if (geminiBuffer) {
            const saved = await savePhotoToPool(prisma, geminiBuffer, destination, mainQuery, 'Gemini', {
              convertToWebpFirst: true,
            })
            const fromPool = photoFromPoolSave(saved)
            if (!fromPool) {
              throw new Error('메인 제미나이 이미지를 PhotoPool에 저장하지 못했습니다.')
            }
            mainPhoto = fromPool
            console.log(`[POOL] 메인 제미나이 생성 → 풀 저장`)
          } else {
            throw new Error('메인 이미지 생성(Gemini)에 실패했습니다.')
          }
        } else {
          const saved = await savePhotoFromUrl(
            prisma,
            pexelsMain.url,
            destination,
            mainQuery,
            'Pexels',
            pexelsPoolAttribution(pexelsMain)
          )
          const fromPool = photoFromPoolSave(saved)
          if (!fromPool) {
            throw new Error('메인 Pexels 이미지를 PhotoPool에 저장하지 못했습니다.')
          }
          mainPhoto = fromPool
          console.log(`[POOL] 메인 Pexels → 풀 저장`)
        }
      }
    }
    mainPhoto = await sealProductCoverPhoto(prisma, destination, mainPhoto, mainQuery, mainPhoto.source)
    usage.mark(mainPhoto)

    const maxItineraryDay =
      itineraryRows.length > 0 ? Math.max(...itineraryRows.map((r) => r.day)) : 0
    const slotCount = Math.max(scheduleArr.length, SCHEDULE_PHOTOS, maxItineraryDay)
    const workingSchedule = padSchedule(scheduleArr, slotCount)
    const usedHeroPlaceKeys = new Set<string>()

    const schedulePhotos: { photo: PhotoResult; imageKeyword: string }[] = []

    for (let n = 0; n < workingSchedule.length; n++) {
      const sched = workingSchedule[n]
      const dayNum = typeof sched?.day === 'number' && sched.day > 0 ? sched.day : n + 1
      if (sched?.imageManualSelected === true && sched?.imageUrl) {
        const manualPhoto = await sealProductCoverPhoto(
          prisma,
          destination,
          {
            url: String(sched.imageUrl),
            source: sched.imageSource?.source || 'manual',
            photographer: sched.imageSource?.photographer || 'manual',
            originalLink: sched.imageSource?.originalLink || '',
            externalId:
              sched.imageSource && typeof (sched.imageSource as { externalId?: string }).externalId === 'string'
                ? (sched.imageSource as { externalId: string }).externalId
                : (sched.imageSource as { externalId?: string })?.externalId != null
                  ? String((sched.imageSource as { externalId: unknown }).externalId)
                  : undefined,
          },
          sched.imageKeyword || `day_${dayNum}`,
          sched.imageSource?.source || 'manual'
        )
        schedulePhotos.push({
          photo: manualPhoto,
          imageKeyword: sched.imageKeyword || `day_${dayNum}`,
        })
        slotDebug.push({
          day: dayNum,
          imageUrl: manualPhoto.url,
          imageSource: manualPhoto.source,
          candidateOrigin: 'manual-lock',
          semanticKey: normalizeSemanticPoiKey(sched.imageKeyword || `day_${dayNum}`),
          fallbackUsed: false,
        })
        continue
      }
      const itRow = itineraryRows.find((r) => r.day === dayNum) ?? itineraryRows[n] ?? null

      const poolRec = poolBySlot.get(n)
      let photo: PhotoResult | null = null
      let keywordUsed = `day ${dayNum}`
      let selectedOrigin = 'itinerary_hero'
      let selectedSemanticKey = normalizeSemanticPoiKey(keywordUsed)
      let fallbackUsed = false
      let fallbackReason: string | undefined

      if (poolRec) {
        const cand = toPoolResult(poolRec)
        if (!usage.isUsed(cand)) {
          photo = cand
          keywordUsed = poolRec.attractionName?.trim() || keywordUsed
          selectedOrigin = 'pool'
          selectedSemanticKey = normalizeSemanticPoiKey(poolRec.attractionName || `pool_${n}`)
          usage.mark(photo)
          usedSemanticKeys.add(normalizeSemanticPoiKey(poolRec.attractionName || `pool_${n}`))
        }
      }

      if (!photo) {
        const heroOut = await resolveDayHeroWithFallback(
          {
            productId: product.id as string,
            dayNum,
            destination,
            productTitle: typeof product.title === 'string' ? product.title : null,
            city: itRow?.city ?? null,
            poiNamesRaw: itRow?.poiNamesRaw ?? null,
            summaryTextRaw: itRow?.summaryTextRaw ?? null,
            rawBlock: itRow?.rawBlock ?? null,
            scheduleTitle: sched?.title ?? null,
            scheduleDescription: sched?.description ?? null,
            scheduleRouteText: sched?.routeText ?? null,
            scheduleImageKeyword: sched?.imageKeyword ?? null,
            usedHeroPlaceKeys,
          },
          prisma,
          usage
        )
        photo = heroOut.photo
        keywordUsed = heroOut.bundle.heroPlaceQuery || heroOut.bundle.heroPlaceName
        selectedOrigin = `hero-${heroOut.bundle.heroImageSource}`
        selectedSemanticKey = heroOut.semanticKey
        fallbackUsed = heroOut.bundle.heroFallbackUsed
        fallbackReason = heroOut.bundle.heroImageSelectionReason.slice(0, 200)
        usedHeroPlaceKeys.add(heroOut.semanticKey)
        usedSemanticKeys.add(heroOut.semanticKey)
        newFetchCount++
        const bundleToSave = { ...heroOut.bundle, heroImageUrl: heroOut.photo.url }
        await saveDayHeroResult(prisma, product.id as string, dayNum, bundleToSave)
        console.log(`[HERO] day ${dayNum} ${heroOut.bundle.heroImageSource} → ${photo.url.slice(0, 80)}…`)
      }

      if (!photo) {
        const fallbackKw =
          normalizeToPlaceName(keywordUsed) ||
          normalizeToPlaceName(sched?.imageKeyword ?? '') ||
          mainQuery
        const pexelsPhoto = await fetchPexelsPhotoObject(fallbackKw)
        const attractionLabel = `${destination}_${dayNum}`
        const pexelsResult = pexelsToResult(pexelsPhoto)
        const sameAsHero = normAssetUrl(pexelsResult.url) === normAssetUrl(mainPhoto.url)
        const alreadyUsed = usage.isUsed(pexelsResult)
        const fallbackUrl = isPexelsFallbackUrl(pexelsPhoto.url)
        if (!fallbackUrl && !sameAsHero && !alreadyUsed) {
          newFetchCount++
          const saved = await savePhotoFromUrl(
            prisma,
            pexelsPhoto.url,
            destination,
            attractionLabel,
            'Pexels',
            pexelsPoolAttribution(pexelsPhoto)
          )
          photo = photoFromPoolSave(saved)
          fallbackReason = photo ? 'fallback-pexels' : 'fallback-pool-save-failed'
        } else {
          const fallbackCity = (itRow?.city ?? destination).split(',')[0].trim()
          const poolFallbackList = await prisma.photoPool.findMany({
            where: {
              OR: [
                { attractionName: { contains: keywordUsed } },
                { cityName: { contains: fallbackCity } },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: 30,
          })
          for (const rec of poolFallbackList) {
            const fromPool = toPoolResult(rec as PoolPhotoRecord)
            if (!usage.isUsed(fromPool) && normAssetUrl(fromPool.url) !== normAssetUrl(mainPhoto.url)) {
              photo = fromPool
              fallbackReason = 'fallback-pool-reuse'
              break
            }
          }
          if (!photo) {
            fallbackReason = fallbackUrl
              ? 'fallback-pexels-placeholder-skipped'
              : sameAsHero
                ? 'fallback-hero-overlap-skipped'
                : 'fallback-duplicate-url-skipped'
          }
        }
        if (photo) {
          fallbackUsed = true
          selectedOrigin = 'fallback'
          selectedSemanticKey = normalizeSemanticPoiKey(keywordUsed)
          usage.mark(photo)
          usedSemanticKeys.add(normalizeSemanticPoiKey(keywordUsed))
        }
      }

      if (!photo) {
        slotDebug.push({
          day: dayNum,
          imageUrl: '',
          imageSource: '',
          candidateOrigin: selectedOrigin,
          semanticKey: selectedSemanticKey,
          fallbackUsed,
          fallbackReason,
        })
        continue
      }

      const sealedSlot = await sealProductCoverPhoto(prisma, destination, photo, keywordUsed, photo.source)
      schedulePhotos.push({ photo: sealedSlot, imageKeyword: keywordUsed })
      slotDebug.push({
        day: dayNum,
        imageUrl: photo.url,
        imageSource: photo.source,
        candidateOrigin: selectedOrigin,
        semanticKey: selectedSemanticKey,
        fallbackUsed,
        fallbackReason,
      })
    }

    const scheduleSecondaryPhotos: ({ photo: PhotoResult; imageKeyword: string } | null)[] = new Array(
      workingSchedule.length,
    ).fill(null)
    for (let n = 0; n < workingSchedule.length; n++) {
      const sched = workingSchedule[n]
      const kw2 = typeof sched?.imageKeyword2 === 'string' ? sched.imageKeyword2.trim() : ''
      if (!kw2) continue
      const existing2 = sched?.imageUrl2 ? String(sched.imageUrl2).trim() : ''
      if (existing2) continue
      const primaryUrl = schedulePhotos[n]?.photo?.url ?? sched?.imageUrl ?? null
      const query = normalizeToPlaceName(kw2) || kw2
      const pexelsPhoto = await fetchPexelsPhotoObject(query)
      const pexelsResult = pexelsToResult(pexelsPhoto)
      const sameAsPrimary =
        primaryUrl != null && normAssetUrl(pexelsResult.url) === normAssetUrl(String(primaryUrl))
      const alreadyUsed = usage.isUsed(pexelsResult)
      if (isPexelsFallbackUrl(pexelsPhoto.url) || sameAsPrimary || alreadyUsed) continue
      newFetchCount++
      const dayNum = typeof sched?.day === 'number' && sched.day > 0 ? sched.day : n + 1
      const attractionLabel = `${destination}_${dayNum}_slot2`
      const saved = await savePhotoFromUrl(
        prisma,
        pexelsPhoto.url,
        destination,
        attractionLabel,
        'Pexels',
        pexelsPoolAttribution(pexelsPhoto)
      )
      const fromPool = photoFromPoolSave(saved)
      if (!fromPool) continue
      let photo: PhotoResult = fromPool
      usage.mark(photo)
      photo = await sealProductCoverPhoto(prisma, destination, photo, kw2, photo.source)
      scheduleSecondaryPhotos[n] = { photo, imageKeyword: kw2 }
    }

    console.log(`${LOG_PREFIX} 최종 5장: 재사용 ${cacheHitCount} / 신규 ${newFetchCount}`)

    const prevByDay = new Map<number, ScheduleEntry>()
    for (const it of workingSchedule) prevByDay.set(Number(it.day), it)
    const updatedSchedule: ScheduleEntry[] = workingSchedule.map((item, i) => {
      const slot = schedulePhotos[i]
      const photo = slot?.photo
      const secondary = scheduleSecondaryPhotos[i]
      const photo2 = secondary?.photo
      return {
        day: item.day,
        title: item.title,
        description: item.description,
        imageKeyword: resolveScheduleImageKeywordForDb(
          item.imageKeyword,
          slot?.imageKeyword,
          `day_${item.day ?? i + 1}`,
        ),
        imageKeyword2: item.imageKeyword2,
        imageUrl: retainScheduleImageUrl(photo?.url, item.imageUrl),
        imageUrl2: retainScheduleImageUrl(photo2?.url, item.imageUrl2),
        imagePhotographer: photo?.photographer ?? item.imagePhotographer ?? null,
        imageSourcePageUrl: photo?.originalLink ?? item.imageSourcePageUrl ?? null,
        imageSource: photo
          ? {
              source: photo.source,
              photographer: photo.photographer,
              originalLink: photo.originalLink,
              ...(photo.externalId ? { externalId: photo.externalId } : {}),
            }
          : item.imageSource,
        imageSource2: photo2
          ? {
              source: photo2.source,
              photographer: photo2.photographer,
              originalLink: photo2.originalLink,
              ...(photo2.externalId ? { externalId: photo2.externalId } : {}),
            }
          : item.imageSource2,
        imageManualSelected: item.imageManualSelected === true,
        imageSelectionMode: item.imageSelectionMode ?? null,
        imageCandidateOrigin: slotDebug[i]?.candidateOrigin ?? item.imageCandidateOrigin ?? null,
      }
    })

    const coverCandidates = schedulePhotos
      .map((sp, i) => {
        const sched = workingSchedule[i]
        if (!sched?.day || !sp?.photo?.url) return null
        const meta: ScheduleImageLike = {
          day: sched.day,
          imageUrl: sp.photo.url,
          title: sched.title,
          description: sched.description,
          imageKeyword: sp.imageKeyword ?? sched.imageKeyword,
        }
        return { meta, photo: sp.photo }
      })
      .filter((x): x is { meta: ScheduleImageLike; photo: PhotoResult } => x != null)
    const bestCover = pickRepresentativeCoverScheduleDay(coverCandidates.map((c) => c.meta))
    let bgPhoto =
      bestCover && bestCover.imageUrl
        ? coverCandidates.find((c) => c.meta === bestCover)?.photo ?? mainPhoto
        : mainPhoto
    bgPhoto = await sealProductCoverPhoto(
      prisma,
      destination,
      bgPhoto,
      (bestCover?.imageKeyword || 'cover').toString().slice(0, 80),
      bgPhoto.source
    )

    const scheduleStrFinal = await stringifyScheduleWithPexelsRehost(
      product.id as string,
      updatedSchedule,
      destination,
      itineraryRows
    )
    await prisma.product.update({
      where: { id: product.id as string },
      data: {
        bgImageUrl: bgPhoto.url,
        bgImageRehostSearchLabel: mainQuery.slice(0, 120),
        schedule: scheduleStrFinal,
      },
    })

    for (const row of updatedSchedule) {
      const prev = prevByDay.get(Number(row.day))
      const prevUrl = prev?.imageUrl ? String(prev.imageUrl) : ''
      const nextUrl = row.imageUrl ? String(row.imageUrl) : ''
      if (!nextUrl) continue
      if (row.imageManualSelected === true) continue
      if (prevUrl === nextUrl) continue
      await recordAssetUsage({
        assetPath: nextUrl,
        productId: String(product.id),
        day: Number(row.day),
        selectionMode: 'auto',
        sourceType: row.imageSource?.source || 'auto-selected',
        actorType: 'system',
        actorId: null,
        notes: prevUrl ? `replaced:${prevUrl}` : 'auto-initial',
      })
    }

    console.log(`${LOG_PREFIX} 최종 DB 업데이트 성공`)
    console.log(`[STEP 4] 최종 업데이트 완료`)

    const response: Record<string, unknown> = {
      success: true,
      cacheHit: cacheHitCount,
      newFetch: newFetchCount,
    }
    if (debugMode) {
      response.processImagesTrace = {
        productId: product.id,
        hero: {
          imageUrl: mainPhoto.url,
          imageSource: mainPhoto.source,
          semanticKey: normalizeSemanticPoiKey(mainQuery),
          heroKeywordSource: heroPick.source,
        },
        slots: slotDebug,
      }
    }
    return jsonWithLeakGuard(response, 'travel.process-images.ok')
  } catch (error) {
    const message = error instanceof Error ? error.message : '이미지 처리 실패'
    console.error('[DEBUG] process-images 예외:', error instanceof Error ? (error as Error).stack : error)
    return jsonWithLeakGuard({ success: false, error: message }, 'travel.process-images.catch', { status: 500 })
  }
}
