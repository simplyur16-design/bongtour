import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import type { PrismaClient } from '@prisma/client'
import { collectModetourDepartureInputs } from '@/lib/modetour-departures'
import {
  buildHanatourKstTargetMonths,
  collectHanatourDepartureInputs,
  computeHanatourAdminDepartureChunk,
  validateHanatourAdminMonthYm,
  type HanatourPythonDiagnostics,
  type HanatourPythonMonthRun,
} from '@/lib/hanatour-departures'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'
import {
  filterDepartureInputsOnOrAfterCalendarToday,
  resolveHanatourAdminE2eMonthsForward,
  SCRAPE_DEFAULT_MONTHS_FORWARD,
} from '@/lib/scrape-date-bounds'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { resolvePythonExecutable } from '@/lib/resolve-python-executable'
import { collectKyowontourCalendarRange, mapKyowontourCalendarToDepartureInputs } from '@/lib/kyowontour-departures'
import {
  buildLottetourEvtDetailUrl,
  collectLottetourCalendarRange,
  mapLottetourCalendarToDepartureInputs,
  parseLottetourEvtListCollectionHints,
} from '@/lib/lottetour-departures'

const execFileAsync = promisify(execFile)
const HANATOUR_BASE = process.env.HANATOUR_BASE_URL ?? 'https://www.hanatour.com'
const MODETOUR_BASE = process.env.MODETOUR_BASE_URL ?? 'https://www.modetour.com'
const VERYGOODTOUR_BASE = process.env.VERYGOODTOUR_BASE_URL ?? 'https://www.verygoodtour.com'
const LOTTETOUR_BASE = process.env.LOTTETOUR_BASE_URL ?? 'https://www.lottetour.com'

export type DepartureRescrapeSite = 'hanatour' | 'modetour' | 'verygoodtour' | 'ybtour' | 'kyowontour' | 'lottetour'

export type DepartureRescrapeResult = {
  mode: 'live-rescrape' | 'fallback-rebuild'
  source:
    | 'verygoodtour-adapter'
    | 'verygoodtour-live-calendar'
    | 'modetour-adapter'
    | 'hanatour-adapter'
    | 'ybtour-calendar-scraper'
    | 'product-price-rebuild'
    | 'kyowontour-differentDepartDate'
    | 'lottetour-evtListAjax-html'
  inputs: DepartureInput[]
  attemptedLive: boolean
  liveError?: string | null
  filledFields: string[]
  missingFields: string[]
  mappingStatus: 'per-date-confirmed' | 'price-only-confirmed' | 'detail-candidate-found-but-unmapped'
  notes?: string[]
  /** E2E 遺꾧린쨌濡쒓렇??*/
  site: DepartureRescrapeSite
  /** ?섏쭛???ъ슜???곸꽭 URL(愿由ъ옄 寃利앹슜) */
  detailUrl: string
  detailUrlSummary: string
  /** ?섎굹?ъ뼱 Python ?섏쭛湲??곹깭(meta.collectorStatus) */
  collectorStatus?: string | null
  hanatourPythonDiagnostics?: HanatourPythonDiagnostics
  /** ?섎굹?ъ뼱 ?ㅼ썡 遺꾪븷 ?섏쭛 ???붾퀎 吏꾨떒(愿由ъ옄 ?묐떟쨌UI ?몄텧?? */
  hanatourPythonMonthDiagnostics?: HanatourPythonMonthRun[]
}

function deriveFillMeta(inputs: DepartureInput[]): { filledFields: string[]; missingFields: string[] } {
  const stats = {
    departureDate: inputs.some((x) => !!x.departureDate),
    adultPrice: inputs.some((x) => (x.adultPrice ?? 0) > 0),
    carrierName: inputs.some((x) => !!x.carrierName),
    outboundDepartureAt: inputs.some((x) => !!x.outboundDepartureAt),
    inboundArrivalAt: inputs.some((x) => !!x.inboundArrivalAt),
    statusRaw: inputs.some((x) => !!x.statusRaw),
    statusLabelsRaw: inputs.some((x) => !!x.statusLabelsRaw),
    seatsStatusRaw: inputs.some((x) => !!x.seatsStatusRaw),
    minPax: inputs.some((x) => (x.minPax ?? 0) > 0),
    supplierDepartureCodeCandidate: inputs.some((x) => !!x.supplierDepartureCodeCandidate),
    matchingTraceRaw: inputs.some((x) => !!x.matchingTraceRaw),
  }
  return {
    filledFields: Object.entries(stats)
      .filter(([, ok]) => ok)
      .map(([k]) => k),
    missingFields: Object.entries(stats)
      .filter(([, ok]) => !ok)
      .map(([k]) => k),
  }
}

/**
 * Python calendar E2E / ?쇱씠釉??대뙌??遺꾧린?? `normalizeSupplierOrigin`怨??숈씪 SSOT濡?留욎텣??
 * ?????녿뒗 異쒖쿂???섎굹?ъ뼱 寃쎈줈(湲곗〈 toSite 湲곕낯媛?濡??대갚.
 */
function calendarE2eSiteFromOrigin(originSource: string): DepartureRescrapeSite {
  const n = normalizeSupplierOrigin(originSource)
  if (n === 'modetour' || n === 'verygoodtour' || n === 'ybtour' || n === 'kyowontour' || n === 'lottetour') return n
  return 'hanatour'
}

/** 상세 URL의 `tourCd`/`goodsCd`가 있으면 E2E `--tour-code`에 우선 사용(originCode가 마스터와 다를 때). */
function kyowontourTourCodeHintForE2e(product: { originCode: string; originUrl: string | null }): string {
  const url = (product.originUrl ?? '').trim()
  if (url) {
    try {
      const u = new URL(url)
      const t = u.searchParams.get('tourCd') ?? u.searchParams.get('goodsCd')
      if (t?.trim()) return t.trim()
    } catch {
      /* ignore */
    }
  }
  return (product.originCode ?? '').trim()
}

export function buildDetailUrl(originSource: string, originCode: string): string {
  const code = encodeURIComponent((originCode ?? '').trim())
  const src = (originSource || '').toLowerCase()
  if (src === 'kyowontour' || normalizeSupplierOrigin(originSource) === 'kyowontour') {
    const base = (process.env.KYOWONTOUR_API_BASE_URL ?? 'https://www.kyowontour.com').replace(/\/$/, '')
    return `${base}/goods/goodsDetail.do?tourCd=${code}`
  }
  if (src.includes('紐⑤몢') || src === 'modetour') {
    return `${MODETOUR_BASE.replace(/\/$/, '')}/package/detail?pkgCd=${code}`
  }
  if (src.includes('李몄쥕?') || src.includes('verygoodtour')) {
    return `${VERYGOODTOUR_BASE.replace(/\/$/, '')}/Product/PackageDetail?ProCode=${code}&PriceSeq=1&MenuCode=leaveLayer`
  }
  if (normalizeSupplierOrigin(originSource) === 'lottetour') {
    const base = LOTTETOUR_BASE.replace(/\/$/, '')
    return `${base}/`
  }
  if (src.includes('?몃옉?띿꽑') || src.includes('ybtour') || src.includes('yellowballoon') || src === 'yellow') {
    const c = (originCode ?? '').trim()
    const detailBase =
      process.env.YBTOUR_PRDT_BASE_URL?.replace(/\/$/, '') ??
      process.env.YELLOWBALLOON_PRDT_BASE_URL?.replace(/\/$/, '') ??
      'https://prdt.ybtour.co.kr'
    if (c) {
      return `${detailBase}/product/detailPackage?goodsCd=${encodeURIComponent(c)}&menu=PKG`
    }
    return `${(process.env.YBTOUR_BASE_URL ?? process.env.YELLOWBALLOON_BASE_URL)?.replace(/\/$/, '') ?? 'https://www.ybtour.co.kr'}/`
  }
  return `${HANATOUR_BASE.replace(/\/$/, '')}/package/detail?pkgCd=${code}`
}

/** ybtour ?쇱씠釉?由ъ뒪?щ옪 吏꾨떒 ???ㅻⅨ 怨듦툒??濡쒓렇? ?욎씠吏 ?딄쾶 prefix 怨좎젙 */
function ybtourRescrapeLog(phase: string, detail: string) {
  console.log(`[ybtour] phase=${phase} ctx=admin-departure-rescrape ${detail}`)
}

function summarizeYbtourDetailUrlForLog(url: string): string {
  try {
    const u = new URL(url)
    const goods = u.searchParams.get('goodsCd') ?? u.searchParams.get('goodscd')
    const pathPart = u.pathname.length > 96 ? `${u.pathname.slice(0, 96)}...` : u.pathname
    return `host=${u.host} path=${pathPart} goodsCd=${goods ? goods.slice(0, 32) : '(none)'}`
  } catch {
    return 'url_parse_failed'
  }
}

/** prdt `detailPackage` 가 evCd 위주일 때 `goodsCd`(Product.originCode)를 붙여 스크래퍼·상세 일치(ybtour 전용). */
function withYbtourPrdtGoodsCdParam(detailUrl: string, originCode: string | null): string {
  const code = (originCode ?? '').trim()
  if (!code) return detailUrl
  try {
    const u = new URL(detailUrl)
    if (!/prdt\.ybtour\.co\.kr$/i.test(u.hostname)) return detailUrl
    if (!u.pathname.includes('detailPackage')) return detailUrl
    const hasGoods = Boolean(u.searchParams.get('goodsCd')?.trim() || u.searchParams.get('goodscd')?.trim())
    if (hasGoods) return detailUrl
    u.searchParams.set('goodsCd', code)
    if (!u.searchParams.get('menu')?.trim()) u.searchParams.set('menu', 'PKG')
    return u.toString()
  } catch {
    return detailUrl
  }
}

function forwardYbtourPythonStderr(stderr: string) {
  const lines = stderr.split('\n').filter((l) => l.includes('[ybtour]'))
  const tail = lines.length > 40 ? lines.slice(-40) : lines
  for (const line of tail) {
    const t = line.trimEnd()
    if (t) console.log(t)
  }
}

function summarizeHanatourDetailUrlForLog(url: string): string {
  try {
    const u = new URL(url)
    const pkg = u.searchParams.get('pkgCd') ?? u.searchParams.get('pkgcd')
    const pathPart = u.pathname.length > 96 ? `${u.pathname.slice(0, 96)}...` : u.pathname
    return `host=${u.host} path=${pathPart} pkgCd=${pkg ? pkg.slice(0, 40) : '(none)'}`
  } catch {
    return 'url_parse_failed'
  }
}

type ScrapedCalendarItem = {
  date?: string
  price?: number
  adultPrice?: number
  statusRaw?: string
  status?: string
  seatsStatusRaw?: string | null
  minPax?: number | null
  carrierName?: string | null
  outboundFlightNo?: string | null
  outboundDepartureAirport?: string | null
  outboundDepartureAt?: string | null
  outboundArrivalAirport?: string | null
  outboundArrivalAt?: string | null
  inboundFlightNo?: string | null
  inboundDepartureAirport?: string | null
  inboundDepartureAt?: string | null
  inboundArrivalAirport?: string | null
  inboundArrivalAt?: string | null
  meetingInfoRaw?: string | null
  meetingPointRaw?: string | null
  meetingTerminalRaw?: string | null
  meetingGuideNoticeRaw?: string | null
}

const CALENDAR_PRICE_SCRAPER_MODULE: Record<'modetour' | 'verygoodtour' | 'ybtour', string> = {
  modetour: 'scripts.calendar_e2e_scraper_modetour.calendar_price_scraper',
  verygoodtour: 'scripts.calendar_e2e_scraper_verygoodtour.calendar_price_scraper',
  ybtour: 'scripts.calendar_e2e_scraper_ybtour.calendar_price_scraper',
}

function execFileIoToUtf8(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  return ''
}

type YbtourPythonOkFalseMeta = {
  phase: string
  message: string
  errorType?: string
}

/** ybtour 전용: PM2/systemd 등에서 `process.cwd()`가 레포 루트가 아닐 때 `-m scripts...` 실패 방지 */
function resolveYbtourPythonRepoRoot(): string {
  const fromEnv = (process.env.BONGTOUR_REPO_ROOT ?? '').trim()
  if (fromEnv) return path.resolve(fromEnv)

  const markerRel = path.join('scripts', 'calendar_e2e_scraper_ybtour', 'calendar_price_scraper.py')
  let dir = path.resolve(process.cwd())
  for (let i = 0; i < 12; i++) {
    try {
      if (fs.existsSync(path.join(dir, markerRel))) return dir
    } catch {
      /* access error — try parent */
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(process.cwd())
}

export async function scrapeLiveCalendar(
  detailUrl: string,
  site: 'modetour' | 'verygoodtour' | 'ybtour',
  extraEnv?: Record<string, string>
): Promise<{ rows: ScrapedCalendarItem[]; stderr: string; ybtourPythonOkFalse?: YbtourPythonOkFalseMeta }> {
  const py = resolvePythonExecutable()
  const argv = ['-m', CALENDAR_PRICE_SCRAPER_MODULE[site], detailUrl]
  const cwd = site === 'ybtour' ? resolveYbtourPythonRepoRoot() : process.cwd()
  /** `ProcessEnv`는 알려진 키만 점접근 허용 → 커스텀 env 로그·전달용으로 Record 사용 */
  const envForChild: Record<string, string | undefined> = {
    ...process.env,
    PYTHONPATH: cwd,
  }
  if (extraEnv) {
    Object.assign(envForChild, extraEnv)
  }

  if (site === 'ybtour') {
    const urlHead = detailUrl.slice(0, 120)
    const cwdBase = process.cwd()
    console.log(
      `[ybtour-diag] python_exec_start command=${JSON.stringify(py)} argv=-m ${CALENDAR_PRICE_SCRAPER_MODULE[site]} url_len=${detailUrl.length} url_head=${urlHead}`
    )
    console.log(
      `[ybtour-diag] cwd=${cwd} cwd_vs_process_cwd=${cwd === cwdBase ? 'same' : `resolved(repo_root) process.cwd=${cwdBase}`} PYTHONPATH=${envForChild.PYTHONPATH ? 'set' : 'unset'} BONGTOUR_REPO_ROOT=${(process.env.BONGTOUR_REPO_ROOT ?? '').trim() ? 'set' : 'unset'} YBTOUR_JSON_UTF8_FILE=${envForChild['YBTOUR_JSON_UTF8_FILE'] ? 'set' : 'unset'} PATH=${envForChild['PATH'] ? 'set' : 'unset'}`
    )
  }

  let stdout = ''
  let stderr = ''
  try {
    const r = await execFileAsync(py, argv, {
      cwd,
      // ybtour / 참좋은 Playwright 달력 E2E는 상품·월 루프에 따라 2~3분 이상 걸릴 수 있음.
      timeout: site === 'ybtour' || site === 'verygoodtour' ? 300_000 : 120_000,
      maxBuffer: 8 * 1024 * 1024,
      env: envForChild as NodeJS.ProcessEnv,
    })
    stdout = execFileIoToUtf8(r.stdout)
    stderr = execFileIoToUtf8(r.stderr)
    if (site === 'ybtour') {
      const head = (s: string) => s.slice(0, 300).replace(/\r?\n/g, '⏎')
      console.log(
        `[ybtour-diag] python_exec_done exit=0 signal=none stdout_len=${stdout.length} stderr_len=${stderr.length}`
      )
      console.log(`[ybtour-diag] stdout_head=${head(stdout)}`)
      console.log(`[ybtour-diag] stderr_head=${head(stderr)}`)
    }
  } catch (e: unknown) {
    if (site === 'ybtour') {
      const err = e as NodeJS.ErrnoException & {
        stdout?: string | Buffer
        stderr?: string | Buffer
        status?: number
        code?: string | number | null
        signal?: string | null
      }
      stdout =
        typeof err.stdout === 'string' ? err.stdout : (err.stdout?.toString('utf8') ?? '')
      stderr =
        typeof err.stderr === 'string' ? err.stderr : (err.stderr?.toString('utf8') ?? '')
      const exitish = err.status ?? err.code
      const head = (s: string) => s.slice(0, 300).replace(/\r?\n/g, '⏎')
      console.log(
        `[ybtour-diag] python_exec_done exit=${String(exitish)} signal=${err.signal ?? 'none'} stdout_len=${stdout.length} stderr_len=${stderr.length}`
      )
      console.log(`[ybtour-diag] stdout_head=${head(stdout)}`)
      console.log(`[ybtour-diag] stderr_head=${head(stderr)}`)
    }
    throw e
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stdout) as unknown
  } catch (parseErr) {
    if (site === 'ybtour') {
      const b0 = Buffer.from(stdout, 'utf8')[0]
      console.log(
        `[ybtour-diag] JSON.parse_failed msg=${parseErr instanceof Error ? parseErr.message : String(parseErr)} stdout_len=${stdout.length} utf8_first_byte=0x${b0 !== undefined ? b0.toString(16) : 'na'}`
      )
    }
    throw parseErr
  }
  const stderrOut = typeof stderr === 'string' ? stderr : ''
  if (site === 'ybtour') {
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'ok' in parsed) {
      const o = parsed as {
        ok: unknown
        rows?: unknown
        phase?: unknown
        message?: unknown
        errorType?: unknown
      }
      const rows = Array.isArray(o.rows) ? (o.rows as ScrapedCalendarItem[]) : []
      if (o.ok === false) {
        return {
          rows: [],
          stderr: stderrOut,
          ybtourPythonOkFalse: {
            phase: typeof o.phase === 'string' ? o.phase : 'unknown',
            message: typeof o.message === 'string' ? o.message : '',
            errorType: typeof o.errorType === 'string' ? o.errorType : undefined,
          },
        }
      }
      return { rows, stderr: stderrOut }
    }
    if (Array.isArray(parsed)) {
      return { rows: parsed as ScrapedCalendarItem[], stderr: stderrOut }
    }
    throw new SyntaxError('ybtour stdout: expected admin envelope {ok,rows} or legacy JSON array')
  }
  const rows = Array.isArray(parsed) ? (parsed as ScrapedCalendarItem[]) : []
  return { rows, stderr: stderrOut }
}

function formatYbtourLiveScrapeFailure(e: unknown): string {
  const err = e as NodeJS.ErrnoException & {
    killed?: boolean
    signal?: string | null
    status?: number
    code?: string | number | null
  }
  if (err.killed === true && err.signal) {
    return `ybtour-calendar-scraper: subprocess signal=${err.signal} (timeout or kill; no stdout envelope)`
  }
  if (typeof err.status === 'number' && err.status !== 0) {
    return `ybtour-calendar-scraper: python exit=${err.status} ${(err.message ?? '').slice(0, 180)}`.slice(0, 240)
  }
  if (typeof err.code === 'string' && err.code.startsWith('ERR_')) {
    return `ybtour-calendar-scraper: spawn/exec ${err.code} ${(err.message ?? '').slice(0, 160)}`.slice(0, 240)
  }
  if (e instanceof SyntaxError) {
    return `ybtour-calendar-scraper: JSON.parse stdout failed ${e.message}`.slice(0, 240)
  }
  return `ybtour-calendar-scraper: ${(e instanceof Error ? e.message : 'unknown').slice(0, 200)}`.slice(0, 240)
}

export function mapScrapedRowsToInputs(
  rows: ScrapedCalendarItem[],
  existingStatusByDate: Map<string, { statusRaw: string | null; seatsStatusRaw: string | null }>
): DepartureInput[] {
  const out: DepartureInput[] = []
  for (const r of rows) {
    const date = String(r.date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const adult = Number(r.adultPrice ?? r.price ?? 0)
    if (!Number.isFinite(adult) || adult <= 0) continue
    const prev = existingStatusByDate.get(date)
    out.push({
      departureDate: date,
      adultPrice: adult,
      statusRaw: r.statusRaw?.trim() || r.status?.trim() || prev?.statusRaw || null,
      seatsStatusRaw: r.seatsStatusRaw ?? prev?.seatsStatusRaw ?? null,
      minPax: r.minPax ?? null,
      carrierName: r.carrierName ?? null,
      outboundFlightNo: r.outboundFlightNo ?? null,
      outboundDepartureAirport: r.outboundDepartureAirport ?? null,
      outboundDepartureAt: r.outboundDepartureAt ?? null,
      outboundArrivalAirport: r.outboundArrivalAirport ?? null,
      outboundArrivalAt: r.outboundArrivalAt ?? null,
      inboundFlightNo: r.inboundFlightNo ?? null,
      inboundDepartureAirport: r.inboundDepartureAirport ?? null,
      inboundDepartureAt: r.inboundDepartureAt ?? null,
      inboundArrivalAirport: r.inboundArrivalAirport ?? null,
      inboundArrivalAt: r.inboundArrivalAt ?? null,
      meetingInfoRaw: r.meetingInfoRaw ?? null,
      meetingPointRaw: r.meetingPointRaw ?? null,
      meetingTerminalRaw: r.meetingTerminalRaw ?? null,
      meetingGuideNoticeRaw: r.meetingGuideNoticeRaw ?? null,
    })
  }
  return out
}

/** ybtour on-demand: 달력 E2E 1회 후 `ymd`와 일치하는 행만 반환. */
export async function collectYbtourDepartureInputForSingleDate(
  detailUrl: string,
  originCode: string | null,
  ymd: string
): Promise<DepartureInput | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const u = withYbtourPrdtGoodsCdParam(detailUrl, originCode)
  const statusByDate = new Map<string, { statusRaw: string | null; seatsStatusRaw: string | null }>()
  try {
    const cal = await scrapeLiveCalendar(u, 'ybtour')
    const inputs = filterDepartureInputsOnOrAfterCalendarToday(
      mapScrapedRowsToInputs(cal.rows, statusByDate)
    )
    for (const x of inputs) {
      const dk =
        x.departureDate instanceof Date
          ? x.departureDate.toISOString().slice(0, 10)
          : String(x.departureDate ?? '').trim().slice(0, 10)
      if (dk === ymd) return x
    }
  } catch {
    return null
  }
  return null
}

/** ybtour on-demand: 달력 E2E 1회 후 inclusive `[fromYmd,toYmd]` 구간 행만 반환. */
export async function collectYbtourDepartureInputsForDateRange(
  detailUrl: string,
  originCode: string | null,
  fromYmd: string,
  toYmd: string
): Promise<DepartureInput[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) return []
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const u = withYbtourPrdtGoodsCdParam(detailUrl, originCode)
  const statusByDate = new Map<string, { statusRaw: string | null; seatsStatusRaw: string | null }>()
  try {
    const cal = await scrapeLiveCalendar(u, 'ybtour', {
      YBTOUR_DATE_FROM: lo,
      YBTOUR_DATE_TO: hi,
      YBTOUR_SEASON_END_STOP: '0', // range 모드에서는 시즌 종료 중단 비활성화
    })
    const inputs = filterDepartureInputsOnOrAfterCalendarToday(
      mapScrapedRowsToInputs(cal.rows, statusByDate)
    )
    return inputs.filter((x) => {
      const dk =
        x.departureDate instanceof Date
          ? x.departureDate.toISOString().slice(0, 10)
          : String(x.departureDate ?? '').trim().slice(0, 10)
      return dk >= lo && dk <= hi
    })
  } catch {
    return []
  }
}

export async function collectDepartureInputsForAdminRescrape(
  prisma: PrismaClient,
  product: { id: string; originSource: string; originCode: string; originUrl: string | null },
  opts?: { hanatourMonthYm?: string | null }
): Promise<DepartureRescrapeResult> {
  const existingDeps = await prisma.productDeparture.findMany({
    where: { productId: product.id },
    select: { departureDate: true, statusRaw: true, seatsStatusRaw: true },
  })
  const statusByDate = new Map(
    existingDeps.map((d) => [
      d.departureDate.toISOString().slice(0, 10),
      { statusRaw: d.statusRaw, seatsStatusRaw: d.seatsStatusRaw },
    ])
  )

  const site = calendarE2eSiteFromOrigin(product.originSource)
  const detailUrlForTrace = product.originUrl?.trim() || buildDetailUrl(product.originSource, product.originCode)
  const detailUrlSummary = (() => {
    if (site === 'hanatour') return summarizeHanatourDetailUrlForLog(detailUrlForTrace)
    if (site === 'ybtour') return summarizeYbtourDetailUrlForLog(detailUrlForTrace)
    try {
      const u = new URL(detailUrlForTrace)
      return `host=${u.host} path_len=${u.pathname.length}`
    } catch {
      return 'detail_url_invalid'
    }
  })()
  let liveError: string | null = null
  let attemptedLive = false

  if (site === 'lottetour') {
    attemptedLive = true
    const metaRow = await prisma.product.findUnique({
      where: { id: product.id },
      select: { rawMeta: true, originUrl: true },
    })
    const hints = parseLottetourEvtListCollectionHints({
      rawMeta: metaRow?.rawMeta ?? null,
      originUrl: product.originUrl?.trim() || metaRow?.originUrl || null,
    })
    const detailUrlResolved =
      product.originUrl?.trim() ||
      (hints.menuNos && hints.detailEvtCd
        ? buildLottetourEvtDetailUrl(hints.menuNos, hints.detailEvtCd)
        : detailUrlForTrace)
    const detailUrlSummaryLt = (() => {
      try {
        const u = new URL(detailUrlResolved)
        return `host=${u.host} path_len=${u.pathname.length} godId=${hints.godId ?? '(none)'}`
      } catch {
        return 'detail_url_invalid'
      }
    })()
    if (!hints.godId || !hints.menuNos) {
      const fillMeta = deriveFillMeta([])
      return {
        mode: 'live-rescrape',
        source: 'lottetour-evtListAjax-html',
        inputs: [],
        attemptedLive,
        liveError: `롯데관광: evtList 공개 HTML 수집에 필요한 godId·menuNo 경로가 없습니다. ${hints.warnings.join(' ')}`.slice(
          0,
          500
        ),
        filledFields: fillMeta.filledFields,
        missingFields: fillMeta.missingFields,
        mappingStatus: 'detail-candidate-found-but-unmapped',
        notes: hints.warnings,
        site,
        detailUrl: detailUrlResolved,
        detailUrlSummary: detailUrlSummaryLt,
        collectorStatus: null,
      }
    }
    try {
      const monthCount = Math.max(
        1,
        Math.min(36, Number(process.env.LOTTETOUR_CALENDAR_MONTH_COUNT ?? '12') || 12)
      )
      const { rows, warnings } = await collectLottetourCalendarRange(
        { godId: hints.godId, menuNos: hints.menuNos },
        {
          monthCount,
          logLabel: `admin-departure-rescrape:${product.id}`,
        }
      )
      const mapped = mapLottetourCalendarToDepartureInputs(rows, product.id)
      const inputs = filterDepartureInputsOnOrAfterCalendarToday(mapped as DepartureInput[])
      if (inputs.length > 0) {
        const fillMeta = deriveFillMeta(inputs)
        return {
          mode: 'live-rescrape',
          source: 'lottetour-evtListAjax-html',
          inputs,
          attemptedLive,
          liveError: null,
          filledFields: fillMeta.filledFields,
          missingFields: fillMeta.missingFields,
          mappingStatus: 'per-date-confirmed',
          notes: [...hints.warnings, ...warnings],
          site,
          detailUrl: detailUrlResolved,
          detailUrlSummary: detailUrlSummaryLt,
          collectorStatus: null,
        }
      }
      const fillMeta = deriveFillMeta([])
      const tail = warnings.length ? ` · ${warnings.slice(0, 4).join(' · ')}` : ''
      return {
        mode: 'live-rescrape',
        source: 'lottetour-evtListAjax-html',
        inputs: [],
        attemptedLive,
        liveError: `롯데관광: 유효 출발일 0건(오늘 이후 필터 후)${tail}`,
        filledFields: fillMeta.filledFields,
        missingFields: fillMeta.missingFields,
        mappingStatus: 'detail-candidate-found-but-unmapped',
        notes: [...hints.warnings, ...warnings],
        site,
        detailUrl: detailUrlResolved,
        detailUrlSummary: detailUrlSummaryLt,
        collectorStatus: null,
      }
    } catch (e) {
      const fillMeta = deriveFillMeta([])
      const msg = e instanceof Error ? e.message : String(e)
      return {
        mode: 'live-rescrape',
        source: 'lottetour-evtListAjax-html',
        inputs: [],
        attemptedLive,
        liveError: `롯데관광: ${msg.slice(0, 400)}`,
        filledFields: fillMeta.filledFields,
        missingFields: fillMeta.missingFields,
        mappingStatus: 'detail-candidate-found-but-unmapped',
        notes: hints.warnings,
        site,
        detailUrl: detailUrlResolved,
        detailUrlSummary: detailUrlSummaryLt,
        collectorStatus: null,
      }
    }
  }

  if (site === 'kyowontour') {
    attemptedLive = true
    const masterCode = (product.originCode ?? '').trim()
    if (!masterCode) {
      const fillMeta = deriveFillMeta([])
      return {
        mode: 'live-rescrape',
        source: 'kyowontour-differentDepartDate',
        inputs: [],
        attemptedLive,
        liveError: 'kyowontour: originCode(상품·마스터 코드)가 비어 있어 캘린더를 호출할 수 없습니다.',
        filledFields: fillMeta.filledFields,
        missingFields: fillMeta.missingFields,
        mappingStatus: 'detail-candidate-found-but-unmapped',
        notes: [],
        site,
        detailUrl: detailUrlForTrace,
        detailUrlSummary,
        collectorStatus: null,
      }
    }
    try {
      const { rows, warnings } = await collectKyowontourCalendarRange(masterCode, {
        tourCodeForE2EFallback: kyowontourTourCodeHintForE2e(product),
        e2eMasterCodeHint: masterCode,
        monthCount: Math.max(
          1,
          Math.min(36, Number(process.env.KYOWONTOUR_CALENDAR_MONTH_COUNT ?? '12') || 12)
        ),
        logLabel: `admin-departure-rescrape:${product.id}`,
      })
      const mapped = mapKyowontourCalendarToDepartureInputs(rows, product.id)
      const inputs = filterDepartureInputsOnOrAfterCalendarToday(mapped as DepartureInput[])
      if (inputs.length > 0) {
        const fillMeta = deriveFillMeta(inputs)
        return {
          mode: 'live-rescrape',
          source: 'kyowontour-differentDepartDate',
          inputs,
          attemptedLive,
          liveError: null,
          filledFields: fillMeta.filledFields,
          missingFields: fillMeta.missingFields,
          mappingStatus: 'per-date-confirmed',
          notes: warnings.length ? warnings : undefined,
          site,
          detailUrl: detailUrlForTrace,
          detailUrlSummary,
          collectorStatus: null,
        }
      }
      const fillMeta = deriveFillMeta([])
      const tail = warnings.length ? ` · ${warnings.slice(0, 4).join(' · ')}` : ''
      return {
        mode: 'live-rescrape',
        source: 'kyowontour-differentDepartDate',
        inputs: [],
        attemptedLive,
        liveError: `kyowontour: 유효 출발일 0건(오늘 이후 필터 후)${tail}`,
        filledFields: fillMeta.filledFields,
        missingFields: fillMeta.missingFields,
        mappingStatus: 'detail-candidate-found-but-unmapped',
        notes: warnings.length ? warnings : undefined,
        site,
        detailUrl: detailUrlForTrace,
        detailUrlSummary,
        collectorStatus: null,
      }
    } catch (e) {
      const fillMeta = deriveFillMeta([])
      const msg = e instanceof Error ? e.message : String(e)
      return {
        mode: 'live-rescrape',
        source: 'kyowontour-differentDepartDate',
        inputs: [],
        attemptedLive,
        liveError: `kyowontour: ${msg.slice(0, 400)}`,
        filledFields: fillMeta.filledFields,
        missingFields: fillMeta.missingFields,
        mappingStatus: 'detail-candidate-found-but-unmapped',
        notes: [],
        site,
        detailUrl: detailUrlForTrace,
        detailUrlSummary,
        collectorStatus: null,
      }
    }
  }

  if (site === 'modetour') {
    attemptedLive = true
    try {
      // 紐⑤몢?ъ뼱 罹섎┛??UX(珥덇린 2媛쒖썡 + ?곗륫 ?대룞) 湲곗??쇰줈 ?곗꽑 4媛쒖썡 踰붿쐞瑜??섏쭛?쒕떎.
      const parsed = await collectModetourDepartureInputs(product.originUrl, {
        monthsForward: SCRAPE_DEFAULT_MONTHS_FORWARD,
      })
      if (parsed.inputs.length > 0) {
        return {
          mode: 'live-rescrape',
          source: 'modetour-adapter',
          inputs: parsed.inputs,
          attemptedLive,
          liveError: null,
          filledFields: parsed.meta.filledFields,
          missingFields: parsed.meta.missingFields,
          mappingStatus: parsed.meta.mappingStatus,
          notes: parsed.meta.notes,
          site,
          detailUrl: detailUrlForTrace,
          detailUrlSummary,
          collectorStatus: null,
        }
      }
      liveError = 'modetour-adapter returned 0 rows'
    } catch (e) {
      liveError = e instanceof Error ? e.message : 'modetour-adapter execution failed'
    }
  }

  try {
    attemptedLive = true
    const detailUrl = detailUrlForTrace

    if (site === 'hanatour') {
      console.log(
        `[hanatour] phase=admin-rescrape-entry ctx=lib/admin-departure-rescrape func=collectHanatourDepartureInputs productId=${product.id} originSource=${JSON.stringify((product.originSource ?? '').slice(0, 80))} ${summarizeHanatourDetailUrlForLog(detailUrl)}`
      )
      const horizon = resolveHanatourAdminE2eMonthsForward()
      const specified = opts?.hanatourMonthYm?.trim() ? opts.hanatourMonthYm.trim() : null

      let monthYmsOverride: string[]
      if (specified) {
        const ym = validateHanatourAdminMonthYm(specified)
        if (!ym) {
          const fillMeta = deriveFillMeta([])
          return {
            mode: 'live-rescrape',
            source: 'hanatour-adapter',
            inputs: [],
            attemptedLive,
            liveError: 'hanatour: hanatourMonth??YYYY-MM ?뺤떇?댁뼱???⑸땲??',
            filledFields: fillMeta.filledFields,
            missingFields: fillMeta.missingFields,
            mappingStatus: 'detail-candidate-found-but-unmapped',
            notes: [],
            site,
            detailUrl: detailUrlForTrace,
            detailUrlSummary,
            collectorStatus: null,
          }
        }
        const allowedYm = new Set(buildHanatourKstTargetMonths(horizon))
        if (!allowedYm.has(ym)) {
          const fillMeta = deriveFillMeta([])
          return {
            mode: 'live-rescrape',
            source: 'hanatour-adapter',
            inputs: [],
            attemptedLive,
            liveError: `hanatour: 吏???붿? 愿由ъ옄 異쒕컻???ㅼ틪 踰붿쐞(?뱀썡遺???욎쑝濡?${horizon}媛쒖썡) ?덉뿉 ?덉뼱???⑸땲??`,
            filledFields: fillMeta.filledFields,
            missingFields: fillMeta.missingFields,
            mappingStatus: 'detail-candidate-found-but-unmapped',
            notes: [],
            site,
            detailUrl: detailUrlForTrace,
            detailUrlSummary,
            collectorStatus: null,
          }
        }
        monthYmsOverride = [ym]
      } else {
        const chunk = computeHanatourAdminDepartureChunk({
          horizonMonths: horizon,
          nextStartYm: null,
        })
        if (chunk.chunkYms.length === 0) {
          const fillMeta = deriveFillMeta([])
          return {
            mode: 'live-rescrape',
            source: 'hanatour-adapter',
            inputs: [],
            attemptedLive,
            liveError: 'hanatour: horizon ?댁뿉 ?섏쭛???붿씠 ?놁뒿?덈떎.',
            filledFields: fillMeta.filledFields,
            missingFields: fillMeta.missingFields,
            mappingStatus: 'detail-candidate-found-but-unmapped',
            notes: [],
            site,
            detailUrl: detailUrlForTrace,
            detailUrlSummary,
            collectorStatus: null,
          }
        }
        monthYmsOverride = chunk.chunkYms
      }

      const hanatour = await collectHanatourDepartureInputs(detailUrl, {
        monthYmsOverride,
        stopAfterFirstDeparture: false,
      })
      if (hanatour.inputs.length > 0) {
        const fillMeta = deriveFillMeta(hanatour.inputs)
        console.log(
          `[hanatour] phase=admin-rescrape-collect-summary productId=${product.id} inputs=${hanatour.inputs.length} ${hanatour.pythonDiagnostics ? `parsedJson=${hanatour.pythonDiagnostics.parsedJsonRows} afterKst=${hanatour.pythonDiagnostics.rowsAfterKstFilter}` : ''}`
        )
        return {
          mode: 'live-rescrape',
          source: 'hanatour-adapter',
          inputs: hanatour.inputs,
          attemptedLive,
          liveError: null,
          filledFields: fillMeta.filledFields,
          missingFields: fillMeta.missingFields,
          mappingStatus: hanatour.meta.mappingStatus,
          notes: hanatour.meta.notes,
          site,
          detailUrl: detailUrlForTrace,
          detailUrlSummary,
          collectorStatus: hanatour.meta.collectorStatus ?? null,
          hanatourPythonDiagnostics: hanatour.pythonDiagnostics,
          hanatourPythonMonthDiagnostics: hanatour.pythonMonthDiagnostics,
        }
      }
      const fillMeta = deriveFillMeta([])
      console.log(
        `[hanatour] phase=admin-rescrape-collect-empty productId=${product.id} hanatour_inputs=0`
      )
      return {
        mode: 'live-rescrape',
        source: 'hanatour-adapter',
        inputs: [],
        attemptedLive,
        liveError: 'hanatour modal price rows unavailable; blocked fallback to product-price-rebuild',
        filledFields: fillMeta.filledFields,
        missingFields: fillMeta.missingFields,
        mappingStatus: 'detail-candidate-found-but-unmapped',
        notes: [
          'hanatour strict mode: ProductDeparture.adultPrice uses only popup right-card bottom price',
          'fallback-rebuild(base+fuel or sidebar total derived values) blocked for hanatour',
          ...(hanatour.meta.notes ?? []),
        ],
        site,
        detailUrl: detailUrlForTrace,
        detailUrlSummary,
        collectorStatus: hanatour.meta.collectorStatus ?? null,
        hanatourPythonDiagnostics: hanatour.pythonDiagnostics,
        hanatourPythonMonthDiagnostics: hanatour.pythonMonthDiagnostics,
      }
    }

    const detailUrlForLiveCalendar =
      site === 'ybtour' ? withYbtourPrdtGoodsCdParam(detailUrl, product.originCode) : detailUrl
    const cal = await scrapeLiveCalendar(detailUrlForLiveCalendar, site)
    const scrapedRows = cal.rows
    const pyStderr = cal.stderr

    if (site === 'ybtour') {
      forwardYbtourPythonStderr(pyStderr)
    }

    if (site === 'ybtour' && cal.ybtourPythonOkFalse) {
      const m = cal.ybtourPythonOkFalse
      liveError = `ybtour-calendar-scraper: python stdout ok=false phase=${m.phase}${m.errorType ? ` errorType=${m.errorType}` : ''} msg=${m.message.slice(0, 160)}`
      ybtourRescrapeLog(
        'node-envelope-ok-false',
        `phase=${m.phase} errorType=${m.errorType ?? 'n/a'} msg_head=${m.message.slice(0, 120)}`
      )
    } else {
      if (site === 'ybtour') {
        ybtourRescrapeLog(
          'node-before-map',
          `site=ybtour originSource=${JSON.stringify((product.originSource ?? '').slice(0, 80))} originCode=${JSON.stringify((product.originCode ?? '').slice(0, 40))} ${summarizeYbtourDetailUrlForLog(detailUrlForLiveCalendar)}`
        )
      }
      const inputs = filterDepartureInputsOnOrAfterCalendarToday(
        mapScrapedRowsToInputs(scrapedRows, statusByDate)
      )
      if (inputs.length > 0) {
        const fillMeta = deriveFillMeta(inputs)
        if (site === 'ybtour') {
          ybtourRescrapeLog(
            'node-after-kst-filter',
            `inputs=${inputs.length} raw_scraped_rows=${scrapedRows.length} (see Python stderr for phase=final-diagnosis)`
          )
        }
        return {
          mode: 'live-rescrape',
          source:
            site === 'modetour'
              ? 'modetour-adapter'
              : site === 'ybtour'
                ? 'ybtour-calendar-scraper'
                : site === 'verygoodtour'
                  ? 'verygoodtour-live-calendar'
                  : 'hanatour-adapter',
          inputs,
          attemptedLive,
          liveError: null,
          filledFields: fillMeta.filledFields,
          missingFields: fillMeta.missingFields,
          mappingStatus: 'per-date-confirmed',
          site,
          detailUrl: detailUrlForTrace,
          detailUrlSummary,
          collectorStatus: null,
        }
      }
      liveError =
        site === 'ybtour'
          ? 'ybtour-calendar-scraper: 0 rows after map+kst-filter ??check stderr [ybtour] phase=final-diagnosis (baseline-title-empty | modal-open-failed | title-match-zero | kst-or-date-parse-zero | detail-page-load-failed | ??'
          : `${site}-adapter returned 0 rows`
      if (site === 'ybtour') {
        ybtourRescrapeLog(
          'node-zero-inputs',
          `raw_scraped_rows=${scrapedRows.length} mapped_then_kst_filter=0 liveError_hint=see_message`
        )
      }
    }
  } catch (e) {
    if (site === 'ybtour') {
      ybtourRescrapeLog(
        'node-exec-or-parse-failed',
        e instanceof Error ? `${e.name}: ${e.message.slice(0, 220)}` : 'unknown_error'
      )
    }
    liveError =
      site === 'ybtour'
        ? formatYbtourLiveScrapeFailure(e)
        : `${site}-adapter execution failed`
    // fallback below
  }

  const prices = await prisma.productPrice.findMany({
    where: { productId: product.id },
    orderBy: { date: 'asc' },
  })
  const fallbackInputs = prices.map((p) => {
    const key = p.date.toISOString().slice(0, 10)
    const prev = statusByDate.get(key)
    return {
      departureDate: p.date,
      adultPrice: p.adult,
      childBedPrice: p.childBed,
      childNoBedPrice: p.childNoBed,
      infantPrice: p.infant,
      localPriceText: p.localPrice,
      statusRaw: prev?.statusRaw ?? null,
      seatsStatusRaw: prev?.seatsStatusRaw ?? null,
    }
  })
  const fillMeta = deriveFillMeta(fallbackInputs)
  return {
    mode: 'fallback-rebuild',
    source: 'product-price-rebuild',
    inputs: fallbackInputs,
    attemptedLive,
    liveError,
    filledFields: fillMeta.filledFields,
    missingFields: fillMeta.missingFields,
    mappingStatus: 'price-only-confirmed',
    site,
    detailUrl: detailUrlForTrace,
    detailUrlSummary,
    collectorStatus: null,
  }
}
