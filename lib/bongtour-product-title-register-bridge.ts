import { generateBongtourProductTitle } from '@/lib/bongtour-product-title-generator'
import {
  BONGTOUR_PRODUCT_TITLE_TONE_VERSION,
  sanitizeBongtourProductTitle,
  validateBongtourProductTitle,
  validationToSnapshot,
  type BongtourProductTitleValidationSnapshotV1,
} from '@/lib/bongtour-product-title-tone-ssot'

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
  bongtourProductTitle: string | null
  originalProductTitle: string
  bongtourTitleValidation: BongtourProductTitleValidationSnapshotV1
  bongtourTitleToneVersion: string
}

/** 미리보기 응답에 붙일 봉투어 톤 상품명 필드. LLM 실패 시 bongtourProductTitle은 null. */
export async function buildBongtourProductTitleFieldsForRegisterPreview(args: {
  brandKey: string
  originalProductTitle: string
  pastedBodyText: string
  duration: string | null | undefined
  scheduleDayTitles: string[]
}): Promise<BongtourProductTitlePreviewFields> {
  const originalProductTitle = (args.originalProductTitle || '').trim() || '미입력'
  const gen = await generateBongtourProductTitle({
    brandKey: args.brandKey,
    supplierDisplayLabel: supplierLabelForBongtourTitle(args.brandKey),
    originalProductTitle,
    pastedBodyText: args.pastedBodyText,
    duration: args.duration,
    scheduleDayTitles: args.scheduleDayTitles,
  })
  const candidate = gen.title ? sanitizeBongtourProductTitle(gen.title) : ''
  const validation = candidate ? validateBongtourProductTitle(candidate) : validateBongtourProductTitle('')
  const bongtourProductTitle = candidate && validation.ok ? candidate : null
  return {
    bongtourProductTitle,
    originalProductTitle,
    bongtourTitleValidation: validationToSnapshot(validation),
    bongtourTitleToneVersion: BONGTOUR_PRODUCT_TITLE_TONE_VERSION,
  }
}

export type BongtourProductTitleConfirmPair = {
  prismaTitle: string
  prismaOriginalTitle: string
}

/**
 * confirm 저장 직전: 미리보기에서 생성된 bongtourProductTitle을 그대로 쓴다(재호출 없음).
 * 누락·검증 실패 시 공급사 원본으로 폴백(등록은 항상 진행).
 */
export function productTitlePairForRegisterConfirm(
  body: Record<string, unknown>,
  parsedSupplierTitle: string
): BongtourProductTitleConfirmPair {
  const prismaOriginalTitle = (parsedSupplierTitle || '').trim() || '미입력'
  const raw = body.bongtourProductTitle
  const fromClient = typeof raw === 'string' ? raw.trim() : ''
  if (!fromClient) {
    return { prismaTitle: prismaOriginalTitle, prismaOriginalTitle }
  }
  const cleaned = sanitizeBongtourProductTitle(fromClient)
  const v = validateBongtourProductTitle(cleaned)
  if (v.ok) {
    return { prismaTitle: cleaned, prismaOriginalTitle }
  }
  return { prismaTitle: prismaOriginalTitle, prismaOriginalTitle }
}
