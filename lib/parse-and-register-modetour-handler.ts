/**
 * 모두투어 등록 POST — URL register-facts + detail-collect SSOT (Gemini overlay 없음).
 */
import { augmentModetourParsedWithDetailCollect } from '@/lib/modetour-register-detail-collect'
import { parseForRegisterModetour } from '@/lib/register-parse-modetour'
import { runModetourRegisterFlow } from '@/lib/modetour-register-flow'

export async function handleParseAndRegisterModetourRequest(
  request: Request,
  opts?: { skipRequireAdmin?: boolean },
) {
  return runModetourRegisterFlow(request, {
      forcedBrandKey: 'modetour',
    parseFn: parseForRegisterModetour,
    logPrefix: '[modetour-register]',
    savePersistedParsedOnly: true,
    skipRequireAdmin: opts?.skipRequireAdmin === true,
    patchParsedAfterAugment: async (parsed, _pastedText, ctx) => {
      if (parsed.modetourDetailCollectRan) return parsed
      return augmentModetourParsedWithDetailCollect(parsed, {
        originUrl: ctx?.originUrl,
        pastedBlocks: ctx?.pastedBlocks,
        travelScope: ctx?.travelScope,
      })
    },
  })
}
