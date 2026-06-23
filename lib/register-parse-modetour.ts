/**
 * 모두투어 등록 parseFn — API SSOT + 붙여넣기 보조(상품명 등)만.
 *
 * REGRESSION-FREEZE[modetour-register-api-parse]: parseForRegisterModetour → parseModetourRegisterFromApi — manifest
 * REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 정형칸 폐기 — detail-collect API SSOT
 */
import { parseModetourRegisterFromApi, type ModetourRegisterApiParseOptions } from '@/lib/modetour-register-api-parse'
import type { RegisterLlmParseOptionsCommon, RegisterParsed } from '@/lib/register-llm-schema-modetour'
import { applyModetourBasicInfoMustKnowExtract } from '@/lib/modetour-basic-info-must-know-extract'
import { parseDetailBodyStructuredModetour } from '@/lib/detail-body-parser-modetour'

export type ParseForRegisterModetourOptions = RegisterLlmParseOptionsCommon

export async function parseForRegisterModetour(
  rawText: string,
  originSource?: string,
  options?: ParseForRegisterModetourOptions,
): Promise<RegisterParsed> {
  const parsed = await parseModetourRegisterFromApi(rawText, originSource, options as ModetourRegisterApiParseOptions)
  const paste = rawText.trim()
  if (!paste) return parsed

  const detailBody = parseDetailBodyStructuredModetour({
    rawText: paste,
    hotelRaw: null,
    optionalRaw: null,
    shoppingRaw: null,
  })
  const norm = detailBody.normalizedRaw?.trim() || paste
  return applyModetourBasicInfoMustKnowExtract(parsed, norm)
}

export type { RegisterParsed } from '@/lib/register-llm-schema-modetour'
