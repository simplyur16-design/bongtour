/**
 * cityKey가 국가·권역 슬러그(it, fr …)인 등록 해외 상품 → 제목 기반 세분 cityKey 보정.
 *
 *   npx tsx scripts/fix-product-citykey-country-slugs.ts           # dry-run
 *   npx tsx scripts/fix-product-citykey-country-slugs.ts --apply     # DB 반영
 */
import './load-env-for-scripts'

import {
  applyProductCityKeyCountrySlugFixes,
  listProductCityKeyCountrySlugFixCandidates,
} from '@/lib/product-citykey-country-slug-fix'

async function main() {
  const apply = process.argv.includes('--apply')
  const candidates = await listProductCityKeyCountrySlugFixCandidates()

  console.log(`[fix-product-citykey] candidates: ${candidates.length}`)
  for (const c of candidates.slice(0, 40)) {
    console.log(`  ${c.id}  ${c.cityKey} → ${c.nextCityKey}  (${c.nextCityLabel})  ${c.title.slice(0, 60)}`)
  }
  if (candidates.length > 40) {
    console.log(`  … +${candidates.length - 40} more`)
  }

  if (!apply) {
    console.log('[fix-product-citykey] dry-run — pass --apply to write')
    return
  }

  const results = await applyProductCityKeyCountrySlugFixes(candidates)
  const applied = results.filter((r) => r.applied)
  console.log(`[fix-product-citykey] applied: ${applied.length} / ${results.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
