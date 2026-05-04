/**
 * 롯데관광(lottetour) 출발일 목록 — 사이트 내부 `evtListAjax` 공개 GET(HTML 테이블, JSON 아님).
 * 월별 `depDt=YYYYMM`·`godId`·`menuNo1~4`·페이지네이션으로 수집한다.
 *
 * 동일 출발일에 evtCd(팀)가 N개인 경우 수집은 전부 유지하고, `mapLottetourCalendarToDepartureInputs`에서
 * upsert 입력 정렬 규칙(R-4-D 옵션 A: 동일 날짜 마지막 행 우선)에 맞게 supplierPriceKey를 둔다.
 *
 * HTML만으로 0건이고 `e2eTourCodeHint`가 있으며 `LOTTETOUR_E2E_FALLBACK`이 꺼지지 않았으면
 * `scripts.calendar_e2e_scraper_lottetour.calendar_price_scraper`를 subprocess로 한 번 호출한다.
 */
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import type { PrismaClient } from '@prisma/client'
import {
  buildCommonMatchingTrace,
  buildDepartureTitleLayers,
  type DepartureTitleLayers,
} from '@/lib/departure-option-lottetour'
import { extractLottetourMasterIdsFromBlob } from '@/lib/lottetour-paste-deterministic-patch'
import type { DepartureInput } from '@/lib/upsert-product-departures-lottetour'
import { upsertProductDepartures } from '@/lib/upsert-product-departures-lottetour'
import { resolvePythonExecutable } from '@/lib/resolve-python-executable'

const execFileAsync = promisify(execFile)
const LOTTETOUR_CALENDAR_PY_MODULE = 'scripts.calendar_e2e_scraper_lottetour.calendar_price_scraper'

const DEFAULT_BASE = 'https://www.lottetour.com'
const DEFAULT_TIMEOUT_MS = 25_000
const DEFAULT_MAX_EVT_CNT = 19
const DEFAULT_MONTH_COUNT = 12

/** evtCd: 4글자 prefix + YYMMDD + 항공사 2 + 시퀀스 3 */
export const LOTTETOUR_EVT_CD_RE = /^[A-Z]\d{2}[A-Z]\d{6}[A-Z]{2}\d{3}$/

export type LottetourCalendarRow = {
  depYm: string
  godId: string
  evtCd: string
  /** evtCd YYMMDD + 연도 힌트로 산출한 출발일 */
  departDate: string
  returnDate: string | null
  departTimeText: string | null
  returnTimeText: string | null
  carrierText: string | null
  gradeText: string | null
  tourTitleRaw: string | null
  durationText: string | null
  adultPrice: number
  statusRaw: string | null
  seatsStatusRaw: string | null
  seatCount: number | null
}

export type LottetourCalendarRangeOptions = {
  timeoutMs?: number
  maxRetries?: number
  signal?: AbortSignal
  headers?: Record<string, string>
  log?: boolean
  logLabel?: string
  /** 기본: `LOTTETOUR_CALENDAR_MONTH_COUNT` 또는 12 */
  monthCount?: number
  /** 첫 월 `YYYY-MM` (없으면 당월·`LOTTETOUR_DATE_FROM`) */
  dateFrom?: string | null
  /** R-4-I: evtCd 등 힌트 — TS HTML 수집 0건일 때 Python E2E 폴백 트리거에 사용 */
  e2eTourCodeHint?: string | null
  disableE2EFallback?: boolean
  maxEvtCnt?: number
  evtOrderBy?: 'DT' | 'PR'
  /** 단위 검증: fetch 대신 고정 HTML */
  htmlByDepYm?: Map<string, string> | null
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>
}

export type LottetourCalendarRangeParams = {
  godId: string
  menuNos: readonly [string, string, string, string]
}

export type LottetourDepartureUpsertResult = {
  created: number
  updated: number
  skipped: number
  errors: Array<{ departDate: string; error: string }>
  warnings: string[]
}

export type LottetourUpsertOptions = {
  dryRun?: boolean
  abortOnFirstError?: boolean
}

function lottetourBase(): string {
  return (process.env.LOTTETOUR_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
}

function defaultUserAgent(): string {
  const u = (process.env.LOTTETOUR_USER_AGENT ?? '').trim()
  return u || 'Mozilla/5.0 (compatible; BongtourAdmin/1.0; +https://bongtour.com)'
}

function resolveMonthCount(explicit?: number): number {
  const fromEnv = Number((process.env.LOTTETOUR_CALENDAR_MONTH_COUNT ?? '').trim())
  const n = explicit ?? (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_MONTH_COUNT)
  return Math.max(1, Math.min(36, n))
}

function resolveDefaultDateFromYm(): string {
  const env = (process.env.LOTTETOUR_DATE_FROM ?? '').trim()
  if (/^\d{4}-\d{2}$/.test(env)) return env
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function enumerateYm(startYm: string, count: number): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(startYm.trim())
  if (!m) return []
  let y = Number(m[1])
  let mo = Number(m[2])
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(mo).padStart(2, '0')}`)
    mo += 1
    if (mo > 12) {
      mo = 1
      y += 1
    }
  }
  return out
}

function ymToDepDt(ym: string): string {
  const [y, mo] = ym.split('-')
  return `${y}${mo}`
}

/** evtCd 내부 6자리 YYMMDD → YYYY-MM-DD (HTML 출발 표기와 불일치 시 경고만 하고 evtCd를 SSOT로 둔다) */
export function departDateFromLottetourEvtCd(evtCd: string): string | null {
  const t = evtCd.trim()
  if (!LOTTETOUR_EVT_CD_RE.test(t)) return null
  const six = t.slice(4, 10)
  if (!/^\d{6}$/.test(six)) return null
  const yy2 = parseInt(six.slice(0, 2), 10)
  const mm = six.slice(2, 4)
  const dd = six.slice(4, 6)
  const yyyy = yy2 >= 70 ? 1900 + yy2 : 2000 + yy2
  return `${yyyy}-${mm}-${dd}`
}

function resolveLottetourPythonRepoRoot(): string {
  const fromEnv = (process.env.BONGTOUR_REPO_ROOT ?? process.env.LOTTETOUR_REPO_ROOT ?? '').trim()
  if (fromEnv) return path.resolve(fromEnv)
  const markerRel = path.join('scripts', 'calendar_e2e_scraper_lottetour', 'calendar_price_scraper.py')
  let dir = path.resolve(process.cwd())
  for (let i = 0; i < 12; i++) {
    try {
      if (fs.existsSync(path.join(dir, markerRel))) return dir
    } catch {
      /* ignore */
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(process.cwd())
}

function lottetourE2eFallbackEnabled(): boolean {
  const v = (process.env.LOTTETOUR_E2E_FALLBACK ?? '1').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off'
}

function parseLottetourPythonStdoutJson(stdout: string): Record<string, unknown> | null {
  const s = stdout.trim()
  if (!s) return null
  const lines = s.split(/\r?\n/).filter((l) => l.trim().startsWith('{'))
  const last = lines[lines.length - 1] ?? s
  try {
    const o = JSON.parse(last) as Record<string, unknown>
    return o && typeof o === 'object' ? o : null
  } catch {
    return null
  }
}

function numPrice(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  const s = String(v ?? '').replace(/[^\d]/g, '')
  return s ? parseInt(s, 10) : 0
}

function lottetourCalendarRowFromPythonE2eDict(r: Record<string, unknown>): LottetourCalendarRow | null {
  const evtCd = String(r.evtCd ?? '').trim()
  if (!LOTTETOUR_EVT_CD_RE.test(evtCd)) return null
  const fromEvt = departDateFromLottetourEvtCd(evtCd)
  const depStr = String(r.departDate ?? '').trim().slice(0, 10)
  const departDate =
    fromEvt && /^\d{4}-\d{2}-\d{2}$/.test(fromEvt) ? fromEvt : /^\d{4}-\d{2}-\d{2}$/.test(depStr) ? depStr : ''
  if (!departDate) return null
  const depYmRaw = String(r.depYm ?? '').trim()
  const depYm =
    /^\d{6}$/.test(depYmRaw) ? depYmRaw : `${departDate.slice(0, 4)}${departDate.slice(5, 7)}`
  const godId = String(r.godId ?? '').trim()
  if (!godId) return null
  return {
    depYm,
    godId,
    evtCd,
    departDate,
    returnDate: (() => {
      const x = String(r.returnDate ?? '').trim().slice(0, 10)
      return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null
    })(),
    departTimeText: r.departTimeText != null ? String(r.departTimeText).trim().slice(0, 120) || null : null,
    returnTimeText: r.returnTimeText != null ? String(r.returnTimeText).trim().slice(0, 120) || null : null,
    carrierText: r.carrierText != null ? String(r.carrierText).trim().slice(0, 200) || null : null,
    gradeText: r.gradeText != null ? String(r.gradeText).trim().slice(0, 120) || null : null,
    tourTitleRaw: r.tourTitleRaw != null ? String(r.tourTitleRaw).trim().slice(0, 400) || null : null,
    durationText: r.durationText != null ? String(r.durationText).trim().slice(0, 80) || null : null,
    adultPrice: numPrice(r.adultPrice),
    statusRaw: r.statusRaw != null ? String(r.statusRaw).trim().slice(0, 200) || null : null,
    seatsStatusRaw: r.seatsStatusRaw != null ? String(r.seatsStatusRaw).trim().slice(0, 200) || null : null,
    seatCount:
      r.seatCount != null && Number.isFinite(Number(r.seatCount)) ? Math.trunc(Number(r.seatCount)) : null,
  }
}

async function collectLottetourCalendarViaPythonE2eOnce(args: {
  godId: string
  menuNos: readonly [string, string, string, string]
  monthCount: number
  timeoutMs: number
  evtCdHint: string
}): Promise<{ rows: LottetourCalendarRow[]; stderr: string; phase?: string; message?: string }> {
  const py = (process.env.LOTTETOUR_PYTHON ?? '').trim() || resolvePythonExecutable()
  const cwd = resolveLottetourPythonRepoRoot()
  const months = Math.max(1, Math.min(36, args.monthCount))
  const argv = [
    '-m',
    LOTTETOUR_CALENDAR_PY_MODULE,
    '--god-id',
    args.godId.trim(),
    '--menu-no1',
    args.menuNos[0]!,
    '--menu-no2',
    args.menuNos[1]!,
    '--menu-no3',
    args.menuNos[2]!,
    '--menu-no4',
    args.menuNos[3]!,
    '--months',
    String(months),
    '--evt-cd-hint',
    args.evtCdHint.trim(),
  ]
  const envForChild: Record<string, string | undefined> = {
    ...process.env,
    PYTHONPATH: cwd,
  }
  let stdout = ''
  let stderr = ''
  try {
    const r = await execFileAsync(py, argv, {
      cwd,
      timeout: args.timeoutMs,
      maxBuffer: 12 * 1024 * 1024,
      env: envForChild as NodeJS.ProcessEnv,
    })
    stdout = r.stdout == null ? '' : Buffer.isBuffer(r.stdout) ? r.stdout.toString('utf8') : String(r.stdout)
    stderr = r.stderr == null ? '' : Buffer.isBuffer(r.stderr) ? r.stderr.toString('utf8') : String(r.stderr)
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown; message?: string }
    stdout = err.stdout == null ? '' : Buffer.isBuffer(err.stdout) ? err.stdout.toString('utf8') : String(err.stdout)
    stderr = err.stderr == null ? '' : Buffer.isBuffer(err.stderr) ? err.stderr.toString('utf8') : String(err.stderr)
    return {
      rows: [],
      stderr,
      phase: 'error',
      message: err.message ?? String(e),
    }
  }
  const payload = parseLottetourPythonStdoutJson(stdout)
  if (!payload) {
    return { rows: [], stderr, phase: 'error', message: 'stdout JSON 파싱 실패' }
  }
  if (String(payload.phase) === 'error') {
    return {
      rows: [],
      stderr,
      phase: 'error',
      message: String(payload.message ?? 'python phase=error'),
    }
  }
  const rawRows = payload.rows
  if (!Array.isArray(rawRows)) {
    return { rows: [], stderr, phase: 'error', message: 'rows 배열 없음' }
  }
  const rows: LottetourCalendarRow[] = []
  for (const item of rawRows) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = lottetourCalendarRowFromPythonE2eDict(item as Record<string, unknown>)
    if (row) rows.push(row)
  }
  rows.sort((a, b) => {
    const c = a.departDate.localeCompare(b.departDate)
    if (c !== 0) return c
    return a.evtCd.localeCompare(b.evtCd)
  })
  return { rows, stderr }
}

export function buildLottetourEvtDetailUrl(
  menuNos: readonly [string, string, string, string],
  evtCd: string
): string {
  const [a, b, c, d] = menuNos
  const q = new URLSearchParams({ evtCd: evtCd.trim() })
  return `${lottetourBase()}/evtDetail/${encodeURIComponent(a)}/${encodeURIComponent(b)}/${encodeURIComponent(c)}/${encodeURIComponent(d)}?${q.toString()}`
}

export function parseLottetourEvtListCollectionHints(p: {
  rawMeta: string | null | undefined
  originUrl: string | null | undefined
}): {
  godId: string | null
  menuNos: [string, string, string, string] | null
  detailEvtCd: string | null
  warnings: string[]
} {
  const warnings: string[] = []
  const blob = `${p.originUrl ?? ''}\n${p.rawMeta ?? ''}`
  const ex = extractLottetourMasterIdsFromBlob(blob)
  let godId = ex.godId
  let menuNos: [string, string, string, string] | null = ex.categoryMenuNo
    ? [ex.categoryMenuNo.no1, ex.categoryMenuNo.no2, ex.categoryMenuNo.no3, ex.categoryMenuNo.no4]
    : null
  const detailEvtCd = ex.evtCd

  if (p.rawMeta?.trim()) {
    try {
      const j = JSON.parse(p.rawMeta) as Record<string, unknown>
      const g = String(j.godId ?? '').trim()
      if (g && !godId) godId = g
      const cm = j.categoryMenuNo
      if (
        !menuNos &&
        cm &&
        typeof cm === 'object' &&
        !Array.isArray(cm) &&
        typeof (cm as Record<string, unknown>).no1 === 'string'
      ) {
        const o = cm as Record<string, unknown>
        const a = String(o.no1 ?? '').trim()
        const b = String(o.no2 ?? '').trim()
        const c = String(o.no3 ?? '').trim()
        const d = String(o.no4 ?? '').trim()
        if (a && b && c && d) menuNos = [a, b, c, d]
      }
      const ss = j.structuredSignals
      if ((!godId || !menuNos) && ss && typeof ss === 'object' && !Array.isArray(ss)) {
        const norm = (ss as Record<string, unknown>).detailBodyNormalizedRaw
        if (typeof norm === 'string' && norm.trim()) {
          const ex2 = extractLottetourMasterIdsFromBlob(norm)
          if (!godId && ex2.godId) godId = ex2.godId
          if (!menuNos && ex2.categoryMenuNo) {
            menuNos = [
              ex2.categoryMenuNo.no1,
              ex2.categoryMenuNo.no2,
              ex2.categoryMenuNo.no3,
              ex2.categoryMenuNo.no4,
            ]
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!godId) {
    warnings.push(
      'godId 없음: 롯데관광 evtList 목록 공개 HTTP를 호출하려면 evtList URL·붙여넣기 등에서 godId를 확보해야 합니다.'
    )
  }
  if (!menuNos) {
    warnings.push(
      'categoryMenuNo 없음: `/evtDetail/{menuNo1}/{menuNo2}/{menuNo3}/{menuNo4}` 또는 evtList 동일 경로가 originUrl·본문에 있어야 합니다.'
    )
  }
  return { godId, menuNos, detailEvtCd, warnings }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseKrwStrong(cell: string): number {
  const m = cell.match(/<strong>\s*([\d,]+)\s*원\s*<\/strong>/i)
  if (!m) return 0
  return parseInt(m[1]!.replace(/,/g, ''), 10) || 0
}

function parseEvtCdFromRow(rowHtml: string): string | null {
  const m =
    rowHtml.match(/\/evtDetail\/[^"'?]+\?[^"']*evtCd=([A-Z0-9]+)/i) ??
    rowHtml.match(/[?&]evtCd=([A-Z0-9]+)/i)
  const code = m?.[1]?.trim() ?? ''
  return LOTTETOUR_EVT_CD_RE.test(code) ? code : null
}

function parseSeatCount(text: string): number | null {
  const m = text.match(/잔여석\s*(\d+)\s*석/)
  if (m) return parseInt(m[1]!, 10)
  return null
}

function parseStatusParts(text: string): { statusRaw: string | null; seatsStatusRaw: string | null } {
  const t = stripTags(text)
  if (!t) return { statusRaw: null, seatsStatusRaw: null }
  let statusRaw: string | null = t.slice(0, 200)
  if (/출발\s*확정/i.test(t)) statusRaw = '출발확정'
  else if (/대기\s*예약/i.test(t)) statusRaw = '대기예약'
  else if (/예약\s*가능|예약가능/i.test(t)) statusRaw = '예약가능'
  const seatsStatusRaw = /잔여석/.test(t) ? t.slice(0, 200) : null
  return { statusRaw, seatsStatusRaw }
}

function parseTimeCell(html: string, yearHint: number): {
  departTimeText: string | null
  returnTimeText: string | null
  htmlDepartYmd: string | null
  htmlReturnYmd: string | null
} {
  const plain = stripTags(html)
  const re = /(\d{2})\/(\d{2})\s*\([^)]*\)\s*(\d{2}):(\d{2})/g
  const hits: { label: string; ymd: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(plain)) != null) {
    const mm = m[1]!
    const dd = m[2]!
    const hm = `${m[3]}:${m[4]}`
    const ymd = `${yearHint}-${mm}-${dd}`
    hits.push({ label: `${mm}/${dd} ${hm}`, ymd })
  }
  if (hits.length === 0) {
    return { departTimeText: null, returnTimeText: null, htmlDepartYmd: null, htmlReturnYmd: null }
  }
  if (hits.length === 1) {
    return {
      departTimeText: hits[0]!.label,
      returnTimeText: null,
      htmlDepartYmd: hits[0]!.ymd,
      htmlReturnYmd: null,
    }
  }
  return {
    departTimeText: hits[0]!.label,
    returnTimeText: hits[1]!.label,
    htmlDepartYmd: hits[0]!.ymd,
    htmlReturnYmd: hits[1]!.ymd,
  }
}

function extractTrInnersFromTbody(html: string): string[] {
  const lower = html.toLowerCase()
  let slice = html
  const tb = lower.indexOf('<tbody')
  if (tb >= 0) slice = html.slice(tb)
  const rows: string[] = []
  let pos = 0
  for (;;) {
    const open = slice.toLowerCase().indexOf('<tr', pos)
    if (open < 0) break
    const gt = slice.indexOf('>', open)
    if (gt < 0) break
    const close = slice.toLowerCase().indexOf('</tr>', gt)
    if (close < 0) break
    rows.push(slice.slice(gt + 1, close))
    pos = close + 5
  }
  return rows
}

function splitTdCells(trInner: string): string[] {
  const cells: string[] = []
  let pos = 0
  for (;;) {
    const open = trInner.toLowerCase().indexOf('<td', pos)
    if (open < 0) break
    const gt = trInner.indexOf('>', open)
    if (gt < 0) break
    const close = trInner.toLowerCase().indexOf('</td>', gt)
    if (close < 0) break
    cells.push(trInner.slice(gt + 1, close))
    pos = close + 5
  }
  return cells
}

function parseMoreLineTotal(html: string): number | null {
  const m = html.match(/더보기[^0-9]*(\d+)\s*건\s*\/\s*(\d+)\s*건/)
  if (m) return parseInt(m[2]!, 10)
  const m2 = html.match(/(\d+)\s*건\s*\/\s*(\d+)\s*건/)
  if (m2) return parseInt(m2[2]!, 10)
  return null
}

export function parseLottetourEvtListAjaxHtml(
  html: string,
  ctx: { depYm: string; godId: string }
): { rows: LottetourCalendarRow[]; totalReported: number | null; warnings: string[] } {
  const warnings: string[] = []
  const yearHint = parseInt(ctx.depYm.slice(0, 4), 10)
  const trs = extractTrInnersFromTbody(html)
  const rows: LottetourCalendarRow[] = []
  const totalReported = parseMoreLineTotal(html)

  for (const trInner of trs) {
    const evtCd = parseEvtCdFromRow(trInner)
    if (!evtCd) continue
    const cells = splitTdCells(trInner)
    if (cells.length < 6) {
      warnings.push(`evtCd=${evtCd}: td 컬럼 ${cells.length}개만 확인(6+ 권장)`)
    }
    const timeCell = cells[0] ?? trInner
    const carrierCell = cells[1] ?? ''
    const gradeCell = cells[2] ?? ''
    const titleCell = cells[3] ?? ''
    const durationCell = cells[4] ?? ''
    const priceCell = cells[5] ?? trInner
    const statusCell = cells[6] ?? ''

    const price = parseKrwStrong(priceCell)
    const { departTimeText, returnTimeText, htmlDepartYmd, htmlReturnYmd } = parseTimeCell(timeCell, yearHint)
    const evtYmd = departDateFromLottetourEvtCd(evtCd)
    if (evtYmd && htmlDepartYmd && evtYmd !== htmlDepartYmd) {
      warnings.push(`evtCd=${evtCd}: HTML 출발일(${htmlDepartYmd})과 evtCd 날짜(${evtYmd}) 불일치 — evtCd 기준으로 저장`)
    }
    const departDate = evtYmd ?? htmlDepartYmd
    if (!departDate) {
      warnings.push(`evtCd=${evtCd}: 출발일 파싱 실패`)
      continue
    }

    const { statusRaw, seatsStatusRaw } = parseStatusParts(statusCell)
    const seatCount = parseSeatCount(stripTags(statusCell))

    rows.push({
      depYm: ctx.depYm,
      godId: ctx.godId,
      evtCd,
      departDate,
      returnDate: htmlReturnYmd,
      departTimeText,
      returnTimeText,
      carrierText: stripTags(carrierCell).slice(0, 200) || null,
      gradeText: stripTags(gradeCell).slice(0, 120) || null,
      tourTitleRaw: stripTags(titleCell).slice(0, 400) || null,
      durationText: stripTags(durationCell).slice(0, 80) || null,
      adultPrice: price,
      statusRaw,
      seatsStatusRaw,
      seatCount,
    })
  }

  return { rows, totalReported, warnings }
}

function buildEvtListAjaxUrl(args: {
  depDt: string
  godId: string
  menuNos: readonly [string, string, string, string]
  pageIndex: number
  maxEvtCnt: number
  evtOrderBy: 'DT' | 'PR'
}): string {
  const u = new URL(`${lottetourBase()}/evtlist/evtListAjax`)
  u.searchParams.set('depDt', args.depDt)
  u.searchParams.set('godId', args.godId)
  const [m1, m2, m3, m4] = args.menuNos
  u.searchParams.set('menuNo1', m1)
  u.searchParams.set('menuNo2', m2)
  u.searchParams.set('menuNo3', m3)
  u.searchParams.set('menuNo4', m4)
  u.searchParams.set('evtOrderBy', args.evtOrderBy)
  u.searchParams.set('pageIndex', String(args.pageIndex))
  u.searchParams.set('maxEvtCnt', String(args.maxEvtCnt))
  u.searchParams.set('template', 'evtList')
  return u.toString()
}

async function fetchEvtListAjaxPage(args: {
  url: string
  timeoutMs: number
  maxRetries: number
  signal?: AbortSignal
  headers?: Record<string, string>
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>
}): Promise<string> {
  const { fetchImpl = fetch } = args
  let lastErr: unknown
  for (let attempt = 1; attempt <= args.maxRetries; attempt++) {
    const signal = args.signal ?? AbortSignal.timeout(args.timeoutMs)
    try {
      const res = await fetchImpl(args.url, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': defaultUserAgent(),
          ...(args.headers ?? {}),
        },
        signal,
      })
      if (res.status >= 500 && attempt < args.maxRetries) {
        await new Promise((r) => setTimeout(r, 450 * attempt))
        continue
      }
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${t.slice(0, 160)}`)
      }
      return await res.text()
    } catch (e) {
      lastErr = e
      if (attempt >= args.maxRetries) throw e
      await new Promise((r) => setTimeout(r, 450 * attempt))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/**
 * `godId`·`menuNos` 기준으로 월별 공개 HTML을 순회·페이지네이션해 행을 모은다.
 */
export async function collectLottetourCalendarRange(
  params: LottetourCalendarRangeParams,
  options?: LottetourCalendarRangeOptions
): Promise<{ rows: LottetourCalendarRow[]; warnings: string[] }> {
  const warnings: string[] = []
  const godId = (params.godId ?? '').trim()
  const menuNos = params.menuNos
  if (!godId) return { rows: [], warnings: ['godId 비어 있음'] }
  if (!menuNos?.[0] || !menuNos[1] || !menuNos[2] || !menuNos[3]) {
    return { rows: [], warnings: ['menuNo1~4 불완전'] }
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = Math.max(1, Math.min(6, options?.maxRetries ?? 3))
  const maxEvtCnt = Math.max(5, Math.min(50, options?.maxEvtCnt ?? DEFAULT_MAX_EVT_CNT))
  const evtOrderBy = options?.evtOrderBy ?? 'DT'
  const monthCount = resolveMonthCount(options?.monthCount)
  const startYm = (options?.dateFrom?.trim() && /^\d{4}-\d{2}$/.test(options.dateFrom.trim())
    ? options.dateFrom.trim()
    : resolveDefaultDateFromYm())!
  const yms = enumerateYm(startYm, monthCount)

  const dateToCap = (process.env.LOTTETOUR_DATE_TO ?? '').trim()
  const ymsFiltered =
    dateToCap && /^\d{4}-\d{2}$/.test(dateToCap) ? yms.filter((ym) => ym <= dateToCap) : yms

  const all: LottetourCalendarRow[] = []
  const htmlByYm = options?.htmlByDepYm ?? null

  for (const ym of ymsFiltered) {
    const depDt = ymToDepDt(ym)
    let pageIndex = 1
    let reportedTotal: number | null = null
    for (;;) {
      const url = buildEvtListAjaxUrl({
        depDt,
        godId,
        menuNos,
        pageIndex,
        maxEvtCnt,
        evtOrderBy,
      })
      if (options?.log) {
        console.log(
          `[lottetour-departures] ${options.logLabel ?? 'collect'} ym=${ym} page=${pageIndex} maxEvtCnt=${maxEvtCnt}`
        )
      }
      let html: string
      if (htmlByYm?.has(depDt)) {
        html = htmlByYm.get(depDt)!
      } else {
        try {
          html = await fetchEvtListAjaxPage({
            url,
            timeoutMs,
            maxRetries,
            signal: options?.signal,
            headers: options?.headers,
            fetchImpl: options?.fetchImpl,
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          warnings.push(`${ym} p${pageIndex}: ${msg.slice(0, 240)}`)
          break
        }
      }
      const parsed = parseLottetourEvtListAjaxHtml(html, { depYm: depDt, godId })
      for (const w of parsed.warnings) warnings.push(`${ym} p${pageIndex}: ${w}`)
      if (reportedTotal == null && parsed.totalReported != null) reportedTotal = parsed.totalReported

      if (parsed.rows.length === 0) break
      all.push(...parsed.rows)

      if (parsed.rows.length < maxEvtCnt) break
      if (reportedTotal != null && pageIndex * maxEvtCnt >= reportedTotal) break
      pageIndex += 1
      if (pageIndex > 200) {
        warnings.push(`${ym}: pageIndex 200 초과 중단(비정상)`)
        break
      }
    }
  }

  const e2eHint = (options?.e2eTourCodeHint ?? '').trim()
  if (all.length === 0 && e2eHint && !options?.disableE2EFallback && lottetourE2eFallbackEnabled()) {
    const e2eMs = Math.max(
      30_000,
      Math.min(600_000, Number(process.env.LOTTETOUR_E2E_TIMEOUT_MS ?? '600000') || 600_000)
    )
    if (options?.log) {
      console.log(
        `[lottetour-departures] ${options.logLabel ?? 'collect'} e2e_fallback evt=${e2eHint.slice(0, 48)} timeoutMs=${e2eMs}`
      )
    }
    const py = await collectLottetourCalendarViaPythonE2eOnce({
      godId,
      menuNos,
      monthCount,
      timeoutMs: e2eMs,
      evtCdHint: e2eHint,
    })
    if (py.rows.length > 0) {
      for (const r of py.rows) all.push(r)
      warnings.push(`Python E2E(requests·GET evtListAjax HTML) 폴백으로 ${py.rows.length}건 수집(TS 경로 0건)`)
    } else {
      const tail = py.message ? ` · ${py.message.slice(0, 200)}` : ''
      warnings.push(`E2E 폴백 실패 또는 0건${tail}`)
      const stderrTail = py.stderr?.trim()
        ? py.stderr
            .trim()
            .split(/\r?\n/)
            .slice(-3)
            .join(' ')
        : ''
      if (stderrTail) warnings.push(`E2E stderr tail: ${stderrTail.slice(0, 240)}`)
    }
  } else if (all.length === 0 && e2eHint && options?.disableE2EFallback) {
    warnings.push('E2E 폴백 생략: disableE2EFallback')
  }

  all.sort((a, b) => {
    const c = a.departDate.localeCompare(b.departDate)
    if (c !== 0) return c
    return a.evtCd.localeCompare(b.evtCd)
  })
  return { rows: all, warnings }
}

function titleLayersFromEvtRow(r: LottetourCalendarRow): DepartureTitleLayers {
  return buildDepartureTitleLayers(r.tourTitleRaw || r.evtCd)
}

/** 캘린더 행 → `upsert-product-departures-lottetour` 입력 (동일 출발일 N evtCd는 evtCd 정렬 후 마지막이 DB에 남음) */
export function mapLottetourCalendarToDepartureInputs(
  rows: LottetourCalendarRow[],
  productId: string
): DepartureInput[] {
  const out: DepartureInput[] = []
  for (const r of rows) {
    const layers = titleLayersFromEvtRow(r)
    const trace = buildCommonMatchingTrace({
      source: 'lottetour_evtListAjax_html',
      supplier: 'lottetour',
      baseline: layers,
      notes: [
        `productId=${productId}`,
        `evtCd=${r.evtCd}`,
        `godId=${r.godId}`,
        `depYm=${r.depYm}`,
        r.gradeText ? `grade=${r.gradeText}` : '',
      ].filter(Boolean),
    })
    const flightMatch = (r.carrierText ?? '').match(/\b([A-Z]{2}\d{3,4})\b/)
    out.push({
      departureDate: r.departDate,
      adultPrice: r.adultPrice > 0 ? r.adultPrice : null,
      carrierName: r.carrierText,
      outboundFlightNo: flightMatch ? flightMatch[1]! : null,
      departureTimeText: r.departTimeText,
      returnTimeText: r.returnTimeText,
      statusRaw: r.statusRaw,
      seatsStatusRaw: r.seatsStatusRaw,
      seatCount: r.seatCount,
      supplierDepartureCodeCandidate: r.evtCd,
      supplierPriceKey: r.evtCd,
      matchingTraceRaw: trace,
      vehicleNote: r.durationText,
      transportSegmentRaw: r.gradeText,
    })
  }
  return out
}

export async function upsertLottetourDepartures(
  prisma: PrismaClient,
  productId: string,
  inputs: DepartureInput[],
  _options?: LottetourUpsertOptions
): Promise<LottetourDepartureUpsertResult> {
  const warnings: string[] = []
  const errors: Array<{ departDate: string; error: string }> = []
  if (_options?.dryRun) {
    return { created: 0, updated: 0, skipped: inputs.length, errors, warnings }
  }
  try {
    const n = await upsertProductDepartures(prisma, productId, inputs)
    return { created: n, updated: 0, skipped: 0, errors, warnings }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push({ departDate: '*', error: msg.slice(0, 500) })
    return { created: 0, updated: 0, skipped: inputs.length, errors, warnings }
  }
}
