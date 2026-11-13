import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import hanatourItnr from '@/lib/__fixtures__/process7-1114/hanatour-CXP192261121SCH-itnr-days.json'
import ybtourTm from '@/lib/__fixtures__/process7-1114/ybtour-JSP1089-261121BX00-schedule-tm.json'
import {
  hanatourFactDaysToRegisterSchedule,
  hanatourItnrSchdToFactDays,
} from '@/lib/hanatour-register-api-detail'
import {
  extractYbtourSchedulePlacesFromTmRows,
  ybtourTmRowsCityText,
  ybtourTmRowsSupplierOriginal,
  type YbtourScheduleTmPlaceRow,
} from '@/lib/ybtour-register-api-schedule'
import { parseVerygoodItineraryFromDetailHtml } from '@/lib/verygoodtour-itinerary-collector'
import { itineraryDayCityFromSupplierCities, splitItineraryDayCityText } from '@/lib/itinerary-day-city'
import {
  parseStoredScheduleRows,
  preserveStoredScheduleDayEvidence,
} from '@/lib/schedule-stored-day-evidence-preserve'
import {
  applyRegisterRouteRawFromFactFlights,
  registerRouteRawFromFactFlights,
} from '@/lib/register-facts/route-raw-from-fact-flights'
import { registerScheduleToDayInputs as hanatourDayInputs } from '@/lib/upsert-itinerary-days-hanatour'
import { registerScheduleToDayInputs as ybtourDayInputs } from '@/lib/upsert-itinerary-days-ybtour'
import { registerScheduleToDayInputs as modetourDayInputs } from '@/lib/upsert-itinerary-days-modetour'
import { registerScheduleToDayInputs as verygoodDayInputs } from '@/lib/upsert-itinerary-days-verygoodtour'

const verygoodHtml = fs.readFileSync(
  path.join(__dirname, '__fixtures__/process7-1114/verygoodtour-APP9945-261108BX-schedule.html'),
  'utf8',
)

const ybtourRows = ybtourTm.scheduleDetailTm as YbtourScheduleTmPlaceRow[]
const ybtourDay = (day: number) => ybtourRows.filter((r) => Number(r.dayNo) === day)

describe('hanatour CXP192 itinerary — photo alt captions are not places', () => {
  const facts = hanatourItnrSchdToFactDays(hanatourItnr.schdInfoList as never)

  it('day 2 uses cms place names, not train photo captions from other regions', () => {
    const d2 = facts.find((d) => d.day === 2)!
    expect(d2.places).toContain('구랑위')
    expect(d2.places.join(' ')).not.toMatch(/중경|광주|계림/)
  })

  it('no day mixes 중경/계림 photo captions', () => {
    for (const d of facts) expect(d.places.join(' ')).not.toMatch(/중경|계림/)
  })

  it('cityText comes from supplier city fields only', () => {
    const rows = hanatourFactDaysToRegisterSchedule(facts)
    expect(rows.find((r) => r.day === 1)?.cityText).toBe('인천 - 무이산')
    expect(rows.find((r) => r.day === 2)?.cityText).toBe('무이산 - 샤먼')
    for (const r of rows) expect(r.supplierOriginal).toBeTruthy()
  })
})

describe('ybtour JSP1089 TM — notice section does not leak into day 1', () => {
  it('day 1 places are only the route cities', () => {
    expect(extractYbtourSchedulePlacesFromTmRows(ybtourDay(1))).toEqual(['부산', '마츠야마'])
  })

  it('cityText follows TM cityNm order', () => {
    expect(ybtourTmRowsCityText(ybtourDay(1))).toBe('부산 - 마츠야마')
    expect(ybtourTmRowsCityText(ybtourDay(3))).toBe('마츠야마 - 부산')
  })

  it('supplierOriginal keeps TM titles but stops before the notice section', () => {
    const so = ybtourTmRowsSupplierOriginal(ybtourDay(1))
    expect(so?.items.map((i) => i.name)).toContain('김해국제공항 미팅')
    expect(JSON.stringify(so)).not.toMatch(/여권|기타사항/)
  })
})

describe('verygoodtour APP9945 — notice accordion is not route', () => {
  const days = parseVerygoodItineraryFromDetailHtml(verygoodHtml).days

  it('day 1 poi/city has no 동반 출국 notice', () => {
    const d1 = days.find((d) => d.day === 1)!
    expect(d1.poiNamesRaw).toBe('부산-다낭')
    expect(d1.city).toBe('부산 - 다낭')
    expect(JSON.stringify(d1)).not.toMatch(/만\s*14세/)
  })

  it('city is the location field, never the day title', () => {
    expect(days.find((d) => d.day === 2)?.city).toBe('다낭 - 호이안')
    for (const d of days) expect(String(d.city ?? '')).not.toMatch(/·/)
  })
})

describe('itinerary-day-city', () => {
  it('rejects sentences/times and dedupes', () => {
    expect(itineraryDayCityFromSupplierCities(['부산', '부산', '마츠야마'])).toBe('부산 - 마츠야마')
    expect(itineraryDayCityFromSupplierCities(['09:30 집결', '호텔 조식 후 자유 일정입니다.'])).toBeNull()
    expect(splitItineraryDayCityText('부산 - 다낭')).toEqual(['부산', '다낭'])
  })

  it('register → ItineraryDay never writes title/route into city', () => {
    const row = { day: 1, title: '부산 → 마츠야마 자유 석식', description: 'x', routeText: '부산 - 마츠야마 - 도고온천' }
    for (const fn of [hanatourDayInputs, ybtourDayInputs, modetourDayInputs, verygoodDayInputs]) {
      expect(fn([row])[0]?.city ?? null).toBeNull()
      expect(fn([{ ...row, cityText: '부산 - 마츠야마' }])[0]?.city).toBe('부산 - 마츠야마')
    }
  })
})

describe('schedule-stored-day-evidence-preserve', () => {
  it('keeps stored supplierOriginal/hotel/meals when the photo step rewrites a day', () => {
    const stored = parseStoredScheduleRows(
      JSON.stringify([
        { day: 1, title: 'a', supplierOriginal: { v: 1, items: [{ name: 'x' }] }, hotelText: 'H', breakfastText: '조식' },
      ]),
    )
    const next = preserveStoredScheduleDayEvidence(
      [{ day: 1, title: 'a', imageUrl: 'u', supplierOriginal: null } as Record<string, unknown>],
      stored,
    )
    expect(next[0]?.supplierOriginal).toEqual({ v: 1, items: [{ name: 'x' }] })
    expect(next[0]?.hotelText).toBe('H')
    expect(next[0]?.breakfastText).toBe('조식')
  })

  it('does not overwrite a fresh value', () => {
    const stored = parseStoredScheduleRows(JSON.stringify([{ day: 1, hotelText: 'OLD' }]))
    const next = preserveStoredScheduleDayEvidence([{ day: 1, hotelText: 'NEW' } as Record<string, unknown>], stored)
    expect(next[0]?.hotelText).toBe('NEW')
  })
})

describe('register-route-raw-from-fact-flights', () => {
  const flights = [
    { direction: 'inbound', flightNo: 'BX142', departureCity: '마츠야마', arrivalCity: '부산' },
    { direction: 'outbound', flightNo: 'BX141', departureCity: '부산', arrivalCity: '마츠야마' },
  ]

  it('builds routeRaw from supplier flight legs', () => {
    expect(registerRouteRawFromFactFlights(flights as never)).toBe('BX141 부산 → 마츠야마 / BX142 마츠야마 → 부산')
  })

  it('only fills empty routeRaw', () => {
    expect(applyRegisterRouteRawFromFactFlights({ routeRaw: 'KEEP' } as never, flights as never).routeRaw).toBe('KEEP')
    expect(applyRegisterRouteRawFromFactFlights({ routeRaw: null } as never, flights as never).routeRaw).toMatch(/BX141/)
  })
})
