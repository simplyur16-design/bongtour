export function getProductTotalDays(
  product: { duration?: string | null },
  masterTotalDays?: number | null
): number {
  if (masterTotalDays && masterTotalDays > 0) return masterTotalDays
  const m = product.duration?.match(/(\d+)일/)
  return m ? parseInt(m[1], 10) : 0
}

export function computeReturnDate(
  departureDate: string | null | undefined,
  totalDays: number
): string | null {
  if (!departureDate || !totalDays || totalDays <= 0) return null
  // 서버(UTC)·브라우저(KST) 어디서 계산해도 같은 달력일 — 로컬 시간대 getDate() 쓰면 UTC 서버에서 하루 짧아짐(SSR 귀국일 -1일)
  const m0 = String(departureDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m0) return null
  const d = new Date(Date.UTC(Number(m0[1]), Number(m0[2]) - 1, Number(m0[3])))
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + totalDays - 1)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
