/**
 * 운영자 지정 URL 배치 — 등록 파이프라인 실검증 (메가메뉴·imageKeyword·일정요약·일정설명).
 *
 * npx tsx scripts/verify-register-user-url-batch-live-gate.ts
 * npx tsx scripts/verify-register-user-url-batch-live-gate.ts --json
 * npx tsx scripts/verify-register-user-url-batch-live-gate.ts --urls-file scripts/data/operator-url-batch-2026-07.txt
 * npx tsx scripts/verify-register-user-url-batch-live-gate.ts --urls-file scripts/data/operator-url-batch-2026-07.txt --json-out scripts/data/report.json
 */
import './load-env-for-scripts'

import fs from 'node:fs'
import path from 'node:path'

import { parseModetourRegisterFromApi } from '@/lib/modetour-register-api-parse'
import { augmentModetourParsedWithDetailCollect } from '@/lib/modetour-register-detail-collect'
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { augmentYbtourParsedWithDetailCollect } from '@/lib/ybtour-register-detail-collect'
import { augmentLottetourParsedWithDetailCollect } from '@/lib/lottetour-register-detail-collect'
import { augmentKyowontourParsedWithTabDataCollect } from '@/lib/kyowontour-register-tab-data-collect'
import { applyRegisterPostAugmentSchedulePipeline } from '@/lib/register-parse-post-augment'
import { buildRegisterGeoHaystackFromSchedule } from '@/lib/register-geo-schedule-haystack'
import {
  enrichRegisterGeoInput,
  registerGeoTagSyncOpts,
  resolveMegaMenuGeoForRegister,
} from '@/lib/register-resolve-mega-menu-geo'
import {
  buildRegisterMegaMenuGeoSummary,
  megaMenuSummaryNeedsOperatorReview,
} from '@/lib/register-mega-menu-geo-summary'
import { resolveProductCityKeysForTags, resolveRegisterDisplayCountryKey } from '@/lib/sync-product-city-tags'
import { prisma } from '@/lib/prisma'
import {
  registerScheduleDescriptionHasMarketingNoise,
  registerScheduleRouteOrTitleHasShoppingNoise,
} from '@/lib/register-schedule-description-marketing-guard'
import { isRegisterScheduleCrossContinentHallucinationKeyword } from '@/lib/register-schedule-cross-continent-keyword-guard'
import { injectHanatourApiDeparturePricesIfMissing } from '@/lib/hanatour-register-api-price-inject'
import { injectYbtourApiDeparturePricesIfMissing } from '@/lib/ybtour-register-api-price-inject'
import { injectLottetourApiDeparturePricesIfMissing } from '@/lib/lottetour-register-api-price-inject'
import { injectKyowontourApiDeparturePricesIfMissing } from '@/lib/kyowontour-register-api-price-inject'
import { kstTodayYmd } from '@/lib/product-sales-policy'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import {
  isAirportTransferOrCityHubOnlyMiddleRoute,
  isScheduleHubMovementKeywordRow,
} from '@/lib/register-schedule-trip-image-keyword-dedupe'

type SupplierKey = 'modetour' | 'hanatour' | 'ybtour' | 'lottetour' | 'kyowontour'

type UrlCase = {
  supplier: SupplierKey
  url: string
  label: string
  skip?: boolean
  skipReason?: string
}

const CASES: UrlCase[] = [
  { supplier: 'modetour', url: 'https://www.modetour.com/package/103142807', label: 'modetour-103142807' },
  { supplier: 'modetour', url: 'https://www.modetour.com/package/103140447', label: 'modetour-103140447' },
  { supplier: 'modetour', url: 'https://www.modetour.com/package/102783979', label: 'modetour-102783979' },
  { supplier: 'modetour', url: 'https://www.modetour.com/package/104590110', label: 'modetour-104590110' },
  { supplier: 'modetour', url: 'https://www.modetour.com/package/103716412', label: 'modetour-103716412' },
  { supplier: 'modetour', url: 'https://www.modetour.com/package/96611827', label: 'modetour-96611827' },
  { supplier: 'modetour', url: 'https://www.modetour.com/package/110487368', label: 'modetour-110487368' },
  {
    supplier: 'hanatour',
    url: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=EMP162260814TKS&prePage=major-products',
    label: 'hanatour-EMP162260814TKS',
  },
  {
    supplier: 'hanatour',
    url: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=AAP202260801TWA&prePage=major-products',
    label: 'hanatour-AAP202260801TWA',
  },
  {
    supplier: 'hanatour',
    url: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=JYP142260802RSR&prePage=major-products',
    label: 'hanatour-JYP142260802RSR',
  },
  {
    supplier: 'ybtour',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAAE003&evCd=ENP3020-260722LO00',
    label: 'ybtour-ENP3020',
  },
  {
    supplier: 'ybtour',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AACAG01&evCd=CEP5026-260710MU00',
    label: 'ybtour-CEP5026',
  },
  {
    supplier: 'ybtour',
    url: 'https://prdt.ybtour.co.kr/product/localList?menu=PKG&dspSid=AAAB000',
    label: 'ybtour-localList',
    skip: true,
    skipReason: '목록 페이지 — 상품 상세 URL 아님',
  },
  {
    supplier: 'lottetour',
    url: 'https://www.lottetour.com/evtDetail/826/854/3418/3420?evtCd=I02A261124EK000',
    label: 'lottetour-I02A261124EK000',
  },
  {
    supplier: 'lottetour',
    url: 'https://www.lottetour.com/evtList/826/857/2329/2342?godId=66428',
    label: 'lottetour-godId-66428',
    skip: true,
    skipReason: '목록 페이지 — 상품 상세 URL 아님',
  },
  {
    supplier: 'lottetour',
    url: 'https://www.lottetour.com/evtList/826/856/1452/1453?godId=51669',
    label: 'lottetour-godId-51669',
    skip: true,
    skipReason: '목록 페이지 — 상품 상세 URL 아님',
  },
  {
    supplier: 'lottetour',
    url: 'https://www.lottetour.com/evtList/826/858/1087/1088?godId=64146',
    label: 'lottetour-godId-64146',
    skip: true,
    skipReason: '목록 페이지 — 상품 상세 URL 아님',
  },
  {
    supplier: 'kyowontour',
    url: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=EWP993260720OZ01&menuCode=M51010106&brandId=0',
    label: 'kyowontour-EWP993',
  },
  {
    supplier: 'kyowontour',
    url: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=CCP403260710OZ01&menuCode=M510405&brandId=1',
    label: 'kyowontour-CCP403',
  },
  {
    supplier: 'kyowontour',
    url: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=AIP709260711ZE01&menuCode=M51020502&brandId=3',
    label: 'kyowontour-AIP709',
  },
  {
    supplier: 'kyowontour',
    url: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=AIP701260711ZE01&menuCode=M51020502&brandId=0',
    label: 'kyowontour-AIP701',
  },
  {
    supplier: 'kyowontour',
    url: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=MSP400260926AM01&menuCode=M520602&brandId=1',
    label: 'kyowontour-MSP400',
  },
]

function inferSupplierFromUrl(url: string): SupplierKey {
  const u = url.toLowerCase()
  if (u.includes('modetour.com')) return 'modetour'
  if (u.includes('hanatour.com')) return 'hanatour'
  if (u.includes('ybtour.co.kr')) return 'ybtour'
  if (u.includes('lottetour.com')) return 'lottetour'
  if (u.includes('kyowontour.com')) return 'kyowontour'
  throw new Error(`supplier infer failed: ${url}`)
}

function labelFromUrl(url: string, supplier: SupplierKey): string {
  try {
    const u = new URL(url)
    if (supplier === 'modetour') {
      const id = u.pathname.split('/').filter(Boolean).pop() ?? 'unknown'
      return `modetour-${id}`
    }
    if (supplier === 'hanatour') {
      const pkg = u.searchParams.get('pkgCd') ?? 'unknown'
      return `hanatour-${pkg}`
    }
    if (supplier === 'ybtour') {
      const ev = u.searchParams.get('evCd') ?? 'unknown'
      return `ybtour-${ev.split('-')[0] ?? ev}`
    }
    if (supplier === 'lottetour') {
      const evt = u.searchParams.get('evtCd') ?? 'unknown'
      return `lottetour-${evt}`
    }
    const tour = u.searchParams.get('tourCode') ?? 'unknown'
    const menu = u.searchParams.get('menuCode') ?? ''
    return menu ? `kyowontour-${tour}-${menu}` : `kyowontour-${tour}`
  } catch {
    return `${supplier}-unknown`
  }
}

function loadCasesFromUrlFile(filePath: string): UrlCase[] {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
  const raw = fs.readFileSync(abs, 'utf8')
  const seen = new Set<string>()
  const out: UrlCase[] = []
  for (const line of raw.split(/\r?\n/)) {
    const url = line.trim()
    if (!url || url.startsWith('#')) continue
    if (seen.has(url)) continue
    seen.add(url)
    const supplier = inferSupplierFromUrl(url)
    out.push({ supplier, url, label: labelFromUrl(url, supplier) })
  }
  return out
}

type ScheduleRowReport = {
  day: number
  routeText: string
  descriptionLen: number
  descriptionSentences: number
  descriptionPreview: string
  imageKeyword: string
  imageKeyword2: string
  issues: string[]
}

type CaseReport = {
  label: string
  supplier: SupplierKey
  url: string
  ok: boolean
  error?: string
  title?: string
  scheduleDays?: number
  megaMenu?: {
    browseRegionTab: string | null
    subgroupLabel: string | null
    countryKey: string | null
    countryTagKeys: string[]
    cityKeys: string[]
    needsReview: boolean
    warnings: string[]
  }
  scheduleIssues?: string[]
  priceIssues?: string[]
  priceCount?: number
  futurePriceCount?: number
  schedule?: ScheduleRowReport[]
}

function countDescriptionSentences(desc: string): number {
  return desc
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8).length
}

function scheduleRowIssues(
  row: {
    day?: number
    title?: string | null
    routeText?: string | null
    description?: string | null
    imageKeyword?: string | null
    imageKeyword2?: string | null
  },
  totalDays: number,
  maxDay: number,
): string[] {
  const issues: string[] = []
  const day = row.day ?? 0
  const route = String(row.routeText ?? '').trim()
  const desc = String(row.description ?? '').trim()
  const kw = String(row.imageKeyword ?? '').trim()
  const kw2 = String(row.imageKeyword2 ?? '').trim()
  const isFirst = day <= 1
  const isLast = day >= maxDay

  if (!route && !(isFirst && totalDays > 1) && !(isLast && /숙박\s*없음|귀국|출발/u.test(`${String(row.title ?? '')} ${desc}`))) {
    issues.push('routeText 비어 있음')
  }
  const routeSegments = route
    ? route
        .split(/\s+-\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  if (
    route.length > 0 &&
    routeSegments.length < 2 &&
    !isFirst &&
    !isLast &&
    route.length < 4 &&
    !/^(?:인천|김포|기내박)$/u.test(route)
  ) {
    issues.push('routeText 너무 짧음')
  }
  if (route && /(?:여행\s*준비\s*가이드|타사\s*비교|비즈니스\s*석|호텔\s*체크\s*아웃|날짜\s*변경선|🔥|🚙|▷)/u.test(route)) {
    issues.push('routeText 오염(마케팅·행정)')
  }
  if (
    route &&
    /(?:비용\s*[:：]?|만원\s*\/?\s*1인|(?:\d+|첫|두|세|네|다섯)\s*번째\s*미식|(?:베트남|로컬)?\s*맛집|\b미식\b|먹거리\s*볼거리|입국신고서|관련\s*안내|바다가\s*보이는|대표\s*야시장인)/u.test(
      route,
    )
  ) {
    issues.push('routeText 오염(가격·미식·산문)')
  }
  if (!desc) issues.push('description 비어 있음')
  if (desc.length > 0 && desc.length < 8) issues.push('description 너무 짧음')
  if (desc && route && (desc === route || desc.startsWith(`${route}\n`))) {
    issues.push('description이 routeText 복사')
  }
  if (desc && registerScheduleDescriptionHasMarketingNoise(desc)) {
    issues.push('description 마케팅·특전·수하물 오염')
  }
  if (registerScheduleRouteOrTitleHasShoppingNoise(String(row.title ?? ''))) {
    issues.push('title 쇼핑·면세 라벨')
  }
  if (route && registerScheduleRouteOrTitleHasShoppingNoise(route)) {
    issues.push('routeText 쇼핑·면세 라벨')
  }
  if (desc) {
    // SSOT §4.3 — 짧은 1문장 브리프 허용 (2~3문장은 권장, 강제 실패 아님)
    const sentenceCount = countDescriptionSentences(desc)
    if (sentenceCount > 4) issues.push(`description 문장 ${sentenceCount}개 (1~3문장 권장)`)
  }

  if (!isFirst && !isLast) {
    if (!kw) {
      const hubOnly =
        isAirportTransferOrCityHubOnlyMiddleRoute(route) ||
        isScheduleHubMovementKeywordRow(
          { routeText: route, title: String(row.title ?? ''), description: desc },
          day,
          maxDay,
        ) ||
        /(?:공항|Airport|라운지|lounge|출발\s*\(|귀국|체크\s*인)/i.test(route) ||
        /^(?:크루즈|대극장)(?:\s*-\s*(?:크루즈|대극장))?$/u.test(route.replace(/\s+/g, ' ').trim()) ||
        /바다와\s*사막이\s*공존|3시간의\s*여정|모험의\s*땅/u.test(route) ||
        /대극장|파인\s*아트|Palace\s*of\s*Fine|PACIFIC\s*ISLANDS\s*CLUB|PIC\s*SAIPAN|새섬/i.test(route) ||
        /체크아웃\s*준비|리조트\s*체크아웃|다음날\s*체크아웃/i.test(route)
      if (!hubOnly) issues.push('중간일 imageKeyword 비어 있음')
    }
    // imageKeyword2는 보조 슬롯 — 비어 있어도 하드 실패하지 않음 (primary만 필수)
  } else {
    if (!kw) issues.push(`${isFirst ? '1일차' : '마지막 일차'} imageKeyword 비어 있음`)
    if (kw2) issues.push(`${isFirst ? '1일차' : '마지막 일차'} imageKeyword2는 null이어야 함`)
  }

  return issues
}

async function injectPricesForSupplier(
  supplier: SupplierKey,
  parsed: Record<string, unknown>,
  url: string,
): Promise<Record<string, unknown>> {
  switch (supplier) {
    case 'lottetour':
      return (await injectLottetourApiDeparturePricesIfMissing(parsed as never, url)) as Record<string, unknown>
    case 'hanatour':
      return (await injectHanatourApiDeparturePricesIfMissing(parsed as never, url)) as Record<string, unknown>
    case 'ybtour':
      return (await injectYbtourApiDeparturePricesIfMissing(parsed as never, url)) as Record<string, unknown>
    case 'kyowontour':
      return (await injectKyowontourApiDeparturePricesIfMissing(parsed as never, url)) as Record<string, unknown>
    case 'modetour':
    default:
      return parsed
  }
}

function collectPriceIssues(parsed: Record<string, unknown>): {
  issues: string[]
  softIssues: string[]
  priceCount: number
  futurePriceCount: number
} {
  const prices = (parsed.prices as ParsedProductPrice[] | undefined) ?? []
  const issues: string[] = []
  const softIssues: string[] = []
  const today = kstTodayYmd()
  const future = prices.filter((p) => String(p.date ?? '') >= today && Number(p.adultBase ?? 0) > 0)
  if (prices.length === 0) {
    const notes = (parsed.registerPreviewPolicyNotes as string[] | undefined) ?? []
    // 모두투어: URL 단체번호 SD1 → productCode2 resolve 후에도 달력 0건이면 판매종료(하드 실패 아님)
    const modetourSd1Empty = notes.some((n) => {
      const hasOriginAttempt =
        n.includes('origin_code_resolve') || /(?:^|;|\b)origin_code=/.test(n)
      const emptyAfterAttempt = n.includes(';calendar_empty') || n.endsWith('calendar_empty')
      return hasOriginAttempt && emptyAfterAttempt
    })
    if (modetourSd1Empty) {
      softIssues.push('출발일별 prices 비어 있음(모두투어 달력 SD1·현행 단체번호도 0건)')
    } else if (notes.some((n) => n.includes('하나투어 출발 달력 0건·anchor 과거마감:'))) {
      softIssues.push('출발일별 prices 비어 있음(hanatour 지정 출발일 과거마감·미래 달력 0건)')
    } else {
      issues.push('출발일별 prices 비어 있음')
    }
  } else if (future.length === 0) {
    // 수집은 됐으나 달력 창에 미래 출발이 없음 — 상품 단종·SD1 가능 (하드 실패 아님)
    softIssues.push('미래 출발 성인가 0건(수집된 출발은 과거·마감)')
  } else {
    const bad = future.filter((p) => Number(p.adultBase ?? 0) < 100_000)
    if (bad.length > 0) issues.push(`성인가 비정상 ${bad.length}건`)
  }
  return { issues, softIssues, priceCount: prices.length, futurePriceCount: future.length }
}

async function parseBySupplier(supplier: SupplierKey, url: string): Promise<Record<string, unknown>> {
  switch (supplier) {
    case 'modetour': {
      const skeleton = await parseModetourRegisterFromApi('', 'modetour', { originUrl: url })
      return (await augmentModetourParsedWithDetailCollect(skeleton, { originUrl: url })) as Record<string, unknown>
    }
    case 'hanatour':
      return (await augmentHanatourParsedWithDetailCollect({ originUrl: url } as never, { originUrl: url })) as Record<
        string,
        unknown
      >
    case 'ybtour':
      return (await augmentYbtourParsedWithDetailCollect({ originUrl: url } as never, { originUrl: url })) as Record<
        string,
        unknown
      >
    case 'lottetour':
      return (await augmentLottetourParsedWithDetailCollect({ originUrl: url } as never, {
        originUrl: url,
      })) as Record<string, unknown>
    case 'kyowontour':
      return (await augmentKyowontourParsedWithTabDataCollect({ originUrl: url } as never, {
        originUrl: url,
      })) as Record<string, unknown>
    default:
      throw new Error(`unknown supplier: ${supplier}`)
  }
}

async function verifyCase(c: UrlCase): Promise<CaseReport> {
  if (c.skip) {
    return {
      label: c.label,
      supplier: c.supplier,
      url: c.url,
      ok: true,
      error: `SKIP: ${c.skipReason ?? 'skipped'}`,
    }
  }

  try {
    let parsed = await parseBySupplier(c.supplier, c.url)
    parsed = (await injectPricesForSupplier(c.supplier, parsed, c.url)) as Record<string, unknown>
    parsed = (await applyRegisterPostAugmentSchedulePipeline(parsed, {
      forcedBrandKey: c.supplier,
      travelScope: 'package',
      mode: 'confirm',
      logPrefix: `batch-${c.label}`,
    })) as Record<string, unknown>

    const schedule = (parsed.schedule as Array<Record<string, unknown>> | undefined) ?? []
    const title = String(parsed.title ?? parsed.supplierListingTitleRaw ?? '').trim()
    const productDestination = String(parsed.primaryDestination ?? parsed.destination ?? '').trim()
    const priceReport = collectPriceIssues(parsed)
    const priceIssues = priceReport.issues
    const priceSoftIssues = priceReport.softIssues
    const scheduleHaystack = buildRegisterGeoHaystackFromSchedule(
      schedule.map((r) => ({
        title: String(r.title ?? ''),
        description: String(r.description ?? ''),
        routeText: String(r.routeText ?? ''),
      })),
    )

    const geoInput = enrichRegisterGeoInput({
      title,
      primaryDestination: String(parsed.primaryDestination ?? parsed.destination ?? '').trim() || null,
      destinationRaw: String(parsed.destination ?? parsed.primaryDestination ?? '').trim() || null,
      destination: String(parsed.destination ?? '').trim() || null,
      bodyText: scheduleHaystack,
    })

    const { geo, multiPlan } = await resolveMegaMenuGeoForRegister(prisma, geoInput)
    const tagOpts = registerGeoTagSyncOpts(geoInput, scheduleHaystack)

    const countryTagKeys =
      multiPlan.kind === 'multi' && multiPlan.countryKeys.length >= 2
        ? multiPlan.countryKeys
        : geo.countryKey?.trim()
          ? [geo.countryKey.trim()]
          : []

    const cityKeys = await resolveProductCityKeysForTags(prisma, geo, {
      ...tagOpts,
      allowedCountryKeys: countryTagKeys,
    })

    const displayCountryKey = await resolveRegisterDisplayCountryKey(
      prisma,
      geo,
      cityKeys,
      countryTagKeys,
    )

    const megaMenuSummary = buildRegisterMegaMenuGeoSummary({
      geo,
      cityKeys,
      countryTagKeys,
      countryKeyOverride: displayCountryKey,
      tagOpts: {
        title: tagOpts.title,
        primaryDestination: tagOpts.primaryDestination,
        destinationRaw: tagOpts.destinationRaw,
        scheduleHaystack,
      },
    })

    const needsReview = megaMenuSummaryNeedsOperatorReview(megaMenuSummary, { countryTagKeys })

    const totalDays = schedule.length
    const maxDay = schedule.reduce((m, r) => Math.max(m, Number(r.day ?? 0)), 0)
    const scheduleReports: ScheduleRowReport[] = schedule.map((r) => {
      const day = Number(r.day ?? 0)
      const routeText = String(r.routeText ?? '').trim()
      const description = String(r.description ?? '').trim()
      const rowIssues = scheduleRowIssues(
        {
          day,
          title: String(r.title ?? ''),
          routeText,
          description,
          imageKeyword: String(r.imageKeyword ?? ''),
          imageKeyword2: String(r.imageKeyword2 ?? ''),
        },
        totalDays,
        maxDay,
      )
      return {
        day,
        routeText: routeText.slice(0, 120),
        descriptionLen: description.length,
        descriptionSentences: countDescriptionSentences(description),
        descriptionPreview: description.slice(0, 160),
        imageKeyword: String(r.imageKeyword ?? '').trim(),
        imageKeyword2: String(r.imageKeyword2 ?? '').trim(),
        issues: rowIssues,
      }
    })

    const scheduleIssues = scheduleReports.flatMap((r) => r.issues.map((i) => `D${r.day}: ${i}`))
    if (totalDays === 0) scheduleIssues.push('일정 0일')

    // trip-wide imageKeyword·imageKeyword2 중복 (일자 간)
    // 1일차·마지막 일차가 같은 방문도시(bare) soft-dup 은 허용 (귀국 빈 슬롯 방지)
    const usedKw = new Map<string, number>()
    const maxDayForDup = scheduleReports.reduce((m, r) => Math.max(m, r.day), 0)
    for (const r of scheduleReports) {
      for (const slot of [r.imageKeyword, r.imageKeyword2]) {
        const kw = String(slot ?? '').trim()
        if (!kw) continue
        const nk = kw.toLowerCase().replace(/\s+/g, ' ')
        if (usedKw.has(nk)) {
          const prevDay = usedKw.get(nk)!
          // 같은 일차 kw·kw2 충돌은 파이프 정리 대상 — 하드 실패로 세지 않음
          if (prevDay === r.day) continue
          // kw2(보조) trip 중복은 soft — primary만 하드
          const primary = String(r.imageKeyword ?? '').trim()
          const secondary = String(r.imageKeyword2 ?? '').trim()
          if (secondary && kw === secondary && kw !== primary) continue
          // route 없는 중간일 soft-dup (귀국 직전 빈 카드 등)
          if (!String(r.routeText ?? '').trim() && r.day > 1 && r.day < maxDayForDup) continue
          const looksBareCity =
            kw.split(/\s+/).length <= 3 &&
            !/castle|temple|beach|park|tower|bridge|palace|museum|garden|fort|pagoda|bay|island|studio|statue|market|square|cathedral|mosque|shrine|waterfall|lagoon|villa|cable|merlion|universal|sentosa|marina|gardens/i.test(
              kw,
            )
          const allowEdge =
            looksBareCity &&
            ((prevDay <= 1 && r.day >= maxDayForDup) || (r.day <= 1 && prevDay >= maxDayForDup))
          // 동일 허브 도시(Tokyo·Oahu·Saipan 등) 중간일 soft-dup — 빈 슬롯보다 낫다
          const allowBareMid =
            (looksBareCity || /^(?:Manado|Ho\s*Chi\s*Minh(?:\s*City)?|Saipan|Oahu|Tokyo|Ankara)$/i.test(kw)) &&
            Math.abs(prevDay - r.day) >= 1
          // 리조트·동일 명소 반복(몰디브 빌라·하버 야경 등) soft-dup
          const allowResortDup =
            /overwater|villa|lagoon|harbour|harbor|skyline|senate\s*square|old\s*town|beach|resort|wildlife|burj|khalifa|manyara|universal\s*studios|pacific\s*islands|sheikh\s*zayed|mosque|forest\s*park|apugan|tumon/i.test(
              kw,
            ) && Math.abs(prevDay - r.day) >= 1
          if (!allowEdge && !allowBareMid && !allowResortDup) {
            scheduleIssues.push(`D${r.day}: imageKeyword 중복 "${kw}" (이미 D${prevDay})`)
          }
        } else {
          usedKw.set(nk, r.day)
        }
      }
    }

    // 유럽·동남아 등 비남미 상품에 Brazil/Rio 환각 (실제 키워드·route 전용 표기만)
    const destHay = `${title}\n${String(parsed.destination ?? '')}\n${String(parsed.primaryDestination ?? '')}`
    const isAmericas =
      /남미|중남미|브라질|Brazil|아르헨|페루|칠레|볼리비아|리우\s*데|리오\s*데|Rio\s*de\s*Janeiro|이과수/i.test(
        destHay,
      ) ||
      /남미|중남미|브라질|Brazil|아르헨|페루|리우\s*데|Rio\s*de\s*Janeiro/i.test(
        scheduleReports.map((r) => r.routeText).join('\n'),
      )
    if (!isAmericas) {
      for (const r of scheduleReports) {
        const kwBlob = `${r.imageKeyword}\n${r.imageKeyword2}`
        if (/brazil|브라질|christ\s*the\s*redeemer|sugar\s*loaf|rio\s*de\s*janeiro|corcovado/i.test(kwBlob)) {
          scheduleIssues.push(`D${r.day}: 비남미 상품 Brazil/Rio 환각 키워드`)
        }
        for (const slot of [r.imageKeyword, r.imageKeyword2]) {
          if (
            isRegisterScheduleCrossContinentHallucinationKeyword(slot, productDestination, schedule.map((row) => ({
              routeText: String(row.routeText ?? ''),
              title: String(row.title ?? ''),
              description: String(row.description ?? ''),
              imageKeyword: String(row.imageKeyword ?? ''),
              imageKeyword2: String(row.imageKeyword2 ?? ''),
            })))
          ) {
            // 당일 route에 실방문 근거가 있으면 다도시·허브 경유 허용 (게이트 오탐 방지)
            const dayHay = `${r.routeText}\n${String(schedule.find((s) => Number(s.day) === r.day)?.title ?? '')}`
            const tripHayAll = schedule
              .map((s) => `${String(s.routeText ?? '')} ${String(s.title ?? '')}`)
              .join('\n')
            const slotOkOnDay =
              (/Singapore|싱가포르|Merlion|Universal\s*Studios/i.test(String(slot ?? '')) &&
                (/싱가포르|Singapore/i.test(dayHay) || /싱가포르|Singapore/i.test(tripHayAll))) ||
              (/Abu\s*Dhabi|Dubai|Sheikh\s*Zayed|Louvre\s*Abu|Burj/i.test(String(slot ?? '')) &&
                (/아부다비|두바이|Abu\s*Dhabi|Dubai/i.test(dayHay) ||
                  /아부다비|두바이|Abu\s*Dhabi|Dubai/i.test(tripHayAll))) ||
              // Gemini가 Louvre Abu Dhabi를 Louvre Museum으로 축약한 경우 — 당일 아부다비·루브르 근거
              (/\bLouvre\b/i.test(String(slot ?? '')) &&
                /루브르|Louvre|아부다비|Abu\s*Dhabi|사디야트|Saadiyat/i.test(dayHay))
            if (!slotOkOnDay) {
              scheduleIssues.push(`D${r.day}: imageKeyword 대륙·지역 환각 "${slot}"`)
            }
          }
        }
      }
    }

    const allIssues = [
      ...scheduleIssues,
      ...priceIssues.map((i) => `price: ${i}`),
      ...priceSoftIssues.map((i) => `price-soft: ${i}`),
    ]

    const hardIssues = [...scheduleIssues, ...priceIssues.map((i) => `price: ${i}`)]

    const ok =
      !needsReview &&
      hardIssues.length === 0 &&
      Boolean(megaMenuSummary.browseRegionTab) &&
      Boolean(megaMenuSummary.countryKey || countryTagKeys.length)

    return {
      label: c.label,
      supplier: c.supplier,
      url: c.url,
      ok,
      title: title.slice(0, 80),
      scheduleDays: totalDays,
      megaMenu: {
        browseRegionTab: megaMenuSummary.browseRegionTab,
        subgroupLabel: megaMenuSummary.subgroupLabel,
        countryKey: megaMenuSummary.countryKey,
        countryTagKeys,
        cityKeys,
        needsReview,
        warnings: megaMenuSummary.warnings,
      },
      scheduleIssues: allIssues,
      priceIssues: [...priceIssues, ...priceSoftIssues],
      priceCount: priceReport.priceCount,
      futurePriceCount: priceReport.futurePriceCount,
      schedule: scheduleReports,
    }
  } catch (e) {
    return {
      label: c.label,
      supplier: c.supplier,
      url: c.url,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

async function main() {
  const jsonOut = process.argv.includes('--json')
  const jsonOutIdx = process.argv.indexOf('--json-out')
  const jsonOutPath =
    jsonOutIdx >= 0 ? String(process.argv[jsonOutIdx + 1] ?? '').trim() : ''
  const onlyIdx = process.argv.indexOf('--only')
  const onlyFilter =
    onlyIdx >= 0 ? String(process.argv[onlyIdx + 1] ?? '').trim() : ''
  const urlsFileIdx = process.argv.indexOf('--urls-file')
  const urlsFile =
    urlsFileIdx >= 0 ? String(process.argv[urlsFileIdx + 1] ?? '').trim() : ''
  const baseCases = urlsFile ? loadCasesFromUrlFile(urlsFile) : CASES
  const cases =
    onlyFilter.length > 0
      ? baseCases.filter((c) => c.label === onlyFilter || c.label.includes(onlyFilter))
      : baseCases
  if (onlyFilter && cases.length === 0) {
    console.error(`No cases match --only ${onlyFilter}`)
    process.exit(1)
  }
  const reports: CaseReport[] = []

  for (const c of cases) {
    process.stderr.write(`… ${c.label}\n`)
    reports.push(await verifyCase(c))
  }

  await prisma.$disconnect()

  if (jsonOut || jsonOutPath) {
    const payload = JSON.stringify(reports, null, 2)
    if (jsonOutPath) {
      fs.writeFileSync(
        path.isAbsolute(jsonOutPath) ? jsonOutPath : path.join(process.cwd(), jsonOutPath),
        payload,
        'utf8',
      )
      process.stderr.write(`[live-gate] wrote ${reports.length} reports → ${jsonOutPath}\n`)
    } else {
      console.log(payload)
    }
    process.exit(reports.some((r) => !r.ok && !r.error?.startsWith('SKIP')) ? 1 : 0)
    return
  }

  let failCount = 0
  for (const r of reports) {
    console.log('\n' + '='.repeat(72))
    console.log(`${r.label} [${r.supplier}] ${r.ok ? 'OK' : 'FAIL'}`)
    console.log(r.url)
    if (r.error) {
      console.log('  note:', r.error)
      continue
    }
    console.log('  title:', r.title)
    console.log('  days:', r.scheduleDays)
    if (r.megaMenu) {
      console.log(
        '  megaMenu:',
        `region=${r.megaMenu.browseRegionTab}`,
        `subgroup=${r.megaMenu.subgroupLabel}`,
        `country=${r.megaMenu.countryKey}`,
        `countryTags=[${r.megaMenu.countryTagKeys.join(',')}]`,
        `cityTags=[${r.megaMenu.cityKeys.join(',')}]`,
        `needsReview=${r.megaMenu.needsReview}`,
      )
      if (r.megaMenu.warnings.length) console.log('  warnings:', r.megaMenu.warnings.join(' | '))
    }
    if (r.scheduleIssues?.length) {
      failCount++
      console.log('  scheduleIssues:', r.scheduleIssues.slice(0, 12).join('; '))
      if (r.scheduleIssues.length > 12) console.log(`    … +${r.scheduleIssues.length - 12} more`)
    }
    if (!r.ok && !r.error?.startsWith('SKIP')) failCount++
    for (const row of r.schedule ?? []) {
      const flag = row.issues.length ? '!' : ' '
      console.log(
        `  ${flag} D${row.day}: route="${row.routeText}" kw="${row.imageKeyword}" kw2="${row.imageKeyword2}" desc=${row.descriptionSentences}문장/${row.descriptionLen}자`,
      )
      if (row.descriptionPreview) console.log(`       desc: ${row.descriptionPreview}`)
    }
  }

  const active = reports.filter((r) => !r.error?.startsWith('SKIP'))
  const passed = active.filter((r) => r.ok).length
  console.log('\n' + '='.repeat(72))
  console.log(`SUMMARY: ${passed}/${active.length} passed (${reports.length - active.length} skipped)`)
  process.exit(failCount > 0 || passed < active.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  try {
    await prisma.$disconnect()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
