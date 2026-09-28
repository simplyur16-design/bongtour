/**
 * ybtour 등록 수집 — URL evCd 우선, 편명 비면 goodsCd seed 폴백 (ybtour 전용).
 * REGRESSION-FREEZE[ybtour-register-collect-url-prefer-evcd]: evCd→goodsCd fallback — manifest
 */
import { parseYbtourRegisterFromApi } from '@/lib/ybtour-register-api-parse'
import { augmentYbtourParsedWithDetailCollect } from '@/lib/ybtour-register-detail-collect'
import {
  parseYbtourBaseSeriesFromEvCdShape,
  parseYbtourEvCdFromUrl,
  resolveYbtourGoodsCdForApi,
  resolveYbtourRegisterCollectUrl,
} from '@/lib/ybtour-api-departures'

function flightStructuredScore(fs: unknown): number {
  if (!fs || typeof fs !== 'object' || Array.isArray(fs)) return 0
  const o = fs as {
    airlineName?: string
    outbound?: { flightNo?: string; departureTime?: string }
    inbound?: { flightNo?: string; departureTime?: string }
  }
  let n = 0
  if (String(o.airlineName || '').trim()) n += 1
  if (o.outbound?.flightNo) n += 2
  if (o.outbound?.departureTime) n += 1
  if (o.inbound?.flightNo) n += 2
  if (o.inbound?.departureTime) n += 1
  return n
}

export function resolveYbtourGoodsCdOnlyCollectUrl(
  originUrl: string,
  originCode?: string | null,
): string | null {
  const goodsCd =
    resolveYbtourGoodsCdForApi(originUrl, originCode) ||
    parseYbtourBaseSeriesFromEvCdShape(originCode) ||
    parseYbtourBaseSeriesFromEvCdShape(parseYbtourEvCdFromUrl(originUrl))
  if (!goodsCd) return null
  return `https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=${encodeURIComponent(goodsCd)}`
}

/** remat·패리티·운영 수집: evCd URL 우선, 항공 불완전 시 goodsCd seed. */
export async function parseYbtourRegisterCollectWithSeedFallback(
  originUrl: string,
  originCode?: string | null,
) {
  const opts = { originUrl, forPreview: false as const }
  const primary = resolveYbtourRegisterCollectUrl(originUrl, originCode ?? null)
  const skeleton = await parseYbtourRegisterFromApi('', 'ybtour', { ...opts, originUrl: primary })
  let parsed = await augmentYbtourParsedWithDetailCollect(skeleton, { originUrl: primary })
  const primaryScore = flightStructuredScore(parsed?.detailBodyStructured?.flightStructured)
  if (primaryScore >= 7) return parsed

  const goodsOnly = resolveYbtourGoodsCdOnlyCollectUrl(originUrl, originCode ?? null)
  if (!goodsOnly || goodsOnly === primary) return parsed

  try {
    const sk2 = await parseYbtourRegisterFromApi('', 'ybtour', { ...opts, originUrl: goodsOnly })
    const p2 = await augmentYbtourParsedWithDetailCollect(sk2, { originUrl: goodsOnly })
    if (flightStructuredScore(p2?.detailBodyStructured?.flightStructured) > primaryScore) return p2
  } catch {
    /* keep primary */
  }
  return parsed
}
