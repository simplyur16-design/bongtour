/**
 * KW36098 실전 검증: base + 표 SSOT + e2e 스크래프 + 파생 N.
 * npx tsx DEV/scripts/verify-hanjintour-kw36098.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createDerivedHanjintourProduct } from '@/DEV/lib/hanjintour-derived-product'
import { scrapeHanjintourDepartureCards } from '@/DEV/lib/hanjintour-e2e-departure-scraper'
import { parseHanjintourBaseProduct } from '@/DEV/lib/parse-hanjintour-base-product'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DETAIL_URL =
  'https://www.hanjintravel.com/dp/display/displayDetail?gdsNo=KW36098&evtNo=OP20260417377'
const INNER_TXT = path.join(__dirname, '..', 'fixtures', 'hanjintour-kw36098-body-innerText.txt')

/** 사용자 제공 선택관광 표 (탭 구분) */
const OPTIONAL_TABLE_SSOT = `도시\t선택관광명\t가격(1인당)\t소요시간\t대체일정
뉴욕\tMOMA 현대미술관\t성인 40 USD(미국 달러)\t약 1시간\t주변 자유시간
나이아가라 폭포\t바람의동굴\t성인 40 USD(미국 달러)\t약 1시간\t미국측 나이아가라 폭포 주변 자유시간
나이아가라 폭포\t씨닉터널\t성인 40 USD(미국 달러)\t약 1시간\t주변 자유 시간
나이아가라 폴스\t스카이론타워 전망대 & 중식 업그레이드\t성인 110 USD(미국 달러)\t약 1시간 30분\t나이아가라 자유시간
나이아가라 폴스\t나이아가라 헬기 투어\t성인 160 USD(미국 달러)\t약 15분\t주변 자유 시간
나이아가라 폴스\t나이아가라 헬기투어\t성인 215 CAD(캐나다 달러)\t약 15분\t주변 자유 시간
나이아가라 폴스\t나이아가라 젯보트\t성인 130 USD(미국 달러)\t약 1시간\t주변 자유시간
나이아가라 폴스\t나이아가라젯보트\t성인 150 CAD(캐나다 달러)\t약1시간\t주변 자유시간
나이아가라 폴스\t화이트워터워크\t성인 40 USD(미국 달러)\t약 1시간\t주변 자유시간
오타와\t천섬 유람선\t성인 45 USD(미국 달러)\t약 1시간\t주변 대기
나이아가라 폴스\t랍스터 특식\t성인 80 USD(미국 달러)\t약 1시간\t기본 제공 일반 식당에서 식사
퀘벡시티\t몽모렌시 폭포\t성인 45 USD(미국 달러)\t약 1시간\t주변 자유시간
퀘벡시티\t세인트 안 캐년(Canyon Sainte-Anne)\t성인 50 USD(미국 달러)\t약 1시간\t주변 자유시간
플래츠버그\t오조블 케이즘 (Ausable Chasm)\t성인 50 USD(미국 달러)\t약 1시간\t주변 자유시간
뉴욕\t뉴욕 야경\t성인 60 USD(미국 달러)\t약 1시간 30분\t호텔로 이동하여 휴식`

async function main() {
  const bodyRaw = fs.existsSync(INNER_TXT)
    ? fs.readFileSync(INNER_TXT, 'utf8')
    : ''
  const detailHtml = `<body><pre>${bodyRaw.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></body>`

  const base = parseHanjintourBaseProduct(detailHtml, { optionalTourTableSsot: OPTIONAL_TABLE_SSOT })

  const { cards, snapshot } = await scrapeHanjintourDepartureCards(DETAIL_URL)

  const derived = cards.map((c) => createDerivedHanjintourProduct(base, c, snapshot))

  const out = {
    base_parser: base,
    optional_tours_structured: base.optional_tours_structured,
    e2e: {
      failures: snapshot.failures,
      modal_open_log: snapshot.modal_open_log,
      priced_date_cells: snapshot.per_date_snapshots.length,
      date_card_counts: snapshot.per_date_snapshots.map((d) => ({
        clicked_date_label: d.clicked_date_label,
        card_count: d.cards.length,
      })),
      per_date_snapshots: snapshot.per_date_snapshots.map((d) => ({
        clicked_date_label: d.clicked_date_label,
        card_count: d.cards.length,
        list_before_snip: (d.list_before_click_text ?? '').slice(0, 240),
        list_after_snip: (d.list_after_click_text ?? '').slice(0, 240),
        first_card_text: d.cards[0]?.raw_card_text?.slice(0, 260) ?? null,
      })),
      card_sample: cards[0]?.raw_card_text ?? null,
      page_text_before_modal_snip: (snapshot.page_text_before_modal ?? '').slice(0, 400),
      modal_text_after_open_snip: (snapshot.modal_text_after_open ?? '').slice(0, 500),
    },
    derived_summary: derived.map((d) => ({
      display_title: d.display_title,
      airline: d.departure_card.airline_name,
      departure_datetime: d.departure_card.departure_datetime,
      return_datetime: d.departure_card.return_datetime,
      trip_nights: d.departure_card.trip_nights,
      trip_days: d.departure_card.trip_days,
      listed_price: d.departure_card.listed_price,
      derived_key: d.derived_product_key,
      option_badges: d.departure_card.option_badges,
    })),
  }

  const outPath = path.join(__dirname, '..', 'fixtures', 'verify-kw36098-out.json')
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log(
    JSON.stringify(
      {
        wrote: outPath,
        priced_date_cells: out.e2e.priced_date_cells,
        total_cards: cards.length,
        unique_derived_keys: new Set(out.derived_summary.map((d) => d.derived_key)).size,
        failures: out.e2e.failures,
      },
      null,
      2
    )
  )

  const okE2e = cards.length > 0
  process.exit(okE2e ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
