import { describe, expect, it } from 'vitest'
import { isBrokenRegisterLandmarkKeyword } from '@/lib/register-pre-photo-guards'
import { isLikelyTourismLandmarkKeyword } from '@/lib/pexels-place-name-keyword'

describe('현지어 명소 이름은 2단어여도 랜드마크(키워드막힘 원인 수정)', () => {
  it.each(['Wat Pho', 'Wat Chedi Luang', 'Wat Phra Singh', 'Doi Suthep', 'King Power Mahanakhon', 'Kinkaku-ji Kyoto', 'Schloss Schonbrunn'])(
    '%s 는 지우지 않는다',
    (kw) => {
      expect(isLikelyTourismLandmarkKeyword(kw)).toBe(true)
      expect(isBrokenRegisterLandmarkKeyword(kw)).toBe(false)
    },
  )
  it('식당·호텔·상점은 그대로 막는다', () => {
    expect(isBrokenRegisterLandmarkKeyword('Pho Shop Hanoi')).toBe(true)
    expect(isBrokenRegisterLandmarkKeyword('Hilton Hotel')).toBe(true)
    expect(isBrokenRegisterLandmarkKeyword('Blue Bistro')).toBe(true)
  })
})
