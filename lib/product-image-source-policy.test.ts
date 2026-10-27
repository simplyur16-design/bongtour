import { describe, expect, it } from 'vitest'
import {
  evaluateImageCandidatePolicy,
  isAttributionRequiredLicense,
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
  it('Pexels without ID/link/photographer fails L1; small width fails T1', () => {
    expect(evaluateImageCandidatePolicy({ ...pexels, photographer: '' }).fails).toContain('L1-NO-RECORD')
    expect(evaluateImageCandidatePolicy({ ...pexels, width: 800 }).fails).toContain('T1-RES')
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
