/**
 * 등록대기 — countryKey≠일정 불일치 시 메가메뉴 geo 재부여 + 귀국일 day-title 독 스크럽.
 * 격리(pre_photo_blocked)만 하지 않고 셀프힐 경로에서 교정한다.
 *
 * REGRESSION-FREEZE[register-pre-photo-country-schedule-self-heal]: mismatch→geo rematerialize — manifest
 */
import type { Prisma } from '@prisma/client'
import type { RegisterPrePhotoHealRow } from '@/lib/register-pre-photo-guards'
import {
  productCountryScheduleMismatchIssues,
  registerPrePhotoScheduleCountryHaystack,
  strongOtherCountryKeysFromHay,
} from '@/lib/register-pre-photo-product-country-schedule-guard'
import {
  countryKeyIncompatibleWithRegionCluster,
  detectActiveRegisterGeoRegionCluster,
  regionClusterHealNudge,
  isPoisonedRegionClusterDestination,
} from '@/lib/register-geo-region-clusters'
import { registerGeoTagSyncOpts, resolveMegaMenuGeoForRegister } from '@/lib/register-resolve-mega-menu-geo'
import { syncProductGeoTagsForRegister } from '@/lib/sync-product-geo-tags'
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'
import { isRegisterPrePhotoPlaceLikeDestination } from '@/lib/register-schedule-cross-continent-keyword-guard'
// REGRESSION-FREEZE[register-geo-region-clusters]: 발틱≠poland·권역 클러스터 — manifest

export type CountryScheduleHealRow = RegisterPrePhotoHealRow & {
  title?: string | null
}

/** 귀국·허브 환각 day title — geo hay에서 제외 */
const POISON_RETURN_DAY_TITLE_RE =
  /^(?:쿠알라룸푸르|kuala\s*lumpur|인천|귀국|상세보기|포함|예약\s*시\s*참고사항)$/i

export function isPoisonReturnScheduleDayTitle(title: string | null | undefined): boolean {
  const t = String(title ?? '').trim()
  if (!t) return true
  if (POISON_RETURN_DAY_TITLE_RE.test(t)) return true
  // 짧은 단독 허브명
  if (/^(?:두바이|dubai|이스탄불|istanbul)$/i.test(t)) return true
  return false
}

/** day title 환각 제외 — 제목·목적지·route·description + (독이 아닌) day title. */
export function buildCountryScheduleSelfHealHaystack(args: {
  productTitle?: string | null
  productDestination?: string | null
  rows: readonly CountryScheduleHealRow[]
}): string {
  const base = registerPrePhotoScheduleCountryHaystack(
    args.productTitle,
    args.productDestination,
    args.rows,
  )
  const dayTitles = (args.rows ?? [])
    .map((r) => String(r.title ?? '').trim())
    .filter((t) => t && !isPoisonReturnScheduleDayTitle(t))
  return [base, ...dayTitles].join('\n').trim()
}

/**
 * 일정 day title 독 스크럽:
 * - countryKey와 다른 강한 나라만 가리키고 그날 본문에 증거 없음
 * - 쿠알라룸푸르 (malaysia 제외)
 * - 상세보기 등 운영 플레이스홀더
 * - 귀국일 단독 허브(두바이/이스탄불) — 해당 국가가 아닐 때
 */
export function scrubPoisonedScheduleDayTitlesForCountryKey(args: {
  countryKey: string | null | undefined
  rows: CountryScheduleHealRow[]
}): { rows: CountryScheduleHealRow[]; scrubbedDays: number[] } {
  const ck = String(args.countryKey ?? '').trim()
  const scrubbedDays: number[] = []
  const maxDay = Math.max(0, ...args.rows.map((r) => Number(r.day) || 0))

  const rows = args.rows.map((row) => {
    const title = String(row.title ?? '').trim()
    if (!title) return row
    const day = Number(row.day) || 0
    const dayBody = `${row.routeText ?? ''}\n${row.description ?? ''}`

    if (/^상세보기$|^포함$|^예약\s*시\s*참고사항$/i.test(title)) {
      scrubbedDays.push(day)
      return { ...row, title: null }
    }

    if (/쿠알라룸푸르|kuala\s*lumpur/i.test(title) && ck !== 'malaysia') {
      if (!/쿠알라|kuala|말레이|malaysia/i.test(dayBody)) {
        scrubbedDays.push(day)
        return { ...row, title: null }
      }
    }

    if (
      day === maxDay &&
      /^(?:두바이|dubai|이스탄불|istanbul)$/i.test(title) &&
      ck !== 'united-arab-emirates' &&
      ck !== 'dubai' &&
      ck !== 'turkey'
    ) {
      scrubbedDays.push(day)
      return { ...row, title: null }
    }

    if (!ck) return row
    const titleOthers = strongOtherCountryKeysFromHay(title, ck)
    if (titleOthers.length === 0) return row
    const bodySupportsPoison = titleOthers.some((k) =>
      strongOtherCountryKeysFromHay(dayBody, ck).includes(k),
    )
    if (bodySupportsPoison) return row
    scrubbedDays.push(day)
    return { ...row, title: null }
  })
  return { rows, scrubbedDays: [...new Set(scrubbedDays)] }
}

export function pendingNeedsCountryScheduleGeoHeal(args: {
  countryKey?: string | null
  productTitle?: string | null
  productDestination?: string | null
  rows: readonly CountryScheduleHealRow[]
}): boolean {
  const ck = String(args.countryKey ?? '').trim()
  if (
    productCountryScheduleMismatchIssues({
      countryKey: args.countryKey,
      productTitle: args.productTitle,
      productDestination: args.productDestination,
      rows: args.rows,
    }).length > 0
  ) {
    return true
  }
  // countryKey 비어 있는데 일정·제목에 강한 나라 힌트가 있으면 geo 재부여
  if (!ck) {
    const hay = buildCountryScheduleSelfHealHaystack({
      productTitle: args.productTitle,
      productDestination: args.productDestination,
      rows: args.rows,
    })
    if (strongOtherCountryKeysFromHay(hay, null).length > 0) return true
  }
  return false
}

export type RematerializePendingCountryGeoResult = {
  geo: ProductLocationKeyPrismaFields
  changed: boolean
  previousCountryKey: string | null
  haystack: string
}

const COUNTRY_KEY_HEAL_LABEL: Readonly<Record<string, string>> = {
  china: '중국',
  vietnam: '베트남',
  philippines: '필리핀',
  malaysia: '말레이시아',
  japan: '일본',
  canada: '캐나다',
  'united-states': '미국',
  poland: '폴란드',
  lithuania: '리투아니아',
  latvia: '라트비아',
  estonia: '에스토니아',
  czech: '체코',
  austria: '오스트리아',
  hungary: '헝가리',
  turkey: '터키',
  italy: '이탈리아',
  spain: '스페인',
  portugal: '포르투갈',
  france: '프랑스',
  germany: '독일',
  switzerland: '스위스',
  egypt: '이집트',
  tunisia: '튀니지',
  mongolia: '몽골',
  india: '인도',
  australia: '호주',
  thailand: '태국',
  indonesia: '인도네시아',
  cambodia: '캄보디아',
  'hong-kong': '홍콩',
  macau: '마카오',
  taiwan: '대만',
  singapore: '싱가포르',
  iceland: '아이슬란드',
  greece: '그리스',
  'united-kingdom': '영국',
  'united-arab-emirates': '아랍에미리트',
}

/**
 * 일정 본문 기준으로 countryKey 등 메가메뉴 geo를 다시 잡는다.
 * 잘못된 메가메뉴 슬롯·poison destinationRaw는 버리고 title+본문만 쓴다.
 */
export async function rematerializePendingProductCountryGeo(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  args: {
    productId: string
    title: string
    originSource?: string | null
    productDestination?: string | null
    previousCountryKey?: string | null
    rows: readonly CountryScheduleHealRow[]
    dryRun?: boolean
  },
): Promise<RematerializePendingCountryGeoResult> {
  const dest = String(args.productDestination ?? '').trim()
  // 이전 힐이 심은 권역 넛지 dest 는 버려 제목·본문으로 재해석
  const destPoisoned = isPoisonedRegionClusterDestination(dest)
  const placeDest =
    !destPoisoned && dest && isRegisterPrePhotoPlaceLikeDestination(dest) ? dest : null
  const haystack = buildCountryScheduleSelfHealHaystack({
    productTitle: args.title,
    productDestination: placeDest,
    rows: args.rows,
  })
  const cluster = detectActiveRegisterGeoRegionCluster({
    hay: haystack,
    productTitle: args.title,
  })
  const clusterNudge = cluster ? regionClusterHealNudge(cluster) : null
  const hintKeys = strongOtherCountryKeysFromHay(haystack, null)
  const hintLabel =
    clusterNudge?.label ??
    hintKeys.map((k) => COUNTRY_KEY_HEAL_LABEL[k]).find(Boolean) ??
    null
  const geoInput = {
    title: args.title,
    originSource: args.originSource ?? null,
    destination: placeDest || clusterNudge?.label || null,
    destinationRaw: placeDest || clusterNudge?.label || null,
    primaryDestination: placeDest || clusterNudge?.label || null,
    bodyText: clusterNudge
      ? `${haystack}\n${clusterNudge.label}`.trim()
      : haystack || null,
  }
  let { geo } = await resolveMegaMenuGeoForRegister(db, geoInput)
  // 태항·보천 등 메가메뉴 토큰 미달 시 강한 나라 힌트 라벨을 붙여 재해석
  if (!String(geo.countryKey ?? '').trim() && hintLabel) {
    const retryInput = {
      ...geoInput,
      destination: hintLabel,
      destinationRaw: hintLabel,
      primaryDestination: hintLabel,
      bodyText: `${haystack}\n${hintLabel}`.trim() || hintLabel,
    }
    const retry = await resolveMegaMenuGeoForRegister(db, retryInput)
    geo = retry.geo
    Object.assign(geoInput, retryInput)
  }
  // 권역 다국가 — resolve가 poland 등 hub/단일국을 내도 regionalKey 강제
  // REGRESSION-FREEZE[register-geo-region-clusters]: 발틱≠poland·권역 클러스터 — manifest
  if (
    cluster &&
    clusterNudge?.regionalKey &&
    countryKeyIncompatibleWithRegionCluster({
      countryKey: String(geo.countryKey ?? ''),
      cluster,
      hay: haystack,
      productTitle: args.title,
    })
  ) {
    geo = {
      ...geo,
      countryKey: clusterNudge.regionalKey,
      country: clusterNudge.label,
      city: null,
      cityKey: null,
      nodeKey: cluster.id === 'nordic_baltic' ? 'baltic3' : geo.nodeKey,
      groupKey: geo.groupKey ?? 'europe-me-africa',
      continent: geo.continent ?? 'europe-me-africa',
      locationMatchSource: 'register-region-cluster-heal',
      locationMatchConfidence: 'high',
    }
  }
  const previousCountryKey = String(args.previousCountryKey ?? '').trim() || null
  const nextCk = String(geo.countryKey ?? '').trim() || null
  const changed = nextCk !== previousCountryKey

  if (!args.dryRun && (changed || nextCk)) {
    await db.product.update({
      where: { id: args.productId },
      data: {
        countryKey: geo.countryKey,
        continentKey: geo.continentKey,
        cityKey: geo.cityKey,
        nodeKey: geo.nodeKey,
        groupKey: geo.groupKey,
        continent: geo.continent,
        country: geo.country,
        city: geo.city,
        locationMatchConfidence: geo.locationMatchConfidence,
        locationMatchSource: geo.locationMatchSource,
        ...(placeDest || hintLabel
          ? {
              destination: placeDest || hintLabel,
              destinationRaw: placeDest || hintLabel,
              primaryDestination: placeDest || hintLabel,
            }
          : {}),
      },
    })
    await syncProductGeoTagsForRegister(
      db,
      args.productId,
      geo,
      registerGeoTagSyncOpts(geoInput, String(geoInput.bodyText ?? haystack ?? '') || null),
    )
  }

  return { geo, changed, previousCountryKey, haystack }
}
