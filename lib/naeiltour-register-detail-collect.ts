/**
 * 내일투어 등록 — detail-collect augment (api-parse SSOT 위임).
 *
 * REGRESSION-FREEZE[naeiltour-register-detail-collect]: augmentNaeiltourParsedWithDetailCollect — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-naeiltour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-naeiltour'
import { augmentNaeiltourRegisterParsedFromApiCollect } from '@/lib/naeiltour-register-api-parse'

export type NaeiltourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
}

export async function augmentNaeiltourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: NaeiltourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  return augmentNaeiltourRegisterParsedFromApiCollect(parsed, ctx)
}
