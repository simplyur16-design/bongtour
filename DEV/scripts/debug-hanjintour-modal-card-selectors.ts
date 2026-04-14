import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const url =
  'https://www.hanjintravel.com/dp/display/displayDetail?gdsNo=KW36098&evtNo=OP20260417377'
const out = path.join(__dirname, '..', 'fixtures', 'hanjintour-kw36098-card-selectors.txt')

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
    const info = (await page.evaluate(function () {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
      let modal = null
      for (let i = 0; i < dialogs.length; i++) {
        const d = dialogs[i]
        const t = (d.textContent || '').replace(/\s+/g, ' ')
        if ((/년\s*\d{1,2}\s*월/u.test(t) || /26\.04/u.test(t)) && (/만/u.test(t) || /원/u.test(t))) {
          modal = d
          break
        }
      }
      if (!modal) return 'no calendar modal'
      const lines = []
      lines.push('예약인원 divs: ' + modal.querySelectorAll('div').length)
      const allDivs = Array.from(modal.querySelectorAll('div'))
      const withRes = []
      for (let i = 0; i < allDivs.length; i++) {
        const d = allDivs[i]
        if (/예약인원/.test((d.textContent || '').replace(/\s+/g, ' '))) withRes.push(d)
      }
      lines.push('divs containing 예약인원: ' + withRes.length)
      for (let i = 0; i < Math.min(6, withRes.length); i++) {
        const d = withRes[i]
        lines.push(
          '--- sample tag=' +
            d.tagName +
            ' cls=' +
            String(d.className).slice(0, 80) +
            ' text=' +
            (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220)
        )
      }
      const cand = Array.from(modal.querySelectorAll('button, td, [role="gridcell"]'))
      const withPrice = []
      for (let i = 0; i < cand.length; i++) {
        const el = cand[i]
        if (/\d+\s*만/u.test((el.textContent || '').replace(/\s+/g, ' '))) withPrice.push(el)
      }
      lines.push('cells with N만: ' + withPrice.length)
      for (let i = 0; i < Math.min(8, withPrice.length); i++) {
        lines.push('cell: ' + (withPrice[i].textContent || '').replace(/\s+/g, '|').slice(0, 60))
      }
      return lines.join('\n')
    })) as string
    lines.push(info)
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
