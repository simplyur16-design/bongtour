/**
 * 하나투어 B2C gateway — 상세·다출발 목록 API (브라우저가 호출하는 공개 엔드포인트).
 *
 * REGRESSION-FREEZE[hanatour-api-departure-collect]: gw.hanatour.com pkg API — manifest
 */
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import { resolveRegisterFactProductKindFromAdminTravelScope } from '@/lib/register-facts/product-kind'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'

export type HanatourApiDepartureCollectOptions = {
  /** 관리자 등록 UI travelScope — 명시 시 API prodAttrCd 추론보다 우선(패키지·자유여행 가격 혼입 방지) */
  adminTravelScope?: string | null
}

const HANATOUR_GW_BASE = process.env.HANATOUR_GW_BASE_URL ?? 'https://gw.hanatour.com'
const HANATOUR_TRP_PRG_MID = 'CHPC0PKG0200M200'

type HanatourGwJson<T> = { data?: T; logKey?: string }

export type HanatourPkgProdInfo = {
  saleProdCd?: string
  saleProdNm?: string
  rprsProdCd?: string
  prodMstrCd?: string
  trvlDayCnt?: number
  prodAreaCd?: string
  depCityCd?: string
  depDay?: string
  adtAmt?: number
  adtTotlAmt?: number
  chdAmt?: number
  infAmt?: number
  prodSprtrNm?: string | null
  prodAttrCd?: string | null
  frdmSchdDvCd?: string | null
  depAirCd?: string | null
  depFlgtCd?: string | null
  airlNm?: string | null
  depTm?: string | null
  arrDay?: string | null
  arrTm?: string | null
}

export type HanatourPkgProdListRow = {
  saleProdCd?: string
  depDay?: string
  adtAmt?: number
  bafAmt?: number
  chdAmt?: number
  infAmt?: number
  airlNm?: string | null
  depAirCd?: string | null
  depFlgtCd?: string | null
  depTm?: string | null
  arrDay?: string | null
  arrTm?: string | null
  saleProdNm?: string | null
  bkngStatCd?: string | null
  remaSeatCnt?: number | null
  seatCnt?: number | null
  minDepNop?: number | null
  depFixYn?: string | null
}

export function hanatourStatusRawFromProdListRow(row: HanatourPkgProdListRow): string {
  if (String(row.depFixYn ?? '').trim().toUpperCase() === 'Y') return '출발확정'
  const rem = row.remaSeatCnt
  if (rem != null && rem <= 0) return '예약마감'
  const cd = String(row.bkngStatCd ?? '').trim()
  if (cd === '1' || cd === '4') return '출발확정'
  if (cd === '3' || cd === '9') return '예약마감'
  return '예약가능'
}

function hanatourGwHeaders(): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ko-KR',
    'content-type': 'application/json',
    referer: 'https://www.hanatour.com/',
    prgmid: HANATOUR_TRP_PRG_MID,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
}

async function postHanatourGw<T>(path: string, body: unknown): Promise<T> {
  const url = `${HANATOUR_GW_BASE.replace(/\/$/, '')}${path}?_siteId=hanatour`
  const res = await fetch(url, {
    method: 'POST',
    headers: hanatourGwHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`hanatour gw ${path} HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

export function parseHanatourPkgCdFromUrl(url: string | null | undefined): string | null {
  const raw = (url ?? '').trim()
  if (!raw) return null
  const m = raw.match(/[?&]pkgCd=([^&]+)/i)
  return m?.[1] ? decodeURIComponent(m[1]).trim() : null
}

/** 하나투어 API `depDay` YYYYMMDD → YYYY-MM-DD */
export function hanatourYmdFromDepDay(depDay: string | null | undefined): string | null {
  const d = String(depDay ?? '').trim()
  if (!/^\d{8}$/.test(d)) return null
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

export function isHanatourAirtelLikeProdInfo(info: HanatourPkgProdInfo | null | undefined): boolean {
  if (!info) return false
  if (info.prodAttrCd === 'B') return true
  if (info.frdmSchdDvCd === 'FS') return true
  const spr = String(info.prodSprtrNm ?? '')
  return /에어텔|자유\s*여행/i.test(spr)
}

/** getPkgProdLst·필터 분기 — adminTravelScope 명시 시 API 메타만으로 자유여행 오분류하지 않음 */
export function resolveHanatourApiAirtelLike(
  info: HanatourPkgProdInfo | null | undefined,
  options?: HanatourApiDepartureCollectOptions,
): boolean {
  const inferred = isHanatourAirtelLikeProdInfo(info) ? 'air_hotel_free' : 'package'
  return (
    resolveRegisterFactProductKindFromAdminTravelScope(options?.adminTravelScope, inferred) ===
    'air_hotel_free'
  )
}

function hanatourProdMstrCdFromSaleProdCd(cd: string, info?: HanatourPkgProdInfo): string {
  const fromInfo = String(info?.prodMstrCd ?? '').trim()
  if (fromInfo) return fromInfo
  const m = cd.match(/^([A-Z]{3}\d{3})/i)
  return m?.[1] ?? cd.slice(0, 6)
}

function hanatourTravelDaysFromProdName(nm: string | null | undefined): number | null {
  const m = String(nm ?? '').match(/(\d+)\s*일/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

const HANATOUR_HOTEL_NAME_KEYS: ReadonlyArray<{ re: RegExp; key: string }> = [
  { re: /파라독스|Paradox/i, key: 'paradox' },
  { re: /샹그리라|Shangri/i, key: 'shangri' },
  { re: /포시즌|Four\s*Seasons/i, key: 'fourseasons' },
]

function hanatourHotelKeyFromProdName(nm: string | null | undefined): string | null {
  const t = String(nm ?? '')
  for (const { re, key } of HANATOUR_HOTEL_NAME_KEYS) {
    if (re.test(t)) return key
  }
  return null
}

function hanatourSaleProdVariantSuffix(cd: string): string {
  const m = String(cd ?? '').trim().match(/^[A-Z0-9]{6}\d{6}([A-Z0-9]+)$/i)
  return m?.[1] ?? ''
}

function isHanatourPackageSaleProdCd(cd: string): boolean {
  return /^PAP|^CPP|^CQP|^CHP|^ATP|^EWP|^ESP|^JSP|^CAP|^AAB|^AAP|^EMP|^JYP/i.test(cd)
}

function isHanatourAirtelFreeTravelSaleProdCd(cd: string, nm?: string | null): boolean {
  if (/^PAB|^AVB|^CMB|^CKB|^ADB|^PGB/i.test(cd)) return true
  return /\[?자유여행\]?|에어텔/i.test(String(nm ?? ''))
}

/** 자유여행 전용 목록 행 — PAB·에어텔 명칭 등 (PAP·CAP 등 패키지 saleProdCd는 제외) */
function isHanatourAirtelExclusiveListRow(cd: string, nm?: string | null): boolean {
  return isHanatourAirtelFreeTravelSaleProdCd(cd, nm) && !isHanatourPackageSaleProdCd(cd)
}

/** getPkgProdLst — URL 상품과 동일 라인(마스터·일수·호텔)만. 패키지·다른 호텔·다른 일수 제외 */
// REGRESSION-FREEZE[hanatour-api-departure-collect]: filterHanatourProdListRowsForAnchorProductLine — manifest
export function filterHanatourProdListRowsForAnchorProductLine(
  rows: readonly HanatourPkgProdListRow[],
  anchorInfo: HanatourPkgProdInfo,
  anchorPkgCd: string,
  options?: HanatourApiDepartureCollectOptions,
): HanatourPkgProdListRow[] {
  const anchor = String(anchorPkgCd ?? '').trim()
  if (!anchor) return []

  const anchorNm = String(anchorInfo.saleProdNm ?? '')
  const anchorMstr = hanatourProdMstrCdFromSaleProdCd(anchor, anchorInfo)
  const anchorDays =
    (Number(anchorInfo.trvlDayCnt ?? 0) > 0 ? Number(anchorInfo.trvlDayCnt) : null) ??
    hanatourTravelDaysFromProdName(anchorNm)
  const anchorHotel = hanatourHotelKeyFromProdName(anchorNm)
  const anchorVariant = hanatourSaleProdVariantSuffix(anchor)
  const anchorAirtel = resolveHanatourApiAirtelLike(anchorInfo, options)

  return rows.filter((row) => {
    const cd = String(row.saleProdCd ?? '').trim()
    if (!cd) return false
    if (cd === anchor) return true

    const rowNm = String(row.saleProdNm ?? '')
    if (anchorAirtel) {
      if (isHanatourPackageSaleProdCd(cd)) return false
      if (!isHanatourAirtelFreeTravelSaleProdCd(cd, rowNm)) return false
    } else {
      /** 해외여행(패키지) — 자유여행·에어텔 전용 행 혼입 금지 (anchor prefix 무관) */
      if (isHanatourAirtelExclusiveListRow(cd, rowNm)) return false
    }

    if (anchorMstr && !cd.startsWith(anchorMstr)) return false

    const rowDays = hanatourTravelDaysFromProdName(rowNm)
    if (anchorDays != null && anchorDays > 0 && rowDays != null && rowDays !== anchorDays) return false

    if (anchorHotel) {
      const rowHotel = hanatourHotelKeyFromProdName(rowNm)
      if (rowHotel && rowHotel !== anchorHotel) return false
    } else if (anchorVariant && anchorAirtel) {
      /** 자유여행만 suffix(호텔·등급) 일치 — 패키지는 출발일별 saleProdCd suffix가 달라도 동일 라인 */
      const rowVariant = hanatourSaleProdVariantSuffix(cd)
      if (rowVariant && rowVariant !== anchorVariant) return false
    }

    return true
  })
}

function adultPriceFromProdInfo(info: HanatourPkgProdInfo): number | null {
  const total = Number(info.adtTotlAmt ?? 0)
  if (Number.isFinite(total) && total > 0) return total
  const base = Number(info.adtAmt ?? 0)
  return Number.isFinite(base) && base > 0 ? base : null
}

function adultPriceFromProdListRow(row: HanatourPkgProdListRow): number | null {
  const base = Number(row.adtAmt ?? 0)
  const baf = Number(row.bafAmt ?? 0)
  if (Number.isFinite(base) && base > 0) {
    return Number.isFinite(baf) && baf > 0 ? base + baf : base
  }
  return null
}

/** IATA·하나투어 depCityCd → 출발 공항 표기 (register-facts·departureInput SSOT) */
export function hanatourDepartureAirportLabelFromCodes(
  depAirCd: string | null | undefined,
  depCityCd?: string | null | undefined,
): string | null {
  const air = String(depAirCd ?? '')
    .trim()
    .toUpperCase()
  const city = String(depCityCd ?? '')
    .trim()
    .toUpperCase()
  const code = air || city
  const map: Record<string, string> = {
    ICN: '인천국제공항',
    GMP: '김포국제공항',
    PUS: '부산',
    TAE: '대구',
    CJJ: '청주',
    CJU: '제주',
    JCN: '인천국제공항',
  }
  return map[code] ?? null
}

export function hanatourProdInfoToDepartureInput(info: HanatourPkgProdInfo | null | undefined): DepartureInput | null {
  if (!info) return null
  const departureDate = hanatourYmdFromDepDay(info.depDay)
  const adultPrice = adultPriceFromProdInfo(info)
  if (!departureDate || adultPrice == null) return null
  const saleProdCd = String(info.saleProdCd ?? '').trim()
  return {
    departureDate,
    adultPrice,
    childBedPrice: Number.isFinite(Number(info.chdAmt)) ? Number(info.chdAmt) : null,
    infantPrice: Number.isFinite(Number(info.infAmt)) ? Number(info.infAmt) : null,
    carrierName: info.airlNm ?? null,
    outboundFlightNo: info.depFlgtCd ? `${info.depAirCd ?? ''}${info.depFlgtCd}`.trim() || null : null,
    outboundDepartureAirport: hanatourDepartureAirportLabelFromCodes(info.depAirCd, info.depCityCd),
    supplierDepartureCodeCandidate: saleProdCd ? `hanatour:${saleProdCd}` : null,
    localPriceText: saleProdCd ? `hanatour:pkgCd=${saleProdCd}`.slice(0, 200) : null,
  }
}

export function hanatourProdListRowToDepartureInput(row: HanatourPkgProdListRow | null | undefined): DepartureInput | null {
  if (!row) return null
  const departureDate = hanatourYmdFromDepDay(row.depDay)
  const adultPrice = adultPriceFromProdListRow(row)
  if (!departureDate || adultPrice == null) return null
  const saleProdCd = String(row.saleProdCd ?? '').trim()
  const remaSeatCnt =
    row.remaSeatCnt != null && Number.isFinite(Number(row.remaSeatCnt)) ? Math.trunc(Number(row.remaSeatCnt)) : null
  const statusRaw = hanatourStatusRawFromProdListRow(row)
  return {
    departureDate,
    adultPrice,
    childBedPrice: Number.isFinite(Number(row.chdAmt)) ? Number(row.chdAmt) : null,
    infantPrice: Number.isFinite(Number(row.infAmt)) ? Number(row.infAmt) : null,
    carrierName: row.airlNm ?? null,
    outboundFlightNo: row.depFlgtCd ? `${row.depAirCd ?? ''}${row.depFlgtCd}`.trim() || null : null,
    outboundDepartureAirport: hanatourDepartureAirportLabelFromCodes(row.depAirCd),
    supplierDepartureCodeCandidate: saleProdCd ? `hanatour:${saleProdCd}` : null,
    localPriceText: saleProdCd ? `hanatour:pkgCd=${saleProdCd}`.slice(0, 200) : null,
    statusRaw,
    seatsStatusRaw: remaSeatCnt != null ? `잔여${remaSeatCnt}석` : null,
    seatCount: remaSeatCnt,
    minPax:
      row.minDepNop != null && Number.isFinite(Number(row.minDepNop)) && Number(row.minDepNop) > 0
        ? Math.trunc(Number(row.minDepNop))
        : null,
  }
}

export async function fetchHanatourPkgProdInfo(pkgCd: string): Promise<HanatourPkgProdInfo | null> {
  const json = await postHanatourGw<HanatourGwJson<HanatourPkgProdInfo>>(
    '/package/pkg/api/common/pkgcomprod/getPkgProdInfo/v1.00',
    {
      pkgCd,
      inpPathCd: 'WPP',
      smplYn: 'N',
      coopYn: 'N',
      resAcceptPtn: {},
      partnerYn: 'N',
    },
  )
  return json.data ?? null
}

function emptyLstFilterFields() {
  return {
    ljoinDvCd: '',
    dtClrNum: '',
    pageSize: '20',
    ptnCd: '',
    saleSiteCd: '',
    strtDepDay: '',
    endDepDay: '',
    prodDtlAttrCd: '',
    dtcmAreaCd: '',
    prodDvCd: '',
    scods: '',
    rprsProdAirEnn: 'Y',
    prodTypeCd: '',
    trvlDayCnts: '',
    promCds: '',
    adtMinAmt: '',
    adtMaxAmt: '',
    prodBrndCds: '',
    rcctCds: '',
    frdmSchdYn: '',
    tipInclYn: '',
    chssInclYn: '',
    shpnYn: '',
    tcEnn: '',
    guidInclYn: '',
    shipInclYn: '',
    thmCdCont: '',
    monYn: '',
    tueYn: '',
    wedYn: '',
    thuYn: '',
    friYn: '',
    satYn: '',
    sndyYn: '',
    depTms: '',
    depAirCds: '',
    htlGradCds: '',
    cpndCityProdYn: '',
    rprsProdNm: '',
    inpPathCd: 'DCP',
    page: '1',
  }
}

/**
 * getPkgProdLst 월 조회 body.
 * 패키지·에어텔 모두 `depYm=YYYYMM` + `depDay=''` — 월말 `depDay`만 넣으면 CPP171 등 패키지 라인이 0건이 된다.
 * `airtelLike`는 필터 분기에만 쓰고 여기 쿼리에는 쓰지 않는다.
 */
// REGRESSION-FREEZE[hanatour-api-departure-collect]: buildHanatourPkgProdLstBody depYm — manifest
export function buildHanatourPkgProdLstBody(
  info: Pick<HanatourPkgProdInfo, 'prodAreaCd' | 'depCityCd' | 'rprsProdCd'>,
  ym: string,
): Record<string, string> {
  const ymCompact = ym.replace(/-/g, '')
  return {
    sort: 'RPRS_SORT1',
    ...emptyLstFilterFields(),
    areaCd: String(info.prodAreaCd ?? ''),
    depCityCd: String(info.depCityCd ?? 'JCN'),
    rprsProdCds: String(info.rprsProdCd ?? ''),
    depDay: '',
    depYm: ymCompact,
  }
}

export async function fetchHanatourPkgProdLstPage(
  info: HanatourPkgProdInfo,
  opts: { ym: string; airtelLike?: boolean },
): Promise<HanatourPkgProdListRow[]> {
  void opts.airtelLike
  const body = buildHanatourPkgProdLstBody(info, opts.ym)
  const json = await postHanatourGw<HanatourGwJson<{ prodList?: HanatourPkgProdListRow[] }>>(
    '/package/pkg/api/dotcom/pkgdtcmprod/getPkgProdLst/v1.00',
    body,
  )
  return Array.isArray(json.data?.prodList) ? json.data!.prodList! : []
}

function dedupeByDepartureDate(inputs: DepartureInput[]): DepartureInput[] {
  const seen = new Set<string>()
  const out: DepartureInput[] = []
  for (const x of inputs) {
    const d = departureInputToYmd(x.departureDate)
    if (!d || seen.has(d)) continue
    seen.add(d)
    out.push(x)
  }
  return out
}

/** @deprecated strict saleProdCd only — use filterHanatourProdListRowsForAnchorProductLine for calendar */
export function filterHanatourProdListRowsForAnchorSaleProdCd(
  rows: readonly HanatourPkgProdListRow[],
  anchorPkgCd: string,
): HanatourPkgProdListRow[] {
  const anchor = String(anchorPkgCd ?? '').trim()
  if (!anchor) return []
  return rows.filter((row) => String(row.saleProdCd ?? '').trim() === anchor)
}

function sortDepartureInputsByDate(inputs: DepartureInput[]): DepartureInput[] {
  return [...inputs].sort((a, b) =>
    (departureInputToYmd(a.departureDate) ?? '').localeCompare(departureInputToYmd(b.departureDate) ?? ''),
  )
}

function filterInputsInWindow(inputs: DepartureInput[], fromYmd: string, toYmd: string): DepartureInput[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  return inputs.filter((x) => {
    const d = departureInputToYmd(x.departureDate)
    return d != null && d >= lo && d <= hi
  })
}

function mergeAnchorProdInfoIfMissing(merged: DepartureInput[], info: HanatourPkgProdInfo): void {
  const anchor = hanatourProdInfoToDepartureInput(info)
  if (!anchor) return
  const anchorYmd = departureInputToYmd(anchor.departureDate)
  if (!anchorYmd) return
  const hasAnchorDate = merged.some((x) => departureInputToYmd(x.departureDate) === anchorYmd)
  if (!hasAnchorDate) merged.push(anchor)
}

/** `monthYms` 각 월에 대해 getPkgProdLst 호출 후 병합. */
export async function collectHanatourApiDepartureInputsForMonths(
  pkgCd: string,
  monthYms: readonly string[],
  options?: HanatourApiDepartureCollectOptions,
): Promise<{ inputs: DepartureInput[]; airtelLike: boolean; anchorInput: DepartureInput | null }> {
  const info = await fetchHanatourPkgProdInfo(pkgCd)
  if (!info) return { inputs: [], airtelLike: false, anchorInput: null }

  const airtelLike = resolveHanatourApiAirtelLike(info, options)
  const anchorInput = hanatourProdInfoToDepartureInput(info)
  const merged: DepartureInput[] = []

  for (const ym of monthYms) {
    if (!/^\d{4}-\d{2}$/.test(ym)) continue
    try {
      const rows = filterHanatourProdListRowsForAnchorProductLine(
        await fetchHanatourPkgProdLstPage(info, { ym, airtelLike }),
        info,
        pkgCd,
        options,
      )
      for (const row of rows) {
        const mapped = hanatourProdListRowToDepartureInput(row)
        if (mapped) merged.push(mapped)
      }
    } catch {
      /* 월별 실패는 다음 월 계속 */
    }
  }

  if (merged.length === 0) {
    if (anchorInput) merged.push(anchorInput)
  } else {
    mergeAnchorProdInfoIfMissing(merged, info)
  }

  return {
    inputs: dedupeByDepartureDate(sortDepartureInputsByDate(merged)),
    airtelLike,
    anchorInput,
  }
}

export async function collectHanatourApiDepartureInputsForDateRange(
  pkgCd: string,
  fromYmd: string,
  toYmd: string,
  monthYms: readonly string[],
  options?: HanatourApiDepartureCollectOptions,
): Promise<DepartureInput[]> {
  const { inputs } = await collectHanatourApiDepartureInputsForMonths(pkgCd, monthYms, options)
  return filterInputsInWindow(inputs, fromYmd, toYmd).filter((x) => (x.adultPrice ?? 0) > 0)
}
