import { getFinalScheduleDayImageUrl } from '@/lib/final-image-selection'
import { resolveScheduleThumbCaption } from '@/lib/schedule-image-thumb-caption'
import { resolveScheduleImageSeoTitleKr } from '@/lib/schedule-image-seo-title-ssot'
import { stripTrailingSourceTokenFromFilenameStem } from '@/lib/webp-filename'

/**
 * [일정 표시 SSOT] Product.schedule 단기 표시 소스 통일.
 * REGRESSION-FREEZE[schedule-image-seo-title-ssot]: 공개 캡션 = imageSeoTitleKr — manifest
 *
 * 정책:
 * - 읽기 우선순위: 1) Product.schedule(JSON) → 2) Itinerary 테이블(fallback) → 3) [].
 * - 화면/상세는 이 함수 결과만 사용. schedule JSON에 day, description, imageUrl 등이 있으면 그대로 사용.
 *
 * schedule JSON 항목 계약 (필수: day, description / 선택: title, imageKeyword, imageUrl).
 * Itinerary는 보조 기록; schedule이 없거나 파싱 실패 시에만 fallback으로 읽음.
 */

export type ScheduleDayDisplay = {
  day: number
  description: string
  title?: string
  imageKeyword?: string
  imageKeyword2?: string
  imageUrl?: string | null
  imageUrl2?: string | null
  imageDisplayName?: string | null
  imageDisplayName2?: string | null
  imagePhotographer?: string | null
  imageSource?: string | null
  imagePhotographer2?: string | null
  imageSource2?: string | null
  /** confirm 시 itineraryDayDrafts와 함께 직렬화(모두투어 등) — 공개 상세는 ItineraryDay와 병합 */
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
  meals?: string | null
}

export type ScheduleDayInternalMeta = {
  imageManualSelected?: boolean
  imageSelectionMode?: string | null
  imageCandidateOrigin?: string | null
  imageStoragePath?: string | null
  imageStorageBucket?: string | null
  imageRehostSearchLabel?: string | null
  imagePlaceName?: string | null
  imageCityName?: string | null
  imageWidth?: number | null
  imageHeight?: number | null
}

type ProductLike = {
  schedule?: string | null
  itineraries?: Array<{ day: number; description: string }>
  destination?: string | null
  primaryDestination?: string | null
  title?: string | null
}

function deriveDisplayNameFromFileName(fileName: string | null | undefined): string | null {
  const raw = (fileName ?? '').trim()
  if (!raw) return null
  let base = raw.split(/[\\/]/).pop() ?? raw
  try {
    if (/%[0-9A-Fa-f]{2}/.test(base)) base = decodeURIComponent(base.replace(/\+/g, ' '))
  } catch {
    /* keep base */
  }
  const noExt = base.replace(/\.[a-z0-9]{2,5}$/i, '')
  const withoutSourceStem = stripTrailingSourceTokenFromFilenameStem(noExt)
  const cleaned = withoutSourceStem
    .replace(/[_-]+/g, ' ')
    .replace(/\b(day|d)\s*\d{1,2}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  if (/^day\s*\d{1,2}$/i.test(cleaned)) return null
  return cleaned
}

function deriveDisplayNameFromImageUrl(imageUrl: string | null | undefined): string | null {
  const raw = (imageUrl ?? '').trim()
  if (!raw) return null
  const noQuery = raw.split('?')[0] ?? raw
  return deriveDisplayNameFromFileName(noQuery)
}

/** 공개 UI(히어로 캐러셀 등): URL·파일명에서 도시·명소 추정 캡션 */
export function publicLocationCaptionFromImageUrl(imageUrl: string | null | undefined): string | null {
  return deriveDisplayNameFromImageUrl(imageUrl)
}

function optionalScheduleMealCol(row: Record<string, unknown>, key: string): string | null {
  const v = row[key]
  if (v == null) return null
  const t = String(v).trim()
  return t.length > 0 ? t : null
}

function resolveScheduleRowImageSource(
  row: Record<string, unknown>,
  sourceKey: 'imageSource' | 'imageSource2'
): string | null {
  const raw = row[sourceKey]
  if (typeof raw === 'string') {
    const t = raw.trim()
    return t || null
  }
  if (raw && typeof raw === 'object' && typeof (raw as { source?: string }).source === 'string') {
    const t = (raw as { source: string }).source.trim()
    return t || null
  }
  return null
}

function resolveScheduleRowImagePhotographer(
  row: Record<string, unknown>,
  photographerKey: 'imagePhotographer' | 'imagePhotographer2',
  sourceKey: 'imageSource' | 'imageSource2'
): string | null {
  const direct = row[photographerKey]
  if (typeof direct === 'string') {
    const t = direct.trim()
    if (t) return t
  }
  const raw = row[sourceKey]
  if (raw && typeof raw === 'object' && typeof (raw as { photographer?: string }).photographer === 'string') {
    const t = (raw as { photographer: string }).photographer.trim()
    return t || null
  }
  return null
}

type GetScheduleOptions = {
  includeInternalMeta?: boolean
}

/**
 * 일정 배열 반환. schedule(JSON) 우선, 없거나 파싱 실패 시 itineraries fallback. 둘 다 없으면 [].
 */
export function getScheduleFromProduct(
  product: ProductLike | null | undefined,
  options?: GetScheduleOptions
): Array<ScheduleDayDisplay & Partial<ScheduleDayInternalMeta>> {
  if (!product) return []

  if (product.schedule && typeof product.schedule === 'string') {
    try {
      const arr = JSON.parse(product.schedule) as unknown[]
      if (Array.isArray(arr) && arr.length > 0) {
        const maxDay = arr.reduce((m, item) => {
          const d = Number((item as Record<string, unknown>)?.day ?? 0)
          return Number.isFinite(d) && d > 0 ? Math.max(m, d) : m
        }, 1)
        const destHint =
          (typeof product.primaryDestination === 'string' && product.primaryDestination.trim()) ||
          (typeof product.destination === 'string' && product.destination.trim()) ||
          null
        const productTitle = typeof product.title === 'string' ? product.title : null
        return arr.map((item) => {
          const row = item as Record<string, unknown>
          const day = Number(row?.day ?? 0)
          const description = typeof row?.description === 'string' ? row.description : String(row?.description ?? '')
          const rawImageUrl = row?.imageUrl != null ? (row.imageUrl as string | null) : null
          const imageManualSelected = row?.imageManualSelected === true
          const imageSelectionMode = typeof row?.imageSelectionMode === 'string' ? row.imageSelectionMode : null
          const imageCandidateOrigin = typeof row?.imageCandidateOrigin === 'string' ? row.imageCandidateOrigin : null
          // 최종 렌더 우선순위:
          // 1) 수동 최종 선택(imageManualSelected=true)
          // 2) 라이브러리 재사용 선택(imageSelectionMode=library-reuse)
          // 3) 자동 최적 후보(기본 imageUrl)
          const imageUrl = getFinalScheduleDayImageUrl({
            imageUrl: rawImageUrl,
            imageManualSelected,
            imageSelectionMode,
          })
          const storedSeo =
            typeof row?.imageSeoTitleKr === 'string' ? row.imageSeoTitleKr.trim() : ''
          const imageAttractionName =
            typeof row?.imageAttractionName === 'string' ? row.imageAttractionName.trim() : ''
          const imageSourceFileName =
            typeof row?.imageSourceFileName === 'string' ? row.imageSourceFileName.trim() : ''
          const imageDisplayNameManual =
            typeof row?.imageDisplayNameManual === 'string' ? row.imageDisplayNameManual.trim() : ''
          const routeText =
            typeof row?.routeText === 'string'
              ? row.routeText
              : typeof row?.city === 'string'
                ? row.city
                : null
          // REGRESSION-FREEZE[schedule-image-seo-title-ssot]: 공개 캡션 = 한글 SEO 제목, 영문 키워드·DAYN 금지 — manifest
          const imageSeoTitleKr = resolveScheduleImageSeoTitleKr({
            stored: storedSeo || null,
            day,
            maxDay,
            routeText,
            destination: destHint,
            productTitle,
          })
          /** 공개 캡션·alt: SEO 제목 우선 — URL 파일명 인코딩(%…)·영문 키워드는 썸네일에 쓰지 않음 */
          const imageDisplayName = resolveScheduleThumbCaption({
            imageSeoTitleKr,
            imageAttractionName,
            imageDisplayNameManual,
            imageSourceFileName,
            derivedFromUrl: deriveDisplayNameFromImageUrl(imageUrl),
          })
          const rawImageUrl2 = row?.imageUrl2 != null ? (row.imageUrl2 as string | null) : null
          const imageUrl2 = getFinalScheduleDayImageUrl({
            imageUrl: rawImageUrl2,
            imageManualSelected,
            imageSelectionMode,
          })
          const imageDisplayName2 = resolveScheduleThumbCaption({
            imageSeoTitleKr,
            imageDisplayNameManual:
              typeof row?.imageDisplayName2 === 'string' ? row.imageDisplayName2.trim() : null,
            derivedFromUrl: deriveDisplayNameFromImageUrl(imageUrl2),
          })
          const base: ScheduleDayDisplay = {
            day,
            description,
            title: typeof row?.title === 'string' ? row.title : undefined,
            imageKeyword: typeof row?.imageKeyword === 'string' ? row.imageKeyword : undefined,
            imageKeyword2: typeof row?.imageKeyword2 === 'string' ? row.imageKeyword2 : undefined,
            imageUrl,
            imageUrl2,
            imageDisplayName,
            imageDisplayName2,
            imagePhotographer: resolveScheduleRowImagePhotographer(row, 'imagePhotographer', 'imageSource'),
            imageSource: resolveScheduleRowImageSource(row, 'imageSource'),
            imagePhotographer2: resolveScheduleRowImagePhotographer(row, 'imagePhotographer2', 'imageSource2'),
            imageSource2: resolveScheduleRowImageSource(row, 'imageSource2'),
            hotelText: optionalScheduleMealCol(row, 'hotelText'),
            breakfastText: optionalScheduleMealCol(row, 'breakfastText'),
            lunchText: optionalScheduleMealCol(row, 'lunchText'),
            dinnerText: optionalScheduleMealCol(row, 'dinnerText'),
            mealSummaryText: optionalScheduleMealCol(row, 'mealSummaryText'),
            meals: optionalScheduleMealCol(row, 'meals'),
          }
          if (options?.includeInternalMeta === true) {
            const imageStoragePath =
              typeof row?.imageStoragePath === 'string' ? row.imageStoragePath.trim() || null : null
            const imageStorageBucket =
              typeof row?.imageStorageBucket === 'string' ? row.imageStorageBucket.trim() || null : null
            const imageRehostSearchLabel =
              typeof row?.imageRehostSearchLabel === 'string' ? row.imageRehostSearchLabel.trim() || null : null
            const imagePlaceName =
              typeof row?.imagePlaceName === 'string' ? row.imagePlaceName.trim() || null : null
            const imageCityName =
              typeof row?.imageCityName === 'string' ? row.imageCityName.trim() || null : null
            const imageWidth = typeof row?.imageWidth === 'number' ? row.imageWidth : null
            const imageHeight = typeof row?.imageHeight === 'number' ? row.imageHeight : null
            return {
              ...base,
              imageManualSelected,
              imageSelectionMode,
              imageCandidateOrigin,
              imageStoragePath,
              imageStorageBucket,
              imageRehostSearchLabel,
              imagePlaceName,
              imageCityName,
              imageWidth,
              imageHeight,
            }
          }
          return base
        })
      }
    } catch {
      // fallback to itineraries
    }
  }

  if (product.itineraries?.length) {
    return product.itineraries.map((i) => ({
      day: i.day,
      description: i.description ?? '',
      imageUrl: null as string | null,
    }))
  }

  return []
}
