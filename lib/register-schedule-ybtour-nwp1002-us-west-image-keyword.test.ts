/**
 * REGRESSION-FREEZE[pexels-normalize-monument-valley]: ybtour NWP1002 — Monument Valley not bare Monument — manifest
 * REGRESSION-FREEZE[schedule-segment-poi-us-west]: US West package keywords — manifest
 * https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAGA002&evCd=NWP1002-260713YP00
 */
import { describe, expect, it } from 'vitest'
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

describe('register-schedule-ybtour-nwp1002-us-west-image-keyword', () => {
  it('normalize — Monument Valley keeps Valley', () => {
    expect(normalizeToPlaceName('Monument Valley')).toBe('Monument Valley')
    expect(normalizeToPlaceName('Monument Valley')).not.toBe('Monument')
  })

  it('ybtour NWP1002 — D6 Monument Valley, D8 Hollywood Universal, no Yosemite day-leak', () => {
    const rows = [
      { day: 1, title: '로스엔젤레스 공항', routeText: '로스엔젤레스 공항 - 로스앤젤레스 - 베이커스필드', imageKeyword: '', imageKeyword2: null as string | null },
      { day: 2, title: '샌프란', routeText: '트윈픽스에서 샌프란시스코 야경 감상 - 어부의 선착장 - 예술가의 마을 - 팔레스 오브 파인 아트', imageKeyword: '', imageKeyword2: null },
      { day: 3, title: '요세미티', routeText: '요세미티 국립공원 - 엘카피탄 - 요세미티 폭포 - 하프돔', imageKeyword: '', imageKeyword2: null },
      { day: 4, title: '라스베가스', routeText: '바스토우 아울렛 - 라스베이거스 웰컴사인 - 호텔 체크인 후 자유일정', imageKeyword: '', imageKeyword2: null },
      { day: 5, title: '자이언', routeText: '라스베이거스 - 자이언캐년 - 브라이스캐년', imageKeyword: '', imageKeyword2: null },
      { day: 6, title: '모뉴먼트', routeText: '페이지 - 홀슈밴드 - 모뉴먼트 밸리 - 페이지', imageKeyword: '', imageKeyword2: null },
      { day: 7, title: '그랜드캐년', routeText: '그랜드캐년 - 라플린', imageKeyword: '', imageKeyword2: null },
      { day: 8, title: 'LA', routeText: '로스앤젤레스 - 유니버설 스튜디오', imageKeyword: '', imageKeyword2: null },
      { day: 9, title: 'LA', routeText: '로스앤젤레스 - 자유일정', imageKeyword: '', imageKeyword2: null },
      { day: 10, title: '귀국', routeText: '로스엔젤레스 공항 출발', imageKeyword: '', imageKeyword2: null },
    ]
    const out = applyRegisterScheduleImageKeywordsBySupplier(rows, {
      supplierKey: 'ybtour',
      productDestination: '미서부',
      productTitle: '미서부 9일 #베스트셀러 #4대캐년 #자이언캐년 온천욕',
      travelScope: 'package',
    })
    const by = (d: number) => out.find((r) => r.day === d)
    const blob = out.map((r) => `${r.imageKeyword} ${r.imageKeyword2 ?? ''}`).join(' | ')
    const dayBlob = (d: number) => `${by(d)?.imageKeyword ?? ''} ${by(d)?.imageKeyword2 ?? ''}`

    expect(dayBlob(6)).toMatch(/Monument Valley/i)
    expect(dayBlob(6)).not.toMatch(/\bMonument\b(?!\s+Valley)/i)

    expect(String(by(8)?.imageKeyword ?? '')).toMatch(/Universal Studios Hollywood/i)
    expect(blob).not.toMatch(/Universal Studios Japan/i)

    expect(dayBlob(4)).not.toMatch(/Yosemite|El Capitan|Bridalveil|Half Dome/i)
    expect(dayBlob(9)).not.toMatch(/Yosemite|El Capitan|Bridalveil|Half Dome/i)
  })
})
