/**
 * REGRESSION-FREEZE[register-pre-photo-no-invent-without-route]
 */
import { describe, expect, it } from 'vitest'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'
import { verifyRegisterPrePhoto } from '@/lib/register-pre-photo-verify'

describe('register-pre-photo-no-invent-without-route', () => {
  it('does not invent keyword or description when middle route is empty', () => {
    const { rows, notes } = healRegisterPrePhotoSchedule(
      [
        {
          day: 1,
          routeText: '인천 - 장가계',
          imageKeyword: 'Zhangjiajie',
          description: '인천에서 출발해 장가계에 도착합니다. 첫날 일정을 이어갑니다.',
        },
        {
          day: 2,
          routeText: '',
          imageKeyword: 'Zhangjiajie Avatar mountains',
          description: '현지에서 첫날 일정을 이어갑니다. 첫날 리듬을 맞추며 일정을 이어갑니다.',
        },
        {
          day: 3,
          routeText: '천문산',
          imageKeyword: 'Tianmen Mountain',
          description: '천문산을 둘러봅니다. 동선에 맞춰 하루 일정을 이어갑니다.',
        },
        {
          day: 4,
          routeText: '장가계 - 인천',
          imageKeyword: 'Zhangjiajie',
          description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
        },
      ],
      {
        supplierKey: 'kyowontour',
        productDestination: '장가계',
        productTitle: '장가계 4일',
        lane: 'package',
      },
    )
    const day2 = rows.find((r) => Number(r.day) === 2)
    expect(String(day2?.routeText ?? '').trim()).toBe('')
    expect(String(day2?.imageKeyword ?? '').trim()).toBe('')
    // dest/prior로 route를 채웠다는 note가 없어야 함
    expect(notes.some((n) => /dest|prior|empty_route/i.test(n.reason))).toBe(false)
  })

  it('verify fails keyword_without_route and route_empty on empty departure route', () => {
    const v = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '장가계 4일',
      productDestination: '장가계',
      rows: [
        {
          day: 1,
          routeText: '',
          imageKeyword: 'Zhangjiajie',
          description: '인천에서 출발해 현지에서 도착합니다. 현지에서 첫날 일정을 이어갑니다.',
        },
        {
          day: 2,
          routeText: '천문산',
          imageKeyword: 'Tianmen Mountain',
          description: '천문산을 둘러봅니다. 전망을 천천히 즐기며 하루를 이어갑니다.',
        },
        {
          day: 3,
          routeText: '황룡동굴',
          imageKeyword: 'Huanglong Cave',
          description: '황룡동굴을 둘러봅니다. 동선을 천천히 이어 갑니다.',
        },
        {
          day: 4,
          routeText: '장가계 - 인천',
          imageKeyword: 'Zhangjiajie',
          description: '체크아웃 후 인천으로 귀국합니다. 이동 중심으로 여행을 마무리합니다.',
        },
      ],
    })
    expect(v.ok).toBe(false)
    expect(v.issues.some((i) => i === 'day1_route_empty' || i === 'day1_keyword_without_route')).toBe(
      true,
    )
  })
})
