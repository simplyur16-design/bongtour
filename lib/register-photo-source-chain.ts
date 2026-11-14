/**
 * 사진 자동 채움의 소싱 순서는 photo-autofill-acquire: 풀 → Pexels → Unsplash 무료 → CC0(Wikimedia) → 생성.
 * 이 파일의 findStockPhotoByChain 은 process-images v2 의 스톡 검색만 한다.
 * - Pexels, 그다음 Unsplash 무료. Unsplash 는 핫링크(재호스팅 안 함)이고, 고를 때 download_location 을 부르며 작가·프로필을 남긴다.
 * - 이 함수의 cc0 칸은 검색하지 않고 tried 에 'cc0:no-provider' 만 남긴다. Wikimedia CC0 검색은 photo-autofill-cc0 가 획득 경로에서 한다.
 * - 신규 iStock·CC BY 는 후보로 만들지 않는다.
 * 기본 경로(관리자 수동 실행)는 이 체인을 쓰지 않는다.
 * REGRESSION-FREEZE[register-photo-source-chain]: v2 스톡 검색은 Pexels → Unsplash 무료, 이 함수의 cc0 칸은 건너뜀 — manifest
 */
import { searchPexelsHeroCandidates, type PexelsHeroCandidateMeta } from '@/lib/pexels-service'
import {
  searchUnsplashHeroCandidates,
  triggerUnsplashDownload,
  type UnsplashHeroCandidate,
} from '@/lib/unsplash-service'
import { IMAGE_MIN_WIDTH } from '@/lib/product-image-source-policy'
import { altSaysMonochrome, isMonochromePhotoUrl } from '@/lib/register-photo-monochrome'

export const PHOTO_CHAIN_STOCK_ORDER = ['pexels', 'unsplash', 'cc0'] as const
export type PhotoChainStockTier = (typeof PHOTO_CHAIN_STOCK_ORDER)[number]

/** Unsplash 핫링크 가로폭 — 1200px 이상을 지키면서 상세 400,000B 안쪽을 노린다 */
export const PHOTO_CHAIN_UNSPLASH_WIDTH = 1600
export const PHOTO_CHAIN_UNSPLASH_QUALITY = 72
/** Pexels 검색 1회 후보 수 — searchPexelsHeroCandidates 상한 15 */
export const PHOTO_CHAIN_PEXELS_PER_QUERY = 15

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
  description?: string
  tags?: string[]
  /** 위치 메타 비교용 페이지 주소(Pexels slug) */
  pageUrl?: string | null
  downloadLocation?: string
  queryUsed: string
  /** 평균색 힌트(#rrggbb) */
  avgColor?: string | null
}

/**
 * 사장님 11/01 검수: 로고·워터마크·글자 얹은 사진 금지, 대표사진 흑백 금지(일차 칸 흑백은 허용).
 * 후보 설명(alt)으로 먼저 거른다 — 대표사진 흑백은 고른 뒤 미리보기 화소로 한 번 더 본다(findStockPhotoByChain verify).
 */
const TEXT_OVERLAY_RE = /\b(watermark|watermarked|typography|lettering|text overlay|overlay text|quote|quotes|motivational|logo|logos|caption|captions|meme|mockup|template)\b/i
export function chainCandidateTextBlockReason(c: Pick<ChainCandidate, 'altText'>, slot: 'main' | 'day'): string | null {
  const alt = String(c.altText ?? '')
  if (TEXT_OVERLAY_RE.test(alt)) return 'text_or_logo'
  if (slot === 'main' && altSaysMonochrome(alt)) return 'main_monochrome'
  return null
}

/** 대표사진 흑백 확인(미리보기 화소). 받기 실패는 통과. */
export async function chainMainNotMonochrome(c: Pick<ChainCandidate, 'url'>): Promise<boolean> {
  return !(await isMonochromePhotoUrl(c.url))
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
    avgColor: p.avgColor ?? null,
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
    ...(u.description ? { description: u.description } : {}),
    ...(u.tags ? { tags: u.tags } : {}),
    pageUrl: null,
    downloadLocation: u.downloadLocation,
    queryUsed: u.queryUsed,
    avgColor: u.avgColor ?? null,
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
    // 장소 일치 관문(register-photo-match-gate)이 엄격해져 한 번에 받을 수 있는 최대(15장)를 본다
    return (await search(q, PHOTO_CHAIN_PEXELS_PER_QUERY, q)).map(fromPexels)
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
 * v2 스톡 검색. Pexels 다음 Unsplash 무료. 한 출처에서 통과하면 다음 출처는 보지 않는다.
 * 풀 재사용·Wikimedia CC0·생성은 여기 없고, 획득 경로 순서(풀 → Pexels → Unsplash 무료 → CC0 → 생성)는 photo-autofill-acquire 다.
 * 통과 조건: 가로 1200px 이상 + accept(같은 상품 안 중복 아님 등).
 * 아무것도 없으면 photo=null — v2 호출부가 생성(표시 필수) 또는 '사진 필요'로 둔다.
 */
export async function findStockPhotoByChain(
  query: string,
  opts: {
    accept: (c: ChainCandidate) => boolean
    pick?: ChainPick
    deps?: ChainDeps
    /** 'main' 이면 흑백 금지. 기본 'day' */
    slot?: 'main' | 'day'
    /** 고른 뒤 비동기 확인(대표사진 흑백 화소 검사 등). false 면 다음 후보 */
    verify?: (c: ChainCandidate) => Promise<boolean>
  }
): Promise<ChainResult> {
  const tried: string[] = []
  const pick = opts.pick ?? pickFirstCandidate
  const slot = opts.slot ?? 'day'
  for (const tier of PHOTO_CHAIN_STOCK_ORDER) {
    if (tier === 'cc0') {
      tried.push('cc0:no-provider')
      continue
    }
    const cands = await collectChainCandidates(query, tier, opts.deps)
    let ok = cands.filter((c) => c.width >= IMAGE_MIN_WIDTH && !chainCandidateTextBlockReason(c, slot) && opts.accept(c))
    tried.push(`${tier}:${cands.length}/${ok.length}`)
    // 고른 사진이 확인(흑백 등)·download_location 에 걸리면 같은 출처의 다음 후보(최대 4번)
    for (let attempt = 0; attempt < 4 && ok.length > 0; attempt++) {
      const chosen = pick(ok)
      if (!chosen) break
      if (opts.verify && !(await opts.verify(chosen))) {
        tried.push(`${tier}:verify-reject`)
        ok = ok.filter((x) => x !== chosen)
        continue
      }
      if (chosen.tier === 'unsplash') {
        // 가이드라인: 쓰는 사진마다 download_location — 못 부르면(예산·멈춤·실패) 그 사진은 쓰지 않는다
        if (!chosen.downloadLocation) {
          ok = ok.filter((x) => x !== chosen)
          continue
        }
        const trig = opts.deps?.triggerDownload ?? ((d: string) => triggerUnsplashDownload(d, { env: opts.deps?.env }))
        const fired = await trig(chosen.downloadLocation)
        if (fired === false) {
          tried.push('unsplash:download-location-failed')
          break
        }
      }
      return { photo: chosen, tried }
    }
  }
  return { photo: null, tried }
}
