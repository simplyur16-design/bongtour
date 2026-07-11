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
  if (!desc) issues.push('description 비어 있음')
  if (desc.length > 0 && desc.length < 8) issues.push('description 너무 짧음')
  if (desc && route && (desc === route || desc.startsWith(`${route}\n`))) {
    issues.push('description이 routeText 복사')
  }
  if (desc) {
    const sentenceCount = countDescriptionSentences(desc)
    if (sentenceCount < 2) issues.push(`description 문장 ${sentenceCount}개 (2~3문장 필요)`)
    if (sentenceCount > 4) issues.push(`description 문장 ${sentenceCount}개 (2~3문장 권장)`)
  }

  if (!isFirst && !isLast) {
    if (!kw) issues.push('중간일 imageKeyword 비어 있음')
    if (!kw2 && totalDays >= 4) issues.push('중간일 imageKeyword2 비어 있음(4일+)')
  } else {
    if (!kw) issues.push(`${isFirst ? '1일차' : '마지막 일차'} imageKeyword 비어 있음`)
    if (kw2) issues.push(`${isFirst ? '1일차' : '마지막 일차'} imageKeyword2는 null이어야 함`)
  }

  return issues
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
    parsed = (await applyRegisterPostAugmentSchedulePipeline(parsed, {
      forcedBrandKey: c.supplier,
      travelScope: 'package',
      mode: 'confirm',
      logPrefix: `batch-${c.label}`,
    })) as Record<string, unknown>

    const schedule = (parsed.schedule as Array<Record<string, unknown>> | undefined) ?? []
    const title = String(parsed.title ?? parsed.supplierListingTitleRaw ?? '').trim()
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

    const ok =
      !needsReview &&
      scheduleIssues.length === 0 &&
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
      scheduleIssues,
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
