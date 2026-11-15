import fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const findUnique = vi.fn()
const updateMany = vi.fn()
const update = vi.fn()
const count = vi.fn()
const heal = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: (...a: unknown[]) => findMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      update: (...a: unknown[]) => update(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}))
vi.mock('@/lib/photo-gate-runner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/photo-gate-runner')>()
  return {
    ...actual,
    runPhotoHealForProduct: (...a: unknown[]) => heal(...a),
    runPublicPhotoNightlyAuditLive: vi.fn(),
  }
})
vi.mock('@/lib/admin-secrets', () => ({ getAdminServiceBearerSecret: () => 'secret' }))
vi.mock('@/lib/register-pre-photo-queue-flags', () => ({
  refreshRegisterPrePhotoQueueFlagsForProductId: vi.fn(),
}))
vi.mock('@/lib/register-publish-facts', () => ({
  loadRegisterPublishFacts: vi.fn(async () => ({ futureDepartureCount: 0, fitItinerary: false })),
}))
vi.mock('@/lib/photo-autofill-public-usage', () => ({
  loadPublicPhotoUsageCached: vi.fn(async () => ({ coverConflict: () => null })),
}))
vi.mock('@/lib/register-photo-registration-gate', () => ({
  evaluateRegistrationPhotos: () => ({ blocks: [] }),
  registrationBlockCodes: () => [],
}))
vi.mock('@/lib/register-auto-register-review-pass', () => ({ isAutoRegisterReviewPassed: () => false }))
vi.mock('@/lib/image-dimension-probe', () => ({ probeImageDimensions: vi.fn(async () => null) }))

import { runAutoPhotoRegisterJob } from '@/lib/register-auto-photo-register-job'
import {
  AUTOFILL_COVER_MAX_WIDTH_OVER_HEIGHT,
  AUTOFILL_COVER_MIN_HEIGHT,
  evaluateAutofillCandidate,
  type AutofillCandidate,
} from '@/lib/photo-autofill-gate'
import { sightProfile } from '@/lib/photo-autofill-sight'
import { PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { buildRegistrationPhotoInput, coverPlaceLabelOf } from '@/lib/photo-gate-runner'
import { coverReplacementData } from '@/lib/photo-slot-apply'
import { findStockPhotoByChain } from '@/lib/register-photo-source-chain'
import { backfillCreditFieldsFor } from '@/lib/product-image-backfill-plan'
import { evaluateImageCandidatePolicy } from '@/lib/product-image-source-policy'
import { fitProductPhotoToMaxBytes } from '@/lib/image-to-webp'
import sharp from 'sharp'
import { AUTOFILL_COVER_MAX_BYTES, AUTOFILL_DAY_MAX_BYTES } from '@/lib/photo-autofill-gate'

const env = { BONGTOUR_AUTO_PHOTO_FILL: '1', BONGTOUR_AUTO_REGISTER_RECORD: '1' }

describe('photo self-heal guard 1115', () => {
  beforeEach(() => {
    findMany.mockReset()
    findUnique.mockReset()
    updateMany.mockReset()
    update.mockReset()
    count.mockReset()
    heal.mockReset()
    updateMany.mockResolvedValue({ count: 0 })
    heal.mockResolvedValue({ heal: { replaced: [] }, exceptions: [] })
  })

  it('skips image processing, heal, and reason writes when the product is already registered', async () => {
    findMany.mockResolvedValue([{ id: 'AMP5211', bgImageUrl: 'https://cdn.example/a.webp', schedule: '[]' }])
    findUnique.mockResolvedValue({ registrationStatus: 'registered' })
    const fetchImpl = vi.fn()
    const result = await runAutoPhotoRegisterJob({ env, fetchImpl, gapMs: 0 })
    expect(result.scanned).toBe(1)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(heal).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('rejects a 1600x565 cover and keeps a 1200-wide landscape', () => {
    expect(AUTOFILL_COVER_MIN_HEIGHT).toBe(640)
    expect(AUTOFILL_COVER_MAX_WIDTH_OVER_HEIGHT).toBe(2.2)
    const base: AutofillCandidate = {
      id: '1001',
      source: 'Pexels',
      url: 'https://images.pexels.com/photos/1001/a.jpeg',
      width: 1600,
      height: 565,
      photographer: 'Jane',
      originalLink: 'https://www.pexels.com/photo/blue-mosque-in-istanbul-1001/',
      altText: 'Blue Mosque in Istanbul',
    }
    const sight = sightProfile('Blue Mosque')
    const input = {
      candidate: base,
      sight,
      cityTerms: ['istanbul'],
      slotText: '이스탄불 블루모스크 Istanbul',
      productId: 'p',
      usage: new PublicPhotoUsage(),
    }
    const panorama = evaluateAutofillCandidate({ ...input, slotKind: 'cover' })
    expect(panorama.ok).toBe(false)
    expect(panorama.reasons).toEqual(expect.arrayContaining(['cover_short', 'cover_panorama']))
    const ok = evaluateAutofillCandidate({
      ...input,
      slotKind: 'cover',
      candidate: { ...base, width: 1200, height: 800 },
    })
    expect(ok.reasons).not.toEqual(expect.arrayContaining(['cover_short', 'cover_panorama']))
    expect(ok.ok).toBe(true)
    const day = evaluateAutofillCandidate({ ...input, slotKind: 'day' })
    expect(day.reasons).not.toContain('cover_panorama')
  })

  it('judges the cover by the current place name, not the leftover search label', () => {
    const facts = {
      id: 'p',
      destination: '말레이시아',
      primaryDestination: null,
      schedule: '[]',
      bgImageUrl: 'https://cdn.example/cover.webp',
      bgImageExternalId: '1',
      bgImageSource: 'Pexels',
      bgImagePhotographer: 'A',
      bgImageSourceUrl: 'https://www.pexels.com/photo/petronas-towers-1/',
      bgImageRehostSearchLabel: 'Genting Highlands',
      bgImagePlaceName: 'Petronas Towers',
    }
    expect(coverPlaceLabelOf(facts)).toBe('Petronas Towers')
    const built = buildRegistrationPhotoInput(facts, new PublicPhotoUsage(), {})
    expect(built.cover?.placeLabel).toBe('Petronas Towers')
    expect(built.cover?.placeLabel).not.toBe('Genting Highlands')
  })

  it('writes the new photo place into the place-name field when the cover is replaced', () => {
    const data = coverReplacementData({
      url: 'https://cdn.example/new.webp',
      source: 'Pexels',
      photographer: 'B',
      originalLink: 'https://www.pexels.com/photo/petronas-towers-2/',
      externalId: '2',
      sight: 'Petronas Towers',
      matched: 'petronas towers',
    })
    expect(data.bgImagePlaceName).toBe('Petronas Towers')
    expect(data.bgImageSourceUrl).toBe('https://www.pexels.com/photo/petronas-towers-2/')
  })

  it('stores the Unsplash photo page as SourceUrl, not the author profile', async () => {
    const r = await findStockPhotoByChain('Da Nang', {
      accept: () => true,
      deps: {
        searchPexels: async () => [],
        searchUnsplash: async () => [
          {
            unsplashId: 'abc',
            imageUrl: 'https://images.unsplash.com/photo-abc?w=2400',
            width: 2400,
            height: 1600,
            downloadLocation: 'https://api.unsplash.com/photos/abc/download',
            queryUsed: 'Da Nang',
            authorName: 'U',
            authorProfileUrl: 'https://unsplash.com/@u',
          },
        ],
        triggerDownload: async () => true,
      },
    })
    expect(r.photo?.originalLink).toBe('https://unsplash.com/photos/abc')
    expect(r.photo?.pageUrl).toBe('https://unsplash.com/photos/abc')
    expect(r.photo?.authorProfileUrl).toBe('https://unsplash.com/@u')
    expect(backfillCreditFieldsFor({
      source: 'unsplash',
      unsplashId: 'abc',
      unsplashAuthorName: 'U',
      unsplashAuthorProfileUrl: 'https://unsplash.com/@u',
    }).bgImageSourceUrl).toBe('https://unsplash.com/photos/abc')
    expect(evaluateImageCandidatePolicy({
      source: 'unsplash',
      url: 'https://images.unsplash.com/photo-abc',
      width: 2400,
      photographer: 'U',
      originalLink: 'https://unsplash.com/photos/abc',
      authorProfileUrl: 'https://unsplash.com/@u',
    }).fails).not.toContain('L1-UNSPLASH-NO-CREDIT')
  })

  it('shrinks an oversized photo under the cover and day byte caps, and refuses an impossible cap', async () => {
    const tile = Buffer.alloc(48 * 48 * 3)
    for (let i = 0; i < tile.length; i++) tile[i] = (i * 17) % 256
    const jpeg = await sharp(tile, { raw: { width: 48, height: 48, channels: 3 } })
      .resize(2000, 1400, { kernel: 'nearest' })
      .jpeg({ quality: 100 })
      .toBuffer()
    expect(jpeg.length).toBeGreaterThan(AUTOFILL_COVER_MAX_BYTES)
    const cover = await fitProductPhotoToMaxBytes(jpeg, { maxBytes: AUTOFILL_COVER_MAX_BYTES, maxWidth: 2400, quality: 88 })
    const day = await fitProductPhotoToMaxBytes(jpeg, { maxBytes: AUTOFILL_DAY_MAX_BYTES, maxWidth: 2400, quality: 88 })
    expect(cover).not.toBeNull()
    expect(day).not.toBeNull()
    expect(cover!.buffer.length).toBeLessThanOrEqual(AUTOFILL_COVER_MAX_BYTES)
    expect(day!.buffer.length).toBeLessThanOrEqual(AUTOFILL_DAY_MAX_BYTES)
    expect(await fitProductPhotoToMaxBytes(jpeg, { maxBytes: 20 })).toBeNull()
    const pool = fs.readFileSync('lib/photo-pool.ts', 'utf8')
    const live = fs.readFileSync('lib/photo-autofill-live-deps.ts', 'utf8')
    const coverRehost = fs.readFileSync('lib/product-pexels-image-rehost.ts', 'utf8')
    const dayRehost = fs.readFileSync('lib/schedule-day-image-rehost.ts', 'utf8')
    const internalize = fs.readFileSync('lib/travel-product-image-internalize.ts', 'utf8')
    expect(pool).toContain('fitProductPhotoToMaxBytes')
    expect(live).toContain('maxBytes')
    expect(coverRehost).toContain('AUTOFILL_COVER_MAX_BYTES')
    expect(dayRehost).toContain('AUTOFILL_DAY_MAX_BYTES')
    expect(internalize).toContain('maxBytes: AUTOFILL_COVER_MAX_BYTES')
    expect(internalize).toContain('maxBytes: AUTOFILL_DAY_MAX_BYTES')
    expect(fs.readFileSync('app/api/travel/process-images/route.ts', 'utf8')).toContain('isUnsplashHotlinkUrl(photo.url)')
  }, 20000)

  it('sets WHEN_REQUIRED checksums on every NCLOUD upload S3Client', () => {
    const files = [
      'lib/object-storage.ts',
      'scripts/migrate-supabase-to-ncloud.mjs',
    ]
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8')
      const clients = src.split('new S3Client(').length - 1
      expect(clients, file).toBeGreaterThan(0)
      expect(src.match(/requestChecksumCalculation: 'WHEN_REQUIRED'/g)?.length, file).toBe(clients)
      expect(src.match(/responseChecksumValidation: 'WHEN_REQUIRED'/g)?.length, file).toBe(clients)
    }
  })
})
