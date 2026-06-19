/**
 * modetour 상품코드(originCode) → 현행 단체번호(productNo) 해석.
 * SSOT: `https://www.modetour.com/package/{originCode}` → `/package/{digits}` 리다이렉트.
 *
 * REGRESSION-FREEZE[modetour-sweep-e2e-recheck]: 상품코드 우선 resolve — manifest
 */
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'

const MODETOUR_WEB_BASE = process.env.MODETOUR_BASE_URL ?? 'https://www.modetour.com'

const PACKAGE_PRODUCT_NO_RE = /\/package\/(\d+)(?:\?|$|\/)/i

export type ModetourOriginCodeResolveResult = {
  originCode: string
  productNo: string | null
  detailUrl: string | null
  source: 'origin-code-redirect' | 'stored-origin-url' | 'unresolved'
}

export function buildModetourPackageUrlFromOriginCode(originCode: string): string {
  const code = (originCode ?? '').trim()
  return `${MODETOUR_WEB_BASE.replace(/\/$/, '')}/package/${encodeURIComponent(code)}`
}

export function extractModetourProductNoFromPackageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const direct = parseModetourPackageProductNoFromUrl(url)
  if (direct) return direct
  const m = url.trim().match(PACKAGE_PRODUCT_NO_RE)
  const no = m?.[1] ?? null
  if (!no || no === '0') return null
  return no
}

async function fetchProductNoViaRedirect(
  seedUrl: string,
  timeoutMs: number,
): Promise<{ productNo: string | null; finalUrl: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = seedUrl
    for (let hop = 0; hop < 6; hop += 1) {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'ko-KR,ko;q=0.9',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        },
      })

      const fromUrl = extractModetourProductNoFromPackageUrl(url)
      if (fromUrl && res.status >= 200 && res.status < 300) {
        return { productNo: fromUrl, finalUrl: url }
      }

      const location = res.headers.get('location')
      if (location && res.status >= 300 && res.status < 400) {
        url = new URL(location, url).toString()
        const redirectedNo = extractModetourProductNoFromPackageUrl(url)
        if (redirectedNo) {
          return { productNo: redirectedNo, finalUrl: url }
        }
        continue
      }

      const finalNo = extractModetourProductNoFromPackageUrl(url)
      return { productNo: finalNo, finalUrl: finalNo ? url : null }
    }
    return { productNo: null, finalUrl: null }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 상품코드로 modetour 현행 상세 URL·단체번호를 해석한다.
 * 네트워크 실패 시 `storedOriginUrl`의 숫자 패키지 URL로 폴백.
 */
export async function resolveModetourDetailByOriginCode(
  originCode: string | null | undefined,
  options?: { storedOriginUrl?: string | null; timeoutMs?: number },
): Promise<ModetourOriginCodeResolveResult> {
  const code = (originCode ?? '').trim()
  if (!code) {
    const storedNo = extractModetourProductNoFromPackageUrl(options?.storedOriginUrl)
    const detailUrl = storedNo
      ? `${MODETOUR_WEB_BASE.replace(/\/$/, '')}/package/${storedNo}`
      : options?.storedOriginUrl?.trim() || null
    return {
      originCode: '',
      productNo: storedNo,
      detailUrl,
      source: storedNo ? 'stored-origin-url' : 'unresolved',
    }
  }

  const timeoutMs = Math.max(3_000, Math.min(45_000, options?.timeoutMs ?? 20_000))
  try {
    const seedUrl = buildModetourPackageUrlFromOriginCode(code)
    const resolved = await fetchProductNoViaRedirect(seedUrl, timeoutMs)
    if (resolved.productNo && resolved.productNo !== '0') {
      const detailUrl =
        resolved.finalUrl?.trim() ||
        `${MODETOUR_WEB_BASE.replace(/\/$/, '')}/package/${resolved.productNo}`
      return {
        originCode: code,
        productNo: resolved.productNo,
        detailUrl,
        source: 'origin-code-redirect',
      }
    }
  } catch {
    // fall through to stored URL
  }

  const storedNo = extractModetourProductNoFromPackageUrl(options?.storedOriginUrl)
  if (storedNo) {
    return {
      originCode: code,
      productNo: storedNo,
      detailUrl: `${MODETOUR_WEB_BASE.replace(/\/$/, '')}/package/${storedNo}`,
      source: 'stored-origin-url',
    }
  }

  return {
    originCode: code,
    productNo: null,
    detailUrl: buildModetourPackageUrlFromOriginCode(code),
    source: 'unresolved',
  }
}
