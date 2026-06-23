/**
 * 하나투어 코타키나발루 AYP295 — 선택관광 chcStsng + imageKeyword live gate.
 * REGRESSION-FREEZE[hanatour-register-kk-live-gate]: manifest
 *
 * npx tsx scripts/verify-register-hanatour-kk-live-gate.ts
 */
import assert from 'node:assert/strict'
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { buildRegisterAdminPreviewCardData } from '@/lib/register-admin-preview-card-build'
import { applyRegisterScheduleImageKeywordsForPreview } from '@/lib/register-schedule-image-keywords-preview'
import { parseOptionalTourNamesFromStructuredJson } from '@/lib/register-schedule-llm-image-keyword-fallback'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

const URL =
  'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=AYP295260628AKY&prePage=major-products'

function countJsonRows(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

async function main() {
  const base: RegisterParsed = {
    originUrl: URL,
    hasOptionalTour: false,
    includedItems: ['[교통] 왕복항공권'],
    excludedItems: ['[식사] 식사비'],
    schedule: [
      {
        day: 1,
        title: '인천 - 국제공항',
        description: '인천 출발 코타키나발루 도착',
        routeText: '인천 - 코타키나발루',
        imageKeyword: 'Kota Kinabalu',
      },
      {
        day: 2,
        title: '아일랜드 투어 및 선셋 반딧불 투어',
        description: '스노클링과 반딧불 투어',
        routeText: '코타키나발루 - 아일랜드 투어 - 선셋 반딧불 투어',
        imageKeyword: 'Kota Kinabalu',
      },
      {
        day: 3,
        title: '전 일정 자유 시간',
        description: '전 일정 자유 시간으로 시내를 자유롭게 관광할 수 있습니다',
        routeText: '코타키나발루',
        imageKeyword: 'Kota Kinabalu',
      },
      {
        day: 4,
        title: '시내 관광 및 KK 스타라운지',
        description: '이슬람 사원 등 시내 관광',
        routeText: '코타키나발루 - 시내 관광 - KK 스타라운지',
        imageKeyword: 'Kota Kinabalu City Mosque',
      },
      {
        day: 5,
        title: '인천 국제공항 도착',
        description: '코타키나발루 출발 인천 도착',
        routeText: '코타키나발루 - 인천',
        imageKeyword: 'Kota Kinabalu',
      },
    ],
  } as RegisterParsed

  const parsed = await augmentHanatourParsedWithDetailCollect(base, { originUrl: URL })
  const optN = countJsonRows(parsed.optionalToursStructured)
  assert.ok(optN >= 20, `hanatour optional rows >= 20 (got ${optN})`)
  assert.equal(parsed.hasOptionalTour, true)

  const scheduleInput = (base.schedule?.length ? base.schedule : parsed.schedule) ?? []
  const schedule = applyRegisterScheduleImageKeywordsForPreview(scheduleInput, {
    supplierKey: 'hanatour',
    productDestination: '말레이시아 코타키나발루',
    productTitle: parsed.title ?? '',
    optionalTourNames: parseOptionalTourNamesFromStructuredJson(parsed.optionalToursStructured),
  })
  const d3 = schedule.find((d) => d.day === 3)
  const d5 = schedule.find((d) => d.day === 5)
  const d2 = schedule.find((d) => d.day === 2)
  const d4 = schedule.find((d) => d.day === 4)
  assert.ok((d3?.imageKeyword ?? '').length > 0, 'day3 free-day example keyword')
  assert.ok((d5?.imageKeyword ?? '').length > 0, 'day5 return uses last tourism landmark')
  assert.equal(d5?.imageKeyword, d4?.imageKeyword, 'return day matches last tourism day')
  assert.ok((d2?.imageKeyword ?? '').length > 0, 'day2 kw1')
  assert.ok((d2?.imageKeyword2 ?? '').length > 0, 'day2 kw2')

  const card = buildRegisterAdminPreviewCardData({
    parsed: { ...parsed, schedule },
    productDraft: { title: parsed.title ?? '', duration: parsed.duration ?? '', priceFrom: 0 },
    schedule,
    originalBodyText: '',
    fieldIssues: [],
  })
  assert.ok(card.optionalTours.length >= 20, `preview optional rows >= 20 (got ${card.optionalTours.length})`)
  assert.ok(card.optionalTours.some((o) => /KK 스타 라운지/i.test(o.name)), 'KK 스타 라운지 in preview')

  console.log('OK hanatour AYP295 KK live gate', {
    optionalRows: optN,
    previewOptional: card.optionalTours.length,
    day2: { kw1: d2?.imageKeyword, kw2: d2?.imageKeyword2 },
    day3kw: d3?.imageKeyword,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
