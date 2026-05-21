/**
 * 일정 schedule[] — 일차당 Pexels용 imageKeyword 2개.
 * 관광 일차: 그날 주요 관광지·관광명소 1순위(imageKeyword)·2순위(imageKeyword2). 비행일은 해외 도시명.
 */
import { extractPrimaryEnglishPlaceName, extractSecondaryEnglishPlaceName } from '@/lib/english-schedule-place-extract'
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'
import { firstPoiSearchTermExcluding, mapKoreanPoiSegment, normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import {
  buildScheduleImageKeywordPlan,
  polishRegisterScheduleImageKeywordFromLlm,
  resolveScheduleHubImageKeyword,
  type ScheduleImageKeywordDayInput,
  type ScheduleImageKeywordPlan,
} from '@/lib/register-schedule-image-keyword-ssot'

export type DualScheduleImageKeywords = {
  imageKeyword: string
  imageKeyword2: string
}

function hay(ctx: ScheduleImageKeywordDayInput): string {
  return `${ctx.title ?? ''}\n${ctx.description ?? ''}\n${ctx.routeText ?? ''}`.replace(/\s+/g, ' ')
}

function normKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function resolveHubCityKeyword(ctx: ScheduleImageKeywordDayInput, plan: ScheduleImageKeywordPlan): string {
  const hub = resolveScheduleHubImageKeyword(ctx, plan)
  if (hub) return finalizeScheduleImageKeyword(hub)
  return ''
}

/**
 * 2번째 키워드: LLM 보조 → 본문 2순위 명소 → 허브일은 도시명(1번과 동일 가능).
 */
export function resolveScheduleSecondaryImageKeyword(
  primary: string,
  ctx: ScheduleImageKeywordDayInput,
  plan: ScheduleImageKeywordPlan,
  llmSecondary?: string | null,
): string {
  const primaryFin = finalizeScheduleImageKeyword(primary)
  const hubCity = resolveHubCityKeyword(ctx, plan)
  if (hubCity) {
    return hubCity
  }

  const fromLlm = finalizeScheduleImageKeyword(String(llmSecondary ?? '').trim())
  if (fromLlm && normKey(fromLlm) !== normKey(primaryFin)) {
    return fromLlm
  }

  const h = hay(ctx)
  const secondary = extractSecondaryEnglishPlaceName(h, h, ctx.title ?? '', primaryFin)
  if (secondary && normKey(secondary) !== normKey(primaryFin)) {
    return finalizeScheduleImageKeyword(secondary)
  }

  const exclude = new Set<string>()
  if (primaryFin) exclude.add(normalizeSemanticPoiKey(primaryFin))

  const routeText = (ctx.routeText ?? '').trim()
  if (routeText) {
    for (const seg of routeText.split(/\s*-\s*/)) {
      const t = seg.trim()
      if (!t) continue
      const mapped = mapKoreanPoiSegment(t)
      if (mapped) {
        const fin = finalizeScheduleImageKeyword(mapped)
        if (fin && normKey(fin) !== normKey(primaryFin) && !exclude.has(normalizeSemanticPoiKey(fin))) {
          return fin
        }
      }
    }
  }

  for (const source of [ctx.description, ctx.title]) {
    const fromKorean = firstPoiSearchTermExcluding(source ?? '', exclude)
    if (fromKorean) {
      const fin = finalizeScheduleImageKeyword(fromKorean)
      if (fin && normKey(fin) !== normKey(primaryFin)) return fin
    }
  }

  const desc = (ctx.description ?? '').trim()
  if (desc) {
    const parts = desc.split(/[,，、·\n]|(?:\s+및\s+)|(?:\s+그리고\s+)/).map((s) => s.trim()).filter(Boolean)
    for (const part of parts) {
      const mapped = mapKoreanPoiSegment(part)
      if (!mapped) continue
      const fin = finalizeScheduleImageKeyword(mapped)
      if (fin && normKey(fin) !== normKey(primaryFin) && !exclude.has(normalizeSemanticPoiKey(fin))) {
        return fin
      }
    }
  }

  return ''
}

export function buildDualScheduleImageKeywords(
  row: ScheduleImageKeywordDayInput & { imageKeyword?: string; imageKeyword2?: string | null },
  plan: ScheduleImageKeywordPlan,
  supplierFinalize?: (normalized: string, ctx: ScheduleImageKeywordDayInput) => string,
): DualScheduleImageKeywords {
  const ctx: ScheduleImageKeywordDayInput = {
    day: row.day,
    title: row.title,
    description: row.description,
    routeText: row.routeText,
  }
  const primary = polishRegisterScheduleImageKeywordFromLlm(
    String(row.imageKeyword ?? '').trim(),
    ctx,
    plan,
    supplierFinalize,
  )
  const secondary = resolveScheduleSecondaryImageKeyword(primary, ctx, plan, row.imageKeyword2)
  return { imageKeyword: primary, imageKeyword2: secondary }
}

export function applyDualScheduleImageKeywordsToRows<
  T extends ScheduleImageKeywordDayInput & { imageKeyword: string; imageKeyword2?: string | null },
>(rows: T[], supplierFinalize?: (normalized: string, ctx: ScheduleImageKeywordDayInput) => string): T[] {
  const plan = buildScheduleImageKeywordPlan(rows)
  return rows.map((row) => {
    const dual = buildDualScheduleImageKeywords(row, plan, supplierFinalize)
    return { ...row, imageKeyword: dual.imageKeyword, imageKeyword2: dual.imageKeyword2 }
  })
}
