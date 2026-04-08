/** 저장·직렬화 직전: 빈 문자열은 null, 문자열 배열은 trim 후 빈 요소 제거 */

export function nullIfEmptyTrim(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = String(s).trim()
  return t.length > 0 ? t : null
}

export function normalizeStringList(arr: string[] | null | undefined): string[] {
  if (!arr?.length) return []
  return arr.map((x) => String(x).trim()).filter((x) => x.length > 0)
}
