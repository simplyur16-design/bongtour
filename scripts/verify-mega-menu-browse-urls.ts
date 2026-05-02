/**
 * 메가메뉴(TOP_NAV_MEGA_REGIONS)가 만드는 browse URL의 country 슬러그가
 * resolveBrowseCountryParamToDbCountries 에 매핑되는지 전수 점검.
 *
 *   npx tsx scripts/verify-mega-menu-browse-urls.ts
 */
import { TOP_NAV_MEGA_REGIONS, buildProductsHref, buildProductsHrefCountryOnly } from '@/lib/top-nav-resolve'
import {
  BROWSE_COUNTRY_SLUGS_WITH_INTENTIONAL_EMPTY_RESOLVE,
  resolveBrowseCountryParamToDbCountries,
} from '@/lib/browse-country-url-resolve'

const BROWSE_TYPE = 'travel' as const

function countrySlugFromBrowseHref(href: string): string {
  const u = new URL(href, 'http://localhost')
  return (u.searchParams.get('country') ?? '').trim().toLowerCase()
}

function main() {
  const issues: string[] = []
  const intentional: string[] = []

  for (const region of TOP_NAV_MEGA_REGIONS) {
    const groups = region.countryGroups ?? []
    for (const g of groups) {
      const headerHref = buildProductsHrefCountryOnly({
        type: BROWSE_TYPE,
        regionId: region.id,
        countryLabel: g.countryLabel,
      })
      const headerSlug = countrySlugFromBrowseHref(headerHref)
      const headerResolved = resolveBrowseCountryParamToDbCountries(headerSlug)
      if (headerResolved.length === 0) {
        const line = `[header] region=${region.id} label=${JSON.stringify(g.countryLabel)} → country=${headerSlug}`
        if (BROWSE_COUNTRY_SLUGS_WITH_INTENTIONAL_EMPTY_RESOLVE.has(headerSlug)) intentional.push(line)
        else issues.push(`${line} (미매핑)`)
      }

      for (const leaf of g.cities) {
        const leafHref = buildProductsHref({
          type: BROWSE_TYPE,
          regionId: region.id,
          countryLabel: g.countryLabel,
          leaf,
        })
        const leafSlug = countrySlugFromBrowseHref(leafHref)
        const leafResolved = resolveBrowseCountryParamToDbCountries(leafSlug)
        if (leafResolved.length === 0) {
          const line = `[leaf] region=${region.id} group=${JSON.stringify(g.countryLabel)} leaf=${JSON.stringify(leaf.label)} → country=${leafSlug}`
          if (BROWSE_COUNTRY_SLUGS_WITH_INTENTIONAL_EMPTY_RESOLVE.has(leafSlug)) intentional.push(line)
          else issues.push(`${line} (미매핑)`)
        }
      }
    }
  }

  const fr = resolveBrowseCountryParamToDbCountries('france')
  if (fr.length !== 1 || fr[0] !== '프랑스') {
    issues.push(`[check] france → ${JSON.stringify(fr)} (기대: ["프랑스"])`)
  }

  if (intentional.length) {
    console.log(`[verify-mega-menu-browse-urls] 의도적 빈 매핑(카탈로그 없음) ${intentional.length}건 — 스킵 목록:`)
    for (const x of intentional) console.log(`  ${x}`)
    console.log('')
  }

  if (issues.length) {
    console.error(`[verify-mega-menu-browse-urls] FAIL — 미매핑·검증 오류 ${issues.length}건:`)
    for (const x of issues) console.error(`  ${x}`)
    process.exit(1)
  }

  console.log('[verify-mega-menu-browse-urls] OK — 모든 메가메뉴 country 슬러그가 resolve 되었습니다.')
}

main()
