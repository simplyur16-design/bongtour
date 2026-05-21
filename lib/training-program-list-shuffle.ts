/** 공개 연수 프로그램 목록 — 기간(주)마다 동일 시드로 셔플, 같은 주 안에서는 순서 고정 */

function hashStringToSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** ISO 주차 키 — 매주 목록 순서가 바뀜 */
export function getTrainingProgramShufflePeriodKey(date = new Date()): string {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export function shuffleTrainingProgramsByPeriod<T extends { id: string }>(
  programs: T[],
  periodKey = getTrainingProgramShufflePeriodKey()
): T[] {
  if (programs.length <= 1) return [...programs]
  const rand = mulberry32(hashStringToSeed(`${periodKey}:overseas_training`))
  const out = [...programs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}
