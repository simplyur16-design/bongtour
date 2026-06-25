/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]
 * 6공급사 일괄 계약: 관광 일차 imageKeyword + imageKeyword2(1≠2), 출발·귀국 kw2 null.
 * vitest·`scripts/verify-schedule-image-keyword-dual-slot.ts` 공용 SSOT.
 */
import { applyModetourScheduleImageKeywordsToRows } from '@/lib/modetour-schedule-image-keyword'
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

/** 모두투어 Ba Na Hills 전일차 반복 → dedupe 후에도 kw2 비는 회귀 재현 픽스처 */
export const MODETOUR_BA_NA_HILLS_REGRESSION_ROWS: DualSlotContractRow[] = [
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
]

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
  if (d2.imageKeyword2 != null && String(d2.imageKeyword2).trim() !== '') {
    failures.push(`${label}: day2 imageKeyword2 must be null (route POI 1개)`)
  }
  if (!/Hoi/i.test(kw4)) failures.push(`${label}: day4 imageKeyword expected Hoi An, got ${kw4}`)
  if (d4.imageKeyword2 != null && String(d4.imageKeyword2).trim() !== '') {
    failures.push(`${label}: day4 imageKeyword2 must be null (route POI 1개)`)
  }
}

/** @returns 실패 메시지 목록 — 빈 배열이면 통과 */
export function runScheduleImageKeywordDualSlotContract(): string[] {
  const failures: string[] = []

  const modetourDirect = applyModetourScheduleImageKeywordsToRows(MODETOUR_BA_NA_HILLS_REGRESSION_ROWS, {
    productDestination: '다낭',
  })
  assertModetourBaNaHillsRegression(failures, 'modetour-direct', modetourDirect)

  const modetourPreview = apply('modetour', MODETOUR_BA_NA_HILLS_REGRESSION_ROWS, '다낭')
  assertModetourBaNaHillsRegression(failures, 'modetour-preview', modetourPreview)

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
        day: 2,
        title: '아그라',
        description: '타지마할 외부 관람과 아그라 성',
        routeText: '델리 - 아그라',
        imageKeyword: 'Agra',
        imageKeyword2: null,
      },
    ],
    'India',
  )
  assertTourismDualSlot(failures, 'hanatour', hanatour, 2)
  if (!/Taj/i.test(String(hanatour[0]?.imageKeyword ?? ''))) {
    failures.push('hanatour: expected Taj in imageKeyword')
  }
  if (!/Agra Fort/i.test(String(hanatour[0]?.imageKeyword2 ?? ''))) {
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
        day: 2,
        title: '다낭',
        description: '관광',
        routeText: 'Da Nang - Hoi An',
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
    ],
    '튀르키예',
  )
  assertMovementKw2Null(failures, 'lottetour', lottetour, 1)
  assertTourismDualSlot(failures, 'lottetour', lottetour, 2)

  const verygood = apply(
    'verygoodtour',
    [
      {
        day: 2,
        title: '아그라',
        description: "#### 아그라\n'타지마할' 외관과 '아그라 성' 관광",
        routeText: '아그라',
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
              routeText: '아그라',
              imageKeyword: 'Taj Mahal',
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
          : supplier === 'hanatour'
            ? [
                {
                  day: 2,
                  title: '아그라',
                  description: '타지마할',
                  routeText: '델리 - 아그라',
                  imageKeyword: 'Agra',
                  imageKeyword2: null,
                },
              ]
            : [
                {
                  day: 2,
                  title: '다낭',
                  description: '관광',
                  routeText: 'Da Nang - Hoi An',
                  imageKeyword: supplier === 'lottetour' ? 'Sultan Ahmed Mosque' : '',
                  imageKeyword2: null,
                },
              ]
    if (supplier === 'lottetour') {
      rows[0] = {
        day: 2,
        title: '이스탄불',
        description: '술탄 아흐메트',
        routeText: '이스탄불 - 술탄 아흐메트 모스크 - 그랜드 바자르',
        imageKeyword: 'Sultan Ahmed Mosque',
        imageKeyword2: null,
      }
    }
    const out = apply(supplier, rows, dest)
    if (!String(out[0]?.imageKeyword ?? '').trim()) {
      failures.push(`${supplier}: preview switch returned empty imageKeyword`)
    }
  }

  return failures
}
