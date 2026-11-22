/**
 * 흑백 표시 글 사전 탈락. cmtczq 14일차(리우 예수상) 흑백 사진이 채도 판정(15.3>10)을 통과해 채워졌던 사례 고정.
 * REGRESSION-FREEZE[photo-monochrome-text-1122] — manifest
 */
import { describe, expect, it } from 'vitest'
import { candidateSaysMonochrome, textHasMonochromeMarker } from '@/lib/photo-monochrome-text-1122'
import { evaluateAutofillCandidate, PublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { sightProfile } from '@/lib/photo-autofill-sight'

const RIO = 'https://www.pexels.com/photo/iconic-christ-the-redeemer-statue-in-black-and-white-32097914/'

function cand(over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id: '32097914',
    source: 'Pexels',
    url: 'https://images.pexels.com/photos/32097914/pexels-photo-32097914.jpeg',
    width: 4000,
    height: 2600,
    photographer: 'Jane Doe',
    originalLink: 'https://www.pexels.com/photo/christ-the-redeemer-statue-rio-de-janeiro-32097914/',
    altText: 'Christ the Redeemer statue in Rio de Janeiro',
    tags: [],
    ...over,
  }
}

const gate = (c: AutofillCandidate) =>
  evaluateAutofillCandidate({
    candidate: c,
    sight: sightProfile('Christ the Redeemer'),
    cityTerms: ['rio de janeiro'],
    slotText: '리우데자네이루 - 코르코바도 예수상 Rio de Janeiro',
    slotKind: 'day',
    productId: 'cmtczq4fz0007g5lec5txhnsm',
    usage: new PublicPhotoUsage(),
  })

describe('흑백 표시 글', () => {
  it.each([
    RIO,
    'Old town in black and white',
    'Black & White street',
    'monochrome skyline',
    'Monochromatic view',
    'grayscale photo of bridge',
    'Greyscale cathedral',
    'sepia toned temple',
    'https://www.pexels.com/photo/bridge-b-w-123/',
    'https://www.pexels.com/photo/bw-photo-of-tower-456/',
    'B&W photo of a castle',
    'https://kr.object.ncloudstorage.com/bongtour/photo-pool/Rio_black_and_white_Pexels__abc.webp',
    'https://kr.object.ncloudstorage.com/bongtour/photo-pool/%ED%95%98%EB%85%B8%EC%9D%B4_Grayscale_Pexels__x.webp',
  ])('탈락: %s', (t) => {
    expect(textHasMonochromeMarker(t)).toBe(true)
  })

  it.each([
    'https://www.pexels.com/photo/scenic-view-of-limestone-islands-in-halong-bay-38116441/',
    'White Sands black rocks beach',
    'Black Forest and white houses',
    'BMW museum Munich',
    'Bwindi forest Uganda',
    'Plan B west gate',
    'Christ the Redeemer statue in Rio de Janeiro',
    'https://kr.object.ncloudstorage.com/bongtour/photo-pool/%ED%95%98%EB%85%B8%EC%9D%B4_Halong_Bay_Pexels__mwrjnaxl.webp',
    null,
    '',
  ])('통과: %s', (t) => {
    expect(textHasMonochromeMarker(t as string | null)).toBe(false)
  })
})

describe('자동 채움 관문: 내려받기 전 탈락', () => {
  it('cmtczq 리우: 원본 주소 slug 에 black-and-white → monochrome_text', () => {
    const v = gate(cand({ originalLink: RIO }))
    expect(v.ok).toBe(false)
    expect(v.reasons).toContain('monochrome_text')
  })

  it('같은 후보라도 흑백 표시가 없으면 이 사유로는 막지 않는다', () => {
    expect(gate(cand()).reasons).not.toContain('monochrome_text')
  })

  it('Unsplash 대체 문구·태그의 흑백 표시', () => {
    expect(gate(cand({ source: 'Unsplash', altText: 'Christ the Redeemer Rio de Janeiro grayscale photo' })).reasons).toContain('monochrome_text')
    expect(gate(cand({ source: 'Unsplash', tags: ['black and white', 'rio'] })).reasons).toContain('monochrome_text')
  })

  it('사진 풀 후보: 파일 이름·원본 주소로도 거른다', () => {
    const pool = cand({
      source: 'PhotoPool',
      url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/Christ_the_Redeemer_Rio_de_Janeiro_Pexels__mvx1.webp',
      originalLink: RIO,
      altText: 'Christ the Redeemer Rio de Janeiro',
    })
    expect(candidateSaysMonochrome(pool)).toBe(true)
    expect(gate(pool).reasons).toContain('monochrome_text')
    const byName = cand({ source: 'PhotoPool', url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/Christ_the_Redeemer_sepia_Pexels__q.webp', originalLink: null })
    expect(gate(byName).reasons).toContain('monochrome_text')
  })

  it('풀 보충 저장도 흑백 표시 글을 거른다(live-deps)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('lib/photo-autofill-live-deps.ts', 'utf8')
    expect(src).toMatch(/if \(candidateSaysMonochrome\(c\)\) return false\s*\n\s*if \(await isMonochromePhotoUrl\(c\.url\)\) return false/)
  })
})
