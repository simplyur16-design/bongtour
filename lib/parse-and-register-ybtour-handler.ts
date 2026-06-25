/**
 * 노랑풍선(ybtour) 등록 POST — URL register-facts + detail-collect SSOT (Gemini overlay 없음).
 *
 * REGRESSION-FREEZE[ybtour-register-ssot-freeze]: manifest
 */
import { augmentYbtourParsedWithDetailCollect } from '@/lib/ybtour-register-detail-collect'
import { injectYbtourApiDeparturePricesIfMissing } from '@/lib/ybtour-register-api-price-inject'
import { parseForRegisterYbtour } from '@/lib/register-parse-ybtour'
import { runYbtourRegisterFlow } from '@/lib/ybtour-register-flow'

export async function handleParseAndRegisterYbtourRequest(request: Request) {
  return runYbtourRegisterFlow(request, {
    forcedBrandKey: 'ybtour',
    parseFn: parseForRegisterYbtour,
    logPrefix: '[ybtour-register]',
    savePersistedParsedOnly: true,
    patchParsedAfterAugment: async (parsed, _pastedText, ctx) => {
      let next = await augmentYbtourParsedWithDetailCollect(parsed, {
        originUrl: ctx?.originUrl,
        pastedBlocks: ctx?.pastedBlocks,
      })
      next = await injectYbtourApiDeparturePricesIfMissing(next, ctx?.originUrl)
      return next
    },
  })
}
