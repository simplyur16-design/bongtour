/**
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: ybtour PAP1194 — Hamilton Gardens 국가나열 → Mount Fuji 금지 — manifest
 * https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAIE001&evCd=PAP1194-260723KE00
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

/** ybtour PAP1194 live-batch route shapes (quoted truncations + garden country list) */
const PAP1194 = [
  { day: 1, title: '기내박', routeText: '', imageKeyword: '', imageKeyword2: null as string | null },
  {
    day: 2,
    title: '시드니 공항',
    routeText:
      '시드니 공항 도착 후 가이드 - 시드니 - 루라마을" 산책 - 100년 이상의 역사를 가진 아름답고 평화로운 루라(Leura) 마을 - 19세기 만들어진 가든빌리지로 아기자기한 산악 마을 - 카툼바 - "에코 포인트',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '시드니',
    routeText: '시드니 - 시드니 시내 명소 - 시드니 하버 "티(Tea) 크루즈',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '기상 후 시드니 공항',
    routeText:
      '기상 후 시드니 공항 - 시드니 - 크라이스트 처치 공항 도착 후 가이드 - 크라이스트처치 시내 명소 - "보타닉가든" - 호텔 체크인 및 휴식',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    title: '크라이스트처치',
    routeText: '크라이스트처치 - 마운트쿡 - "푸카키 호수" - 트와이젤 - 테카포 - 양치기 개동상 - 퀸스타운',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    title: '퀸스타운',
    routeText:
      '퀸스타운 - 국립 공원 - 테아나우 - 밀포드 사운드 최고높이를 자랑하는 보웬폭포 - 사자의 모습을 닮은 라이언 마운틴 - 스털링 폭포 감상',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 7,
    title: '퀸스타운 시내',
    routeText: '퀸스타운 시내 - 오클랜드 공항 도착 후 가이드 - 호텔 체크인 및 휴식',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 8,
    title: '오클랜드 간단한 시내',
    routeText:
      '오클랜드 간단한 시내 - "마이클 조셉 세비지 공원" - 오클랜드 "스카이타워 - 해밀턴 가든 - 중국, 영국, 일본, 미국, 인도, 이탈리아의 전형적인 정원과 허브정원 - 해밀턴 - 로토루아 호수',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 9,
    title: '로토루아 호수',
    routeText:
      '"로토루아 호수" - "가버먼트 가든" - 양,사슴 등 각종 동물 먹이주기 - 아름드리 우거진 "레드우드 수목원 - 와까레와레와" 마오리 민속촌 - 전통 가옥 및 각종 공예품 관람',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 10,
    title: '기상 후 오클랜드 국제 공항',
    routeText: '기상 후 오클랜드 국제 공항',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

describe('register-schedule-ybtour-pap1194-image-keyword', () => {
  it('ybtour PAP1194 — D3≠Mount Fuji, D10≠Hamilton, no Japan/Europe bleed', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(PAP1194, {
      supplierKey: 'ybtour',
      productDestination: '뉴질랜드',
      productTitle: '호주/뉴질랜드 남북섬 10일 #예약시 유류인상 없음',
      travelScope: 'package',
    })
    const blob = out.map((r) => `${r.imageKeyword} ${r.imageKeyword2 ?? ''}`).join(' | ')
    expect(blob).not.toMatch(
      /Mount Fuji|Shizuoka|Hakone|Tokyo|Kyoto|Great Wall|Eiffel|Statue of Liberty|Colosseum|Taj Mahal/i,
    )
    expect(String(out.find((r) => r.day === 1)?.imageKeyword ?? '')).not.toMatch(
      /Echo Point|Blue Mountain|Hamilton|Rotorua|Fuji/i,
    )
    expect(String(out.find((r) => r.day === 3)?.imageKeyword ?? '')).toMatch(/Sydney|Opera|Harbour/i)
    expect(String(out.find((r) => r.day === 7)?.imageKeyword ?? '')).not.toMatch(
      /Mount Cook|Milford|Fuji|Hamilton|Christchurch Cathedral/i,
    )
    expect(String(out.find((r) => r.day === 10)?.imageKeyword ?? '')).toMatch(/Auckland/i)
    expect(String(out.find((r) => r.day === 10)?.imageKeyword ?? '')).not.toMatch(
      /Hamilton|Rotorua|Fuji/i,
    )
  })
})
