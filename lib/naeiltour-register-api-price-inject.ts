/**
 * naeiltour 등록 confirm — calendar API 출발가 parsed 주입 (stub: API 미연결 시 no-op).
 *
 * REGRESSION-FREEZE[naeiltour-register-api-price-inject]: injectNaeiltourApiDeparturePricesIfMissing — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-naeiltour'

export async function injectNaeiltourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  _originUrl?: string | null,
): Promise<RegisterParsed> {
  return parsed
}
