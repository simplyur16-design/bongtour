/**
 * REGRESSION-FREEZE[register-fit-gemini-desc-verify]: FIT Gemini 귀국·Jewel Changi 요약 검증 — manifest
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isBrokenRegisterFitScheduleDescription,
  isRegisterScheduleTransitHubPlace,
} from '@/lib/register-pre-photo-guards'
import {
  registerScheduleKeywordMatchesOwnDayRoute,
  verifyRegisterPrePhoto,
} from '@/lib/register-pre-photo-verify'

describe('register-fit-gemini-desc-verify', () => {
  it('쥬얼 창이는 hub가 아니고 Gemini 요약은 description 통과', () => {
    assert.equal(isRegisterScheduleTransitHubPlace('쥬얼 창이 공항'), false)
    assert.equal(isRegisterScheduleTransitHubPlace('창이 국제공항'), true)
    assert.equal(
      isBrokenRegisterFitScheduleDescription(
        '쥬얼 창이 공항의 거대한 실내 폭포를 배경으로 여행의 마지막 추억을 남겨 보세요. 얼리 체크인 서비스를 이용하면 손이 가볍게 공항 시설을 구경할 수 있습니다.',
        '쥬얼 창이 공항 - 아이스쉑 쥬얼 창이 - 창이 국제공항',
      ),
      false,
    )
  })

  it('호텔·공항만 있는 귀국일은 Gemini 이동 요약을 허용', () => {
    assert.equal(
      isBrokenRegisterFitScheduleDescription(
        '호텔 조식 후 국제거리에서의 마지막 기념품 쇼핑을 즐기고 나하 공항(Naha Airport)으로 이동하여 일정을 마무리합니다. 비행기 출발 2시간 전에는 공항에 도착해야 면세점 이용까지 여유롭게 가능합니다.',
        '호텔 레스토랑 - 나하 공항',
      ),
      false,
    )
  })

  it('짧은 호텔 체크인·도착·귀국 요약도 FIT description 통과', () => {
    assert.equal(
      isBrokenRegisterFitScheduleDescription('호텔 체크인 후 자유일정입니다.', ''),
      false,
    )
    assert.equal(
      isBrokenRegisterFitScheduleDescription(
        '타이베이에 도착해 체크인합니다. 첫날 이동을 맞춥니다.',
        '',
      ),
      false,
    )
    assert.equal(
      isBrokenRegisterFitScheduleDescription(
        '체크아웃 후 인천으로 귀국합니다. 이동 중심으로 마무리합니다.',
        '',
      ),
      false,
    )
  })

  it('싱가포르 FIT day6 Jewel Changi 검증 통과', () => {
    const rows = [
      {
        day: 1,
        routeText: '인천 - 싱가포르',
        description: '인천에서 출발해 싱가포르에 도착한 뒤 시내 호텔로 이동합니다. 첫날 리듬을 맞춥니다.',
        imageKeyword: 'Singapore',
      },
      {
        day: 2,
        routeText: '머라이언 파크 - 마리나베이 샌즈',
        description:
          '머라이언 파크에서 사진을 남기고 마리나베이 샌즈 주변을 둘러보세요. 저녁에는 가든스 바이 더 베이를 추천합니다.',
        imageKeyword: 'Merlion',
      },
      {
        day: 3,
        routeText: '유니버설 스튜디오 싱가포르',
        description:
          '유니버설 스튜디오에서 하루를 즐겨 보세요. 편한 신발을 신고 오전에 입장하면 대기 시간을 줄일 수 있습니다.',
        imageKeyword: 'Universal Studios Singapore',
      },
      {
        day: 4,
        routeText: '가든스 바이 더 베이 - 오차드 로드',
        description:
          '가든스 바이 더 베이의 슈퍼트리를 보고 오차드 로드에서 쇼핑을 즐기세요. 야경이 아름다우니 해가 진 뒤 방문을 추천합니다.',
        imageKeyword: 'Gardens by the Bay',
      },
      {
        day: 5,
        routeText: '센토사 - 팔라완 비치',
        description:
          '센토사 섬에서 여유로운 해변 일정을 보내 보세요. 선크림을 챙기고 오후 늦게까지 머물러도 좋습니다.',
        imageKeyword: 'Sentosa',
      },
      {
        day: 6,
        routeText: '쥬얼 창이 공항 - 아이스쉑 쥬얼 창이 - 창이 국제공항',
        description:
          '쥬얼 창이 공항의 거대한 실내 폭포를 배경으로 여행의 마지막 추억을 남겨 보세요. 얼리 체크인 서비스를 이용하면 손이 가볍게 공항 시설을 구경할 수 있습니다.',
        imageKeyword: 'Jewel Changi',
      },
    ]
    const v = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'air_hotel_free',
      productType: 'air-hotel',
      productTitle: '싱가포르 4박 6일',
      productDestination: '싱가포르',
      countryKey: 'singapore',
      rows,
    })
    assert.equal(
      v.issues.includes('day6_description_filler_or_duplicate'),
      false,
      v.issues.join(','),
    )
  })

  it('사크레쾨르·베르사유·긴린코 own-route', () => {
    assert.equal(
      registerScheduleKeywordMatchesOwnDayRoute('사크레쾨르 성당 - 마레 지구', 'Sacré-cœur'),
      true,
    )
    assert.equal(
      registerScheduleKeywordMatchesOwnDayRoute(
        '베르사유 궁전 - 샹젤리제 거리 - 개선문',
        'Palace of Versailles',
      ),
      true,
    )
    assert.equal(
      registerScheduleKeywordMatchesOwnDayRoute(
        '긴린코 호수 - 유후인 온천마을 - 유후인 만화 미술관',
        'Kinrin Lake',
      ),
      true,
    )
  })
})
