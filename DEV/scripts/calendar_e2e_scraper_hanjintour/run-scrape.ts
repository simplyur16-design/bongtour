/**
 * 사용: `npx tsx DEV/scripts/calendar_e2e_scraper_hanjintour/run-scrape.ts <detailUrl>`
 * 환경: 저장소에 puppeteer 의존성 존재.
 */
import { scrapeHanjintourDepartureCards } from '@/DEV/lib/hanjintour-e2e-departure-scraper'

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Usage: npx tsx DEV/scripts/calendar_e2e_scraper_hanjintour/run-scrape.ts <detailUrl>')
    process.exit(1)
  }
  const { cards, snapshot } = await scrapeHanjintourDepartureCards(url)
  console.log(JSON.stringify({ cardCount: cards.length, failures: snapshot.failures }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
