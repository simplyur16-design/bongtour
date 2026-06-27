/**
 * 참좋은여행 등록 parseFn — URL register-facts SSOT + 붙여넣기 보조(방문도시·혜택 등)만.
 *
 * REGRESSION-FREEZE[verygoodtour-register-api-parse]: parseForRegisterVerygoodtour → parseVerygoodtourRegisterFromApi — manifest
 * REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 정형칸 폐기 — detail-collect API SSOT
 */
import {
  parseVerygoodtourRegisterFromApi,
  type VerygoodtourRegisterApiParseOptions,
} from '@/lib/verygoodtour-register-api-parse'
import type { RegisterLlmParseOptionsCommon, RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'

export type ParseForRegisterVerygoodtourOptions = RegisterLlmParseOptionsCommon

export {
  VERYGOOD_FLIGHT_PREVIEW_NOTE,
  VERYGOOD_PRICE_SLOT_SSOT_NOTE,
} from '@/lib/verygoodtour-register-api-parse'

export async function parseForRegisterVerygoodtour(
  rawText: string,
  originSource?: string,
  options?: ParseForRegisterVerygoodtourOptions,
): Promise<RegisterParsed> {
  return parseVerygoodtourRegisterFromApi(rawText, originSource, options as VerygoodtourRegisterApiParseOptions)
}

export type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'
