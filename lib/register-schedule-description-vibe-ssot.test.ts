/**
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]
 */
import { describe, expect, it } from 'vitest'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import { composeYbtourScheduleDescription } from '@/lib/ybtour-register-api-schedule'
import {
  buildRegisterScheduleTripRouteKeywordContext,
  registerScheduleKeywordPassesTripRouteTextSsot,
  sanitizeRegisterScheduleImageKeywordsFromRouteEvidence,
} from '@/lib/register-schedule-route-evidence-keyword'
import { isRegisterScheduleCrossContinentHallucinationKeyword, inferRegisterEffectiveProductDestination } from '@/lib/register-schedule-cross-continent-keyword-guard'

describe('register schedule description vibe SSOT', () => {
  it('modetour — description은 routeText 복사 금지, vibe 2~3문장', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 2,
        places: ['피렌체', '베네치아'],
        hotels: ['4성 호텔'],
        meals: [],
        transportNote: null,
      },
    ])
    expect(days[0]?.routeText).toBe('피렌체 - 베네치아')
    expect(days[0]?.description).not.toBe(days[0]?.routeText)
    expect(days[0]?.description).toMatch(/여행|일정|분위기|동선/)
  })

  it('hanatour — description은 routeText 복사 금지', () => {
    const sched = hanatourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: ['방콕', '왕궁'],
        hotels: [],
        meals: [],
        transportNote: '인천 - 방콕',
      },
    ])
    expect(sched[0]?.routeText).toBe('방콕 - 왕궁')
    expect(sched[0]?.description).not.toBe(sched[0]?.routeText)
  })

  it('ybtour — description은 vibe만 (routeText 1줄 금지)', () => {
    const desc = composeYbtourScheduleDescription({
      day: 2,
      maxDay: 5,
      routePlaces: ['바르샤바', '리가'],
      joinedBlob: '바르샤바 - 리가',
    })
    expect(desc).not.toMatch(/^바르샤바\s*-\s*리가/)
    expect(desc).toMatch(/여행|일정|분위기|동선/)
  })
})

describe('register schedule imageKeyword trip routeText SSOT', () => {
  it('routeText에서 유도 불가한 Colosseum 차단', () => {
    const rows = [{ day: 3, routeText: '파타야 - 알카자 쇼', imageKeyword: 'Colosseum Rome', imageKeyword2: null }]
    const tripCtx = buildRegisterScheduleTripRouteKeywordContext(rows)
    expect(registerScheduleKeywordPassesTripRouteTextSsot('Colosseum Rome', tripCtx)).toBe(false)
    const out = sanitizeRegisterScheduleImageKeywordsFromRouteEvidence(rows)
    expect(out[0]?.imageKeyword).toBe('')
  })

  it('아시아 일정 — 유럽 랜드마크 cross-continent 차단', () => {
    const rows = [{ day: 1, routeText: '방콕 - 왕궁', title: '방콕' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Colosseum Rome', null, rows),
    ).toBe(true)
  })

  it('뉴질랜드 — Mount Fuji cross-continent 차단 (Japan city 일정 없을 때)', () => {
    // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Oceania dest Japan/Europe hallucination — manifest
    const rows = [{ day: 8, routeText: '오클랜드 - 해밀턴 가든', title: '오클랜드' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Mount Fuji Shizuoka view',
        '뉴질랜드',
        rows,
      ),
    ).toBe(true)
  })

  it('돗토리 일정 — Mount Fuji Shizuoka 환각 차단', () => {
    const rows = [
      { day: 3, routeText: '요나고 - 돗토리 - 쿠라요시', title: '돗토리' },
    ]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Mount Fuji Shizuoka view',
        '일본',
        rows,
      ),
    ).toBe(true)
  })

  it('규슈 벳푸 일정 — Mount Fuji 환각 차단', () => {
    const rows = [{ day: 2, routeText: '유후인 - 벳푸', title: '유후인' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Mount Fuji Shizuoka view',
        '일본',
        rows,
      ),
    ).toBe(true)
  })

  it('유럽 일정 — Louvre Abu Dhabi 환각 차단', () => {
    const rows = [{ day: 3, routeText: '파리 - 루브르', title: '파리' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Louvre Abu Dhabi Saadiyat Island',
        '프랑스',
        rows,
      ),
    ).toBe(true)
  })

  it('두바이 일정 — Louvre Abu Dhabi는 환각 아님', () => {
    const rows = [{ day: 3, routeText: '두바이 - 아부다비', title: '아부다비' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Louvre Abu Dhabi Saadiyat Island',
        '두바이',
        rows,
      ),
    ).toBe(false)
  })

  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Provence — 일본(홋카이도) 환각 차단 — manifest
  it('일본 홋카이도 일정 — Provence/Aix 키워드 환각', () => {
    const rows = [
      { day: 3, routeText: '후라노 이동 - 팜 토미타 - 라벤더 소프트', title: '후라노' },
      { day: 4, routeText: '치토세 국제공항 이동', title: '귀국' },
    ]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Provence lavender fields Valensole plateau',
        '일본',
        rows,
      ),
    ).toBe(true)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Aix-en-Provence old town fountain',
        '일본',
        rows,
      ),
    ).toBe(true)
  })

  it('imageKeyword Europe 오염으로 dest 추론하지 않음', () => {
    const rows = [
      { day: 1, routeText: '싱가포르', title: '싱가포르', imageKeyword: 'Europe' },
      { day: 3, routeText: '유니버설 스튜디오 싱가포르', title: 'USS' },
    ]
    expect(inferRegisterEffectiveProductDestination(null, rows)).toMatch(/Asia|Singapore|싱가포르/i)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Merlion Park Singapore',
        null,
        rows,
      ),
    ).toBe(false)
  })
})
