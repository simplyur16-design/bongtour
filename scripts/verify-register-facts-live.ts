/**
 * 6공급사 register-facts URL live 검증.
 *
 *   npx tsx scripts/verify-register-facts-live.ts
 *   npx tsx scripts/verify-register-facts-live.ts --only=kyowontour
 */
import './load-env-for-scripts'

import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { collectSupplierRegisterFacts, registerFactsSupportedSuppliers } from '@/lib/register-facts/collect'

const CASES: Array<{ supplier: CanonicalOverseasSupplierKey; url: string; label: string }> = [
  {
    supplier: 'modetour',
    label: 'modetour-package',
    url: 'https://www.modetour.com/package/110029935',
  },
  {
    supplier: 'hanatour',
    label: 'hanatour-package',
    url: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=EEP133260701KEY&prePage=major-products',
  },
  {
    supplier: 'ybtour',
    label: 'ybtour-package',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AABW002&evCd=ALP1122-260706QV00',
  },
  {
    supplier: 'verygoodtour',
    label: 'verygoodtour-package',
    url: 'https://www.verygoodtour.com/Product/PackageDetail?ProCode=APP2586-2606239G35&PriceSeq=4&MenuCode=leaveLayer',
  },
  {
    supplier: 'lottetour',
    label: 'lottetour-package',
    url: 'https://www.lottetour.com/evtList/826/857/1063/2333?godId=58808',
  },
  {
    supplier: 'kyowontour',
    label: 'kyowontour-package',
    url: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=MCP160260622WS01&menuCode=M510602&brandId=0',
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
    const rows = bundle.priceRows.filter((r) => (r.adultPrice ?? 0) > 0 && r.departureDate)
    const withStatus = rows.filter((r) => r.statusRaw?.trim())
    const withSeats = rows.filter((r) => r.seatCount != null || r.seatsStatusRaw?.trim())
    const withMin = rows.filter((r) => r.minPax != null && r.minPax > 0)
    const withAir = rows.filter((r) => r.carrierName?.trim())
    const ok = rows.length > 0 && bundle.title?.trim()
    console.log(
      ok
        ? `OK title=${JSON.stringify(bundle.title?.slice(0, 40))} prices=${rows.length} status=${withStatus.length} seats=${withSeats.length} min=${withMin.length} air=${withAir.length}`
        : `FAIL rows=${rows.length} title=${bundle.title ?? 'null'}`,
    )
    if (!ok) failed += 1
  }

  if (failed > 0) {
    console.error(`\nverify-register-facts-live: ${failed} failure(s)`)
    process.exit(1)
  }
  console.log('\nverify-register-facts-live: all suppliers OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
