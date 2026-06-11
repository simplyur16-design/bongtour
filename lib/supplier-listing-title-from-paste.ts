/**
 * 6공급사 — 붙여넣기 상단 리스트 제목 재추출(브랜드별 extractor 위임).
 * LLM·파서가 출발일 구간만 잡았을 때 복구용.
 */
import { extractModetourVerbatimListingTitleRawFromPaste } from '@/lib/modetour-listing-title-from-paste'
import { extractVerygoodtourVerbatimListingTitleFromPaste } from '@/lib/verygoodtour-listing-title-from-paste'
import { extractYbtourVerbatimListingTitle } from '@/lib/register-ybtour-basic'
import { extractLottetourVerbatimListingTitle } from '@/lib/register-lottetour-basic'
import { extractKyowontourVerbatimListingTitle } from '@/lib/register-kyowontour-basic'
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'

function extractHanatourVerbatimListingTitleFromPaste(blob: string): string | null {
  const lines = blob
    .replace(/\r\n/g, '\n')
    .slice(0, 12_000)
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean)
  for (const line of lines.slice(0, 70)) {
    if (line.length < 12 || line.length > 220) continue
    if (/^https?:\/\//i.test(line)) continue
    if (isSupplierListingTitleUnacceptable(line, 'hanatour')) continue
    const hasTourShape = /(?:\d+\s*일|\d+\s*박|\d+\s*국)/.test(line)
    const hashCount = (line.match(/#/g) || []).length
    if (hasTourShape && (hashCount >= 1 || /^\[/.test(line))) return line
    if (/^\[/.test(line) && /[가-힣]{4,}/.test(line) && hasTourShape) return line
  }
  return null
}

/** 브랜드별 붙여넣기 extractor — acceptable 한 줄만 반환 */
export function extractSupplierListingTitleFromPaste(brandKey: string, blob: string): string | null {
  const paste = (blob ?? '').trim()
  if (!paste) return null

  let raw: string | null = null
  switch (brandKey) {
    case 'modetour':
      raw = extractModetourVerbatimListingTitleRawFromPaste(paste)
      break
    case 'hanatour':
      raw = extractHanatourVerbatimListingTitleFromPaste(paste)
      break
    case 'ybtour':
      raw = extractYbtourVerbatimListingTitle(paste)
      break
    case 'verygoodtour':
      raw = extractVerygoodtourVerbatimListingTitleFromPaste(paste)
      break
    case 'lottetour':
      raw = extractLottetourVerbatimListingTitle(paste)
      break
    case 'kyowontour':
      raw = extractKyowontourVerbatimListingTitle(paste)
      break
    default:
      return null
  }

  const t = (raw ?? '').trim()
  if (!t || isSupplierListingTitleUnacceptable(t, brandKey)) return null
  return t
}
