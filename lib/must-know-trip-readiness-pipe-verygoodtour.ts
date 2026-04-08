/** [verygoodtour] must-know-trip-readiness-pipe */
/**
 * 등록 파이프 전용 — 유의사항 본문 blob → `mustKnowItems`만 (장문은 문장 단위로 자른 뒤 카드에 수용).
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'
import {
  normalizeTripReadinessDedupeKey,
  textPassesTripReadinessFilters,
} from '@/lib/must-know-trip-readiness-filters'
import { sentenceToDistinctTitleBody } from '@/lib/must-know-card-dedupe'

const NL = /\r?\n/

export function splitIntoMustKnowSentences(blob: string): string[] {
  const t = blob.replace(/\r/g, '').trim()
  if (!t) return []
  const paras = t.split(NL)
  const out: string[] = []
  for (const para of paras) {
    const p = para.replace(/\s+/g, ' ').trim()
    if (!p) continue
    const bits = p.split(/(?<=[.!?。…])\s+/).map((x) => x.trim()).filter(Boolean)
    const chunks = bits.length ? bits : [p]
    for (const c of chunks) {
      const s = c.replace(/^[•※·\-*]+\s*/, '').replace(/^\d+[\.)]\s+/, '').trim()
      if (s.length < 8) continue
      if (/^https?:\/\//i.test(s)) continue
      if (/광고|프로모션\s*이벤트|이미지\s*설명|홍보/i.test(s)) continue
      out.push(s)
    }
  }
  return out
}

/**
 * 포함/불포함 슬라이스에만 있는 `영국 ETA 비용` + 하위 bullet을 한 줄로 합쳐
 * `sentenceToDistinctTitleBody`가 제목만 두지 않도록 원문 기반으로 넘긴다.
 */
export function extractVerygoodEtaSnippetForMustKnowBlob(incExcText: string): string {
  const raw = incExcText.replace(/\r/g, '\n')
  const start = raw.search(/\d+\.\s*영국\s*ETA\s*비용/i)
  if (start < 0) return ''
  const slice = raw.slice(start, start + 900)
  const lines = slice.split(/\n/)
  const parts: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (parts.length && /^\d+\.\s+/.test(t) && !/ETA/i.test(t)) break
    if (/^상품평점|^■\s*항공|^1\s*일차|^미팅장소/i.test(t)) break
    parts.push(t.replace(/\s+/g, ' ').trim())
    if (parts.length >= 6) break
  }
  if (parts.length === 0) return ''
  const head = parts[0]!.replace(/^\d+\.\s*/, '').trim()
  const bullets = parts.slice(1).map((l) => l.replace(/^[-•※]+\s*/, '').trim()).filter(Boolean)
  const bodyBits = bullets.join(', ')
  if (!bodyBits) return head
  return `${head}: ${bodyBits}`
}

export function dedupeTripReadinessSentences(sentences: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of sentences) {
    const k = normalizeTripReadinessDedupeKey(s)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

/**
 * 문장 단위 필터 후 최대 maxCards개만 카드로.
 * 제목·본문은 같은 문장 복제 금지(`sentenceToDistinctTitleBody`).
 * `mustKnowRaw` / `reservationNoticeRaw` 폴백 없음.
 */
export function buildMustKnowPipeResultFromNoticeBlob(
  noticeBlob: string,
  opts?: { maxCards?: number; maxBodyChars?: number }
): { mustKnowItems: NonNullable<RegisterParsed['mustKnowItems']> | null } {
  const maxCards = opts?.maxCards ?? 6
  const maxBodyChars = opts?.maxBodyChars ?? 320
  const maxTitleChars = 42

  const filtered = dedupeTripReadinessSentences(
    splitIntoMustKnowSentences(noticeBlob).filter(textPassesTripReadinessFilters)
  )
  if (filtered.length === 0) return { mustKnowItems: null }

  const slice = filtered.slice(0, maxCards)
  const items: NonNullable<RegisterParsed['mustKnowItems']> = slice.map((full) => {
    const { title, body } = sentenceToDistinctTitleBody(full, maxTitleChars, maxBodyChars)
    return {
      category: '안전/유의' as const,
      title,
      body,
      raw: full.length <= 500 ? full : `${full.slice(0, 497)}…`,
    }
  })
  return { mustKnowItems: items.length ? items : null }
}
