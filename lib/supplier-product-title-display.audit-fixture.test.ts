import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSupplierRegisterListingTitle } from '@/lib/supplier-product-title-display'

const FIXTURE = path.join(__dirname, '__fixtures__', 'title-audit-1026-original-titles.tsv')

/** plan-b-v6 strip targets that must not remain in cleaned titles */
const FORBIDDEN_RESIDUE = [
  /출발\s*확정/,
  /출발\s*임박/,
  /마감\s*임박/,
  /매진\s*임박/,
  /대기\s*예약/,
  /예약\s*마감/,
  /판매\s*마감/,
  /집중\s*모객/,
  /얼리\s*마켓/,
  /여행\s*핫딜/,
  /옐로\s*팡딜/,
  /특별\s*기획/,
  /하나\s*LIVE/i,
  /CJ\s*온\s*스타일/,
  /SK\s*스토아/,
  /SK\s*스토어/,
  /롯데관광\s*'?\s*단독/,
  /웹\s*예약\s*\d+\s*만\s*원\s*할인/,
  /NO\s*유류\s*인상/i,
  /유류\s*인상\s*NO/i,
  /유류\s*세\s*(?:ZERO|제로)/i,
  /특가/,
  /(?:^|\s)(?:HIT|BEST)(?:\s|$)/i,
]

const KEEP_IF_PRESENT_IN_ORIGINAL: Array<{ re: RegExp; label: string }> = [
  { re: /\b(?:KE|OZ|7C|TW|LJ)\b/, label: 'airline code' },
  { re: /노쇼핑|노옵션|NO쇼핑|NO옵션/i, label: 'no-shopping/option' },
  { re: /특급호텔/, label: '특급호텔' },
  { re: /\[청주출발\]|\[대구출발\]|\[부산출발\]|청주출발/, label: 'departure city' },
  { re: /\[2030전용\]/, label: '2030전용' },
  { re: /\[비즈니스\]/, label: '비즈니스' },
  { re: /\[Semi-프리미엄/, label: 'Semi-프리미엄' },
]

function loadFixtureRows(): Array<{ supplier: string; originalTitle: string }> {
  const text = fs.readFileSync(FIXTURE, 'utf8')
  const rows: Array<{ supplier: string; originalTitle: string }> = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const supplier = line.slice(0, tab)
    const originalTitle = line.slice(tab + 1)
    if (supplier === 'supplier') continue
    rows.push({ supplier, originalTitle })
  }
  return rows
}

describe('plan-b-v6 audit fixture regression (title-audit-1026)', () => {
  const rows = loadFixtureRows()

  it('loads 374 original titles (no product codes)', () => {
    expect(rows.length).toBe(374)
    expect(fs.readFileSync(FIXTURE, 'utf8')).not.toMatch(/\tCTP|\tJCC|\tD02/)
  })

  it('cleans every originalTitle without forbidden residue or broken wrappers', () => {
    expect(rows.length).toBeGreaterThan(100)
    for (const { supplier, originalTitle } of rows) {
      const cleaned = normalizeSupplierRegisterListingTitle(originalTitle)
      expect(cleaned, `${supplier}: empty`).toBeTruthy()
      expect(cleaned, `${supplier}: starts with sep`).not.toMatch(/^[\/_+,]/)
      expect(cleaned, `${supplier}: empty brackets`).not.toMatch(/\[\s*\]|\(\s\)|【\s*】/)
      expect(cleaned, `${supplier}: double space`).not.toMatch(/  /)

      for (const re of FORBIDDEN_RESIDUE) {
        re.lastIndex = 0
        if (re.test(cleaned)) {
          expect.fail(`${supplier}: forbidden ${re} still in: ${cleaned}`)
        }
      }

      for (const { re, label } of KEEP_IF_PRESENT_IN_ORIGINAL) {
        re.lastIndex = 0
        if (!re.test(originalTitle)) continue
        // 원문에 있던 keep 토큰이 프로모 배지 안에만 있던 경우는 제외하지 않음 — 토큰 자체가 keep
        re.lastIndex = 0
        if (label === 'airline code' || label === 'no-shopping/option' || label === '특급호텔') {
          re.lastIndex = 0
          expect(cleaned, `${supplier}: lost ${label}`).toMatch(re)
        }
        if (label === '2030전용' || label === 'Semi-프리미엄') {
          re.lastIndex = 0
          expect(cleaned, `${supplier}: lost ${label}`).toMatch(re)
        }
        if (label === 'departure city' && /\[(?:청주|대구|부산)출발\]/.test(originalTitle)) {
          expect(cleaned, `${supplier}: lost departure city tag`).toMatch(
            /\[(?:청주|대구|부산)출발\]|(?:청주|대구|부산)출발/,
          )
        }
        if (label === '비즈니스' && /\[비즈니스\]/.test(originalTitle)) {
          expect(cleaned, `${supplier}: lost [비즈니스]`).toContain('[비즈니스]')
        }
      }
    }
  })
})
