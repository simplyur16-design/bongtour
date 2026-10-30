import { describe, expect, it } from 'vitest'
import { dayPhotoAiLabel, DAY_PHOTO_AI_LABEL_KO } from '@/lib/register-day-photo-ai-label'
import { checkDayPhotoPolicy } from '@/lib/register-day-photo-policy'

const now = new Date('2026-10-31T00:00:00.000Z')

describe('register-day-photo-ai-label', () => {
  it('labels Gemini day photos with the exact prompt', () => {
    const l = dayPhotoAiLabel({ source: 'Gemini' }, 'Photorealistic travel photo of Dragon Bridge', 'Dragon Bridge', now)
    expect(l).toEqual({
      isGenerated: true,
      prompt: 'Photorealistic travel photo of Dragon Bridge',
      promptRecorded: 'exact',
      labeledAt: '2026-10-31T00:00:00.000Z',
      aiLabel: DAY_PHOTO_AI_LABEL_KO,
    })
  })
  it('falls back to the keyword when the prompt is unknown', () => {
    expect(dayPhotoAiLabel({ source: 'Gemini' }, null, 'Ba Na Hills', now)?.promptRecorded).toBe('keyword')
  })
  it('does not label stock photos', () => {
    expect(dayPhotoAiLabel({ source: 'Pexels' }, 'x', 'y', now)).toBeNull()
    expect(dayPhotoAiLabel({ source: 'Unsplash' }, 'x', 'y', now)).toBeNull()
  })
  it('labelled generated day photos pass the policy; unlabelled ones do not', () => {
    const base = { url: 'https://cdn.example/d-gemini-1.webp', source: 'Gemini', width: 1600, bytes: 200_000 }
    expect(checkDayPhotoPolicy({ ...base, isGenerated: true, prompt: 'p' }).ok).toBe(true)
    expect(checkDayPhotoPolicy(base).reasons).toContain('policy:L3-GEN-NO-RECORD')
  })
})
