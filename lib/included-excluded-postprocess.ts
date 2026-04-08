/**
 * 포함/불포함 문자열 배열 후처리 — 환율 장문·약관 전문·보험 참조 등 노출 축소.
 * 옵션/쇼핑/항공 파서와 분리.
 */

const DROP_LINE_RES: RegExp[] = [
  /국외여행\s*표준\s*약관\s*제\s*11\s*조|국외여행\s*표준약관\s*제\s*11\s*조/i,
  /표준\s*약관\s*제\s*\d+\s*조|표준약관\s*제\s*\d+\s*조/i,
  /보험\s*설명\s*참조|여행자\s*보험\s*약관|보험\s*가입\s*권유/i,
  /하나은행|외환은행|기준환율|현찰\s*살때|현찰\s*살\s*때/i,
  /출발일\s*15일\s*전|2%\s*이상\s*인상|추가\s*금액을\s*청구/i,
]

function isBoilerplateLongLine(t: string): boolean {
  const s = t.replace(/\s+/g, ' ').trim()
  if (s.length < 80) return false
  if (DROP_LINE_RES.some((re) => re.test(s))) return true
  if (/환율.*(?:기준|은행|원\/|유로당|달러당)/i.test(s) && s.length > 100) return true
  if (/(?:대행료|행정절차|대사관|영사관).{20,}/i.test(s) && s.length > 120) return true
  return false
}

/** 핵심 한 줄은 유지(가이드비·1인실·ETA·TAX 등 짧은 줄) */
function keepLine(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (DROP_LINE_RES.some((re) => re.test(t))) return false
  if (isBoilerplateLongLine(t)) return false
  return true
}

export function sanitizeIncludedExcludedItemsLines(items: string[]): string[] {
  const out: string[] = []
  for (const raw of items) {
    const t = raw.replace(/\s+/g, ' ').trim()
    if (!t) continue
    if (!keepLine(t)) continue
    const shortened = t.length > 420 ? `${t.slice(0, 417)}…` : t
    out.push(shortened)
  }
  return out.slice(0, 45)
}
