/**
 * 대표 SEO 키워드(`publicImageHeroSeoKeywordsJson`) 원료 전용.
 * imageKeyword·일정 제목과 분리 — 상품명 #태그·본문 섹션에서만 뽑는다.
 */

const HASHTAG_RE = /#([^\s#]{2,36})/g

/** 상품명·본문 상단의 `#태그` (이미지용 imageKeyword 와 무관) */
export function extractHashtagLabelsFromText(text: string, max = 12): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return out
  let m: RegExpExecArray | null
  HASHTAG_RE.lastIndex = 0
  while ((m = HASHTAG_RE.exec(t)) !== null) {
    const raw = (m[1] ?? '').trim()
    if (raw.length < 2 || raw.length > 34) continue
    const k = raw.replace(/\s/g, '')
    if (seen.has(k)) continue
    seen.add(k)
    out.push(raw)
    if (out.length >= max) break
  }
  return out
}

const SECTION_START =
  /^(?:[·•\-\*＊\s]*)?(?:[\[［]?\s*\d*\s*일차\s*[\]］]?\s*)?(?:핵심\s*포인트|예약자\s*혜택|알찬\s*일정|특별\s*포함|스페셜\s*포함)/

const SECTION_STOP = /^(?:포함사항|불포함|유의사항|예약|취소|미팅|항공|선택관광|현지옵션|일정\s*표|상품\s*안내)/

/**
 * 본문에서 섹션 헤더 다음 줄들만 모은다(장문·운영 헤더 만나면 중단).
 */
export function harvestBodySectionLinesAfterHeaders(body: string, maxLines = 18): string[] {
  const raw = (body ?? '').replace(/\r\n/g, '\n')
  const lines = raw.split(/\n/)
  const out: string[] = []
  let capture = false
  for (const line of lines) {
    const l = line.replace(/\s+/g, ' ').trim()
    if (!l) {
      if (capture && out.length > 0) break
      continue
    }
    if (SECTION_START.test(l)) {
      capture = true
      continue
    }
    if (capture) {
      if (SECTION_STOP.test(l)) break
      if (/^#{1,2}\s/.test(l)) break
      out.push(l.slice(0, 96))
      if (out.length >= maxLines) break
    }
  }
  return out
}

/** `·` / `+` / 쉼표로 잘린 짧은 조각 → 토큰 후보 */
export function splitKoreanHighlightFragments(line: string, maxParts = 6): string[] {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return []
  const parts = t
    .split(/[·⋅+＋,，、/|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 22)
  return parts.slice(0, maxParts)
}
