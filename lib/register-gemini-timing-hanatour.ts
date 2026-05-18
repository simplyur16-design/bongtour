/**
 * 하나투어 Gemini generateContent 운영 타이밍 로그 (Railway grep용).
 */
import { geminiTimeoutOpts, getGenAI } from '@/lib/gemini-client'

type GeminiModel = ReturnType<ReturnType<typeof getGenAI>['getGenerativeModel']>

export function hanatourOriginCodeForGeminiLog(paste: string): string {
  const m = paste.match(/(?:^|\n)\s*상품코드\s*[\s\n]*([A-Z0-9][A-Z0-9-]{4,})\s*(?:\n|$)/im)
  if (m?.[1]) return m[1].trim()
  const mInline = paste.match(/상품코드\s+([A-Z0-9][A-Z0-9-]{4,})\b/i)
  if (mInline?.[1]) return mInline[1].trim()
  const m2 = paste.match(/\b([A-Z]{2,}\d{3,}[A-Z0-9-]*)\b/)
  return m2?.[1]?.trim() || 'unknown'
}

type GenerateContentRequestLike = {
  contents?: Array<{ parts?: Array<{ text?: string }> }>
}

function inputCharsFromRequest(request: unknown): number {
  const contents = (request as GenerateContentRequestLike).contents
  if (!contents) return 0
  let n = 0
  for (const c of contents) {
    for (const p of c.parts ?? []) {
      if (p.text) n += p.text.length
    }
  }
  return n
}

export async function geminiGenerateContentWithHanatourLog(
  model: GeminiModel,
  request: Parameters<GeminiModel['generateContent']>[0],
  opts: { originCode: string; promptType: string }
): Promise<Awaited<ReturnType<GeminiModel['generateContent']>>> {
  const inputCharsApprox = inputCharsFromRequest(request)
  const t0 = Date.now()
  console.log(
    `[gemini-hanatour] start originCode=${opts.originCode} inputCharsApprox=${inputCharsApprox} promptType=${opts.promptType}`
  )
  try {
    const result = await model.generateContent(request, geminiTimeoutOpts())
    const elapsedMs = Date.now() - t0
    const outputCharsApprox = result.response.text()?.length ?? 0
    console.log(
      `[gemini-hanatour] end originCode=${opts.originCode} elapsedMs=${elapsedMs} outputCharsApprox=${outputCharsApprox} status=ok`
    )
    return result
  } catch (e) {
    const elapsedMs = Date.now() - t0
    const message = e instanceof Error ? e.message : String(e)
    const status = /timeout|timed\s*out|aborted|abort/i.test(message) ? 'timeout' : 'error'
    const kind = status === 'timeout' ? 'timeout' : 'error'
    console.error(
      `[gemini-hanatour] ${kind} originCode=${opts.originCode} elapsedMs=${elapsedMs} status=${status} message=${message}`
    )
    throw e
  }
}
