/**
 * REGRESSION-FREEZE[hanatour-schedule-image-keyword-landmark]: detailBody schedule_section → 일차별 원문 — manifest
 * 클라이언트 등록 미리보기·서버 augment 공통 SSOT (gemini/parse-and-register 무import).
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser-types'

function isHanatourScheduleMetaSectionHead(rest: string): boolean {
  const t = rest.trim()
  return /^(여행일정 변경에 관한|사전 동의안내|가이드\/인솔자 및 미팅정보|가이드\/인솔자|여행 시 유의사항|출입국 카드 정보)/.test(
    t,
  )
}

function isHanatourStandaloneMetaScheduleLine(line: string): boolean {
  const t = line.trim()
  return /^(여행일정 변경에 관한|사전 동의안내|가이드\/인솔자 및 미팅정보|가이드\/인솔자|여행 시 유의사항|출입국 카드 정보)/.test(
    t,
  )
}

function scoreHanatourScheduleChunkBody(body: string): number {
  const t = body.trim()
  if (!t) return 0
  const ls = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const head = [ls[0] ?? '', ls[1] ?? '', ls[2] ?? ''].join('\n').slice(0, 200)
  const dateLike = /\d{1,2}\/\d{1,2}\s*\([월화수목금토일]\)/.test(head)
  let score = (dateLike ? 100_000 : 0) + Math.min(t.length, 50_000)
  if (/(소호|SoHo|성\s*바울|Ruins|웡타이신|Wong\s*Tai|빅토리아\s*피크|Victoria\s*Peak|타이쿤|Tai\s*Kwun)/iu.test(t)) {
    score += 50_000
  }
  return score
}

/** 일차 헤더(1일차·DAY 1) 기준으로 본문 블록을 일차별 Map으로 쪼갠다. */
export function gatherHanatourScheduleSectionBodiesByDayFromText(text: string): Map<number, string> {
  const lines = String(text ?? '')
    .trim()
    .split(/\r?\n/)
  if (!lines.some((l) => /^\s*\d{1,2}\s*일차/i.test(l) || /^\s*DAY\s*\d{1,2}\b/i.test(l))) {
    return new Map()
  }

  const stripDayHeader = (line: string): string =>
    line
      .replace(/^\s*\d{1,2}\s*일차\s*/i, '')
      .replace(/^\s*DAY\s*\d{1,2}\s*/i, '')
      .trim()
  const startDayFromLine = (line: string): number | null => {
    const m1 = line.match(/^\s*(\d{1,2})\s*일차/i)
    if (m1) {
      const rest = stripDayHeader(line)
      if (isHanatourScheduleMetaSectionHead(rest)) return null
      return parseInt(m1[1]!, 10)
    }
    const m2 = line.match(/^\s*DAY\s*(\d{1,2})\b/i)
    if (m2) {
      const rest = stripDayHeader(line)
      if (isHanatourScheduleMetaSectionHead(rest)) return null
      return parseInt(m2[1]!, 10)
    }
    return null
  }

  let currentDay = 0
  const buf: string[] = []
  const chunks: { day: number; body: string }[] = []

  for (const line of lines) {
    const d = startDayFromLine(line)
    if (d != null && d >= 1) {
      if (currentDay > 0) {
        chunks.push({ day: currentDay, body: buf.join('\n').trim() })
      }
      currentDay = d
      buf.length = 0
      const rest = stripDayHeader(line)
      if (rest && !isHanatourScheduleMetaSectionHead(rest)) buf.push(rest)
    } else if (currentDay > 0) {
      if (isHanatourStandaloneMetaScheduleLine(line)) continue
      buf.push(line)
    }
  }
  if (currentDay > 0) {
    chunks.push({ day: currentDay, body: buf.join('\n').trim() })
  }

  const bestByDay = new Map<number, { day: number; body: string; score: number }>()
  for (const ch of chunks) {
    const score = scoreHanatourScheduleChunkBody(ch.body)
    const prev = bestByDay.get(ch.day)
    if (!prev || score > prev.score) bestByDay.set(ch.day, { day: ch.day, body: ch.body, score })
  }
  const out = new Map<number, string>()
  for (const v of bestByDay.values()) out.set(v.day, v.body)
  return out
}

function mergeHanatourScheduleSectionByDayPreferRicher(
  a: ReadonlyMap<number, string>,
  b: ReadonlyMap<number, string>,
): Map<number, string> {
  const out = new Map<number, string>()
  const days = new Set([...a.keys(), ...b.keys()])
  for (const day of days) {
    const bodyA = String(a.get(day) ?? '').trim()
    const bodyB = String(b.get(day) ?? '').trim()
    if (!bodyA && !bodyB) continue
    if (!bodyA) {
      out.set(day, bodyB)
      continue
    }
    if (!bodyB) {
      out.set(day, bodyA)
      continue
    }
    const sa = scoreHanatourScheduleChunkBody(bodyA)
    const sb = scoreHanatourScheduleChunkBody(bodyB)
    out.set(day, sb > sa || (sb === sa && bodyB.length > bodyA.length) ? bodyB : bodyA)
  }
  return out
}

/**
 * `schedule_section`(thin) + `normalizedRaw`(POI 원문) 중 일차별로 더 풍부한 블록을 고른다.
 * imageKeyword SSOT — thinHanatourScheduleBlob이 명소 줄을 제거해도 normalizedRaw로 복구.
 */
export function gatherHanatourScheduleSectionBodiesByDay(
  detailBody: DetailBodyParseSnapshot,
): Map<number, string> {
  const parts = detailBody.sections
    .filter((s) => s.type === 'schedule_section')
    .map((s) => s.text.trim())
    .filter(Boolean)
  const fromSections = parts.length
    ? gatherHanatourScheduleSectionBodiesByDayFromText(parts.join('\n\n'))
    : new Map<number, string>()
  const raw = String(detailBody.normalizedRaw ?? '').trim()
  const fromRaw = raw ? gatherHanatourScheduleSectionBodiesByDayFromText(raw) : new Map<number, string>()
  return mergeHanatourScheduleSectionByDayPreferRicher(fromSections, fromRaw)
}

type HanatourScheduleSectionDetailSource = {
  detailBodyStructured?: DetailBodyParseSnapshot | null
}

/**
 * 등록 파이프(미리보기·confirm·augment) 공통 — detailBody에서 일차별 schedule 원문.
 * parsed·preview.productDraft 어느 쪽에만 있어도 동일 Map을 반환한다.
 */
export function resolveHanatourRegisterScheduleSectionByDay(args: {
  parsed?: HanatourScheduleSectionDetailSource | null
  previewProductDraft?: HanatourScheduleSectionDetailSource | null
}): ReadonlyMap<number, string> | null {
  const structured =
    args.parsed?.detailBodyStructured ??
    args.previewProductDraft?.detailBodyStructured ??
    null
  if (!structured) return null
  const map = gatherHanatourScheduleSectionBodiesByDay(structured)
  return map.size ? map : null
}

/** LLM 일정 title에 가격표(기본상품 N원)가 섞인 경우 — schedule_section으로 복구 대상 */
export function isHanatourScheduleRowTitlePriceGarbage(title: string): boolean {
  const t = String(title ?? '').trim()
  if (!t) return false
  return /기본상품|성인\s*\d|아동\s*\d|유아\s*\d|[\d,]+\s*원/.test(t)
}

type HanatourRegisterPreviewScheduleRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
}

/**
 * 등록 미리보기 — LLM schedule[]가 빈약·오염(가격표 title)일 때 schedule_section/normalizedRaw로 title·description 보강.
 * parse augment·imageKeyword SSOT와 동일 입력을 맞춘다.
 */
export function enrichHanatourRegisterPreviewScheduleRowsFromSection<T extends HanatourRegisterPreviewScheduleRow>(
  rows: T[],
  detailBody: DetailBodyParseSnapshot | null | undefined,
): T[] {
  if (!detailBody || !rows.length) return rows
  const byDay = gatherHanatourScheduleSectionBodiesByDay(detailBody)
  if (!byDay.size) return rows
  return rows.map((row) => {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) return row
    const chunk = byDay.get(day)?.trim() ?? ''
    if (chunk.length < 12) return row
    const titleBad = isHanatourScheduleRowTitlePriceGarbage(String(row.title ?? ''))
    const descThin = String(row.description ?? '').trim().length < 24
    if (!titleBad && !descThin) return row
    const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const movementLine =
      lines.find((l) => /\d{1,2}\/\d{1,2}\s*\([월화수목금토일]\)/.test(l)) ??
      lines.find((l) => / - /.test(l) && !/출발|도착/.test(l)) ??
      lines[0] ??
      ''
    return {
      ...row,
      title: titleBad && movementLine ? movementLine.slice(0, 120) : row.title,
      description:
        chunk.length > String(row.description ?? '').trim().length ? chunk.slice(0, 4000) : row.description,
    }
  })
}
