/**
 * 모두투어 등록 상품명 SSOT — 붙여넣기·LLM·confirm baseline 단일 해석.
 * REGRESSION-FREEZE[modetour-register-title]: 출발일 구간 상품명·로직 복제 금지 — manifest
 */
import {
  isModetourUnacceptableRegisterListingTitle,
  modetourBaselineAcceptableForConfirm,
  type ModetourBaselineTrace,
} from '@/lib/modetour-departures'
import { extractModetourVerbatimListingTitleRawFromPaste } from '@/lib/modetour-listing-title-from-paste'
import { normalizeSupplierRegisterListingTitle } from '@/lib/supplier-product-title-display'
import type { RegisterExtractionFieldIssue } from '@/lib/register-llm-schema-modetour'

export const MODETOUR_REGISTER_TITLE_SSOT_VERSION = 'v1-2026-06-03'

export type ModetourRegisterTitleSource = 'paste' | 'llm' | 'baseline' | 'fallback'

export type ModetourRegisterTitleResolution = {
  title: string
  supplierListingTitleRaw: string | null
  source: ModetourRegisterTitleSource
  unacceptable: boolean
}

/** 모두투어 등록 전용: [출발확정] 등 마케팅 []·#만 제거 — [지역]·일반 해시 유지. */
export function normalizeModetourRegisterTitleMinimal(s: string): string {
  return normalizeSupplierRegisterListingTitle(s)
}

function pickAcceptableTitle(
  candidates: Array<{ source: ModetourRegisterTitleSource; value: string }>
): ModetourRegisterTitleResolution | null {
  for (const c of candidates) {
    const value = c.value.trim()
    if (!value || value === '상품명 없음') continue
    if (!isModetourUnacceptableRegisterListingTitle(value)) {
      return {
        title: value,
        supplierListingTitleRaw: null,
        source: c.source,
        unacceptable: false,
      }
    }
  }
  return null
}

/** preview·parse 단계 — 붙여넣기 + LLM JSON title (저장은 원문, 클린은 수용성 검사만) */
export function resolveModetourRegisterProductTitle(args: {
  pasteBlob: string
  llmTitleRaw: string
}): ModetourRegisterTitleResolution {
  const supplierListingTitleRaw = extractModetourVerbatimListingTitleRawFromPaste(args.pasteBlob)
  const pasteRaw = supplierListingTitleRaw?.trim() || ''
  const llmRaw = String(args.llmTitleRaw ?? '').trim()
  const pasteNorm =
    pasteRaw.length >= 10 ? normalizeModetourRegisterTitleMinimal(pasteRaw) : ''
  const llmNorm = normalizeModetourRegisterTitleMinimal(llmRaw)

  // paste 원문 우선 (display 클린은 노출 전용)
  if (pasteRaw.length >= 10 && !isModetourUnacceptableRegisterListingTitle(pasteNorm || pasteRaw)) {
    return {
      title: pasteRaw,
      supplierListingTitleRaw: pasteRaw,
      source: 'paste',
      unacceptable: false,
    }
  }
  // no-paste / URL-only: API·LLM 원문 저장 (plan-b 다른 공급사와 동일)
  if (llmRaw && !isModetourUnacceptableRegisterListingTitle(llmNorm || llmRaw)) {
    return {
      title: llmRaw,
      supplierListingTitleRaw: pasteRaw || null,
      source: 'llm',
      unacceptable: false,
    }
  }

  const picked = pickAcceptableTitle([
    { source: 'paste', value: pasteNorm },
    { source: 'llm', value: llmNorm },
  ])
  if (picked) {
    const raw =
      picked.source === 'paste' ? pasteRaw || picked.title : llmRaw || picked.title
    return { ...picked, title: raw, supplierListingTitleRaw: pasteRaw || null }
  }

  const fallbackRaw = pasteRaw || llmRaw || '상품명 없음'
  return {
    title: fallbackRaw,
    supplierListingTitleRaw: pasteRaw || null,
    source: 'fallback',
    unacceptable: isModetourUnacceptableRegisterListingTitle(
      normalizeModetourRegisterTitleMinimal(fallbackRaw) || fallbackRaw,
    ),
  }
}

/** confirm 단계 — parsed + 상세 HTML baseline (저장은 raw, cleaned는 수용성만) */
export function resolveModetourRegisterProductTitleForConfirm(args: {
  parsedTitle: string
  supplierListingTitleRaw?: string | null
  baselineTrace?: ModetourBaselineTrace | null
}): ModetourRegisterTitleResolution {
  const parsedRaw = String(args.parsedTitle ?? '').trim()
  const pasteRaw = String(args.supplierListingTitleRaw ?? '').trim()
  const parsedNorm = normalizeModetourRegisterTitleMinimal(parsedRaw)
  const baselineRaw = args.baselineTrace?.raw?.trim() ?? ''
  const baselineCleaned = args.baselineTrace?.cleaned?.trim() ?? ''
  const baselineOk =
    Boolean(baselineCleaned || baselineRaw) && modetourBaselineAcceptableForConfirm(args.baselineTrace)

  if (baselineOk) {
    const persist = baselineRaw || baselineCleaned
    if (persist && !isModetourUnacceptableRegisterListingTitle(baselineCleaned || persist)) {
      return {
        title: persist,
        supplierListingTitleRaw: pasteRaw || null,
        source: 'baseline',
        unacceptable: false,
      }
    }
  }

  // paste raw 우선
  if (pasteRaw.length >= 10 && !isModetourUnacceptableRegisterListingTitle(normalizeModetourRegisterTitleMinimal(pasteRaw) || pasteRaw)) {
    return {
      title: pasteRaw,
      supplierListingTitleRaw: pasteRaw,
      source: 'paste',
      unacceptable: false,
    }
  }

  if (parsedRaw && !isModetourUnacceptableRegisterListingTitle(parsedNorm || parsedRaw)) {
    return {
      title: parsedRaw,
      supplierListingTitleRaw: pasteRaw || null,
      source: 'paste',
      unacceptable: false,
    }
  }

  const picked = pickAcceptableTitle([
    ...(baselineOk ? [{ source: 'baseline' as const, value: baselineCleaned || baselineRaw }] : []),
    { source: 'paste', value: parsedNorm },
  ])
  if (picked) {
    const persist =
      picked.source === 'baseline'
        ? baselineRaw || baselineCleaned || picked.title
        : parsedRaw || picked.title
    return {
      ...picked,
      title: persist,
      supplierListingTitleRaw: pasteRaw || null,
    }
  }

  return {
    title: baselineOk ? baselineRaw || baselineCleaned : parsedRaw || '상품명 없음',
    supplierListingTitleRaw: pasteRaw || null,
    source: baselineOk ? 'baseline' : 'fallback',
    unacceptable: true,
  }
}

export function modetourRegisterTitleFieldIssue(title: string): RegisterExtractionFieldIssue | null {
  if (!isModetourUnacceptableRegisterListingTitle(title)) return null
  return {
    field: 'title',
    reason:
      '상품명이 출발일 구간(달력 선택) 또는 코드·날짜만으로 추출되었습니다. 붙여넣기 상단에 [지역]·#해시태그가 포함된 리스트 제목 줄을 넣으세요. 확정(confirm) 시 패키지 URL의 h1 제목으로 자동 보정됩니다.',
    source: 'auto',
    severity: 'warn',
  }
}

/** confirm 저장 직전 — 부적절 제목이면 422 */
export function modetourRegisterTitleBlocksConfirmSave(args: {
  prismaTitle: string
  prismaOriginalTitle: string
  baselineTrace?: ModetourBaselineTrace | null
}): boolean {
  const baselineOk = modetourBaselineAcceptableForConfirm(args.baselineTrace)
  const displayBad = isModetourUnacceptableRegisterListingTitle(args.prismaTitle)
  const originalBad = isModetourUnacceptableRegisterListingTitle(args.prismaOriginalTitle)
  if (!displayBad && !originalBad) return false
  if (baselineOk) return false
  return displayBad && originalBad
}
