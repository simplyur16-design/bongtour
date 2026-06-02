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
  const d = new Date(departureDate + 'T00:00:00+09:00')
  d.setDate(d.getDate() + totalDays - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
