/**
 * photo-autofill-acquire 의 실제 외부 연결(Pexels·Unsplash 검색, NCLOUD 사진 풀 업로드, 저장본 측정).
 * Pexels 는 호출 사이 3.5초·403/429 멈춤(sharedPexelsCallGuard), Unsplash 는 시간당 예산·멈춤(sharedUnsplashCallBudget)을 그대로 쓴다.
 * 공급사별 설정이 아니라 사진 재고 출처 전용이다. 키·응답 본문은 기록하지 않는다.
 */
import type { PrismaClient } from '@prisma/client'
import { collectChainCandidates, type ChainCandidate } from '@/lib/register-photo-source-chain'
import { triggerUnsplashDownload } from '@/lib/unsplash-service'
import { sharedPexelsCallGuard, sharedUnsplashCallBudget } from '@/lib/register-photo-stock-rate-guard'
import { findPhotoPoolByPlaceName, savePhotoFromUrl, savePhotoToPool } from '@/lib/photo-pool'
import { parseImageDimensions, probeImageDimensions } from '@/lib/image-dimension-probe'
import { searchWikimediaCc0 } from '@/lib/photo-autofill-cc0'
import { generateImageWithGemini } from '@/lib/gemini-image-generate'
import { buildRegisterDayAiPhotoPrompt } from '@/lib/register-day-ai-photo-prompt'
import type { AcquireDeps, StockTier } from '@/lib/photo-autofill-acquire'
import { AUTOFILL_COVER_MAX_BYTES, AUTOFILL_DAY_MAX_BYTES, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { claimThumbnailTopUpSlot, thumbnailPoolFetchCount, topUpThumbnailPlacePool } from '@/lib/thumbnail-pool-topup'
import { isExistingIstockImage } from '@/lib/product-image-source-policy'
import { isSupplierPhotoUrl } from '@/lib/thumbnail-pick'
import { isMonochromeImageBuffer, isMonochromePhotoUrl } from '@/lib/register-photo-monochrome'

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
      // Unsplash+·프리미엄·스폰서는 searchUnsplashHeroCandidates 가 후보에서 이미 뺀다
      const b = sharedUnsplashCallBudget()
      return b.isStopped() || b.remaining() <= 0
    },
    searchCc0: (query, perPage) => searchWikimediaCc0(query, perPage),
    pause: () => sleep(AUTOFILL_PAUSE_BASE_MS + Math.floor(random() * AUTOFILL_PAUSE_JITTER_MS)),
    lookupPool: async (sight) => {
      if (typeof opts.prisma?.photoPool?.findMany !== 'function') return []
      const loadRows = () => findPhotoPoolByPlaceName(opts.prisma, sight, 20)
      let rows = await loadRows()
      if (rows.length < 10 && thumbnailPoolFetchCount(rows.length) > 0 && claimThumbnailTopUpSlot()) {
        await topUpThumbnailPlacePool({
          have: rows.length,
          pause: () => sleep(AUTOFILL_PAUSE_BASE_MS + Math.floor(random() * AUTOFILL_PAUSE_JITTER_MS)),
          search: async (tier) => (await collectChainCandidates(sight, tier)).map(chainToAutofillCandidate),
          searchCc0: async () => searchWikimediaCc0(sight, 15),
          save: async (c) => {
            if (isSupplierPhotoUrl(c.url) || isSupplierPhotoUrl(c.originalLink)) return false
            if (await isMonochromePhotoUrl(c.url)) return false
            const saved = await savePhotoFromUrl(
              opts.prisma,
              c.url,
              opts.destination || sight,
              sight,
              c.source || 'Pexels',
              { photographer: c.photographer, sourceUrl: c.originalLink, sourcePhotoId: c.id },
              AUTOFILL_COVER_MAX_BYTES,
            )
            return !!saved
          },
        }).catch(() => ({ added: 0, skipped: ['topup'] }))
        rows = await loadRows()
      }
      const out: AutofillCandidate[] = []
      for (const row of rows) {
        const url = String(row.filePath ?? '').trim()
        if (!url || isSupplierPhotoUrl(url) || isSupplierPhotoUrl(row.sourceUrl)) continue
        if (/istock/i.test(String(row.source ?? '')) && !isExistingIstockImage(url)) continue
        await sleep(AUTOFILL_PAUSE_BASE_MS + Math.floor(random() * AUTOFILL_PAUSE_JITTER_MS))
        const dim = await probeImageDimensions(url).catch(() => null)
        const sized = await opts.probe(url)
        out.push({
          id: String(row.sourcePhotoId || row.id),
          source: 'PhotoPool',
          url,
          width: dim?.width ?? sized.width ?? 0,
          height: dim?.height ?? 0,
          photographer: row.photographer,
          originalLink: row.sourceUrl,
          altText: [row.attractionName, row.cityName].filter(Boolean).join(' '),
          title: row.attractionName,
          storedBytes: sized.bytes,
        })
      }
      return out
    },
    isMonochrome: async (c) =>
      c.generatedBuffer ? isMonochromeImageBuffer(Buffer.from(c.generatedBuffer)) : /^https?:\/\//i.test(c.url) ? isMonochromePhotoUrl(c.url) : false,
    generate: async ({ sight, cityTerms }) => {
      const prompt = buildRegisterDayAiPhotoPrompt({ keyword: sight, destination: cityTerms[0] ?? opts.destination })
      if (!prompt) return null
      const buf = await generateImageWithGemini({ prompt, aspectRatio: '16:9', stylePreset: 'single_landmark' })
      if (!buf) return null
      const dim = parseImageDimensions(new Uint8Array(buf))
      return {
        id: `ai-${sight}`.slice(0, 80),
        source: 'AI 생성',
        url: 'ai-generated://pending',
        width: dim?.width ?? 0,
        height: dim?.height ?? 0,
        photographer: 'AI 생성',
        originalLink: 'ai-generated',
        altText: `${sight} ${cityTerms.join(' ')}`.trim(),
        title: sight,
        description: prompt,
        storedBytes: buf.length,
        generatedBuffer: buf,
      }
    },
    commit: async (c, ctx) => {
      const maxBytes = ctx.kind === 'cover' ? AUTOFILL_COVER_MAX_BYTES : AUTOFILL_DAY_MAX_BYTES
      if (c.source === 'AI 생성') {
        if (!c.generatedBuffer) return { ok: false, reason: 'generate_no_buffer' }
        const saved = await savePhotoToPool(opts.prisma, c.generatedBuffer, opts.destination || ctx.label, ctx.label, 'AI 생성', {
          filenamePrefix: 'ai-generated',
          maxBytes,
        })
        if (!saved?.filePath) return { ok: false, reason: 'pool_save_failed' }
        const m = await opts.probe(saved.filePath)
        return {
          ok: true,
          url: saved.filePath,
          bytes: m.bytes,
          width: m.width,
          source: 'AI 생성',
          photographer: 'AI 생성',
          originalLink: saved.filePath,
          externalId: c.id,
        }
      }
      if (c.source === 'CC0') {
        const saved = await savePhotoFromUrl(opts.prisma, c.url, opts.destination || ctx.label, ctx.label, 'CC0', {
          photographer: c.photographer ?? undefined,
          sourceUrl: c.originalLink ?? undefined,
          sourcePhotoId: c.id,
        }, maxBytes)
        if (!saved?.filePath) return { ok: false, reason: 'pool_save_failed' }
        const m = await opts.probe(saved.filePath)
        return {
          ok: true,
          url: saved.filePath,
          bytes: m.bytes,
          width: m.width,
          source: 'CC0',
          photographer: String(c.photographer ?? ''),
          originalLink: String(c.originalLink ?? ''),
          externalId: c.id,
        }
      }
      if (c.source === 'PhotoPool') {
        if (c.storedBytes != null && c.storedBytes > maxBytes) {
          const saved = await savePhotoFromUrl(opts.prisma, c.url, opts.destination || ctx.label, ctx.label, 'PhotoPool', {
            photographer: c.photographer ?? undefined,
            sourceUrl: c.originalLink ?? undefined,
            sourcePhotoId: c.id,
          }, maxBytes)
          if (!saved?.filePath) return { ok: false, reason: '사진이 기준 용량 이하로 줄지 않아 저장하지 않습니다.' }
          const m = await opts.probe(saved.filePath)
          return {
            ok: true,
            url: saved.filePath,
            bytes: m.bytes,
            width: m.width,
            source: 'PhotoPool',
            photographer: String(c.photographer ?? ''),
            originalLink: String(c.originalLink ?? ''),
            externalId: c.id,
          }
        }
        return {
          ok: true,
          url: c.url,
          bytes: c.storedBytes ?? null,
          width: c.width || null,
          source: 'PhotoPool',
          photographer: String(c.photographer ?? ''),
          originalLink: String(c.originalLink ?? ''),
          externalId: c.id,
        }
      }
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
      }, maxBytes)
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
