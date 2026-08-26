/**
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 패키지·자유여행·테마 레인 — manifest
 * REGRESSION-FREEZE[fit-pre-photo-verify-keywords]: FIT 키워드 공란이면 검증 실패 — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRegisterAdminLane } from '../lib/register-admin-lane'
import { healRegisterPrePhotoSchedule } from '../lib/register-pre-photo-self-heal'
import {
  mergeRegisterPrePhotoStampIntoRawMeta,
  readRegisterPrePhotoStampFromRawMeta,
  verifyRegisterPrePhoto,
} from '../lib/register-pre-photo-verify'

describe('register-admin-lane-pre-photo', () => {
  it('명시 자유여행은 테마 태그보다 앞선다', () => {
    assert.equal(
      resolveRegisterAdminLane({
        adminTravelScope: 'air_hotel_free',
        sportsThemeTag: ['golf'],
      }),
      'air_hotel_free',
    )
    assert.equal(
      resolveRegisterAdminLane({
        listingKind: 'air_hotel_free',
        productType: 'air-hotel',
        sportsThemeTag: ['2030'],
      }),
      'air_hotel_free',
    )
  })

  it('패키지 + sportsThemeTag 는 테마여행 레인이다', () => {
    assert.equal(
      resolveRegisterAdminLane({
        listingKind: 'travel',
        productType: 'travel',
        sportsThemeTag: ['spectator'],
      }),
      'theme',
    )
    assert.equal(
      resolveRegisterAdminLane({
        listingKind: 'travel',
        productType: 'travel',
        sportsThemeTag: [],
      }),
      'package',
    )
  })

  it('자유여행 힐은 호텔 키워드를 패키지 랜드마크로 덮지 않는다', () => {
    const out = healRegisterPrePhotoSchedule(
      [
        {
          day: 1,
          title: '1일차',
          description: '호텔 체크인 후 자유일정입니다.',
          routeText: '타이베이',
          imageKeyword: 'Grand Hyatt Taipei',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'ybtour',
        productDestination: '타이베이',
        productTitle: '대만 에어텔 3일',
        lane: 'air_hotel_free',
      },
    )
    assert.equal(out.reappliedKeywords, false)
    assert.equal(out.rows[0]?.imageKeyword, 'Grand Hyatt Taipei')
  })

  it('패키지 검증은 파라도르 키워드를 거부하고, 테마는 태그가 있어야 한다', () => {
    const broken = verifyRegisterPrePhoto({
      lane: 'package',
      listingKind: 'travel',
      productType: 'travel',
      rows: [
        { day: 1, description: '인천에서 출발해 바르셀로나에 도착합니다.', imageKeyword: 'Barcelona' },
        {
          day: 2,
          description: '시체스를 둘러봅니다. 바닷가 일정을 이어갑니다.',
          imageKeyword: 'Parador de Alcaniz',
        },
        { day: 3, description: '체크아웃 후 인천으로 귀국합니다.', imageKeyword: '' },
      ],
    })
    assert.equal(broken.ok, false)
    assert.ok(broken.issues.some((i) => i.includes('lodging')))
    assert.equal(broken.parserFixRequired, true)

    const bleed = verifyRegisterPrePhoto({
      lane: 'package',
      listingKind: 'travel',
      productType: 'travel',
      rows: [
        { day: 1, description: '인천에서 출발해 바르셀로나에 도착합니다. 첫날 이동 중심으로 여행을 시작합니다.', imageKeyword: 'Barcelona' },
        { day: 2, description: '가우디 건축을 중심으로 하루를 보냅니다. 시내의 리듬에 맞춰 관람 동선을 이어갑니다.', imageKeyword: 'Park Guell' },
        { day: 3, description: '가우디 건축을 중심으로 하루를 보냅니다. 시내의 리듬에 맞춰 관람 동선을 이어갑니다.', imageKeyword: 'Park Guell' },
        { day: 4, description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.', imageKeyword: '' },
      ],
    })
    assert.equal(bleed.ok, false)
    assert.ok(bleed.issues.some((i) => i.includes('bleed')))
    assert.equal(bleed.parserFixRequired, true)

    const themeRows = [
      {
        day: 1,
        description: '인천에서 출발해 바르셀로나에 도착합니다. 첫날 이동 중심으로 여행을 시작합니다.',
        imageKeyword: 'Barcelona',
      },
      {
        day: 2,
        description:
          '가우디 건축과 리세우를 중심으로 하루를 보냅니다. 시내의 리듬에 맞춰 관람 동선을 이어갑니다.',
        imageKeyword: 'Park Guell',
      },
      {
        day: 3,
        description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
        imageKeyword: '',
      },
    ]
    const themeOk = verifyRegisterPrePhoto({
      lane: 'theme',
      listingKind: 'travel',
      productType: 'travel',
      sportsThemeTag: ['spectator'],
      rows: themeRows,
    })
    assert.equal(themeOk.ok, true)
    assert.equal(themeOk.readyForOperatorPhoto, true)
    assert.equal(themeOk.parserFixRequired, false)

    const themeMissing = verifyRegisterPrePhoto({
      lane: 'theme',
      listingKind: 'travel',
      productType: 'travel',
      sportsThemeTag: [],
      rows: themeRows,
    })
    assert.equal(themeMissing.ok, false)
    assert.ok(themeMissing.issues.includes('theme_tag_missing'))
  })

  it('자유여행 검증은 호텔 키워드를 허용하고 listingKind 를 본다', () => {
    const ok = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'air_hotel_free',
      productType: 'air-hotel',
      rows: [{ day: 1, description: '호텔', imageKeyword: 'Grand Hyatt Taipei' }],
    })
    assert.equal(ok.ok, true)
    const mismatch = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'travel',
      productType: 'travel',
      rows: [{ day: 1, description: '호텔', imageKeyword: 'Grand Hyatt Taipei' }],
    })
    assert.equal(mismatch.ok, false)
  })

  it('자유여행 검증은 일정·키워드 공란이면 실패한다', () => {
    const emptySched = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'air_hotel_free',
      productType: 'air-hotel',
      rows: [],
    })
    assert.equal(emptySched.ok, false)
    assert.ok(emptySched.issues.includes('schedule_empty'))
    assert.equal(emptySched.parserFixRequired, true)

    const emptyKw = verifyRegisterPrePhoto({
      lane: 'air_hotel_free',
      listingKind: 'air_hotel_free',
      productType: 'air-hotel',
      rows: [
        { day: 1, description: '도착', imageKeyword: '' },
        { day: 2, description: '자유일정', imageKeyword: '' },
        { day: 3, description: '귀국', imageKeyword: '' },
      ],
    })
    assert.equal(emptyKw.ok, false)
    assert.ok(emptyKw.issues.includes('fit_keyword_empty'))
    assert.ok(emptyKw.issues.some((i) => i.includes('middle_keyword_empty')))
    assert.equal(emptyKw.parserFixRequired, true)
  })

  it('rawMeta 스탬프는 기존 키를 덮지 않는다', () => {
    const merged = mergeRegisterPrePhotoStampIntoRawMeta(
      JSON.stringify({ hanatourNextPriceRecheckYmd: '2026-09-01' }),
      {
        lane: 'package',
        laneLabel: '해외 패키지',
        ok: true,
        readyForOperatorPhoto: true,
        parserFixRequired: false,
        issues: [],
      },
      '2026-08-26T00:00:00.000Z',
    )
    const obj = JSON.parse(merged) as { hanatourNextPriceRecheckYmd?: string }
    assert.equal(obj.hanatourNextPriceRecheckYmd, '2026-09-01')
    const stamp = readRegisterPrePhotoStampFromRawMeta(merged)
    assert.equal(stamp?.ok, true)
    assert.equal(stamp?.lane, 'package')
  })
})
