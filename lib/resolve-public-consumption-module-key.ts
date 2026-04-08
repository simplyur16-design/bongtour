import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

/** 공개 상세 `app/products/[id]/page.tsx`의 소비 모듈 분기와 동일한 키. */
export type PublicConsumptionModuleKey = 'modetour' | 'verygoodtour' | 'ybtour' | 'hanatour'

/**
 * brand 우선, 없으면 originSource 정규화 — 관리자 재조회·FMC·구조화 가시화가 공개와 같은 전용 모듈을 쓰게 한다.
 */
export function resolvePublicConsumptionModuleKey(
  brandKey: string | null | undefined,
  originSource: string | null | undefined
): PublicConsumptionModuleKey {
  const bk = String(brandKey ?? '').trim()
  const norm = normalizeSupplierOrigin(originSource)
  if (bk === 'modetour') return 'modetour'
  if (bk === 'verygoodtour') return 'verygoodtour'
  if (bk === 'ybtour' || bk === 'yellowballoon') return 'ybtour'
  if (bk === 'hanatour') return 'hanatour'
  if (norm === 'modetour') return 'modetour'
  if (norm === 'verygoodtour') return 'verygoodtour'
  if (norm === 'ybtour') return 'ybtour'
  return 'hanatour'
}
