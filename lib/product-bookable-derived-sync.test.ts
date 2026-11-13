import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BOOKABLE_DEPARTURE_SEOUL_DATE_SQL,
  SYNC_ALL_PRODUCTS_BOOKABLE_DERIVED_SQL,
} from '@/lib/product-bookable-derived-sync'
import { isOnOrAfterPublicBookableMinDate, toSeoulYmd } from '@/lib/public-bookable-date'

const root = path.join(__dirname, '..')
const MIGRATION = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261114120000_fix_bookable_derived_departure_seoul_date.sql'),
  'utf8',
)
const PREVIOUS = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260611120000_fix_function_search_path_mutable.sql'),
  'utf8',
)
const MIGRATION_SQL_ONLY = MIGRATION.split(/\r?\n/)
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')
const OLD_COMPARE = /\(pd\."departureDate" AT TIME ZONE 'Asia\/Seoul'\)::date/
const NEW_COMPARE = `((pd."departureDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date`

function aggregateBlock(sql: string): string {
  const fnStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.fn_sync_product_bookable_derived')
  const body = sql.slice(fnStart)
  return body.slice(body.indexOf('SELECT'), body.indexOf('INTO v_min_adult')).replace(/\r\n/g, '\n')
}

/** timestamp-without-tz literal as Postgres would evaluate the two expressions with session TimeZone=UTC */
function oldSqlDate(stored: string): string {
  const asSeoulLocal = new Date(`${stored.replace(' ', 'T')}+09:00`)
  return asSeoulLocal.toISOString().slice(0, 10)
}
function newSqlDate(stored: string): string {
  return toSeoulYmd(new Date(`${stored.replace(' ', 'T')}Z`))
}

describe('bookable derived — departureDate Seoul calendar date', () => {
  it('nightly sync SQL uses the Seoul date expression in both statements', () => {
    expect(BOOKABLE_DEPARTURE_SEOUL_DATE_SQL).toBe(NEW_COMPARE)
    expect(SYNC_ALL_PRODUCTS_BOOKABLE_DERIVED_SQL.split(NEW_COMPARE).length - 1).toBe(2)
    expect(SYNC_ALL_PRODUCTS_BOOKABLE_DERIVED_SQL).not.toMatch(OLD_COMPARE)
  })

  it('migration changes only the date comparison', () => {
    expect(MIGRATION).toContain(`AND ${NEW_COMPARE} >= v_min_date;`)
    expect(MIGRATION).not.toMatch(OLD_COMPARE)
    expect(aggregateBlock(MIGRATION)).toBe(aggregateBlock(PREVIOUS))
    expect(MIGRATION).toContain('SET search_path = public')
  })

  it('migration keeps existing GRANTs and touches no RLS', () => {
    expect(MIGRATION).toContain('GRANT EXECUTE ON FUNCTION public.fn_sync_product_bookable_derived(TEXT) TO PUBLIC;')
    expect(MIGRATION).toContain(
      'GRANT EXECUTE ON FUNCTION public.fn_sync_product_bookable_derived(TEXT) TO anon, authenticated, service_role;',
    )
    expect(MIGRATION_SQL_ONLY).not.toMatch(/\bREVOKE\b/)
    expect(MIGRATION_SQL_ONLY).not.toMatch(/ROW LEVEL SECURITY|CREATE POLICY|ALTER POLICY|DROP POLICY/)
    expect(MIGRATION_SQL_ONLY).not.toMatch(/SECURITY DEFINER/)
    expect(MIGRATION_SQL_ONLY).not.toMatch(/\b(ALTER|DROP)\s+TABLE\b/)
    expect(MIGRATION).toMatch(/GRANT: 변경 없음/)
    expect(MIGRATION).toMatch(/RLS: 변경 없음/)
  })

  it('new expression matches Node toSeoulYmd; old one is a day early', () => {
    const stored = '2026-11-14 00:00:00'
    expect(newSqlDate(stored)).toBe('2026-11-14')
    expect(oldSqlDate(stored)).toBe('2026-11-13')
    expect(newSqlDate(stored)).toBe(toSeoulYmd(new Date('2026-11-14T00:00:00Z')))
  })

  it('boundary: departure on today+2 (Seoul) is bookable for Node and the new SQL', () => {
    const now = new Date('2026-11-14T03:00:00+09:00')
    const dep = new Date('2026-11-16T00:00:00Z')
    expect(isOnOrAfterPublicBookableMinDate(dep, now)).toBe(true)
    expect(newSqlDate('2026-11-16 00:00:00') >= '2026-11-16').toBe(true)
    expect(oldSqlDate('2026-11-16 00:00:00') >= '2026-11-16').toBe(false)
  })
})
