/**
 * 하나투어 출발일 모달·상세 연동 수집.
 * Playwright 기반 수집은 `scripts/calendar_e2e_scraper_hanatour`가 stdout JSON으로 반환하고, 여기서는 DepartureInput으로 매핑한다.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'
import { buildCommonMatchingTrace, buildDepartureTitleLayers } from '@/lib/departure-option-hanatour'
import {
  departureInputToYmd,
  filterDepartureInputsOnOrAfterCalendarToday,
  resolveHanatourAdminE2eMonthsForward,
  scrapeCalendarTodayYmd,
  scrapeTodayYearMonth,
  SCRAPE_DEFAULT_MONTHS_FORWARD,
} from '@/lib/scrape-date-bounds'
import { applyDepartureTerminalMeetingInfo } from '@/lib/meeting-terminal-rules'
import { resolvePythonExecutable } from '@/lib/resolve-python-executable'

/**
 * 월별 subprocess `execFile` timeout(ms).
 * `HANATOUR_PYTHON_TIMEOUT_MS_PER_MONTH` → `HANATOUR_PYTHON_TIMEOUT_MS`(레거시).
 * 둘 다 없거나 유효하지 않으면 **0** = Node 기본(프로세스에 대한 시간 제한 없음).
 * env에 숫자가 있으면: `0`은 무제한, 그 외는 최소 60초로 간주(그 미만은 무시하고 다음 단계).
 */
function resolveHanatourPythonTimeoutMsPerMonth(): number {
  const tryParse = (raw: string): number | null => {
    const t = raw.trim()
    if (!t) return null
    const n = Number.parseInt(t, 10)
    if (!Number.isFinite(n)) return null
    if (n === 0) return 0
    if (n >= 60_000) return n
    return null
  }
  const p = tryParse(process.env.HANATOUR_PYTHON_TIMEOUT_MS_PER_MONTH ?? '')
  if (p !== null) return p
  const l = tryParse(process.env.HANATOUR_PYTHON_TIMEOUT_MS ?? '')
  if (l !== null) return l
  return 0
}

/** 다월 병렬 subprocess 동시 개수. `HANATOUR_E2E_MONTH_PARALLELISM` 없으면 기본 3 (범위 1~8). */
function resolveHanatourE2eMonthParallelism(): number {
  const raw = (process.env.HANATOUR_E2E_MONTH_PARALLELISM ?? '').trim()
  const n = raw ? Number.parseInt(raw, 10) : NaN
  if (Number.isFinite(n) && n >= 1 && n <= 8) return n
  return 3
}

async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const n = items.length
  const out: R[] = new Array(n)
  if (n === 0) return out
  let next = 0
  const cap = Math.max(1, Math.min(limit, n))
  const spin = async (): Promise<void> => {
    for (;;) {
      const i = next++
      if (i >= n) return
      out[i] = await worker(items[i]!, i)
    }
  }
  await Promise.all(Array.from({ length: cap }, () => spin()))
  return out
}

export type HanatourMonthSessionMemo = {
  month: string
  status: HanatourMonthRunStatus
  rowsCollected: number
  elapsedMs: number
  failedReason: string | null
  nextMonthPlanned: string | null
}

/** 관리자 하나투어 첫 재수집: horizon 앞에서 이 개월만 자동 수집. 이후는 지정 달(hanatourMonth) 1개월. */
export const HANATOUR_ADMIN_DEPARTURE_CHUNK_MONTHS = 2

/** KST 당월부터 앞으로 `monthsForward`개의 YYYY-MM (운영 다월 재수집 분할용) */
export function buildHanatourKstTargetMonths(monthsForward: number): string[] {
  const n = Math.max(1, Math.min(18, monthsForward))
  const t = scrapeTodayYearMonth()
  let y = t.year
  let m = t.month
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

const HANATOUR_CURSOR_KEY = 'hanatourAdminDepartureNextYm'

/** Product.rawMeta JSON 안의 하나투어 출발일 재수집 다음 시작 월(YYYY-MM). */
export function parseHanatourAdminDepartureNextYm(rawMeta: string | null | undefined): string | null {
  if (!rawMeta?.trim()) return null
  try {
    const j = JSON.parse(rawMeta) as Record<string, unknown>
    const v = j[HANATOUR_CURSOR_KEY]
    if (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)) return v
    return null
  } catch {
    return null
  }
}

export function mergeHanatourAdminDepartureNextYmIntoRawMeta(
  rawMeta: string | null | undefined,
  nextYm: string | null
): string {
  let base: Record<string, unknown> = {}
  try {
    if (rawMeta?.trim()) base = JSON.parse(rawMeta) as Record<string, unknown>
  } catch {
    base = {}
  }
  if (nextYm == null) {
    delete base[HANATOUR_CURSOR_KEY]
  } else {
    base[HANATOUR_CURSOR_KEY] = nextYm
  }
  return JSON.stringify(base)
}

/**
 * 관리자 하나투어: horizon(월 개수) 안에서 2개월씩 잘라 다음 청크를 계산한다.
 * - nextStartYm null → 앞에서부터 2개월
 * - nextStartYm 있음 → 해당 월부터 2개월(추가수집)
 */
export function computeHanatourAdminDepartureChunk(params: {
  horizonMonths: number
  nextStartYm: string | null
}): { chunkYms: string[]; nextCursorYm: string | null; exhausted: boolean } {
  const chunkSize = HANATOUR_ADMIN_DEPARTURE_CHUNK_MONTHS
  const all = buildHanatourKstTargetMonths(params.horizonMonths)
  if (all.length === 0) return { chunkYms: [], nextCursorYm: null, exhausted: true }

  let startIdx = 0
  if (params.nextStartYm) {
    const i = all.indexOf(params.nextStartYm)
    if (i >= 0) startIdx = i
    else {
      const fallback = all.findIndex((m) => m >= params.nextStartYm!)
      startIdx = fallback >= 0 ? fallback : all.length
    }
  }

  const chunkYms = all.slice(startIdx, startIdx + chunkSize)
  if (chunkYms.length === 0) return { chunkYms: [], nextCursorYm: null, exhausted: true }

  const lastYm = chunkYms[chunkYms.length - 1]!
  const lastIdx = all.indexOf(lastYm)
  const nextIdx = lastIdx >= 0 ? lastIdx + 1 : startIdx + chunkYms.length
  const nextCursorYm = nextIdx < all.length ? all[nextIdx]! : null
  const exhausted = nextCursorYm == null
  return { chunkYms, nextCursorYm, exhausted }
}

/** 관리자 지정 달(YYYY-MM). 형식만 검증한다. */
export function validateHanatourAdminMonthYm(raw: string): string | null {
  const t = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}$/.test(t)) return null
  const mo = Number.parseInt(t.slice(5, 7), 10)
  if (!Number.isFinite(mo) || mo < 1 || mo > 12) return null
  return t
}

function dedupeHanatourInputsByDepartureDate(inputs: DepartureInput[]): DepartureInput[] {
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

const execFileAsync = promisify(execFile)

/** 레거시 `/package/detail?pkgCd=` 는 신규 TRP 상세(다른 출발일 CTA)와 어긋날 수 있어 모달 수집 전용으로만 치환 */
const HANATOUR_TRP_PKG_DETAIL_PATH = '/trp/pkg/CHPC0PKG0200M200'

function normalizeHanatourDetailUrlForModalScraper(url: string): string {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return trimmed
  try {
    const u = new URL(trimmed)
    if (!u.hostname.toLowerCase().includes('hanatour.com')) return trimmed
    const path = u.pathname.replace(/\/$/, '') || '/'
    const pkg =
      u.searchParams.get('pkgCd')?.trim() || u.searchParams.get('pkgcd')?.trim() || ''
    if (path === '/package/detail' || path.endsWith('/package/detail')) {
      if (pkg) {
        const nu = new URL(u.origin + HANATOUR_TRP_PKG_DETAIL_PATH)
        nu.searchParams.set('pkgCd', pkg)
        nu.searchParams.set('type', 'H01')
        return nu.toString()
      }
      return trimmed
    }
    if (path.includes('/trp/pkg/') && pkg) {
      if (!u.searchParams.get('type')?.trim()) {
        u.searchParams.set('type', 'H01')
        return u.toString()
      }
    }
  } catch {
    /* 원문 유지 */
  }
  return trimmed
}

function summarizeTextForLog(s: string, maxLen: number): string {
  const t = typeof s === 'string' ? s.replace(/\r\n/g, '\n').trim() : ''
  if (!t.length) return ''
  if (t.length <= maxLen) return t
  const head = Math.max(40, Math.floor(maxLen * 0.55))
  const tail = maxLen - head - 3
  return tail > 20 ? `${t.slice(0, head)}…${t.slice(-tail)}` : t.slice(0, maxLen)
}

function hanatourStderrLineRelevant(line: string): boolean {
  return (
    line.includes('[hanatour]') ||
    line.includes('[HANATOUR_E2E]') ||
    line.includes('[HANATOUR_E2E_TIMING]') ||
    line.includes('[HANATOUR_E2E_PHASE]') ||
    line.includes('[HANATOUR_E2E_BUCKET_MS]') ||
    line.includes('[HANATOUR_E2E_ADMIN]')
  )
}

function hanatourStderrDigest(stderr: string): string {
  const lines = stderr.split('\n').filter(hanatourStderrLineRelevant)
  const joined = lines.join('\n').trim()
  return summarizeTextForLog(joined || stderr, 1200)
}

/** Python은 stdout=JSON 전용 — stderr는 [hanatour]·E2E 진단 줄만 요약/콘솔 전달 */
function forwardHanatourPythonStderr(stderr: string) {
  const lines = stderr.split('\n').filter(hanatourStderrLineRelevant)
  const tail = lines.length > 60 ? lines.slice(-60) : lines
  for (const line of tail) {
    const t = line.trimEnd()
    if (t) console.log(t)
  }
}

export type HanatourDepartureCollectMeta = {
  filledFields: string[]
  missingFields: string[]
  mappingStatus: 'per-date-confirmed' | 'price-only-confirmed' | 'detail-candidate-found-but-unmapped'
  notes: string[]
  /** 수집기 표준 로그(원문 제목·매칭 사유 등) */
  log?: Record<string, unknown>
  /** Python: success | modal_empty | modal_failed | modal_open */
  collectorStatus?: string
}

export type HanatourDepartureCollectResult = {
  inputs: DepartureInput[]
  meta: HanatourDepartureCollectMeta
  /** 실전 검증용: Python CLI stdout/stderr·건수 (원문 전체 dump 금지) */
  pythonDiagnostics?: HanatourPythonDiagnostics
  /** 다월 분할 수집 시 월별 진단(병목·phase) */
  pythonMonthDiagnostics?: HanatourPythonMonthRun[]
}

/** `POST …/departures` 로그·응답용 — 스크래퍼 로직과 무관한 관측값만 */
export type HanatourPythonDiagnostics = {
  /** 실제 spawn에 사용한 실행 파일 경로 또는 `python3` 등 */
  command: string
  argv: string[]
  cwd: string
  timeoutMs: number
  exitCode: number | null
  signal: string | null
  stdoutChars: number
  stderrChars: number
  stdoutSummary: string
  stderrSummary: string
  parsedJsonRows: number
  mappedRowsBeforeKstFilter: number
  rowsAfterKstFilter: number
  /** execFile timeout / SIGTERM 등 */
  pythonTimedOut: boolean
  /** 프로세스는 비정상 종료됐으나 stdout JSON을 복구해 행 매핑함 */
  stdoutSalvagedAfterCliError?: boolean
  /** 단일 월 subprocess 호출 시 대상 YYYY-MM */
  targetMonthYm?: string
}

export type HanatourMonthRunStatus = 'ok' | 'ok_salvaged' | 'timeout' | 'cli_error' | 'parse_error'

export type HanatourBottleneckCategory =
  | 'modal'
  | 'list_scan'
  | 'day_click'
  | 'calendar_align'
  | 'browser_close'
  | 'json'
  | 'unknown'

/** 월별 subprocess 계측(재수집 병목 가시화) */
export type HanatourPythonMonthRun = HanatourPythonDiagnostics & {
  startedAt: string
  endedAt: string
  elapsedMs: number
  inputsLen: number
  /** KST 필터 후 반영 행 수(inputsLen 과 동일 용도) */
  rowsCollected: number
  status: HanatourMonthRunStatus
  failurePhase?: string | null
  lastPhase?: string | null
  slowestPhaseGapMs?: number | null
  slowestFromPhase?: string | null
  slowestToPhase?: string | null
  bottleneckCategory?: HanatourBottleneckCategory | null
  stderrPhaseSummary?: string
}

/** 관리자 응답·UI용 — 월별 한 줄 요약 (예: `2026-05 ok rows=3`) */
export function buildHanatourMonthSummaryLines(
  diags: HanatourPythonMonthRun[] | undefined | null
): string[] {
  if (!diags?.length) return []
  return diags.map((d) => {
    const ym = d.targetMonthYm ?? '—'
    const st = d.status
    const lp = d.lastPhase ?? d.failurePhase ?? '—'
    const rows = d.rowsCollected ?? d.inputsLen ?? 0
    if (st === 'ok' || st === 'ok_salvaged') {
      return `${ym} ${st} rows=${rows}`
    }
    return `${ym} ${st} lastPhase=${lp}`
  })
}

/** 부분 성공 시 상단 메시지 한 줄 */
export function buildHanatourPartialSuccessHeadline(
  diags: HanatourPythonMonthRun[] | undefined | null
): string | null {
  if (!diags?.length) return null
  const okN = diags.filter((x) => x.status === 'ok' || x.status === 'ok_salvaged').length
  const badN = diags.length - okN
  if (badN <= 0) return null
  return `${diags.length}개월 중 ${okN}개월 수집 성공, ${badN}개월 timeout/실패`
}

function parseHanatourE2ePhaseLines(stderr: string): Array<{ phase: string; month: string; elapsedSec: number }> {
  const out: Array<{ phase: string; month: string; elapsedSec: number }> = []
  for (const line of stderr.split('\n')) {
    if (!line.includes('[HANATOUR_E2E_PHASE]')) continue
    const ph = /phase=([^\t]+)/.exec(line)
    const mo = /month=([^\t]+)/.exec(line)
    const el = /elapsed=([\d.]+)s/.exec(line)
    if (!ph?.[1]) continue
    out.push({
      phase: ph[1].trim(),
      month: (mo?.[1] ?? 'unknown').trim(),
      elapsedSec: el?.[1] ? Number.parseFloat(el[1]) : 0,
    })
  }
  return out
}

function categorizeHanatourPhase(phase: string): HanatourBottleneckCategory {
  const p = phase.toLowerCase()
  if (p.includes('modal') || p.includes('detail_page')) return 'modal'
  if (p.includes('calendar_aligned') || p.includes('align')) return 'calendar_align'
  if (p.includes('right_list') || p.includes('list_scan')) return 'list_scan'
  if (p.includes('day_click')) return 'day_click'
  if (p.includes('browser_close') || p.includes('after_browser') || p.includes('before_browser')) return 'browser_close'
  if (p.includes('json') || p.includes('stdout')) return 'json'
  return 'unknown'
}

function analyzeHanatourStderrPhases(stderr: string): {
  lastPhase: string | null
  slowestGapMs: number | null
  slowestFromPhase: string | null
  slowestToPhase: string | null
  bottleneckCategory: HanatourBottleneckCategory | null
  summary: string
} {
  const pts = parseHanatourE2ePhaseLines(stderr)
  if (pts.length === 0) {
    return {
      lastPhase: null,
      slowestGapMs: null,
      slowestFromPhase: null,
      slowestToPhase: null,
      bottleneckCategory: null,
      summary: 'no_phase_lines',
    }
  }
  const lastPhase = pts[pts.length - 1]?.phase ?? null
  let slowestGapMs: number | null = null
  let slowestFromPhase: string | null = null
  let slowestToPhase: string | null = null
  for (let i = 1; i < pts.length; i++) {
    const gapSec = pts[i].elapsedSec - pts[i - 1].elapsedSec
    const gapMs = gapSec * 1000
    if (gapMs >= 0 && (slowestGapMs == null || gapMs > slowestGapMs)) {
      slowestGapMs = gapMs
      slowestFromPhase = pts[i - 1].phase
      slowestToPhase = pts[i].phase
    }
  }
  const bottleneckCategory = slowestToPhase ? categorizeHanatourPhase(slowestToPhase) : categorizeHanatourPhase(lastPhase ?? '')
  const summary = `phases=${pts.length} last=${lastPhase ?? '—'} slowGapMs=${slowestGapMs != null ? Math.round(slowestGapMs) : '—'} ${slowestFromPhase ?? ''}→${slowestToPhase ?? ''}`
  return {
    lastPhase,
    slowestGapMs,
    slowestFromPhase,
    slowestToPhase,
    bottleneckCategory,
    summary,
  }
}

function buildPythonMonthRun(
  base: HanatourPythonDiagnostics,
  ctx: {
    startedAt: string
    endedAt: string
    inputsLen: number
    status: HanatourMonthRunStatus
    stderrStr: string
    failurePhase?: string | null
  }
): HanatourPythonMonthRun {
  const an = analyzeHanatourStderrPhases(ctx.stderrStr)
  const elapsedMs = Math.max(0, new Date(ctx.endedAt).getTime() - new Date(ctx.startedAt).getTime())
  const failurePhase =
    ctx.failurePhase ?? (ctx.status === 'timeout' ? an.lastPhase : null) ?? null
  return {
    ...base,
    startedAt: ctx.startedAt,
    endedAt: ctx.endedAt,
    elapsedMs,
    inputsLen: ctx.inputsLen,
    rowsCollected: ctx.inputsLen,
    status: ctx.status,
    failurePhase,
    lastPhase: an.lastPhase,
    slowestPhaseGapMs: an.slowestGapMs,
    slowestFromPhase: an.slowestFromPhase,
    slowestToPhase: an.slowestToPhase,
    bottleneckCategory: an.bottleneckCategory,
    stderrPhaseSummary: an.summary,
  }
}

function formatHanatourMonthNote(run: HanatourPythonMonthRun): string {
  const m = run.targetMonthYm ?? 'single'
  const st = run.status
  const rows = run.rowsCollected ?? run.inputsLen
  const el = run.elapsedMs
  const lp = run.lastPhase ?? run.failurePhase ?? '—'
  return `[HANATOUR_MONTH] ${m} ${st} rows=${rows} elapsed=${el} lastPhase=${lp}`
}

type PythonDepartureRow = Partial<DepartureInput> & { departureDate?: string }

type ParsedHanatourCliJson = {
  departures?: PythonDepartureRow[]
  notes?: string[]
  log?: Record<string, unknown>
  collectorStatus?: string
}

/** stdout 앞뒤 잡음·여러 줄 중 첫 번째 최상위 JSON 객체 추출 */
function extractFirstTopLevelJsonObject(s: string): string | null {
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (esc) {
      esc = false
      continue
    }
    if (inStr) {
      if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

function tryParseHanatourStdoutJson(stdout: string): ParsedHanatourCliJson | null {
  const t = stdout.replace(/^\uFEFF/, '').trim()
  if (!t) return null
  try {
    return JSON.parse(t) as ParsedHanatourCliJson
  } catch {
    const blob = extractFirstTopLevelJsonObject(t)
    if (!blob) return null
    try {
      return JSON.parse(blob) as ParsedHanatourCliJson
    } catch {
      return null
    }
  }
}

function mapHanatourPythonRowsToInputs(raw: PythonDepartureRow[]): DepartureInput[] {
  return raw
    .filter((r) => r?.departureDate)
    .map((r) => {
      const row = r as Record<string, unknown>
      const baseline = buildDepartureTitleLayers(
        String((row.rawTitle ?? row.candidateRawTitle ?? row.preHashTitle ?? '') as string)
      )
      const matchingTraceRaw =
        r.matchingTraceRaw ??
        buildCommonMatchingTrace({
          source: 'hanatour_python_cli',
          supplier: 'hanatour',
          baseline,
          candidate: baseline,
          notes: ['python_row_mapped_to_departure_input'],
        })
      return {
        departureDate: String(r.departureDate),
        adultPrice: r.adultPrice ?? undefined,
        childBedPrice: r.childBedPrice ?? undefined,
        childNoBedPrice: r.childNoBedPrice ?? undefined,
        infantPrice: r.infantPrice ?? undefined,
        localPriceText: r.localPriceText ?? undefined,
        statusRaw: r.statusRaw ?? undefined,
        seatsStatusRaw: r.seatsStatusRaw ?? undefined,
        minPax: r.minPax ?? undefined,
        carrierName: r.carrierName ?? undefined,
        outboundFlightNo: r.outboundFlightNo ?? undefined,
        outboundDepartureAirport: r.outboundDepartureAirport ?? undefined,
        outboundDepartureAt: r.outboundDepartureAt ?? undefined,
        outboundArrivalAirport: r.outboundArrivalAirport ?? undefined,
        outboundArrivalAt: r.outboundArrivalAt ?? undefined,
        inboundFlightNo: r.inboundFlightNo ?? undefined,
        inboundDepartureAirport: r.inboundDepartureAirport ?? undefined,
        inboundDepartureAt: r.inboundDepartureAt ?? undefined,
        inboundArrivalAirport: r.inboundArrivalAirport ?? undefined,
        inboundArrivalAt: r.inboundArrivalAt ?? undefined,
        meetingInfoRaw: r.meetingInfoRaw ?? undefined,
        meetingPointRaw: r.meetingPointRaw ?? undefined,
        meetingTerminalRaw: r.meetingTerminalRaw ?? undefined,
        meetingGuideNoticeRaw: r.meetingGuideNoticeRaw ?? undefined,
        meetingDateRaw: r.meetingDateRaw ?? undefined,
        statusLabelsRaw: r.statusLabelsRaw ?? undefined,
        reservationCount: r.reservationCount ?? undefined,
        seatCount: r.seatCount ?? undefined,
        fuelSurchargeIncluded: r.fuelSurchargeIncluded ?? undefined,
        taxIncluded: r.taxIncluded ?? undefined,
        isDepartureConfirmed: r.isDepartureConfirmed ?? undefined,
        isAirConfirmed: r.isAirConfirmed ?? undefined,
        isScheduleConfirmed: r.isScheduleConfirmed ?? undefined,
        isHotelConfirmed: r.isHotelConfirmed ?? undefined,
        isPriceConfirmed: r.isPriceConfirmed ?? undefined,
        supplierDepartureCodeCandidate: r.supplierDepartureCodeCandidate ?? undefined,
        matchingTraceRaw,
      }
    })
}

function deriveFillMeta(inputs: DepartureInput[]): { filledFields: string[]; missingFields: string[] } {
  const stats = {
    departureDate: inputs.some((x) => !!x.departureDate),
    adultPrice: inputs.some((x) => (x.adultPrice ?? 0) > 0),
    carrierName: inputs.some((x) => !!x.carrierName),
    outboundDepartureAt: inputs.some((x) => !!x.outboundDepartureAt),
    inboundArrivalAt: inputs.some((x) => !!x.inboundArrivalAt),
    statusRaw: inputs.some((x) => !!x.statusRaw),
    seatsStatusRaw: inputs.some((x) => !!x.seatsStatusRaw),
    minPax: inputs.some((x) => (x.minPax ?? 0) > 0),
    statusLabelsRaw: inputs.some((x) => !!x.statusLabelsRaw),
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

async function hanatourPythonCliSingleInvocation(params: {
  argv: string[]
  cwd: string
  timeoutMs: number
  envForPython: NodeJS.ProcessEnv
  targetMonthYm?: string
}): Promise<HanatourDepartureCollectResult> {
  const { argv, cwd, timeoutMs, envForPython, targetMonthYm } = params
  const pythonExe = resolvePythonExecutable()
  const notes: string[] = []
  const log: Record<string, unknown> = {}
  const monthLabel = targetMonthYm ?? 'single'
  const startedAt = new Date().toISOString()
  console.log(`[hanatour] phase=month_start month=${monthLabel} at=${startedAt}`)
  console.log(
    `[hanatour] phase=month_subprocess_spawned argv=${JSON.stringify(argv)} timeoutMs=${timeoutMs}`
  )
  const baseDiag = (): HanatourPythonDiagnostics => ({
    command: pythonExe,
    argv,
    cwd,
    timeoutMs,
    exitCode: null,
    signal: null,
    stdoutChars: 0,
    stderrChars: 0,
    stdoutSummary: '',
    stderrSummary: '',
    parsedJsonRows: 0,
    mappedRowsBeforeKstFilter: 0,
    rowsAfterKstFilter: 0,
    pythonTimedOut: false,
    ...(targetMonthYm ? { targetMonthYm } : {}),
  })

  try {
    console.log(
      `[hanatour] phase=python-cli-start argv=${JSON.stringify(argv)} cwd=${cwd} timeoutMs=${timeoutMs}${targetMonthYm ? ` targetMonth=${targetMonthYm}` : ''}`
    )
    const { stdout, stderr } = await execFileAsync(pythonExe, argv, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      env: envForPython,
    })
    const stderrStr = typeof stderr === 'string' ? stderr : ''
    const stdoutStr = typeof stdout === 'string' ? stdout : ''
    const endedAtOk = new Date().toISOString()
    const tParse0 = Date.now()
    console.log(`[hanatour] phase=month_stdout_received month=${monthLabel} chars=${stdoutStr.length}`)
    console.log(`[hanatour] phase=month_stderr_received month=${monthLabel} chars=${stderrStr.length}`)
    if (stderrStr.trim()) {
      forwardHanatourPythonStderr(stderrStr)
    }
    console.log(
      `[hanatour] phase=python-cli-exit exitCode=0 stdoutChars=${stdoutStr.length} stderrChars=${stderrStr.length}`
    )
    const parsed = tryParseHanatourStdoutJson(stdoutStr)
    const tsPostProcessMs = Date.now() - tParse0
    console.log(
      `[hanatour] phase=month_ts_postprocess month=${monthLabel} parseMapMs=${tsPostProcessMs}`
    )
    if (!parsed) {
      const diag: HanatourPythonDiagnostics = {
        ...baseDiag(),
        exitCode: 0,
        stdoutChars: stdoutStr.length,
        stderrChars: stderrStr.length,
        stdoutSummary: summarizeTextForLog(stdoutStr, 500),
        stderrSummary: hanatourStderrDigest(stderrStr),
        parsedJsonRows: 0,
        mappedRowsBeforeKstFilter: 0,
        rowsAfterKstFilter: 0,
        pythonTimedOut: false,
      }
      const run = buildPythonMonthRun(diag, {
        startedAt,
        endedAt: endedAtOk,
        inputsLen: 0,
        status: 'parse_error',
        stderrStr: stderrStr,
        failurePhase: 'parse_stdout',
      })
      notes.push('hanatour stdout json parse failed (no recoverable object)')
      notes.push(formatHanatourMonthNote(run))
      console.log(`[hanatour] phase=month_failed month=${monthLabel} status=parse_error`)
      console.log(
        `[hanatour] phase=month_done month=${monthLabel} ok=false rows=0 elapsedMs=${run.elapsedMs}`
      )
      const fill = deriveFillMeta([])
      return {
        inputs: [],
        meta: {
          filledFields: fill.filledFields,
          missingFields: fill.missingFields,
          mappingStatus: 'detail-candidate-found-but-unmapped',
          notes,
          log,
          collectorStatus: 'parse_error',
        },
        pythonDiagnostics: run,
      }
    }
    if (parsed.notes?.length) notes.push(...parsed.notes)
    if (parsed.log) Object.assign(log, parsed.log)

    const raw = Array.isArray(parsed.departures) ? parsed.departures : []
    const inputs: DepartureInput[] = mapHanatourPythonRowsToInputs(raw)

    const floorYmd = scrapeCalendarTodayYmd()
    const inputsFiltered = filterDepartureInputsOnOrAfterCalendarToday(inputs)
    if (inputsFiltered.length !== inputs.length) {
      notes.push(
        `[HANATOUR_TS_DATE_FLOOR] kst_today=${floorYmd} python_rows=${inputs.length} after_today=${inputsFiltered.length}`
      )
    }
    const fill = deriveFillMeta(inputsFiltered)
    const collectorStatus = parsed.collectorStatus
    const diagOk: HanatourPythonDiagnostics = {
      command: pythonExe,
      argv,
      cwd,
      timeoutMs,
      exitCode: 0,
      signal: null,
      stdoutChars: stdoutStr.length,
      stderrChars: stderrStr.length,
      stdoutSummary: `json_ok departures=${raw.length} chars=${stdoutStr.length}`,
      stderrSummary: hanatourStderrDigest(stderrStr),
      parsedJsonRows: raw.length,
      mappedRowsBeforeKstFilter: inputs.length,
      rowsAfterKstFilter: inputsFiltered.length,
      pythonTimedOut: false,
      ...(targetMonthYm ? { targetMonthYm } : {}),
    }
    const applied = applyDepartureTerminalMeetingInfo(inputsFiltered)
    const runOk = buildPythonMonthRun(diagOk, {
      startedAt,
      endedAt: endedAtOk,
      inputsLen: applied.length,
      status: 'ok',
      stderrStr: stderrStr,
    })
    notes.push(formatHanatourMonthNote(runOk))
    console.log(`[hanatour] phase=month_done month=${monthLabel} ok=true rows=${applied.length} elapsedMs=${runOk.elapsedMs}`)
    console.log(
      `[hanatour] phase=python-parse-summary ${JSON.stringify({
        parsedJsonRows: raw.length,
        mappedBeforeKst: inputs.length,
        afterKst: inputsFiltered.length,
      })}`
    )
    return {
      inputs: applied,
      meta: {
        filledFields: fill.filledFields,
        missingFields: fill.missingFields,
        mappingStatus: inputsFiltered.length ? 'per-date-confirmed' : 'detail-candidate-found-but-unmapped',
        notes,
        log,
        collectorStatus,
      },
      pythonDiagnostics: runOk,
    }
  } catch (e) {
    const endedAtErr = new Date().toISOString()
    const ex = e as NodeJS.ErrnoException & {
      stdout?: string | Buffer
      stderr?: string | Buffer
      signal?: string
      killed?: boolean
    }
    const outStr = typeof ex.stdout === 'string' ? ex.stdout : ex.stdout != null ? String(ex.stdout) : ''
    const errStr = typeof ex.stderr === 'string' ? ex.stderr : ex.stderr != null ? String(ex.stderr) : ''
    console.log(`[hanatour] phase=month_stdout_received month=${monthLabel} chars=${outStr.length}`)
    console.log(`[hanatour] phase=month_stderr_received month=${monthLabel} chars=${errStr.length}`)
    if (errStr.trim()) {
      forwardHanatourPythonStderr(errStr)
    }
    const codeRaw = ex.code
    const exitCode =
      typeof codeRaw === 'number'
        ? codeRaw
        : codeRaw != null && String(codeRaw).length > 0 && !Number.isNaN(Number(codeRaw))
          ? Number(codeRaw)
          : null
    const errMsg = e instanceof Error ? e.message : String(e)
    const pythonTimedOut =
      codeRaw === 'ETIMEDOUT' ||
      (typeof codeRaw === 'string' && /TIMEOUT|TIMED/i.test(codeRaw)) ||
      /ETIMEDOUT|timeout|timed out|TIMEOUT|exceeded|maxBuffer/i.test(errMsg) ||
      ex.killed === true
    console.log(
      `[hanatour] phase=python-cli-exit exitCode=${exitCode ?? 'null'} signal=${ex.signal ?? ''} stdoutChars=${outStr.length} stderrChars=${errStr.length} pythonTimedOut=${pythonTimedOut}`
    )
    notes.push(`hanatour python cli failed: ${e instanceof Error ? e.message : String(e)}`)
    if (pythonTimedOut) {
      console.log(`[hanatour] phase=month_failed month=${monthLabel} status=timeout`)
    }

    let salvaged = tryParseHanatourStdoutJson(outStr)
    if (!salvaged && outStr) {
      const tail = outStr.slice(Math.max(0, outStr.length - 2_000_000))
      salvaged = tryParseHanatourStdoutJson(tail)
    }
    if (salvaged && Array.isArray(salvaged.departures) && salvaged.departures.length > 0) {
      if (salvaged.notes?.length) notes.push(...salvaged.notes)
      if (salvaged.log) Object.assign(log, salvaged.log)
      notes.push(
        'hanatour_stdout_salvaged: 프로세스 비정상 종료·타임아웃 후에도 stdout JSON을 복구해 출발 행을 반영했습니다.'
      )
      const rawSalvage = salvaged.departures
      const inputsSalvage = mapHanatourPythonRowsToInputs(rawSalvage)
      const floorYmd = scrapeCalendarTodayYmd()
      const inputsFiltered = filterDepartureInputsOnOrAfterCalendarToday(inputsSalvage)
      if (inputsFiltered.length !== inputsSalvage.length) {
        notes.push(
          `[HANATOUR_TS_DATE_FLOOR] kst_today=${floorYmd} python_rows=${inputsSalvage.length} after_today=${inputsFiltered.length}`
        )
      }
      const fill = deriveFillMeta(inputsFiltered)
      const appliedSv = applyDepartureTerminalMeetingInfo(inputsFiltered)
      const diagSv: HanatourPythonDiagnostics = {
        command: pythonExe,
        argv,
        cwd,
        timeoutMs,
        exitCode,
        signal: ex.signal ?? null,
        stdoutChars: outStr.length,
        stderrChars: errStr.length,
        stdoutSummary: `salvaged_json_ok departures=${rawSalvage.length} chars=${outStr.length}`,
        stderrSummary: hanatourStderrDigest(errStr),
        parsedJsonRows: rawSalvage.length,
        mappedRowsBeforeKstFilter: inputsSalvage.length,
        rowsAfterKstFilter: inputsFiltered.length,
        pythonTimedOut,
        stdoutSalvagedAfterCliError: true,
        ...(targetMonthYm ? { targetMonthYm } : {}),
      }
      const runSv = buildPythonMonthRun(diagSv, {
        startedAt,
        endedAt: endedAtErr,
        inputsLen: appliedSv.length,
        status: 'ok_salvaged',
        stderrStr: errStr,
      })
      notes.push(formatHanatourMonthNote(runSv))
      console.log(
        `[hanatour] phase=month_done month=${monthLabel} salvaged=true rows=${appliedSv.length} elapsedMs=${runSv.elapsedMs}`
      )
      console.log(
        `[hanatour] phase=python-parse-summary ${JSON.stringify({
          salvaged: true,
          parsedJsonRows: rawSalvage.length,
          mappedBeforeKst: inputsSalvage.length,
          afterKst: inputsFiltered.length,
        })}`
      )
      return {
        inputs: appliedSv,
        meta: {
          filledFields: fill.filledFields,
          missingFields: fill.missingFields,
          mappingStatus: inputsFiltered.length ? 'per-date-confirmed' : 'detail-candidate-found-but-unmapped',
          notes,
          log,
          collectorStatus: salvaged.collectorStatus ?? 'success',
        },
        pythonDiagnostics: runSv,
      }
    }

    const fill = deriveFillMeta([])
    const diagErr: HanatourPythonDiagnostics = {
      command: pythonExe,
      argv,
      cwd,
      timeoutMs,
      exitCode,
      signal: ex.signal ?? null,
      stdoutChars: outStr.length,
      stderrChars: errStr.length,
      stdoutSummary: summarizeTextForLog(outStr, 500),
      stderrSummary: hanatourStderrDigest(errStr),
      parsedJsonRows: 0,
      mappedRowsBeforeKstFilter: 0,
      rowsAfterKstFilter: 0,
      pythonTimedOut,
      ...(targetMonthYm ? { targetMonthYm } : {}),
    }
    const runErr = buildPythonMonthRun(diagErr, {
      startedAt,
      endedAt: endedAtErr,
      inputsLen: 0,
      status: pythonTimedOut ? 'timeout' : 'cli_error',
      stderrStr: errStr,
    })
    notes.push(formatHanatourMonthNote(runErr))
    console.log(
      `[hanatour] phase=month_done month=${monthLabel} ok=false rows=0 elapsedMs=${runErr.elapsedMs} lastPhase=${runErr.lastPhase ?? '—'}`
    )
    return {
      inputs: [],
      meta: {
        filledFields: fill.filledFields,
        missingFields: fill.missingFields,
        mappingStatus: 'detail-candidate-found-but-unmapped',
        notes,
        log,
        collectorStatus: 'cli_error',
      },
      pythonDiagnostics: runErr,
    }
  }
}

/**
 * Python `scripts.calendar_e2e_scraper_hanatour.main` — 운영 다월은 **월별 subprocess**로 분할 후 merge.
 */
export async function collectHanatourDepartureInputs(
  detailUrl: string,
  options?: {
    maxMonths?: number
    /** 스모크/리포트용: 첫 매칭 1행 후 종료. 운영 재스크랩 기본값 false */
    stopAfterFirstDeparture?: boolean
    /** 관리자 하나투어: 이번 실행만 대상 월(2개월 등). 지정 시 maxMonths로 목록을 만들지 않음 */
    monthYmsOverride?: string[]
  }
): Promise<HanatourDepartureCollectResult> {
  const maxMonths = options?.maxMonths ?? SCRAPE_DEFAULT_MONTHS_FORWARD
  const stopAfterFirst = options?.stopAfterFirstDeparture === true
  const resolvedDetailUrl = normalizeHanatourDetailUrlForModalScraper(detailUrl)
  const cwd = process.cwd()
  const perMonthTimeout = resolveHanatourPythonTimeoutMsPerMonth()

  const childEnv = { ...process.env }
  delete childEnv.HANATOUR_E2E_PRINT_REPORT

  const buildEnv = (withStopAfterFirst: boolean): NodeJS.ProcessEnv => {
    const envForPython: NodeJS.ProcessEnv = {
      ...childEnv,
      HANATOUR_E2E_FAST: '1',
    }
    if (withStopAfterFirst) {
      envForPython.HANATOUR_E2E_STOP_AFTER_FIRST_DEPARTURE = '1'
    } else {
      delete envForPython.HANATOUR_E2E_STOP_AFTER_FIRST_DEPARTURE
    }
    /** 개발용 E2E와 동일한 경량 기본(짧은 list 대기·미검증 허용). 무거운 재시도는 scraper에서 제거됨. */
    envForPython.HANATOUR_E2E_LIGHT_OPS = '1'
    envForPython.HANATOUR_E2E_ALLOW_COLLECT_WITHOUT_LIST_REFRESH =
      process.env.HANATOUR_E2E_ALLOW_COLLECT_WITHOUT_LIST_REFRESH ?? '1'
    /** 관리자 월별 subprocess: 일자별 list_wait 상한을 조금 줄여(빈 날 반복 시) 총 시간 절감. env로 덮어쓰기 가능 */
    envForPython.HANATOUR_E2E_LIST_REFRESH_MS =
      process.env.HANATOUR_E2E_LIST_REFRESH_MS ?? (withStopAfterFirst ? '4000' : '3500')
    envForPython.HANATOUR_E2E_ALLOW_SAME_DAY_SELECTION_COMMIT =
      process.env.HANATOUR_E2E_ALLOW_SAME_DAY_SELECTION_COMMIT ?? '0'
    /** 실전 월별 subprocess: 스크래퍼에서 경량 경로(짧은 row 매칭 반복 등) 분기 */
    if (!withStopAfterFirst) {
      envForPython.HANATOUR_E2E_ADMIN_MONTH_SESSION = '1'
    }
    return envForPython
  }

  if (stopAfterFirst) {
    const argv = ['-m', 'scripts.calendar_e2e_scraper_hanatour.main', resolvedDetailUrl, '1']
    return await hanatourPythonCliSingleInvocation({
      argv,
      cwd,
      timeoutMs: perMonthTimeout,
      envForPython: buildEnv(true),
    })
  }

  const monthYms =
    options?.monthYmsOverride?.length && options.monthYmsOverride.length > 0
      ? options.monthYmsOverride
      : buildHanatourKstTargetMonths(maxMonths)
  const monthParallelism = resolveHanatourE2eMonthParallelism()
  const mergedNotes: string[] = [
    `hanatour_e2e_month_split: ${monthYms.join(',')}`,
    `hanatour_e2e_month_parallel: concurrency=${monthParallelism}`,
  ]
  const mergedLog: Record<string, unknown> = { hanatour_e2e_month_split: monthYms, hanatour_e2e_month_parallelism: monthParallelism }
  let mergedInputs: DepartureInput[] = []
  const pythonMonthDiagnostics: HanatourPythonMonthRun[] = []
  let lastCollectorStatus: string | undefined

  const envMulti = buildEnv(false)
  console.log(
    `[hanatour] phase=month_parallel_pool months=${monthYms.length} concurrency=${monthParallelism} timeoutMsPerMonth=${perMonthTimeout}`
  )
  const monthResults = await runWithConcurrencyLimit(monthYms, monthParallelism, async (ym) => {
    const argv = ['-m', 'scripts.calendar_e2e_scraper_hanatour.main', resolvedDetailUrl, '--month', ym]
    return hanatourPythonCliSingleInvocation({
      argv,
      cwd,
      timeoutMs: perMonthTimeout,
      envForPython: envMulti,
      targetMonthYm: ym,
    })
  })

  for (let mi = 0; mi < monthYms.length; mi++) {
    const ym = monthYms[mi]!
    const r = monthResults[mi]!
    if (r.pythonDiagnostics && 'elapsedMs' in r.pythonDiagnostics) {
      pythonMonthDiagnostics.push(r.pythonDiagnostics as HanatourPythonMonthRun)
    }
    lastCollectorStatus = r.meta.collectorStatus ?? lastCollectorStatus
    if (r.meta.notes?.length) mergedNotes.push(...r.meta.notes.map((n) => `[${ym}] ${n}`))
    if (r.meta.log && Object.keys(r.meta.log).length > 0) {
      mergedLog[`hanatour_e2e_log_${ym}`] = r.meta.log
    }
    mergedInputs = mergedInputs.concat(r.inputs)
  }

  mergedInputs = dedupeHanatourInputsByDepartureDate(mergedInputs)
  const fill = deriveFillMeta(mergedInputs)
  const mappingStatus = mergedInputs.length
    ? 'per-date-confirmed'
    : 'detail-candidate-found-but-unmapped'
  const sumParsed = pythonMonthDiagnostics.reduce((s, d) => s + d.parsedJsonRows, 0)
  const anyTimedOut = pythonMonthDiagnostics.some((d) => d.pythonTimedOut)
  const aggregateDiagnostics: HanatourPythonDiagnostics = {
    command: resolvePythonExecutable(),
    argv: ['-m', 'scripts.calendar_e2e_scraper_hanatour.main', resolvedDetailUrl, '(month-split)'],
    cwd,
    timeoutMs: perMonthTimeout,
    exitCode: pythonMonthDiagnostics.some((d) => d.exitCode !== 0 && d.exitCode != null) ? 1 : 0,
    signal: null,
    stdoutChars: pythonMonthDiagnostics.reduce((s, d) => s + d.stdoutChars, 0),
    stderrChars: pythonMonthDiagnostics.reduce((s, d) => s + d.stderrChars, 0),
    stdoutSummary: `month_split months=${monthYms.length} parallel=${monthParallelism} totalParsedRows=${sumParsed} mergedRows=${mergedInputs.length}`,
    stderrSummary: '',
    parsedJsonRows: sumParsed,
    mappedRowsBeforeKstFilter: mergedInputs.length,
    rowsAfterKstFilter: mergedInputs.length,
    pythonTimedOut: anyTimedOut,
  }
  console.log(
    `[hanatour] phase=python-month-merge ${JSON.stringify({
      months: monthYms.length,
      mergedRows: mergedInputs.length,
      anyTimedOut,
    })}`
  )
  const anyMonthFail = pythonMonthDiagnostics.some(
    (d) => d.status !== 'ok' && d.status !== 'ok_salvaged'
  )
  const monthLineNotes = buildHanatourMonthSummaryLines(pythonMonthDiagnostics)
  if (monthLineNotes.length) mergedNotes.push(...monthLineNotes)
  if (mergedInputs.length > 0 && (anyMonthFail || anyTimedOut)) {
    mergedNotes.unshift(
      `hanatour_e2e_partial: merged_rows=${mergedInputs.length} anyTimedOut=${anyTimedOut} anyMonthFail=${anyMonthFail}`
    )
    const hl = buildHanatourPartialSuccessHeadline(pythonMonthDiagnostics)
    if (hl) mergedNotes.unshift(hl)
  }
  const sessionMemos: HanatourMonthSessionMemo[] = monthYms.map((ym, i) => {
    const d = pythonMonthDiagnostics[i]
    const status = (d?.status ?? 'parse_error') as HanatourMonthRunStatus
    const failedReason =
      status === 'ok' || status === 'ok_salvaged'
        ? null
        : String(d?.failurePhase ?? d?.lastPhase ?? d?.stderrPhaseSummary ?? status ?? 'unknown')
    return {
      month: ym,
      status,
      rowsCollected: d?.rowsCollected ?? d?.inputsLen ?? 0,
      elapsedMs: d?.elapsedMs ?? 0,
      failedReason,
      nextMonthPlanned: monthYms[i + 1] ?? null,
    }
  })
  mergedLog.hanatour_month_session_memos = sessionMemos
  mergedLog.hanatour_month_runs = pythonMonthDiagnostics.map((m) => ({
    month: m.targetMonthYm ?? '—',
    status: m.status,
    startedAt: m.startedAt,
    endedAt: m.endedAt,
    elapsedMs: m.elapsedMs,
    timedOut: m.pythonTimedOut,
    stdoutChars: m.stdoutChars,
    stderrChars: m.stderrChars,
    parsedJsonRows: m.parsedJsonRows,
    inputsLen: m.inputsLen,
    rowsCollected: m.rowsCollected,
    lastPhase: m.lastPhase,
    failurePhase: m.failurePhase,
    bottleneck: m.bottleneckCategory,
    slowestGapMs: m.slowestPhaseGapMs,
  }))
  const collectorMerged =
    mergedInputs.length > 0
      ? anyMonthFail || anyTimedOut
        ? 'success_partial'
        : 'success'
      : lastCollectorStatus ?? 'modal_empty'
  return {
    inputs: mergedInputs,
    meta: {
      filledFields: fill.filledFields,
      missingFields: fill.missingFields,
      mappingStatus,
      notes: mergedNotes,
      log: mergedLog,
      collectorStatus: collectorMerged,
    },
    pythonDiagnostics: aggregateDiagnostics,
    pythonMonthDiagnostics,
  }
}

/**
 * on-demand: 지정 `ymd`가 속한 **한 달만** subprocess 수집 후 동일 일자 행 1건만 반환(다른 날짜는 호출부에서 저장하지 않음).
 */
export async function collectHanatourDepartureInputForSingleDate(
  detailUrl: string,
  ymd: string
): Promise<DepartureInput | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const ym = ymd.slice(0, 7)
  const validatedYm = validateHanatourAdminMonthYm(ym)
  if (!validatedYm) return null
  const horizon = resolveHanatourAdminE2eMonthsForward()
  const allowedYm = new Set(buildHanatourKstTargetMonths(horizon))
  if (!allowedYm.has(validatedYm)) return null
  const res = await collectHanatourDepartureInputs(detailUrl, { monthYmsOverride: [validatedYm] })
  for (const x of res.inputs) {
    if (departureInputToYmd(x.departureDate) === ymd) return x
  }
  return null
}

function eachYmdInclusiveHanatour(lo: string, hi: string): string[] {
  const a = lo <= hi ? lo : hi
  const b = lo <= hi ? hi : lo
  const out: string[] = []
  let cur = a
  while (cur <= b) {
    out.push(cur)
    const [y, m, d] = cur.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + 1)
    cur = dt.toISOString().slice(0, 10)
  }
  return out
}

/** on-demand: `[fromYmd,toYmd]`에 걸친 허용 월만 subprocess 수집 후 구간 일자만 반환. */
export async function collectHanatourDepartureInputsForDateRange(
  detailUrl: string,
  fromYmd: string,
  toYmd: string
): Promise<DepartureInput[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) return []
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const horizon = resolveHanatourAdminE2eMonthsForward()
  const allowedYm = new Set(buildHanatourKstTargetMonths(horizon))
  const ymSet = new Set<string>()
  for (const d of eachYmdInclusiveHanatour(lo, hi)) {
    const ym = d.slice(0, 7)
    const validatedYm = validateHanatourAdminMonthYm(ym)
    if (validatedYm && allowedYm.has(validatedYm)) ymSet.add(validatedYm)
  }
  if (ymSet.size === 0) return []
  const res = await collectHanatourDepartureInputs(detailUrl, { monthYmsOverride: [...ymSet].sort() })
  return res.inputs.filter((x) => {
    const d = departureInputToYmd(x.departureDate)
    return d != null && d >= lo && d <= hi
  })
}
