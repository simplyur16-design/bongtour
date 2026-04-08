/**
 * 꼭 확인하세요 카드 — 같은 카드 내부 title/body·bullet 중복 제거 (공급사 공통 소비 규칙).
 */
import { normalizeTripReadinessDedupeKey } from '@/lib/must-know-trip-readiness-filters'

function dedupeLinesByNormKey(lines: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const l of lines) {
    const k = normalizeTripReadinessDedupeKey(l)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(l)
  }
  return out
}

/** 본문 한 줄 또는 ` · `로 이어진 bullet, 또는 개행 bullet — normalize 기준 중복 1회만 */
export function dedupeMustKnowBodyBullets(body: string): string {
  const t = body.replace(/\r/g, '\n').trim()
  if (!t) return ''
  if (/\n/.test(t)) {
    const lines = t
      .split(/\n/)
      .map((l) => l.replace(/^[•※·\-\*]+\s*/, '').replace(/^\d+[\.)]\s+/, '').trim())
      .filter(Boolean)
    return dedupeLinesByNormKey(lines).join(' · ')
  }
  const dotParts = t.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean)
  if (dotParts.length >= 2) return dedupeLinesByNormKey(dotParts).join(' · ')
  return t
}

/** 제목과 본문이 정규화 기준 동일·접두 반복이면 본문에서 제거 */
export function stripBodyThatDuplicatesTitle(title: string, body: string): string {
  const ti = title.replace(/\s+/g, ' ').trim()
  let b = body.replace(/\s+/g, ' ').trim()
  if (!ti || !b) return b
  const kt = normalizeTripReadinessDedupeKey(ti)
  const kb = normalizeTripReadinessDedupeKey(b)
  if (kt === kb || b === ti) return ''
  if (b.startsWith(ti) && b.length > ti.length) {
    b = b.slice(ti.length).replace(/^[\s.，,;:：·]+/, '').trim()
  }
  return b
}

export function normalizeMustKnowCardFields(
  title: string,
  body: string,
  opts?: { maxTitleLen?: number; maxBodyLen?: number }
): { title: string; body: string } {
  const maxT = Math.max(12, opts?.maxTitleLen ?? 48)
  const maxB = Math.max(0, opts?.maxBodyLen ?? 240)
  let t = title.replace(/\s+/g, ' ').trim()
  let b = body.replace(/\r/g, '\n').trim()
  b = dedupeMustKnowBodyBullets(b)
  b = b.replace(/\s+/g, ' ').trim()
  b = stripBodyThatDuplicatesTitle(t, b.replace(/\n/g, ' ').trim())
  if (normalizeTripReadinessDedupeKey(t) === normalizeTripReadinessDedupeKey(b)) b = ''
  if (t.length > maxT) t = `${t.slice(0, Math.max(8, maxT - 1))}…`
  if (b.length > maxB) b = `${b.slice(0, Math.max(8, maxB - 1))}…`
  return { title: t, body: b }
}

/**
 * 원문 한 문장 → 짧은 제목 + (있을 때만) 보조 본문. 파이프에서 title===body 방지.
 */
export function sentenceToDistinctTitleBody(
  full: string,
  maxTitleChars: number,
  maxBodyChars: number
): { title: string; body: string } {
  const raw = full.replace(/\s+/g, ' ').trim()
  if (!raw) return { title: '', body: '' }

  const colon = raw.match(/^(.{2,72}?)\s*[:：]\s+(.+)$/)
  if (colon) {
    let title = colon[1]!.trim()
    let body = colon[2]!.trim()
    if (title.length > maxTitleChars) title = `${title.slice(0, Math.max(8, maxTitleChars - 1))}…`
    body = stripBodyThatDuplicatesTitle(title, body)
    body = dedupeMustKnowBodyBullets(body.replace(/\n/g, ' · '))
    if (body.length > maxBodyChars) body = `${body.slice(0, Math.max(8, maxBodyChars - 1))}…`
    return normalizeMustKnowCardFields(title, body, {
      maxTitleLen: maxTitleChars,
      maxBodyLen: maxBodyChars,
    })
  }

  if (raw.length <= maxTitleChars) {
    return normalizeMustKnowCardFields(raw, '', { maxTitleLen: maxTitleChars, maxBodyLen: maxBodyChars })
  }

  const slice = raw.slice(0, maxTitleChars)
  const sp = slice.lastIndexOf(' ')
  let title: string
  let remainder: string
  if (sp > 10) {
    title = raw.slice(0, sp).trim()
    remainder = raw.slice(sp).trim()
  } else {
    title = `${raw.slice(0, Math.max(8, maxTitleChars - 1))}…`
    remainder = raw.slice(maxTitleChars - 1).trim()
  }
  remainder = stripBodyThatDuplicatesTitle(title, remainder)
  remainder = dedupeMustKnowBodyBullets(remainder.replace(/\n/g, ' · '))
  if (remainder.length > maxBodyChars) remainder = `${remainder.slice(0, Math.max(8, maxBodyChars - 1))}…`
  return normalizeMustKnowCardFields(title, remainder, {
    maxTitleLen: maxTitleChars,
    maxBodyLen: maxBodyChars,
  })
}
