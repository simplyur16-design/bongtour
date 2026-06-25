/**
 * 롯데관광 등록 parseFn — URL register-facts SSOT + 붙여넣기 보조(방문도시·혜택 등)만.
 *
 * REGRESSION-FREEZE[lottetour-register-api-parse]: parseForRegisterLottetour → parseLottetourRegisterFromApi — manifest
 * REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 정형칸 폐기 — detail-collect API SSOT
 * REGRESSION-FREEZE[lottetour-register-ssot-freeze]: Gemini overlay 없음 — manifest
 */
import {
  parseLottetourRegisterFromApi,
  type LottetourRegisterApiParseOptions,
} from '@/lib/lottetour-register-api-parse'
import type { RegisterLlmParseOptionsCommon, RegisterParsed } from '@/lib/register-llm-schema-lottetour'

export type ParseForRegisterLottetourOptions = RegisterLlmParseOptionsCommon

export {
  LOTTETOUR_FLIGHT_PREVIEW_NOTE,
  LOTTETOUR_PRICE_SLOT_SSOT_NOTE,
} from '@/lib/lottetour-register-api-parse'

export async function parseForRegisterLottetour(
  rawText: string,
  originSource?: string,
  options?: ParseForRegisterLottetourOptions,
): Promise<RegisterParsed> {
  return parseLottetourRegisterFromApi(rawText, originSource, options as LottetourRegisterApiParseOptions)
}

export type { RegisterParsed } from '@/lib/register-llm-schema-lottetour'
