/**
 * REGRESSION-FREEZE[ingest-domestic-skip-category-1122]: 국내 목적지 skip·지방출발 해외 포함·원문 분류 4종 — manifest
 * 사장님 2026-11-22 00:46: 한진 하루 50건, 나머지 공급사 하루 15건. 국내 목적지 상품은 수집하지 않는다.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { classifyHanjintourCategory, isHanjintourDomesticListing } from '@/lib/hanjintour-category'
import { planHanjintourPendingEnqueue } from '@/lib/hanjintour-register'
import { isRegisterIngestDomesticKoreaProduct } from '@/lib/register-ingest-reject-domestic-korea'
import { REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER } from '@/lib/register-pre-photo-ingest-geo-slots'
import { REGISTER_PRE_PHOTO_INGEST_OPERATOR_NIGHT_TOTAL } from '@/lib/register-pre-photo-ingest-night-window'

const dep = { evtNo: 'OP1', date: '2027-03-21', rawDate: '20270321', status: '예약가능', adultPrice: 990000 }
const base = { gdsNo: 'X1', existingRows: [], todayIso: '2026-11-22', departures: [dep] }

describe('수집 한도', () => {
  it('공급사마다 하루 15건, 7사 합계 105건, 한진은 하루 50건', () => {
    expect(REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER).toBe(15)
    expect(REGISTER_PRE_PHOTO_INGEST_OPERATOR_NIGHT_TOTAL).toBe(105)
    const src = readFileSync('lib/instrumentation-hanjintour-sweep-cron.ts', 'utf8')
    expect(src).toContain('HANJINTOUR_DAILY_INGEST_LIMIT = 50')
  })
})

describe('국내 목적지 제외', () => {
  it('국내 분류·국내 호캉스·제주도 상품은 국내로 본다', () => {
    expect(isHanjintourDomesticListing('설악산 단풍 2일', [['국내여행', '강원']])).toBe(true)
    expect(isHanjintourDomesticListing('그랜드 호텔 1박', [['호캉스', '제주']])).toBe(true)
    expect(isHanjintourDomesticListing('제주도 3일 올레길', [['테마', '트레킹']])).toBe(true)
  })

  it('지방출발 해외 상품은 목적지 기준으로 해외다(부산·대구·청주·광주·제주 출발)', () => {
    expect(isHanjintourDomesticListing('[부산출발] 다낭 5일', [['동남아', '베트남', '다낭']])).toBe(false)
    expect(isHanjintourDomesticListing('[대구출발] 장가계 5일', [['중국/홍콩/대만/몽골', '중국', '장가계']])).toBe(false)
    expect(isHanjintourDomesticListing('[청주출발] 오사카 4일', [['일본', '오사카']])).toBe(false)
    expect(isHanjintourDomesticListing('[광주출발] 방콕 5일', [['동남아', '태국']])).toBe(false)
    expect(isHanjintourDomesticListing('[제주출발] 상해 4일', [['중국/홍콩/대만/몽골', '중국', '상해']])).toBe(false)
    expect(isRegisterIngestDomesticKoreaProduct('[대구출발] 하노이 하롱베이 5일')).toBe(false)
    expect(isRegisterIngestDomesticKoreaProduct('국내여행 거문도 백도 2일')).toBe(true)
  })

  it('한진 등록대기 계획은 국내 목적지를 domestic 사유로 건너뛴다', () => {
    expect(planHanjintourPendingEnqueue({ ...base, title: '그랜드 호텔 1박', categoryPaths: [['호캉스', '제주']] })).toMatchObject({
      ok: false,
      reason: 'domestic',
    })
    expect(planHanjintourPendingEnqueue({ ...base, title: '[부산출발] 다낭 5일', categoryPaths: [['동남아', '베트남', '다낭']] })).toMatchObject({
      ok: true,
    })
  })

  it('7개 공급사 수집은 국내 거절을 skipReasons.domestic 으로 센다', () => {
    const src = readFileSync('lib/register-pre-photo-listing-ingest.ts', 'utf8')
    expect(src).toContain('sr.domestic = (sr.domestic ?? 0) + 1')
    const hj = readFileSync('scripts/hanjintour-ingest-pending.ts', 'utf8')
    expect(hj).toContain('skipReasons.domestic = (skipReasons.domestic ?? 0) + 1')
  })
})

describe('원문 분류 4종', () => {
  it('패키지', () => {
    expect(classifyHanjintourCategory('몰타 일주 4일', [['유럽', '몰타']])).toMatchObject({
      kind: '패키지',
      travelScope: 'overseas',
      themeTag: null,
      localDepartureTag: [],
    })
  })
  it('자유여행', () => {
    expect(classifyHanjintourCategory('오사카 에어텔 3일', [['자유여행', '일본', '오사카']])).toMatchObject({
      kind: '자유여행',
      travelScope: 'air_hotel_free',
    })
  })
  it('테마여행', () => {
    expect(classifyHanjintourCategory('2027 챔피언십 관람', [[' 골프', '골프대회 참관', '2027 챔피언십']])).toMatchObject({
      kind: '테마여행',
      travelScope: 'overseas',
      themeTag: '골프',
    })
  })
  it('지방출발', () => {
    expect(classifyHanjintourCategory('[부산출발] 다낭 5일', [['동남아', '베트남', '다낭']]).localDepartureTag).toEqual(['busan'])
    expect(classifyHanjintourCategory('장가계 5일', [['지방출발', '청주출발', '장가계']]).localDepartureTag).toEqual(['cheongju'])
    const plan = planHanjintourPendingEnqueue({ ...base, title: '[대구출발] 장가계 5일', categoryPaths: [['중국/홍콩/대만/몽골', '중국', '장가계']] })
    expect(plan.ok && plan.category.localDepartureTag).toEqual(['daegu'])
  })
})

describe('매시 점검 수집 항목', () => {
  it('공개 상품 중 국내 목적지와 분류 없음을 기록만 한다', async () => {
    const { COLLECT_HEALTH_CHECKS } = await import('@/lib/site-health-collect-checks')
    const { runHealthChecks } = await import('@/lib/site-health-registry')
    const products = [
      { id: 'a', originSource: 'hanatour', title: '[부산출발] 다낭 5일', destination: '다낭', countryKey: 'vietnam', travelScope: 'overseas' },
      { id: 'b', originSource: 'modetour', title: '제주도 3일', destination: '제주', countryKey: 'korea', travelScope: 'overseas' },
      { id: 'c', originSource: 'ybtour', title: '오사카 4일', destination: '오사카', countryKey: 'japan', travelScope: null },
    ]
    const out = await runHealthChecks(COLLECT_HEALTH_CHECKS, { products })
    expect(out.map((s) => [s.id, s.kind, s.found, s.fixed])).toEqual([
      ['collect-public-domestic', 'code', 1, 0],
      ['collect-no-category', 'code', 1, 0],
    ])
  })
})
