/** DEBUG: overseas cold SSR phase timing — remove after investigation (perf/overseas-cold-timing-investigation) */

const PREFIX = '[overseas-cold]'

export function logOverseasColdTiming(label: string, ms: number): void {
  console.log(`${PREFIX} ${label}: ${ms}ms`)
}

export function startOverseasColdTiming(label: string): () => void {
  const t0 = Date.now()
  return () => logOverseasColdTiming(label, Date.now() - t0)
}

export async function withOverseasColdTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const end = startOverseasColdTiming(label)
  try {
    return await fn()
  } finally {
    end()
  }
}
