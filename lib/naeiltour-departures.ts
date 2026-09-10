/**
 * 내일투어 출발일·성인가 — program_process.asp 월별 목록 (HTTP only).
 * REGRESSION-FREEZE[naeiltour-program-process-departures]: program_process span.disc — manifest
 */
import {
  fetchNaeiltourText,
  NAEILTOUR_BASE,
  parseNaeiltourGoodCdFromUrl,
} from '@/lib/naeiltour-http'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

/** 내일투어 전용 — 월 요청 간격 (공용 스크래퍼 SSOT 아님). */
const NAEILTOUR_PROGRAM_LIST_PACE_MS = 280

export type NaeiltourCalendarRow = {
  departDate: string
  adultPrice: number
  eventSeq: string | null
  carrierName: string | null
  statusRaw: string | null
  seatsStatusRaw: string | null
  seatCount: number | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parseKrw(raw: string | null | undefined): number {
  const n = Number(String(raw ?? '').replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

function ymdFromYmAndMd(selYm: string, md: string): string | null {
  const ym = String(selYm ?? '').replace(/\D/g, '')
  if (ym.length !== 6) return null
  const m = md.match(/^(\d{1,2})\/(\d{1,2})/)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const y = Number(ym.slice(0, 4))
  const ymMonth = Number(ym.slice(4, 6))
  if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  // 행에 귀국일이 먼저 올 수 있어 월이 sel_ym과 다르면 스킵
  if (month !== ymMonth) return null
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseNaeiltourProgramProcessListHtml(
  html: string,
  selYm: string,
): NaeiltourCalendarRow[] {
  const out: NaeiltourCalendarRow[] = []
  const seen = new Set<string>()
  const trRe = /<tr\b[^>]*onclick=[^>]*view\.asp[^>]*>([\s\S]*?)<\/tr>/gi
  for (const m of html.matchAll(trRe)) {
    const tr = m[0] ?? ''
    const body = m[1] ?? ''
    const eventSeq = tr.match(/event_seq=(\d+)/i)?.[1] ?? null
    const dateLine = body.match(/class=["']corange["'][^>]*>\s*([^<]+)/i)?.[1]?.trim() ?? ''
    const departDate = ymdFromYmAndMd(selYm, dateLine)
    const price = parseKrw(body.match(/class=["']disc["'][^>]*>\s*([\d,]+)/i)?.[1])
    if (!departDate || price <= 0) continue
    if (seen.has(departDate)) continue
    seen.add(departDate)
    const carrierName =
      body.match(/class=["']btxt["'][^>]*>\s*([^<]+)/i)?.[1]?.replace(/\s+/g, ' ').trim() || null
    const seatLine = body.match(/예약\s*:\s*(\d+)\s*명\s*\/\s*좌석\s*:\s*(\d+)\s*석/i)
    const seatCount = seatLine ? Number(seatLine[2]) : null
    const closed =
      /alt=["']마감["']/i.test(body) || /예약마감|출발마감|마감/.test(body.replace(/<[^>]+>/g, ' '))
    const statusRaw = closed ? '마감' : '예약가능'
    const seatsStatusRaw =
      seatCount != null && Number.isFinite(seatCount) ? `잔여${seatCount}석` : null
    out.push({
      departDate,
      adultPrice: price,
      eventSeq,
      carrierName,
      statusRaw,
      seatsStatusRaw,
      seatCount: seatCount != null && Number.isFinite(seatCount) ? seatCount : null,
    })
  }
  return out
}

export async function fetchNaeiltourProgramListHtml(args: {
  goodCd: string
  selYm: string
  selDay?: string
  referer?: string
}): Promise<string> {
  const goodCd = args.goodCd.trim()
  const selYm = args.selYm.replace(/\D/g, '').slice(0, 6)
  const selDay = (args.selDay ?? '').replace(/\D/g, '')
  const qs = new URLSearchParams({
    good_cd: goodCd,
    nchk: '',
    htype: '',
    sub_area_cd: '',
    sel_ym: selYm,
    sel_day: selDay,
    chk_ord: '',
  })
  const referer =
    args.referer?.trim() || `${NAEILTOUR_BASE}/sub/view.asp?good_cd=${encodeURIComponent(goodCd)}`
  return fetchNaeiltourText(`${NAEILTOUR_BASE}/sub/program_process.asp?${qs.toString()}`, {
    headers: { referer },
    signal: AbortSignal.timeout(30_000),
  })
}

function monthsInHorizon(fromYmd: string, toYmd: string): string[] {
  const out: string[] = []
  let y = Number(fromYmd.slice(0, 4))
  let m = Number(fromYmd.slice(5, 7))
  const endY = Number(toYmd.slice(0, 4))
  const endM = Number(toYmd.slice(5, 7))
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

export async function collectNaeiltourProgramProcessDeparturesForGoodCd(
  goodCd: string,
  opts?: { fromYmd?: string; toYmd?: string; refererUrl?: string | null; paceMs?: number },
): Promise<NaeiltourCalendarRow[]> {
  const cd = goodCd.trim()
  if (!cd) return []
  const fromYmd = opts?.fromYmd ?? kstTodayYmd()
  const toYmd = opts?.toYmd ?? addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const pace = opts?.paceMs ?? NAEILTOUR_PROGRAM_LIST_PACE_MS
  const referer =
    opts?.refererUrl?.trim() || `${NAEILTOUR_BASE}/sub/view.asp?good_cd=${encodeURIComponent(cd)}`
  const byDate = new Map<string, NaeiltourCalendarRow>()
  const months = monthsInHorizon(fromYmd, toYmd)
  for (let i = 0; i < months.length; i++) {
    const selYm = months[i]!
    if (i > 0) await sleep(pace)
    const html = await fetchNaeiltourProgramListHtml({ goodCd: cd, selYm, referer })
    for (const row of parseNaeiltourProgramProcessListHtml(html, selYm)) {
      if (row.departDate < fromYmd || row.departDate > toYmd) continue
      const prev = byDate.get(row.departDate)
      if (!prev || row.adultPrice < prev.adultPrice) byDate.set(row.departDate, row)
    }
  }
  return [...byDate.values()].sort((a, b) => a.departDate.localeCompare(b.departDate))
}

export async function collectNaeiltourProgramProcessDeparturesForUrl(
  originUrl: string,
  opts?: { fromYmd?: string; toYmd?: string; paceMs?: number },
): Promise<NaeiltourCalendarRow[]> {
  const goodCd = parseNaeiltourGoodCdFromUrl(originUrl)
  if (!goodCd) return []
  return collectNaeiltourProgramProcessDeparturesForGoodCd(goodCd, {
    ...opts,
    refererUrl: originUrl,
  })
}
