import { getFinalScheduleDayImageUrl } from '@/lib/final-image-selection'

/**
 * [일정 표시 SSOT] Product.schedule 단기 표시 소스 통일.
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
  imageUrl?: string | null
  imageDisplayName?: string | null
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
}

type ProductLike = {
  schedule?: string | null
  itineraries?: Array<{ day: number; description: string }>
}

function deriveDisplayNameFromFileName(fileName: string | null | undefined): string | null {
  const raw = (fileName ?? '').trim()
  if (!raw) return null
  const base = raw.split(/[\\/]/).pop() ?? raw
  const noExt = base.replace(/\.[a-z0-9]{2,5}$/i, '')
  const cleaned = noExt
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

function optionalScheduleMealCol(row: Record<string, unknown>, key: string): string | null {
  const v = row[key]
  if (v == null) return null
  const t = String(v).trim()
  return t.length > 0 ? t : null
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
          const imageSeoTitleKr =
            typeof row?.imageSeoTitleKr === 'string' ? row.imageSeoTitleKr.trim() : ''
          const imageAttractionName =
            typeof row?.imageAttractionName === 'string' ? row.imageAttractionName.trim() : ''
          const imageSourceFileName =
            typeof row?.imageSourceFileName === 'string' ? row.imageSourceFileName.trim() : ''
          const imageDisplayNameManual =
            typeof row?.imageDisplayNameManual === 'string' ? row.imageDisplayNameManual.trim() : ''
          /** 공개 캡션·alt: SSOT image_assets SEO 제목 → 명소/도시 라벨 → 파일명·URL 유도 */
          const imageDisplayName =
            imageSeoTitleKr ||
            imageAttractionName ||
            deriveDisplayNameFromFileName(imageSourceFileName) ||
            imageDisplayNameManual ||
            deriveDisplayNameFromImageUrl(imageUrl) ||
            null
          const base: ScheduleDayDisplay = {
            day,
            description,
            title: typeof row?.title === 'string' ? row.title : undefined,
            imageKeyword: typeof row?.imageKeyword === 'string' ? row.imageKeyword : undefined,
            imageUrl,
            imageDisplayName,
            hotelText: optionalScheduleMealCol(row, 'hotelText'),
            breakfastText: optionalScheduleMealCol(row, 'breakfastText'),
            lunchText: optionalScheduleMealCol(row, 'lunchText'),
            dinnerText: optionalScheduleMealCol(row, 'dinnerText'),
            mealSummaryText: optionalScheduleMealCol(row, 'mealSummaryText'),
            meals: optionalScheduleMealCol(row, 'meals'),
          }
          if (options?.includeInternalMeta === true) {
            return {
              ...base,
              imageManualSelected,
              imageSelectionMode,
              imageCandidateOrigin,
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
