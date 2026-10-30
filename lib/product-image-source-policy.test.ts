import { describe, expect, it } from 'vitest'
import {
  EXISTING_ISTOCK_IMAGE_KEYS,
  evaluateImageCandidatePolicy,
  imageStorageKeyFromUrl,
  isAttributionRequiredLicense,
  isExistingIstockImage,
  orderImageCandidatesByPolicy,
  resolveImageAutoRegisterState,
} from '@/lib/product-image-source-policy'

const pexels = { source: 'pexels', url: 'https://x/a-pexels-1.webp', externalId: '1', originalLink: 'https://www.pexels.com/photo/1', photographer: 'A', width: 1920 }
const unsplash = { source: 'unsplash', url: 'https://x/u.webp', externalId: 'u1', originalLink: 'https://unsplash.com/photos/u1', photographer: 'B', width: 2000 }
const gen = { source: 'gemini', url: 'https://x/g-gemini-1.webp', isGenerated: true, prompt: 'Da Nang beach, no landmark', width: 1536 }

describe('image source policy (WORK-ORDER 8)', () => {
  it('Pexels first, then Unsplash/CC0, generated last', () => {
    const ordered = orderImageCandidatesByPolicy([gen, unsplash, pexels])
    expect(ordered.map((c) => c.source)).toEqual(['pexels', 'unsplash', 'gemini'])
  })
  it('rejects iStock and CC BY', () => {
    expect(evaluateImageCandidatePolicy({ source: 'istock', url: 'https://x/i.webp', width: 2000 }).fails).toContain('L2-ISTOCK')
    expect(evaluateImageCandidatePolicy({ source: 'wikimedia', url: 'https://x/w.jpg', license: 'CC BY-SA 4.0', originalLink: 'https://commons.wikimedia.org/x' }).pass).toBe(false)
    expect(isAttributionRequiredLicense('CC0 1.0')).toBe(false)
    expect(isAttributionRequiredLicense('CC BY 4.0')).toBe(true)
  })
  it('CC0 with source link passes, no credit required', () => {
    const r = evaluateImageCandidatePolicy({ source: 'wikimedia', license: 'CC0', url: 'https://x/c.jpg', originalLink: 'https://commons.wikimedia.org/c', width: 3000 })
    expect(r.pass).toBe(true)
    expect(r.tier).toBe('cc0')
    expect(r.creditRequired).toBe(false)
  })
  it('Pexels/Unsplash/CC0 pass without any source record (no attribution needed, 2026-10-30)', () => {
    const p = evaluateImageCandidatePolicy({ source: 'pexels', url: 'https://x/a-pexels-1.webp', width: 1920 })
    expect(p.pass).toBe(true)
    expect(p.creditRequired).toBe(false)
    expect(evaluateImageCandidatePolicy({ source: 'unsplash', url: 'https://x/u.webp', width: 2400 }).pass).toBe(true)
    expect(evaluateImageCandidatePolicy({ source: 'wikimedia', license: 'CC0', url: 'https://x/c.jpg', width: 3000 }).pass).toBe(true)
    expect(evaluateImageCandidatePolicy({ ...pexels, photographer: '', externalId: '', originalLink: '' }).fails).toEqual([])
  })
  it('"attribution not required" text is not read as CC BY', () => {
    for (const t of ['Attribution not required', 'attribution is not required', 'No attribution required', 'Free to use, attribution not required', 'Pexels License', 'Unsplash License']) {
      expect(isAttributionRequiredLicense(t)).toBe(false)
    }
    expect(evaluateImageCandidatePolicy({ ...pexels, license: 'Attribution not required' }).pass).toBe(true)
    expect(isAttributionRequiredLicense('CC BY-SA 4.0')).toBe(true)
    expect(isAttributionRequiredLicense('Creative Commons Attribution 2.0')).toBe(true)
  })
  it('small width fails T1; unknown width is "needs check", not a pass', () => {
    expect(evaluateImageCandidatePolicy({ ...pexels, width: 800 }).fails).toContain('T1-RES')
    const u = evaluateImageCandidatePolicy({ ...pexels, width: null })
    expect(u.pass).toBe(false)
    expect(u.fails).toEqual(['T1-RES-UNKNOWN'])
    expect(evaluateImageCandidatePolicy({ ...pexels, width: 0 }).fails).toContain('T1-RES-UNKNOWN')
    expect(evaluateImageCandidatePolicy({ ...pexels, width: 1200 }).pass).toBe(true)
  })
  it('existing iStock on the allowlist passes; new iStock and CC BY stay blocked', () => {
    expect(EXISTING_ISTOCK_IMAGE_KEYS.length).toBe(10)
    const url = 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/primary_hero_manual-upload__2b934e365a608dd9.webp'
    expect(imageStorageKeyFromUrl(url + '?v=2')).toBe('photo-pool/primary_hero_manual-upload__2b934e365a608dd9.webp')
    expect(isExistingIstockImage(url)).toBe(true)
    const kept = evaluateImageCandidatePolicy({ source: 'istock', url, width: 2000 })
    expect(kept.pass).toBe(true)
    expect(kept.tier).toBe('istock_existing')
    const fresh = evaluateImageCandidatePolicy({ source: 'istock', url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/new-istock-1__abc.webp', width: 2000 })
    expect(fresh.fails).toContain('L2-ISTOCK')
    expect(evaluateImageCandidatePolicy({ source: 'istock', url: 'https://x/other.webp', width: 2000 }).pass).toBe(false)
    expect(evaluateImageCandidatePolicy({ source: 'wikimedia', url: 'https://x/w.jpg', license: 'CC BY 4.0', width: 3000 }).fails).toContain('L2-CC-BY')
  })
  it('existing iStock is never ranked as a new candidate ahead of Pexels', () => {
    const url = 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/primary_hero_manual-upload__2b934e365a608dd9.webp'
    const ordered = orderImageCandidatesByPolicy([{ source: 'istock', url, width: 2000 }, pexels])
    expect(ordered[0].source).toBe('pexels')
  })
  it('generated needs prompt record and AI label', () => {
    expect(evaluateImageCandidatePolicy({ ...gen, prompt: '' }).fails).toContain('L3-GEN-NO-RECORD')
    expect(evaluateImageCandidatePolicy(gen).aiLabelRequired).toBe(true)
  })
  it('new public images wait for 문과장 review; 5 fails -> image waiting', () => {
    expect(resolveImageAutoRegisterState({ attempts: 1, anyPolicyPass: true, reviewApproved: false })).toBe('awaiting_review')
    expect(resolveImageAutoRegisterState({ attempts: 5, anyPolicyPass: false, reviewApproved: false })).toBe('image_waiting')
    expect(resolveImageAutoRegisterState({ attempts: 2, anyPolicyPass: true, reviewApproved: true })).toBe('approved')
  })
})
