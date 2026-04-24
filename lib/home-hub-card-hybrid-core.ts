/**
 * 메인 허브 카드 하이브리드 이미지 — fs 없음(클라이언트·서버 공통).
 * 파일 읽기는 `lib/home-hub-resolve-images` 에서 스냅샷을 넘겨 호출한다.
 */

import { homeHubCardImageSrc, type HomeHubCardImageKey } from '@/lib/home-hub-images'

export type HomeHubCardImageSourceMode = 'manual' | 'product_pool'

export type HomeHubCardHybridActiveSlice = {
  images?: Partial<Record<HomeHubCardImageKey, string>>
  imageSourceModes?: Partial<Record<HomeHubCardImageKey, HomeHubCardImageSourceMode>>
}

/** 관리자 JSON `images.*` · `trainingPageSecondaryImage` 등에 허용하는 공개 이미지 URL 형태 */
export function isHomeHubPublicManualImageUrl(s: string): boolean {
  const t = s.trim()
  return (
    t.length > 0 &&
    (t.startsWith('/') || t.startsWith('https://') || t.startsWith('http://'))
  )
}

/** 메인 허브: Supabase Storage 원격 URL은 Railway 동일 오리진 정적 자산으로 치환 */
function rewriteSupabaseHubImageToFallback(url: string, key: HomeHubCardImageKey): string {
  const t = url.trim()
  if (!t.startsWith('http')) return t
  try {
    const u = new URL(t)
    if (u.hostname.endsWith('.supabase.co') && u.pathname.includes('/storage/')) {
      return homeHubCardImageSrc(key, 'webp')
    }
  } catch {
    return t
  }
  return t
}

/** `home-hub-active.json` 의 `images[key]` 가 유효 공개 URL이면 수동 지정 */
export function manualImageUrlFromHybridActive(
  cfg: HomeHubCardHybridActiveSlice | null,
  key: HomeHubCardImageKey,
): string | null {
  if (!cfg?.images) return null
  const raw = cfg.images[key]?.trim()
  if (!raw || !isHomeHubPublicManualImageUrl(raw)) return null
  return raw
}

export function effectiveHomeHubCardImageSourceMode(
  key: HomeHubCardImageKey,
  cfg: HomeHubCardHybridActiveSlice | null,
): HomeHubCardImageSourceMode {
  const fromFile = cfg?.imageSourceModes?.[key]
  if (fromFile === 'manual' || fromFile === 'product_pool') return fromFile
  if (key === 'overseas' || key === 'domestic') return 'product_pool'
  return 'manual'
}

export type ResolveHomeHubCardHybridFromSnapshotInput = {
  activeSnapshot: HomeHubCardHybridActiveSlice | null
  productPoolOverseasUrl?: string | null
  productPoolDomesticUrl?: string | null
}

export function resolveHomeHubCardHybridImageFromSnapshot(
  key: HomeHubCardImageKey,
  input: ResolveHomeHubCardHybridFromSnapshotInput,
): string {
  const cfg = input.activeSnapshot
  const manual = manualImageUrlFromHybridActive(cfg, key)
  if (manual) return rewriteSupabaseHubImageToFallback(manual, key)

  const mode = effectiveHomeHubCardImageSourceMode(key, cfg)
  if (mode === 'product_pool') {
    if (key === 'overseas') {
      const u = (input.productPoolOverseasUrl ?? '').trim()
      if (u) return rewriteSupabaseHubImageToFallback(u, key)
    }
    if (key === 'domestic') {
      const u = (input.productPoolDomesticUrl ?? '').trim()
      if (u) return rewriteSupabaseHubImageToFallback(u, key)
    }
  }

  return homeHubCardImageSrc(key)
}

export type HomeHubCardHybridResolutionTier = 'manual' | 'product_pool' | 'fallback'

export type HomeHubCardHybridResolutionDetail = {
  url: string
  tier: HomeHubCardHybridResolutionTier
  effectiveMode: HomeHubCardImageSourceMode
  manualUrl: string | null
  /** 해외/국내에 넘긴 풀 URL(없으면 null) */
  poolInputUrl: string | null
  /** 운영자용 한 줄 설명 */
  explanationShort: string
}

export function getHomeHubCardHybridResolutionDetail(
  key: HomeHubCardImageKey,
  input: ResolveHomeHubCardHybridFromSnapshotInput,
): HomeHubCardHybridResolutionDetail {
  const cfg = input.activeSnapshot
  const manualUrl = manualImageUrlFromHybridActive(cfg, key)
  const mode = effectiveHomeHubCardImageSourceMode(key, cfg)
  const poolOver = (input.productPoolOverseasUrl ?? '').trim() || null
  const poolDom = (input.productPoolDomesticUrl ?? '').trim() || null
  const poolInputUrl = key === 'overseas' ? poolOver : key === 'domestic' ? poolDom : null

  if (manualUrl) {
    return {
      url: rewriteSupabaseHubImageToFallback(manualUrl, key),
      tier: 'manual',
      effectiveMode: mode,
      manualUrl,
      poolInputUrl,
      explanationShort:
        key === 'overseas' || key === 'domestic'
          ? '수동 이미지가 우선 적용 중입니다. 자동 상품 풀은 이 카드에서 비활성입니다.'
          : '수동 이미지(JSON)가 적용 중입니다.',
    }
  }

  if (mode === 'product_pool' && (key === 'overseas' || key === 'domestic')) {
    const u = key === 'overseas' ? poolOver : poolDom
    if (u) {
      return {
        url: rewriteSupabaseHubImageToFallback(u, key),
        tier: 'product_pool',
        effectiveMode: mode,
        manualUrl: null,
        poolInputUrl: u,
        explanationShort:
          '현재 등록 상품 대표이미지 자동 사용 중입니다. (메인은 방문·새로고침마다 다시 뽑힐 수 있음)',
      }
    }
    return {
      url: homeHubCardImageSrc(key),
      tier: 'fallback',
      effectiveMode: mode,
      manualUrl: null,
      poolInputUrl: null,
      explanationShort:
        '상품 풀에 사용 가능한 커버 URL이 없어 정적 기본 이미지로 폴백합니다. 등록 상품·이미지를 확인하세요.',
    }
  }

  return {
    url: homeHubCardImageSrc(key),
    tier: 'fallback',
    effectiveMode: mode,
    manualUrl: null,
    poolInputUrl: null,
    explanationShort:
      mode === 'manual' && (key === 'training' || key === 'bus')
        ? '수동 URL이 비어 있어 정적 기본 이미지입니다. 후보 활성화 또는 URL을 입력하세요.'
        : '정적 기본 이미지입니다.',
  }
}
