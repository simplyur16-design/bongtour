/**
 * 한진투어 전용 오케스트레이션: base 파싱 → 출발 카드 스크래핑 → 파생 N개 → 등록 JSON.
 * DB/Next 라우트는 연결하지 않으며 DEV 전용.
 */
import { createDerivedHanjintourProduct } from '@/DEV/lib/hanjintour-derived-product'
import { scrapeHanjintourDepartureCards } from '@/DEV/lib/hanjintour-e2e-departure-scraper'
import { fetchHanjintourScheduleRichTextFromDetailUrl } from '@/DEV/lib/hanjintour-schedule-live-fetch'
import { parseHanjintourScheduleFromBody } from '@/DEV/lib/hanjintour-schedule-from-body'
import { parseHanjintourBaseProduct } from '@/DEV/lib/parse-hanjintour-base-product'
import type {
  HanjintourDerivedRegisterPayload,
  HanjintourScrapeSnapshot,
} from '@/DEV/lib/hanjintour-types'
import { registerFromLlmHanjintourShape, type HanjintourRegisterBundleJson } from '@/DEV/lib/register-from-llm-hanjintour'

export type HanjintourOrchestrationResult = {
  base: ReturnType<typeof parseHanjintourBaseProduct>
  derived_products: HanjintourDerivedRegisterPayload[]
  register_bundles: HanjintourRegisterBundleJson[]
  scrape_failures: string[]
}

export async function runHanjintourParseAndRegisterDev(args: {
  detailHtml: string
  detailUrl: string
  /** true면 Puppeteer e2e, false면 카드만 외부 주입(테스트) */
  runScraper: boolean
  optionalTourTableSsot?: string | null
  departureCardsOverride?: import('@/DEV/lib/hanjintour-types').HanjintourDepartureCardSnapshot[]
}): Promise<HanjintourOrchestrationResult> {
  let base = parseHanjintourBaseProduct(args.detailHtml, {
    optionalTourTableSsot: args.optionalTourTableSsot,
  })
  if (base.schedule.length === 0 && args.detailUrl?.trim()) {
    try {
      const live = await fetchHanjintourScheduleRichTextFromDetailUrl(args.detailUrl.trim())
      if (live.text) {
        const sched = parseHanjintourScheduleFromBody(live.text)
        if (sched.length > 0) {
          base = {
            ...base,
            schedule: sched,
            parse_notes: [
              ...base.parse_notes,
              `schedule: live_dom_fetch (${live.log.join('; ')})`,
            ],
          }
        } else {
          base = {
            ...base,
            parse_notes: [...base.parse_notes, `schedule: live_fetch_no_N일차 (${live.log.join('; ')})`],
          }
        }
      } else {
        base = {
          ...base,
          parse_notes: [...base.parse_notes, `schedule: live_fetch_empty (${live.log.join('; ')})`],
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      base = {
        ...base,
        parse_notes: [...base.parse_notes, `schedule: live_fetch_error:${msg.slice(0, 200)}`],
      }
    }
  }
  let cards = args.departureCardsOverride ?? []
  let scrapeFailures: string[] = []
  let scrapeSnapshot: HanjintourScrapeSnapshot | null = null
  if (args.runScraper && !args.departureCardsOverride) {
    const scraped = await scrapeHanjintourDepartureCards(args.detailUrl)
    cards = scraped.cards
    scrapeSnapshot = scraped.snapshot
    scrapeFailures = scraped.snapshot.failures
  }
  const derived_products = cards.map((card) =>
    createDerivedHanjintourProduct(base, card, scrapeSnapshot)
  )
  const register_bundles = derived_products.map(registerFromLlmHanjintourShape)
  return { base, derived_products, register_bundles, scrape_failures: scrapeFailures }
}

/**
 * 요청 스펙 함수명 정렬:
 * parseHanjintourBaseProduct — parse-hanjintour-base-product.ts
 * scrapeHanjintourDepartureCards — hanjintour-e2e-departure-scraper.ts
 * createDerivedHanjintourProduct — hanjintour-derived-product.ts
 */
export async function registerEachDerivedHanjintourProductIndependently(
  bundles: HanjintourRegisterBundleJson[]
): Promise<{ ok: true; count: number }> {
  /** DEV: 실제 Prisma upsert는 운영 핸들러 연결 시 구현 */
  return { ok: true, count: bundles.length }
}
