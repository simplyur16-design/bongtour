/**
 * 본사(하나투어/모두투어 등) 실시간 동기화 스크래퍼.
 * Puppeteer + Stealth, 사람 속도 딜레이·세션별 UA.
 * 상품코드·단체번호로 접속해 예약상태/가격/출발확정 수집.
 */
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { humanDelay, pickRandomUserAgent } from '@/lib/scraper-throttle'

puppeteer.use(StealthPlugin())

export type ScrapeParams = {
  productCode: string
  groupNumber: string
  /** 본사 브랜드(Product.brand_name). 스크래핑 로봇이 이 값을 보고 어느 본사 사이트로 접속할지 판단해 baseUrl을 설정할 수 있음 */
  brandName?: string | null
  /** 본사 상품 상세 URL 패턴. {code}, {group} 치환. brandName에 따라 호출 전에 설정 권장 */
  baseUrl?: string
}

export type ScrapeResult = {
  productCode: string
  groupNumber: string
  bookingStatus: '예약가능' | '대기' | '마감' | null
  latestPrice: string | null
  departureFixed: boolean | null
  scrapedAt: string
}

const DEFAULT_BASE_URL = 'https://example.com/product?code={code}&group={group}'

export async function scrapeHqProduct(params: ScrapeParams): Promise<ScrapeResult> {
  const { productCode, groupNumber, baseUrl = DEFAULT_BASE_URL } = params
  const url = baseUrl
    .replace('{code}', encodeURIComponent(productCode))
    .replace('{group}', encodeURIComponent(groupNumber))

  await humanDelay(3000, 7000)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent(pickRandomUserAgent())
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    const result = await page.evaluate(() => {
      const body = document.body.innerText
      let bookingStatus: ScrapeResult['bookingStatus'] = null
      if (/예약\s*가능|예약가능/i.test(body)) bookingStatus = '예약가능'
      else if (/대기/i.test(body)) bookingStatus = '대기'
      else if (/마감|매진/i.test(body)) bookingStatus = '마감'

      const priceMatch = body.match(/(\d{1,3}(,\d{3})*)\s*원/)
      const latestPrice = priceMatch ? priceMatch[0] : null

      const departureFixed = /출발\s*확정|확정\s*출발/i.test(body)

      return { bookingStatus, latestPrice, departureFixed }
    })

    return {
      productCode,
      groupNumber,
      bookingStatus: result.bookingStatus,
      latestPrice: result.latestPrice,
      departureFixed: result.departureFixed,
      scrapedAt: new Date().toISOString(),
    }
  } finally {
    await browser.close()
  }
}
