import { describe, expect, it } from 'vitest'
import { lottetourMonthCountInclusive } from '@/lib/lottetour-price-recheck-meta'
import { addDaysUtcYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// REGRESSION-FREEZE[lottetour-register-facts-calendar-horizon]: D01A 9~10월 — monthCount≥6 — manifest

describe('lottetour register-facts calendar horizon', () => {
  it('RULE_A 180일 from mid-July covers Sep–Oct (not just 2 months)', () => {
    const fromYmd = '2026-07-15'
    const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
    const months = lottetourMonthCountInclusive(fromYmd, toYmd)
    expect(months).toBeGreaterThanOrEqual(6)
    expect(months).toBeLessThanOrEqual(8)
    // monthCount=2 → Jul+Aug only → D01A Sep/Oct godId 0건 (live: 8행)
    expect(2).toBeLessThan(months)
  })

  it('register-facts lottetour uses lottetourMonthCountInclusive (not hardcoded 2)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/register-facts/lottetour.ts'), 'utf8')
    expect(src).toMatch(/lottetourMonthCountInclusive/)
    expect(src).toMatch(/REGRESSION-FREEZE\[lottetour-register-facts-calendar-horizon\]/)
    expect(src).not.toMatch(/monthCount:\s*2/)
  })
})
