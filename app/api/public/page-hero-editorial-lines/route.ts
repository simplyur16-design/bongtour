import { NextResponse } from 'next/server'
import { generatePageHeroMonthlyEditorialLinesWithGemini } from '@/lib/page-hero-monthly-gemini-server'
import { dedupePageHeroMonthlyGeminiJobsPreservingOrder } from '@/lib/page-hero-monthly-shared'
import type { PageHeroMonthlyGeminiJob } from '@/lib/page-hero-monthly-types'

type Body = {
  jobs?: unknown
}

function isTravelScope(v: unknown): v is PageHeroMonthlyGeminiJob['travelScope'] {
  return v === 'overseas' || v === 'domestic'
}

function parseJobs(raw: unknown): PageHeroMonthlyGeminiJob[] | null {
  if (!Array.isArray(raw)) return null
  const out: PageHeroMonthlyGeminiJob[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const m = Number(o.targetMonth1To12)
    if (!Number.isFinite(m) || m < 1 || m > 12) continue
    const dest = typeof o.destinationDisplay === 'string' ? o.destinationDisplay.slice(0, 80) : ''
    if (!isTravelScope(o.travelScope)) continue
    out.push({
      targetMonth1To12: m,
      destinationDisplay: dest,
      travelScope: o.travelScope,
    })
    if (out.length >= 12) break
  }
  return out.length > 0 ? out : null
}

/**
 * POST /api/public/page-hero-editorial-lines
 * 페이지 히어로 전용. 본문: { jobs: PageHeroMonthlyGeminiJob[] } — 최대 12건, 1회 Gemini로 lines[] 반환.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body
    const jobsRaw = parseJobs(body.jobs)
    if (!jobsRaw) {
      return NextResponse.json({ ok: false, error: 'invalid_jobs' }, { status: 400 })
    }
    const jobs = dedupePageHeroMonthlyGeminiJobsPreservingOrder(jobsRaw)
    const result = await generatePageHeroMonthlyEditorialLinesWithGemini(jobs)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.error === 'no_api_key' ? 503 : 422 })
    }
    return NextResponse.json({ ok: true, lines: result.lines, jobs })
  } catch (e) {
    console.error('[page-hero-editorial-lines]', e)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
