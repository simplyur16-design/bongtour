import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/admin/marketing/curation-events/candidates/route'
import { POST as linkPost } from '@/app/api/admin/monthly-curation-contents/[id]/link-event/route'
import { DELETE as unlinkDelete } from '@/app/api/admin/monthly-curation-contents/[id]/link-event/[eventId]/route'

vi.mock('@/lib/require-admin', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/bong-marketing/curation-event-card-link', () => ({
  listCandidateCurationEventsForCard: vi.fn(),
  linkCurationEventToSeasonCard: vi.fn(),
  unlinkCurationEventFromSeasonCard: vi.fn(),
}))

import { requireAdmin } from '@/lib/require-admin'
import {
  listCandidateCurationEventsForCard,
  linkCurationEventToSeasonCard,
  unlinkCurationEventFromSeasonCard,
} from '@/lib/bong-marketing/curation-event-card-link'

const adminSession = { user: { id: 'admin-1' } }

describe('GET /api/admin/marketing/curation-events/candidates', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(listCandidateCurationEventsForCard).mockReset()
  })

  it('returns candidate events', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(listCandidateCurationEventsForCard).mockResolvedValue([
      {
        id: 'ev-1',
        name: '축제',
        countryCode: '베트남',
        startMonth: 7,
        endMonth: 7,
        type: 'festival',
        city: null,
        monthKey: '2026-07',
        linkedSeasonCard: null,
      },
    ])

    const res = await GET(
      new Request(
        'http://localhost/api/admin/marketing/curation-events/candidates?monthKey=2026-07&countryCode=베트남',
      ),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(1)
  })
})

describe('POST link-event', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(linkCurationEventToSeasonCard).mockReset()
  })

  it('links event to card', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(linkCurationEventToSeasonCard).mockResolvedValue({
      event: {
        id: 'ev-1',
        name: '축제',
        countryCode: '베트남',
        startMonth: 7,
        endMonth: 7,
        type: 'festival',
        city: null,
        monthKey: '2026-07',
      },
      previousCardId: 'old-card',
    })

    const res = await linkPost(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId: 'ev-1' }),
      }),
      { params: Promise.resolve({ id: 'card-1' }) },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.movedFromOtherCard).toBe(true)
  })
})

describe('DELETE link-event', () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset()
    vi.mocked(unlinkCurationEventFromSeasonCard).mockReset()
  })

  it('unlinks event from card', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminSession as never)
    vi.mocked(unlinkCurationEventFromSeasonCard).mockResolvedValue(undefined)

    const res = await unlinkDelete(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'card-1', eventId: 'ev-1' }),
    })
    expect(res.status).toBe(200)
    expect(unlinkCurationEventFromSeasonCard).toHaveBeenCalledWith('card-1', 'ev-1')
  })
})
