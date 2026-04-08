import { buildPublicProductBadges } from '@/lib/product-detail-badges'
import * as publicConsumptionHanatour from '@/lib/public-consumption-hanatour'
import * as publicConsumptionModetour from '@/lib/public-consumption-modetour'
import * as publicConsumptionVerygoodtour from '@/lib/public-consumption-verygoodtour'
import * as publicConsumptionYbtour from '@/lib/public-consumption-ybtour'
import {
  buildPublicOptionalDisplayInputFromProductFields,
  buildPublicShoppingDisplayInputFromProductFields,
  computePublicOptionalTabFlags,
  hasPublicOptionalStructuredRows,
  isPublicOptionalPanelTrulyEmpty,
  isPublicShoppingPanelTrulyEmpty,
  shouldShowOptionalPasteFallback,
  shouldShowOptionalStructuredNoticeUi,
  shouldShowPublicOptionalSection,
  shouldShowPublicShoppingSection,
  shouldShowShoppingPasteFallback,
  shouldSuppressShoppingNoticeBecausePasteSame,
} from '@/lib/public-product-extras'

function assertCase(name: string, ok: boolean) {
  if (!ok) throw new Error(`assert failed: ${name}`)
}

function run() {
  const optionalCanonical = publicConsumptionHanatour.resolveOptionalToursConsumption({
    canonical: { rows: [{ tourName: '백두산', adultPrice: 120, currency: 'USD' }] },
    legacyOptionalToursStructured: JSON.stringify([{ name: 'legacy tour', priceValue: 99 }]),
  })
  assertCase('optional canonical-first', optionalCanonical.source === 'canonical_optional')
  assertCase('optional canonical no fallback', optionalCanonical.usedFallback === false)

  const optionalFallback = publicConsumptionHanatour.resolveOptionalToursConsumption({
    canonical: { rows: [] },
    legacyOptionalToursStructured: JSON.stringify([{ name: 'legacy tour', priceValue: 99 }]),
  })
  assertCase('optional fallback source', optionalFallback.source === 'legacy_optional_tours_structured')
  assertCase('optional fallback hit', optionalFallback.usedFallback === true)

  const shoppingCanonical = publicConsumptionHanatour.resolveShoppingConsumption({
    canonical: { rows: [{ shoppingItem: '녹용', shoppingPlace: '매장A', durationText: '1시간' }] },
    legacyDbRows: [{ itemType: 'legacy', placeName: 'L1', durationText: null, refundPolicyText: null, raw: 'legacy' }],
    legacyMetaRows: [],
  })
  assertCase('shopping canonical-first', shoppingCanonical.source === 'canonical_shopping')

  const shoppingFallbackDb = publicConsumptionHanatour.resolveShoppingConsumption({
    canonical: { rows: [] },
    legacyDbRows: [{ itemType: 'legacy', placeName: 'L1', durationText: null, refundPolicyText: null, raw: 'legacy' }],
    legacyMetaRows: [{ itemType: 'meta', placeName: 'M1', durationText: null, refundPolicyText: null, raw: 'meta' }],
  })
  assertCase('shopping db fallback', shoppingFallbackDb.source === 'legacy_shopping_db')

  const shoppingFallbackMeta = publicConsumptionHanatour.resolveShoppingConsumption({
    canonical: { rows: [] },
    legacyDbRows: [],
    legacyMetaRows: [{ itemType: 'meta', placeName: 'M1', durationText: null, refundPolicyText: null, raw: 'meta' }],
  })
  assertCase('shopping meta fallback', shoppingFallbackMeta.source === 'legacy_shopping_meta')

  const hotelCanonical = publicConsumptionHanatour.resolveHotelConsumption({
    canonical: { rows: [{ dayLabel: '1일차', hotelNameText: '파라다이스', hotelCandidates: ['파라다이스'] }] },
    legacyStructuredPlans: [{ dayIndex: 1, label: '1일차 예정호텔', hotels: ['legacy 호텔'] }],
    hasLegacyNarrativeFallback: true,
  })
  assertCase('hotel canonical-first', hotelCanonical.source === 'canonical_hotel')
  assertCase('hotel canonical no fallback', hotelCanonical.usedFallback === false)

  const hotelLegacyStructured = publicConsumptionHanatour.resolveHotelConsumption({
    canonical: { rows: [] },
    legacyStructuredPlans: [{ dayIndex: 1, label: '1일차 예정호텔', hotels: ['legacy 호텔'] }],
    hasLegacyNarrativeFallback: true,
  })
  assertCase('hotel structured fallback', hotelLegacyStructured.source === 'legacy_day_hotel_plans')
  assertCase('hotel structured fallback hit', hotelLegacyStructured.usedFallback === true)

  // —— 공개 상세 옵션/쇼핑 표시 규칙 (public-product-extras) ——
  const optRowsPaste = buildPublicOptionalDisplayInputFromProductFields({
    optionalToursStructured: JSON.stringify([
      { id: '1', name: 'A', priceUsd: 100, duration: '약 2시간', waitPlaceIfNotJoined: '' },
    ]),
    optionalTourNoticeItems: [],
    optionalTourNoticeRaw: null,
    optionalTourDisplayNoticeFinal: null,
    optionalToursPasteRaw: 'paste opt',
    optionalTours: [],
  })
  assertCase('opt(1) rows+paste → structured only', hasPublicOptionalStructuredRows(optRowsPaste))
  assertCase('opt(1) no paste fallback', !shouldShowOptionalPasteFallback(optRowsPaste))

  const optPasteOnly = buildPublicOptionalDisplayInputFromProductFields({
    optionalToursStructured: null,
    optionalTourNoticeItems: [],
    optionalTourNoticeRaw: null,
    optionalTourDisplayNoticeFinal: null,
    optionalToursPasteRaw: '  paste only  ',
    optionalTours: [],
  })
  assertCase('opt(2) paste fallback', shouldShowOptionalPasteFallback(optPasteOnly))
  assertCase('opt(2) no structured notice ui', !shouldShowOptionalStructuredNoticeUi(optPasteOnly))

  const optNoticeOnly = buildPublicOptionalDisplayInputFromProductFields({
    optionalToursStructured: null,
    optionalTourNoticeItems: ['안내'],
    optionalTourNoticeRaw: null,
    optionalTourDisplayNoticeFinal: null,
    optionalToursPasteRaw: null,
    optionalTours: [],
  })
  assertCase('opt(3) notice → structured ui', shouldShowOptionalStructuredNoticeUi(optNoticeOnly))

  const optEmpty = buildPublicOptionalDisplayInputFromProductFields({
    optionalToursStructured: null,
    optionalTourNoticeItems: [],
    optionalTourNoticeRaw: null,
    optionalTourDisplayNoticeFinal: null,
    optionalToursPasteRaw: null,
    optionalTours: [],
  })
  assertCase('opt(4) empty', isPublicOptionalPanelTrulyEmpty(optEmpty))

  const shopRowsPaste = buildPublicShoppingDisplayInputFromProductFields({
    shoppingStopsStructured: [{ itemType: 'a', placeName: 'b', durationText: null, refundPolicyText: null, raw: 'x' }],
    shoppingVisitCountTotal: null,
    shoppingCount: null,
    shoppingItems: null,
    shoppingNoticeRaw: null,
    shoppingPasteRaw: 'paste shop',
  })
  assertCase('shop(5) structured only, no paste fallback', !shouldShowShoppingPasteFallback(shopRowsPaste))

  const shopPasteOnly = buildPublicShoppingDisplayInputFromProductFields({
    shoppingStopsStructured: [],
    shoppingVisitCountTotal: null,
    shoppingCount: null,
    shoppingItems: null,
    shoppingNoticeRaw: null,
    shoppingPasteRaw: '쇼핑입력',
  })
  assertCase('shop(6) paste fallback', shouldShowShoppingPasteFallback(shopPasteOnly))

  assertCase(
    'shop(7) notice same as paste → suppress',
    shouldSuppressShoppingNoticeBecausePasteSame('동일', '동일')
  )
  assertCase(
    'shop(7b) different notice not suppress',
    !shouldSuppressShoppingNoticeBecausePasteSame('a', 'b')
  )

  const shopEmpty = buildPublicShoppingDisplayInputFromProductFields({
    shoppingStopsStructured: [],
    shoppingVisitCountTotal: null,
    shoppingCount: null,
    shoppingItems: null,
    shoppingNoticeRaw: null,
    shoppingPasteRaw: null,
  })
  assertCase('shop(8) empty', isPublicShoppingPanelTrulyEmpty(shopEmpty))

  const badgePasteOpt = buildPublicProductBadges({
    hasOptionalTours: false,
    optionalToursStructured: null,
    optionalTourNoticeItems: [],
    optionalTourNoticeRaw: null,
    optionalTourDisplayNoticeFinal: null,
    optionalToursPasteRaw: '옵션만',
    optionalTours: [],
    shoppingStopsStructured: [],
    shoppingVisitCountTotal: null,
    shoppingCount: null,
    shoppingItems: null,
    shoppingNoticeRaw: null,
    shoppingPasteRaw: null,
  })
  assertCase(
    'opt(9) paste-only optional badge matches tab',
    badgePasteOpt.some((b) => b.includes('현지옵션') && b.includes('있음')) &&
      shouldShowPublicOptionalSection(
        buildPublicOptionalDisplayInputFromProductFields({
          optionalToursStructured: null,
          optionalTourNoticeItems: [],
          optionalTourNoticeRaw: null,
          optionalTourDisplayNoticeFinal: null,
          optionalToursPasteRaw: '옵션만',
          optionalTours: [],
        })
      )
  )

  const badgePasteShop = buildPublicProductBadges({
    hasOptionalTours: null,
    optionalTours: [],
    shoppingStopsStructured: [],
    shoppingVisitCountTotal: 0,
    shoppingCount: null,
    shoppingItems: null,
    shoppingNoticeRaw: null,
    shoppingPasteRaw: '쇼핑만',
  })
  assertCase(
    'shop(9b) paste-only shopping badge vs tab',
    badgePasteShop.some((b) => /쇼핑/.test(b) && /있음/.test(b)) &&
      shouldShowPublicShoppingSection(
        buildPublicShoppingDisplayInputFromProductFields({
          shoppingStopsStructured: [],
          shoppingVisitCountTotal: 0,
          shoppingCount: null,
          shoppingItems: null,
          shoppingNoticeRaw: null,
          shoppingPasteRaw: '쇼핑만',
        })
      )
  )

  const f1 = computePublicOptionalTabFlags(optPasteOnly)
  const f2 = computePublicOptionalTabFlags(
    buildPublicOptionalDisplayInputFromProductFields({
      optionalToursStructured: null,
      optionalTourNoticeItems: [],
      optionalTourNoticeRaw: null,
      optionalTourDisplayNoticeFinal: null,
      optionalToursPasteRaw: '  paste only  ',
      optionalTours: [],
    })
  )
  assertCase('opt(10) stable flags same input', JSON.stringify(f1) === JSON.stringify(f2))

  const parityOptionalCanonical = {
    canonical: { rows: [{ tourName: '백두산', adultPrice: 120, currency: 'USD' }] },
    legacyOptionalToursStructured: JSON.stringify([{ name: 'legacy tour', priceValue: 99 }]),
  }
  const refOptional = publicConsumptionHanatour.resolveOptionalToursConsumption(parityOptionalCanonical)
  assertCase(
    'parity optional canonical modetour',
    JSON.stringify(publicConsumptionModetour.resolveOptionalToursConsumption(parityOptionalCanonical)) === JSON.stringify(refOptional)
  )
  assertCase(
    'parity optional canonical verygood',
    JSON.stringify(publicConsumptionVerygoodtour.resolveOptionalToursConsumption(parityOptionalCanonical)) === JSON.stringify(refOptional)
  )
  assertCase(
    'parity optional canonical ybtour',
    JSON.stringify(publicConsumptionYbtour.resolveOptionalToursConsumption(parityOptionalCanonical)) === JSON.stringify(refOptional)
  )

  const parityShopping = {
    canonical: { rows: [{ shoppingItem: '녹용', shoppingPlace: '매장A', durationText: '1시간' }] },
    legacyDbRows: [{ itemType: 'legacy', placeName: 'L1', durationText: null, refundPolicyText: null, raw: 'legacy' }],
    legacyMetaRows: [],
  }
  const refShop = publicConsumptionHanatour.resolveShoppingConsumption(parityShopping)
  assertCase(
    'parity shopping canonical modetour',
    JSON.stringify(publicConsumptionModetour.resolveShoppingConsumption(parityShopping)) === JSON.stringify(refShop)
  )
  assertCase(
    'parity shopping canonical verygood',
    JSON.stringify(publicConsumptionVerygoodtour.resolveShoppingConsumption(parityShopping)) === JSON.stringify(refShop)
  )
  assertCase(
    'parity shopping canonical ybtour',
    JSON.stringify(publicConsumptionYbtour.resolveShoppingConsumption(parityShopping)) === JSON.stringify(refShop)
  )

  const parityHotel = {
    canonical: {
      rows: [{ dayLabel: '1일차', hotelNameText: '파라다이스', hotelCandidates: ['파라다이스'] }],
    },
    legacyStructuredPlans: [{ dayIndex: 1, label: '1일차 예정호텔', hotels: ['legacy 호텔'] }],
    hasLegacyNarrativeFallback: true,
  }
  const refHotel = publicConsumptionHanatour.resolveHotelConsumption(parityHotel)
  assertCase(
    'parity hotel canonical modetour',
    JSON.stringify(publicConsumptionModetour.resolveHotelConsumption(parityHotel)) === JSON.stringify(refHotel)
  )
  assertCase(
    'parity hotel canonical verygood',
    JSON.stringify(publicConsumptionVerygoodtour.resolveHotelConsumption(parityHotel)) === JSON.stringify(refHotel)
  )
  assertCase(
    'parity hotel canonical ybtour',
    JSON.stringify(publicConsumptionYbtour.resolveHotelConsumption(parityHotel)) === JSON.stringify(refHotel)
  )

  console.log('public consumption priority: all passed')
}

run()
