/**
 * photo-autofill-acquire 의 실제 외부 연결(Pexels·Unsplash 검색, NCLOUD 사진 풀 업로드, 저장본 측정).
 * Pexels 는 호출 사이 3.5초·403/429 멈춤(sharedPexelsCallGuard), Unsplash 는 시간당 예산·멈춤(sharedUnsplashCallBudget)을 그대로 쓴다.
 * 공급사별 설정이 아니라 사진 재고 출처 전용이다. 키·응답 본문은 기록하지 않는다.
 */
import type { PrismaClient } from '@prisma/client'
import { collectChainCandidates, type ChainCandidate } from '@/lib/register-photo-source-chain'
import { triggerUnsplashDownload } from '@/lib/unsplash-service'
import { sharedPexelsCallGuard, sharedUnsplashCallBudget, sharedUnsplashTopUpShare } from '@/lib/register-photo-stock-rate-guard'
import { findPhotoPoolByPlaceName, savePhotoFromUrl, savePhotoToPool } from '@/lib/photo-pool'
import { parseImageDimensions, probeImageDimensions } from '@/lib/image-dimension-probe'
import { searchWikimediaCc0 } from '@/lib/photo-autofill-cc0'
import { searchNoAttributionCc0 } from '@/lib/photo-autofill-openverse'
import { isPixabayStopped, searchPixabayCandidates } from '@/lib/pixabay-service'
import type { AcquireDeps, StockTier } from '@/lib/photo-autofill-acquire'
import { AUTOFILL_COVER_MAX_BYTES, AUTOFILL_DAY_MAX_BYTES, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { sightMatchInText, sightProfile, sightSearchQueries } from '@/lib/photo-autofill-sight'
import { poolCandidateEvidence, sourcePageEvidenceText } from '@/lib/photo-pool-evidence-1122'
import { claimThumbnailTopUpSlot, thumbnailPoolFetchCount, topUpThumbnailPlacePool } from '@/lib/thumbnail-pool-topup'
import { isExistingIstockImage } from '@/lib/product-image-source-policy'
import { isSupplierPhotoUrl } from '@/lib/thumbnail-pick'
import { isMonochromeImageBuffer, isMonochromePhotoUrl } from '@/lib/register-photo-monochrome'
import { candidateSaysMonochrome } from '@/lib/photo-monochrome-text-1122'

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

/**
 * 풀 행의 원 출처. 정책이 아는 이름(Pexels·CC0·Unsplash)으로 돌려준다. 모르면 null(그대로 'PhotoPool' — 정책이 막는다).
 * 'PhotoPool' 로 저장된 행은 원본 주소 도메인으로 본다(commons.wikimedia.org 는 CC0 단계에서만 저장됨).
 */
export function poolRowOriginSource(source: string | null | undefined, sourceUrl: string | null | undefined): string | null {
  const s = String(source ?? '').trim().toLowerCase()
  let host = ''
  try {
    host = new URL(String(sourceUrl ?? '')).hostname.replace(/^www\./, '')
  } catch {
    host = ''
  }
  if (s === 'pexels' || (s === 'photopool' && host === 'pexels.com')) return 'Pexels'
  if (s === 'unsplash' || (s === 'photopool' && host === 'unsplash.com')) return 'Unsplash'
  if (s === 'cc0' || (s === 'photopool' && host === 'commons.wikimedia.org')) return 'CC0'
  if (s === 'pixabay' || (s === 'photopool' && host === 'pixabay.com')) return 'Pixabay'
  return null
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
    // REGRESSION-FREEZE[free-src-1128]: Pixabay 는 단일 관문(searchPixabayCandidates), 키 없으면 pixabay_no_key 로 건너뜀 — manifest
    search: async (tier: StockTier, query: string, perPage: number) =>
      tier === 'pixabay'
        ? searchPixabayCandidates(query, perPage)
        : (await collectChainCandidates(query, tier)).map(chainToAutofillCandidate),
    stockOffReason: (tier: StockTier) => (tier === 'pixabay' ? (isPixabayStopped() === 'pixabay_no_key' ? 'pixabay_no_key' : null) : null),
    stockStopped: (tier: StockTier) => {
      if (tier === 'pexels') return sharedPexelsCallGuard().isStopped()
      if (tier === 'pixabay') return isPixabayStopped() != null
      // Unsplash+·프리미엄·스폰서는 searchUnsplashHeroCandidates 가 후보에서 이미 뺀다
      const b = sharedUnsplashCallBudget()
      return b.isStopped() || b.remaining() <= 0
    },
    // REGRESSION-FREEZE[photo-openverse-cc0-1127]: CC0·PD 단계는 Openverse + Wikimedia — manifest
    searchCc0: (query, perPage) => searchNoAttributionCc0(query, perPage),
    pause: () => sleep(AUTOFILL_PAUSE_BASE_MS + Math.floor(random() * AUTOFILL_PAUSE_JITTER_MS)),
    lookupPool: async (sight) => {
      if (typeof opts.prisma?.photoPool?.findMany !== 'function') return []
      if (sightSearchQueries(sight).length === 0) return []
      const loadRows = () => findPhotoPoolByPlaceName(opts.prisma, sight, 20)
      let rows = await loadRows()
      if (rows.length < 10 && thumbnailPoolFetchCount(rows.length) > 0 && claimThumbnailTopUpSlot()) {
        await topUpThumbnailPlacePool({
          have: rows.length,
          pause: () => sleep(AUTOFILL_PAUSE_BASE_MS + Math.floor(random() * AUTOFILL_PAUSE_JITTER_MS)),
          // REGRESSION-FREEZE[unsplash-share-1127]: 풀 보충은 Unsplash 시간당 몫(15)만 쓴다 — 칸 검색 몫을 남긴다 — manifest
          search: async (tier) => {
            if (tier === 'unsplash' && !sharedUnsplashTopUpShare().tryAcquire()) return []
            return (await collectChainCandidates(sight, tier)).map(chainToAutofillCandidate)
          },
          searchCc0: async () => searchWikimediaCc0(sight, 15),
          save: async (c) => {
            if (isSupplierPhotoUrl(c.url) || isSupplierPhotoUrl(c.originalLink)) return false
            // REGRESSION-FREEZE[pool-evidence-not-label-1122]: 보충 저장도 검색 결과 자체 설명이 그 명소일 때만 이 명소 이름표로 저장 — manifest
            if (!sightMatchInText(sightProfile(sight), sourcePageEvidenceText(c.originalLink))) return false
            // REGRESSION-FREEZE[photo-monochrome-text-1122]: 풀 보충도 흑백 표시 글은 저장하지 않음 — manifest
            if (candidateSaysMonochrome(c)) return false
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
        // REGRESSION-FREEZE[pool-evidence-not-label-1122]: 이름표가 아니라 원본 주소 slug 로 명소를 확인한다. 확인할 수 없는 풀 행은 건너뛰고 새 검색으로 — manifest
        const evidence = poolCandidateEvidence(row)
        if (!evidence) continue
        // REGRESSION-FREEZE[pool-origin-source-1127]: 원 출처를 모르는 풀 행(생성·수동 등)은 채택해도 일차 정책(L2-OTHER-SOURCE)에서 버려져 칸이 빈다 → 후보에서 빼고 다음 출처로 — manifest
        if (!poolRowOriginSource(row.source, row.sourceUrl)) continue
        await sleep(AUTOFILL_PAUSE_BASE_MS + Math.floor(random() * AUTOFILL_PAUSE_JITTER_MS))
        const dim = await probeImageDimensions(url).catch(() => null)
        const sized = await opts.probe(url)
        out.push({
          id: String(row.sourcePhotoId || row.id),
          source: 'PhotoPool',
          poolOriginSource: poolRowOriginSource(row.source, row.sourceUrl),
          url,
          width: dim?.width ?? sized.width ?? 0,
          height: dim?.height ?? 0,
          photographer: row.photographer,
          originalLink: row.sourceUrl,
          altText: evidence,
          title: null,
          storedBytes: sized.bytes,
        })
      }
      return out
    },
    isMonochrome: async (c) =>
      c.generatedBuffer ? isMonochromeImageBuffer(Buffer.from(c.generatedBuffer)) : /^https?:\/\//i.test(c.url) ? isMonochromePhotoUrl(c.url) : false,
    // REGRESSION-FREEZE[no-ai-photo-1127]: PHOTO-RULES 22:44 — AI·Gemini 생성은 사진 출처에서 제외. 자동 채움은 generate 를 넘기지 않는다(실패해도 다시 부를 일이 없음) — manifest
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
      // REGRESSION-FREEZE[free-src-1128]: Pixabay 는 영구 핫링크 금지(공식 문서) — 우리 사진 풀(저장소)에 받아 올린 주소만 쓴다 — manifest
      if (c.source === 'Pixabay') {
        const saved = await savePhotoFromUrl(opts.prisma, c.url, opts.destination || ctx.label, ctx.label, 'Pixabay', {
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
          source: 'Pixabay',
          photographer: String(c.photographer ?? ''),
          originalLink: String(c.originalLink ?? ''),
          externalId: c.id,
        }
      }
      if (c.source === 'PhotoPool') {
        // REGRESSION-FREEZE[pool-origin-source-1127]: 풀 채택 사진은 원 출처(Pexels·CC0·Unsplash)로 기록한다 — 'PhotoPool' 이면 일차 정책이 L2-OTHER-SOURCE 로 버렸다 — manifest
        const origin = c.poolOriginSource ?? 'PhotoPool'
        if (c.storedBytes != null && c.storedBytes > maxBytes) {
          const saved = await savePhotoFromUrl(opts.prisma, c.url, opts.destination || ctx.label, ctx.label, origin, {
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
            source: origin,
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
          source: origin,
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
