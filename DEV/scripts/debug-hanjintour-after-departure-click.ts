import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const url =
  'https://www.hanjintravel.com/dp/display/displayDetail?gdsNo=KW36098&evtNo=OP20260417377'
const out = path.join(__dirname, '..', 'fixtures', 'hanjintour-kw36098-after-departure-click.txt')

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
    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) {
        let closed = false
        for (const dlg of Array.from(document.querySelectorAll('[role="dialog"]'))) {
          const tx = (dlg.textContent || '').replace(/\s+/g, ' ')
          if (/90일\s*뒤에\s*변경/.test(tx)) {
            const b = Array.from(dlg.querySelectorAll('button')).find((x) =>
              /90일\s*뒤에\s*변경/.test((x.textContent || '').replace(/\s+/g, ' '))
            )
            if (b) {
              ;(b as HTMLElement).click()
              closed = true
            }
          }
          if (/아이디/.test(tx) && /비밀번호/.test(tx)) {
            const b = Array.from(dlg.querySelectorAll('button')).find((x) =>
              /^닫기/u.test((x.textContent || '').trim())
            )
            if (b) {
              ;(b as HTMLElement).click()
              closed = true
            }
          }
        }
        if (!closed) break
        await new Promise((r) => setTimeout(r, 400))
      }
    })
    await page.evaluate(() => {
      const clickers = Array.from(document.querySelectorAll('button, a[href], [role="button"]'))
      const openBtn = clickers.find((el) => {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (t.length > 80) return false
        return /출발일\s*변경/.test(t)
      })
      ;(openBtn as HTMLElement)?.click()
    })
    await new Promise((r) => setTimeout(r, 3000))
    const blob = (await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
      const linesInner: string[] = []
      linesInner.push(`dialog_count=${dialogs.length}`)
      dialogs.forEach((d, i) => {
        const t = (d.textContent || '').replace(/\s+/g, ' ').trim()
        linesInner.push(`--- dialog ${i} len=${t.length} ---`)
        linesInner.push(t.slice(0, 12000))
      })
      return linesInner.join('\n')
    })) as string
    lines.push(blob)
    const cellInfo = (await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
      const modal =
        dialogs.find((d) => {
          const t = (d.textContent || '').replace(/\s+/g, ' ')
          return (
            (/년\s*\d{1,2}\s*월/u.test(t) || /월\s*간/u.test(t)) &&
            (/\d{1,3}(,\d{3})+\s*원/u.test(t) || /\d{4,7}\s*원/u.test(t))
          )
        }) || dialogs[dialogs.length - 1]
      if (!modal) return 'no modal'
      const cells = Array.from(modal.querySelectorAll('td, [role="gridcell"], button')).filter(
        (el) => {
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
          if (!/^\d{1,2}(\s|$)/u.test(t) && !/^\d{1,2}$/u.test(t)) return false
          return /\d{1,3}(,\d{3})+\s*원|\d{4,7}\s*원/u.test(t)
        }
      )
      return `priced_cells=${cells.length} sample=${cells
        .slice(0, 5)
        .map((c) => (c.textContent || '').replace(/\s+/g, '|').slice(0, 80))
        .join(' || ')}`
    })) as string
    lines.push(cellInfo)
  } finally {
    await browser.close()
  }
  fs.writeFileSync(out, lines.join('\n\n'), 'utf8')
  console.log('wrote', out)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
