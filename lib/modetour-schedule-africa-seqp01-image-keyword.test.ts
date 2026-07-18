/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: Africa SEQP01 — Victoria Falls≠Victoria BC · safari day evidence — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: Africa safari day-route evidence — SEQP01 bleed 금지 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'

const SEQP01_ROWS = [
  { day: 1, title: '두바이', routeText: '두바이', imageKeyword: '', imageKeyword2: null as string | null },
  {
    day: 2,
    title: '두바이 · 금시장(골드수크)',
    routeText: '두바이 - 나이로비 - 알 파히디(구 바스타키야) - 수크 메디나 수상택시 - 금시장(골드수크)',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '나이바샤 호수 · 기린센터',
    routeText: '나이바샤 호수 - 나이로비 - 크레센트 아일랜드 - 카렌브릭슨 박물관 - 기린센터',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 4, title: '아루샤 · 금시장', routeText: '아루샤 - 금시장', imageKeyword: '', imageKeyword2: null },
  {
    day: 5,
    title: '응고롱고로 자연보호구 · 마사이 부족마을',
    routeText: '응고롱고로 자연보호구 - 응고롱고로 분화구 사파리 게임드라이브 - 마사이 부족마을',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    title: '세렝게티 국립공원 · 세렝게티 사파리 게임 드라이브',
    routeText: '세렝게티 국립공원 - 세렝게티 사파리 게임 드라이브',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 7,
    title: '나이로비 · 세렝게티 국립공원',
    routeText: '나이로비 - 세렝게티 국립공원',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 8,
    title: '빅토리 폴스 · 잠베지강 선셋 크루즈',
    routeText: '빅토리 폴스 - 빅토리아 폭포 - 노천목각시장 - 잠베지강 선셋 크루즈',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 9,
    title: '초베국립공원 보트사파리 · 빅토리아폭포 헬기',
    routeText: '초베국립공원 보트사파리 - 빅토리 폴스 - 초베 사륜구동 게임 드라이브 사파리 - 빅토리아폭포 헬기',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 10, title: '케이프타운 · 워터프론트', routeText: '케이프타운 - 워터프론트', imageKeyword: '', imageKeyword2: null },
  {
    day: 11,
    title: '케이프타운 · 커스텐보쉬 국립식물원',
    routeText: '케이프타운 - 케이블카 - 테이블 마운틴 - 보캅지구 - 와인 테이스팅 - 커스텐보쉬 국립식물원',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 12,
    title: '케이프타운 · 볼더스비치',
    routeText: '케이프타운 - 물개섬 - 채프먼스 피크 해안도 - 캠스베이 - 희망봉 - 케이프 포인트 - 볼더스비치',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 13,
    title: '두바이 · 팔라조 베르사체 두바이',
    routeText: '두바이 - 팔라조 베르사체 두바이',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 14,
    title: '두바이 · 두바이몰 분수쇼',
    routeText: '두바이 - 주메이라 비치 - 버즈 알 아랍 - 두바이 모노레일 - 수크 메디나 쥬메이라 - 두바이몰 분수쇼',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 15, title: '귀국', routeText: '', imageKeyword: '', imageKeyword2: null },
]

describe('modetour Africa SEQP01 104307927 imageKeyword', () => {
  it('maps 빅토리 폴스/빅토리아 폭포 to Victoria Falls not Victoria BC', () => {
    expect(String(firstMatchingScheduleSpotEn('빅토리 폴스') ?? '')).toMatch(/Victoria Falls/i)
    expect(String(firstMatchingScheduleSpotEn('빅토리아 폭포') ?? '')).toMatch(/Victoria Falls/i)
    expect(String(firstMatchingScheduleSpotEn('빅토리 폴스') ?? '')).not.toMatch(/Harbour|Inner Harbour/i)
  })

  it('SEQP01-like 15-day — no safari/Victoria/UAE cross-day bleed; no empty middle', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(SEQP01_ROWS, {
      supplierKey: 'modetour',
      productDestination: '아프리카',
      productTitle:
        '[시그니처] 아프리카 6개국+두바이 15일 <7대 Real사파리/빅토리아폭포/5성호텔/테이블마운틴/두바이베르사체호텔>',
      travelScope: 'package',
    })

    for (const r of out) {
      console.log(
        `D${r.day}`,
        JSON.stringify({ kw: r.imageKeyword, kw2: r.imageKeyword2, route: r.routeText }),
      )
    }

    const byDay = (d: number) => out.find((r) => r.day === d)!
    const blob = (d: number) => `${byDay(d).imageKeyword ?? ''} ${byDay(d).imageKeyword2 ?? ''}`

    // Day8 Victoria Falls ≠ Canada Victoria harbour
    expect(blob(8)).toMatch(/Victoria Falls/i)
    expect(blob(8)).not.toMatch(/Inner Harbour|Harbour Victoria/i)

    // Day3 Kenya — no Chobe Botswana bleed
    expect(blob(3)).not.toMatch(/Chobe/i)

    // Day7 Nairobi/Serengeti — no Manyara bleed without route evidence
    expect(blob(7)).not.toMatch(/Manyara/i)

    // Day12 Cape Point day — no Victoria Falls / Livingstone bleed
    expect(blob(12)).not.toMatch(/Victoria Falls|Livingstone/i)
    expect(blob(12)).toMatch(/Boulders|Cape Point|Chapman|Hope|Seal|Table Mountain|Cape Town/i)

    // Day11 — no Robben Island without route evidence
    expect(blob(11)).not.toMatch(/Robben/i)

    // Day14 Dubai — no Abu Dhabi mosque bleed; Burj not duplicate of D13 primary if D13 is Burj
    expect(blob(14)).not.toMatch(/Grand Mosque|Louvre/i)

    // Day2 Dubai — no Louvre/Qasr without route evidence
    expect(blob(2)).not.toMatch(/Louvre|Qasr|Grand Mosque|Emirates Palace/i)
    expect(blob(2)).toMatch(/Fahidi|Dubai|Souk|Gold|Creek/i)

    // Day4 Arusha — no Chobe Botswana bleed
    expect(blob(4)).not.toMatch(/Chobe/i)
    expect(blob(4)).toMatch(/Arusha|Meru|Nairobi|Gold/i)

    // Day7 Nairobi/Serengeti — no Cape/Bo-Kaap bleed
    expect(blob(7)).not.toMatch(/Bo-?Kaap|Cape Town|Robben|Boulders/i)

    // Day13 Dubai hotel — no Abu Dhabi landmark bleed
    expect(blob(13)).not.toMatch(/Emirates Palace|Qasr|Grand Mosque|Louvre/i)
    expect(blob(13)).toMatch(/Dubai/i)

    // Day15 return — not bare continent; prefer visit city over unused Palm landmark
    expect(String(byDay(15).imageKeyword ?? '')).not.toMatch(/아프리카|^Africa$/i)
    expect(String(byDay(15).imageKeyword ?? '')).toMatch(/^(?:Dubai|Cape Town|Nairobi)\b/i)

    // Middle days should not be empty
    for (const d of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
      expect(String(byDay(d).imageKeyword ?? '').trim().length).toBeGreaterThan(2)
    }

    // Trip-wide primary uniqueness for key landmarks
    const primaries = out.map((r) => String(r.imageKeyword ?? '').trim().toLowerCase()).filter(Boolean)
    const victoriaPrimaries = primaries.filter((p) => /victoria falls/i.test(p))
    expect(victoriaPrimaries.length).toBeLessThanOrEqual(2)
  })
})
