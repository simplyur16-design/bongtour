/**
 * 공급사별 등록 사실 수집 디스패처 — LLM 입력용 구조화 재료.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: collectSupplierRegisterFacts — manifest
 */
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { collectHanatourRegisterFacts } from '@/lib/register-facts/hanatour'
import { collectKyowontourRegisterFacts } from '@/lib/register-facts/kyowontour'
import { collectLottetourRegisterFacts } from '@/lib/register-facts/lottetour'
import { collectModetourRegisterFacts } from '@/lib/register-facts/modetour'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { collectVerygoodtourRegisterFacts } from '@/lib/register-facts/verygoodtour'
import { collectNaeiltourRegisterFacts } from '@/lib/register-facts/naeiltour'
import { collectYbtourRegisterFacts } from '@/lib/register-facts/ybtour'

export async function collectSupplierRegisterFacts(
  supplier: CanonicalOverseasSupplierKey,
  originUrl: string,
  options?: { originCode?: string | null; adminTravelScope?: string | null },
): Promise<SupplierRegisterFactBundle | null> {
  const url = originUrl.trim()
  if (!url) return null

  switch (supplier) {
    case 'modetour':
      return collectModetourRegisterFacts(url, options)
    case 'hanatour':
      return collectHanatourRegisterFacts(url, options)
    case 'ybtour':
      return collectYbtourRegisterFacts(url)
    case 'verygoodtour':
      return collectVerygoodtourRegisterFacts(url)
    case 'lottetour':
      return collectLottetourRegisterFacts(url)
    case 'kyowontour':
      return collectKyowontourRegisterFacts(url)
    case 'naeiltour':
      return collectNaeiltourRegisterFacts(url)
    default:
      return null
  }
}

export function registerFactsSupportedSuppliers(): CanonicalOverseasSupplierKey[] {
  return ['modetour', 'hanatour', 'ybtour', 'verygoodtour', 'lottetour', 'kyowontour', 'naeiltour']
}
