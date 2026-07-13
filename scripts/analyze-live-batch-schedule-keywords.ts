/**
 * Aggregate 80-URL live-gate JSON → pass/fail + fix backlog.
 * npx tsx scripts/analyze-live-batch-schedule-keywords.ts scripts/data/live-batch-2026-07-12-r6.json
 */
import fs from 'node:fs'
import path from 'node:path'

type Row = {
  label: string
  supplier: string
  ok: boolean
  error?: string
  scheduleDays?: number
  scheduleIssues?: string[]
  schedule?: Array<{ day: number; routeText?: string; imageKeyword?: string; imageKeyword2?: string }>
}

const file = process.argv[2] || 'scripts/data/live-batch-2026-07-12-r6.json'
const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file)
const rows = JSON.parse(fs.readFileSync(abs, 'utf8')) as Row[]

const PROSE_RE =
  /간직한|선정된|대표하는|출신의|상태가\s*뛰어난|볼\s*수\s*있는|동상이\s*있는|선정한|박물관인|불리우|손꼽히|이루어진|빛나는|거행되었|만남의\s*장소|유일무이|다채로운|죽기전|약\s*\d+\s*시간|소요\]?|가이드\s*미팅/
const BRAZIL_RE = /brazil|브라질|christ\s*the\s*redeemer|sugar\s*loaf|rio\s*de\s*janeiro|corcovado/i
const PRAGUE_FILLER_RE = /Prague Castle Charles Bridge/i

const issueBucket = new Map<string, number>()
const bucket = (s: string) => {
  let k = s.replace(/^D\d+:\s*/, '')
  k = k.replace(/"[^"]+"/g, '…')
  k = k.replace(/\(이미 D\d+\)/g, '')
  k = k.trim().slice(0, 48)
  issueBucket.set(k, (issueBucket.get(k) || 0) + 1)
}

let proseDays = 0
let brazilBleed = 0
let pragueBleed = 0
let emptyKw = 0
let dupKw = 0
let parseErr = 0

const failSamples: string[] = []

for (const r of rows) {
  if (r.error && !r.error.startsWith('SKIP')) parseErr++
  for (const i of r.scheduleIssues || []) {
    bucket(i)
    if (/중복/.test(i)) dupKw++
    if (/비어/.test(i)) emptyKw++
    if (/Brazil|Rio|환각/.test(i)) brazilBleed++
  }
  for (const d of r.schedule || []) {
    const rt = d.routeText || ''
    if (PROSE_RE.test(rt)) proseDays++
    const kw = `${d.imageKeyword || ''} ${d.imageKeyword2 || ''}`
    if (BRAZIL_RE.test(kw) && !/브라질|Brazil|리우데|Rio\s*de|남미|중남미/i.test(rt + (r.label || ''))) {
      // weak: title not in row — count scheduleIssues only
    }
    if (PRAGUE_FILLER_RE.test(kw) && !/프라하|Prague|체코|크룸/i.test(rt)) pragueBleed++
  }
  if (!r.ok) {
    failSamples.push(
      `${r.supplier}\t${r.label}\t${(r.scheduleIssues || []).slice(0, 3).join(' | ') || r.error || 'fail'}`,
    )
  }
}

const pass = rows.filter((r) => r.ok).length
const bySupplier = new Map<string, { pass: number; total: number }>()
for (const r of rows) {
  const s = bySupplier.get(r.supplier) || { pass: 0, total: 0 }
  s.total++
  if (r.ok) s.pass++
  bySupplier.set(r.supplier, s)
}

console.log(JSON.stringify({
  file: abs,
  total: rows.length,
  pass,
  fail: rows.length - pass,
  passRate: `${pass}/${rows.length}`,
  metrics: { proseDays, pragueBleed, emptyKwIssues: emptyKw, dupKwIssues: dupKw, parseErr },
  bySupplier: Object.fromEntries(bySupplier),
  topIssues: [...issueBucket.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
  fails: failSamples,
}, null, 2))
