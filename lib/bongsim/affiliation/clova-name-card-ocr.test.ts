import { describe, expect, it } from 'vitest'
import { parseClovaNameCardFields } from '@/lib/bongsim/affiliation/clova-name-card-ocr'

// REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: parseClovaNameCardFields — manifest

describe('parseClovaNameCardFields', () => {
  it('reads nameCard.result text arrays', () => {
    const fields = parseClovaNameCardFields({
      images: [
        {
          nameCard: {
            result: {
              name: [{ text: '홍길동' }],
              company: [{ text: '경기도의회' }],
              email: [{ text: 'hong@example.go.kr' }],
              mobile: [{ text: '010-1234-5678' }],
              position: [{ text: '주무관' }],
            },
          },
        },
      ],
    })
    expect(fields.name).toBe('홍길동')
    expect(fields.company).toBe('경기도의회')
    expect(fields.email).toBe('hong@example.go.kr')
    expect(fields.phone).toBe('010-1234-5678')
    expect(fields.position).toBe('주무관')
  })

  it('returns nulls when empty', () => {
    expect(parseClovaNameCardFields(null)).toEqual({
      name: null,
      company: null,
      email: null,
      phone: null,
      position: null,
    })
  })
})
