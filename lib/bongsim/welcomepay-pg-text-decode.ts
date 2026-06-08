import iconv from "iconv-lite";

/**
 * 웰컴페이먼츠 모바일 PG 기본 인코딩(EUC-KR) ↔ UTF-8(사이트) 변환.
 * 콜백 `P_RMESG1` 등이 깨져 보일 때 복구.
 */

/** UTF-8 바이트를 Latin-1 문자열로 잘못 읽은 흔적(모바일 PG 콜백). */
export function looksLikeWelcomepayMojibake(text: string): boolean {
  const s = text.trim();
  if (!s) return false;
  const hangul = (s.match(/[\uAC00-\uD7A3]/g) ?? []).length;
  if (hangul >= 2) return false;
  return /[ÃÂíëìêïå¼½¿¡¢£¤§©«¬®°±²³´µ¶·¸¹º»¼½¾]/.test(s);
}

/** Latin-1로 보존된 바이트열을 EUC-KR로 재해석. */
export function decodeWelcomepayPgTextFromEucKr(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (!looksLikeWelcomepayMojibake(s) && /[\uAC00-\uD7A3]/.test(s)) return s;
  try {
    const bytes = Buffer.from(s, "latin1");
    const decoded = iconv.decode(bytes, "euc-kr").trim();
    if (decoded && /[\uAC00-\uD7A3]/.test(decoded)) return decoded;
    if (decoded && !looksLikeWelcomepayMojibake(decoded)) return decoded;
  } catch {
    /* ignore */
  }
  return s;
}

/** urlencoded·raw PG 콜백 본문 바이트 → UTF-8 문자열. */
export function decodeWelcomepayCallbackBody(buf: Buffer, contentType: string): string {
  const ct = contentType.toLowerCase();
  const charset = ct.includes("utf") ? "utf-8" : "euc-kr";
  if (charset === "utf-8") return buf.toString("utf8");
  return iconv.decode(buf, "euc-kr");
}

export function normalizeWelcomepayPgUserMessage(raw: string): string {
  const decoded = decodeWelcomepayPgTextFromEucKr(raw);
  if (!decoded) return "";
  if (decoded.includes("\uFFFD")) return "";
  if (looksLikeWelcomepayMojibake(decoded)) return "";
  return decoded;
}
