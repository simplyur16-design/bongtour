/**
 * 신규 상품 경로 E2E 스타일 — 등록 confirm 저장 인자 → self-heal 인자 → 공개 표시명/SEO 이름.
 * REGRESSION-FREEZE[local-departure-new-product-path]: 소유자 지시(2026-10-27 10:06) — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  buildHealPendingDepartureResolveArgs,
  buildRegisterExplicitDepartureSignals,
  buildRegisterFlightInferHaystack,
  resolveRegisterProductDepartureAirportFields,
} from '@/lib/register-product-departure-airport-save'
import {
  applyLocalDepartureDisplayPrefix,
  countLocalDepartureMentions,
  resolveDisplayLocalDepartureTags,
} from '@/lib/local-departure-display-prefix'
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'

const icnLeg: RegisterFactFlightLeg = {
  direction: 'outbound',
  carrier: 'KE',
  flightNo: 'KE001',
  departureCity: '인천',
  departureAt: null,
  arrivalCity: '해외',
  arrivalAt: null,
}

type Case = {
  name: string
  supplierTitle: string
  originSource: string
  airline: string | null
  factFlights: RegisterFactFlightLeg[]
  expectTags: string[]
  expectDisplay: string
}

const CASES: Case[] = [
  {
    name: 'mid-name bracket [청주출발]',
    supplierTitle: '[NO유류인상][청주출발]장가계직항 4일#다드림',
    originSource: 'hanatour',
    airline: '중국남방항공',
    factFlights: [],
    expectTags: ['cheongju'],
    expectDisplay: '[청주출발] [NO유류인상] 장가계직항 4일#다드림',
  },
  {
    name: 'hashtag time-of-day #부산오전출발 (facts say 인천)',
    supplierTitle: '싱가포르 5일 #부산오전출발 #싱가포르항공',
    originSource: 'kyowontour',
    airline: '싱가포르항공',
    factFlights: [icnLeg],
    expectTags: ['busan'],
    expectDisplay: '[부산출발] 싱가포르 5일 #싱가포르항공',
  },
  {
    name: '제주항공 airline name is not a 제주 departure',
    supplierTitle: '[제주항공] 다낭 5일 #노쇼핑',
    originSource: 'modetour',
    airline: '제주항공',
    factFlights: [icnLeg],
    expectTags: [],
    expectDisplay: '[제주항공] 다낭 5일 #노쇼핑',
  },
]

function assertPublicName(display: string, tags: readonly string[]) {
  for (const t of tags) {
    expect(countLocalDepartureMentions(display, t as never), display).toBe(1)
  }
  if (tags.length) expect(display, display).toMatch(/^\[[^\]]*출발[^\]]*\]/)
  expect(display, display).not.toMatch(/\[\s*\]|\s{2,}/)
}

describe('local-departure new product path (register confirm → self-heal → display/SEO)', () => {
  for (const c of CASES) {
    it(c.name, () => {
      // 1) 등록 confirm — *-register-flow.ts 와 같은 인자
      const registerFields = resolveRegisterProductDepartureAirportFields({
        manualLocalDepartureTags: [],
        inferHaystack: buildRegisterFlightInferHaystack({ airline: c.airline, includedText: null, scheduleText: '' }),
        factFlights: c.factFlights,
        explicitSignals: buildRegisterExplicitDepartureSignals({
          originalTitle: c.supplierTitle,
          rawTitle: c.supplierTitle,
          originSource: c.originSource,
        }),
      })
      expect(registerFields.localDepartureTag).toEqual(c.expectTags)
      expect(Object.keys(registerFields).sort()).toEqual(['departureAirportLabel', 'localDepartureTag'])
      const productData = { title: c.supplierTitle, originalTitle: c.supplierTitle, rawTitle: c.supplierTitle, ...registerFields }
      expect(productData.title).toBe(c.supplierTitle)

      // 2) self-heal — register-pending-pre-photo-self-heal 이 쓰는 인자 빌더 그대로
      const healArgs = buildHealPendingDepartureResolveArgs({
        product: {
          airline: c.airline,
          includedText: null,
          originalTitle: productData.originalTitle,
          rawTitle: productData.rawTitle,
          originSource: c.originSource,
          departures: [{ outboundDepartureAirport: c.factFlights.length ? 'ICN' : null }],
        },
        titleForInfer: productData.title,
        scheduleText: '',
      })
      const healFields = resolveRegisterProductDepartureAirportFields(healArgs)
      expect(healFields.localDepartureTag).toEqual(c.expectTags)
      expect(Object.keys(healFields).sort()).toEqual(['departureAirportLabel', 'localDepartureTag'])
      const afterHeal = { ...productData, localDepartureTag: healFields.localDepartureTag }
      expect(afterHeal.title).toBe(c.supplierTitle)

      // 3) 공개 표시명(카드·상세·SEO displayTitle 동일 함수) — 맨 앞 정확히 한 번
      const tags = resolveDisplayLocalDepartureTags(afterHeal)
      const display = applyLocalDepartureDisplayPrefix(afterHeal.title, tags)
      expect(display).toBe(c.expectDisplay)
      assertPublicName(display, c.expectTags)
      // 반복 적용해도 같은 결과(이중 머리말 없음)
      expect(applyLocalDepartureDisplayPrefix(display, tags)).toBe(display)
    })
  }

  it('heal never re-reads a display prefix as a new city (rawTitle prefixed by an old heal)', () => {
    const fields = resolveRegisterProductDepartureAirportFields(
      buildHealPendingDepartureResolveArgs({
        product: {
          airline: null,
          includedText: null,
          originalTitle: '[NO유류인상][청주출발]장가계 4일',
          rawTitle: '[부산출발] [NO유류인상][청주출발]장가계 4일',
          originSource: 'hanatour',
          departures: [],
        },
        titleForInfer: '[NO유류인상][청주출발]장가계 4일',
        scheduleText: '',
      }),
    )
    expect(fields.localDepartureTag).toEqual(['cheongju'])
  })
})
