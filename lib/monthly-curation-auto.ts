/** YYYY-MM monthKey에 달 수를 더한다 (air-hotel 시즌·기타 SSOT). */
export function addMonthsToMonthKey(monthKey: string, deltaMonths: number): string {
  const [ys, ms] = monthKey.split('-')
  const y = parseInt(ys, 10)
  const m = parseInt(ms, 10)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error(`Invalid monthKey: ${monthKey}`)
  }
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
