/**
 * 교원이지 등록 parseFn — URL register-facts SSOT + 붙여넣기 보조(방문도시·혜택 등)만.
 *
 * REGRESSION-FREEZE[kyowontour-register-api-parse]: parseForRegisterKyowontour → parseKyowontourRegisterFromApi — manifest
 * REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 정형칸 폐기 — tab-data·detail-collect API SSOT
 */
import {
  parseKyowontourRegisterFromApi,
  type KyowontourRegisterApiParseOptions,
} from '@/lib/kyowontour-register-api-parse'
import type { RegisterLlmParseOptionsCommon, RegisterParsed } from '@/lib/register-llm-schema-kyowontour'

export type ParseForRegisterKyowontourOptions = RegisterLlmParseOptionsCommon

export {
  KYOWONTOUR_FLIGHT_PREVIEW_NOTE,
  KYOWONTOUR_PRICE_SLOT_SSOT_NOTE,
} from '@/lib/kyowontour-register-api-parse'

export async function parseForRegisterKyowontour(
  rawText: string,
  originSource?: string,
  options?: ParseForRegisterKyowontourOptions,
): Promise<RegisterParsed> {
  return parseKyowontourRegisterFromApi(rawText, originSource, options as KyowontourRegisterApiParseOptions)
}

export type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
