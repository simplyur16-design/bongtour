/**
 * 한진투어 상세 URL에서 일정표 DOM을 열고 `N일차`가 포함된 본문 텍스트를 수집한다.
 * innerText-only 붙여넣기와 달리 탭/아코디언 뒤에 렌더된 일정까지 포함한다.
 */
import type { Page } from 'puppeteer'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function loadPuppeteer(): Promise<typeof import('puppeteer')> {
  return import('puppeteer')
}

export function assertHanjintravelDetailUrl(urlStr: string): URL {
  let u: URL
  try {
    u = new URL(urlStr)
  } catch {
    throw new Error('hanjintour schedule fetch: invalid URL')
  }
  const host = u.hostname.replace(/^www\./i, '').toLowerCase()
  if (host !== 'hanjintravel.com') {
    throw new Error('hanjintour schedule fetch: only hanjintravel.com URLs are allowed')
  }
  return u
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

/**
 * 상세 페이지에서 일정 탭을 최대한 열고, `\\d+일차`가 가장 많이 등장하는 영역의 innerText를 반환한다.
 */
export async function fetchHanjintourScheduleRichTextFromDetailUrl(detailUrl: string): Promise<{
  text: string | null
  log: string[]
}> {
  assertHanjintravelDetailUrl(detailUrl)
  const log: string[] = []
  const puppeteer = await loadPuppeteer()
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 900 })
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 120000 })
    await sleep(2500)
    log.push(...(await dismissBlockingDialogs(page)))

    const tabLabel = (await page.evaluate(() => {
      const clickers = Array.from(
        document.querySelectorAll('button, a, [role="tab"], li, span, div[role="button"]')
      ) as HTMLElement[]
      type Cand = { el: HTMLElement; t: string; score: number }
      const cands: Cand[] = []
      for (const el of clickers) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (t.length < 2 || t.length > 36) continue
        if (/포인트일정표|마일리지|적립|이벤트\s*당첨/u.test(t)) continue
        let score = 0
        if (/^여행\s*일정$/u.test(t)) score = 100
        else if (/^상세\s*일정$/u.test(t)) score = 98
        else if (/^일정$/u.test(t)) score = 96
        else if (/일정\s*안내|여행\s*일정표|상품\s*일정/u.test(t)) score = 85
        else if (/일정표$/u.test(t) && !/포인트/u.test(t)) score = 72
        else if (/투어\s*일정/u.test(t)) score = 68
        if (score > 0) cands.push({ el, t, score })
      }
      cands.sort((a, b) => b.score - a.score)
      const best = cands[0]
      if (best) {
        best.el.click()
        return best.t
      }
      return null
    })) as string | null
    if (tabLabel) log.push(`clicked_tab:${tabLabel}`)
    await sleep(1800)

    await page.evaluate(() => {
      const clickers = Array.from(document.querySelectorAll('button, [aria-expanded], summary')) as HTMLElement[]
      for (const el of clickers) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (t.length > 60) continue
        if (/일정\s*보기|일정\s*펼치|상세일정|여행일정/u.test(t) && el.getAttribute('aria-expanded') === 'false') {
          el.click()
        }
      }
    })
    await sleep(800)

    const rich = (await page.evaluate(() => {
      const dayToken = /\d+\s*일차|제\s*\d+\s*일차/gu
      let best = ''
      let bestScore = 0
      const nodes = document.querySelectorAll('div, section, article, main, table')
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i]! as HTMLElement
        const t = (el.innerText || '').replace(/\r/g, '')
        const matches = t.match(dayToken)
        if (!matches || matches.length < 2) continue
        const n = matches.length
        const head = t.slice(0, 400)
        if (/로그인\s*후|회원가입|고객센터\s*1588/u.test(head) && t.length < 800) continue
        const score = n * 5000 + Math.min(t.length, 120000)
        if (score > bestScore) {
          bestScore = score
          best = t
        }
      }
      return best.slice(0, 120000)
    })) as string

    if (rich && /\d+\s*일차|제\s*\d+\s*일차/u.test(rich)) {
      log.push(`schedule_text_chars:${rich.length}`)
      return { text: rich, log }
    }
    log.push('schedule_text: no multi-day block found')
    return { text: null, log }
  } finally {
    await browser.close()
  }
}
