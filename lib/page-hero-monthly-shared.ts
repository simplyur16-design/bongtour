import type { PageHeroMonthlyGeminiJob } from '@/lib/page-hero-monthly-types'

export function pageHeroMonthlyGeminiJobKey(job: PageHeroMonthlyGeminiJob): string {
  const dest = (job.destinationDisplay ?? '').trim().slice(0, 80) || (job.travelScope === 'domestic' ? '국내' : '해외')
  return `${job.targetMonth1To12}|${dest}|${job.travelScope}`
}

/** 순서 유지 dedupe — API 1회당 최대 12개 */
export function dedupePageHeroMonthlyGeminiJobsPreservingOrder(
  jobs: PageHeroMonthlyGeminiJob[]
): PageHeroMonthlyGeminiJob[] {
  const seen = new Set<string>()
  const out: PageHeroMonthlyGeminiJob[] = []
  for (const j of jobs) {
    const k = pageHeroMonthlyGeminiJobKey(j)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(j)
    if (out.length >= 12) break
  }
  return out
}
