/**
 * 꼭 확인하세요: 공급사 원문이 부족할 때만 Google 검색 도구로 사실 보완(창작 금지).
 * API 미지원·실패 시 빈 결과 → 호출부에서 원문만 유지.
 */
import { getModelName } from '@/lib/gemini-client'

const apiKey = process.env.GEMINI_API_KEY ?? ''

export type MustKnowSupplementItem = {
  category: string
  title: string
  body: string
}

export type MustKnowSupplementResult = {
  items: MustKnowSupplementItem[]
  noticeRaw: string | null
}

function parseJsonArray(text: string): MustKnowSupplementItem[] {
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return []
  try {
    const arr = JSON.parse(m[0]) as unknown
    if (!Array.isArray(arr)) return []
    const out: MustKnowSupplementItem[] = []
    for (const row of arr) {
      const r = row as Record<string, unknown>
      const category = String(r.category ?? '').trim()
      const title = String(r.title ?? '').trim()
      const body = String(r.body ?? '').trim()
      if (!title || !body) continue
      out.push({ category: category || '현지준비', title, body })
      if (out.length >= 4) break
    }
    return out
  } catch {
    return []
  }
}

/**
 * 공급사에서 추출한 항목이 2개 미만이거나 본문이 매우 짧을 때만 호출.
 */
export async function supplementMustKnowWithWebSearch(params: {
  destination: string
  title: string
  supplierItemsJson: string
  pastedBodySnippet: string
}): Promise<MustKnowSupplementResult> {
  if (!apiKey.trim()) return { items: [], noticeRaw: null }

  const prompt = `You are a travel compliance assistant. Use Google Search grounding to find FACTUAL, up-to-date official or widely trusted information for travelers visiting: ${params.destination} (product: ${params.title}).

CRITICAL RULES:
- Do NOT invent facts. Only output items that search results can support.
- If uncertain, output fewer items or empty array [].
- Do NOT repeat insurance/fuel/coupon keywords. Do NOT include counseling keywords.
- Prefer: entry/visa/eTA, passport validity, child documents, season/weather, voltage/SIM, payment/cash. For domestic Korea trips: meeting time, boarding place, ID, weather, clothing.
- Supplier already extracted (do not duplicate): ${params.supplierItemsJson.slice(0, 4000)}
- Pasted snippet (context only): ${params.pastedBodySnippet.slice(0, 2000)}

Return ONLY a JSON array (no markdown) of 0-4 objects: [{"category":"입국/비자|자녀동반|현지준비|안전/유의|국내준비","title":"...","body":"1-2 short sentences"}]`

  const model = getModelName()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0, maxOutputTokens: 2048 },
      }),
    })
    if (!res.ok) return { items: [], noticeRaw: null }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    const items = parseJsonArray(text)
    return {
      items,
      noticeRaw: items.length > 0 ? '일부 항목은 공식·신뢰 출처 검색으로 보완했습니다. 출발 전 최신 기준을 확인하세요.' : null,
    }
  } catch {
    return { items: [], noticeRaw: null }
  }
}

export function isMustKnowInsufficient(items: Array<{ title?: string; body?: string }>): boolean {
  if (items.length >= 3) return false
  const total = items.reduce((n, it) => n + (it.title?.length ?? 0) + (it.body?.length ?? 0), 0)
  return items.length < 2 || total < 120
}
