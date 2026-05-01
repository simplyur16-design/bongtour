/** 사람처럼 보이는 요청/페이지 간 딜레이 (Puppeteer·Node 스크래퍼용) */

export async function humanDelay(minMs = 2000, maxMs = 4000): Promise<void> {
  const lo = Math.min(minMs, maxMs)
  const hi = Math.max(minMs, maxMs)
  const delay = Math.floor(Math.random() * (hi - lo + 1)) + lo
  await new Promise((resolve) => setTimeout(resolve, delay))
}

export async function pageTransitionDelay(): Promise<void> {
  await humanDelay(3000, 5000)
}

export async function dateClickDelay(): Promise<void> {
  await humanDelay(2000, 3000)
}

export async function productTransitionDelay(): Promise<void> {
  await humanDelay(4000, 7000)
}

export async function siteSwitchDelay(): Promise<void> {
  await humanDelay(8000, 15000)
}

export const SCRAPER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
] as const

export function pickRandomUserAgent(): string {
  const list = SCRAPER_USER_AGENTS
  return list[Math.floor(Math.random() * list.length)]!
}
