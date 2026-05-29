/**
 * verygoodtour registered — 빈·실패 슬롯만 imageKeyword/imageKeyword2 배치 LLM hotfix.
 * accept 통과 kw1은 절대 변경하지 않음.
 *
 * 실행:
 *   npx tsx scripts/backfill-verygoodtour-image-keywords.ts
 *   npx tsx scripts/backfill-verygoodtour-image-keywords.ts --apply
 *   npx tsx scripts/backfill-verygoodtour-image-keywords.ts --product-id=xxx
 *   npx tsx scripts/backfill-verygoodtour-image-keywords.ts --json-out=scripts/.tmp-verygood-kw-dry-run.json
 */
import './load-env-for-scripts'

import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'
import { prisma } from '@/lib/prisma'
import { REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK } from '@/lib/register-schedule-image-keyword-prompt'
import { VERYGOOD_SCHEDULE_IMAGE_KEYWORD_PROMPT_ADDENDUM } from '@/lib/register-schedule-extract-verygoodtour'
import {
  applyVerygoodScheduleImageKeywordsToRows,
  classifyVerygoodDayKind,
  extractVerygoodOrderedDayPoi,
  resolveVerygoodPrimaryKeyword,
  resolveVerygoodSecondaryKeyword,
  type VerygoodDayKind,
} from '@/lib/verygoodtour-schedule-image-keyword'

const LLM_SLEEP_MS = Math.max(500, Number(process.env.VERYGOOD_KW_BACKFILL_SLEEP_MS) || 1200)
const MAX_OUTPUT_TOKENS = Math.max(2048, Math.min(16384, Number(process.env.VERYGOOD_KW_BACKFILL_MAX_TOKENS) || 8192))

type ScheduleRow = Record<string, unknown> & {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

type DaySlotPlan = {
  day: number
  dayKind: VerygoodDayKind
  needsKw1: boolean
  needsKw2: boolean
  acceptedKw1: string
  acceptedKw2: string | null
  rawKw1: string | null
  rawKw2: string | null
}

type DayChange = {
  productId: string
  day: number
  dayKind: VerygoodDayKind
  changeKind: 'kw1-filled' | 'kw2-filled' | 'kw1-and-kw2-filled' | 'unchanged'
  before: { imageKeyword: string | null; imageKeyword2: string | null; effectiveKw1: string; effectiveKw2: string | null }
  after: { imageKeyword: string | null; imageKeyword2: string | null; effectiveKw1: string; effectiveKw2: string | null }
}

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply')
  let productId: string | null = null
  let jsonOut: string | null = null
  for (const a of argv) {
    const pid = /^--product-id=(.+)$/.exec(a)
    if (pid) productId = pid[1]!.trim()
    const jo = /^--json-out=(.+)$/.exec(a)
    if (jo) jsonOut = jo[1]!.trim()
  }
  return { apply, productId, jsonOut }
}

function parseSchedule(raw: string | null): ScheduleRow[] {
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.map((x, i) => {
      const o = (x ?? {}) as Record<string, unknown>
      return {
        ...o,
        day: Number(o.day) || i + 1,
        title: o.title != null ? String(o.title) : '',
        description: o.description != null ? String(o.description) : '',
        routeText: o.routeText != null ? String(o.routeText) : null,
        imageKeyword: o.imageKeyword != null ? String(o.imageKeyword) : null,
        imageKeyword2: o.imageKeyword2 != null ? String(o.imageKeyword2) : null,
      }
    })
  } catch {
    return []
  }
}

function planDaySlots(rows: ScheduleRow[], dest: string | null): DaySlotPlan[] {
  const totalDays = rows.length
  return rows.map((row) => {
    const dayKind = classifyVerygoodDayKind(
      String(row.description ?? ''),
      String(row.title ?? ''),
      row.day,
      totalDays,
      row.routeText ?? null,
    )
    const acceptedKw1 = resolveVerygoodPrimaryKeyword(row, dayKind, dest)
    const acceptedKw2 = resolveVerygoodSecondaryKeyword(row, acceptedKw1, dayKind, dest)
    const needsKw1 = !acceptedKw1
    const needsKw2 = dayKind === 'touring' && !acceptedKw2
    return {
      day: row.day,
      dayKind,
      needsKw1,
      needsKw2,
      acceptedKw1,
      acceptedKw2,
      rawKw1: String(row.imageKeyword ?? '').trim() || null,
      rawKw2: String(row.imageKeyword2 ?? '').trim() || null,
    }
  })
}

function buildFillSlotsPrompt(input: {
  productId: string
  title: string
  destination: string | null
  days: Array<{
    day: number
    title: string
    description: string
    routeText: string | null
    dayKind: VerygoodDayKind
    poiHints: string[]
    fillKw1: boolean
    fillKw2: boolean
    keepKw1: string | null
  }>
}): string {
  const dayLines = input.days
    .map((d) => {
      const pois = d.poiHints.length ? d.poiHints.join(', ') : '-'
      const fill =
        d.fillKw1 && d.fillKw2
          ? 'imageKeyword + imageKeyword2'
          : d.fillKw1
            ? 'imageKeyword only (imageKeyword2 출력 금지·null)'
            : 'imageKeyword2 only (imageKeyword 출력 금지·기존 유지)'
      return (
        `- day ${d.day} [${d.dayKind}] fill: ${fill}\n` +
        (d.keepKw1 ? `  keep imageKeyword (do not change): ${JSON.stringify(d.keepKw1)}\n` : '') +
        `  title=${JSON.stringify(d.title)}\n` +
        `  description: ${d.description.slice(0, 600)}\n` +
        `  routeText: ${d.routeText ?? 'null'}\n` +
        `  poiHints(참고): ${pois}`
      )
    })
    .join('\n')

  return (
    `# Role: verygoodtour — 빈 슬롯만 imageKeyword/imageKeyword2 채우기\n` +
    `출력 JSON: {"scheduleKeywords":[{"day":number,"imageKeyword"?:string,"imageKeyword2"?:string|null},...]}\n` +
    `아래 나열된 day만 출력. 나열 day 수 = scheduleKeywords 길이 (${input.days.length}).\n\n` +
    `${REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK}\n\n` +
    `# verygoodtour 전용\n${VERYGOOD_SCHEDULE_IMAGE_KEYWORD_PROMPT_ADDENDUM}\n\n` +
    `# hotfix 규칙\n` +
    `- **fill: imageKeyword only** → imageKeyword2 키 생략 또는 null. 기존 kw1 유지 day는 출력에 포함하지 않음.\n` +
    `- **fill: imageKeyword2 only** → imageKeyword 키 생략. keep imageKeyword 절대 덮어쓰지 말 것.\n` +
    `- 한글 키워드 금지. 영문 landmark·고유명만.\n` +
    `- [touring] + fill imageKeyword2 → 1순위와 다른 2순위 명소 영문 필수.\n\n` +
    `# 상품\nproductId: ${input.productId}\ntitle: ${input.title}\ndestination: ${input.destination ?? 'null'}\n\n` +
    `# 채울 일차\n${dayLines}\n`
  )
}

async function callGeminiFillSlots(
  prompt: string,
): Promise<Map<number, { imageKeyword?: string; imageKeyword2?: string | null }>> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY(또는 GOOGLE_API_KEY)가 설정되어 있지 않습니다.')

  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const result = await model.generateContent(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
      },
    },
    geminiTimeoutOpts(120_000),
  )
  const text = result.response.text()
  const parsed = parseLlmJsonObject<{ scheduleKeywords?: unknown }>(text, {
    logLabel: 'backfill-verygoodtour-image-keywords',
  })
  const rows = Array.isArray(parsed.scheduleKeywords) ? parsed.scheduleKeywords : []
  const out = new Map<number, { imageKeyword?: string; imageKeyword2?: string | null }>()
  for (const r of rows) {
    const rec = r as Record<string, unknown>
    const day = Number(rec.day)
    if (!day || day < 1) continue
    const entry: { imageKeyword?: string; imageKeyword2?: string | null } = {}
    if (rec.imageKeyword != null && String(rec.imageKeyword).trim()) {
      entry.imageKeyword = String(rec.imageKeyword).trim()
    }
    if ('imageKeyword2' in rec) {
      const kw2raw = rec.imageKeyword2
      entry.imageKeyword2 =
        kw2raw == null || String(kw2raw).trim() === '' || String(kw2raw).trim().toLowerCase() === 'null'
          ? null
          : String(kw2raw).trim()
    }
    out.set(day, entry)
  }
  return out
}

function mergeFillSlots(
  rows: ScheduleRow[],
  plans: DaySlotPlan[],
  llmByDay: Map<number, { imageKeyword?: string; imageKeyword2?: string | null }>,
  dest: string | null,
): ScheduleRow[] {
  const planByDay = new Map(plans.map((p) => [p.day, p]))
  const merged = rows.map((row) => {
    const plan = planByDay.get(row.day)!
    const llm = llmByDay.get(row.day)
    let imageKeyword = row.imageKeyword
    let imageKeyword2 = row.imageKeyword2

    if (plan.needsKw1) {
      if (llm?.imageKeyword) imageKeyword = llm.imageKeyword
    } else {
      imageKeyword = row.imageKeyword
    }

    if (plan.needsKw2) {
      if (llm && 'imageKeyword2' in llm) imageKeyword2 = llm.imageKeyword2 ?? null
    } else {
      imageKeyword2 = row.imageKeyword2
    }

    return { ...row, imageKeyword, imageKeyword2 }
  })

  return applyVerygoodScheduleImageKeywordsToRows(merged, {
    productDestination: dest,
    totalDays: merged.length,
  }) as ScheduleRow[]
}

function effectiveKws(row: ScheduleRow, dest: string | null, totalDays: number) {
  const dayKind = classifyVerygoodDayKind(
    String(row.description ?? ''),
    String(row.title ?? ''),
    row.day,
    totalDays,
    row.routeText ?? null,
  )
  const kw1 = resolveVerygoodPrimaryKeyword(row, dayKind, dest)
  const kw2 = resolveVerygoodSecondaryKeyword(row, kw1, dayKind, dest)
  return { kw1, kw2, dayKind }
}

function buildDayChanges(
  before: ScheduleRow[],
  after: ScheduleRow[],
  plans: DaySlotPlan[],
  productId: string,
  dest: string | null,
): DayChange[] {
  const totalDays = before.length
  const out: DayChange[] = []
  for (let i = 0; i < totalDays; i++) {
    const b = before[i]!
    const a = after[i]!
    const plan = plans[i]!
    const bEff = effectiveKws(b, dest, totalDays)
    const aEff = effectiveKws(a, dest, totalDays)
    const kw1Filled = plan.needsKw1 && !!aEff.kw1 && aEff.kw1 !== bEff.kw1
    const kw2Filled = plan.needsKw2 && !!aEff.kw2 && aEff.kw2 !== bEff.kw2
    if (!kw1Filled && !kw2Filled) continue

    let changeKind: DayChange['changeKind'] = 'unchanged'
    if (kw1Filled && kw2Filled) changeKind = 'kw1-and-kw2-filled'
    else if (kw1Filled) changeKind = 'kw1-filled'
    else if (kw2Filled) changeKind = 'kw2-filled'

    out.push({
      productId,
      day: b.day,
      dayKind: plan.dayKind,
      changeKind,
      before: {
        imageKeyword: String(b.imageKeyword ?? '').trim() || null,
        imageKeyword2: String(b.imageKeyword2 ?? '').trim() || null,
        effectiveKw1: bEff.kw1,
        effectiveKw2: bEff.kw2,
      },
      after: {
        imageKeyword: String(a.imageKeyword ?? '').trim() || null,
        imageKeyword2: String(a.imageKeyword2 ?? '').trim() || null,
        effectiveKw1: aEff.kw1,
        effectiveKw2: aEff.kw2,
      },
    })
  }
  return out
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const { apply, productId, jsonOut } = parseArgs(process.argv.slice(2))
  const mode = apply ? 'apply' : 'dry-run'

  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      ...(productId ? { id: productId } : {}),
      OR: [{ originSource: 'verygoodtour' }, { brand: { brandKey: 'verygoodtour' } }],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      primaryDestination: true,
      destination: true,
      schedule: true,
    },
  })

  if (products.length === 0) {
    console.error('[backfill-verygoodtour-image-keywords] 대상 상품 없음')
    process.exit(1)
  }

  let totalDays = 0
  let kw1Kept = 0
  let kw1LlmSlots = 0
  let kw2LlmSlots = 0
  let kw1Filled = 0
  let kw2Filled = 0
  let llmCalls = 0
  let llmFailures = 0
  const productResults: Array<Record<string, unknown>> = []
  const backups: Array<{ productId: string; scheduleBefore: string }> = []
  const allChanges: DayChange[] = []

  for (let pi = 0; pi < products.length; pi++) {
    const p = products[pi]!
    const dest = p.primaryDestination ?? p.destination ?? null
    const beforeRows = parseSchedule(p.schedule)
    if (beforeRows.length === 0) {
      productResults.push({ productId: p.id, days: 0, llmOk: false, llmError: 'empty schedule' })
      continue
    }
    totalDays += beforeRows.length

    const plans = planDaySlots(beforeRows, dest)
    for (const plan of plans) {
      if (!plan.needsKw1 && plan.acceptedKw1) kw1Kept++
      if (plan.needsKw1) kw1LlmSlots++
      if (plan.needsKw2) kw2LlmSlots++
    }

    const daysToFill = plans.filter((plan) => plan.needsKw1 || plan.needsKw2)
    let afterRows = beforeRows
    let llmOk = true
    let llmError: string | undefined

    if (daysToFill.length > 0) {
      const promptDays = daysToFill.map((plan) => {
        const row = beforeRows.find((r) => r.day === plan.day)!
        return {
          day: plan.day,
          title: String(row.title ?? ''),
          description: String(row.description ?? ''),
          routeText: row.routeText ?? null,
          dayKind: plan.dayKind,
          poiHints: extractVerygoodOrderedDayPoi(String(row.description ?? ''), String(row.title ?? '')),
          fillKw1: plan.needsKw1,
          fillKw2: plan.needsKw2,
          keepKw1: !plan.needsKw1 && plan.acceptedKw1 ? plan.acceptedKw1 : null,
        }
      })

      try {
        console.log(
          `[backfill-verygoodtour-image-keywords] LLM ${pi + 1}/${products.length} product=${p.id} slots=${daysToFill.length}`,
        )
        llmCalls++
        const llmByDay = await callGeminiFillSlots(
          buildFillSlotsPrompt({
            productId: p.id,
            title: p.title ?? '',
            destination: dest,
            days: promptDays,
          }),
        )
        if (llmByDay.size < daysToFill.length) {
          console.warn(
            `[backfill-verygoodtour-image-keywords] LLM returned ${llmByDay.size}/${daysToFill.length} days for ${p.id}`,
          )
        }
        afterRows = mergeFillSlots(beforeRows, plans, llmByDay, dest)
      } catch (e) {
        llmOk = false
        llmError = e instanceof Error ? e.message : String(e)
        llmFailures++
        console.error(`[backfill-verygoodtour-image-keywords] LLM fail product=${p.id}:`, llmError)
      }

      if (pi < products.length - 1 && llmOk) await sleep(LLM_SLEEP_MS)
    }

    const dayChanges = buildDayChanges(beforeRows, afterRows, plans, p.id, dest)
    allChanges.push(...dayChanges)
    for (const c of dayChanges) {
      if (c.changeKind === 'kw1-filled' || c.changeKind === 'kw1-and-kw2-filled') kw1Filled++
      if (c.changeKind === 'kw2-filled' || c.changeKind === 'kw1-and-kw2-filled') kw2Filled++
    }

    const wouldUpdate = llmOk && dayChanges.length > 0
    productResults.push({
      productId: p.id,
      title: (p.title ?? '').slice(0, 80),
      destination: dest,
      days: beforeRows.length,
      llmOk,
      llmError,
      kw1Kept: plans.filter((x) => !x.needsKw1 && x.acceptedKw1).length,
      kw1LlmSlots: plans.filter((x) => x.needsKw1).length,
      kw2LlmSlots: plans.filter((x) => x.needsKw2).length,
      dayChanges,
      wouldUpdate,
    })

    if (apply && wouldUpdate && p.schedule) {
      backups.push({ productId: p.id, scheduleBefore: p.schedule })
      await prisma.product.update({
        where: { id: p.id },
        data: { schedule: JSON.stringify(afterRows) },
      })
    }
  }

  const filledChanges = allChanges.filter((c) => c.changeKind !== 'unchanged')
  const samplesKept = productResults
    .filter((pr) => (pr.kw1Kept as number) > 0 && (pr.dayChanges as DayChange[]).length === 0)
    .slice(0, 1)
    .map((pr) => ({
      type: 'kw1-kept-no-change' as const,
      productId: pr.productId,
      kw1Kept: pr.kw1Kept,
    }))

  const samplesFilled = filledChanges.slice(0, 4)
  const samplesMixed: Array<Record<string, unknown>> = [...samplesKept]
  const firstKeptWithChanges = productResults.find(
    (pr) => (pr.kw1Kept as number) > 0 && (pr.dayChanges as DayChange[]).some((c) => c.changeKind.includes('kw2')),
  )
  if (firstKeptWithChanges) {
    const pid = firstKeptWithChanges.productId
    const keptPlan = productResults.find((p) => p.productId === pid)
    samplesMixed.push({
      type: 'kw1-kept-kw2-filled',
      productId: pid,
      kw1Kept: keptPlan?.kw1Kept,
      kw2Filled: (keptPlan?.dayChanges as DayChange[]).filter((c) => c.changeKind.includes('kw2')),
    })
  }
  samplesMixed.push(...samplesFilled.map((c) => ({ type: 'slot-filled', ...c })))

  const report = {
    mode,
    strategy: 'fill-empty-slots-only',
    generatedAt: new Date().toISOString(),
    model: getModelName(),
    summary: {
      products: products.length,
      scheduleDays: totalDays,
      kw1KeptAcceptPass: kw1Kept,
      kw1LlmTargetSlots: kw1LlmSlots,
      kw2LlmTargetSlots: kw2LlmSlots,
      kw1FilledAfterMerge: kw1Filled,
      kw2FilledAfterMerge: kw2Filled,
      totalSlotUpdates: filledChanges.length,
      llmCalls,
      llmFailures,
      productsWouldUpdate: productResults.filter((p) => p.wouldUpdate).length,
      dbUpdated: apply ? backups.length : 0,
    },
    samples: samplesMixed.slice(0, 5),
    products: productResults,
    pexelsReprocessNote:
      'Product.schedule UPDATE만. Pexels/process-images 자동 cron 없음 — 수동 트리거 필요.',
  }

  const outPath = jsonOut ?? join(process.cwd(), 'scripts', `.tmp-verygood-kw-${mode}.json`)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

  if (apply && backups.length > 0) {
    const backupPath = join(
      process.cwd(),
      'scripts',
      `.tmp-verygood-kw-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    )
    writeFileSync(backupPath, JSON.stringify({ backups, report: report.summary }, null, 2), 'utf8')
    console.log('[backfill-verygoodtour-image-keywords] backup:', backupPath)
  }

  console.log(JSON.stringify(report, null, 2))
  console.log(`\n[backfill-verygoodtour-image-keywords] report written: ${outPath}`)

  await prisma.$disconnect()
  if (llmFailures > 0 && !apply) process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
