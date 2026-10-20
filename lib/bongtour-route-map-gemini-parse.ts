/**
 * Gemini 텍스트 → 동선지도 draft 파싱 + 검증.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: parseBongtourRouteMapGeminiText — manifest
 */

import { parseGeminiJsonOutput } from '@/lib/bong-marketing/gemini-json-parse'
import { validateBongtourRouteMapGeminiDraft } from '@/lib/bongtour-route-map-gemini-validate'
import type { BongtourRouteMapGeminiValidateResult } from '@/lib/bongtour-route-map-gemini-types'

export function parseBongtourRouteMapGeminiText(
  inputCities: readonly string[],
  text: string
): BongtourRouteMapGeminiValidateResult {
  const pj = parseGeminiJsonOutput(text)
  if (!pj.ok) {
    return { ok: false, reason: 'json_parse_failed', detail: pj.errorReason }
  }
  return validateBongtourRouteMapGeminiDraft(inputCities, pj.value)
}
