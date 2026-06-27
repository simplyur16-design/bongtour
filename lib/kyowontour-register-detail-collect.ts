/**
 * 교원이지 등록 — goodsEventDetail HTML + tourEventTabData 상세카드 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[kyowontour-register-detail-collect]: augmentKyowontourParsedWithDetailCollect — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-kyowontour'
import {
  buildKyowontourFlightStructuredFromDetailHtml,
  extractKyowontourProductTitleFromDetailHtml,
  parseKyowontourRemainingSeatsFromDetailHtml,
} from '@/lib/kyowontour-register-api-detail'
import { augmentKyowontourParsedWithTabDataCollect } from '@/lib/kyowontour-register-tab-data-collect'
import {
  applyRegisterCollectedFlightStructured,
  needsRegisterFlightApiCollect,
} from '@/lib/register-detail-collect-flight-apply'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { KYOWONTOUR_TOUR_CODE_TITLE_RE } from '@/lib/supplier-listing-title-unacceptable'

export type KyowontourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
  /** 이미 fetch한 goodsEventDetail HTML — tab collect와 공유 */
  detailHtml?: string | null
}

function looksLikeGenericKyowontourTitle(title: string | null | undefined): boolean {
  const t = String(title ?? '').trim()
  if (!t) return true
  if (/여행이지\s*:\s*그래/i.test(t)) return true
  if (KYOWONTOUR_TOUR_CODE_TITLE_RE.test(t)) return true
  return false
}

function applyKyowontourDetailHtmlFields(parsed: RegisterParsed, html: string): RegisterParsed {
  let next = parsed

  const title = extractKyowontourProductTitleFromDetailHtml(html)
  if (title && looksLikeGenericKyowontourTitle(next.title)) {
    next = {
      ...next,
      title,
      supplierListingTitleRaw: title,
    }
  }

  if (next.remainingSeatsCount == null) {
    const seats = parseKyowontourRemainingSeatsFromDetailHtml(html)
    if (
      seats.remainingSeatsCount != null ||
      seats.minimumDepartureCount != null ||
      seats.currentBookedCount != null
    ) {
      next = {
        ...next,
        ...(seats.remainingSeatsCount != null ? { remainingSeatsCount: seats.remainingSeatsCount } : {}),
        ...(seats.seatsStatusRaw ? { seatsStatusRaw: seats.seatsStatusRaw } : {}),
        ...(seats.minimumDepartureCount != null ? { minimumDepartureCount: seats.minimumDepartureCount } : {}),
        ...(seats.currentBookedCount != null ? { currentBookedCount: seats.currentBookedCount } : {}),
      }
    }
  }

  if (needsRegisterFlightApiCollect(next)) {
    const flightStructured = buildKyowontourFlightStructuredFromDetailHtml(html)
    if (flightStructured) {
      next = applyRegisterCollectedFlightStructured(next, flightStructured)
    }
  }

  return next
}

export async function augmentKyowontourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: KyowontourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = (ctx?.originUrl ?? '').trim()
  if (!originUrl || !/kyowontour\.com/i.test(originUrl)) return parsed

  let html = ctx?.detailHtml?.trim() || null
  if (!html) {
    try {
      html = await fetch(originUrl, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'ko-KR',
          referer: 'https://www.kyowontour.com/',
          'user-agent': 'Mozilla/5.0 (compatible; BongTour/1.0)',
        },
        signal: AbortSignal.timeout(30_000),
      }).then((r) => (r.ok ? r.text() : null))
    } catch {
      html = null
    }
  }

  let next = parsed
  const summaryParts: string[] = []

  if (html) {
    next = applyKyowontourDetailHtmlFields(next, html)
    if (next.airlineName && next.outboundFlightNo) {
      summaryParts.push(`항공 ${next.airlineName ?? ''} ${next.outboundFlightNo ?? ''}/${next.inboundFlightNo ?? ''}`.trim())
    }
    if (next.remainingSeatsCount != null) {
      summaryParts.push(`잔여${next.remainingSeatsCount}석`)
    }
  } else {
    summaryParts.push('HTML fetch 실패')
  }

  next = await augmentKyowontourParsedWithTabDataCollect(next, {
    originUrl,
    pastedBlocks: ctx?.pastedBlocks,
    detailHtml: html,
  })

  if ((next.schedule?.length ?? 0) > 0) {
    next = {
      ...next,
      schedule: applyRegisterScheduleImageKeywordsBySupplier(next.schedule ?? [], {
        supplierKey: 'kyowontour',
        productDestination: next.primaryDestination ?? next.destination ?? null,
        productTitle: next.title,
      }),
    }
  }

  if (summaryParts.length > 0) {
    const summary = summaryParts.join(' · ')
    const notes = [...(next.registerPreviewPolicyNotes ?? [])]
    const note = `교원이지 detail-collect: ${summary}`
    if (!notes.includes(note)) notes.push(note)
    next = {
      ...next,
      kyowontourDetailCollectRan: true,
      kyowontourDetailCollectSummary: summary,
      registerPreviewPolicyNotes: notes,
    }
  }

  return next
}
