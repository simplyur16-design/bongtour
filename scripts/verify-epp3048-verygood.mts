/**
 * EPP3048-260715 첨부 원문 → parseForRegisterVerygoodtour(preview) 검증
 *   npx tsx scripts/verify-epp3048-verygood.mts [path-to-body.txt]
 */
import { existsSync, readFileSync } from 'node:fs'

function loadEnvLocal() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (process.env[k] === undefined) process.env[k] = v
    }
  } catch {
    /* no .env.local */
  }
}
loadEnvLocal()

import { parseForRegisterVerygoodtour } from '../lib/register-parse-verygoodtour.ts'
import { registerScheduleToDayInputs } from '../lib/upsert-itinerary-days-verygoodtour.ts'

const path = process.argv[2] ?? 'scripts/epp3048-body.txt'
if (!existsSync(path)) {
  console.error(JSON.stringify({ error: 'missing body file', path }))
  process.exit(1)
}

const text = readFileSync(path, 'utf8')
const t0 = Date.now()

const parsed = await parseForRegisterVerygoodtour(text, 'EPP3048-260715', {
  forPreview: true,
  originUrl: 'https://www.verygoodtour.com/Goods/GoodsDetail.asp?code=EPP3048-260715',
  skipDetailSectionGeminiRepairs: true,
  maxDetailSectionRepairs: 0,
})

let optionalRowsCount = 0
const optionalRowsSample: string[] = []
try {
  const s = parsed.optionalToursStructured?.trim()
  if (s) {
    const j = JSON.parse(s) as unknown
    if (Array.isArray(j)) {
      optionalRowsCount = j.length
      for (const row of j.slice(0, 5)) {
        optionalRowsSample.push(JSON.stringify(row).slice(0, 200))
      }
    }
  }
} catch {
  optionalRowsCount = -1
}

const itineraryDayDraftsLength = registerScheduleToDayInputs(parsed.schedule ?? []).length

console.log(
  JSON.stringify(
    {
      ms: Date.now() - t0,
      includedItems: parsed.includedItems ?? [],
      excludedItems: parsed.excludedItems ?? [],
      mustKnowItems: parsed.mustKnowItems ?? [],
      itineraryDayDraftsLength,
      scheduleLen: parsed.schedule?.length ?? 0,
      optionalRowsCount,
      optionalRowsSample,
      hasOptionalTour: parsed.hasOptionalTour,
      originCode: parsed.originCode,
    },
    null,
    2
  )
)
