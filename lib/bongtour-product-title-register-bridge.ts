/** REGRESSION-FREEZE[supplier-product-title-plan-b] — confirm 기본 저장은 buildSupplierProductDisplayTitle */
import { generateBongtourProductTitle } from '@/lib/bongtour-product-title-generator'
import {
  BONGTOUR_PRODUCT_TITLE_TONE_VERSION,
  sanitizeBongtourProductTitle,
  validateBongtourProductTitle,
  validationToSnapshot,
  type BongtourProductTitleValidationSnapshotV1,
} from '@/lib/bongtour-product-title-tone-ssot'
import {
  buildSupplierProductDisplayTitle,
  resolveSupplierVerbatimOriginalTitle,
} from '@/lib/supplier-product-title-display'
import {
  isSupplierListingTitleUnacceptable,
  SUPPLIER_LISTING_TITLE_REJECTED_HINT,
} from '@/lib/supplier-listing-title-unacceptable'
import { extractSupplierListingTitleFromPaste } from '@/lib/supplier-listing-title-from-paste'

/** LLM·프롬프트에 넣는 공급사 한글 라벨(참좋은여행·교원이지 등). */
export function supplierLabelForBongtourTitle(brandKey: string): string {
  switch (brandKey) {
    case 'modetour':
      return '모두투어'
    case 'hanatour':
      return '하나투어'
    case 'ybtour':
      return '노랑풍선'
    case 'verygoodtour':
      return '참좋은여행'
    case 'kyowontour':
      return '교원이지'
    case 'lottetour':
      return '롯데관광'
    default:
      return brandKey
  }
}

export type BongtourProductTitlePreviewFields = {
  /** Plan B — confirm 시 Product.title 기본값 */
  displayProductTitle: string
  bongtourProductTitle: string | null
  originalProductTitle: string
  /** 리스트 제목 추출 실패(출발일 구간 등) */
  listingTitleAcceptable: boolean
  listingTitleWarning: string | null
  bongtourTitleValidation: BongtourProductTitleValidationSnapshotV1
  bongtourTitleToneVersion: string
}

/** 미리보기 — Plan B 노출명 + (참고용) R-5 마케팅 제안명 */
export async function buildBongtourProductTitleFieldsForRegisterPreview(args: {
  brandKey: string
  originalProductTitle: string
  supplierListingTitleRaw?: string | null
  pastedBodyText: string
  duration: string | null | undefined
  destination?: string | null | undefined
  scheduleDayTitles: string[]
}): Promise<BongtourProductTitlePreviewFields> {
  let supplierListingTitleRaw = args.supplierListingTitleRaw?.trim() || null
  const parsedBad =
    !args.originalProductTitle?.trim() ||
    isSupplierListingTitleUnacceptable(args.originalProductTitle, args.brandKey)
  const rawBad =
    !supplierListingTitleRaw || isSupplierListingTitleUnacceptable(supplierListingTitleRaw, args.brandKey)
  if (parsedBad && rawBad && args.pastedBodyText.trim()) {
    const fromPaste = extractSupplierListingTitleFromPaste(args.brandKey, args.pastedBodyText)
    if (fromPaste) supplierListingTitleRaw = fromPaste
  }

  const verbatim = resolveSupplierVerbatimOriginalTitle({
    parsedSupplierTitle: args.originalProductTitle,
    supplierListingTitleRaw,
    brandKey: args.brandKey,
  })
  const listingTitleAcceptable = verbatim !== '미입력' && !isSupplierListingTitleUnacceptable(verbatim, args.brandKey)
  const listingTitleWarning = listingTitleAcceptable ? null : SUPPLIER_LISTING_TITLE_REJECTED_HINT

  const displayProductTitle = buildSupplierProductDisplayTitle({
    verbatimOriginal: verbatim,
    parsedSupplierTitle: args.originalProductTitle,
    brandKey: args.brandKey,
  })

  let bongtourProductTitle: string | null = null
  let validation = validateBongtourProductTitle('')
  if (listingTitleAcceptable) {
    const gen = await generateBongtourProductTitle({
      brandKey: args.brandKey,
      supplierDisplayLabel: supplierLabelForBongtourTitle(args.brandKey),
      originalProductTitle: verbatim,
      pastedBodyText: args.pastedBodyText,
      duration: args.duration,
      destination: args.destination,
      scheduleDayTitles: args.scheduleDayTitles,
    })
    const candidate = gen.title ? sanitizeBongtourProductTitle(gen.title) : ''
    validation = candidate ? validateBongtourProductTitle(candidate) : validateBongtourProductTitle('')
    if (
      candidate &&
      validation.ok &&
      !isSupplierListingTitleUnacceptable(candidate, args.brandKey)
    ) {
      bongtourProductTitle = candidate
    }
  }

  return {
    displayProductTitle,
    bongtourProductTitle,
    originalProductTitle: verbatim,
    listingTitleAcceptable,
    listingTitleWarning,
    bongtourTitleValidation: validationToSnapshot(validation),
    bongtourTitleToneVersion: BONGTOUR_PRODUCT_TITLE_TONE_VERSION,
  }
}

export type BongtourProductTitleConfirmPair = {
  prismaTitle: string
  prismaOriginalTitle: string
}

export type ProductTitleConfirmInput = {
  parsedSupplierTitle: string
  supplierListingTitleRaw?: string | null
  brandKey?: string
}

function parseProductTitleConfirmInput(
  parsedOrOpts: string | ProductTitleConfirmInput,
): ProductTitleConfirmInput {
  if (typeof parsedOrOpts === 'string') {
    return { parsedSupplierTitle: parsedOrOpts }
  }
  return parsedOrOpts
}

/** confirm body — `productTitleSaveMode=bongtour_marketing` 일 때만 R-5 제안명 저장 */
export function isBongtourMarketingTitleSaveRequested(body: Record<string, unknown>): boolean {
  return body.productTitleSaveMode === 'bongtour_marketing'
}

/**
 * confirm 저장 직전 — Plan B 기본: 원문 기반 display title.
 * R-5 마케팅명은 `productTitleSaveMode=bongtour_marketing` + `bongtourProductTitle` 명시 시만.
 */
export function productTitlePairForRegisterConfirm(
  body: Record<string, unknown>,
  parsedOrOpts: string | ProductTitleConfirmInput,
  pasteBlob?: string | null,
): BongtourProductTitleConfirmPair {
  const opts = parseProductTitleConfirmInput(parsedOrOpts)
  let supplierListingTitleRaw = opts.supplierListingTitleRaw?.trim() || null
  const parsedBad =
    !opts.parsedSupplierTitle?.trim() ||
    isSupplierListingTitleUnacceptable(opts.parsedSupplierTitle, opts.brandKey)
  const rawBad =
    !supplierListingTitleRaw ||
    isSupplierListingTitleUnacceptable(supplierListingTitleRaw, opts.brandKey)
  if (parsedBad && rawBad && opts.brandKey && (pasteBlob ?? '').trim()) {
    const fromPaste = extractSupplierListingTitleFromPaste(opts.brandKey, pasteBlob!)
    if (fromPaste) supplierListingTitleRaw = fromPaste
  }

  const prismaOriginalTitle = resolveSupplierVerbatimOriginalTitle({
    parsedSupplierTitle: opts.parsedSupplierTitle,
    supplierListingTitleRaw,
    brandKey: opts.brandKey,
  })

  if (isBongtourMarketingTitleSaveRequested(body)) {
    const raw = body.bongtourProductTitle
    const fromClient = typeof raw === 'string' ? raw.trim() : ''
    if (fromClient) {
      const cleaned = sanitizeBongtourProductTitle(fromClient)
      const v = validateBongtourProductTitle(cleaned)
      if (v.ok && !isSupplierListingTitleUnacceptable(cleaned, opts.brandKey)) {
        return { prismaTitle: cleaned, prismaOriginalTitle }
      }
    }
  }

  const prismaTitle = buildSupplierProductDisplayTitle({
    verbatimOriginal: prismaOriginalTitle,
    parsedSupplierTitle: opts.parsedSupplierTitle,
    brandKey: opts.brandKey,
  })
  return { prismaTitle, prismaOriginalTitle }
}

/** 대표 이미지 SEO 키워드 — 원문 #태그 우선 harvest */
export function supplierTitleHaystackForHeroSeo(
  pair: BongtourProductTitleConfirmPair,
  supplierListingTitleRaw?: string | null,
): string {
  return [pair.prismaOriginalTitle, supplierListingTitleRaw?.trim(), pair.prismaTitle]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .join('\n')
}
