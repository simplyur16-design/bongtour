/**
 * 비슷한 일정 비교에 넣을 공급사.
 * canonical 7곳과 한진관광(공개 상품이 있을 때). 그 외는 제외.
 */
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { isCanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'

export function isCompareClusterSupplierOrigin(originSource: string | null | undefined): boolean {
  const key = normalizeSupplierOrigin(originSource)
  return isCanonicalOverseasSupplierKey(key) || key === 'hanjintour'
}
