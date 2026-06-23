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
  return (dateLike ? 100_000 : 0) + Math.min(t.length, 50_000)
}

/** `schedule_section`에서 일차별로 가장 신뢰도 높은 원문 블록(점수 최고)만 모은다. */
export function gatherHanatourScheduleSectionBodiesByDay(
  detailBody: DetailBodyParseSnapshot,
): Map<number, string> {
  const parts = detailBody.sections
    .filter((s) => s.type === 'schedule_section')
    .map((s) => s.text.trim())
    .filter(Boolean)
  if (!parts.length) return new Map()

  const lines = parts.join('\n\n').split(/\r?\n/)
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

type HanatourScheduleSectionDetailSource = {
  detailBodyStructured?: DetailBodyParseSnapshot | null
}

/**
 * 신규 등록 파이프(미리보기·confirm·augment) 공통 — detailBody에서 일차별 schedule_section 원문.
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
  if (!structured?.sections?.length) return null
  return gatherHanatourScheduleSectionBodiesByDay(structured)
}
