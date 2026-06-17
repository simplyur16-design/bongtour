/** DEBUG: overseas cold SSR phase timing v2 — remove after investigation (perf/overseas-cold-timing-v2) */

const PREFIX = '[overseas-cold-v2]'

export function logOverseasColdTimingV2(label: string, ms: number): void {
  console.log(`${PREFIX} ${label}: ${ms}ms`)
}

export function startOverseasColdTimingV2(label: string): () => void {
  const t0 = Date.now()
  return () => logOverseasColdTimingV2(label, Date.now() - t0)
}

export async function withOverseasColdTimingV2<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const end = startOverseasColdTimingV2(label)
  try {
    return await fn()
  } finally {
    end()
  }
}
