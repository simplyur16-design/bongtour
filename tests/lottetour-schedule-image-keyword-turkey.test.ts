/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — lottetour prebuild
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyLottetourScheduleImageKeywordsToRows } from '../lib/lottetour-schedule-image-keyword'

const PRODUCT_TITLE = '★출발확정★『실크로드의 종착지』튀르키예 완전일주 9일'

const TURKEY_ROWS = [
  {
    day: 1,
    title: '인천 출발 및 이스탄불 도착',
    description:
      '인천국제공항에서 미팅 후 대한항공을 이용하여 터키 이스탄불로 향합니다. 약 12시간의 비행을 거쳐 이스탄불 공항에 도착하며, 입국 수속 후 가이드와 만나 호텔로 이동합니다.',
    routeText: '인천 - 이스탄불',
    imageKeyword: 'Seoul',
  },
  {
    day: 2,
    title: '이스탄불 시내 관광 및 앙카라 이동',
    description:
      '호텔 조식 후 튀르키예 최대 도시인 이스탄불의 주요 명소들을 방문합니다. 푸른 타일이 아름다운 블루 모스크와 역사의 흔적이 남은 술탄 아흐메트 광장, 활기 넘치는 그랜드 바자르를 관람합니다.',
    routeText: '이스탄불 - 술탄 아흐메트 모스크 - 술탄 아흐메트 광장 - 그랜드 바자르 - 앙카라',
    imageKeyword: 'Sultan Ahmed Mosque',
  },
  {
    day: 3,
    title: '앙카라 - 카파도키아',
    description:
      '거울처럼 맑은 풍경을 자랑하는 투즈괼 소금호수를 거쳐 기암괴석의 절경이 펼쳐지는 카파도키아로 이동합니다.',
    routeText: '앙카라 - 투즈괼 소금호수 - 카파도키아 - 데린쿠유 지하도시(내부입장) - 괴레메 - 우치히사르 성 - 데브란트 계곡',
    imageKeyword: 'International City Travel Destination',
  },
  {
    day: 4,
    title: '카파도키아 - 안탈리아',
    description:
      '호텔 조식 후 지중해의 휴양 도시 안탈리아로 이동하며 지각 변동으로 형성된 신비로운 오브룩 담수호를 관람합니다. 로마 시대의 유적인 하드리아누스의 문이 있는 구시가지를 산책합니다.',
    routeText: '카파도키아 - 오브룩 담수호 - 안탈리아 - 이블리 미나레 - 하드리아누스의 문',
    imageKeyword: 'Colosseum',
  },
  {
    day: 5,
    title: '안탈리아에서 파묵칼레로 이동 및 유적지 관광',
    description: '안탈리아에서 출발하여 유네스코 세계문화유산인 파묵칼레로 이동합니다.',
    routeText: '안탈리아 - 파묵칼레',
    imageKeyword: 'International',
  },
  {
    day: 6,
    title: '쉬린제 마을 및 에페수스 유적지 관광',
    description:
      '호텔 조식 후 그리스풍의 아름다운 건축물이 돋보이는 쉬린제 마을로 이동합니다. 헬레니즘 및 로마 시대의 유산을 관람합니다.',
    routeText: '파묵칼레 - 쉬린제 - 에페수스 - 아이발릭',
    imageKeyword: 'Colosseum',
  },
  {
    day: 7,
    title: '이스탄불 시내 관광 및 톱카프 궁전 내부 관람',
    description: '오스만 제국의 영광이 깃든 톱카프 궁전을 내부 관람하고 성 소피아 성당을 조망합니다.',
    routeText: '아이발릭 - 이스탄불 - 성 소피아 성당(조망) - 톱카프 궁전(내부입장) - 발랏 지구',
    imageKeyword: 'International',
  },
  {
    day: 8,
    title: '이스탄불 관광 및 귀국',
    description: '보스포러스 해협 크루즈에 탑승하여 유럽과 아시아를 잇는 아름다운 전경을 감상합니다.',
    routeText: '이스탄불 - 보스포러스 해협(크루즈) - 피엘로티 언덕(케이블카) - 이스탄불 공항',
    imageKeyword: 'Seoul',
  },
  {
    day: 9,
    title: '인천국제공항 도착 및 해산',
    description: '이스탄불을 출발하여 인천국제공항에 안전하게 도착합니다.',
    routeText: '이스탄불 - 인천',
    imageKeyword: 'Seoul',
  },
]

describe('lottetour schedule imageKeyword — Turkey complete tour', () => {
  it('routeText 기반으로 Seoul·Colosseum·International 오매칭을 교정한다', () => {
    const out = applyLottetourScheduleImageKeywordsToRows(TURKEY_ROWS, {
      productTitle: PRODUCT_TITLE,
      productDestination: '튀르키예',
    })

    assert.match(out[0]!.imageKeyword!, /Istanbul|Bosporus/i, `day1: ${out[0]!.imageKeyword}`)
    assert.match(out[1]!.imageKeyword!, /Sultan Ahmed|Grand Bazaar/i, `day2: ${out[1]!.imageKeyword}`)
    assert.match(out[2]!.imageKeyword!, /Devrent|Uchisar|Goreme|Derinkuyu|Lake Tuz|Cappadocia/i, `day3: ${out[2]!.imageKeyword}`)
    assert.match(out[3]!.imageKeyword!, /Hadrian|Yivli|Antalya|Obruk/i, `day4: ${out[3]!.imageKeyword}`)
    assert.doesNotMatch(out[3]!.imageKeyword!, /Colosseum/i)
    assert.match(out[4]!.imageKeyword!, /Pamukkale|Hierapolis/i, `day5: ${out[4]!.imageKeyword}`)
    assert.match(out[5]!.imageKeyword!, /Ephesus|Sirince/i, `day6: ${out[5]!.imageKeyword}`)
    assert.doesNotMatch(out[5]!.imageKeyword!, /Colosseum/i)
    assert.match(out[6]!.imageKeyword!, /Balat|Topkapi|Hagia Sophia/i, `day7: ${out[6]!.imageKeyword}`)
    assert.match(out[7]!.imageKeyword!, /Bosphorus|Pierre Loti|Istanbul/i, `day8: ${out[7]!.imageKeyword}`)
    assert.doesNotMatch(out[7]!.imageKeyword!, /Seoul/i)
    assert.match(out[8]!.imageKeyword!, /Istanbul/i, `day9: ${out[8]!.imageKeyword}`)
    assert.doesNotMatch(out[8]!.imageKeyword!, /\bSeoul\b|Incheon/i)
  })

  it('fills imageKeyword2 from routeText on tourism days; movement/return days stay null', () => {
    const out = applyLottetourScheduleImageKeywordsToRows(TURKEY_ROWS, {
      productTitle: PRODUCT_TITLE,
      productDestination: '튀르키예',
    })

    assert.equal(out[0]!.imageKeyword2, null, `day1 kw2: ${out[0]!.imageKeyword2}`)
    assert.equal(out[8]!.imageKeyword2, null, `day9 kw2: ${out[8]!.imageKeyword2}`)

    assert.ok(out[1]!.imageKeyword2?.trim(), `day2 kw2 missing: ${out[1]!.imageKeyword2}`)
    assert.notEqual(
      norm(out[1]!.imageKeyword!),
      norm(out[1]!.imageKeyword2!),
      'day2 kw1 and kw2 must differ'
    )
    assert.match(out[1]!.imageKeyword2!, /Grand Bazaar|Sultan Ahmed|Ankara/i, `day2 kw2: ${out[1]!.imageKeyword2}`)

    assert.ok(out[2]!.imageKeyword2?.trim(), `day3 kw2: ${out[2]!.imageKeyword2}`)
    assert.ok(out[6]!.imageKeyword2?.trim(), `day7 kw2: ${out[6]!.imageKeyword2}`)
  })
})

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}
