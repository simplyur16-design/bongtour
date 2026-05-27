/** 직군(언론사) 직장 이메일 허용 도메인 — 소문자 exact match */
export const PRESS_ALLOWED_DOMAINS = ["joonbu.com", "incheonilbo.com"] as const;

export type PressAllowedDomain = (typeof PRESS_ALLOWED_DOMAINS)[number];

export function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at >= email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/** @ 뒤 도메인이 허용 목록과 정확히 일치하는지 */
export function isPressDomain(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return (PRESS_ALLOWED_DOMAINS as readonly string[]).includes(domain);
}
