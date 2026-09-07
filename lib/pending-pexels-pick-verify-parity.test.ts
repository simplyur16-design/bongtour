/**
 * 등록대기 Pexels 후보 클릭 저장 — 일정사진 POST가 큐와 같은 title·dest로 검증해야 한다.
 * REGRESSION-FREEZE[pending-pexels-pick-verify-parity]: title 생략 시 title_placeholder — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  scheduleRowsForPrePhotoVerify,
  verifyRegisterPrePhoto,
  verifyRegisterPrePhotoForStoredProduct,
} from '@/lib/register-pre-photo-verify'

const TITLE = '오사카/와카야마/교토 4일'
const DESTINATION = '오사카'
const SCHEDULE = JSON.stringify([
  {
    day: 1,
    title: '인천 출발',
    description: '인천에서 출발해 오사카에 도착합니다.',
    routeText: 'ICN - KIX',
    imageKeyword: 'Osaka Castle',
  },
  {
    day: 2,
    title: '와카야마',
    description: '와카야마성을 둘러본 뒤 시내를 걷습니다.',
    routeText: 'Wakayama Castle - Wakayama',
    imageKeyword: 'Wakayama Castle',
    imageKeyword2: 'Wakayama',
  },
  {
    day: 3,
    title: '교토',
    description: '아라시야마와 교토 시내를 잇습니다.',
    routeText: 'Arashiyama - Kyoto',
    imageKeyword: 'Arashiyama',
    imageKeyword2: 'Kiyomizu-dera',
  },
  {
    day: 4,
    title: '귀국',
    description: '오사카에서 출발해 인천에 도착합니다.',
    routeText: 'KIX - ICN',
    imageKeyword: 'Osaka Castle',
  },
])

const stored = {
  listingKind: 'package',
  productType: 'package',
  sportsThemeTag: [] as string[],
  schedule: SCHEDULE,
  destination: DESTINATION,
  title: TITLE,
}

describe('pending-pexels-pick-verify-parity', () => {
  it('title을 빼면 빈 제목이 title_placeholder가 되어 사진 저장 게이트가 막힌다', () => {
    const missingTitle = verifyRegisterPrePhoto({
      lane: 'package',
      listingKind: stored.listingKind,
      productType: stored.productType,
      sportsThemeTag: stored.sportsThemeTag,
      rows: scheduleRowsForPrePhotoVerify(SCHEDULE),
    })
    expect(missingTitle.ok).toBe(false)
    expect(missingTitle.issues).toContain('title_placeholder')
  })

  it('공통 헬퍼는 title·destination을 넣어 title_placeholder가 나지 않는다', () => {
    const viaHelper = verifyRegisterPrePhotoForStoredProduct(stored)
    expect(viaHelper.issues).not.toContain('title_placeholder')
  })
})
