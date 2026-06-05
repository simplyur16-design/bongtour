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
import type { RegisterExtractionFieldIssue } from '@/lib/register-llm-schema-modetour'

export const MODETOUR_REGISTER_TITLE_SSOT_VERSION = 'v1-2026-06-03'

export type ModetourRegisterTitleSource = 'paste' | 'llm' | 'baseline' | 'fallback'

export type ModetourRegisterTitleResolution = {
  title: string
  supplierListingTitleRaw: string | null
  source: ModetourRegisterTitleSource
  unacceptable: boolean
}

/** 모두투어 등록 전용: 맨 앞 `[배지]`·공백만 정리(요약·해시 제거 금지). */
export function normalizeModetourRegisterTitleMinimal(s: string): string {
  let t = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  t = t.replace(/^(\[[^\]\n]{1,120}\]\s*)+/, '')
  t = t.replace(/[\u00a0\u3000]+/g, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  return t
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

/** preview·parse 단계 — 붙여넣기 + LLM JSON title */
export function resolveModetourRegisterProductTitle(args: {
  pasteBlob: string
  llmTitleRaw: string
}): ModetourRegisterTitleResolution {
  const supplierListingTitleRaw = extractModetourVerbatimListingTitleRawFromPaste(args.pasteBlob)
  const pasteNorm =
    supplierListingTitleRaw && supplierListingTitleRaw.length >= 10
      ? normalizeModetourRegisterTitleMinimal(supplierListingTitleRaw)
      : ''
  const llmNorm = normalizeModetourRegisterTitleMinimal(String(args.llmTitleRaw ?? '').trim())

  const picked = pickAcceptableTitle([
    { source: 'paste', value: pasteNorm },
    { source: 'llm', value: llmNorm },
  ])
  if (picked) {
    return { ...picked, supplierListingTitleRaw: supplierListingTitleRaw ?? null }
  }

  const fallback = pasteNorm || llmNorm || '상품명 없음'
  return {
    title: fallback,
    supplierListingTitleRaw: supplierListingTitleRaw ?? null,
    source: 'fallback',
    unacceptable: isModetourUnacceptableRegisterListingTitle(fallback),
  }
}

/** confirm 단계 — parsed + 상세 HTML baseline h1 */
export function resolveModetourRegisterProductTitleForConfirm(args: {
  parsedTitle: string
  supplierListingTitleRaw?: string | null
  baselineTrace?: ModetourBaselineTrace | null
}): ModetourRegisterTitleResolution {
  const parsedNorm = normalizeModetourRegisterTitleMinimal(String(args.parsedTitle ?? '').trim())
  const baselineCleaned = args.baselineTrace?.cleaned?.trim() ?? ''
  const baselineOk =
    Boolean(baselineCleaned) && modetourBaselineAcceptableForConfirm(args.baselineTrace)

  const picked = pickAcceptableTitle([
    ...(baselineOk ? [{ source: 'baseline' as const, value: baselineCleaned }] : []),
    { source: 'paste', value: parsedNorm },
  ])
  if (picked) {
    return {
      ...picked,
      supplierListingTitleRaw: args.supplierListingTitleRaw ?? null,
    }
  }

  return {
    title: baselineOk ? baselineCleaned : parsedNorm || '상품명 없음',
    supplierListingTitleRaw: args.supplierListingTitleRaw ?? null,
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
