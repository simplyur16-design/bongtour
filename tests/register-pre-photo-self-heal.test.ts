/**
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: 파라도르·중복 문장 셀프힐 — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-keep-filled-keywords]: 유효 랜드마크 유지 — manifest
 * REGRESSION-FREEZE[pexels-normalize-da-nang-not-da]: Da 조각 키워드는 검증 실패 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-heal-off-trip-keyword]: 산토리니·두바이·KL·잘린 구 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-identity-country-landmark]: 제목·dest·같은 날 나라·2단어 랜드마크 — manifest
 * REGRESSION-FREEZE[register-schedule-description-no-repeated-closer]: 같은 closer 검증 실패·힐 재합성 — manifest
 * REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: 당일 route 밖 키워드 검증 실패·힐 — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  healRegisterPrePhotoSchedule,
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
  isObviouslyBrokenScheduleImageUrl,
} from '../lib/register-pre-photo-self-heal'
import {
  inferRegisterPendingDestinationFromTitle,
  isRegisterPendingFreeItineraryDay,
  isRegisterScheduleMovementOrTransitDay,
  registerScheduleKeywordMatchesOwnDayRoute,
  verifyRegisterPrePhoto,
} from '../lib/register-pre-photo-verify'
import {
  isRegisterScheduleCrossContinentHallucinationKeyword,
  isRegisterScheduleSameDayKeywordCountryClash,
  registerPrePhotoPlaceDestHay,
} from '../lib/register-schedule-cross-continent-keyword-guard'
import { isLikelyTourismLandmarkKeyword } from '../lib/pexels-place-name-keyword'

describe('register-pre-photo-self-heal', () => {
  it('파라도르·정찬 키워드는 깨진 랜드마크로 본다', () => {
    assert.equal(isBrokenRegisterLandmarkKeyword('Parador de Alcaniz'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('파라도르정찬식'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Park Guell'), false)
    assert.equal(isBrokenRegisterLandmarkKeyword('Da'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Da Nang'), false)
    assert.equal(isBrokenRegisterLandmarkKeyword('Nha'), true)
  })

  it('중복 동선 문장은 깨진 요약이다', () => {
    assert.equal(
      isBrokenRegisterScheduleDescription(
        '바르셀로나와 리세우 대극장을 중심으로 하루를 보냅니다. 동선에 맞춰 하루 일정을 이어갑니다. 동선에 맞춰 일정을 이어갑니다.',
      ),
      true,
    )
  })

  it('중간일 키워드가 당일 route에 없으면 검증 실패이고 힐이 그날 동선으로 바꾼다', () => {
    assert.equal(
      registerScheduleKeywordMatchesOwnDayRoute('이스터섬 전일 - 라노 라라쿠', 'Rio de Janeiro'),
      false,
    )
    assert.equal(
      registerScheduleKeywordMatchesOwnDayRoute('루체른 - 베른', 'Jungfraujoch Swiss Alps'),
      false,
    )
    assert.equal(
      registerScheduleKeywordMatchesOwnDayRoute('치첸이사 - 칸쿤', 'Chichen Itza'),
      true,
    )
    const easterRows = [
      {
        day: 1,
        title: '1일차',
        description: '인천에서 출발해 산티아고에서 도착합니다. 첫날 이동을 맞춥니다.',
        routeText: '산티아고',
        imageKeyword: 'Santiago',
      },
      {
        day: 2,
        title: '2일차',
        description: '이스터섬 전일을 둘러봅니다. 라노 라라쿠 주변을 이어서 둘러봅니다.',
        routeText: '이스터섬 전일 - 라노 라라쿠',
        imageKeyword: 'Rio de Janeiro',
      },
      {
        day: 3,
        title: '귀국',
        description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
        routeText: '',
        imageKeyword: '',
      },
    ]
    const easterBefore = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '칠레 이스터섬 3일',
      productDestination: '칠레',
      rows: easterRows,
    })
    assert.ok(easterBefore.issues.includes('day2_keyword_not_on_own_route'))
    const easterOut = healRegisterPrePhotoSchedule(easterRows, {
      supplierKey: 'ybtour',
      productDestination: '칠레',
      productTitle: '칠레 이스터섬 3일',
    })
    const easterKw = String(easterOut.rows.find((r) => r.day === 2)?.imageKeyword ?? '')
    assert.match(easterKw, /Easter Island|Rano Raraku/i)
    assert.doesNotMatch(easterKw, /Rio/i)

    const swissRows = [
      {
        day: 1,
        title: '1일차',
        description: '인천에서 출발해 취리히에서 도착합니다. 첫날 이동을 맞춥니다.',
        routeText: '취리히',
        imageKeyword: 'Zurich',
      },
      {
        day: 2,
        title: '2일차',
        description: '루체른과 베른을 둘러봅니다. 베른에서 주변을 이어서 둘러봅니다.',
        routeText: '루체른 - 베른',
        imageKeyword: 'Jungfraujoch Swiss Alps',
        imageKeyword2: 'Chapel Bridge Lucerne',
      },
      {
        day: 3,
        title: '귀국',
        description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
        routeText: '',
        imageKeyword: '',
      },
    ]
    const swissBefore = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '스위스 3일',
      productDestination: '스위스',
      rows: swissRows,
    })
    assert.ok(swissBefore.issues.includes('day2_keyword_not_on_own_route'))
    const swissOut = healRegisterPrePhotoSchedule(swissRows, {
      supplierKey: 'naeiltour',
      productDestination: '스위스',
      productTitle: '스위스 3일',
    })
    const swissKw = String(swissOut.rows.find((r) => r.day === 2)?.imageKeyword ?? '')
    assert.match(swissKw, /Lucerne|Bern|Chapel Bridge/i)
    assert.doesNotMatch(swissKw, /Jungfrau/i)
  })

  it('중간일마다 같은 템플릿 closer면 검증 실패이고 힐이 명소 문장으로 바꾼다', () => {
    const rows = [
      {
        day: 1,
        title: '1일차',
        description: '인천에서 출발해 로마에서 도착합니다. 첫날 이동을 맞춥니다.',
        routeText: '로마',
        imageKeyword: 'Rome',
      },
      {
        day: 2,
        title: '2일차',
        description: '콜로세움을 중심으로 하루 일정을 진행합니다. 동선에 맞춰 하루 일정을 이어갑니다.',
        routeText: '콜로세움 - 트레비 분수',
        imageKeyword: 'Colosseum',
      },
      {
        day: 3,
        title: '3일차',
        description: '바티칸을 중심으로 하루 일정을 진행합니다. 동선에 맞춰 하루 일정을 이어갑니다.',
        routeText: '바티칸 - 시스티나 성당',
        imageKeyword: 'Vatican',
      },
      {
        day: 4,
        title: '귀국',
        description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
        routeText: '',
        imageKeyword: '',
      },
    ]
    const before = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '로마 4일',
      productDestination: '이탈리아',
      rows,
    })
    assert.ok(before.issues.includes('day2_description_repeated_closer'))
    assert.ok(before.issues.includes('day3_description_repeated_closer'))
    const out = healRegisterPrePhotoSchedule(rows, {
      supplierKey: 'modetour',
      productDestination: '이탈리아',
      productTitle: '로마 4일',
    })
    const d2 = String(out.rows.find((r) => r.day === 2)?.description ?? '')
    const d3 = String(out.rows.find((r) => r.day === 3)?.description ?? '')
    assert.notEqual(d2, d3)
    assert.doesNotMatch(d2, /하루 일정을 이어갑니다/)
    assert.doesNotMatch(d3, /하루 일정을 이어갑니다/)
    assert.match(d2, /콜로세움|트레비/)
    assert.match(d3, /바티칸|시스티나/)
  })

  it('형식 깨진 imageUrl만 표시 링크로 본다', () => {
    assert.equal(isObviouslyBrokenScheduleImageUrl('undefined'), true)
    assert.equal(isObviouslyBrokenScheduleImageUrl('https://images.pexels.com/foo.jpg'), false)
    assert.equal(isObviouslyBrokenScheduleImageUrl(''), false)
  })

  it('시체스 일차 파라도르 키워드는 비우고 등록 SSOT로 다시 채운다', () => {
    const out = healRegisterPrePhotoSchedule(
      [
        {
          day: 1,
          title: '1일차',
          description: '인천에서 출발해 바르셀로나에서 도착합니다. 첫날 리듬을 맞추며 일정을 이어갑니다.',
          routeText: '바르셀로나',
          imageKeyword: 'Barcelona',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '2일차',
          description:
            '시체스와 타라고나를 둘러봅니다. 동선에 맞춰 하루 일정을 이어갑니다. 동선에 맞춰 일정을 이어갑니다.',
          routeText: '시체스 - 타라고나 - 시체스 해변 - Parador de Alcaniz (파라도르정찬식)',
          imageKeyword: 'Parador de Alcaniz',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '3일차 귀국',
          description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
          routeText: '',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'modetour',
        productDestination: '스페인',
        productTitle: '임윤찬 바르셀로나 리사이틀 관람 스페인 7일',
      },
    )
    const d2 = out.rows.find((r) => r.day === 2)!
    assert.doesNotMatch(String(d2.imageKeyword ?? ''), /Parador|Alcaniz/i)
    assert.ok(String(d2.imageKeyword ?? '').trim().length > 0)
    assert.equal(out.reappliedKeywords, true)
  })

  it('제목에 자유일정 없는 빈 중간일은 추천일정 대상이 아니고 키워드 공란은 parser_fix다', () => {
    const out = healRegisterPrePhotoSchedule(
      [
        {
          day: 1,
          title: '1일차',
          description: '인천에서 출발합니다.',
          routeText: '인천',
          imageKeyword: 'Incheon',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '2일차',
          description: '하루 일정을 이어갑니다.',
          routeText: '',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '3일차 귀국',
          description: '인천으로 귀국합니다.',
          routeText: '인천',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'modetour',
        productDestination: '스페인',
        productTitle: '일정 없는 상품',
      },
    )
    assert.equal(isRegisterPendingFreeItineraryDay(out.rows.find((r) => r.day === 2)!), false)
    assert.equal(out.notes.some((n) => n.reason === 'parser_fix_required'), true)
  })

  // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: 짧은 방문도시·kw2 승격 — manifest
  it('짧은 방문도시와 kw2는 힐이 중간일 공란으로 남기지 않는다', () => {
    assert.equal(isBrokenRegisterLandmarkKeyword('Xian'), false)
    assert.equal(isBrokenRegisterLandmarkKeyword('Porto'), false)
    assert.equal(isBrokenRegisterLandmarkKeyword('La Paz'), false)
    assert.equal(isBrokenRegisterLandmarkKeyword('Oahu'), false)
    assert.equal(inferRegisterPendingDestinationFromTitle('마카오 실속'), '마카오')
    assert.equal(inferRegisterPendingDestinationFromTitle('남미 퍼펙트 일주 4개국'), '중남미')
    const xian = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: '인천', imageKeyword: 'Incheon', description: '인천에서 출발합니다. 첫날 이동을 맞춥니다.' },
        { day: 2, title: '서안', routeText: '서안', imageKeyword: '', description: '서안을 중심으로 하루 일정을 진행합니다. 동선에 맞춰 하루 일정을 이어갑니다.' },
        { day: 3, title: '귀국', routeText: '인천', imageKeyword: '', description: '인천으로 귀국합니다. 이동 중심으로 마무리합니다.' },
      ],
      { supplierKey: 'naeiltour', productTitle: '서안 병마용갱 우리만', productDestination: '서안', lane: 'package' },
    )
    assert.match(String(xian.rows.find((r) => r.day === 2)?.imageKeyword ?? ''), /Xian|Terracotta/i)
    const hawaii = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: '인천', imageKeyword: 'Incheon', description: '인천에서 출발합니다. 첫날 이동을 맞춥니다.' },
        {
          day: 2,
          title: '하나우마베이 스노클링',
          routeText: '하나우마베이 스노클링 - 오아후',
          imageKeyword: '',
          imageKeyword2: 'North Shore Oahu Surf Beach',
          description: '하나우마베이 스노클링과 오아후를 둘러봅니다. 선착장을 이어서 방문합니다.',
        },
        { day: 3, title: '귀국', routeText: '인천', imageKeyword: '', description: '인천으로 귀국합니다. 이동 중심으로 마무리합니다.' },
      ],
      { supplierKey: 'ybtour', productTitle: '하와이 7일', productDestination: '하와이', lane: 'package' },
    )
    assert.ok(String(hawaii.rows.find((r) => r.day === 2)?.imageKeyword ?? '').trim().length > 0)
    const sydney = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: '인천', imageKeyword: 'Incheon', description: '인천에서 출발합니다. 첫날 이동을 맞춥니다.' },
        {
          day: 2,
          title: '관람 · 시드니를 상징하는 활기찬 해변',
          routeText: '관람 - 지역인 - 시드니를 상징하는 활기찬 해변',
          imageKeyword: '',
          description: '관람과 지역인을 중심으로 하루를 보냅니다. 동선에 맞춰 하루 일정을 이어갑니다.',
        },
        { day: 3, title: '귀국', routeText: '인천', imageKeyword: '', description: '인천으로 귀국합니다. 이동 중심으로 마무리합니다.' },
      ],
      { supplierKey: 'lottetour', productTitle: '시드니 7일', productDestination: '시드니', lane: 'package' },
    )
    assert.match(String(sydney.rows.find((r) => r.day === 2)?.imageKeyword ?? ''), /Bondi|Sydney/i)
  })

  it('제목에 자유일정이 있고 빈 중간일이면 추천일정 대상이다', () => {
    const row = {
      day: 2,
      title: '2일차',
      description: '하루 일정을 이어갑니다.',
      routeText: '',
      imageKeyword: '',
      imageKeyword2: null,
    }
    assert.equal(
      isRegisterPendingFreeItineraryDay(row, { productTitle: '[2030전용] 뉴욕 7일 #2일 자유일정' }),
      true,
    )
    const titled = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '[2030전용] 뉴욕 7일 #2일 자유일정',
      productDestination: '뉴욕',
      rows: [
        { day: 1, title: '1일차', description: '인천에서 출발합니다.', routeText: '인천', imageKeyword: 'Incheon' },
        row,
        { day: 3, title: '귀국', description: '인천으로 귀국합니다.', routeText: '인천', imageKeyword: '' },
      ],
    })
    assert.ok(titled.issues.includes('day2_free_recommended_itinerary_missing'))
    const transitRow = {
      day: 2,
      title: '예레반 · 두바이 시티',
      routeText: '예레반 - 두바이 - 두바이 시티',
      imageKeyword: '',
    }
    assert.equal(isRegisterScheduleMovementOrTransitDay(transitRow), true)
    assert.equal(
      isRegisterPendingFreeItineraryDay(transitRow, { productTitle: '코카서스 10일 #2일 자유일정' }),
      false,
    )
    const transit = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '코카서스 10일 #2일 자유일정',
      productDestination: '조지아',
      rows: [
        { day: 1, title: '1일차', routeText: '인천', imageKeyword: 'Incheon' },
        transitRow,
        { day: 3, title: '귀국', routeText: '인천', imageKeyword: '' },
      ],
    })
    assert.equal(transit.issues.includes('day2_free_recommended_itinerary_missing'), false)
    const fit = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'air_hotel_free',
      productType: 'air-hotel',
      productTitle: '미서부 10일 자유일정',
      productDestination: '미국',
      rows: [
        { day: 1, title: '1일차', routeText: '인천', imageKeyword: 'Incheon' },
        { day: 2, title: '2일차', routeText: '라스베이거스', imageKeyword: 'Las Vegas Strip' },
        { day: 3, title: '귀국', routeText: '인천', imageKeyword: '' },
      ],
    })
    assert.equal(fit.issues.some((i) => i.includes('free_recommended_itinerary_missing')), false)
  })

  // REGRESSION-FREEZE[register-pre-photo-heal-keep-filled-keywords]: 유효 랜드마크는 덮어쓰지 않음 — manifest
  it('이미 채워진 유효 랜드마크는 덮어쓰지 않는다', () => {
    const out = healRegisterPrePhotoSchedule(
      [
        {
          day: 1,
          title: '1일차',
          description: '인천에서 출발합니다.',
          routeText: '인천 - 요나고',
          imageKeyword: 'Incheon Departure',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '2일차',
          description: '돗토리 사구 모래미술관을 둘러봅니다.',
          routeText: '요나고 - 돗토리 사구 모래미술관',
          imageKeyword: 'Tottori Sand Museum',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '3일차 귀국',
          description: '인천으로 귀국합니다.',
          routeText: '요나고 - 인천',
          imageKeyword: 'Adachi Museum of Art',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'modetour',
        productDestination: '돗토리',
        productTitle: '돗토리 3일',
      },
    )
    const d2 = out.rows.find((r) => r.day === 2)!
    assert.equal(d2.imageKeyword, 'Tottori Sand Museum')
    assert.equal(out.reappliedKeywords, false)
  })

  it('잘린 of·de 구와 식사 키워드는 깨진 랜드마크다', () => {
    assert.equal(isBrokenRegisterLandmarkKeyword('Great Sphinx of'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Catedral de'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Carbonara'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Souvenir Shop'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Linh Ung Pagoda'), false)
  })

  it('다낭 상품의 산토리니 키워드는 비우고 다낭 명소로 다시 채운다', () => {
    const out = healRegisterPrePhotoSchedule(
      [
        {
          day: 1,
          title: '1일차',
          description: '다낭에 도착해 일정을 시작합니다. 이동 중심으로 하루를 맞춥니다.',
          routeText: '다낭 입국',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '2일차',
          description: '손짜 마리나와 한시장을 둘러봅니다. 시내 동선을 이어갑니다.',
          routeText: '손짜 마리나 카페 - 다낭에서 만나는 작은 산토리니 - 한시장 - 대성당',
          imageKeyword: 'Santorini Caldera Blue Domes',
          imageKeyword2: 'Fira Santorini Caldera',
        },
        {
          day: 3,
          title: '3일차 귀국',
          description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
          routeText: '다낭 출발 및 인천 귀국',
          imageKeyword: 'Santorini',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '다낭 (한시장)',
        productTitle: '[2030전용] 다낭 5일 #OQ클럽파티',
      },
    )
    for (const row of out.rows) {
      assert.doesNotMatch(String(row.imageKeyword ?? ''), /Santorini|Fira|Oia/i)
      assert.doesNotMatch(String(row.imageKeyword2 ?? ''), /Santorini|Fira|Oia/i)
    }
    const live = verifyRegisterPrePhoto({
      lane: 'package',
      productDestination: '다낭 (한시장)',
      productTitle: '[2030전용] 다낭 5일 #OQ클럽파티',
      rows: out.rows,
    })
    assert.equal(live.ok, true)
  })

  it('이집트 일정에 두바이 키워드가 있으면 제거한다', () => {
    const out = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: '카이로', imageKeyword: '', description: '카이로에 도착합니다. 첫날 이동을 맞춥니다.' },
        {
          day: 2,
          routeText: '엘 고나 - 후루가다 사막 사파리',
          imageKeyword: 'Dubai Desert Safari Dunes',
          description: '후르가다에서 사파리를 합니다. 사막 일정을 이어갑니다.',
        },
        { day: 3, routeText: '후르가다', imageKeyword: '', description: '인천으로 귀국합니다. 이동 중심으로 마무리합니다.' },
      ],
      { supplierKey: 'hanatour', productDestination: '이집트', productTitle: '이집트 일주 10일' },
    )
    const d2 = out.rows.find((r) => r.day === 2)!
    assert.doesNotMatch(String(d2.imageKeyword ?? ''), /Dubai|Burj/i)
    assert.match(String(d2.imageKeyword ?? ''), /El Gouna|Red Sea desert safari/i)
  })

  it('장가계 귀국일 쿠알라룸푸르는 제거해도 검증이 통과한다', () => {
    const out = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: '장가계', imageKeyword: 'Zhangjiajie', description: '장가계에 도착합니다. 첫날 이동을 맞춥니다.' },
        {
          day: 2,
          routeText: '장가계 - 천문산',
          imageKeyword: 'Tianmen Mountain',
          description: '천문산을 오릅니다. 장가계 협곡을 이어갑니다.',
        },
        { day: 3, routeText: '쿠알라룸푸르', imageKeyword: 'Kuala Lumpur', description: '경유 후 귀국합니다. 이동 중심으로 마무리합니다.' },
      ],
      { supplierKey: 'verygoodtour', productDestination: '장가계', productTitle: '장가계 직항 5일' },
    )
    const d3 = out.rows.find((r) => r.day === 3)!
    assert.doesNotMatch(String(d3.imageKeyword ?? ''), /Kuala Lumpur|Petronas/i)
    const live = verifyRegisterPrePhoto({
      lane: 'package',
      productDestination: '장가계',
      productTitle: '장가계 직항 5일',
      rows: out.rows,
    })
    assert.equal(live.ok, true)
  })

  it('FIT 식사 키워드는 비운다', () => {
    assert.equal(isBrokenRegisterLandmarkKeyword('Carbonara'), true)
    const out = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: '로마', imageKeyword: 'Carbonara', description: '로마에 도착합니다. 첫날 이동을 맞춥니다.' },
        { day: 2, routeText: '콜로세움', imageKeyword: 'Carbonara', description: '콜로세움을 봅니다. 시내 일정을 이어갑니다.' },
        { day: 3, routeText: '로마', imageKeyword: '', description: '귀국합니다. 이동 중심으로 마무리합니다.' },
      ],
      {
        supplierKey: 'naeiltour',
        productDestination: '유럽 왕복항공권',
        productTitle: '로마 3일',
        lane: 'air_hotel_free',
      },
    )
    const d2 = out.rows.find((r) => r.day === 2)!
    assert.doesNotMatch(String(d2.imageKeyword ?? ''), /Carbonara/i)
  })

  it('런던+파리 제목이면 석식 dest여도 루브르는 나라 오류가 아니다', () => {
    assert.equal(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Louvre Museum',
        registerPrePhotoPlaceDestHay('중국식 [석식]현지식 |', '[ 런던+파리 10일]#자유여행패키지'),
        [{ routeText: '파리', title: '6일차', description: '루브르를 봅니다.' }],
      ),
      false,
    )
    const live = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      productDestination: '중국식 [석식]현지식 |',
      productTitle: '[ 런던+파리 10일]#자유여행패키지 #노쇼핑/노옵션',
      rows: [
        { day: 1, imageKeyword: 'Piccadilly Circus' },
        { day: 2, imageKeyword: 'Buckingham Palace' },
        { day: 6, imageKeyword: 'Louvre Museum' },
      ],
    })
    assert.equal(live.issues.some((i) => i.includes('wrong_country')), false)
  })

  it('제목 미입력·dest 미지정은 검증 실패다', () => {
    const live = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'air_hotel_free',
      productType: 'air-hotel',
      productTitle: '미입력',
      productDestination: '유럽 왕복항공권',
      rows: [
        { day: 1, description: '로마에 도착합니다. 첫날 이동을 맞춥니다.', imageKeyword: 'Colosseum' },
        { day: 2, description: '바티칸을 둘러봅니다. 시내 일정을 이어갑니다.', imageKeyword: 'Vatican Museums' },
        { day: 3, description: '귀국합니다. 이동 중심으로 마무리합니다.', imageKeyword: '' },
      ],
    })
    assert.equal(live.ok, false)
    assert.ok(live.issues.includes('title_placeholder'))
    assert.ok(live.issues.includes('destination_placeholder'))
    const destStub = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '동경 4일 #아사쿠사',
      productDestination: '미지정',
      rows: [
        { day: 1, description: '도쿄에 도착합니다. 첫날 이동을 맞춥니다.', imageKeyword: 'Tokyo' },
        { day: 2, description: '아사쿠사를 둘러봅니다. 시내 동선을 이어갑니다.', imageKeyword: 'Senso-ji Temple' },
        { day: 3, description: '귀국합니다. 이동 중심으로 마무리합니다.', imageKeyword: '' },
      ],
    })
    assert.equal(destStub.ok, false)
    assert.ok(destStub.issues.includes('destination_placeholder'))
  })

  it('방문도시 반복은 랜드마크 블리드가 아니고 dest는 제목에서만 추론한다', () => {
    assert.equal(inferRegisterPendingDestinationFromTitle('동경 4일 #아사쿠사'), '도쿄')
    assert.equal(inferRegisterPendingDestinationFromTitle('이태리 금까기'), '이탈리아')
    assert.equal(inferRegisterPendingDestinationFromTitle('보르도'), '보르도')
    assert.equal(inferRegisterPendingDestinationFromTitle('푸꾸옥 5일 #모벤픽'), '푸꾸옥')
    assert.equal(inferRegisterPendingDestinationFromTitle('미입력'), '')
    const live = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '사이판 골프 5일',
      productDestination: '사이판',
      rows: [
        { day: 1, description: '사이판에 도착합니다. 첫날 이동을 맞춥니다.', imageKeyword: 'Saipan', routeText: '사이판' },
        { day: 2, description: '골프 일정을 이어갑니다. 리조트에서 하루를 보냅니다.', imageKeyword: 'Saipan', routeText: '사이판' },
        { day: 3, description: '라운드를 이어갑니다. 리조트에서 하루를 보냅니다.', imageKeyword: 'Saipan', routeText: '사이판' },
        { day: 4, description: '귀국합니다. 이동 중심으로 마무리합니다.', imageKeyword: '', routeText: '사이판' },
      ],
    })
    assert.equal(live.issues.some((i) => i.includes('keyword_bleed_other_day')), false)
    assert.equal(isLikelyTourismLandmarkKeyword('Golden Circle Iceland'), true)
    assert.equal(isLikelyTourismLandmarkKeyword('Petra Treasury'), true)
    assert.equal(isLikelyTourismLandmarkKeyword('Wadi Rum desert'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Venice Grand'), false)
    assert.equal(isBrokenRegisterLandmarkKeyword('Cappadocia Fairy Chimneys'), false)
    assert.equal(isBrokenRegisterLandmarkKeyword('Dead Sea Jordan'), false)
    const freeDayRows = [
      { day: 1, description: '인천에서 출발해 괌에 도착합니다. 첫날 이동을 맞춥니다.', imageKeyword: 'Guam', routeText: '' },
      { day: 2, description: '2일차 일정을 진행합니다. 동선에 맞춰 하루 일정을 이어갑니다.', imageKeyword: '', routeText: '' },
      { day: 3, description: '성급 모벤픽 호텔을 중심으로 하루 일정을 진행합니다.', imageKeyword: '', routeText: '성급 모벤픽 호텔' },
      { day: 4, description: '체크아웃 후 인천으로 귀국합니다. 이동 중심으로 마무리합니다.', imageKeyword: '', routeText: '' },
    ]
    const freeDay = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '괌 츠바키 타워 5일',
      productDestination: '괌',
      rows: freeDayRows,
    })
    assert.equal(isRegisterPendingFreeItineraryDay(freeDayRows[1]!, { productTitle: '괌 츠바키 타워 5일' }), false)
    assert.equal(freeDay.ok, false)
    assert.ok(freeDay.issues.includes('day2_middle_keyword_empty'))
    assert.equal(freeDay.issues.includes('day2_free_recommended_itinerary_missing'), false)
    const hasItinerary = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '로마 3일',
      productDestination: '이탈리아',
      rows: [
        { day: 1, description: '로마에 도착합니다. 첫날 이동을 맞춥니다.', imageKeyword: 'Colosseum', routeText: '로마' },
        { day: 2, description: '콜로세움을 봅니다. 시내 일정을 이어갑니다.', imageKeyword: '', routeText: '콜로세움' },
        { day: 3, description: '귀국합니다. 이동 중심으로 마무리합니다.', imageKeyword: '', routeText: '' },
      ],
    })
    assert.equal(hasItinerary.ok, false)
    assert.ok(hasItinerary.issues.includes('day2_middle_keyword_empty'))
  })

  it('호텔 중간일에 전날 Grand World가 복사되면 재적용한다', () => {
    const out = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: '', imageKeyword: '', description: '인천에서 출발해 현지에서 도착합니다. 첫날 이동을 맞춥니다.' },
        { day: 2, routeText: '그랜드월드 - 소나씨 야시장', imageKeyword: 'Grand World', imageKeyword2: 'Sonasea Night Market', description: '그랜드월드를 중심으로 하루 일정을 진행합니다. 동선에 맞춰 하루 일정을 이어갑니다.' },
        { day: 3, routeText: '성급 모벤픽 호텔', imageKeyword: 'Grand World', imageKeyword2: 'Sonasea Night Market', description: '성급 모벤픽 호텔을 중심으로 하루 일정을 진행합니다. 동선에 맞춰 하루 일정을 이어갑니다.' },
        { day: 4, routeText: '호국사', imageKeyword: 'Ho Quoc Pagoda', description: '호국사를 둘러봅니다. 섬 일정을 이어서 진행합니다.' },
        { day: 5, routeText: '', imageKeyword: '', description: '체크아웃 후 인천으로 귀국합니다. 이동 중심으로 마무리합니다.' },
      ],
      { supplierKey: 'hanatour', productTitle: '푸꾸옥 5일 #모벤픽', productDestination: '푸꾸옥', lane: 'package' },
    )
    const d3 = out.rows.find((r) => r.day === 3)!
    assert.doesNotMatch(String(d3.imageKeyword ?? ''), /Grand World/i)
    assert.ok(String(d3.imageKeyword ?? '').trim().length > 0)
  })

  it('2단어 상호는 랜드마크가 아니고 같은 날 나라 혼선은 검증 실패다', () => {
    assert.equal(isLikelyTourismLandmarkKeyword('Le Comptoir du Relais'), false)
    assert.equal(isLikelyTourismLandmarkKeyword('Taormina'), true)
    assert.equal(isLikelyTourismLandmarkKeyword('Chichen Itza'), true)
    assert.equal(isLikelyTourismLandmarkKeyword('Blue Mountains'), true)
    assert.equal(isLikelyTourismLandmarkKeyword('Taj Mahal'), true)
    assert.equal(isLikelyTourismLandmarkKeyword('Hungarian Parliament Budapest'), true)
    assert.equal(isLikelyTourismLandmarkKeyword('La Rambla Barcelona'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Le Comptoir du Relais'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Citypharma'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('ABC Stores'), true)
    assert.equal(
      isRegisterScheduleSameDayKeywordCountryClash('Colosseum Rome Amphitheater', 'Jungfraujoch Swiss Alps'),
      true,
    )
    assert.equal(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Christchurch Cathedral Square',
        registerPrePhotoPlaceDestHay('시드니 타워', '시드니+골드코스트 6일'),
      ),
      true,
    )
    assert.equal(
      isRegisterScheduleCrossContinentHallucinationKeyword('Cairo', '보르도', [
        { day: 4, routeText: '자르댕 퓌블리크 - 포르트 카이요' },
      ]),
      true,
    )
    assert.equal(
      isRegisterScheduleCrossContinentHallucinationKeyword('Phuket', '하와이', [
        { day: 3, routeText: '카우아이 - 호놀룰루' },
      ]),
      true,
    )
    assert.equal(
      isRegisterScheduleCrossContinentHallucinationKeyword('Place Massena Nice', '중남미', [
        { day: 18, routeText: '테오티우아칸 - 소깔로 광장' },
      ]),
      true,
    )
    const mixed = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '파리 | 스위스 | 로마',
      productDestination: '유럽',
      rows: [
        { day: 1, description: '파리에 도착합니다. 첫날 이동을 맞춥니다.', imageKeyword: 'Paris' },
        {
          day: 2,
          description: '인터라켄과 베네치아를 한 날에 넣습니다. 동선이 섞여 있습니다.',
          imageKeyword: 'Interlaken Swiss Alps',
          imageKeyword2: 'Venice Grand',
        },
        { day: 3, description: '귀국합니다. 이동 중심으로 마무리합니다.', imageKeyword: '' },
      ],
    })
    assert.equal(mixed.ok, false)
    assert.ok(mixed.issues.some((i) => i.includes('same_day_country_clash')))
  })
})
