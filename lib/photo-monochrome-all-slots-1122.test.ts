import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { acquireVerifiedPhoto, type AcquireDeps, type AcquireInput } from '@/lib/photo-autofill-acquire'
import { PublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { chainCandidateTextBlockReason } from '@/lib/register-photo-source-chain'
import { isMonochromeImageBuffer } from '@/lib/register-photo-monochrome'

function cand(id: string): AutofillCandidate {
  return {
    id,
    source: 'Pexels',
    url: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg`,
    width: 4000,
    height: 2600,
    photographer: 'Jane Doe',
    originalLink: `https://www.pexels.com/photo/blue-mosque-in-istanbul-${id}/`,
    altText: 'Blue Mosque in Istanbul at sunset',
    tags: [],
  }
}

const input = (kind: 'day' | 'cover'): AcquireInput => ({
  productId: 'p-bw',
  kind,
  day: kind === 'day' ? 2 : null,
  dayFacts: { title: '이스탄불', routeText: '이스탄불 - 블루모스크 - 그랜드바자르', description: null, imageKeyword: null, imageKeyword2: null },
  cityTerms: ['istanbul'],
  destinationText: '이스탄불 터키 istanbul',
  usage: new PublicPhotoUsage(),
  origin: 'autofill',
})

function deps(mono: Set<string>, commits: string[]): AcquireDeps {
  return {
    stockStopped: () => false,
    pause: async () => {},
    search: async (tier) => (tier === 'pexels' ? [cand('1'), cand('2')] : []),
    isMonochrome: async (c) => mono.has(c.id),
    commit: async (c) => {
      commits.push(c.id)
      return { ok: true, url: `https://cdn.example.com/photo-pool/${c.id}.webp`, bytes: 150_000, width: 1800, source: c.source, photographer: '', originalLink: '', externalId: c.id }
    },
  }
}

describe('흑백 사진: 대표·일차 모두 금지(사장님 11/22)', () => {
  for (const kind of ['day', 'cover'] as const) {
    for (const [bw, ok] of [['1', '2'], ['2', '1']] as const) {
      it(`${kind}: 흑백 후보(${bw})는 저장하지 않고 컬러 후보(${ok})를 쓴다`, async () => {
        const commits: string[] = []
        const r = await acquireVerifiedPhoto(input(kind), deps(new Set([bw]), commits))
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.photo.externalId).toBe(ok)
        expect(commits).not.toContain(bw)
      })
    }
  }
  it('후보가 모두 흑백이면 채택하지 않는다', async () => {
    const commits: string[] = []
    const r = await acquireVerifiedPhoto(input('cover'), deps(new Set(['1', '2']), commits))
    expect(r.ok).toBe(false)
    expect(commits).toEqual([])
  })
  it('설명에 흑백이라고 적힌 후보는 일차 칸에서도 뺀다', () => {
    expect(chainCandidateTextBlockReason({ altText: 'black and white photo of Sydney Tower' }, 'day')).toBe('day_monochrome')
    expect(chainCandidateTextBlockReason({ altText: 'black and white photo of Sydney Tower' }, 'main')).toBe('main_monochrome')
    expect(chainCandidateTextBlockReason({ altText: 'Sydney Tower at dusk' }, 'day')).toBeNull()
  })
  it('생성 이미지 버퍼도 흑백을 판정한다', async () => {
    const gray = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 120, g: 120, b: 120 } } }).png().toBuffer()
    const color = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 30, g: 120, b: 220 } } }).png().toBuffer()
    expect(await isMonochromeImageBuffer(gray)).toBe(true)
    expect(await isMonochromeImageBuffer(color)).toBe(false)
  })
})
