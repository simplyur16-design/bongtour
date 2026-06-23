/**
 * register-facts ↔ detail-collect live 교차검증.
 *
 *   npx tsx scripts/verify-register-facts-detail-parity.ts
 *   npx tsx scripts/verify-register-facts-detail-parity.ts --only=hanatour
 */
import './load-env-for-scripts'

import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { collectSupplierRegisterFacts, registerFactsSupportedSuppliers } from '@/lib/register-facts/collect'
import { auditRegisterFactBundleCompleteness } from '@/lib/register-facts/completeness'
import { auditRegisterFactDetailParity } from '@/lib/register-facts/detail-parity'
import { fetchRegisterFactDetailParityMetrics } from '@/lib/register-facts/detail-parity-metrics'
import { parseRegisterFactProductKind } from '@/lib/register-facts/product-kind'

type LiveCase = {
  supplier: CanonicalOverseasSupplierKey
  label: string
  url: string
  travelScope: 'overseas' | 'air_hotel_free'
}

const CASES: LiveCase[] = [
  {
    supplier: 'modetour',
    label: 'modetour-package',
    url: 'https://www.modetour.com/package/103887821',
    travelScope: 'overseas',
  },
  {
    supplier: 'modetour',
    label: 'modetour-air-hotel',
    url: 'https://www.modetour.com/package/108826676',
    travelScope: 'air_hotel_free',
  },
  {
    supplier: 'hanatour',
    label: 'hanatour-package',
    url: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CHP101260701TWW&prePage=major-products',
    travelScope: 'overseas',
  },
  {
    supplier: 'hanatour',
    label: 'hanatour-fit',
    url: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CMB1952607057CH&prePage=major-products',
    travelScope: 'air_hotel_free',
  },
  {
    supplier: 'ybtour',
    label: 'ybtour-package',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AABW002&evCd=ALP1122-260706QV00',
    travelScope: 'overseas',
  },
  {
    supplier: 'ybtour',
    label: 'ybtour-fit',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=FIT&dspSid=ABIB001&evCd=CIF1003-260707OZ00',
    travelScope: 'air_hotel_free',
  },
  {
    supplier: 'verygoodtour',
    label: 'verygoodtour-package',
    url: 'https://www.verygoodtour.com/Product/PackageDetail?ProCode=CPP7272-260708TW5&PriceSeq=1',
    travelScope: 'overseas',
  },
  {
    supplier: 'verygoodtour',
    label: 'verygoodtour-fit',
    url: 'https://www.verygoodtour.com/Product/PackageDetail?ProCode=APP2586-2606239G35&PriceSeq=4&MenuCode=leaveLayer',
    travelScope: 'air_hotel_free',
  },
  {
    supplier: 'lottetour',
    label: 'lottetour-package',
    url: 'https://www.lottetour.com/evtList/826/857/1063/2333?godId=58808',
    travelScope: 'overseas',
  },
  {
    supplier: 'kyowontour',
    label: 'kyowontour-package',
    url: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=CSP302260621KE01&menuCode=M5204&brandId=3',
    travelScope: 'overseas',
  },
  {
    supplier: 'kyowontour',
    label: 'kyowontour-fit',
    url: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=AWW317260621SQ02&menuCode=M5306&brandId=3',
    travelScope: 'air_hotel_free',
  },
]

function parseOnlyArg(): CanonicalOverseasSupplierKey | null {
  const raw = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)?.trim()
  if (!raw) return null
  const supported = registerFactsSupportedSuppliers()
  if (!supported.includes(raw as CanonicalOverseasSupplierKey)) {
    console.error(`unknown --only=${raw}; supported: ${supported.join(', ')}`)
    process.exit(1)
  }
  return raw as CanonicalOverseasSupplierKey
}

async function main() {
  const only = parseOnlyArg()
  const targets = CASES.filter((c) => !only || c.supplier === only)
  let failed = 0

  for (const c of targets) {
    process.stdout.write(`[${c.supplier}] ${c.label} … `)
    const bundle = await collectSupplierRegisterFacts(c.supplier, c.url)
    if (!bundle) {
      console.log('FAIL (null bundle)')
      failed += 1
      continue
    }

    const productKind = parseRegisterFactProductKind(bundle)
    const completeness = auditRegisterFactBundleCompleteness(bundle)
    const metrics = await fetchRegisterFactDetailParityMetrics(c.supplier, c.url)
    if (!metrics) {
      console.log('FAIL (null detail metrics)')
      failed += 1
      continue
    }

    const parity = auditRegisterFactDetailParity({ bundle, ...metrics })
    const scopeOk = c.travelScope === 'overseas' ? productKind === 'package' : productKind === 'air_hotel_free'
    const ok = completeness.ok && parity.ok && scopeOk

    console.log(
      ok
        ? `OK kind=${productKind} completeness=${completeness.missing.join('-') || 'ok'} parity=ok`
        : `FAIL kind=${productKind} expected=${c.travelScope} completeness=${completeness.missing.join(',') || 'ok'} parity=${parity.mismatches.map((m) => `${m.field}:${m.facts}≠${m.detail}`).join('; ') || 'ok'}`,
    )
    if (!ok) failed += 1
  }

  if (failed > 0) {
    console.error(`\nverify-register-facts-detail-parity: ${failed} failure(s)`)
    process.exit(1)
  }
  console.log('\nverify-register-facts-detail-parity: all cases OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
