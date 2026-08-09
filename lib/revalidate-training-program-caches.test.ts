import { describe, expect, it, vi, beforeEach } from 'vitest'

const revalidatePathMock = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}))

describe('revalidateTrainingProgramListingCaches', () => {
  beforeEach(() => {
    revalidatePathMock.mockReset()
  })

  it('busts business hub and programs catalog paths', async () => {
    const { revalidateTrainingProgramListingCaches } = await import(
      './revalidate-training-program-caches'
    )
    revalidateTrainingProgramListingCaches()
    expect(revalidatePathMock).toHaveBeenCalledWith('/business')
    expect(revalidatePathMock).toHaveBeenCalledWith('/business/programs')
    expect(revalidatePathMock).toHaveBeenCalledWith('/training')
  })
})
