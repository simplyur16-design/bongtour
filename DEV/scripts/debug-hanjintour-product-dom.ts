import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const url =
  'https://www.hanjintravel.com/dp/display/displayDetail?gdsNo=KW36098&evtNo=OP20260417377'
const out = path.join(__dirname, '..', 'fixtures', 'hanjintour-kw36098-product-dom.txt')

async function main() {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  let text = ''
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
      const openBtn = clickers.find(function (el) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (t.length > 80) return false
        return /출발일\s*변경/.test(t)
      })
      if (openBtn) (openBtn as HTMLElement).click()
    })
    await new Promise((r) => setTimeout(r, 3000))
    text = (await page.evaluate(function () {
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
      if (!modal) return 'no modal'
      const wrap = modal.querySelector('.change-date__products')
      if (!wrap) return 'no change-date__products'
      const lines = []
      lines.push('children of change-date__products: ' + wrap.children.length)
      const inner = wrap.querySelector('.product-event__wrap')
      if (inner) {
        lines.push('product-event__wrap children: ' + inner.children.length)
        for (let i = 0; i < inner.children.length; i++) {
          const c = inner.children[i]
          lines.push(
            '  inner ' +
              i +
              ' tag=' +
              c.tagName +
              ' cls=' +
              String(c.className).slice(0, 120) +
              ' text=' +
              (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500)
          )
        }
      }
      const cand = wrap.querySelectorAll('[class*="product"]')
      lines.push('nodes with class containing product: ' + cand.length)
      for (let i = 0; i < Math.min(15, cand.length); i++) {
        const c = cand[i]
        lines.push(
          '  cand ' +
            i +
            ' cls=' +
            String(c.className).slice(0, 100) +
            ' len=' +
            (c.textContent || '').length
        )
      }
      return lines.join('\n')
    })) as string
  } finally {
    await browser.close()
  }
  fs.writeFileSync(out, text, 'utf8')
  console.log('wrote', out)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
