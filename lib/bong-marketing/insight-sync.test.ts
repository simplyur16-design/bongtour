import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bong-marketing/meta-token-manager', () => ({
  getValidMetaConnection: vi.fn(),
}))

import { getValidMetaConnection } from '@/lib/bong-marketing/meta-token-manager'
import { syncAllInsights } from '@/lib/bong-marketing/insight-sync'

describe('insight-sync', () => {
  beforeEach(() => {
    vi.mocked(getValidMetaConnection).mockReset()
  })

  it('returns zero counts when meta connection missing', async () => {
    vi.mocked(getValidMetaConnection).mockResolvedValue(null)
    const result = await syncAllInsights('manual')
    expect(result).toEqual({
      instagram: { synced: 0, errors: 0 },
      facebook: { synced: 0, errors: 0 },
    })
  })
})
