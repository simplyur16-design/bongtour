/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]
 * 6공급사 일괄 계약: 관광 일차 imageKeyword + imageKeyword2(1≠2), 출발·귀국 kw2 null.
 * vitest·`scripts/verify-schedule-image-keyword-dual-slot.ts` 공용 SSOT.
 */
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { applyRegisterScheduleImageKeywordsForPreview } from '@/lib/register-schedule-image-keywords-preview'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

export type DualSlotContractRow = {
  day: number
  title: string
  description: string
  routeText: string | null
  imageKeyword: string
  imageKeyword2: string | null
}

export const DUAL_SLOT_CONTRACT_SUPPLIERS = [
  'hanatour',
  'modetour',
  'ybtour',
  'lottetour',
  'verygoodtour',
  'kyowontour',
] as const

export type DualSlotContractSupplier = (typeof DUAL_SLOT_CONTRACT_SUPPLIERS)[number]

function apply(supplier: DualSlotContractSupplier, rows: DualSlotContractRow[], dest: string) {
  return applyRegisterScheduleImageKeywordsForPreview(rows, {
    supplierKey: supplier,
    productDestination: dest,
    productTitle: 'contract-fixture',
    travelScope: 'overseas',
  })
}

function assertTourismDualSlot(failures: string[], label: string, out: DualSlotContractRow[], day: number) {
  const row = out.find((r) => r.day === day)
  if (!row) {
    failures.push(`${label}: day ${day} missing`)
    return
  }
  const kw = String(row.imageKeyword ?? '').trim()
  const kw2 = String(row.imageKeyword2 ?? '').trim()
  if (kw.length < 2) failures.push(`${label}: day ${day} imageKeyword empty`)
  if (kw2.length <= 1) failures.push(`${label}: day ${day} imageKeyword2 empty`)
  if (kw && kw2 && normScheduleImageKeywordKey(kw2) === normScheduleImageKeywordKey(kw)) {
    failures.push(`${label}: day ${day} imageKeyword2 equals imageKeyword`)
  }
}

function assertMovementKw2Null(failures: string[], label: string, out: DualSlotContractRow[], day: number) {
  const row = out.find((r) => r.day === day)
  if (!row) {
    failures.push(`${label}: day ${day} missing`)
    return
  }
  if (row.imageKeyword2 != null && String(row.imageKeyword2).trim() !== '') {
    failures.push(`${label}: day ${day} imageKeyword2 should be null (movement/return)`)
  }
}

/** 모두투어 Ba Na Hills 전일차 반복 → dedupe 후에도 kw2 비는 회귀 재현 픽스처 (5일 — day4=middle) */
export const MODETOUR_BA_NA_HILLS_REGRESSION_ROWS: DualSlotContractRow[] = [
  {
    day: 1,
    title: '출발',
    description: '인천 출발',
    routeText: '인천 - Da Nang',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 2,
    title: '다낭',
    description: '미케 비치',
    routeText: 'Da Nang - My Khe Beach',
    imageKeyword: 'Ba Na Hills',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '바나힐',
    description: '바나힐',
    routeText: 'Da Nang - Ba Na Hills',
    imageKeyword: 'Ba Na Hills',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '호이안',
    description: '호이안 올드타운',
    routeText: 'Da Nang - Hoi An Ancient Town',
    imageKeyword: 'Ba Na Hills',
    imageKeyword2: null,
  },
  {
    day: 5,
    title: '귀국',
    description: '인천 도착',
    routeText: 'Da Nang - 인천',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

/** 베트남 달랏·나트랑 5일 — routeText 인천 only 출발·귀국일 해외 키워드 누수 회귀 */
export const VIETNAM_DALAT_NHATRANG_DOMESTIC_HUB_ROWS: DualSlotContractRow[] = [
  {
    day: 1,
    title: '-',
    description: '인천',
    routeText: '인천',
    imageKeyword: 'Nha Trang',
    imageKeyword2: null,
  },
  {
    day: 2,
    title: '-',
    description: '달랏 관광',
    routeText: '달랏 - 베트남샤브샤브 - 달랏기차역 - 플라워가든 - 죽림사 - 다딴라폭포 - 소고기구이 정식',
    imageKeyword: 'Da Lat Vietnam Highland',
    imageKeyword2: 'Datanla Waterfalls',
  },
  {
    day: 3,
    title: '-',
    description: '달랏 관광',
    routeText: '달랏 - 랑비앙 - 바오다이 황제 별장 - 크레이지하우스 - 진흙공원 - 무제한삼겹살',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '-',
    description: '나트랑 관광',
    routeText: '나트랑 - 분짜+반쎄오 - 포나가 참 사원 - 담 재래시장 - 롱선사',
    imageKeyword: 'Nha Trang',
    imageKeyword2: 'Long Son Pagoda',
  },
  {
    day: 5,
    title: '-',
    description: '인천',
    routeText: '인천',
    imageKeyword: 'Nha Trang',
    imageKeyword2: null,
  },
]

function assertDepartureReturnAdjacentPoiRules(
  failures: string[],
  label: string,
  out: DualSlotContractRow[],
) {
  const d1 = out.find((r) => r.day === 1)
  const d5 = out.find((r) => r.day === 5)
  if (!d1 || !d5) {
    failures.push(`${label}: missing day 1 or 5 in Vietnam fixture`)
    return
  }
  const kw1 = String(d1.imageKeyword ?? '').trim()
  const kw5 = String(d5.imageKeyword ?? '').trim()
  if (kw1.length < 2) {
    failures.push(`${label}: day 1 departure must pick arrival-region POI (got empty)`)
  }
  if (/^nha trang$/i.test(kw1)) {
    failures.push(`${label}: day 1 must not use bare Nha Trang city (arrival is Da Lat region)`)
  }
  if (kw5.length >= 2 && /nha trang/i.test(kw5)) {
    failures.push(`${label}: day 5 must not reuse Nha Trang city (pick unused landmark from day 4)`)
  }
  if (d1.imageKeyword2 != null && String(d1.imageKeyword2).trim() !== '') {
    failures.push(`${label}: day 1 imageKeyword2 must be null`)
  }
  if (d5.imageKeyword2 != null && String(d5.imageKeyword2).trim() !== '') {
    failures.push(`${label}: day 5 imageKeyword2 must be null`)
  }
}

function assertModetourBaNaHillsRegression(failures: string[], label: string, out: DualSlotContractRow[]) {
  const d2 = out.find((r) => r.day === 2)
  const d4 = out.find((r) => r.day === 4)
  if (!d2 || !d4) {
    failures.push(`${label}: missing day 2 or 4 in Ba Na Hills fixture`)
    return
  }
  const kw2 = String(d2.imageKeyword ?? '').trim()
  const kw4 = String(d4.imageKeyword ?? '').trim()
  if (!/My Khe/i.test(kw2)) failures.push(`${label}: day2 imageKeyword expected My Khe, got ${kw2}`)
  if (!/Hoi/i.test(kw4)) failures.push(`${label}: day4 imageKeyword expected Hoi An, got ${kw4}`)
  const keys = out
    .filter((r) => r.day > 0)
    .flatMap((r) => [r.imageKeyword, r.imageKeyword2].filter(Boolean))
    .map((k) => normScheduleImageKeywordKey(String(k)))
  if (new Set(keys).size !== keys.length) {
    failures.push(`${label}: trip-wide imageKeyword·imageKeyword2 duplicate`)
  }
}

/** @returns 실패 메시지 목록 — 빈 배열이면 통과 */
export function runScheduleImageKeywordDualSlotContract(): string[] {
  const failures: string[] = []

  const modetourDirect = applyRegisterScheduleImageKeywordsBySupplier(MODETOUR_BA_NA_HILLS_REGRESSION_ROWS, {
    supplierKey: 'modetour',
    productDestination: '다낭',
    productTitle: 'contract-fixture',
    travelScope: 'overseas',
  })
  assertModetourBaNaHillsRegression(failures, 'modetour-direct', modetourDirect)

  const modetourPreview = apply('modetour', MODETOUR_BA_NA_HILLS_REGRESSION_ROWS, '다낭')
  assertModetourBaNaHillsRegression(failures, 'modetour-preview', modetourPreview)

  for (const supplier of DUAL_SLOT_CONTRACT_SUPPLIERS) {
    const vietnamOut = apply(supplier, VIETNAM_DALAT_NHATRANG_DOMESTIC_HUB_ROWS, '동남아')
    assertDepartureReturnAdjacentPoiRules(failures, `${supplier}-vietnam-domestic-hub`, vietnamOut)
  }

  for (const row of modetourDirect) {
    const day = row.day
    const other = modetourPreview.find((r) => r.day === day)
    if (!other) {
      failures.push(`modetour preview/direct parity: day ${day} missing in preview`)
      continue
    }
    if (String(row.imageKeyword ?? '').trim() !== String(other.imageKeyword ?? '').trim()) {
      failures.push(`modetour preview/direct parity: day ${day} imageKeyword mismatch`)
    }
    if (String(row.imageKeyword2 ?? '').trim() !== String(other.imageKeyword2 ?? '').trim()) {
      failures.push(`modetour preview/direct parity: day ${day} imageKeyword2 mismatch`)
    }
  }

  const hanatour = apply(
    'hanatour',
    [
      {
        day: 1,
        title: '출발',
        description: '인천 출발',
        routeText: 'Incheon - Delhi',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '아그라',
        description: '타지마할 외부 관람과 아그라 성',
        routeText: 'Taj Mahal - Agra Fort',
        imageKeyword: 'Agra',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '귀국',
        description: '델리 출발',
        routeText: 'Delhi - Incheon',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ],
    'India',
  )
  assertTourismDualSlot(failures, 'hanatour', hanatour, 2)
  if (!/Taj/i.test(String(hanatour.find((r) => r.day === 2)?.imageKeyword ?? ''))) {
    failures.push('hanatour: expected Taj in imageKeyword')
  }
  if (!/Agra Fort/i.test(String(hanatour.find((r) => r.day === 2)?.imageKeyword2 ?? ''))) {
    failures.push('hanatour: expected Agra Fort in imageKeyword2')
  }

  const modetour = apply(
    'modetour',
    [
      {
        day: 2,
        title: '다낭',
        description: '다낭과 호이안',
        routeText: 'Da Nang - Hoi An',
        imageKeyword: 'Ba Na Hills',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '귀국',
        description: '인천 도착',
        routeText: '인천',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ],
    'Vietnam',
  )
  assertTourismDualSlot(failures, 'modetour day2', modetour, 2)
  assertMovementKw2Null(failures, 'modetour return', modetour, 3)

  const ybtour = apply(
    'ybtour',
    [
      {
        day: 1,
        title: '출발',
        description: '인천 출발',
        routeText: 'Incheon - Hanoi',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '다낭',
        description: '관광',
        routeText: 'Da Nang - Hoi An Ancient Town',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '귀국',
        description: '인천 도착',
        routeText: 'Hoi An - Incheon',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ],
    'Vietnam',
  )
  assertTourismDualSlot(failures, 'ybtour', ybtour, 2)

  const lottetour = apply(
    'lottetour',
    [
      {
        day: 1,
        title: '출발',
        description: '인천 출발 이스탄불 도착',
        routeText: '인천 - 이스탄불',
        imageKeyword: 'Istanbul',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '이스탄불',
        description: '술탄 아흐메트 모스크와 그랜드 바자르',
        routeText: '이스탄불 - 술탄 아흐메트 모스크 - 그랜드 바자르',
        imageKeyword: 'Sultan Ahmed Mosque',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '귀국',
        description: '이스탄불 출발 인천 도착',
        routeText: '이스탄불 - 인천',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ],
    '튀르키예',
  )
  assertMovementKw2Null(failures, 'lottetour', lottetour, 1)
  assertMovementKw2Null(failures, 'lottetour', lottetour, 3)
  assertTourismDualSlot(failures, 'lottetour', lottetour, 2)

  const verygood = apply(
    'verygoodtour',
    [
      {
        day: 2,
        title: '아그라',
        description: "#### 아그라\n'타지마할' 외관과 '아그라 성' 관광",
        routeText: '타지마할 - 아그라 성',
        imageKeyword: 'Taj Mahal',
        imageKeyword2: null,
      },
    ],
    'India',
  )
  assertTourismDualSlot(failures, 'verygoodtour', verygood, 2)

  const kyowo = apply(
    'kyowontour',
    [
      {
        day: 2,
        title: '레',
        description: '레 왕궁과 레 시장',
        routeText: '레 - 레 왕궁 - 레 시장',
        imageKeyword: 'Leh Palace',
        imageKeyword2: null,
      },
    ],
    'India',
  )
  assertTourismDualSlot(failures, 'kyowontour', kyowo, 2)

  for (const supplier of DUAL_SLOT_CONTRACT_SUPPLIERS) {
    const dest = supplier === 'lottetour' ? '튀르키예' : 'Vietnam'
    const rows: DualSlotContractRow[] =
      supplier === 'verygoodtour'
        ? [
            {
              day: 2,
              title: '아그라',
              description: "#### 아그라\n'타지마할'과 '아그라 성'",
              routeText: '타지마할 - 아그라 성',
              imageKeyword: 'Taj Mahal',
              imageKeyword2: null,
            },
          ]
        : supplier === 'ybtour'
          ? [
              {
                day: 1,
                title: '출발',
                description: '인천 출발',
                routeText: 'Incheon - Hanoi',
                imageKeyword: '',
                imageKeyword2: null,
              },
              {
                day: 2,
                title: '다낭',
                description: '관광',
                routeText: 'Da Nang - Hoi An Ancient Town',
                imageKeyword: '',
                imageKeyword2: null,
              },
              {
                day: 3,
                title: '귀국',
                description: '인천 도착',
                routeText: 'Hoi An - Incheon',
                imageKeyword: '',
                imageKeyword2: null,
              },
            ]
          : supplier === 'hanatour' || supplier === 'modetour'
            ? [
                {
                  day: 1,
                  title: '출발',
                  description: '인천 출발',
                  routeText: supplier === 'hanatour' ? 'Incheon - Delhi' : 'Incheon - Da Nang',
                  imageKeyword: '',
                  imageKeyword2: null,
                },
                {
                  day: 2,
                  title: supplier === 'hanatour' ? '아그라' : '다낭',
                  description: '관광',
                  routeText:
                    supplier === 'hanatour'
                      ? 'Taj Mahal - Agra Fort'
                      : 'Da Nang - Hoi An Ancient Town',
                  imageKeyword: '',
                  imageKeyword2: null,
                },
                {
                  day: 3,
                  title: '귀국',
                  description: '인천 도착',
                  routeText: supplier === 'hanatour' ? 'Delhi - Incheon' : 'Da Nang - Incheon',
                  imageKeyword: '',
                  imageKeyword2: null,
                },
              ]
            : supplier === 'kyowontour'
              ? [
                  {
                    day: 2,
                    title: '레',
                    description: '레 왕궁',
                    routeText: '레 - 레 왕궁 - 레 시장',
                    imageKeyword: 'Leh Palace',
                    imageKeyword2: null,
                  },
                ]
              : supplier === 'lottetour'
                ? [
                    {
                      day: 1,
                      title: '출발',
                      description: '인천 출발',
                      routeText: '인천 - 이스탄불',
                      imageKeyword: '',
                      imageKeyword2: null,
                    },
                    {
                      day: 2,
                      title: '이스탄불',
                      description: '술탄 아흐메트',
                      routeText: '이스탄불 - 술탄 아흐메트 모스크 - 그랜드 바자르',
                      imageKeyword: 'Sultan Ahmed Mosque',
                      imageKeyword2: null,
                    },
                    {
                      day: 3,
                      title: '귀국',
                      description: '인천 도착',
                      routeText: '이스탄불 - 인천',
                      imageKeyword: '',
                      imageKeyword2: null,
                    },
                  ]
                : [
                    {
                      day: 2,
                      title: '다낭',
                      description: '관광',
                      routeText: 'Da Nang - Hoi An',
                      imageKeyword: '',
                      imageKeyword2: null,
                    },
                  ]
    const out = apply(supplier, rows, dest)
    const probeDay =
      supplier === 'ybtour' || supplier === 'hanatour' || supplier === 'modetour' ? 2 : rows[0]!.day
    if (!String(out.find((r) => r.day === probeDay)?.imageKeyword ?? '').trim()) {
      failures.push(`${supplier}: preview switch returned empty imageKeyword`)
    }
  }

  return failures
}
