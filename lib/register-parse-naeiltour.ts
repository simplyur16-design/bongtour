/**
 * 내일투어 등록 parseFn — URL register-facts SSOT + 붙여넣기 보조(방문도시·혜택 등)만.
 *
 * REGRESSION-FREEZE[naeiltour-register-api-parse]: parseForRegisterNaeiltour → parseNaeiltourRegisterFromApi — manifest
 * REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 정형칸 폐기 — detail-collect API SSOT
 * REGRESSION-FREEZE[naeiltour-register-ssot-freeze]: Gemini overlay 없음 — manifest
 */
import {
  parseNaeiltourRegisterFromApi,
  type NaeiltourRegisterApiParseOptions,
} from '@/lib/naeiltour-register-api-parse'
import type { RegisterLlmParseOptionsCommon, RegisterParsed } from '@/lib/register-llm-schema-naeiltour'

export type ParseForRegisterNaeiltourOptions = RegisterLlmParseOptionsCommon

export {
  NAEILTOUR_FLIGHT_PREVIEW_NOTE,
  NAEILTOUR_PRICE_SLOT_SSOT_NOTE,
} from '@/lib/naeiltour-register-api-parse'

export async function parseForRegisterNaeiltour(
  rawText: string,
  originSource?: string,
  options?: ParseForRegisterNaeiltourOptions,
): Promise<RegisterParsed> {
  return parseNaeiltourRegisterFromApi(rawText, originSource, options as NaeiltourRegisterApiParseOptions)
}

export type { RegisterParsed } from '@/lib/register-llm-schema-naeiltour'
