import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatPrePhotoBlockedReason } from '@/lib/register-pre-photo-pending-queue'

describe('pre_photo_blocked reason', () => {
  it('keeps verify issues and never stores an empty reason', () => {
    expect(formatPrePhotoBlockedReason(['일정 키워드 없음', '  '])).toBe('일정 키워드 없음')
    expect(formatPrePhotoBlockedReason([])).toBe('검증 미통과')
    expect(formatPrePhotoBlockedReason([''])).toBe('검증 미통과')
    expect(formatPrePhotoBlockedReason(['x'.repeat(800)]).length).toBe(500)
  })

  it('writes the reason when heal blocks or holds a product off the queue', () => {
    const src = readFileSync('lib/register-pending-pre-photo-self-heal.ts', 'utf8')
    expect(src).toContain('formatPrePhotoBlockedReason(verify.issues)')
    expect(src).toContain('autoRegisterBlockReason: formatPrePhotoBlockedReason([reason])')
    expect(src).toContain("holdOffPendingQueueIfNotPublic(product.id, '검증 중 오류')")
  })
})
