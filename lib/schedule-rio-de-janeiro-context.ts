/**
 * 리우데자네이루·브라질 맥락 검출 — 「불리우는」「헐리우드」 등 부분문자열 오매칭 금지.
 * REGRESSION-FREEZE[schedule-rio-de-janeiro-context]: bare 리우/Rio 금지 — manifest
 */
/** 일정·키워드 본문에 실제 리우/브라질 신호가 있을 때만 true */
export const RIO_DE_JANEIRO_CONTEXT_RE =
  /(?:리우\s*데\s*자(?:네|녜)이루|리오\s*데\s*자(?:네|녜)이루|Rio\s*de\s*Janeiro|브라질|\bBrazil\b|Corcovado|코르코바도|코파카바나|Copacabana|슈가\s*로프|Sugar\s*Loaf|셀라론|Selar[oó]n)/i

export function hasRioDeJaneiroContext(text: string | null | undefined): boolean {
  return RIO_DE_JANEIRO_CONTEXT_RE.test(String(text ?? ''))
}
