import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/gemini-curation', () => ({
  generateMonthlyCuration: vi.fn(),
}))

import { generateMonthlyCuration } from '@/lib/gemini-curation'
import { ensureHomeSeasonMonthlyCurationDrafts } from '@/lib/instrumentation-curation-cron'

describe('ensureHomeSeasonMonthlyCurationDrafts idempotency', () => {
  beforeEach(() => {
    vi.mocked(generateMonthlyCuration).mockReset()
    process.env.GEMINI_API_KEY = 'test-key'
    process.env.DATABASE_URL = 'postgresql://example.invalid/db'
  })

  it('calls generate with overwrite false for each display month and treats EXISTS as safe skip', async () => {
    vi.mocked(generateMonthlyCuration)
      .mockResolvedValueOnce({ ok: true, targetMonth: '2026-11', created: 3, items: [] })
      .mockResolvedValueOnce({
        ok: false,
        error: 'already exists',
        code: 'EXISTS',
      })
      .mockResolvedValueOnce({ ok: true, targetMonth: '2027-01', created: 2, items: [] })
      .mockResolvedValueOnce({
        ok: false,
        error: 'already exists',
        code: 'EXISTS',
      })

    const summary = await ensureHomeSeasonMonthlyCurationDrafts('2026-11')
    expect(summary.monthKeys).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(vi.mocked(generateMonthlyCuration).mock.calls.map((c) => c[0])).toEqual(summary.monthKeys)
    expect(vi.mocked(generateMonthlyCuration).mock.calls.every((c) => c[1]?.overwrite === false)).toBe(
      true,
    )
    expect(summary.results.map((r) => r.status)).toEqual(['created', 'exists', 'created', 'exists'])

    // second run: all EXISTS → no overwrite conflict
    vi.mocked(generateMonthlyCuration).mockReset()
    vi.mocked(generateMonthlyCuration).mockResolvedValue({
      ok: false,
      error: 'already exists',
      code: 'EXISTS',
    })
    const again = await ensureHomeSeasonMonthlyCurationDrafts('2026-11')
    expect(again.results.every((r) => r.status === 'exists')).toBe(true)
  })

  it('skips without calling Gemini when keys missing', async () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.GOOGLE_API_KEY
    const summary = await ensureHomeSeasonMonthlyCurationDrafts('2026-11')
    expect(vi.mocked(generateMonthlyCuration)).not.toHaveBeenCalled()
    expect(summary.results.every((r) => r.status === 'skipped')).toBe(true)
  })
})
