import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const geminiCalls = vi.fn()
vi.mock('@/lib/gemini-image-generate', () => ({
  generateImageWithGemini: (...args: unknown[]) => geminiCalls(...args),
}))

const sent: Array<{ Key: string; ContentType: string; Body: Buffer }> = []
vi.mock('@aws-sdk/client-s3', async (orig) => {
  const a = await orig<typeof import('@aws-sdk/client-s3')>()
  class S3Client {
    send = async (cmd: { input: { Key: string; ContentType: string; Body: Buffer } }) => {
      sent.push(cmd.input)
      return {}
    }
  }
  return { ...a, S3Client }
})

describe('photo self-heal guard 1115 (review)', () => {
  it('does not upload the original bytes when a product photo cannot fit maxBytes', async () => {
    process.env.NCLOUD_ACCESS_KEY = 'x'
    process.env.NCLOUD_SECRET_KEY = 'y'
    process.env.NCLOUD_OBJECT_STORAGE_ENDPOINT = 'https://kr.object.ncloudstorage.com'
    process.env.NCLOUD_OBJECT_STORAGE_BUCKET = 'b'
    process.env.NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL = 'https://cdn.example'
    const tile = Buffer.alloc(48 * 48 * 3)
    for (let i = 0; i < tile.length; i++) tile[i] = (i * 17) % 256
    const jpeg = await sharp(tile, { raw: { width: 48, height: 48, channels: 3 } })
      .resize(2000, 1400, { kernel: 'nearest' })
      .jpeg({ quality: 100 })
      .toBuffer()
    const { uploadStorageObject } = await import('@/lib/object-storage')
    await expect(uploadStorageObject({ objectKey: 'x/a.jpg', body: jpeg, contentType: 'image/jpeg', maxBytes: 20 })).rejects.toThrow()
    expect(sent).toHaveLength(0)
  }, 30000)

  it('does not reuse a pooled source photo that is over the slot byte cap', async () => {
    const { savePhotoFromUrl } = await import('@/lib/photo-pool')
    const existing = {
      id: 'pool-1',
      cityName: '다낭',
      attractionName: '미케비치',
      source: 'Pexels',
      filePath: 'https://cdn.example/old.webp',
      photographer: 'A',
      sourceUrl: 'https://www.pexels.com/photo/1/',
      sourcePhotoId: '9',
      sortOrder: 0,
      createdAt: new Date('2026-01-01'),
    }
    const prisma = { photoPool: { findFirst: async () => existing } }
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': '250000' } })
      return new Response('no', { status: 404 })
    }) as typeof fetch
    try {
      const over = await savePhotoFromUrl(prisma as never, 'https://images.pexels.com/new.jpg', '다낭', '미케비치', 'Pexels', { sourcePhotoId: '9' }, 200_000)
      expect(over).toBeNull()
      expect(calls.some((c) => c.startsWith('HEAD'))).toBe(true)
      expect(calls.some((c) => c.startsWith('GET'))).toBe(true)
      calls.length = 0
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        calls.push(method)
        if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': '100000' } })
        return new Response('no', { status: 404 })
      }) as typeof fetch
      const under = await savePhotoFromUrl(prisma as never, 'https://images.pexels.com/new.jpg', '다낭', '미케비치', 'Pexels', { sourcePhotoId: '9' }, 200_000)
      expect(under?.filePath).toBe('https://cdn.example/old.webp')
      expect(calls).toEqual(['HEAD'])
    } finally {
      globalThis.fetch = orig
    }
  })

  it('excludes an Unsplash hotlink when the byte size is unknown', async () => {
    const { bytesFitSlotLimit, coverPoolCandidateOk, AUTOFILL_COVER_MAX_BYTES } = await import('@/lib/photo-autofill-gate')
    expect(bytesFitSlotLimit(null, AUTOFILL_COVER_MAX_BYTES)).toBe(false)
    expect(bytesFitSlotLimit(200_001, AUTOFILL_COVER_MAX_BYTES)).toBe(false)
    expect(bytesFitSlotLimit(200_000, AUTOFILL_COVER_MAX_BYTES)).toBe(true)
    expect(coverPoolCandidateOk({ bytes: null, width: 1200, height: 800 })).toBe(false)
    expect(coverPoolCandidateOk({ bytes: 100_000, width: 1600, height: 565 })).toBe(false)
    expect(coverPoolCandidateOk({ bytes: 100_000, width: 1200, height: 800 })).toBe(true)
    const live = fs.readFileSync('lib/photo-autofill-live-deps.ts', 'utf8')
    const route = fs.readFileSync('app/api/travel/process-images/route.ts', 'utf8')
    expect(live).toContain('bytesFitSlotLimit(m.bytes, maxBytes)')
    expect(route).toContain('bytesFitSlotLimit(measured.bytes, maxBytes)')
    expect(route).toContain('coverPoolCandidateOk')
  })

  it('judges cover search by the place name, not the leftover search label', async () => {
    const { coverCityMatchesProduct } = await import('@/lib/register-auto-register-gate')
    const { coverSight } = await import('@/lib/photo-nightly-audit')
    expect(coverCityMatchesProduct({
      destination: '다낭',
      title: '다낭 4일',
      bgImageCityName: null,
      bgImagePlaceName: 'Petronas Towers',
      bgImageRehostSearchLabel: 'Da Nang',
    } as never)).toBe(false)
    const sights = coverSight({
      id: 'p',
      createdAt: '2026-01-01',
      bgImageUrl: 'https://cdn.example/c.webp',
      destination: '이스탄불',
      schedule: '[]',
      bgImageRehostSearchLabel: 'Genting Highlands',
      bgImagePlaceName: 'Blue Mosque',
    }, '')
    expect(sights).toEqual(['Blue Mosque'])
    const route = fs.readFileSync('app/api/travel/process-images/route.ts', 'utf8')
    expect(route).toContain('cachedHeroPlaceKeyword: (product as { bgImagePlaceName?: string | null }).bgImagePlaceName')
    expect(route).not.toContain('cachedHeroPlaceKeyword: (product as { bgImageRehostSearchLabel')
  })

  it('writes nothing for a healthy registered product and only replaces broken photos or a newer duplicate cover', async () => {
    const { nightlyReplaceAllowed, runPublicPhotoNightlyAudit } = await import('@/lib/photo-nightly-audit')
    expect(nightlyReplaceAllowed({ reason: 'photo_sight_mismatch', kind: 'cover' })).toBe(false)
    expect(nightlyReplaceAllowed({ reason: 'photo_low_res', kind: 'day' })).toBe(false)
    expect(nightlyReplaceAllowed({ reason: 'public_duplicate', kind: 'day' })).toBe(false)
    expect(nightlyReplaceAllowed({ reason: 'broken_http', kind: 'day' })).toBe(true)
    expect(nightlyReplaceAllowed({ reason: 'public_duplicate', kind: 'cover' })).toBe(true)
    const healthy = {
      id: 'A',
      createdAt: '2026-01-01',
      destination: '다낭',
      bgImageUrl: 'https://cdn.example.com/cover.webp',
      bgImageExternalId: '1',
      bgImageSource: 'Pexels',
      bgImageSourceUrl: 'https://www.pexels.com/photo/1/',
      schedule: JSON.stringify([{ day: 1, imageUrl: 'https://cdn.example.com/day.webp', imageSource: { externalId: '2' } }]),
    }
    let writes = 0
    const quiet = await runPublicPhotoNightlyAudit({
      listProducts: async () => [healthy],
      head: async () => ({ status: 200 }),
      pause: async () => {},
      acquire: async () => { throw new Error('healthy photo must not be acquired') },
      writeSchedule: async () => { writes += 1; return true },
      writeCover: async () => { writes += 1; return true },
      recordException: async () => { writes += 1 },
      recordReplace: async () => { writes += 1 },
    })
    expect(quiet.replaced).toEqual([])
    expect(writes).toBe(0)
    const broken = {
      ...healthy,
      schedule: JSON.stringify([{ day: 1, imageUrl: 'https://cdn.example.com/dead.webp', imageSource: { externalId: '9' } }]),
    }
    const replaced = await runPublicPhotoNightlyAudit({
      listProducts: async () => [broken],
      head: async (url) => ({ status: url.includes('dead') ? 404 : 200 }),
      pause: async () => {},
      acquire: async () => ({
        ok: true,
        tried: [],
        photo: {
          url: 'https://cdn.example.com/new.webp',
          bytes: 100_000,
          width: 1600,
          source: 'Pexels',
          photographer: 'B',
          originalLink: 'https://www.pexels.com/photo/2/',
          externalId: 'n1',
          sight: '미케비치',
          matched: '미케비치',
          query: '미케비치',
        },
      }),
      writeSchedule: async () => true,
      writeCover: async () => true,
      recordException: async () => {},
      recordReplace: async () => {},
    })
    expect(replaced.replaced).toEqual([{ productId: 'A', kind: 'day', day: 1, reason: 'broken_http' }])
  })

  it('does not call image generation on the automatic fill, heal, or nightly path', async () => {
    const { createLiveAcquireDeps } = await import('@/lib/photo-autofill-live-deps')
    const deps = createLiveAcquireDeps({
      prisma: { photoPool: { findMany: async () => [] } } as never,
      destination: '다낭',
      probe: async () => ({ bytes: null, width: null }),
      sleep: async () => {},
    })
    expect(deps.generate).toBeUndefined()
    const committed = await deps.commit(
      {
        id: 'ai-1',
        source: 'AI 생성',
        url: 'ai-generated://pending',
        width: 1600,
        height: 1000,
        photographer: 'AI 생성',
        originalLink: 'ai-generated',
      },
      { kind: 'cover', day: null, label: '미케비치' },
    )
    expect(committed).toEqual({ ok: false, reason: 'auto_generate_disabled' })
    expect(geminiCalls).not.toHaveBeenCalled()
    expect(fs.readFileSync('lib/photo-autofill-live-deps.ts', 'utf8')).not.toContain('generateImageWithGemini')
    expect(fs.readFileSync('app/api/travel/process-images/route.ts', 'utf8')).not.toContain('generateImageWithGemini')
    expect(fs.readFileSync('lib/photo-gate-runner.ts', 'utf8')).not.toContain('generateImageWithGemini')
    expect(fs.readFileSync('app/api/admin/gemini/image-generate/route.ts', 'utf8')).toContain('generateImageWithGemini')
  })

})
