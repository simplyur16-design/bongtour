/**
 * Chromium(Puppeteer) 실측: Network payload/response + 화면 텍스트.
 * 사용: npx tsx tools/browser-e2e-booking-modetour.mts [priced|ondemand]
 * 기본: priced — 가격 있는 날짜 접수 + 카카오 클립보드 + 네이버 버튼 상태
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const BASE = 'http://localhost:3000'
const PRODUCT_ID = 'cmnvfupq400061xuldipptqfp'
const PRODUCT_URL = `${BASE}/products/${PRODUCT_ID}`

type PostCapture = { url: string; postData: string | null }
type ResCapture = { url: string; status: number; body: string }

const mode = (process.argv[2] || 'priced').toLowerCase()

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function clickNextMonth(page: puppeteer.Page) {
  const handles = await page.$x('//button[@aria-label="다음 달"]')
  if (handles[0]) await (handles[0] as puppeteer.ElementHandle<Element>).click()
}

async function clickPrevMonth(page: puppeteer.Page) {
  const handles = await page.$x('//button[@aria-label="이전 달"]')
  if (handles[0]) await (handles[0] as puppeteer.ElementHandle<Element>).click()
}

async function gotoCalendarMonth(page: puppeteer.Page, targetY: number, targetM: number) {
  for (let guard = 0; guard < 40; guard++) {
    const label = await monthLabel(page)
    const match = label.match(/(\d{4})년\s*(\d{1,2})월/)
    if (!match) throw new Error(`No month label: ${label}`)
    const y = Number(match[1])
    const m = Number(match[2])
    if (y === targetY && m === targetM) return
    if (y < targetY || (y === targetY && m < targetM)) await clickNextMonth(page)
    else await clickPrevMonth(page)
    await sleep(200)
  }
  throw new Error(`gotoCalendarMonth timeout want ${targetY}-${targetM}`)
}

async function clickCalendarDay(page: puppeteer.Page, dayNum: number) {
  const clicked = await page.evaluate(function (d) {
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return false
    const target = String(d)
    const buttons = Array.from(dialog.querySelectorAll('button'))
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i]
      const firstSpan = b.querySelector('span')
      const dayText = ((firstSpan && firstSpan.textContent) || '').trim()
      if (dayText === target) {
        b.click()
        return true
      }
    }
    return false
  }, dayNum)
  return clicked
}

async function monthLabel(page: puppeteer.Page): Promise<string> {
  return page.evaluate(function () {
    const dialog = document.querySelector('[role="dialog"]')
    const spans = dialog ? Array.from(dialog.querySelectorAll('span')) : []
    for (let i = 0; i < spans.length; i++) {
      const t = spans[i].textContent || ''
      if (/\d{4}년\s*\d{1,2}월/.test(t)) return t.trim()
    }
    return ''
  })
}

async function runPriced() {
  const posts: PostCapture[] = []
  const ress: ResCapture[] = []

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  await page.evaluateOnNewDocument(function () {
    const w = window as unknown as { __clip?: string }
    const orig = navigator.clipboard.writeText.bind(navigator.clipboard)
    navigator.clipboard.writeText = async function (t: string) {
      w.__clip = t
      return orig(t)
    }
  })

  page.on('request', (req) => {
    const u = req.url()
    if (req.method() === 'POST' && (u.includes('/api/bookings') || u.includes(`/api/products/${PRODUCT_ID}`))) {
      posts.push({ url: u.split('?')[0], postData: req.postData() })
    }
  })

  page.on('response', async (res) => {
    const u = res.url()
    if (res.request().method() !== 'POST') return
    if (!u.includes('/api/bookings')) return
    try {
      const body = await res.text()
      ress.push({ url: u.split('?')[0], status: res.status(), body })
    } catch {
      ress.push({ url: u, status: res.status(), body: '' })
    }
  })

  await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2', timeout: 120000 })

  await page.waitForFunction('document.body.innerText.includes("출발일 변경")', { timeout: 60000 })
  await page.evaluate(function () {
    const nodes = Array.from(document.querySelectorAll('a,button'))
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as HTMLElement
      if ((el.textContent || '').indexOf('출발일 변경') !== -1) {
        el.click()
        break
      }
    }
  })
  await page.waitForSelector('[role="dialog"]', { timeout: 30000 })

  await gotoCalendarMonth(page, 2026, 4)

  const ok22 = await clickCalendarDay(page, 22)
  if (!ok22) throw new Error('Could not click calendar day 22')

  await page.waitForFunction('!document.querySelector(\'[role="dialog"]\')', { timeout: 15000 }).catch(() => {})
  await sleep(800)

  const cardHasDate = await page.evaluate(function () {
    return document.body.innerText.indexOf('2026-04-22') !== -1
  })

  await page.evaluate(function () {
    const buttons = Array.from(document.querySelectorAll('button')).filter(function (el) {
      return (el.textContent || '').indexOf('예약 요청 접수') !== -1
    })
    let visible: HTMLElement | undefined
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i] as HTMLElement
      const r = b.getBoundingClientRect()
      const st = window.getComputedStyle(b)
      if (r.width > 2 && r.height > 2 && st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0') {
        visible = b
        break
      }
    }
    if (visible) visible.click()
  })
  await page.waitForSelector('#bin-name', { visible: true, timeout: 60000 })

  const modalHasDate = await page.evaluate(function () {
    return document.body.innerText.indexOf('2026-04-22') !== -1
  })

  await page.evaluate(function () {
    function fire(id: string, v: string) {
      const el = document.querySelector(id) as HTMLInputElement | null
      if (!el) return
      el.focus()
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
      if (proto && proto.set) proto.set.call(el, v)
      else el.value = v
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    fire('#bin-name', 'E2E브라우저')
    fire('#bin-phone', '01099998888')
    fire('#bin-email', 'e2e-browser@example.com')
  })

  await page.evaluate(function () {
    const subs = Array.from(document.querySelectorAll('button[type="submit"]'))
    for (let i = 0; i < subs.length; i++) {
      const el = subs[i] as HTMLElement
      if ((el.textContent || '').indexOf('요청 접수하기') !== -1) {
        el.click()
        break
      }
    }
  })

  await page.waitForFunction(
    'document.body.innerText.includes("요청이 접수되었습니다") || document.body.innerText.includes("접수에 실패")',
    { timeout: 45000 }
  )

  const successVisible = await page.evaluate(function () {
    return document.body.innerText.indexOf('요청이 접수되었습니다') !== -1
  })

  await page.evaluate(function () {
    const buttons = Array.from(document.querySelectorAll('button'))
    for (let i = 0; i < buttons.length; i++) {
      const el = buttons[i] as HTMLElement
      if ((el.textContent || '').indexOf('1:1 카카오 상담하기') !== -1) {
        el.click()
        break
      }
    }
  })
  await sleep(1000)
  const clip = await page.evaluate(function () {
    return (window as unknown as { __clip?: string }).__clip || ''
  })

  const naverInfo = await page.evaluate(function () {
    const buttons = Array.from(document.querySelectorAll('button'))
    let b: HTMLButtonElement | null = null
    for (let i = 0; i < buttons.length; i++) {
      if ((buttons[i].textContent || '').indexOf('네이버 톡톡') !== -1) {
        b = buttons[i] as HTMLButtonElement
        break
      }
    }
    return {
      found: Boolean(b),
      disabled: b ? b.disabled : null,
      text: b ? (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null,
    }
  })

  const shotDir = path.join(process.cwd(), 'tools', '_e2e-out')
  fs.mkdirSync(shotDir, { recursive: true })
  await page.screenshot({ path: path.join(shotDir, 'priced-success.png'), fullPage: true })

  await browser.close()

  const bookingPosts = posts.filter((p) => p.url.includes('/api/bookings'))
  const lastBookingPost = bookingPosts[bookingPosts.length - 1]
  let parsedPayload: Record<string, unknown> | null = null
  try {
    parsedPayload = lastBookingPost?.postData ? (JSON.parse(lastBookingPost.postData) as Record<string, unknown>) : null
  } catch {
    parsedPayload = null
  }
  const lastRes = ress[ress.length - 1]
  let parsedRes: Record<string, unknown> | null = null
  try {
    parsedRes = lastRes?.body ? (JSON.parse(lastRes.body) as Record<string, unknown>) : null
  } catch {
    parsedRes = null
  }

  const kakaoChecks = {
    hasSystemId: clip.includes('상품번호(시스템):'),
    hasListing: clip.includes('상품번호(리스트·노출):'),
    hasTitle: clip.includes('상품명:'),
    hasSupplier: clip.includes('공급사:'),
    hasDate: clip.includes('2026-04-22'),
    hasPax: clip.includes('인원 구성:'),
    hasBookingId: clip.includes('접수번호:'),
  }

  console.log(
    JSON.stringify(
      {
        mode: 'priced',
        productUrl: PRODUCT_URL,
        cardShows20260422: cardHasDate,
        modalShows20260422: modalHasDate,
        submitSuccess: successVisible,
        lastBookingRequestUrl: lastBookingPost?.url,
        requestPayloadKeys: parsedPayload ? Object.keys(parsedPayload) : [],
        requestSelectedDate: parsedPayload?.selectedDate ?? parsedPayload?.selectedDepartureDate,
        responseStatus: lastRes?.status,
        responsePricingMode: parsedRes?.pricingMode,
        responseBookingId: parsedRes?.bookingId,
        kakaoClipboardChecks: kakaoChecks,
        kakaoClipboardLength: clip.length,
        naverButton: naverInfo,
        screenshot: 'tools/_e2e-out/priced-success.png',
      },
      null,
      2
    )
  )
}

async function runOndemand() {
  const posts: PostCapture[] = []
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  page.on('request', (req) => {
    const u = req.url()
    if (req.method() === 'POST' && u.includes(`/api/products/${PRODUCT_ID}`)) {
      posts.push({ url: u.split('?')[0], postData: req.postData() })
    }
  })

  await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForFunction('document.body.innerText.includes("출발일 변경")', { timeout: 60000 })
  await page.evaluate(function () {
    const nodes = Array.from(document.querySelectorAll('a,button'))
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as HTMLElement
      if ((el.textContent || '').indexOf('출발일 변경') !== -1) {
        el.click()
        break
      }
    }
  })
  await page.waitForSelector('[role="dialog"]', { timeout: 30000 })

  await gotoCalendarMonth(page, 2027, 1)

  const ok = await clickCalendarDay(page, 15)
  if (!ok) throw new Error('Could not click day 15 in Jan 2027')

  await sleep(500)
  const overlaySoon = await page.evaluate(function () {
    return document.body.innerText.indexOf('가격을 확인하고 있습니다.') !== -1
  })

  await sleep(12500)
  const delayedText = await page.evaluate(function () {
    const t = document.body.innerText
    const idx = t.indexOf('가격을 확인')
    return {
      hasDelayLine: t.indexOf('담당자가 예약 가능 금액을 확인해') !== -1,
      hasContinue: t.indexOf('예약 요청 접수 진행하기') !== -1,
      overlayChunk: idx >= 0 ? t.slice(Math.max(0, idx - 20), Math.min(t.length, idx + 400)) : '',
    }
  })

  const rangePosts = posts.filter((p) => p.postData?.includes('range-on-demand'))
  let rangeParsed: Record<string, unknown> | null = null
  try {
    rangeParsed = rangePosts[0]?.postData ? (JSON.parse(rangePosts[0].postData!) as Record<string, unknown>) : null
  } catch {
    rangeParsed = null
  }

  const shotDir = path.join(process.cwd(), 'tools', '_e2e-out')
  fs.mkdirSync(shotDir, { recursive: true })
  await page.screenshot({ path: path.join(shotDir, 'ondemand-delay.png'), fullPage: true })

  await browser.close()

  console.log(
    JSON.stringify(
      {
        mode: 'ondemand',
        productUrl: PRODUCT_URL,
        rangeOnDemandPosts: rangePosts.length,
        rangePayloadMode: rangeParsed?.mode,
        rangePayloadDate: rangeParsed?.departureDate,
        overlayPrimaryWithin500ms: overlaySoon,
        after12500ms: delayedText,
        screenshot: 'tools/_e2e-out/ondemand-delay.png',
      },
      null,
      2
    )
  )
}

;(mode === 'ondemand' ? runOndemand() : runPriced()).catch((e) => {
  console.error(String(e))
  process.exit(1)
})
