import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const url =
  'https://www.hanjintravel.com/dp/display/displayDetail?gdsNo=KW36098&evtNo=OP20260417377'
const out = path.join(__dirname, '..', 'fixtures', 'hanjintour-kw36098-modal-debug.txt')

async function main() {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const lines: string[] = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120_000 })
    await new Promise((r) => setTimeout(r, 4000))
    const btnSample = (await page.evaluate(() => {
      const clickers = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'))
      const hits: string[] = []
      for (const el of clickers) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (/출발|변경|달력|예약|일정/.test(t) && t.length < 80) hits.push(`${el.tagName} ${t}`)
      }
      return hits.slice(0, 40)
    })) as string[]
    lines.push('--- buttons with 출발|변경|달력 ---')
    lines.push(...btnSample)

    const clicked = (await page.evaluate(() => {
      const clickers = Array.from(document.querySelectorAll('button, a, [role="button"]'))
      const openBtn = clickers.find((el) =>
        /출발일\s*변경/.test((el.textContent || '').replace(/\s+/g, ' '))
      )
      if (!openBtn) return false
      ;(openBtn as HTMLElement).click()
      return true
    })) as boolean
    lines.push(`clicked 출발일 변경: ${clicked}`)
    await new Promise((r) => setTimeout(r, 2500))
    const modalInfo = (await page.evaluate(() => {
      const modal =
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[class*="modal" i]') ||
        null
      if (!modal) return { found: false, text: '', htmlLen: 0 }
      return {
        found: true,
        text: (modal.textContent || '').slice(0, 6000),
        htmlLen: modal.outerHTML.length,
      }
    })) as { found: boolean; text: string; htmlLen: number }
    lines.push(`modal found: ${modalInfo.found} htmlLen: ${modalInfo.htmlLen}`)
    lines.push('--- modal text ---')
    lines.push(modalInfo.text)
  } finally {
    await browser.close()
  }
  fs.writeFileSync(out, lines.join('\n'), 'utf8')
  console.log('wrote', out)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
