/**
 * UTF-8 한글을 Latin-1(바이트)로 잘몼 읽은 문자열 복구 — 등록·표시 공통 (Node/브라우저, Buffer 불사용).
 */

function hangulCount(s: string): number {
  return (s.match(/[가-힣]/g) ?? []).length
}

function replacementCount(s: string): number {
  return (s.match(/\uFFFD/g) ?? []).length
}

/** 각 코드 유닛 하위 8비트를 UTF-8 바이트로 보고 디코딩 (classic mojibake 복구) */
function decodeUtf8BytesFromLatin1CodeUnits(s: string): string {
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff
  return new TextDecoder('utf-8', { fatal: false }).decode(b)
}

/** 비문자·깨짐 휴리스틱 (한글 거의 없고 대체 문자·PUA·물음표 연속 등) */
export function isLikelyMojibakeGarbage(s: string): boolean {
  if (!s) return false
  if (replacementCount(s) >= 1) return true
  if (/[\uE000-\uF8FF]/.test(s)) return true
  const h = hangulCount(s)
  if (h >= 2) return false
  if (/[?]{2,}/.test(s) && h === 0) return true
  if (/[?]\uFFFD/.test(s)) return true
  return false
}

/**
 * Latin-1 오독 UTF-8 복구. 복구 결과가 한글·대체 문자 측면에서 더 나을 때만 반환.
 */
export function tryRecoverUtf8MisreadAsLatin1(s: string): string | null {
  if (!s || s.length < 2) return null
  const decoded = decodeUtf8BytesFromLatin1CodeUnits(s)
  if (decoded === s) return null
  const h0 = hangulCount(s)
  const h1 = hangulCount(decoded)
  const r0 = replacementCount(s)
  const r1 = replacementCount(decoded)
  if (h1 >= 2 && h1 >= h0 && r1 <= r0) return decoded
  if (h1 > h0 + 1 && r1 <= r0 + 1) return decoded
  if (h0 === 0 && h1 >= 2 && r1 <= 4) return decoded
  return null
}

/**
 * 등록 파이프라인용: 복구 시도 후에도 깨짐이면 null (원문 모지바케를 그대로 돌려주지 않음).
 */
export function sanitizeRegisterFlightLabelText(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = String(s).trim()
  if (!t) return null
  const recovered = tryRecoverUtf8MisreadAsLatin1(t)
  if (recovered) {
    if (replacementCount(recovered) > 4) return null
    return recovered.trim() || null
  }
  if (replacementCount(t) > 2) return null
  if (/[?]{3,}/.test(t) && hangulCount(t) < 2) return null
  if (isLikelyMojibakeGarbage(t)) return null
  return t
}

/**
 * 노랑풍선 항공 라벨 최종값 — 복구 우선, 실패 시 깨진 문자열 대신 null.
 */
export function normalizeYbtourFlightLabelStrict(s: string | null | undefined): string | null {
  return sanitizeRegisterFlightLabelText(s)
}

/**
 * 사용자 상세 항공사 한 줄 — 복구 가능하면 교정, 아니면 null (깨진 문자열 비노출).
 */
export function normalizeFlightLabelForPublicDisplay(s: string | null | undefined): string | null {
  return sanitizeRegisterFlightLabelText(s)
}
