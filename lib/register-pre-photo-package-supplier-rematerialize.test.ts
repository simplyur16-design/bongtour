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

  it('accepts POI-rich days whose return line is supplier text', () => {
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
          description: '홍콩 국제공항 출발 → 대구 국제공항 도착',
          routeText: '홍콩 - 대구',
        },
      ]),
    ).toBe(false)
  })

  it('one invented return sentence is enough to rebuild from supplier facts', () => {
    const days = Array.from({ length: 10 }, (_, i) => ({
      day: i + 1,
      title: i === 9 ? '귀국' : `명소 ${i + 1}`,
      description:
        i === 9
          ? '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.'
          : `명소 ${i + 1}을 둘러봅니다. 다음 장소를 이어서 방문합니다.`,
      routeText: i === 9 ? '인천' : `명소 ${i + 1} - 광장`,
    }))
    expect(registerPrePhotoPackageScheduleLooksThin(days)).toBe(true)
  })
})

describe('registerPrePhotoIssuesNeedLaneRematerialize thin filler', () => {
  it('includes description_filler for package supplier remat path', () => {
    expect(registerPrePhotoIssuesNeedLaneRematerialize(['day2_description_filler_or_duplicate'])).toBe(true)
    expect(registerPrePhotoIssuesNeedLaneRematerialize(['theme_tag_missing'])).toBe(false)
  })
})
