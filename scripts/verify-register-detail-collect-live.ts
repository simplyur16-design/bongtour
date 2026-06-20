/**
 * 등록 상세카드 자동수집 — 공급사별 live 상세 URL 매칭 실측.
 * 실행: npx tsx scripts/verify-register-detail-collect-live.ts
 */
import { writeFileSync } from 'node:fs'
import { fetchHanatourRegisterDetailBundle } from '@/lib/hanatour-register-api-detail'
import { fetchLottetourRegisterDetailBundle } from '@/lib/lottetour-register-api-detail'
import { fetchYbtourRegisterDetailBundle } from '@/lib/ybtour-register-api-detail'
import {
  extractLottetourIncludedExcludedFromBasicAjax,
  extractLottetourMeetingFromScheduleAjax,
  extractLottetourMustKnowFromBasicAjax,
  extractLottetourOptionalFromSpotListAjax,
  extractLottetourShoppingVisitCountFromCoreInfo,
  parseLottetourScheduleDaysFromScheduleAjax,
} from '@/lib/lottetour-register-api-detail'
import {
  extractYbtourIncludedExcluded,
  extractYbtourMeetingFromScheduleTm,
  extractYbtourOptionalFromTourDetail,
  ybtourScheduleBundleToRegisterSchedule,
} from '@/lib/ybtour-register-api-detail'
import { collectModetourRegisterFacts } from '@/lib/register-facts/modetour'
import {
  extractModetourIncludedExcludedFromDetailInfo,
  extractModetourMustKnowFromKeyPointInfo,
  extractModetourShoppingFromDetailBundle,
  fetchModetourRegisterDetailBundle,
} from '@/lib/modetour-register-api-detail'
import { buildVerygoodProductCoreFromDetailHtml } from '@/lib/verygoodtour-departures'
import { parseVerygoodItineraryFromDetailHtml } from '@/lib/verygoodtour-itinerary-collector'
import {
  KYOWONTOUR_TAB_CORE_ID,
  KYOWONTOUR_TAB_OPT_SHOP_ID,
  KYOWONTOUR_TAB_SCHEDULE_ID,
  extractKyowontourHiddenFieldsFromDetailHtml,
  extractTabDetailFromTabData,
  fetchKyowontourTourEventTabData,
  parseKyowontourCoreTabDetail,
  parseKyowontourOptShopTabDetail,
  parseKyowontourScheduleTabDetail,
} from '@/lib/kyowontour-tour-event-tab-data'
import { scheduleTabParsedToRegisterDays } from '@/lib/kyowontour-register-schedule-collect'

type AxisResult = { axis: string; ok: boolean; detail: string }

const CASES = [
  {
    supplier: 'modetour',
    originUrl: 'https://www.modetour.com/package/109317452',
  },
  {
    supplier: 'hanatour',
    originUrl: 'https://www.hanatour.com/package/major-products?pkgCd=ATP207260601TWJ',
  },
  {
    supplier: 'verygoodtour',
    originUrl:
      'https://www.verygoodtour.com/Product/PackageDetail?ProCode=APP1100-260621KE1&PriceSeq=3&MenuCode=leaveLayer',
  },
  {
    supplier: 'kyowontour',
    originUrl:
      'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=CSP302260621KE01&menuCode=M5204&brandId=3',
  },
  {
    supplier: 'ybtour',
    originUrl:
      'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAAB001&evCd=AVP4484-260711RS00&goodsCd=AVP4484',
  },
  {
    supplier: 'lottetour',
    originUrl:
      'https://www.lottetour.com/evtDetail/826/857/1063/1671?evtCd=B41A260630KE014',
  },
] as const

async function probeModetour(url: string): Promise<AxisResult[]> {
  const [facts, bundle] = await Promise.all([
    collectModetourRegisterFacts(url),
    fetchModetourRegisterDetailBundle(url),
  ])
  const inclExcl = extractModetourIncludedExcludedFromDetailInfo(bundle?.detailInfo)
  const shopping = extractModetourShoppingFromDetailBundle(bundle?.detailInfo, bundle?.packageInfo)
  const mustKnow = extractModetourMustKnowFromKeyPointInfo(bundle?.keyPointInfo)
  return [
    {
      axis: 'schedule',
      ok: (facts?.scheduleDays.length ?? 0) > 0,
      detail: `GetScheduleList days=${facts?.scheduleDays.length ?? 0}`,
    },
    {
      axis: 'included/excluded',
      ok: inclExcl.includedItems.length + inclExcl.excludedItems.length > 0,
      detail: `in=${inclExcl.includedItems.length} ex=${inclExcl.excludedItems.length}`,
    },
    {
      axis: 'shopping',
      ok: shopping.shoppingVisitCount != null,
      detail: `shoppingTimes/shoppingCount=${String(shopping.shoppingVisitCount ?? 'null')}`,
    },
    {
      axis: 'corePoints',
      ok: mustKnow.length > 0,
      detail: `specialBenefits+insurance=${mustKnow.length}`,
    },
  ]
}

async function probeHanatour(url: string): Promise<AxisResult[]> {
  const bundle = await fetchHanatourRegisterDetailBundle(url)
  if (!bundle?.prodInfo) return [{ axis: 'bundle', ok: false, detail: 'prodInfo null' }]
  const incl = bundle.prodInfo.trvlExpnInclList?.length ?? 0
  const excl = bundle.prodInfo.trvlExpnNoneInclList?.length ?? 0
  const sch = bundle.itnr?.data?.schdInfoList?.length ?? 0
  return [
    { axis: 'schedule', ok: sch > 0, detail: `schdInfoList=${sch}` },
    { axis: 'included/excluded', ok: incl + excl > 0, detail: `in=${incl} ex=${excl}` },
    {
      axis: 'optional',
      ok: (bundle.itnr?.data?.schdInfoList ?? []).some((d) =>
        (d.schdMainInfoList ?? []).some((m) => String(m.schdCatgNm ?? '').includes('선택')),
      ),
      detail: 'itnr 선택관광 cat',
    },
    {
      axis: 'shopping',
      ok: Number.isFinite(Number(bundle.prodInfo.shpnCntrVistCnt)),
      detail: `shpnCntrVistCnt=${String(bundle.prodInfo.shpnCntrVistCnt)}`,
    },
  ]
}

async function fetchDetailHtml(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR',
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return null
  return res.text()
}

async function probeVerygood(url: string): Promise<AxisResult[]> {
  const html = await fetchDetailHtml(url)
  if (!html) return [{ axis: 'bundle', ok: false, detail: 'html null' }]
  const { product: core } = buildVerygoodProductCoreFromDetailHtml(url, html)
  const schedule = parseVerygoodItineraryFromDetailHtml(html)
  return [
    {
      axis: 'included/excluded',
      ok: Boolean(core?.includedText?.trim() || core?.excludedText?.trim()),
      detail: `in=${Boolean(core?.includedText)} ex=${Boolean(core?.excludedText)}`,
    },
    { axis: 'schedule', ok: schedule.days.length > 0, detail: `days=${schedule.days.length} (${schedule.notes.join('; ')})` },
    {
      axis: 'shopping',
      ok: core?.shoppingVisitCountTotal != null,
      detail: `count=${String(core?.shoppingVisitCountTotal)}`,
    },
  ]
}

async function probeKyowontour(url: string): Promise<AxisResult[]> {
  const html = await fetchDetailHtml(url)
  if (!html) return [{ axis: 'bundle', ok: false, detail: 'html null' }]
  const hidden = extractKyowontourHiddenFieldsFromDetailHtml(html)
  if (!hidden) return [{ axis: 'bundle', ok: false, detail: 'hidden fields null' }]
  const tabIds = [KYOWONTOUR_TAB_CORE_ID, KYOWONTOUR_TAB_SCHEDULE_ID, KYOWONTOUR_TAB_OPT_SHOP_ID]
  const { status, data } = await fetchKyowontourTourEventTabData(hidden, tabIds, { refererUrl: url })
  if (status !== 200) return [{ axis: 'bundle', ok: false, detail: `tabData HTTP ${status}` }]
  const core = parseKyowontourCoreTabDetail(extractTabDetailFromTabData(data, KYOWONTOUR_TAB_CORE_ID))
  const scheduleDays = scheduleTabParsedToRegisterDays(
    parseKyowontourScheduleTabDetail(extractTabDetailFromTabData(data, KYOWONTOUR_TAB_SCHEDULE_ID)),
  )
  const optShop = parseKyowontourOptShopTabDetail(extractTabDetailFromTabData(data, KYOWONTOUR_TAB_OPT_SHOP_ID))
  return [
    { axis: 'schedule', ok: scheduleDays.length > 0, detail: `goodsEvtTab_2 days=${scheduleDays.length}` },
    {
      axis: 'included/excluded',
      ok: core.includedItems.length + core.excludedItems.length > 0,
      detail: `goodsEvtTab_1 in=${core.includedItems.length} ex=${core.excludedItems.length}`,
    },
    {
      axis: 'optional/shopping',
      ok: optShop.optionalTours.length > 0 || optShop.shoppingItems.length > 0,
      detail: `goodsEvtTab_7 opt=${optShop.optionalTours.length} shop=${optShop.shoppingItems.length}`,
    },
  ]
}

async function probeYbtour(url: string): Promise<AxisResult[]> {
  const bundle = await fetchYbtourRegisterDetailBundle(url)
  if (!bundle) return [{ axis: 'bundle', ok: false, detail: 'null' }]
  const { notice, schedule, tourDetail } = bundle
  const sd = schedule?.scheduleDetail ?? []
  const tm = schedule?.scheduleDetailTm ?? []
  const { includedItems, excludedItems } = extractYbtourIncludedExcluded(notice)
  const scheduleDays = ybtourScheduleBundleToRegisterSchedule(sd, tm)
  const meeting = extractYbtourMeetingFromScheduleTm(tm)
  const opt = extractYbtourOptionalFromTourDetail(tourDetail ?? [])
  return [
    { axis: 'schedule', ok: scheduleDays.length > 0, detail: `days=${scheduleDays.length}` },
    {
      axis: 'included/excluded',
      ok: includedItems.length + excludedItems.length > 0,
      detail: `in=${includedItems.length} ex=${excludedItems.length}`,
    },
    { axis: 'meeting', ok: Boolean(meeting.meetingInfoRaw), detail: meeting.meetingInfoRaw?.slice(0, 60) ?? 'none' },
    { axis: 'flight', ok: tm.some((r) => r.outFlightNm?.trim()), detail: tm[0]?.outFlightNm ?? 'none' },
    { axis: 'optional', ok: opt.length > 0, detail: `rows=${opt.length}` },
    { axis: 'shopping', ok: Number(notice?.shopCnt ?? -1) >= 0, detail: `shopCnt=${String(notice?.shopCnt)}` },
  ]
}

async function probeLottetour(url: string): Promise<AxisResult[]> {
  const bundle = await fetchLottetourRegisterDetailBundle(url)
  if (!bundle) return [{ axis: 'bundle', ok: false, detail: 'null' }]
  const { includedItems, excludedItems } = extractLottetourIncludedExcludedFromBasicAjax(
    bundle.basicAjaxHtml,
  )
  const shop = extractLottetourShoppingVisitCountFromCoreInfo(bundle.coreInfoHtml)
  const must = extractLottetourMustKnowFromBasicAjax(bundle.basicAjaxHtml)
  const scheduleDays = parseLottetourScheduleDaysFromScheduleAjax(bundle.scheduleAjaxHtml)
  const meeting = extractLottetourMeetingFromScheduleAjax(bundle.scheduleAjaxHtml)
  const opt = extractLottetourOptionalFromSpotListAjax(bundle.spotListAjaxHtml)
  return [
    {
      axis: 'schedule',
      ok: scheduleDays.length > 0,
      detail: `scheduleAjax viewType=basic days=${scheduleDays.length} godScheId=${bundle.godScheId ?? 'null'}`,
    },
    {
      axis: 'included/excluded',
      ok: includedItems.length + excludedItems.length > 0,
      detail: `in=${includedItems.length} ex=${excludedItems.length}`,
    },
    { axis: 'mustKnow', ok: must.length > 0, detail: `items=${must.length}` },
    { axis: 'shopping', ok: shop != null, detail: `count=${String(shop)}` },
    {
      axis: 'flight',
      ok: Boolean(bundle.evtListRow?.carrierText),
      detail: bundle.evtListRow?.carrierText?.slice(0, 40) ?? 'evtList row missing',
    },
    {
      axis: 'optional',
      ok: opt.length > 0 || Boolean(bundle.spotListAjaxHtml?.includes('선택관광')),
      detail: `spotList rows=${opt.length} (NO옵션 상품은 0건 정상)`,
    },
    {
      axis: 'meeting',
      ok: Boolean(meeting.meetingInfoRaw),
      detail: meeting.meetingPlaceRaw?.slice(0, 60) ?? meeting.meetingInfoRaw?.slice(0, 60) ?? 'none',
    },
  ]
}

async function main() {
  const out: Record<string, unknown>[] = []
  for (const c of CASES) {
    let axes: AxisResult[] = []
    try {
      if (c.supplier === 'modetour') axes = await probeModetour(c.originUrl)
      else if (c.supplier === 'hanatour') axes = await probeHanatour(c.originUrl)
      else if (c.supplier === 'verygoodtour') axes = await probeVerygood(c.originUrl)
      else if (c.supplier === 'kyowontour') axes = await probeKyowontour(c.originUrl)
      else if (c.supplier === 'ybtour') axes = await probeYbtour(c.originUrl)
      else if (c.supplier === 'lottetour') axes = await probeLottetour(c.originUrl)
    } catch (e) {
      axes = [{ axis: 'error', ok: false, detail: e instanceof Error ? e.message : String(e) }]
    }
    out.push({ supplier: c.supplier, originUrl: c.originUrl, axes })
    console.log(`\n[${c.supplier}] ${c.originUrl}`)
    for (const a of axes) {
      console.log(`  ${a.ok ? 'OK' : 'GAP'} ${a.axis}: ${a.detail}`)
    }
  }
  const path = 'ops/register-detail-collect-live-verify.json'
  writeFileSync(path, JSON.stringify({ verifiedAt: new Date().toISOString(), cases: out }, null, 2))
  console.log(`\nWrote ${path}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
