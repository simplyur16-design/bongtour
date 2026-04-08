/**
 * Bong투어 휴먼 시뮬레이션 — 브라우저 자동화 (Stealth)
 * puppeteer-extra + puppeteer-extra-plugin-stealth
 * Anti-Bot Bypass: navigator.webdriver 제거, Human Pattern: 500~2000ms 지터 + 마우스 곡선 이동 후 클릭
 */

import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser, Page } from 'puppeteer'

puppeteer.use(StealthPlugin())

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 500ms~2000ms 랜덤 지연 (Human Pattern jitter) */
export function humanDelay(): Promise<void> {
  const ms = 500 + Math.floor(Math.random() * 1500)
  return new Promise((r) => setTimeout(r, ms))
}

/** 1.5초~3초 휴먼 딜레이 (내비게이션 단계 사이) */
export function humanDelayLong(): Promise<void> {
  const ms = 1500 + Math.floor(Math.random() * 1500)
  return new Promise((r) => setTimeout(r, ms))
}

/** 레거시 호환 */
export function randomDelay(): Promise<void> {
  return humanDelay()
}

/** 브라우저 실행 (stealth 필수, AutomationControlled 비활성화) */
export async function launchAgentBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    defaultViewport: { width: 1280, height: 800 },
  })
}

/** 새 페이지: User-Agent + navigator.webdriver 제거 (stealth 보완) */
export async function newAgentPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setUserAgent(DEFAULT_UA)
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  })
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  return page
}

/** 목표 요소로 부드러운 곡선 이동(다단계) 후 클릭 */
export async function humanMouseCurveThenClick(page: Page, selector: string): Promise<boolean> {
  const sel = selector.trim()
  const el = await page.$(sel)
  if (!el) return false
  const box = await el.boundingBox()
  if (!box) return false
  const targetX = box.x + box.width / 2
  const targetY = box.y + box.height / 2
  const steps = 8 + Math.floor(Math.random() * 5)
  const mouse = page.mouse
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const ease = t * (2 - t)
    const jitter = () => (Math.random() - 0.5) * 4
    const x = targetX * ease + jitter()
    const y = targetY * ease + jitter()
    await mouse.move(x, y, { steps: 2 })
    await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 40)))
  }
  await mouse.click(targetX, targetY)
  return true
}

/** 목표 요소로 곡선 이동 후 호버만 (클릭 없음). 영상 동선: 해외여행 메뉴 호버 */
export async function humanHover(page: Page, selector: string): Promise<boolean> {
  const sel = selector.trim()
  const el = await page.$(sel)
  if (!el) return false
  const box = await el.boundingBox()
  if (!box) return false
  const targetX = box.x + box.width / 2
  const targetY = box.y + box.height / 2
  const steps = 6 + Math.floor(Math.random() * 4)
  const mouse = page.mouse
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const ease = t * (2 - t)
    const jitter = () => (Math.random() - 0.5) * 4
    const x = targetX * ease + jitter()
    const y = targetY * ease + jitter()
    await mouse.move(x, y, { steps: 2 })
    await new Promise((r) => setTimeout(r, 40 + Math.floor(Math.random() * 50)))
  }
  await el.hover()
  return true
}

/** 요소가 보일 때까지 스크롤 (상품 리스트에서 타겟 찾기) */
export async function scrollIntoViewIfNeeded(page: Page, selector: string): Promise<boolean> {
  try {
    await page.evaluate((s) => {
      const el = document.querySelector(s)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, selector.trim())
    await new Promise((r) => setTimeout(r, 800))
    return true
  } catch {
    return false
  }
}

/** 페이지 전체 HTML에서 텍스트 요약 (LLM용, 길이 제한) */
export async function getPageSummary(page: Page, maxChars: number = 15000): Promise<string> {
  return page.evaluate((max) => {
    const body = document.body
    if (!body) return ''
    const text = body.innerText || body.textContent || ''
    return text.slice(0, max)
  }, maxChars)
}

/** 에러 시 스크린샷 저장 (public/errors) */
export async function captureErrorScreenshot(
  page: Page,
  stepName: string
): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'errors')
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    // ignore
  }
  const safeName = stepName.replace(/[^a-zA-Z0-9-_]/g, '_')
  const filename = `error-${safeName}-${Date.now()}.png`
  const filepath = path.join(dir, filename)
  await page.screenshot({ path: filepath, fullPage: false })
  return `/errors/${filename}`
}

/** 현재 화면을 base64로 캡처 (LLM 재시도용) */
export async function captureBase64(page: Page): Promise<string> {
  const buf = await page.screenshot({ encoding: 'base64', fullPage: false })
  return typeof buf === 'string' ? buf : Buffer.from(buf).toString('base64')
}
