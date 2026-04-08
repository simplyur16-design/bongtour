/** 에어텔 호텔 JSON (공급사 추출) — 공개 상세 탭용 */
export function parseAirtelHotelInfoPublic(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim()
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}
