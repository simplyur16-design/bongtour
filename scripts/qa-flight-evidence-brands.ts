/**
 * 항공 evidence QA: 공급사별 `register-flight-evidence-supplier-*`만 사용 (교차참조 없음).
 * npx tsx scripts/qa-flight-evidence-brands.ts
 */
import type { RegisterParsed as RegisterParsedHanatour } from '@/lib/register-llm-schema-hanatour'
import type { RegisterParsed as RegisterParsedModetour } from '@/lib/register-llm-schema-modetour'
import type { RegisterParsed as RegisterParsedVerygoodtour } from '@/lib/register-llm-schema-verygoodtour'
import type { RegisterParsed as RegisterParsedYbtour } from '@/lib/register-llm-schema-ybtour'
import {
  buildSupplierFlightSnippet as buildSnippetHanatour,
  mapIssueFieldToFlightKind as mapKindHanatour,
} from '@/lib/register-flight-evidence-supplier-hanatour'
import {
  buildSupplierFlightSnippet as buildSnippetModetour,
  mapIssueFieldToFlightKind as mapKindModetour,
} from '@/lib/register-flight-evidence-supplier-modetour'
import {
  buildSupplierFlightSnippet as buildSnippetVerygoodtour,
  mapIssueFieldToFlightKind as mapKindVerygoodtour,
} from '@/lib/register-flight-evidence-supplier-verygoodtour'
import {
  buildSupplierFlightSnippet as buildSnippetYbtour,
  mapIssueFieldToFlightKind as mapKindYbtour,
} from '@/lib/register-flight-evidence-supplier-ybtour'

type QaRegisterBrand = 'hanatour' | 'modetour' | 'verygoodtour' | 'ybtour'

const FIELDS = [
  'flight_info',
  'outboundDepartureAt',
  'inboundArrivalAt',
  'flightNo',
  'outboundFlightNo',
  'inboundFlightNo',
] as const

const NOISE_LINE = '출발예정 가격예정 일정예정 Image 더보기 크게보기'

const MODETOUR_BODY = `${NOISE_LINE}
항공사: 중국남방항공
출발 : 인천 2026.07.07(화) 19:20 → 연길 2026.07.07(화) 20:40 CZ6074
도착 : 연길 2026.07.10(금) 10:10 → 인천 2026.07.10(금) 13:25 CZ6073`

const VERYGOODTOUR_BODY = `진에어
출국
2026.03.29 (일) 08:10 인천 출발
2026.03.29 (일) 10:00 오사카 도착
입국
2026.04.01 (수) 13:10 오사카 출발
2026.04.01 (수) 15:00 인천 도착`

const YELLOW_BODY = `출발
티웨이항공
TW285
총 1시간 30분
인천
2026.04.08 (수) 08:10
사가
2026.04.08 (수) 09:50
도착
티웨이항공
TW286
총 1시간 30분
사가
2026.04.10 (금) 10:50
인천
2026.04.10 (금) 12:15`

const HANA_BODY = `2박 3일 티웨이항공
출발 : 2026.05.01(금) 08:10 2026.05.01(금) 09:40 TW0285 총 01시간 30분 소요
도착 : 2026.05.03(일) 10:40 2026.05.03(일) 12:15 TW0286 총 01시간 35분 소요`

function detailBodyStub(flightRaw: string) {
  return {
    normalizedRaw: '',
    sections: [],
    review: { required: [], warning: [], info: [] },
    sectionReview: {},
    qualityScores: {},
    failurePatterns: [],
    flightStructured: null,
    hotelStructured: null,
    optionalToursStructured: null,
    shoppingStructured: null,
    includedExcludedStructured: null,
    brandKey: null,
    raw: {
      hotelPasteRaw: null,
      optionalToursPasteRaw: null,
      shoppingPasteRaw: null,
      flightRaw,
    },
  }
}

function parsedWithFlightRawHanatour(flightRaw: string): RegisterParsedHanatour {
  return {
    originSource: 'QA',
    originCode: 'QA-FL',
    title: 'QA',
    destination: 'QA',
    duration: '3박4일',
    schedule: [],
    prices: [],
    detailBodyStructured: detailBodyStub(flightRaw),
  } as unknown as RegisterParsedHanatour
}

function parsedWithFlightRawModetour(flightRaw: string): RegisterParsedModetour {
  return {
    originSource: 'QA',
    originCode: 'QA-FL',
    title: 'QA',
    destination: 'QA',
    duration: '3박4일',
    schedule: [],
    prices: [],
    detailBodyStructured: detailBodyStub(flightRaw),
  } as unknown as RegisterParsedModetour
}

function parsedWithFlightRawVerygoodtour(flightRaw: string): RegisterParsedVerygoodtour {
  return {
    originSource: 'QA',
    originCode: 'QA-FL',
    title: 'QA',
    destination: 'QA',
    duration: '3박4일',
    schedule: [],
    prices: [],
    detailBodyStructured: detailBodyStub(flightRaw),
  } as unknown as RegisterParsedVerygoodtour
}

function parsedWithFlightRawYbtour(flightRaw: string): RegisterParsedYbtour {
  return {
    originSource: 'QA',
    originCode: 'QA-FL',
    title: 'QA',
    destination: 'QA',
    duration: '3박4일',
    schedule: [],
    prices: [],
    detailBodyStructured: detailBodyStub(flightRaw),
  } as unknown as RegisterParsedYbtour
}

function mapKindForBrand(brand: QaRegisterBrand, field: string) {
  switch (brand) {
    case 'hanatour':
      return mapKindHanatour(field)
    case 'modetour':
      return mapKindModetour(field)
    case 'verygoodtour':
      return mapKindVerygoodtour(field)
    case 'ybtour':
      return mapKindYbtour(field)
    default: {
      const _x: never = brand
      return _x
    }
  }
}

function buildSnippetForBrand(
  brand: QaRegisterBrand,
  brandKey: string,
  kind: NonNullable<ReturnType<typeof mapKindHanatour>>,
  parsed: RegisterParsedHanatour | RegisterParsedModetour | RegisterParsedVerygoodtour | RegisterParsedYbtour,
  preview: Record<string, string> | null
) {
  switch (brand) {
    case 'hanatour':
      return buildSnippetHanatour(brandKey, kind, parsed as RegisterParsedHanatour, preview)
    case 'modetour':
      return buildSnippetModetour(brandKey, kind, parsed as RegisterParsedModetour, preview)
    case 'verygoodtour':
      return buildSnippetVerygoodtour(brandKey, kind, parsed as RegisterParsedVerygoodtour, preview)
    case 'ybtour':
      return buildSnippetYbtour(brandKey, kind, parsed as RegisterParsedYbtour, preview)
    default: {
      const _x: never = brand
      return _x
    }
  }
}

function parsedForBrand(brand: QaRegisterBrand, flightRaw: string) {
  switch (brand) {
    case 'hanatour':
      return parsedWithFlightRawHanatour(flightRaw)
    case 'modetour':
      return parsedWithFlightRawModetour(flightRaw)
    case 'verygoodtour':
      return parsedWithFlightRawVerygoodtour(flightRaw)
    case 'ybtour':
      return parsedWithFlightRawYbtour(flightRaw)
    default: {
      const _x: never = brand
      return _x
    }
  }
}

function dump(
  brand: QaRegisterBrand,
  label: string,
  brandKey: string,
  parsed: RegisterParsedHanatour | RegisterParsedModetour | RegisterParsedVerygoodtour | RegisterParsedYbtour,
  preview: Record<string, string> | null
) {
  console.log(`\n=== ${label} brand=${brand} brandKey=${brandKey} ===`)
  for (const field of FIELDS) {
    const kind = mapKindForBrand(brand, field)
    if (!kind) continue
    const { rawSnippet, sourceKind } = buildSnippetForBrand(brand, brandKey, kind, parsed, preview)
    const sn = rawSnippet ?? null
    console.log(
      JSON.stringify({
        field,
        kind,
        sourceKind,
        rawSnippet: sn,
        lines: sn ? sn.split('\n').length : 0,
      })
    )
  }
}

function hasBannedNoise(s: string | null): boolean {
  if (!s) return false
  return /출발예정|가격예정|일정예정|\bImage\b|이미지\s*[:：]/i.test(s)
}

async function main() {
  const cases: Array<{ brand: QaRegisterBrand; brandKey: string; body: string }> = [
    { brand: 'modetour', brandKey: 'modetour', body: MODETOUR_BODY },
    { brand: 'verygoodtour', brandKey: 'verygoodtour', body: VERYGOODTOUR_BODY },
    { brand: 'ybtour', brandKey: 'ybtour', body: YELLOW_BODY },
    { brand: 'hanatour', brandKey: 'hanatour', body: HANA_BODY },
  ]

  for (const { brand, brandKey, body } of cases) {
    const p = parsedForBrand(brand, body)
    dump(brand, 'flightRaw only', brandKey, p, null)
    const snippets = FIELDS.map((field) => {
      const kind = mapKindForBrand(brand, field)
      if (!kind) return null
      return buildSnippetForBrand(brand, brandKey, kind, p, null).rawSnippet
    }).filter(Boolean) as string[]
    const noiseHit = snippets.some(hasBannedNoise)
    const uniq = new Set(snippets)
    console.log(
      `[CHECK ${brand}] bannedNoiseInSnippet=${noiseHit} distinctSnippetCount=${uniq.size} (flight-related fields)`
    )
  }

  const pEmpty = parsedForBrand('modetour', '')
  dump(
    'modetour',
    'airlineTransport only paste',
    'modetour',
    pEmpty,
    { airlineTransport: MODETOUR_BODY.replace(NOISE_LINE + '\n', '') }
  )

  console.log('\n[DONE]')
}

main()
