/**
 * 한진 상세 URL에서 렌더 후 body.innerText 덤프 (base parser 검증용).
 * npx tsx DEV/scripts/dump-hanjintour-page-text.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const url =
  'https://www.hanjintravel.com/dp/display/displayDetail?gdsNo=KW36098&evtNo=OP20260417377'
const out = path.join(__dirname, '..', 'fixtures', 'hanjintour-kw36098-body-innerText.txt')

async function main() {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120_000 })
    await new Promise((r) => setTimeout(r, 5000))
    const text = (await page.evaluate(() => document.body.innerText || '')) as string
    fs.writeFileSync(out, text, 'utf8')
    console.log('wrote', out, 'chars', text.length)
    console.log(text.slice(0, 1500))
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
