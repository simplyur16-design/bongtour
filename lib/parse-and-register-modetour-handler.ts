/**
 * 모두투어 등록 POST — URL register-facts + detail-collect SSOT (Gemini overlay 없음).
 */
import { augmentModetourParsedWithDetailCollect } from '@/lib/modetour-register-detail-collect'
import { parseForRegisterModetour } from '@/lib/register-parse-modetour'
import { runModetourRegisterFlow } from '@/lib/modetour-register-flow'

export async function handleParseAndRegisterModetourRequest(request: Request) {
  return runModetourRegisterFlow(request, {
      forcedBrandKey: 'modetour',
    parseFn: parseForRegisterModetour,
    logPrefix: '[modetour-register]',
    savePersistedParsedOnly: true,
    patchParsedAfterAugment: async (parsed, _pastedText, ctx) =>
      augmentModetourParsedWithDetailCollect(parsed, {
        originUrl: ctx?.originUrl,
        pastedBlocks: ctx?.pastedBlocks,
      }),
  })
}
