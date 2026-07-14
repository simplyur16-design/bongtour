/**
 * Hawaii package — TIP/example/free days get a recommended example itinerary (routeText)
 * and imageKeyword / imageKeyword2 from that example route.
 * REGRESSION-FREEZE[register-schedule-hawaii-free-day-example-itinerary]: manifest
 */
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

export type HawaiiFreeDayExampleRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

export type HawaiiFreeDayExampleItinerary = {
  /** Recommended route for UI + keyword SSOT */
  recommendedRoute: string
  imageKeyword: string
  imageKeyword2: string | null
}

/** Neighbor-island + Oahu free-day example packs (assigned in order to TIP days) */
// REGRESSION-FREEZE[register-schedule-hawaii-free-day-example-itinerary]: recommended example packs — manifest
export const HAWAII_FREE_DAY_EXAMPLE_ITINERARIES: readonly HawaiiFreeDayExampleItinerary[] = [
  {
    recommendedRoute: '이웃섬 선택관광 예시 - 마우이 - 로드 투 하나 - 와이레아 비치',
    imageKeyword: 'Road to Hana Maui Hawaii',
    imageKeyword2: 'Maui Wailea Beach Hawaii',
  },
  {
    recommendedRoute: '오아후 자유일정 예시 - 진주만 - 다이아몬드헤드',
    imageKeyword: 'Pearl Harbor USS Arizona Memorial Hawaii',
    imageKeyword2: 'Diamond Head Honolulu crater view',
  },
  {
    recommendedRoute: '오아후 자유일정 예시 - 노스쇼어 - 폴리네시안 문화센터',
    imageKeyword: 'North Shore Oahu Surf Beach',
    imageKeyword2: 'Polynesian Cultural Center Oahu Hawaii',
  },
  {
    recommendedRoute: '오아후 자유일정 예시 - 하나우마베이 - 와이키키 비치',
    imageKeyword: 'Hanauma Bay Oahu snorkeling',
    imageKeyword2: 'Honolulu Waikiki Beach',
  },
]

const HAWAII_TRIP_RE =
  /하와이|Hawaii|호놀룰루|Honolulu|오아후|Oahu|와이키키|Waikiki|마우이|Maui/i

/** Concrete POIs — TIP day still treated as tourism when these appear without example/neighbor island */
const HAWAII_CONCRETE_POI_RE =
  /이올라니|Iolani|카카오코|Kakaako|파인애플|Pineapple|72번|국도|카후쿠|Kahuku|와이켈레|Waikele|진주만|Pearl\s*Harbor|다이아몬드|Diamond\s*Head|하나우마|Hanauma|노스\s*쇼어|North\s*Shore|폴리네시안|Polynesian|할로나|Halona|와이키키\s*비치/i

const YBTOUR_TIP_OR_EXAMPLE_RE =
  /＃?\s*노랑풍선\s*TIP|예시\s*\)|예시\)|자유\s*일정|자유일정|free\s*time|at\s+leisure|이웃섬|이웃\s*섬/i

export function isHawaiiPackageScheduleTrip(
  rows: readonly HawaiiFreeDayExampleRow[],
  productDestination?: string | null,
  productTitle?: string | null,
): boolean {
  const dest = `${productDestination ?? ''} ${productTitle ?? ''}`
  if (HAWAII_TRIP_RE.test(dest)) return true
  return rows.some((r) =>
    HAWAII_TRIP_RE.test(`${r.title ?? ''} ${r.routeText ?? ''} ${r.description ?? ''}`),
  )
}

export function buildHawaiiDayHaystack(row: HawaiiFreeDayExampleRow): string {
  return [row.title, row.description, row.routeText]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * ybtour TIP / example neighbor-island / thin Oahu free day — needs recommended example itinerary.
 * REGRESSION-FREEZE[register-schedule-hawaii-free-day-example-itinerary]: tip/example free day detect — manifest
 */
export function isHawaiiTipOrExampleFreeDay(row: HawaiiFreeDayExampleRow): boolean {
  const hay = buildHawaiiDayHaystack(row)
  if (!hay.trim()) return false
  if (!HAWAII_TRIP_RE.test(hay) && !/오아후|Oahu/i.test(hay)) return false
  if (/이웃섬|이웃\s*섬|예시\s*\)|예시\)/i.test(hay)) return true
  if (HAWAII_CONCRETE_POI_RE.test(hay)) return false
  if (YBTOUR_TIP_OR_EXAMPLE_RE.test(hay)) return true
  const route = String(row.routeText ?? '').trim()
  if (/^오아후(?:\s*-\s*＃?\s*노랑풍선\s*TIP)?$/i.test(route)) return true
  return false
}

function pickHawaiiFreeDayExample(
  freeDayIndex: number,
  haystack: string,
  usedPrimary: ReadonlySet<string>,
): HawaiiFreeDayExampleItinerary {
  const packs = HAWAII_FREE_DAY_EXAMPLE_ITINERARIES
  if (/이웃섬|이웃\s*섬/i.test(haystack)) {
    const neighbor = packs[0]!
    const nk = normScheduleImageKeywordKey(neighbor.imageKeyword)
    if (!usedPrimary.has(nk)) return neighbor
  }
  for (let offset = 0; offset < packs.length; offset++) {
    const idx = (Math.max(0, freeDayIndex) + offset) % packs.length
    const pack = packs[idx]!
    const nk = normScheduleImageKeywordKey(pack.imageKeyword)
    if (!usedPrimary.has(nk)) return pack
  }
  return packs[Math.max(0, freeDayIndex) % packs.length]!
}

/**
 * TIP/example free days — set recommendedRoute as routeText and lock imageKeyword 1·2 from the pack.
 * Tourism days with concrete POIs and return/airport days are left unchanged.
 */
export function applyHawaiiFreeDayRecommendedExampleItineraries<T extends HawaiiFreeDayExampleRow>(
  rows: T[],
  opts?: { productDestination?: string | null; productTitle?: string | null },
): T[] {
  if (!rows.length) return rows
  if (!isHawaiiPackageScheduleTrip(rows, opts?.productDestination, opts?.productTitle)) return rows

  const maxDay = Math.max(...rows.map((r) => Number(r.day)).filter((d) => d > 0), 0)
  const usedPrimary = new Set<string>()
  for (const row of rows) {
    if (isHawaiiTipOrExampleFreeDay(row)) continue
    const nk = normScheduleImageKeywordKey(String(row.imageKeyword ?? '').trim())
    if (nk) usedPrimary.add(nk)
  }

  let freeIdx = 0
  return rows.map((row) => {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) return row
    if (maxDay >= 2 && day === maxDay) return row
    if (!isHawaiiTipOrExampleFreeDay(row)) return row
    if (
      /국제공항|공항\s*출발|기내박|숙박\s*없음|귀국/i.test(
        `${row.title ?? ''} ${row.routeText ?? ''}`,
      )
    ) {
      return row
    }

    const hay = buildHawaiiDayHaystack(row)
    const pack = pickHawaiiFreeDayExample(freeIdx, hay, usedPrimary)
    freeIdx += 1
    const pk = normScheduleImageKeywordKey(pack.imageKeyword)
    if (pk) usedPrimary.add(pk)
    const sk = pack.imageKeyword2
      ? normScheduleImageKeywordKey(pack.imageKeyword2)
      : ''
    if (sk) usedPrimary.add(sk)

    // REGRESSION-FREEZE[register-schedule-hawaii-free-day-example-itinerary]: tip/example free day detect — manifest
    return {
      ...row,
      routeText: pack.recommendedRoute,
      imageKeyword: pack.imageKeyword,
      imageKeyword2: pack.imageKeyword2,
    }
  })
}
