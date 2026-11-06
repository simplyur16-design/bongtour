import { describe, expect, it } from 'vitest'
import { registerPrePhotoPackageScheduleLooksThin } from '@/lib/register-pre-photo-package-supplier-rematerialize'
import { registerPrePhotoIssuesNeedLaneRematerialize } from '@/lib/register-pre-photo-lane-rematerialize'

describe('registerPrePhotoPackageScheduleLooksThin', () => {
  it('flags null titles and characteristic filler with sparse route', () => {
    expect(
      registerPrePhotoPackageScheduleLooksThin([
        {
          day: 1,
          title: null,
          description:
            '인천에서 출발해 Hong Kong에서 도착합니다. Hong Kong에서 첫날 일정을 이어갑니다. 첫날 리듬을 맞추며 일정을 이어갑니다.',
          routeText: 'Hong Kong',
        },
        {
          day: 2,
          title: null,
          description: '홍콩을 둘러봅니다. 홍콩에서 주변을 이어서 둘러봅니다.',
          routeText: '홍콩',
        },
        {
          day: 3,
          title: null,
          description: 'Hong Kong에서 일정을 마무리한 뒤 귀국 이동으로 이어갑니다.',
          routeText: 'Hong Kong',
        },
      ]),
    ).toBe(true)
  })

  it('accepts POI-rich days', () => {
    expect(
      registerPrePhotoPackageScheduleLooksThin([
        {
          day: 2,
          title: '황거 · 이중교',
          description: '황거와 이중교를 둘러봅니다. 메이지신궁을 이어서 방문합니다.',
          routeText: '황거 - 이중교 - 메이지신궁',
        },
        {
          day: 3,
          title: '귀국',
          description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
          routeText: '인천',
        },
      ]),
    ).toBe(false)
  })
})

describe('registerPrePhotoIssuesNeedLaneRematerialize thin filler', () => {
  it('includes description_filler for package supplier remat path', () => {
    expect(registerPrePhotoIssuesNeedLaneRematerialize(['day2_description_filler_or_duplicate'])).toBe(true)
    expect(registerPrePhotoIssuesNeedLaneRematerialize(['theme_tag_missing'])).toBe(false)
  })
})
