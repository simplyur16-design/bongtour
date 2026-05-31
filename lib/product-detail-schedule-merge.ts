import type { Prisma } from '@prisma/client'
import type {
  FitItineraryMaster,
  FitItineraryDay,
  FitItineraryActivity,
  FitItineraryActivityValidation,
} from '@prisma/client'
import type { ProductJsonLdItineraryItem } from '@/app/components/seo/ProductJsonLd'
import { PRODUCT_DETAIL_PAGE_INCLUDE } from '@/lib/product-detail-page-include'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'

export type ProductDetailScheduleProductRow = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_DETAIL_PAGE_INCLUDE
}>

export type FitMasterWithDays = FitItineraryMaster & {
  days: (FitItineraryDay & {
    activities: (FitItineraryActivity & {
      validation: FitItineraryActivityValidation | null
    })[]
  })[]
}

type ProductDetailItineraryDayRow = NonNullable<ProductDetailScheduleProductRow['itineraryDays']>[number]

export function mapFitMasterForItinerary(fitMaster: FitMasterWithDays) {
  return {
    id: fitMaster.id,
    title: fitMaster.title,
    summary: fitMaster.summary ?? '',
    totalDays: fitMaster.totalDays,
    persona: fitMaster.persona as 'mixed' | 'couple' | 'with-parents' | 'with-kids',
    cityNameKo: fitMaster.cityNameKo,
    productId: fitMaster.productId,
    days: fitMaster.days.map((d) => ({
      id: d.id,
      dayNumber: d.dayNumber,
      title: d.title,
      summary: d.summary ?? '',
      activities: d.activities.map((act) => ({
        id: act.id,
        order: act.order,
        category: act.category as
          | 'transport'
          | 'hotel'
          | 'meal'
          | 'attraction'
          | 'shopping'
          | 'tip'
          | 'leisure',
        title: act.title,
        description: act.description ?? '',
        location: act.location,
        startTime: act.startTime ?? '',
        durationMinutes: act.durationMinutes ?? 0,
        estimatedCostKrw: act.estimatedCostKrw ?? 0,
        estimatedCostNote: act.estimatedCostNote,
        transportMode: act.transportMode,
        transportDuration: act.transportDuration,
        transportCostKrw: act.transportCostKrw,
      })),
    })),
  }
}

function itineraryDayMetaByDay(days: readonly ProductDetailItineraryDayRow[]): Map<number, ProductDetailItineraryDayRow> {
  const m = new Map<number, ProductDetailItineraryDayRow>()
  for (const d of days) {
    const k = Math.floor(Number(d.day))
    if (Number.isFinite(k) && k >= 1) m.set(k, d)
  }
  return m
}

function coalesceItineraryOrScheduleText(
  db: string | null | undefined,
  fromScheduleJson: string | null | undefined
): string | null {
  const a = typeof db === 'string' ? db.trim() : ''
  if (a) return a
  const b = typeof fromScheduleJson === 'string' ? fromScheduleJson.trim() : ''
  return b || null
}

export function mergeProductDetailSchedule(travelProduct: ProductDetailScheduleProductRow) {
  const itineraryDaysList = travelProduct.itineraryDays ?? []
  const scheduleArr = getScheduleFromProduct(travelProduct)
  const dayMeta = itineraryDayMetaByDay(itineraryDaysList)
  const scheduleMergedBase =
    scheduleArr.length > 0
      ? scheduleArr.map((s) => {
          const sk = Math.floor(Number(s.day))
          const iday = Number.isFinite(sk) && sk >= 1 ? dayMeta.get(sk) : undefined
          /** ItineraryDay가 비어 있으면 Product.schedule JSON에 넣어 둔 식사·숙소(모두투어 confirm)로 보조 */
          return {
            ...s,
            city: iday?.city?.trim() || null,
            hotelText: coalesceItineraryOrScheduleText(iday?.hotelText, s.hotelText),
            breakfastText: coalesceItineraryOrScheduleText(iday?.breakfastText, s.breakfastText),
            lunchText: coalesceItineraryOrScheduleText(iday?.lunchText, s.lunchText),
            dinnerText: coalesceItineraryOrScheduleText(iday?.dinnerText, s.dinnerText),
            mealSummaryText: coalesceItineraryOrScheduleText(iday?.mealSummaryText, s.mealSummaryText),
            meals: coalesceItineraryOrScheduleText(iday?.meals, s.meals),
          }
        })
      : []
  const scheduleMerged = scheduleMergedBase
  const seoItinerary: ProductJsonLdItineraryItem[] =
    scheduleMerged.length > 0
      ? scheduleMerged.flatMap((s, idx) => {
          const rawDay = Number(s.day)
          const dayNum = Number.isFinite(rawDay) && rawDay >= 1 ? Math.floor(rawDay) : idx + 1
          const fromTitle = typeof s.title === 'string' ? s.title.trim() : ''
          const descFirst =
            typeof s.description === 'string'
              ? (s.description
                  .trim()
                  .split(/\r?\n/)
                  .find((ln) => ln.trim().length > 0) ?? ''
                ).trim()
              : ''
          const title = (fromTitle || descFirst || `제${dayNum}일`).slice(0, 240).trim()
          if (!title) return []
          const cityField = (s as { city?: string | null }).city
          const city: string | null =
            typeof cityField === 'string' && cityField.trim() ? cityField.trim() : null
          const row: ProductJsonLdItineraryItem = { dayNumber: dayNum, title, city }
          return [row]
        })
      : []
  const schedule = scheduleMerged.length > 0 ? scheduleMerged : null

  return { scheduleMerged, schedule, seoItinerary }
}
