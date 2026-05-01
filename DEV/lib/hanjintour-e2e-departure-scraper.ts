/**
 * 한진투어 상세 URL → 출발일 변경 모달 → 달력(가격 있는 날짜만) → 우측 리스트 카드.
 * DOM: `출발일 변경` compact `button`, 달력 셀 `…만` / `…원`, 카드 `div.product-event__item`.
 */
import type { Page } from 'puppeteer'
import type {
  HanjintourDepartureCardSnapshot,
  HanjintourPerDateScrapeSnapshot,
  HanjintourScrapeSnapshot,
} from '@/DEV/lib/hanjintour-types'
import { enrichHanjintourDepartureCardFromRaw } from '@/DEV/lib/hanjintour-enrich-card-from-raw'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function jitter(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

async function loadPuppeteer(): Promise<typeof import('puppeteer')> {
  return import('puppeteer')
}

type EvalCard = { rawText: string; price: number | null }
type EvalDate = {
  label: string
  calendarSnapshot: string | null
  listBefore: string | null
  listAfter: string | null
  cards: EvalCard[]
}
type EvalResult = {
  calendarBefore: string | null
  dates: EvalDate[]
  log: string[]
  failures: string[]
}

async function readPageTextBeforeModal(page: Page): Promise<string> {
  return (await page.evaluate(() => (document.body.innerText || '').slice(0, 4000))) as string
}

async function readCalendarModalTextSlice(page: Page): Promise<string | null> {
  return (await page.evaluate(function () {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
    for (let i = 0; i < dialogs.length; i++) {
      const d = dialogs[i]!
      if (d.querySelector('.change-date')) {
        return (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12000)
      }
    }
    return null
  })) as string | null
}

async function clickOpenDepartureModal(page: Page): Promise<{ ok: boolean; log: string[] }> {
  const log: string[] = []
  const ok = (await page.evaluate(() => {
    const clickers = Array.from(document.querySelectorAll('button, a[href], [role="button"]'))
    const openBtn = clickers.find((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (t.length > 80) return false
      return /출발일\s*변경/.test(t)
    })
    if (!openBtn) return false
    ;(openBtn as HTMLElement).click()
    return true
  })) as boolean
  if (ok) log.push('clicked 출발일 변경 (compact control only)')
  return { ok, log }
}

async function dismissBlockingDialogs(page: Page): Promise<string[]> {
  const log: string[] = []
  for (let attempt = 0; attempt < 3; attempt++) {
    const closed = (await page.evaluate(() => {
      for (const dlg of Array.from(document.querySelectorAll('[role="dialog"]'))) {
        const tx = (dlg.textContent || '').replace(/\s+/g, ' ')
        if (dlg.querySelector('.change-date')) continue
        if (/90일\s*뒤에\s*변경|비밀번호\s*변경/.test(tx)) {
          const b = Array.from(dlg.querySelectorAll('button')).find((x) =>
            /90일\s*뒤에\s*변경/.test((x.textContent || '').replace(/\s+/g, ' '))
          )
          if (b) {
            ;(b as HTMLElement).click()
            return 'pwd_nudge'
          }
        }
        if (/아이디/.test(tx) && /비밀번호/.test(tx) && /로그인/.test(tx)) {
          const closers = Array.from(dlg.querySelectorAll('button, [role="button"], a'))
          const b = closers.find((x) => {
            const lab = (x.textContent || '').trim()
            const ar = x.getAttribute('aria-label') || ''
            return /^닫기/u.test(lab) || /닫기/u.test(ar)
          })
          if (b) {
            ;(b as HTMLElement).click()
            return 'login'
          }
        }
      }
      return ''
    })) as string
    if (!closed) break
    log.push(`dismissed_dialog:${closed}`)
    await sleep(500)
  }
  return log
}

function ymFromText(blob: string): string | null {
  const m = blob.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})/u)
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}`
  const m2 = blob.match(/(\d{2})\.(\d{2})(?!\d)/u)
  if (m2) return `20${m2[1]}-${m2[2]!.padStart(2, '0')}`
  return null
}

function parseIsoDate(label: string, yearMonth: string | null): string | null {
  const t = label.trim().replace(/ /g, '')
  let day: string | null = null
  const mJoin = t.match(/^(\d{1,2})\d{2,4}만/)
  if (mJoin) day = mJoin[1]!
  if (!day) {
    const m = t.match(/^(\d{1,2})\b/)
    if (m) day = m[1]!
  }
  if (!day || !yearMonth) return null
  const [y, mo] = yearMonth.split('-')
  return `${y}-${mo}-${day.padStart(2, '0')}`
}

/**
 * @param detailUrl 한진투어 상품 상세 URL
 */
export async function scrapeHanjintourDepartureCards(detailUrl: string): Promise<{
  cards: HanjintourDepartureCardSnapshot[]
  snapshot: HanjintourScrapeSnapshot
}> {
  const puppeteer = await loadPuppeteer()
  const failures: string[] = []
  const modalOpenLog: string[] = []
  const perDate: HanjintourPerDateScrapeSnapshot[] = []
  const flatCards: HanjintourDepartureCardSnapshot[] = []
  let pageTextBeforeModal: string | null = null
  let calendarDomBeforeModal: string | null = null
  let modalTextAfterOpen: string | null = null

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 900 })
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 120_000 })
    await sleep(jitter(800, 1600))

    pageTextBeforeModal = await readPageTextBeforeModal(page)
    modalOpenLog.push(...(await dismissBlockingDialogs(page)))
    const opened = await clickOpenDepartureModal(page)
    modalOpenLog.push(...opened.log)
    if (!opened.ok) {
      failures.push('open_modal: no button matching 출발일 변경')
    }
    await sleep(jitter(2200, 4000))
    modalTextAfterOpen = await readCalendarModalTextSlice(page)

    const collected = (await page.evaluate(function () {
      const log: string[] = []
      const failures: string[] = []
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
      let modal: Element | null = null
      for (let i = 0; i < dialogs.length; i++) {
        const d = dialogs[i]!
        if (d.querySelector('.change-date')) {
          modal = d
          break
        }
      }
      if (!modal) modal = dialogs[dialogs.length - 1] || document.body
      const calendarBefore = (modal.textContent || '').slice(0, 4000)

      const root = modal.querySelector('.change-date') || modal
      const allCells = Array.from(root.querySelectorAll('button, td, [role="gridcell"], div, span'))
      const cells = []
      for (let i = 0; i < allCells.length; i++) {
        const el = allCells[i] as HTMLElement
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (t.length < 2 || t.length > 64) continue
        if (/일월화수목금토/.test(t)) continue
        const compact = t.replace(/ /g, '')
        const hasWon = /\d{1,3}(,\d{3})+\s*원/u.test(t) || /\d{4,7}\s*원/u.test(t)
        const hasMan = /\d{2,4}만/u.test(t) || /^\d{1,2}\d{2,4}만/u.test(compact)
        if (!hasWon && !hasMan) continue
        if (/^\d{1,3}(?:,\d{3})+\s*원/u.test(t)) continue
        if (/~$/.test(t)) continue
        const looksLikeDayCell =
          /^\d{1,2}\d{2,4}만/u.test(compact) || (/^\d{1,2}\s/u.test(t) && (hasWon || hasMan))
        if (looksLikeDayCell) cells.push(el)
      }

      const seen = new Set<string>()
      const uniq = []
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]!
        const outer = (c as HTMLElement).outerHTML || ''
        const key = `${(c.textContent || '').replace(/\s+/g, '|')}|${outer.slice(0, 180)}`
        if (seen.has(key)) continue
        seen.add(key)
        uniq.push(c)
      }

      const dates = []
      for (let ci = 0; ci < uniq.length; ci++) {
        const cell = uniq[ci]!
        try {
          const listBefore = (modal.textContent || '').slice(0, 8000)
          cell.click()
          const listAfter = (modal.textContent || '').slice(0, 8000)
          const grid = modal.querySelector('table') || modal.querySelector('[role="grid"]')
          const items = modal.querySelectorAll('div.product-event__item')
          const cards = []
          const used = new Set<string>()
          for (let ii = 0; ii < items.length; ii++) {
            const el = items[ii]!
            if (grid && grid.contains(el)) continue
            const raw = (el.textContent || '').replace(/\s+/g, ' ').trim()
            if (raw.length < 25) continue
            const head = raw.slice(0, 160)
            if (used.has(head)) continue
            used.add(head)
            let price: number | null = null
            const mWon = raw.match(/(\d{1,3}(?:,\d{3})+|\d{4,7})\s*원/)
            if (mWon) price = parseInt(mWon[1]!.replace(/,/g, ''), 10)
            else {
              const mMan = raw.match(/(\d{2,4})만/)
              if (mMan) price = parseInt(mMan[1]!, 10) * 10000
            }
            cards.push({ rawText: raw.slice(0, 8000), price })
          }
          let label = (cell.textContent || '').replace(/\s+/g, ' ').trim()
          const par = cell.parentElement
          if (par) {
            const pt = (par.textContent || '').replace(/\s+/g, ' ').trim()
            if (pt.length > label.length && pt.length <= 40) label = pt
          }
          dates.push({
            label,
            calendarSnapshot: grid?.textContent ? grid.textContent.slice(0, 4000) : null,
            listBefore,
            listAfter,
            cards,
          })
        } catch (e) {
          failures.push(`date_cell: ${(cell.textContent || '').slice(0, 40)} / ${String(e)}`)
        }
      }

      const nextBtns = Array.from(modal.querySelectorAll('button, [role="button"]')).filter((el) => {
        const a = el.getAttribute('aria-label') || ''
        const t = (el.textContent || '').replace(/\s+/g, ' ')
        return (
          /다음\s*달|다음달|next/i.test(a) ||
          />|›|→/.test((el.textContent || '').trim()) ||
          /다음\s*달/.test(t)
        )
      })
      if (nextBtns[0]) {
        try {
          ;(nextBtns[0] as HTMLElement).click()
          log.push('clicked next month (single step; multi-month loop is CLI responsibility)')
        } catch (e) {
          failures.push(`next_month: ${String(e)}`)
        }
      }

      return { calendarBefore, dates, log, failures }
    })) as EvalResult
    calendarDomBeforeModal = collected.calendarBefore
    modalOpenLog.push(...collected.log)
    failures.push(...collected.failures)

    let inferredYm = ymFromText(collected.calendarBefore ?? '')
    let scrapeClickCounter = 0
    for (const d of collected.dates) {
      inferredYm = ymFromText(d.listAfter ?? '') ?? ymFromText(d.label) ?? inferredYm
      const iso = parseIsoDate(d.label, inferredYm)
      const dateCards: HanjintourDepartureCardSnapshot[] = []
      d.cards.forEach((raw, idx) => {
        const snap: HanjintourDepartureCardSnapshot = {
          selected_calendar_year_month: inferredYm,
          selected_departure_date: iso,
          calendar_cell_price: raw.price,
          card_index: idx,
          raw_card_text: raw.rawText,
          raw_card_title: raw.rawText.split(/\s{2,}/)[0]!.slice(0, 200) || null,
          departure_datetime: null,
          return_datetime: null,
          trip_nights: null,
          trip_days: null,
          airline_name: null,
          airline_code: null,
          listed_price: raw.price,
          reservation_count: null,
          remaining_seats: null,
          minimum_departure_count: null,
          status_badges: [],
          option_badges: [],
          source_url: detailUrl,
          scrape_click_index: scrapeClickCounter++,
        }
        enrichHanjintourDepartureCardFromRaw(snap)
        dateCards.push(snap)
        flatCards.push(snap)
      })
      perDate.push({
        clicked_date_label: d.label,
        calendar_text_snapshot: d.calendarSnapshot,
        list_before_click_text: d.listBefore,
        list_after_click_text: d.listAfter,
        cards: dateCards,
      })
    }

    if (flatCards.length === 0 && failures.length === 0) {
      failures.push('no priced calendar cells or no list cards — verify modal DOM')
    }
  } catch (e) {
    failures.push(`scrape_error: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    await browser.close()
  }

  const snapshot: HanjintourScrapeSnapshot = {
    detail_url: detailUrl,
    scraped_at_iso: new Date().toISOString(),
    page_text_before_modal: pageTextBeforeModal,
    modal_text_after_open: modalTextAfterOpen,
    calendar_dom_text_before_modal: calendarDomBeforeModal,
    modal_open_log: modalOpenLog,
    per_date_snapshots: perDate,
    failures,
  }

  return { cards: flatCards, snapshot }
}
