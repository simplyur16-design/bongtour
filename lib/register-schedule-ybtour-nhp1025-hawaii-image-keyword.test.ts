/**
 * REGRESSION-FREEZE[register-schedule-hawaii-free-day-example-itinerary]: ybtour NHP1025 Hawaii TIP free days — manifest
 * https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAGD002&evCd=NHP1025-260712KE00
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

const NHP1025 = [
  {
    day: 1,
    title: '호놀룰루 다운타운 등',
    routeText:
      '호놀룰루 다운타운 등 - 오아후 - 첫날 - 일부 - 미국에 단 하나뿐인 궁전 "이올라니 궁전" (차창) - 카카오코 거리',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 2,
    title: '72번 국도 드라이브',
    routeText:
      '72번 국도 드라이브 - 하와이의 필수 - 섬일주 - 카후쿠 새우요리 중식 - 파인애플 농장',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '오아후',
    routeText: '오아후 - ＃노랑풍선 TIP - 예시) 이웃섬',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '오아후',
    routeText: '오아후 - ＃노랑풍선 TIP',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    title: '오아후',
    routeText: '오아후 - ＃노랑풍선 TIP',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    title: '오아후',
    routeText: '오아후 - 호놀룰루 국제공항 출발( )',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 7,
    title: '숙박 없음(귀국)',
    routeText: '',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

describe('register-schedule-ybtour-nhp1025-hawaii-image-keyword', () => {
  it('TIP/예시 자유일 — 추천 예시일정 키워드, D1≠North Shore, D7≠North Shore', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(NHP1025, {
      supplierKey: 'ybtour',
      productDestination: '하와이',
      productTitle: '하와이 6일 #엠버시스위트 바이 힐튼 #1베드룸 스위트 #소아반값할인',
      travelScope: 'package',
    })
    const by = (d: number) => out.find((r) => r.day === d)
    const d1 = String(by(1)?.imageKeyword ?? '')
    const d2 = String(by(2)?.imageKeyword ?? '')
    const d3 = `${by(3)?.imageKeyword ?? ''} ${by(3)?.routeText ?? ''}`
    const d4 = String(by(4)?.imageKeyword ?? '')
    const d5 = String(by(5)?.imageKeyword ?? '')
    const d7 = String(by(7)?.imageKeyword ?? '')

    expect(d1).not.toMatch(/North Shore/i)
    expect(d1).toMatch(/Iolani|Kakaako|Waikiki|Honolulu/i)

    expect(d2).toMatch(/Pineapple/i)
    expect(d2).not.toMatch(/Diamond Head|Pearl Harbor/i)

    expect(d3).toMatch(/Road to Hana|Maui|이웃섬|마우이/i)
    expect(d4).toBeTruthy()
    expect(d5).toBeTruthy()
    expect(d4).not.toEqual(d5)

    expect(d7).not.toMatch(/North Shore|Diamond Head|Pearl Harbor|Hanauma/i)
  })
})
