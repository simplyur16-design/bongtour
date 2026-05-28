import { COUNTRY_OPTIONS } from '@/lib/bongsim/country-options'
import { getPgPool } from '@/lib/bongsim/db/pool'
import { BONGSIM_CATALOG_ACTIVE_WHERE } from '@/lib/bongsim/catalog/active-product-sql'
import { extractSingleCountryCode, resolveMultiCoverage } from '@/lib/bongsim/plan-coverage-map'

export type BongsimCountryListItem = {
  code: string
  nameKr: string
}

/** GET /api/bongsim/countries — DB·매핑 SSOT */
export async function loadBongsimCountriesList(): Promise<BongsimCountryListItem[]> {
  const pool = getPgPool()
  if (!pool) {
    throw new Error('DB not configured')
  }

  const { rows } = await pool.query<{ plan_name: string }>(
    `SELECT DISTINCT TRIM(plan_name) AS plan_name
     FROM bongsim_product_option
     WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
       AND plan_name IS NOT NULL AND TRIM(plan_name) <> ''`,
  )

  const codes = new Set<string>()
  for (const row of rows) {
    const pn = row.plan_name?.trim()
    if (!pn) continue
    const multi = resolveMultiCoverage(pn)
    const singleCode = extractSingleCountryCode(pn)
    if (multi !== undefined && singleCode === null) continue
    if (singleCode) codes.add(singleCode.trim().toLowerCase())
  }

  const byCode = new Map(COUNTRY_OPTIONS.map((c) => [c.code.toLowerCase(), c]))
  const countries: BongsimCountryListItem[] = []

  for (const code of codes) {
    const opt = byCode.get(code)
    if (opt) {
      countries.push({ code: opt.code, nameKr: opt.nameKr })
    }
  }

  countries.sort((a, b) => a.nameKr.localeCompare(b.nameKr, 'ko'))
  return countries
}
