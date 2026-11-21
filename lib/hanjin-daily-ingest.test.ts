import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('hanjin daily ingest', () => {
  it('worker 정기 수집에 한진관광을 넣고, 7곳 가격 sweep 문구는 유지한다', () => {
    const cron = readFileSync('lib/instrumentation-hanjintour-sweep-cron.ts', 'utf8')
    const reg = readFileSync('lib/instrumentation-supplier-sweep-crontab.ts', 'utf8')
    expect(cron).toContain("30 10 * * *")
    expect(cron).toContain('apply: true')
    expect(cron).toContain('runHanjintourIngestPending')
    expect(cron).toContain('HANJINTOUR_DAILY_INGEST_LIMIT = 20')
    expect(reg).toContain('startInstrumentationHanjintourSweepCron')
    expect(reg).toContain('7공급사')
  })
})
