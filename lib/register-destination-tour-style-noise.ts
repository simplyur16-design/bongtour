/**
 * REGRESSION-FREEZE[register-destination-reject-ilju]: bare 「일주」 is tour style, not a place — manifest
 * Title tokens like `스페인·일주` / `2개국 일주` must not become destination / day-city.
 */

/** Tour-style noise that must never be stored as destination / city label alone. */
export function isRegisterDestinationTourStyleNoiseToken(token: string): boolean {
  const t = String(token ?? '').trim()
  if (!t) return true
  return /^(?:완전)?일주$|^개국$|^\d+\s*개국$|^순회$|^투어$|^패키지$/u.test(t)
}

/**
 * Scrub 「N개국」「(완전)일주」 from a title head before taking a place token.
 * Keeps real places: `터키 일주` → `터키`, `요르단·이집트 2개국 일주` → `요르단` / `이집트`.
 */
export function scrubRegisterDestinationTourStyleHead(head: string): string {
  return String(head ?? '')
    .replace(/\d+\s*개국/gu, ' ')
    .replace(/(?:완전)?일주/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** First non-noise place segment from a title head (slash / middot split). */
export function firstRegisterDestinationPlaceFromTitleHead(head: string): string | null {
  const scrubbed = scrubRegisterDestinationTourStyleHead(head)
  const parts = scrubbed
    .split(/[/／·+]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && !isRegisterDestinationTourStyleNoiseToken(s))
  return parts[0] ?? null
}

/** Filter title-hint place tokens (keeps `미서부`/`터키`, drops bare `일주`). */
export function filterRegisterDestinationTitlePlaceTokens(tokens: string[]): string[] {
  const out: string[] = []
  for (const raw of tokens) {
    const scrubbed = scrubRegisterDestinationTourStyleHead(raw)
    if (!scrubbed) continue
    for (const part of scrubbed
      .split(/[/／·+]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && !isRegisterDestinationTourStyleNoiseToken(s))) {
      out.push(part)
    }
  }
  return out
}
