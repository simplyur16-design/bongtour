/**
 * 동선지도 Gemini — mode 보강 실호출.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: generateBongtourRouteMapGemini — manifest
 */

import { geminiTimeoutOpts, getGenAI, getModelName } from '@/lib/gemini-client'
import { buildBongtourRouteMapGeminiPrompt } from '@/lib/bongtour-route-map-gemini-prompt'
import { parseBongtourRouteMapGeminiText } from '@/lib/bongtour-route-map-gemini-parse'
import { buildBongtourRouteMapGeminiFallback } from '@/lib/bongtour-route-map-gemini-fallback'
import type {
  BongtourRouteMapGeminiDraft,
  BongtourRouteMapGeminiInput,
} from '@/lib/bongtour-route-map-gemini-types'

const GEMINI_TIMEOUT_MS = 90_000

export type BongtourRouteMapGeminiGenerateOk = {
  ok: true
  draft: BongtourRouteMapGeminiDraft
  model: string
  attempts: number
  rawText: string
}

export type BongtourRouteMapGeminiGenerateFail = {
  ok: false
  reason: string
  detail?: string
  model?: string
  attempts: number
  rawText?: string
  fallback?: BongtourRouteMapGeminiDraft
}

export type BongtourRouteMapGeminiGenerateResult =
  | BongtourRouteMapGeminiGenerateOk
  | BongtourRouteMapGeminiGenerateFail

function hasGeminiKey(): boolean {
  return Boolean((process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim())
}

async function callOnce(prompt: string): Promise<{ text: string; model: string; finishReason?: string }> {
  const modelName = getModelName()
  const genAI = getGenAI()
  const model = genAI.getGenerativeModel({ model: modelName })
  const res = await model.generateContent(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    },
    geminiTimeoutOpts(GEMINI_TIMEOUT_MS)
  )
  const finishReason = res.response.candidates?.[0]?.finishReason
  let text = ''
  try {
    text = res.response.text() ?? ''
  } catch {
    text = ''
  }
  return { text, model: modelName, finishReason: finishReason ? String(finishReason) : undefined }
}

export async function generateBongtourRouteMapGemini(
  input: BongtourRouteMapGeminiInput
): Promise<BongtourRouteMapGeminiGenerateResult> {
  const cities = input.cities.map((c) => c.trim()).filter(Boolean)
  const fallback = buildBongtourRouteMapGeminiFallback(cities, {
    schedule: input.schedule,
  })

  if (cities.length < 2) {
    return { ok: false, reason: 'cities_lt_2', attempts: 0, fallback: fallback ?? undefined }
  }
  if (!hasGeminiKey()) {
    return { ok: false, reason: 'no_gemini_key', attempts: 0, fallback: fallback ?? undefined }
  }

  // transfer만 남을 때만 Gemini — 원문 확정 구간은 결정론 폴백 유지
  const baseDraft = fallback
  const needing = (baseDraft?.edges || [])
    .filter((e) => e.mode === 'transfer')
    .map((e) => e.from)
  if (needing.length === 0 && baseDraft) {
    return {
      ok: true,
      draft: baseDraft,
      model: 'deterministic',
      attempts: 0,
      rawText: '',
    }
  }

  const normalized: BongtourRouteMapGeminiInput = {
    ...input,
    cities,
    edgesNeedingMode: needing.length ? needing : undefined,
  }
  const basePrompt = buildBongtourRouteMapGeminiPrompt(normalized)
  let attempts = 0
  let lastRaw = ''
  let lastModel = getModelName()
  let lastFailReason = 'unknown'
  let lastFailDetail: string | undefined

  try {
    attempts = 1
    const first = await callOnce(basePrompt)
    lastRaw = first.text
    lastModel = first.model
    let parsed = parseBongtourRouteMapGeminiText(cities, first.text)
    if (parsed.ok) {
      return { ok: true, draft: parsed.draft, model: first.model, attempts, rawText: first.text }
    }
    lastFailReason = parsed.reason
    lastFailDetail = [parsed.detail, first.finishReason ? `finish=${first.finishReason}` : '']
      .filter(Boolean)
      .join(' ')

    attempts = 2
    const repair = [
      basePrompt,
      '',
      `재시도: ${parsed.reason}${parsed.detail ? ` (${parsed.detail})` : ''}`,
      'skeleton city/order/from/to 고정. mode·label·routeSummary만.',
    ].join('\n')
    const second = await callOnce(repair)
    lastRaw = second.text
    lastModel = second.model
    parsed = parseBongtourRouteMapGeminiText(cities, second.text)
    if (parsed.ok) {
      return { ok: true, draft: parsed.draft, model: second.model, attempts, rawText: second.text }
    }
    lastFailReason = parsed.reason
    lastFailDetail = [parsed.detail, second.finishReason ? `finish=${second.finishReason}` : '']
      .filter(Boolean)
      .join(' ')
    return {
      ok: false,
      reason: lastFailReason,
      detail: lastFailDetail,
      model: lastModel,
      attempts,
      rawText: lastRaw,
      fallback: fallback ?? undefined,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      reason: 'gemini_call_failed',
      detail: msg.slice(0, 400),
      model: lastModel,
      attempts,
      rawText: lastRaw || undefined,
      fallback: fallback ?? undefined,
    }
  }
}
