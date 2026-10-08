/**
 * REGRESSION-FREEZE[register-fit-gemini-landmark-verify]: FIT Gemini 추천일정 랜드마크 검증 — manifest
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isLikelyTourismLandmarkKeyword } from '@/lib/pexels-place-name-keyword'
import {
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
} from '@/lib/register-pre-photo-guards'
import {
  registerScheduleKeywordMatchesOwnDayRoute,
  verifyRegisterPrePhoto,
} from '@/lib/register-pre-photo-verify'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'

describe('register-fit-gemini-landmark-verify', () => {
  it('Big Ben·Warner Bros Studio Tour는 랜드마크이며 broken이 아니다', () => {
    assert.equal(isLikelyTourismLandmarkKeyword('Big Ben'), true)
    assert.equal(isLikelyTourismLandmarkKeyword('Warner Bros. Studio Tour'), true)
    assert.equal(isLikelyTourismLandmarkKeyword('Warner Bros Studio Tour London'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Big Ben', { allowHotelLodging: true }), false)
    assert.equal(
      isBrokenRegisterLandmarkKeyword('Warner Bros. Studio Tour', { allowHotelLodging: true }),
      false,
    )
  })

  it('워너 브라더스·해리포터 한글 route는 Studio Tour 키워드와 own-route 일치', () => {
    assert.equal(
      registerScheduleKeywordMatchesOwnDayRoute(
        '빅토리아 역 - 워너 브라더스 스튜디오 투어 런던 - 백롯 카페',
        'Warner Bros. Studio Tour',
      ),
      true,
    )
    assert.equal(
      registerScheduleKeywordMatchesOwnDayRoute(
        '빅 벤 - 웨스트민스터 펍 - 런던 아이',
        'Big Ben',
      ),
      true,
    )
  })

  it('해리포터 스튜디오 본문은 워너 브라더스 route에 대해 description 통과', () => {
    assert.equal(
      isBrokenRegisterScheduleDescription(
        '셔틀버스를 타고 해리포터 스튜디오로 이동해 영화 속 마법 세계의 주인공이 되어 보세요. 스튜디오 내부는 꽤 넓고 볼거리가 많으니 편안한 신발을 착용하고 방문하시길 추천합니다.',
        '빅토리아 역 - 워너 브라더스 스튜디오 투어 런던 - 백롯 카페',
      ),
      false,
    )
  })

  it('영국 해리포터 FIT 일정은 Gemini 키워드 그대로 검증 통과', () => {
    const rows = [
      {
        day: 1,
        title: '1일차',
        description:
          '히스로 공항에 도착해 숙소 체크인 후 화려한 피카딜리 서커스 주변을 거닐며 런던의 밤을 만끽해 보세요. 장시간 비행 후에는 따뜻한 외투를 챙겨 런던의 선선한 밤바람에 대비하는 것이 좋습니다.',
        routeText: '히스로 공항 - 런던 시내 호텔 - 피카딜리 서커스',
        imageKeyword: 'Piccadilly Circus',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '2일차',
        description:
          '오전에는 빅 벤을 배경으로 커플 사진을 남기고 웨스트민스터 사원 주변의 고풍스러운 분위기를 즐기기 좋은 날입니다. 런던의 명물인 빨간 2층 버스를 타기 위해 오이스터 카드를 미리 충전해 두시면 편리합니다.',
        routeText: '빅 벤 - 웨스트민스터 펍 - 런던 아이',
        imageKeyword: 'Big Ben',
        imageKeyword2: 'London',
      },
      {
        day: 3,
        title: '3일차',
        description:
          '셔틀버스를 타고 해리포터 스튜디오로 이동해 영화 속 마법 세계의 주인공이 되어 보세요. 스튜디오 내부는 꽤 넓고 볼거리가 많으니 편안한 신발을 착용하고 방문하시길 추천합니다.',
        routeText: '빅토리아 역 - 워너 브라더스 스튜디오 투어 런던 - 백롯 카페',
        imageKeyword: 'Warner Bros. Studio Tour',
        imageKeyword2: 'Tower Bridge',
      },
      {
        day: 4,
        title: '4일차',
        description:
          '대영 박물관의 방대한 유물을 관람하고 활기 넘치는 옥스퍼드 스트리트에서 연인을 위한 선물을 골라 보세요. 박물관은 규모가 매우 크니 보고 싶은 전시관을 미리 정해두면 시간을 알차게 쓸 수 있습니다.',
        routeText: '대영 박물관 - 옥스퍼드 스트리트 - 포트넘 앤 메이슨',
        imageKeyword: 'British Museum',
        imageKeyword2: null,
      },
      {
        day: 5,
        title: '5일차',
        description:
          '타워 브리지를 건너며 탁 트인 전경을 감상하고 인근 버로우 마켓에서 다양한 음식을 맛보세요. 마켓은 오후 늦게 문을 닫는 곳이 많으니 가급적 점심시간에 맞춰 방문하는 것이 좋습니다.',
        routeText: '타워 브리지 - 버로우 마켓 - 더 샤드',
        imageKeyword: 'Tower Bridge',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '6일차',
        description:
          '스카이 가든 전망대에서 런던 시내를 한눈에 담고 코벤트 가든의 거리 공연을 즐기기 좋은 날입니다. 무료 전망대는 예약이 필수이므로 방문 몇 주 전 공식 홈페이지를 확인하는 것이 필수입니다.',
        routeText: '스카이 가든 - 코벤트 가든 - 플랫 아이언',
        imageKeyword: 'Sky Garden',
        imageKeyword2: 'Covent Garden',
      },
      {
        day: 7,
        title: '7일차',
        description:
          '마지막으로 리젠트 스트리트의 기념품 숍을 들러 여행의 여운을 정리하고 공항으로 이동해 보세요. 터키 항공 카운터는 출발 3시간 전에는 도착해야 여유로운 수속과 면세점 이용이 가능합니다.',
        routeText: '리젠트 스트리트 - 프레타망제 - 히스로 공항',
        imageKeyword: 'Regent',
        imageKeyword2: null,
      },
    ]
    const healed = healRegisterPrePhotoSchedule(rows, {
      supplierKey: 'naeiltour',
      lane: 'air_hotel_free',
      productDestination: '영국',
      productTitle: '영국 해리포터 스튜디오',
      countryKey: 'united-kingdom',
    })
    const verify = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'air_hotel_free',
      productType: 'air-hotel',
      productDestination: '영국',
      productTitle: '영국 해리포터 스튜디오',
      countryKey: 'united-kingdom',
      rows: healed.rows,
    })
    assert.equal(verify.ok, true, verify.issues.join(','))
    assert.equal(verify.parserFixRequired, false)
    assert.match(String(healed.rows[1]?.imageKeyword ?? ''), /Big Ben/i)
    assert.match(String(healed.rows[2]?.imageKeyword ?? ''), /Warner Bros/i)
  })
})
