/**
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: 파라도르·중복 문장 셀프힐 — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-keep-filled-keywords]: 유효 랜드마크 유지 — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  healRegisterPrePhotoSchedule,
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
  isObviouslyBrokenScheduleImageUrl,
} from '../lib/register-pre-photo-self-heal'

describe('register-pre-photo-self-heal', () => {
  it('파라도르·정찬 키워드는 깨진 랜드마크로 본다', () => {
    assert.equal(isBrokenRegisterLandmarkKeyword('Parador de Alcaniz'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('파라도르정찬식'), true)
    assert.equal(isBrokenRegisterLandmarkKeyword('Park Guell'), false)
  })

  it('중복 동선 문장은 깨진 요약이다', () => {
    assert.equal(
      isBrokenRegisterScheduleDescription(
        '바르셀로나와 리세우 대극장을 중심으로 하루를 보냅니다. 동선에 맞춰 하루 일정을 이어갑니다. 동선에 맞춰 일정을 이어갑니다.',
      ),
      true,
    )
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

  it('등록 SSOT로도 중간일 키워드가 비면 parser_fix_required', () => {
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
    assert.ok(out.notes.some((n) => n.reason === 'parser_fix_required'))
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
})
