/**
 * 하나투어 등록 originCode — 붙여넣기 결정론 SSOT.
 * REGRESSION-FREEZE[hanatour-origin-code-from-paste]: LLM 미지정 시 본문 상품코드(PAB·ATP 등) 덮어쓰기 — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

export function isUnsetRegisterOriginCode(code: string | null | undefined): boolean {
  const v = (code ?? '').trim()
  return !v || v === '미지정'
}

/** 본문 `상품코드` / `상품번호` / pkgCd URL — ATP·AVP·PAB·EEP 등 */
export function extractHanatourOriginCodeFromPaste(blob: string): string | null {
  const t = blob.replace(/\s+/g, ' ').trim()
  const patterns = [
    /상품(?:코드|번호)\s*[:：]?\s*([A-Za-z]{1,6}\d[A-Za-z0-9-]{4,})/i,
    /상품번호\s*([A-Za-z]{1,6}\d[A-Za-z0-9-]{4,})/i,
    /pkgCd=([A-Za-z]{1,6}\d[A-Za-z0-9-]{4,})/i,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

export function applyHanatourOriginCodeFromPaste(parsed: RegisterParsed, rawText: string): RegisterParsed {
  if (!isUnsetRegisterOriginCode(parsed.originCode)) return parsed
  const code = extractHanatourOriginCodeFromPaste(rawText)
  return code ? { ...parsed, originCode: code } : parsed
}
