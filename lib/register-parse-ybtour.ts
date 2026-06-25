/**
 * 노랑풍선 등록 parseFn — API SSOT + 붙여넣기 보조(방문도시·혜택 등)만.
 *
 * REGRESSION-FREEZE[ybtour-register-api-parse]: parseForRegisterYbtour → parseYbtourRegisterFromApi — manifest
 * REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 정형칸 폐기 — detail-collect API SSOT
 * REGRESSION-FREEZE[ybtour-register-ssot-freeze]: Gemini overlay 없음 — manifest
 */
import { parseYbtourRegisterFromApi, type YbtourRegisterApiParseOptions } from '@/lib/ybtour-register-api-parse'
import type { RegisterLlmParseOptionsCommon, RegisterParsed } from '@/lib/register-llm-schema-ybtour'

export type ParseForRegisterYbtourOptions = RegisterLlmParseOptionsCommon

export { YBTOUR_FLIGHT_PREVIEW_NOTE, YBTOUR_PRICE_SLOT_SSOT_NOTE } from '@/lib/ybtour-register-api-parse'

export async function parseForRegisterYbtour(
  rawText: string,
  originSource?: string,
  options?: ParseForRegisterYbtourOptions,
): Promise<RegisterParsed> {
  return parseYbtourRegisterFromApi(rawText, originSource, options as YbtourRegisterApiParseOptions)
}

export type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
