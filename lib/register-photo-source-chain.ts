/**
 * 사진 자동 채움 출처 순서 (사장님 10/31): Pexels → Unsplash/CC0(출처 표시 의무 없음) → AI(호출부, AI 표시 필수).
 * - Pexels: 기존처럼 풀에 저장(재호스팅)해서 쓴다.
 * - Unsplash: 가이드라인대로 핫링크(재호스팅 안 함) + 고를 때 download_location 호출 + 작가·프로필 기록.
 * - CC0: 연결된 CC0 검색 제공자가 없다 → 지어내지 않고 건너뛴다(tried 에 'cc0:no-provider').
 * - 신규 iStock·CC BY 는 후보로 만들지 않는다(두 검색 모두 해당 없음).
 * process-images 의 'photoChain v2' 경로에서만 쓴다. 기본 경로(관리자 수동 실행)는 그대로.
 * REGRESSION-FREEZE[register-photo-source-chain]: Pexels → Unsplash → (CC0 없음) → AI 순서, v2 에서만 — manifest
 */
import { searchPexelsHeroCandidates, type PexelsHeroCandidateMeta } from '@/lib/pexels-service'
import {
  searchUnsplashHeroCandidates,
  triggerUnsplashDownload,
  type UnsplashHeroCandidate,
} from '@/lib/unsplash-service'
import { IMAGE_MIN_WIDTH } from '@/lib/product-image-source-policy'

export const PHOTO_CHAIN_STOCK_ORDER = ['pexels', 'unsplash', 'cc0'] as const
export type PhotoChainStockTier = (typeof PHOTO_CHAIN_STOCK_ORDER)[number]

/** Unsplash 핫링크 가로폭 — 1200px 이상을 지키면서 상세 400,000B 안쪽을 노린다 */
export const PHOTO_CHAIN_UNSPLASH_WIDTH = 1600
export const PHOTO_CHAIN_UNSPLASH_QUALITY = 72

export type ChainCandidate = {
  tier: 'pexels' | 'unsplash'
  url: string
  source: 'Pexels' | 'Unsplash'
  photographer: string
  /** Pexels: 사진 페이지 / Unsplash: 작가 프로필(크레딧) */
  originalLink: string
  externalId: string
  width: number
  height: number
  altText?: string
  /** 위치 메타 비교용 페이지 주소(Pexels slug) */
  pageUrl?: string | null
  downloadLocation?: string
  queryUsed: string
}

export type ChainDeps = {
  env?: Record<string, string | undefined>
  searchPexels?: (q: string, n: number, used: string) => Promise<PexelsHeroCandidateMeta[]>
  searchUnsplash?: (q: string, n: number, used: string) => Promise<UnsplashHeroCandidate[]>
  triggerDownload?: (downloadLocation: string) => Promise<unknown>
}

/** v2 경로 켜짐: 요청 본문 photoChain:'v2'(자동 채움 작업이 보냄) 또는 BONGTOUR_PHOTO_SOURCE_CHAIN=1. 기본 꺼짐. */
export function isPhotoChainV2Enabled(
  body: unknown,
  env: Record<string, string | undefined> = process.env
): boolean {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  return b.photoChain === 'v2' || String(env.BONGTOUR_PHOTO_SOURCE_CHAIN ?? '').trim() === '1'
}

export function unsplashSizedHotlink(url: string, width = PHOTO_CHAIN_UNSPLASH_WIDTH): string {
  try {
    const u = new URL(url)
    u.searchParams.set('w', String(width))
    u.searchParams.set('q', String(PHOTO_CHAIN_UNSPLASH_QUALITY))
    u.searchParams.set('fm', 'jpg')
    u.searchParams.set('fit', 'max')
    return u.toString()
  } catch {
    return url
  }
}

function fromPexels(p: PexelsHeroCandidateMeta): ChainCandidate {
  return {
    tier: 'pexels',
    url: p.imageUrl,
    source: 'Pexels',
    photographer: p.photographer,
    originalLink: p.originalLink,
    externalId: String(p.pexelsId),
    width: p.width,
    height: p.height,
    altText: p.altText,
    pageUrl: p.originalLink,
    queryUsed: p.queryUsed,
  }
}

function fromUnsplash(u: UnsplashHeroCandidate): ChainCandidate | null {
  // 크레딧(작가 이름·프로필) 없는 후보는 정책(L1-UNSPLASH-NO-CREDIT) 탈락 → 아예 만들지 않음
  if (!u.authorName || !u.authorProfileUrl) return null
  const w = u.width > 0 ? Math.min(u.width, PHOTO_CHAIN_UNSPLASH_WIDTH) : 0
  const h = u.width > 0 ? Math.round((u.height * w) / u.width) : 0
  return {
    tier: 'unsplash',
    url: unsplashSizedHotlink(u.imageUrl, w || PHOTO_CHAIN_UNSPLASH_WIDTH),
    source: 'Unsplash',
    photographer: u.authorName,
    originalLink: u.authorProfileUrl,
    externalId: u.unsplashId,
    width: w,
    height: h,
    altText: u.altText,
    pageUrl: null,
    downloadLocation: u.downloadLocation,
    queryUsed: u.queryUsed,
  }
}

export async function collectChainCandidates(
  query: string,
  tier: 'pexels' | 'unsplash',
  deps: ChainDeps = {}
): Promise<ChainCandidate[]> {
  const q = query.trim()
  if (!q) return []
  if (tier === 'pexels') {
    const search = deps.searchPexels ?? searchPexelsHeroCandidates
    return (await search(q, 10, q)).map(fromPexels)
  }
  const search =
    deps.searchUnsplash ?? ((k: string, n: number, used: string) => searchUnsplashHeroCandidates(k, n, used, { env: deps.env }))
  return (await search(q, 10, q)).map(fromUnsplash).filter((x): x is ChainCandidate => x != null)
}

export type ChainPick = (cands: ChainCandidate[]) => ChainCandidate | null

/** 기본 고르기: 받은 순서의 첫 후보 */
export const pickFirstCandidate: ChainPick = (cands) => cands[0] ?? null

export type ChainResult = { photo: ChainCandidate | null; tried: string[] }

/**
 * 출처 순서대로 찾는다. 한 출처에서 하나라도 통과하면 다음 출처는 보지 않는다.
 * 통과 조건: 가로 1200px 이상 + accept(같은 상품 안 중복 아님 등).
 * 아무것도 없으면 photo=null — 호출부가 AI 생성(표시 필수) 또는 '사진 필요'로 둔다.
 */
export async function findStockPhotoByChain(
  query: string,
  opts: { accept: (c: ChainCandidate) => boolean; pick?: ChainPick; deps?: ChainDeps }
): Promise<ChainResult> {
  const tried: string[] = []
  const pick = opts.pick ?? pickFirstCandidate
  for (const tier of PHOTO_CHAIN_STOCK_ORDER) {
    if (tier === 'cc0') {
      tried.push('cc0:no-provider')
      continue
    }
    const cands = await collectChainCandidates(query, tier, opts.deps)
    const ok = cands.filter((c) => c.width >= IMAGE_MIN_WIDTH && opts.accept(c))
    tried.push(`${tier}:${cands.length}/${ok.length}`)
    const chosen = ok.length ? pick(ok) : null
    if (!chosen) continue
    if (chosen.tier === 'unsplash' && chosen.downloadLocation) {
      const trig = opts.deps?.triggerDownload ?? ((d: string) => triggerUnsplashDownload(d, { env: opts.deps?.env }))
      await trig(chosen.downloadLocation)
    }
    return { photo: chosen, tried }
  }
  return { photo: null, tried }
}
