import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

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

function noiseJpeg(width: number, height: number) {
  const tile = Buffer.alloc(48 * 48 * 3)
  for (let i = 0; i < tile.length; i++) tile[i] = (i * 17) % 256
  return sharp(tile, { raw: { width: 48, height: 48, channels: 3 } })
    .resize(width, height, { kernel: 'nearest' })
    .jpeg({ quality: 100 })
    .toBuffer()
}

describe('photo byte cap 1115', () => {
  it('fits a chosen photo under the cover and day caps, and records no save when it still cannot', async () => {
    const { fitProductPhotoToMaxBytes } = await import('@/lib/image-to-webp')
    const { AUTOFILL_COVER_MAX_BYTES, AUTOFILL_DAY_MAX_BYTES } = await import('@/lib/photo-autofill-gate')
    const jpeg = await noiseJpeg(2000, 1400)
    expect(jpeg.length).toBeGreaterThan(AUTOFILL_COVER_MAX_BYTES)
    const cover = await fitProductPhotoToMaxBytes(jpeg, { maxBytes: AUTOFILL_COVER_MAX_BYTES, maxWidth: 2400, quality: 88 })
    const day = await fitProductPhotoToMaxBytes(jpeg, { maxBytes: AUTOFILL_DAY_MAX_BYTES, maxWidth: 2400, quality: 88 })
    expect(cover).not.toBeNull()
    expect(day).not.toBeNull()
    expect(cover!.buffer.length).toBeLessThanOrEqual(AUTOFILL_COVER_MAX_BYTES)
    expect(day!.buffer.length).toBeLessThanOrEqual(AUTOFILL_DAY_MAX_BYTES)
    expect(await fitProductPhotoToMaxBytes(jpeg, { maxBytes: 20 })).toBeNull()
    const src = fs.readFileSync('lib/image-to-webp.ts', 'utf8')
    expect(src).toContain('800, 480')
    expect(src).toContain('40, 25')
  }, 30000)

  it('does not upload the original bytes when a product photo cannot fit maxBytes', async () => {
    process.env.NCLOUD_ACCESS_KEY = 'x'
    process.env.NCLOUD_SECRET_KEY = 'y'
    process.env.NCLOUD_OBJECT_STORAGE_ENDPOINT = 'https://kr.object.ncloudstorage.com'
    process.env.NCLOUD_OBJECT_STORAGE_BUCKET = 'b'
    process.env.NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL = 'https://cdn.example'
    const jpeg = await noiseJpeg(2000, 1400)
    const { uploadStorageObject } = await import('@/lib/object-storage')
    await expect(uploadStorageObject({ objectKey: 'x/a.jpg', body: jpeg, contentType: 'image/jpeg', maxBytes: 20 })).rejects.toThrow()
    expect(sent).toHaveLength(0)
  }, 30000)

  it('recompresses the same pooled photo when it is over the cap, and reuses it when the size is unknown', async () => {
    process.env.NCLOUD_ACCESS_KEY = 'x'
    process.env.NCLOUD_SECRET_KEY = 'y'
    process.env.NCLOUD_OBJECT_STORAGE_ENDPOINT = 'https://kr.object.ncloudstorage.com'
    process.env.NCLOUD_OBJECT_STORAGE_BUCKET = 'b'
    process.env.NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL = 'https://cdn.example'
    const jpeg = await noiseJpeg(800, 600)
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
    const created: Array<{ filePath?: string }> = []
    const prisma = {
      photoPool: {
        findFirst: async (q: { where?: { sourcePhotoId?: string } }) => (q?.where?.sourcePhotoId ? existing : null),
        create: async ({ data }: { data: { filePath?: string } }) => {
          created.push(data)
          return { ...existing, ...data, id: 'pool-2' }
        },
      },
    }
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-length': '250000' } })
      }
      if (String(url).includes('old.webp')) return new Response(jpeg)
      return new Response('no', { status: 404 })
    }) as typeof fetch
    try {
      const { savePhotoFromUrl } = await import('@/lib/photo-pool')
      const over = await savePhotoFromUrl(prisma as never, 'https://images.pexels.com/new.jpg', '다낭', '미케비치', 'Pexels', { sourcePhotoId: '9' }, 200_000)
      expect(over?.id).toBe('pool-2')
      expect(created).toHaveLength(1)
      expect(sent.length).toBeGreaterThan(0)
      const body = sent[sent.length - 1]!.Body
      expect(body.length).toBeLessThanOrEqual(200_000)
      sent.length = 0
      created.length = 0
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'HEAD') return new Response(null, { status: 404 })
        return new Response('no', { status: 404 })
      }) as typeof fetch
      const unknown = await savePhotoFromUrl(prisma as never, 'https://images.pexels.com/new.jpg', '다낭', '미케비치', 'Pexels', { sourcePhotoId: '9' }, 200_000)
      expect(unknown?.filePath).toBe('https://cdn.example/old.webp')
      expect(created).toHaveLength(0)
      expect(sent).toHaveLength(0)
    } finally {
      globalThis.fetch = orig
    }
  }, 30000)

  it('does not drop a chosen hotlink because its byte size is unknown or over the cap', () => {
    const live = fs.readFileSync('lib/photo-autofill-live-deps.ts', 'utf8')
    const unsplash = live.slice(live.indexOf("c.source === 'Unsplash'"), live.indexOf("c.url, opts.destination, ctx.label, 'Pexels'"))
    expect(unsplash).not.toContain('over_bytes')
    expect(unsplash).not.toContain('bytesFitSlotLimit')
    expect(live).toContain("if (c.storedBytes != null && c.storedBytes > maxBytes)")
    expect(fs.readFileSync('app/api/travel/process-images/route.ts', 'utf8')).toContain('generateImageWithGemini')
  })
})
