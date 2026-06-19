import { describe, expect, it, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/admin/marketing/global-events/refresh/route'
import { GET } from '@/app/api/admin/marketing/global-events/target-countries/route'

vi.mock('@/lib/require-admin', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/bong-marketing/curation-event-collector', () => ({
  refreshCurationEvents: vi.fn(),
}))

vi.mock('@/lib/bong-marketing/curation-event-target-countries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bong-marketing/curation-event-target-countries')>()
  return {
    ...actual,
    previewCurationEventTargetCountries: vi.fn(),
  }
})

import { requireAdmin } from '@/lib/require-admin'
import { refreshCurationEvents } from '@/lib/bong-marketing/curation-event-collector'
import { previewCurationEventTargetCountries } from '@/lib/bong-marketing/curation-event-target-countries'

const adminSession = { user: { id: 'admin-1' } }

describe('POST /api/admin/marketing/global-events/refresh', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(refreshCurationEvents).mockReset()
  })

  it('returns 403 without admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null as never)
    const res = await POST(new Request('http://localhost', { method: 'POST' }))
    expect(res.status).toBe(403)
  })

  it('defaults to legacy all_products when body is empty', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(refreshCurationEvents).mockResolvedValue({
      countries: ['일본'],
      collected: 0,
      saved: 0,
      skippedDuplicates: 0,
      errors: 0,
      errorDetails: [],
      batchesRun: 0,
      targetMode: 'all_products',
    } as never)

    const res = await POST(new Request('http://localhost', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(refreshCurationEvents).toHaveBeenCalledWith({})
  })

  it('passes targetMode and targetCountries to collector', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(refreshCurationEvents).mockResolvedValue({
      countries: ['일본', '베트남'],
      collected: 1,
      saved: 1,
      skippedDuplicates: 0,
      errors: 0,
      errorDetails: [],
      batchesRun: 1,
      targetMode: 'recommendation',
    } as never)

    const res = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetMode: 'recommendation',
          targetCountries: ['일본', '베트남'],
        }),
      }),
    )
    expect(res.status).toBe(200)
    expect(refreshCurationEvents).toHaveBeenCalledWith({
      targetMode: 'recommendation',
      targetCountries: ['일본', '베트남'],
    })
  })
})

describe('GET /api/admin/marketing/global-events/target-countries', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(previewCurationEventTargetCountries).mockReset()
  })

  it('returns preview countries', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(previewCurationEventTargetCountries).mockResolvedValue({
      targetMode: 'curation',
      countries: ['베트남', '프랑스'],
    })

    const res = await GET(
      new Request('http://localhost/api/admin/marketing/global-events/target-countries?targetMode=curation'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.count).toBe(2)
    expect(json.countries).toEqual(['베트남', '프랑스'])
  })
})
