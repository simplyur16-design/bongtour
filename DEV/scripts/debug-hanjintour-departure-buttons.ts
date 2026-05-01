import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const url =
  'https://www.hanjintravel.com/dp/display/displayDetail?gdsNo=KW36098&evtNo=OP20260417377'
const out = path.join(__dirname, '..', 'fixtures', 'hanjintour-kw36098-departure-buttons.txt')

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
    await new Promise((r) => setTimeout(r, 5000))
    const hits = (await page.evaluate(() => {
      const re = /출발일\s*변경/
      const clickers = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'))
      const out: { tag: string; text: string; cls: string; rect: string }[] = []
      for (const el of clickers) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (!re.test(t)) continue
        const r = (el as HTMLElement).getBoundingClientRect()
        out.push({
          tag: el.tagName,
          text: t.slice(0, 120),
          cls: (el.className && String(el.className).slice(0, 120)) || '',
          rect: `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.top)}`,
        })
      }
      return out
    })) as { tag: string; text: string; cls: string; rect: string }[]
    lines.push(`matches: ${hits.length}`)
    for (const h of hits) lines.push(JSON.stringify(h))
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
