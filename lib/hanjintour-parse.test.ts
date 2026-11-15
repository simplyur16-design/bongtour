import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  hanjintourIsoDate,
  hanjintourRawPrice,
  hanjintourShouldEnqueuePending,
  parseHanjintourCalendar,
  parseHanjintourDisplayList,
  parseHanjintourEventList,
  parseHanjintourPackageLeaves,
  parseHanjintourSchedule,
  stripHanjintourContactFields,
} from './hanjintour-parse'

const FX = path.join(__dirname, '__fixtures__', 'hanjintour')
const fx = (name: string) => JSON.parse(fs.readFileSync(path.join(FX, name), 'utf8'))

describe('fixtures carry no contact fields', () => {
  it('no tel/phone/email keys and no phone-like values', () => {
    for (const f of fs.readdirSync(FX)) {
      const s = fs.readFileSync(path.join(FX, f), 'utf8')
      expect(s, f).not.toMatch(/"[^"]*(tel|phone|mobile|email)[^"]*"\s*:/i)
      expect(s, f).not.toMatch(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/)
    }
  })
})

describe('parseHanjintourPackageLeaves', () => {
  it('keeps only 패키지여행 list leaves with their path', () => {
    const leaves = parseHanjintourPackageLeaves(fx('gnb-subset.json'))
    expect(leaves.length).toBeGreaterThan(10)
    expect(leaves.every((l) => l.path.length >= 2)).toBe(true)
    expect(leaves.find((l) => l.path.join('>') === '중국/홍콩/대만/몽골>중국>청도/연태/대련')?.dspCtgNo).toBe('1000002970')
    expect(leaves.some((l) => l.path.includes('THE 비즈니스'))).toBe(false)
  })
})

describe('parseHanjintourDisplayList', () => {
  it('reads goods code, title, nights/days and raw min price', () => {
    const { items, totalCnt } = parseHanjintourDisplayList(fx('list-1000002293.json'))
    expect(totalCnt).toBe(1)
    expect(items[0]).toMatchObject({ gdsNo: 'KWCAU0003', nights: 8, days: 10, minPrice: 10390000, minPriceDate: '2027-08-11' })
  })
  it('error body → empty', () => {
    expect(parseHanjintourDisplayList({ result: false, goodsList: [{ gdsNo: 'X', gdsNm: 'Y' }] }).items).toEqual([])
    expect(parseHanjintourDisplayList(null).items).toEqual([])
  })
})

describe('calendar / event (prices are raw values only)', () => {
  it('calendar gives every departure with evtNo, date, status and raw adult fare', () => {
    const deps = parseHanjintourCalendar(fx('calendar-KWWEU0048.json'))
    expect(deps.length).toBeGreaterThan(0)
    expect(deps[0]).toMatchObject({ evtNo: 'OP202703210460', date: '2027-03-21', status: '예약가능', adultPrice: 6030200 })
    expect(deps.map((d) => d.date)).toEqual([...deps.map((d) => d.date)].sort())
  })
  it('event list adds child/infant fares, airline and flight times', () => {
    const [e] = parseHanjintourEventList(fx('event-KWWEU0048-20270321.json'), '2027-03-21')
    expect(e).toMatchObject({
      evtNo: 'OP202703210460',
      date: '2027-03-21',
      adultPrice: 6030200,
      childPrice: null,
      infantPrice: null,
      airline: '대한항공',
      departAt: '2027-03-21 12:10',
      returnAt: '2027-03-28 16:50',
    })
  })
  it('never invents a price: missing, zero, decimal or text fares become null', () => {
    expect(hanjintourRawPrice(null)).toBeNull()
    expect(hanjintourRawPrice(0)).toBeNull()
    expect(hanjintourRawPrice(1234.5)).toBeNull()
    expect(hanjintourRawPrice('문의')).toBeNull()
    expect(hanjintourRawPrice('1,290,000')).toBe(1290000)
    const deps = parseHanjintourCalendar({ result: true, eventCalendarList: [{ evtNo: 'E1', tofDe: '20271301', adltFare: 100 }, { evtNo: 'E2', tofDe: '20270102' }] })
    expect(deps).toEqual([{ evtNo: 'E2', date: '2027-01-02', rawDate: '20270102', status: null, adultPrice: null }])
  })
  it('rejects impossible dates', () => {
    expect(hanjintourIsoDate('20270230')).toBeNull()
    expect(hanjintourIsoDate('2027-03-21')).toBeNull()
  })
})

describe('parseHanjintourSchedule', () => {
  it('builds days with cities, sights, hotels and meals', () => {
    const { days } = parseHanjintourSchedule(fx('schedule-OP202703210460.json'))
    expect(days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(days.flatMap((d) => d.cities)).toContain('암스테르담')
    expect(days.flatMap((d) => d.spots)).toContain('위트레흐트')
    expect(days.some((d) => d.hotels.length > 0)).toBe(true)
  })
  it('empty or failed body → no days', () => {
    expect(parseHanjintourSchedule({ result: false }).days).toEqual([])
    expect(parseHanjintourSchedule(undefined).days).toEqual([])
  })
})

describe('hanjintourShouldEnqueuePending', () => {
  const today = '2026-11-14'
  it('no departures → not enqueued', () => {
    expect(hanjintourShouldEnqueuePending({ departures: [] }, today)).toBe(false)
  })
  it('only past or price-less departures → not enqueued', () => {
    expect(
      hanjintourShouldEnqueuePending(
        {
          departures: [
            { evtNo: 'a', date: '2026-11-01', rawDate: '20261101', status: null, adultPrice: 990000 },
            { evtNo: 'b', date: '2026-12-01', rawDate: '20261201', status: null, adultPrice: null },
          ],
        },
        today,
      ),
    ).toBe(false)
  })
  it('a future departure with a raw adult fare → enqueue allowed', () => {
    expect(hanjintourShouldEnqueuePending({ departures: parseHanjintourCalendar(fx('calendar-KWWEU0048.json')) }, today)).toBe(true)
  })
})

describe('stripHanjintourContactFields', () => {
  it('removes nested contact keys', () => {
    expect(stripHanjintourContactFields({ detail: { itnTelno: 'x', gdsNo: 'A', list: [{ email: 'e', n: 1 }] } })).toEqual({
      detail: { gdsNo: 'A', list: [{ n: 1 }] },
    })
  })
})
