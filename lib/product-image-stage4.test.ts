import fs from 'fs'
import { describe, expect, it, vi } from 'vitest'
import { evaluateImageCandidatePolicy, isOwnedBongtourImage, OWNED_BONGTOUR_IMAGE_KEYS } from '@/lib/product-image-source-policy'
import { applyAutoCoverDecisionToUpdateData, decideAutoCoverWrite } from '@/lib/product-image-auto-register-gate'
import {
  batchFileNames,
  buildBatchReviewRow,
  checkApprovedBatch,
  classifyBackfillRow,
  sha256Text,
  splitIntoBatches,
  type BatchReviewFile,
} from '@/lib/product-image-backfill-plan'
import { buildUnsplashHotlinkUrl, searchUnsplashHeroCandidates, triggerUnsplashDownload } from '@/lib/unsplash-service'

const OWN_ENC =
  'https://kr.object.ncloudstorage.com/bongtour/photo-pool/%EB%AF%B8%EC%95%BC%EC%BD%94%EC%A7%80%EB%A7%88_%ED%86%A0%EC%98%A4%EB%A6%AC%EC%9D%B4%EC%BC%80_%EC%99%B8_7%EB%8F%84%EC%8B%9C_primary_hero_manual-upload__mr7uegf6.webp'
const YB4 = 'https://kr.object.ncloudstorage.com/bongtour/places/unknown/unknown-pexels-30933135.webp'

describe('stage 4: own photos 7 + pkg-yb-0004 kept', () => {
  it('7 owned keys, encoded DB URL matches', () => {
    expect(OWNED_BONGTOUR_IMAGE_KEYS.length).toBe(7)
    expect(isOwnedBongtourImage(OWN_ENC)).toBe(true)
    expect(isOwnedBongtourImage('https://kr.object.ncloudstorage.com/bongtour/photo-pool/other_manual-upload__x.webp')).toBe(false)
  })
  it('owned passes source + width exempt (640px kept), no credit', () => {
    const r = evaluateImageCandidatePolicy({ source: 'photo_owned', url: OWN_ENC, width: 640 })
    expect(r.pass).toBe(true)
    expect(r.tier).toBe('owned')
    expect(r.ownerKeptLowRes).toBe(true)
    expect(r.creditRequired).toBe(false)
    expect(classifyBackfillRow({ id: '1', slug: 'fit-mt-0050', registrationStatus: 'registered', bgImageUrl: OWN_ENC, bgImageSource: 'photo_owned', bgImageWidth: 640, bgImageIsGenerated: false }).action).toBe('keep_own_photo')
  })
  it('non-listed photo_owned is still out of list', () => {
    expect(evaluateImageCandidatePolicy({ source: 'photo_owned', url: 'https://x/own.webp', width: 2000 }).fails).toContain('L2-OTHER-SOURCE')
  })
  it('pkg-yb-0004 iStock 940px passes (kept)', () => {
    const r = evaluateImageCandidatePolicy({ source: 'istock', url: YB4, width: 940 })
    expect(r.pass).toBe(true)
    expect(r.tier).toBe('istock_existing')
    expect(r.ownerKeptLowRes).toBe(true)
    expect(evaluateImageCandidatePolicy({ source: 'istock', url: 'https://x/new-istock.webp', width: 3000 }).fails).toContain('L2-ISTOCK')
  })
})

describe('stage 4: AI label = flag + prompt', () => {
  const gen = { source: 'gemini', url: 'https://x/g-gemini-1.webp', width: 1536 }
  it('needs both', () => {
    expect(evaluateImageCandidatePolicy({ ...gen, isGenerated: true, prompt: 'p' }).pass).toBe(true)
    expect(evaluateImageCandidatePolicy({ ...gen, isGenerated: true, prompt: '' }).fails).toContain('L3-GEN-NO-RECORD')
    expect(evaluateImageCandidatePolicy({ ...gen, isGenerated: false, prompt: 'p' }).fails).toContain('L3-GEN-FLAG-OFF')
  })
  it('gate writes prompt for generated, clears for photos', () => {
    const d = decideAutoCoverWrite({ enabled: true, registrationStatus: 'pending', currentCoverUrl: null, currentCoverSource: null, candidate: { ...gen, isGenerated: true, prompt: 'Da Nang' } })
    expect(d.action).toBe('write')
    const now = new Date('2026-10-30T11:00:00Z')
    const out = applyAutoCoverDecisionToUpdateData({ bgImageUrl: 'u' }, d, { width: 1536, height: 1024 }, 'Da Nang', now)
    expect(out).toMatchObject({ bgImageIsGenerated: true, bgImageAiPrompt: 'Da Nang', bgImageAiLabeledAt: now })
    const p = decideAutoCoverWrite({ enabled: true, registrationStatus: 'pending', currentCoverUrl: null, currentCoverSource: null, candidate: { source: 'pexels', url: 'https://x/a-pexels-1.webp', width: 2400 } })
    expect(applyAutoCoverDecisionToUpdateData({ bgImageUrl: 'u' }, p, null)).toMatchObject({ bgImageIsGenerated: false, bgImageAiPrompt: null })
  })
})

describe('stage 4: migration is additive + RLS lock + rollback', () => {
  const dir = 'prisma/migrations/20261030200000_product_bg_image_ai_label'
  it('migration', () => {
    const sql = fs.readFileSync(`${dir}/migration.sql`, 'utf8')
    const body = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    expect(body).not.toMatch(/\bDROP\b|\bNOT NULL\b|\bDEFAULT\b|\bUPDATE\b|\bDELETE\b|\bRENAME\b/i)
    expect(body).toContain('ADD COLUMN IF NOT EXISTS "bgImageAiPrompt" TEXT')
    expect(body).toContain('ENABLE ROW LEVEL SECURITY')
    expect(body).toMatch(/REVOKE ALL ON TABLE "Product" FROM anon/)
    expect(body).toMatch(/REVOKE ALL ON TABLE "Product" FROM authenticated/)
    expect(body).toMatch(/GRANT ALL ON TABLE "Product" TO postgres/)
    expect(body).toMatch(/GRANT ALL ON TABLE "Product" TO service_role/)
    const rb = fs.readFileSync(`${dir}/rollback.sql`, 'utf8')
    expect(rb).toContain('DROP COLUMN IF EXISTS "bgImageAiPrompt"')
    expect(fs.existsSync('scripts/ops/backup-product-image-fields-20261030.sh')).toBe(true)
  })
})

describe('stage 4: Unsplash provider', () => {
  const KEY = 'test-secret-key-123'
  const photo = {
    id: 'abc',
    width: 6000,
    height: 4000,
    urls: { raw: 'https://images.unsplash.com/photo-1?ixid=x' },
    links: { download_location: 'https://api.unsplash.com/photos/abc/download?ixid=x' },
  }
  it('disabled without env (no fetch)', async () => {
    const f = vi.fn()
    expect(await searchUnsplashHeroCandidates('Paris', 5, 'Paris', { env: {}, fetchImpl: f as never })).toEqual([])
    expect(await triggerUnsplashDownload(photo.links.download_location, { env: {}, fetchImpl: f as never })).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })
  it('Client-ID auth, hotlinked URL, download_location kept', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ results: [photo] }), { status: 200 }))
    const got = await searchUnsplashHeroCandidates('Paris', 5, 'Paris', { env: { UNSPLASH_ACCESS_KEY: KEY }, fetchImpl: f as never })
    expect(got[0]!.imageUrl.startsWith('https://images.unsplash.com/photo-1')).toBe(true)
    expect(got[0]!.imageUrl).toContain('w=2400')
    expect(got[0]!.width).toBe(2400)
    expect(got[0]!.downloadLocation).toBe(photo.links.download_location)
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>).Authorization).toBe(`Client-ID ${KEY}`)
    expect(JSON.stringify(got)).not.toContain(KEY)
  })
  it('download_location only to api.unsplash.com; errors never log key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = vi.fn(async () => {
      throw new Error(`boom Client-ID ${KEY}`)
    })
    expect(await triggerUnsplashDownload('https://evil.example/x', { env: { UNSPLASH_ACCESS_KEY: KEY }, fetchImpl: f as never })).toBe(false)
    expect(await triggerUnsplashDownload(photo.links.download_location, { env: { UNSPLASH_ACCESS_KEY: KEY }, fetchImpl: f as never })).toBe(false)
    expect(JSON.stringify(warn.mock.calls)).not.toContain(KEY)
    warn.mockRestore()
  })
  it('hotlink builder keeps API host', () => {
    expect(new URL(buildUnsplashHotlinkUrl(photo.urls.raw)).hostname).toBe('images.unsplash.com')
  })
})

describe('stage 4: live batches of 50 + 문과장 approval file', () => {
  const targets = Array.from({ length: 223 }, (_, i) => ({ productId: `id${i}`, slug: `pkg-${String(i).padStart(3, '0')}`, title: 't', currentUrl: `u${i}`, currentWidth: 940 }))
  it('splits 50/50/50/50/23 stably', () => {
    expect(splitIntoBatches(targets).map((b) => b.length)).toEqual([50, 50, 50, 50, 23])
    expect(batchFileNames(1).approved).toBe('batch-01-approved.json')
  })
  it('writes only with matching approved file', () => {
    const rows = targets.slice(0, 2).map((t, i) => buildBatchReviewRow(t, { source: 'pexels', url: `p${i}`, width: 2400, height: 1600 }))
    const review: BatchReviewFile = { kind: 'image-live-replace-review', batch: 1, batchSize: 50, totalTargets: 223, generatedAt: 'x', mode: 'dry-run', rows }
    const text = JSON.stringify(review)
    const ok = { kind: 'image-live-replace-approved' as const, batch: 1, reviewSha256: sha256Text(text), reviewer: '문과장', approvedAt: 'x', items: [{ productId: 'id0', proposedImageUrl: 'p0', approved: true }, { productId: 'id1', proposedImageUrl: 'p1', approved: false }] }
    const c = checkApprovedBatch(text, ok, 1)
    expect(c.ok && c.approvedRows.map((r) => r.productId)).toEqual(['id0'])
    expect(checkApprovedBatch(text, null, 1)).toEqual({ ok: false, reason: 'approved_file_missing' })
    expect(checkApprovedBatch(text + ' ', ok, 1)).toEqual({ ok: false, reason: 'review_file_changed_after_approval' })
    expect(checkApprovedBatch(text, { ...ok, batch: 2 }, 1)).toEqual({ ok: false, reason: 'batch_number_mismatch' })
    expect(checkApprovedBatch(text, { ...ok, items: [{ productId: 'id0', proposedImageUrl: 'other', approved: true }] }, 1)).toEqual({ ok: false, reason: 'no_approved_rows' })
  })
})
