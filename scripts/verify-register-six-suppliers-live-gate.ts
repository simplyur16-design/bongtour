/**
 * 4공급사 등록 상세 수집 + 미리보기 + imageKeyword 게이트 (운영 URL 실측).
 * 하나투어·모두투어는 전용 live gate로 분리·얼림.
 * REGRESSION-FREEZE[register-six-suppliers-live-gate]: 4사 포함·불포함·옵션·쇼핑·키워드 — manifest
 *
 * 실행: npm run verify:register-six-suppliers-live-gate
 */
import assert from 'node:assert/strict'
import { augmentVerygoodtourParsedWithDetailCollect } from '@/lib/verygoodtour-register-detail-collect'
import { augmentYbtourParsedWithDetailCollect } from '@/lib/ybtour-register-detail-collect'
import { augmentLottetourParsedWithDetailCollect } from '@/lib/lottetour-register-detail-collect'
import { augmentKyowontourParsedWithTabDataCollect } from '@/lib/kyowontour-register-tab-data-collect'
import { buildRegisterAdminPreviewCardData } from '@/lib/register-admin-preview-card-build'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

type ParsedLike = Record<string, unknown>

const URLS = {
  kyowontour:
    'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=CSP302260621KE01&menuCode=M5204&brandId=3',
  ybtour:
    'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AABW002&evCd=ALP1122-260706QV00',
  lottetour: 'https://www.lottetour.com/evtDetail/826/857/1063/2333?evtCd=B30A260707BX016',
  verygoodtour:
    'https://www.verygoodtour.com/Product/PackageDetail?ProCode=CPP322-260705OZ6&PriceSeq=1',
} as const

function countJsonRows(raw: unknown): number {
  if (typeof raw !== 'string' || !raw.trim()) return 0
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

function inclN(p: ParsedLike): number {
  return Array.isArray(p.includedItems) ? p.includedItems.length : 0
}
function exclN(p: ParsedLike): number {
  return Array.isArray(p.excludedItems) ? p.excludedItems.length : 0
}

async function gateCollect() {
  const kyowontour = (await augmentKyowontourParsedWithTabDataCollect(
    { originUrl: URLS.kyowontour } as ParsedLike,
    { originUrl: URLS.kyowontour },
  )) as ParsedLike
  assert.ok(inclN(kyowontour) >= 5, `kyowontour included`)
  assert.ok(exclN(kyowontour) >= 3, `kyowontour excluded`)
  assert.ok(countJsonRows(kyowontour.optionalToursStructured) >= 1, 'kyowontour optional CAD')

  const ybtour = (await augmentYbtourParsedWithDetailCollect(
    { originUrl: URLS.ybtour } as ParsedLike,
    { originUrl: URLS.ybtour },
  )) as ParsedLike
  assert.ok(inclN(ybtour) >= 10, `ybtour included ${inclN(ybtour)}`)
  assert.ok(exclN(ybtour) >= 4, `ybtour excluded ${exclN(ybtour)}`)
  assert.ok(countJsonRows(ybtour.shoppingStops) >= 1 || Number(ybtour.shoppingVisitCount) >= 0, 'ybtour shop')

  const lottetour = (await augmentLottetourParsedWithDetailCollect(
    { originUrl: URLS.lottetour } as ParsedLike,
    { originUrl: URLS.lottetour },
  )) as ParsedLike
  assert.ok(inclN(lottetour) >= 3, `lottetour included`)
  assert.ok(exclN(lottetour) >= 5, `lottetour excluded`)
  assert.ok(countJsonRows(lottetour.optionalToursStructured) >= 5, 'lottetour optional')
  assert.ok(countJsonRows(lottetour.shoppingStops) >= 2, 'lottetour shopping')

  const verygood = (await augmentVerygoodtourParsedWithDetailCollect(
    { originUrl: URLS.verygoodtour } as ParsedLike,
    { originUrl: URLS.verygoodtour },
  )) as ParsedLike
  assert.ok(inclN(verygood) >= 4, `verygood included`)
  assert.ok(exclN(verygood) >= 5, `verygood excluded`)
  assert.ok(Number(verygood.shoppingVisitCount) >= 1, 'verygood shopping count')

  const cardY = buildRegisterAdminPreviewCardData({
    parsed: ybtour as never,
    productDraft: { title: 'ybtour', duration: '5일', priceFrom: 0 },
    schedule: (ybtour.schedule as never[]) ?? [],
    originalBodyText: '',
    fieldIssues: [],
  })
  assert.ok((cardY.includedItems?.length ?? 0) >= 10, 'ybtour preview included')
  assert.ok((cardY.excludedItems?.length ?? 0) >= 4, 'ybtour preview excluded')

  const cardVg = buildRegisterAdminPreviewCardData({
    parsed: verygood as never,
    productDraft: { title: 'vg', duration: '6일', priceFrom: 0 },
    schedule: (verygood.schedule as never[]) ?? [],
    originalBodyText: '',
    fieldIssues: [],
  })
  assert.ok(cardVg.shoppingItems.length >= 1, 'verygood preview shopping')

  const cardLt = buildRegisterAdminPreviewCardData({
    parsed: lottetour as never,
    productDraft: { title: 'lt', duration: '5일', priceFrom: 0 },
    schedule: (lottetour.schedule as never[]) ?? [],
    originalBodyText: '',
    fieldIssues: [],
  })
  assert.ok(cardLt.optionalTours.length >= 5, 'lottetour preview optional')
  assert.ok(cardLt.shoppingItems.length >= 2, 'lottetour preview shopping')

  console.log('collect+preview gate OK')
}

function gateImageKeywords() {
  const ybtourRows = applyRegisterScheduleImageKeywordsBySupplier(
    [
      { day: 4, title: '비엔티안', description: '파탓루앙', routeText: '방비엥 - 비엔티안 - 파탓루앙 - 빠뚜사이', imageKeyword: 'Pha That Luang', imageKeyword2: 'Patuxai' },
      { day: 5, title: '귀국', description: '인천 국제공항 도착', routeText: '비엔티안 - 인천', imageKeyword: 'Vientiane' },
    ],
    { supplierKey: 'ybtour', productDestination: 'Laos' },
  )
  assert.match(String(ybtourRows.find((r) => r.day === 4)?.imageKeyword), /Pha That/i)
  assert.equal(ybtourRows.find((r) => r.day === 5)?.imageKeyword, '')

  console.log('imageKeyword gate OK')
}

async function main() {
  await gateCollect()
  gateImageKeywords()
  console.log('verify-register-six-suppliers-live-gate: ALL OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
