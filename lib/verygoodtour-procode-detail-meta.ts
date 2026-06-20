/**
 * verygoodtour — 출발일별 ProCode PackageDetail fetch로 status·minPax·carrier 보강 (E2E 전).
 *
 * REGRESSION-FREEZE[verygoodtour-hxr-departure-collect]: ProCode별 PackageDetail 메타 — manifest
 */
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-verygoodtour'

const VERYGOODTOUR_BASE = process.env.VERYGOODTOUR_BASE_URL ?? 'https://www.verygoodtour.com'

export type VerygoodProCodeDetailMeta = {
  proCode: string
  statusRaw: string | null
  departureStatusRaw: string | null
  minPax: number | null
  carrierName: string | null
  adultPrice: number | null
}

export function parseVerygoodProCodeVariant(proCode: string): { master: string; yymmdd: string; suffix: string } | null {
  const t = proCode.trim()
  const i = t.indexOf('-')
  if (i <= 0) return null
  const master = t.slice(0, i)
  const variant = t.slice(i + 1)
  if (variant.length < 7) return null
  return { master, yymmdd: variant.slice(0, 6), suffix: variant.slice(6) }
}

/** seed ProCode의 suffix를 유지한 채 출발 YMD → ProCode (예: IPP105-2606243N5D + 2026-06-24). */
export function buildVerygoodProCodeForYmd(seedProCode: string, ymd: string): string | null {
  const parts = parseVerygoodProCodeVariant(seedProCode)
  if (!parts || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const yymmdd = ymd.slice(2, 4) + ymd.slice(5, 7) + ymd.slice(8, 10)
  return `${parts.master}-${yymmdd}${parts.suffix}`
}

function positiveInt(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/** PackageDetail HTML 내 Braze productJson — booking_status·minimum_booking_count 등. */
export function parseVerygoodProCodeDetailMetaFromHtml(
  proCode: string,
  html: string,
): VerygoodProCodeDetailMeta | null {
  const anchor = html.indexOf('"booking_status"')
  if (anchor < 0) return null
  const start = html.lastIndexOf('{', anchor)
  const end = html.indexOf('};', anchor)
  if (start < 0 || end < 0 || end <= start) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(html.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
  const code = String(parsed.product_code ?? '').trim()
  if (code && code !== proCode.trim()) return null

  const bookingStatus = String(parsed.booking_status ?? '').trim() || null
  const departureStatus = String(parsed.departure_status ?? '').trim() || null
  const airline = String(parsed.airline ?? '').trim() || null
  const minPax = positiveInt(parsed.minimum_booking_count)
  const adultPrice = positiveInt(parsed.price)

  return {
    proCode: code || proCode.trim(),
    statusRaw: bookingStatus,
    departureStatusRaw: departureStatus,
    minPax,
    carrierName: airline,
    adultPrice,
  }
}

function verygoodProCodeEnrichPauseMs(): number {
  const raw = Number(process.env.VERYGOOD_PROCODE_ENRICH_PAUSE_MS ?? '150')
  return Number.isFinite(raw) && raw >= 0 ? raw : 150
}

function verygoodProCodeEnrichConcurrency(): number {
  const raw = Number(process.env.VERYGOOD_PROCODE_ENRICH_CONCURRENCY ?? '3')
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchVerygoodProCodeDetailMeta(
  proCode: string,
  refererUrl: string,
): Promise<VerygoodProCodeDetailMeta | null> {
  const base = VERYGOODTOUR_BASE.replace(/\/$/, '')
  const url = `${base}/Product/PackageDetail?ProCode=${encodeURIComponent(proCode.trim())}&PriceSeq=1`
  try {
    const res = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ko-KR',
        referer: refererUrl.trim() || `${base}/`,
        'user-agent': 'Mozilla/5.0 (compatible; BongTour/1.0)',
      },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return parseVerygoodProCodeDetailMetaFromHtml(proCode, html)
  } catch {
    return null
  }
}

export type VerygoodProCodeEnrichOptions = {
  concurrency?: number
  pauseMs?: number
}

function mergeVerygoodProCodeMetaIntoInput(
  input: DepartureInput,
  meta: VerygoodProCodeDetailMeta,
): DepartureInput {
  const statusRaw =
    input.statusRaw?.trim() ||
    meta.statusRaw ||
    meta.departureStatusRaw ||
    null
  return {
    ...input,
    statusRaw,
    minPax: input.minPax ?? meta.minPax,
    carrierName: input.carrierName?.trim() || meta.carrierName,
    adultPrice: input.adultPrice ?? meta.adultPrice ?? input.adultPrice,
  }
}

/** HXR left-cell 등 메타 빈 행 — 출발일별 ProCode PackageDetail로 status·min·항공 보강. */
export async function enrichVerygoodDepartureInputsWithProCodeDetail(
  inputs: DepartureInput[],
  seedProCode: string,
  refererUrl: string,
  options?: VerygoodProCodeEnrichOptions,
): Promise<DepartureInput[]> {
  if (inputs.length === 0) return inputs

  const concurrency = Math.max(1, options?.concurrency ?? verygoodProCodeEnrichConcurrency())
  const pauseMs = Math.max(0, options?.pauseMs ?? verygoodProCodeEnrichPauseMs())
  const cache = new Map<string, VerygoodProCodeDetailMeta | null>()
  const jobs: Array<{ index: number; proCode: string }> = []

  for (let i = 0; i < inputs.length; i += 1) {
    const ymd = departureInputToYmd(inputs[i]!.departureDate)
    if (!ymd) continue
    const proCode = buildVerygoodProCodeForYmd(seedProCode, ymd)
    if (!proCode) continue
    jobs.push({ index: i, proCode })
  }

  const uniqueCodes = [...new Set(jobs.map((j) => j.proCode))]
  for (let start = 0; start < uniqueCodes.length; start += concurrency) {
    const slice = uniqueCodes.slice(start, start + concurrency)
    await Promise.all(
      slice.map(async (proCode) => {
        if (cache.has(proCode)) return
        cache.set(proCode, await fetchVerygoodProCodeDetailMeta(proCode, refererUrl))
      }),
    )
    if (start + concurrency < uniqueCodes.length && pauseMs > 0) {
      await sleepMs(pauseMs)
    }
  }

  const out = [...inputs]
  for (const job of jobs) {
    const meta = cache.get(job.proCode)
    if (!meta) continue
    out[job.index] = mergeVerygoodProCodeMetaIntoInput(out[job.index]!, meta)
  }
  return out
}
