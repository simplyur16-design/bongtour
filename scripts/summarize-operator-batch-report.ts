import fs from 'node:fs'

const raw = fs.readFileSync('scripts/data/operator-url-batch-2026-07-report.json', 'utf8')
const re = /"label": "([^"]+)"[\s\S]*?"ok": (true|false)/g
let m: RegExpExecArray | null
const rows: { label: string; ok: boolean }[] = []
while ((m = re.exec(raw))) {
  rows.push({ label: m[1]!, ok: m[2] === 'true' })
}
console.log('parsed', rows.length)
const passed = rows.filter((r) => r.ok)
const failed = rows.filter((r) => !r.ok)
console.log('PASSED', passed.length)
console.log('FAILED', failed.length)
console.log('\nPASSED:')
for (const r of passed) console.log(' ', r.label)
console.log('\nFAILED:')
for (const r of failed) console.log(' ', r.label)

const bySup: Record<string, { ok: number; fail: number }> = {}
for (const r of rows) {
  const sup = r.label.split('-')[0] ?? 'unknown'
  bySup[sup] = bySup[sup] ?? { ok: 0, fail: 0 }
  if (r.ok) bySup[sup].ok++
  else bySup[sup].fail++
}
console.log('\nBY_SUPPLIER', JSON.stringify(bySup, null, 2))

const issueTypes: Record<string, number> = {}
const issueRe = /"scheduleIssues": \[([\s\S]*?)\]/g
while ((m = issueRe.exec(raw))) {
  const block = m[1] ?? ''
  const items = [...block.matchAll(/"([^"]+)"/g)].map((x) => x[1] ?? '')
  for (const item of items) {
    const norm = item.replace(/^D\d+:\s*/, '').trim()
    if (!norm) continue
    issueTypes[norm] = (issueTypes[norm] ?? 0) + 1
  }
}
console.log('\nTOP_ISSUE_TYPES')
for (const [k, v] of Object.entries(issueTypes).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`${v}\t${k}`)
}

const errCases = [...raw.matchAll(/"label": "([^"]+)"[\s\S]*?"error": "(\[PEXELS[^"]+|[^"]{1,200})"/g)]
console.log('\nHARD_ERRORS', errCases.length)
for (const hit of errCases) console.log(hit[1], hit[2]?.slice(0, 100))
