/**
 * photo-autofill-acquire 의 실제 외부 연결(Pexels·Unsplash 검색, NCLOUD 사진 풀 업로드, 저장본 측정).
 * Pexels 는 호출 사이 3.5초·403/429 멈춤(sharedPexelsCallGuard), Unsplash 는 시간당 예산·멈춤(sharedUnsplashCallBudget)을 그대로 쓴다.
 * 공급사별 설정이 아니라 사진 재고 출처 전용이다. 키·응답 본문은 기록하지 않는다.
 */
import type { PrismaClient } from '@prisma/client'
import { collectChainCandidates, type ChainCandidate } from '@/lib/register-photo-source-chain'
import { triggerUnsplashDownload } from '@/lib/unsplash-service'
import { sharedPexelsCallGuard, sharedUnsplashCallBudget } from '@/lib/register-photo-stock-rate-guard'
import { savePhotoFromUrl } from '@/lib/photo-pool'
import type { AcquireDeps, StockTier } from '@/lib/photo-autofill-acquire'
import type { AutofillCandidate } from '@/lib/photo-autofill-gate'

/** 외부 호출 전 간격(사람처럼). Pexels 3.5초 가드 위에 얹는 지터다. */
export const AUTOFILL_PAUSE_BASE_MS = 400
export const AUTOFILL_PAUSE_JITTER_MS = 1200

export function chainToAutofillCandidate(c: ChainCandidate): AutofillCandidate {
  return {
    id: c.externalId,
    source: c.source,
    url: c.url,
    width: c.width,
    height: c.height,
    photographer: c.photographer,
    originalLink: c.originalLink,
    altText: c.altText ?? null,
    description: c.description ?? null,
    tags: c.tags ?? null,
    pageUrl: c.pageUrl ?? null,
    downloadLocation: c.downloadLocation ?? null,
  }
}

export type LiveDepsOptions = {
  prisma: PrismaClient
  destination: string
  probe: (url: string) => Promise<{ bytes: number | null; width: number | null }>
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

export function createLiveAcquireDeps(opts: LiveDepsOptions): AcquireDeps {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const random = opts.random ?? Math.random
  return {
    search: async (tier: StockTier, query: string) => (await collectChainCandidates(query, tier)).map(chainToAutofillCandidate),
    stockStopped: (tier: StockTier) => {
      if (tier === 'pexels') return sharedPexelsCallGuard().isStopped()
      const b = sharedUnsplashCallBudget()
      return b.isStopped() || b.remaining() <= 0
    },
    pause: () => sleep(AUTOFILL_PAUSE_BASE_MS + Math.floor(random() * AUTOFILL_PAUSE_JITTER_MS)),
    commit: async (c, ctx) => {
      if (c.source === 'Unsplash') {
        if (!c.downloadLocation) return { ok: false, reason: 'unsplash_no_download_location' }
        const fired = await triggerUnsplashDownload(c.downloadLocation)
        if (fired === false) return { ok: false, reason: 'unsplash_download_failed' }
        const m = await opts.probe(c.url)
        return {
          ok: true,
          url: c.url,
          bytes: m.bytes,
          width: m.width ?? c.width,
          source: 'Unsplash',
          photographer: String(c.photographer ?? ''),
          originalLink: String(c.originalLink ?? ''),
          externalId: c.id,
        }
      }
      const saved = await savePhotoFromUrl(opts.prisma, c.url, opts.destination, ctx.label, 'Pexels', {
        photographer: c.photographer ?? undefined,
        sourceUrl: c.originalLink ?? undefined,
        sourcePhotoId: c.id,
      })
      if (!saved?.filePath) return { ok: false, reason: 'pool_save_failed' }
      const m = await opts.probe(saved.filePath)
      return {
        ok: true,
        url: saved.filePath,
        bytes: m.bytes,
        width: m.width,
        source: 'Pexels',
        photographer: String(c.photographer ?? ''),
        originalLink: String(c.originalLink ?? ''),
        externalId: c.id,
      }
    },
  }
}
