/**
 * 정적 가드 — 출발 row·캐시를 쓰는 모든 경로가 캐시 재계산에 연결돼 있는지, 공개 판정이 한 곳인지 확인.
 * REGRESSION-FREEZE[departure-cache-from-rows]: 쓰기 경로 누락·판정 복제 시 실패 — manifest
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const SCAN_DIRS = ['lib', 'app']

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))).map((f) => ({
  rel: path.relative(ROOT, f).replace(/\\/g, '/'),
  src: fs.readFileSync(f, 'utf8'),
}))

/** 출발 row 를 쓰지만 날짜·성인가>0 집합에 영향이 없는 경로(사유 명시). */
const NO_DATE_EFFECT: Record<string, string> = {
  'lib/departure-legacy-slot-reconcile.ts': 'departureSlotKey 만 변경',
  'lib/scraper-on-demand-throttle.ts': 'lastScrapeAttemptAt 만 변경',
}

describe('departure cache: 출발 row 쓰기 경로는 모두 캐시 재계산에 연결', () => {
  const DEP_WRITE = /productDeparture\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/

  it('lib/app 의 productDeparture 쓰기 파일은 재계산 호출이 있거나 무영향 사유가 명시돼 있다', () => {
    const offenders: string[] = []
    for (const f of files) {
      if (!DEP_WRITE.test(f.src)) continue
      if (f.rel in NO_DATE_EFFECT) continue
      if (!/recomputeProductDepartureCache(Safe)?\(/.test(f.src)) offenders.push(f.rel)
    }
    expect(offenders).toEqual([])
  })

  it('공급사 sweep 의 lastFutureDepartureDate 쓰기는 같은 파일에서 재계산으로 덮어쓴다', () => {
    const sweeps = files.filter((f) => /^lib\/[a-z]+-sweep\.ts$/.test(f.rel) && /lastFutureDepartureDate:/.test(f.src))
    expect(sweeps.length).toBeGreaterThanOrEqual(7)
    for (const f of sweeps) {
      expect(f.src, f.rel).toMatch(/recomputeProductDepartureCacheSafe\(/)
    }
  })

  it('5분 정책 점검(runOneSalesPolicyCheck)도 라이브 값으로 쓴 캐시를 재계산으로 덮어쓴다', () => {
    const f = files.find((x) => x.rel === 'lib/product-sales-policy.ts')!
    expect(f.src).toMatch(/recomputeProductDepartureCacheSafe\(prisma, product\.id/)
  })

  it('공급사 upsert 모듈 7개 모두 재계산 호출', () => {
    const ups = files.filter((f) => /^lib\/upsert-product-departures-[a-z]+\.ts$/.test(f.rel))
    expect(ups).toHaveLength(7)
    for (const f of ups) expect(f.src, f.rel).toMatch(/recomputeProductDepartureCacheSafe\(prisma, productId/)
  })
})

describe('departure cache: 공개 판정은 publicProductWhereClause 한 곳', () => {
  it('product-sales-policy 밖에서 lastFutureDepartureDate null 허용 where 를 복제하지 않는다', () => {
    const offenders = files
      .filter((f) => f.rel !== 'lib/product-sales-policy.ts' && f.rel !== 'lib/product-departure-cache.ts')
      .filter((f) => /lastFutureDepartureDate:\s*null/.test(f.src))
      .map((f) => f.rel)
    expect(offenders).toEqual([])
  })

  it('시즌·홈 노출 경로가 공통 판정을 쓴다', () => {
    for (const rel of ['lib/season-curation.ts', 'lib/home-season-pick.ts', 'app/components/travel/overseas/OverseasRegisteredProductsSection.tsx']) {
      const f = files.find((x) => x.rel === rel)!
      expect(f.src, rel).toMatch(/publicProductWhereClause\(/)
    }
  })

  it('야간 점검이 instrumentation 에 등록돼 있다', () => {
    const src = fs.readFileSync(path.join(ROOT, 'instrumentation.ts'), 'utf8')
    expect(src).toContain('startInstrumentationDepartureCacheReconcileCron')
  })
})
