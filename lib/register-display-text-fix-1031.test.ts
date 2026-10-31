/**
 * REGRESSION-FREEZE[display-text-fix-1031]: 일정 일차 title·routeText 공지/요금/객실/문장조각 noise,
 * 「로」끝 지명 절단(삿포로·카이로), verygoodtour 귀국일 쿠알라룸푸르 하드코딩, 스위스벨·이태리풍경구 dest — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  extractRegisterScheduleRoutePlaceLabel,
  isRegisterScheduleNoticeOrFragmentRouteLabel,
  sanitizeRegisterScheduleRouteText,
} from '@/lib/register-schedule-route-place-noise'
import { composeRegisterScheduleDayTitleFromRoute } from '@/lib/register-schedule-day-title'
import { inferRegisterPendingDestinationFromTitle } from '@/lib/register-pre-photo-verify'
import {
  countryKeyHasContentEvidence,
  strongOtherCountryKeysFromHay,
} from '@/lib/register-pre-photo-product-country-schedule-guard'
import { parseVerygoodScheduleRowsFromDetailHtml } from '@/lib/verygoodtour-register-schedule-item-parse'

describe('display-text-fix-1031 — 로 끝 지명', () => {
  it('삿포로·카이로·상파울로는 조사 로로 자르지 않는다', () => {
    expect(extractRegisterScheduleRoutePlaceLabel('삿포로')).toBe('삿포로')
    expect(extractRegisterScheduleRoutePlaceLabel('삿포로로 이동')).toBe('삿포로')
    expect(extractRegisterScheduleRoutePlaceLabel('삿포로 이동')).toBe('삿포로')
    expect(extractRegisterScheduleRoutePlaceLabel('올드 카이로 관광')).toBe('올드 카이로')
    expect(extractRegisterScheduleRoutePlaceLabel('상파울로')).toBe('상파울로')
  })
  it('기존 조사 strip 유지', () => {
    expect(extractRegisterScheduleRoutePlaceLabel('호이안 옛도시로 이동')).toBe('호이안 옛도시')
    expect(extractRegisterScheduleRoutePlaceLabel('호이안 옛도시로')).toBe('호이안 옛도시')
    expect(extractRegisterScheduleRoutePlaceLabel('다낭으로 이동')).toBe('다낭')
    expect(extractRegisterScheduleRoutePlaceLabel('알마티로 복귀')).toBe('알마티')
  })
})

describe('display-text-fix-1031 — 공지·요금·객실·문장조각 noise', () => {
  it.each([
    '전자담배 사용금지 관련 공지',
    '아버지가 보호자로 입국할 경우',
    '카자흐스탄 입국 시 액상형 전자담배 소지 금지!',
    '000원/인)',
    '3인/1실 이용시, 트윈베드에 간이침대 추가됩니다.',
    '참고사항',
    '결제취소문자가 가지는 않습니다.',
    '물놀이 안전 수칙',
    'Customs. BN 어플 다운로드 후 진행',
    '* 12시경 가이드',
    '( 간혹, 현장',
    '1. 외국',
    '즐거운 여행이 되셨기를 바랍니다.',
    '연중 무휴 24시간 이용가능',
    'SNS',
    '기내박()',
  ])('%s', (label) => {
    expect(isRegisterScheduleNoticeOrFragmentRouteLabel(label)).toBe(true)
  })
  it('지명은 noise 아님', () => {
    for (const s of ['＊ 구채구', '한 시장', '반다르 세리 베가완', '이식', '콜사이', '세나도광장 관람']) {
      expect(isRegisterScheduleNoticeOrFragmentRouteLabel(s)).toBe(false)
    }
    expect(extractRegisterScheduleRoutePlaceLabel('한 시장')).toBe('한 시장')
    expect(extractRegisterScheduleRoutePlaceLabel('＊ 구채구')).toBe('구채구')
    expect(extractRegisterScheduleRoutePlaceLabel('택1) 옌뜨')).toBe('옌뜨')
  })
  it('문장 조각 → 꼬리 명소만', () => {
    expect(extractRegisterScheduleRoutePlaceLabel('위한 꺼지지 않는 불꽃이 있는 판필로프 28인 공원')).toBe('판필로프 28인 공원')
    expect(extractRegisterScheduleRoutePlaceLabel('지어진 건축물이며 대지진도 견뎌낸 젠코바 성당')).toBe('젠코바 성당')
    expect(extractRegisterScheduleRoutePlaceLabel('의 작품인 성 가족 성당(내부)')).toBe('성 가족 성당(내부)')
  })
  it('routeText sanitize — 원문 지명만 남김', () => {
    expect(sanitizeRegisterScheduleRouteText('상해 - 푸동 - 참고사항 - 000원/인) - 3인/1실 이용시, 트윈베드에 간이침대 추가됩니다.')).toBe('상해 - 푸동')
    expect(sanitizeRegisterScheduleRouteText('세부 - 재래시장, 과일가게 - 전자담배 사용금지 관련 공지')).toBe('세부 - 재래시장, 과일가게')
    expect(sanitizeRegisterScheduleRouteText('삿포로 - 삿포로 시계탑(하계) - 스키야키정식')).toBe('삿포로 - 삿포로 시계탑(하계) - 스키야키정식')
  })
})

describe('display-text-fix-1031 — day title', () => {
  it('title도 공지·요금 세그먼트와 국내 허브 제외', () => {
    expect(composeRegisterScheduleDayTitleFromRoute({ day: 2, maxDay: 4, routeText: '세부 - 재래시장, 과일가게 - 전자담배 사용금지 관련 공지' })).toBe('세부 · 재래시장, 과일가게')
    expect(composeRegisterScheduleDayTitleFromRoute({ day: 4, maxDay: 6, routeText: '상해 - 푸동 - 000원/인) - 3인/1실 이용시, 트윈베드에 간이침대 추가됩니다.' })).toBe('상해 · 푸동')
    expect(composeRegisterScheduleDayTitleFromRoute({ day: 1, maxDay: 5, routeText: '대구 - 방콕 - 방콕' })).toBe('방콕')
  })
  it('자유일·귀국일 기존 동작 유지', () => {
    expect(composeRegisterScheduleDayTitleFromRoute({ day: 3, maxDay: 5, routeText: '자유시간' })).toBe('자유시간')
    expect(composeRegisterScheduleDayTitleFromRoute({ day: 5, maxDay: 5, routeText: '인천', returnTitle: '귀국' })).toBe('귀국')
    expect(composeRegisterScheduleDayTitleFromRoute({ day: 1, maxDay: 5, routeText: '전자담배 사용금지 관련 공지' })).toBe('1일차')
  })
})

describe('display-text-fix-1031 — dest/country', () => {
  it('스위스벨 호텔은 스위스 dest 가 아니다', () => {
    expect(inferRegisterPendingDestinationFromTitle('[NO쇼핑] 마나도 스위스벨 호텔 [1일자유+호핑투어+시내관광] 5일')).not.toBe('스위스')
    expect(inferRegisterPendingDestinationFromTitle('스위스 융프라우 8일')).toBe('스위스')
  })
  it('톈진 이태리풍경구 ≠ italy, 톈진 = china 증거', () => {
    const hay = '톈진 3일 서개(시카이)성당 - 이태리풍경구 - 하이허광장 야경'
    expect(countryKeyHasContentEvidence('china', hay)).toBe(true)
    expect(countryKeyHasContentEvidence('italy', hay)).toBe(false)
    expect(strongOtherCountryKeysFromHay(hay, 'china')).not.toContain('italy')
  })
})

describe('display-text-fix-1031 — verygoodtour 귀국일 패널 없음', () => {
  it('원문에 없는 쿠알라룸푸르를 만들지 않는다', () => {
    const html = `<div>3박 4일</div><div id="product-day-1"><div class="tit">인천 - 가오슝</div></div>`
    const rows = parseVerygoodScheduleRowsFromDetailHtml(html)
    for (const r of rows) {
      expect(`${r.routeText ?? ''} ${r.description ?? ''}`).not.toMatch(/쿠알라룸푸르/)
    }
  })
})
