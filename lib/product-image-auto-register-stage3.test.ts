import { describe, expect, it } from 'vitest'
import fs from 'fs'
import { parseImageDimensions, probeImageDimensions } from '@/lib/image-dimension-probe'
import {
  applyAutoCoverDecisionToUpdateData,
  decideAutoCoverWrite,
  gatedAutoCoverUpdateData,
  isImagePolicyAutoRegisterEnabled,
  isImagePolicyAutoRegisterStatus,
} from '@/lib/product-image-auto-register-gate'
import {
  BACKFILL_WRITABLE_FIELDS,
  classifyBackfillRow,
  pickBackfillWritableData,
} from '@/lib/product-image-backfill-plan'

const ISTOCK = 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/primary_hero_manual-upload__2b934e365a608dd9.webp'
const pngHeader = (w: number, h: number) => {
  const b = new Uint8Array(24)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(b.buffer).setUint32(16, w)
  new DataView(b.buffer).setUint32(20, h)
  return b
}
const jpegHeader = (w: number, h: number) =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const webpVp8x = (w: number, h: number) => {
  const b = new Uint8Array(30)
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58])
  const W = w - 1
  const H = h - 1
  b.set([W & 255, (W >> 8) & 255, (W >> 16) & 255, H & 255, (H >> 8) & 255, (H >> 16) & 255], 24)
  return b
}

describe('image dimension probe', () => {
  it('parses PNG, JPEG, WebP VP8X headers', () => {
    expect(parseImageDimensions(pngHeader(1920, 1080))).toMatchObject({ width: 1920, height: 1080 })
    expect(parseImageDimensions(jpegHeader(1600, 900))).toMatchObject({ width: 1600, height: 900, format: 'jpeg' })
    expect(parseImageDimensions(webpVp8x(1200, 800))).toMatchObject({ width: 1200, height: 800, format: 'webp' })
    expect(parseImageDimensions(new Uint8Array([1, 2, 3]))).toBeNull()
  })
  it('probe sends a Range request and returns null on failure', async () => {
    let range = ''
    const ok = (async (_u: string, init?: RequestInit) => {
      range = String((init?.headers as Record<string, string>).Range)
      return new Response(webpVp8x(2048, 1365))
    }) as unknown as typeof fetch
    expect(await probeImageDimensions('https://x/a.webp', { fetchImpl: ok })).toMatchObject({ width: 2048 })
    expect(range).toMatch(/^bytes=0-/)
    const bad = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch
    expect(await probeImageDimensions('https://x/b.webp', { fetchImpl: bad })).toBeNull()
  })
})

describe('auto-register gate (NEW + PENDING only, default off)', () => {
  const cand = { source: 'pexels', url: 'https://x/a-pexels-1.webp', width: 1920 }
  it('flag is off by default; only pre_photo_blocked and pending are in scope', () => {
    expect(isImagePolicyAutoRegisterEnabled({})).toBe(false)
    expect(isImagePolicyAutoRegisterEnabled({ BONGTOUR_IMAGE_POLICY_AUTO_REGISTER: '1' })).toBe(true)
    expect(isImagePolicyAutoRegisterStatus('pending')).toBe(true)
    expect(isImagePolicyAutoRegisterStatus('pre_photo_blocked')).toBe(true)
    expect(isImagePolicyAutoRegisterStatus('registered')).toBe(false)
    expect(isImagePolicyAutoRegisterStatus('auto_unpublished')).toBe(false)
  })
  it('decisions: legacy / keep iStock / write / hold', () => {
    const base = { registrationStatus: 'pending', currentCoverUrl: null, currentCoverSource: null }
    expect(decideAutoCoverWrite({ ...base, enabled: false, candidate: cand }).action).toBe('legacy')
    expect(decideAutoCoverWrite({ ...base, enabled: true, registrationStatus: 'registered', candidate: cand }).action).toBe('legacy')
    expect(decideAutoCoverWrite({ ...base, enabled: true, currentCoverUrl: ISTOCK, candidate: cand }).action).toBe('keep_existing_istock')
    expect(decideAutoCoverWrite({ ...base, enabled: true, candidate: cand }).action).toBe('write')
    expect(decideAutoCoverWrite({ ...base, enabled: true, candidate: { ...cand, width: 800 } }).action).toBe('hold')
    expect(decideAutoCoverWrite({ ...base, enabled: true, candidate: { source: 'istock', url: 'https://x/new.webp', width: 3000 } }).action).toBe('hold')
  })
  it('hold keeps cover fields untouched and flags review; write never creates credit fields', () => {
    const data = { bgImageUrl: 'u', bgImageSource: 'pexels', bgImagePhotographer: 'A', bgImageSourceUrl: 'l', bgImageExternalId: '1', bgImageRehostSearchLabel: 'q', schedule: '[]' }
    const held = applyAutoCoverDecisionToUpdateData(data, { action: 'hold', policy: { tier: 'pexels', pass: false, fails: ['T1-RES'], creditRequired: false, aiLabelRequired: false } }, null)
    expect(held).toEqual({ bgImageRehostSearchLabel: 'q', schedule: '[]', needsImageReview: true })
    const wrote = applyAutoCoverDecisionToUpdateData(data, { action: 'write', isGenerated: false, policy: { tier: 'pexels', pass: true, fails: [], creditRequired: false, aiLabelRequired: false } }, { width: 1920, height: 1080 })
    expect(wrote).toMatchObject({ bgImageUrl: 'u', bgImageWidth: 1920, bgImageHeight: 1080, bgImageIsGenerated: false, schedule: '[]' })
    expect(wrote).not.toHaveProperty('bgImagePhotographer')
    expect(wrote).not.toHaveProperty('bgImageSourceUrl')
    expect(wrote).not.toHaveProperty('bgImageExternalId')
  })
  it('gated wrapper is a no-op (no probe) when the flag is off', async () => {
    let probed = false
    const data = { bgImageUrl: 'u', schedule: '[]' }
    const out = await gatedAutoCoverUpdateData({ registrationStatus: 'pending' }, { url: 'u', source: 'Pexels' }, null, data, {
      env: {},
      probe: async () => {
        probed = true
        return null
      },
    })
    expect(out).toBe(data)
    expect(probed).toBe(false)
    const on = await gatedAutoCoverUpdateData({ registrationStatus: 'pending' }, { url: 'https://x/a-pexels-1.webp', source: 'Pexels' }, null, data, {
      env: { BONGTOUR_IMAGE_POLICY_AUTO_REGISTER: '1' },
      probe: async () => null,
    })
    expect(on).toEqual({ schedule: '[]', needsImageReview: true })
  })
  it('process-images route wraps every cover write with the gate', () => {
    const src = fs.readFileSync('app/api/travel/process-images/route.ts', 'utf8')
    expect(src.match(/data: await gatedAutoCoverUpdateData\(/g)?.length).toBe(3)
    expect(src).toContain('registrationStatus: true,')
  })
})

describe('backfill plan (dry-run classification)', () => {
  const row = { id: '1', slug: 's', registrationStatus: 'registered', bgImageUrl: 'https://x/a-pexels-1.webp', bgImageSource: 'pexels', bgImageWidth: 1920, bgImageIsGenerated: false }
  it('classifies rows', () => {
    expect(classifyBackfillRow({ ...row, bgImageUrl: null }).action).toBe('fill_cover')
    expect(classifyBackfillRow(row).action).toBe('ok')
    expect(classifyBackfillRow({ ...row, bgImageWidth: 940 }).action).toBe('replace_cover')
    expect(classifyBackfillRow({ ...row, bgImageWidth: null }).action).toBe('measure_width')
    expect(classifyBackfillRow({ ...row, bgImageWidth: null }, 2000).action).toBe('ok')
    expect(classifyBackfillRow({ ...row, bgImageUrl: ISTOCK, bgImageSource: 'istock', bgImageWidth: 500 }).action).toBe('keep_existing_istock')
    expect(classifyBackfillRow({ ...row, bgImageSource: 'photo_owned', bgImageUrl: 'https://x/own.webp' }).action).toBe('owner_decision_own_photo')
    expect(classifyBackfillRow({ ...row, bgImageSource: 'gemini_auto', bgImageUrl: 'https://x/g.webp', bgImageIsGenerated: false }).action).toBe('set_ai_label')
    expect(classifyBackfillRow({ ...row, bgImageSource: 'gemini_auto', bgImageUrl: 'https://x/g.webp', bgImageIsGenerated: true }).action).toBe('owner_decision_ai_prompt')
    expect(classifyBackfillRow({ ...row, bgImageSource: 'photopool', bgImageUrl: 'https://x/p.webp' }).action).toBe('replace_cover')
  })
  it('writes only image fields, never credit fields', () => {
    expect(BACKFILL_WRITABLE_FIELDS).not.toContain('bgImagePhotographer' as never)
    expect(pickBackfillWritableData({ bgImageUrl: 'u', title: 'x', bgImagePhotographer: 'p', schedule: '[]' })).toEqual({ bgImageUrl: 'u' })
  })
  it('script is dry-run by default and backs up before writing', () => {
    const src = fs.readFileSync('scripts/image-policy-backfill.ts', 'utf8')
    expect(src).toContain("(has('--apply') ? apply() : dryRun())")
    expect(src).toContain("IMAGE_BACKFILL_CONFIRM ?? '') !== 'YES'")
    expect(src.indexOf('fs.writeFileSync(backupFile')).toBeLessThan(src.indexOf('prisma.product.update'))
  })
})
