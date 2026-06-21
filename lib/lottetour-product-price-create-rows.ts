/** lottetour confirm ProductPrice — 동일 departure date 중복 제거 (P2002 방지). */
export function dedupeLottetourProductPriceCreateRows<T extends { date: Date }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}
