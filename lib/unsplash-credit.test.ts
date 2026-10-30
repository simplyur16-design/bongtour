import { describe, expect, it } from 'vitest'
import fs from 'fs'
import { isUnsplashProfileUrl, resolveUnsplashCredit, unsplashCreditReviewText, withUnsplashUtm } from '@/lib/unsplash-credit'
import { evaluateImageCandidatePolicy } from '@/lib/product-image-source-policy'
import {
  backfillCreditFieldsFor,
  batchReviewCsv,
  buildBatchReviewRow,
  checkApprovedBatch,
  classifyBackfillRow,
  sha256Text,
} from '@/lib/product-image-backfill-plan'
import { applyAutoCoverDecisionToUpdateData, decideAutoCoverWrite } from '@/lib/product-image-auto-register-gate'
import { searchUnsplashHeroCandidates } from '@/lib/unsplash-service'

const HOT = 'https://images.unsplash.com/photo-1?w=2400&fm=jpg'

describe('Unsplash credit (사장님 10/30 ①, 10/25 photo rule)', () => {
  it('credit only for Unsplash with author+profile, utm on both links', () => {
    const c = resolveUnsplashCredit({ source: 'unsplash', photographer: 'Jane Doe', profileUrl: 'https://unsplash.com/@jane', imageUrl: HOT })
    expect(c?.text).toBe('Photo: Jane Doe / Unsplash')
    expect(c?.authorHref).toBe('https://unsplash.com/@jane?utm_source=bongtour&utm_medium=referral')
    expect(c?.unsplashHref).toBe('https://unsplash.com/?utm_source=bongtour&utm_medium=referral')
  })
  it('no credit for Pexels, own photo, CC0, existing iStock, or missing data', () => {
    const base = { photographer: 'Jane', profileUrl: 'https://unsplash.com/@jane' }
    for (const source of ['pexels', 'photo_owned', 'manual', 'cc0', 'istock', 'gemini', null]) {
      expect(resolveUnsplashCredit({ ...base, source, imageUrl: 'https://cdn.bongtour.com/a-pexels-1.webp' })).toBeNull()
    }
    expect(resolveUnsplashCredit({ source: 'unsplash', photographer: '', profileUrl: 'https://unsplash.com/@jane', imageUrl: HOT })).toBeNull()
    expect(resolveUnsplashCredit({ source: 'unsplash', photographer: 'J', profileUrl: 'https://unsplash.com/photos/abc', imageUrl: HOT })).toBeNull()
  })
  it('card: only when the displayed image is the cover itself', () => {
    const p = { source: 'unsplash', photographer: 'J', profileUrl: 'https://unsplash.com/@j', imageUrl: HOT }
    expect(resolveUnsplashCredit({ ...p, displayedUrl: HOT })).not.toBeNull()
    expect(resolveUnsplashCredit({ ...p, displayedUrl: 'https://cdn/day1.webp' })).toBeNull()
  })
  it('profile url check + utm replace', () => {
    expect(isUnsplashProfileUrl('https://unsplash.com/@a_b')).toBe(true)
    expect(isUnsplashProfileUrl('http://unsplash.com/@a')).toBe(false)
    expect(isUnsplashProfileUrl('https://evil.com/@a')).toBe(false)
    expect(withUnsplashUtm('https://unsplash.com/@a?utm_source=x')).toBe('https://unsplash.com/@a?utm_source=bongtour&utm_medium=referral')
  })
  it('policy: Unsplash fails without credit data, passes and requires credit with it; Pexels never requires credit', () => {
    expect(evaluateImageCandidatePolicy({ source: 'unsplash', url: HOT, width: 2400, photographer: 'J' }).fails).toContain('L1-UNSPLASH-NO-CREDIT')
    const ok = evaluateImageCandidatePolicy({ source: 'unsplash', url: HOT, width: 2400, photographer: 'J', authorProfileUrl: 'https://unsplash.com/@j' })
    expect(ok.pass && ok.creditRequired).toBe(true)
    expect(evaluateImageCandidatePolicy({ source: 'pexels', url: 'https://x/a-pexels-1.webp', width: 2000 }).creditRequired).toBe(false)
  })
  it('stored Unsplash row (bgImagePhotographer + bgImageSourceUrl) classifies ok; missing profile → replace', () => {
    const row = { id: '1', slug: 's', registrationStatus: 'registered', bgImageUrl: HOT, bgImageSource: 'unsplash', bgImageWidth: 2400, bgImageIsGenerated: false }
    expect(classifyBackfillRow({ ...row, bgImagePhotographer: 'J', bgImageSourceUrl: 'https://unsplash.com/@j' }).action).toBe('ok')
    expect(classifyBackfillRow({ ...row, bgImagePhotographer: 'J', bgImageSourceUrl: null }).action).toBe('replace_cover')
  })
  it('review rows carry credit text; Unsplash rows without credit are never applied', () => {
    const t = { productId: 'p1', slug: 'a', title: 't', currentUrl: 'c', currentWidth: 800 }
    const u = buildBatchReviewRow(t, { source: 'unsplash', url: HOT, width: 2400, height: 1600, unsplashId: 'abc', unsplashAuthorName: 'Jane', unsplashAuthorProfileUrl: 'https://unsplash.com/@jane' })
    expect(u.creditText).toBe('Photo: Jane / Unsplash (https://unsplash.com/@jane?utm_source=bongtour&utm_medium=referral)')
    const px = buildBatchReviewRow({ ...t, productId: 'p2' }, { source: 'pexels', url: 'https://images.pexels.com/1.jpg', width: 2000, height: 1300 })
    expect(px.creditText).toBe('')
    const bad = buildBatchReviewRow({ ...t, productId: 'p3' }, { source: 'unsplash', url: HOT + '&x=1', width: 2400, height: 1600 })
    expect(bad.creditText).toBe('MISSING_CREDIT')
    expect(batchReviewCsv([u]).split('\n')[0]).toContain('creditText')
    const review = JSON.stringify({ kind: 'image-live-replace-review', batch: 1, rows: [u, px, bad] })
    const chk = checkApprovedBatch(review, {
      kind: 'image-live-replace-approved', batch: 1, reviewSha256: sha256Text(review), reviewer: '문과장', approvedAt: 'x',
      items: [u, px, bad].map((r) => ({ productId: r.productId, proposedImageUrl: r.proposedImageUrl!, approved: true })),
    }, 1)
    expect(chk.ok && chk.approvedRows.map((r) => r.productId)).toEqual(['p1', 'p2'])
    expect(unsplashCreditReviewText({ source: 'pexels' })).toBe('')
  })
  it('write values: Unsplash → author/profile/id in existing columns; Pexels → cleared', () => {
    expect(backfillCreditFieldsFor({ source: 'unsplash', unsplashId: 'abc', unsplashAuthorName: 'J', unsplashAuthorProfileUrl: 'https://unsplash.com/@j' })).toEqual({
      bgImagePhotographer: 'J', bgImageSourceUrl: 'https://unsplash.com/@j', bgImageExternalId: 'abc',
    })
    expect(backfillCreditFieldsFor({ source: 'pexels' })).toEqual({ bgImagePhotographer: null, bgImageSourceUrl: null, bgImageExternalId: null })
  })
  it('auto-register gate keeps Unsplash credit, drops Pexels credit', () => {
    const cand = { source: 'unsplash', url: HOT, width: 2400, photographer: 'J', authorProfileUrl: 'https://unsplash.com/@j' }
    const d = decideAutoCoverWrite({ enabled: true, registrationStatus: 'pending', currentCoverUrl: null, currentCoverSource: null, candidate: cand })
    const out = applyAutoCoverDecisionToUpdateData({ bgImageUrl: HOT, bgImagePhotographer: 'x' }, d, { width: 2400, height: 1600 }, null, new Date(), {
      authorName: 'J', authorProfileUrl: 'https://unsplash.com/@j', externalId: 'abc',
    })
    expect(out).toMatchObject({ bgImagePhotographer: 'J', bgImageSourceUrl: 'https://unsplash.com/@j', bgImageExternalId: 'abc' })
    const dp = decideAutoCoverWrite({ enabled: true, registrationStatus: 'pending', currentCoverUrl: null, currentCoverSource: null, candidate: { source: 'pexels', url: 'https://x/a-pexels-1.webp', width: 2000 } })
    const op = applyAutoCoverDecisionToUpdateData({ bgImageUrl: 'u', bgImagePhotographer: 'x' }, dp, { width: 2000, height: 1300 })
    expect('bgImagePhotographer' in op).toBe(false)
  })
  it('search returns author name + profile', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({ results: [{ id: 'abc', width: 4000, height: 3000, urls: { raw: 'https://images.unsplash.com/photo-1?ixid=x' }, links: { download_location: 'https://api.unsplash.com/photos/abc/download' }, user: { name: 'Jane', username: 'jane', links: { html: 'https://unsplash.com/@jane' } } }] }),
    })) as unknown as typeof fetch
    const got = await searchUnsplashHeroCandidates('kyoto', 1, 'kyoto', { env: { UNSPLASH_ACCESS_KEY: 'test-key' }, fetchImpl })
    expect(got[0]).toMatchObject({ authorName: 'Jane', authorProfileUrl: 'https://unsplash.com/@jane' })
  })
  it('credit component is wired into hero carousel and cards', () => {
    expect(fs.readFileSync('app/components/detail/ProductHeroCarousel.tsx', 'utf8')).toContain('<UnsplashPhotoCredit credit={heroUnsplashCredit} />')
    expect(fs.readFileSync('components/products/ProductResultsList.tsx', 'utf8')).toContain('<UnsplashPhotoCredit credit={item.coverImageUnsplashCredit} insideLink />')
    expect(fs.readFileSync('lib/products-browse-build-payload.ts', 'utf8')).toContain('resolveUnsplashCredit({')
  })
})
