import { deriveIncludedExcludedFromRaw } from '@/lib/derive-included-excluded-from-raw'
import { parseProductRawMetaPublic } from '@/lib/public-product-extras'

export function parseProductDetailRawMeta(
  rawMeta: string | null | undefined,
  includedText: string | null | undefined,
  excludedText: string | null | undefined
) {
  const rawParsed = parseProductRawMetaPublic(rawMeta ?? null)
  const structured = rawParsed?.structuredSignals

  const derivedIncludedExcluded = deriveIncludedExcludedFromRaw(structured?.detailBodyNormalizedRaw ?? null)
  const finalIncludedText =
    includedText && includedText.trim().length > 0
      ? includedText
      : derivedIncludedExcluded.includedItems.length > 0
        ? derivedIncludedExcluded.includedItems.join('\n')
        : null
  const finalExcludedText =
    excludedText && excludedText.trim().length > 0
      ? excludedText
      : derivedIncludedExcluded.excludedItems.length > 0
        ? derivedIncludedExcluded.excludedItems.join('\n')
        : null

  return { rawParsed, structured, finalIncludedText, finalExcludedText }
}
