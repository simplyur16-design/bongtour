/**
 * kyowontour tourCode → 출발일·항공 변형 키 (같은 master의 ZE vs 7C 라인 분리).
 *
 * REGRESSION-FREEZE[kyowontour-tourcode-line]: parseTourCodeDateAndVariant — manifest
 */

export type KyowontourTourCodeLineParts = {
  departYmd: string | null
  /** IATA-ish prefix after YYMMDD — e.g. `7C` from `…7C01`, `ZE` from `…ZE01` */
  variantKey: string | null
}

/** `JHP0132607167C01` → { departYmd: '2026-07-16', variantKey: '7C' } */
export function parseKyowontourTourCodeDateAndVariant(
  tourCode: string | null | undefined,
): KyowontourTourCodeLineParts {
  const tc = String(tourCode ?? '').trim().toUpperCase()
  if (!tc) return { departYmd: null, variantKey: null }
  // master(A-Z×3+digit×3) + YYMMDD + airline suffix — greedy \d{6}만 쓰면 013260+7167C01로 깨짐
  const m = tc.match(/^([A-Z]{3}\d{3})(\d{6})([A-Z0-9]{2,})$/)
  if (!m) return { departYmd: null, variantKey: null }
  const yymmdd = m[2]!
  const suffix = m[3]!
  const yy = Number(yymmdd.slice(0, 2))
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy
  const departYmd =
    Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31
      ? `${yyyy}-${mm}-${dd}`
      : null
  const variantKey = suffix.slice(0, 2)
  return { departYmd, variantKey }
}

/** URL tourCode와 동일 항공 변형(7C/ZE…) 행만. 매칭 0이면 원본 유지. */
export function filterKyowontourCalendarRowsByUrlTourCodeLine<
  T extends { tourCode?: string | null },
>(rows: readonly T[], urlTourCode: string | null | undefined): T[] {
  const { variantKey } = parseKyowontourTourCodeDateAndVariant(urlTourCode)
  if (!variantKey || rows.length === 0) return [...rows]
  const filtered = rows.filter((r) => {
    const rowKey = parseKyowontourTourCodeDateAndVariant(r.tourCode).variantKey
    return rowKey != null && rowKey === variantKey
  })
  return filtered.length > 0 ? filtered : [...rows]
}
