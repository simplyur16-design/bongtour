/**
 * 내일투어(naeiltour) 등록 상품명 — 노출용 정리.
 * REGRESSION-FREEZE[naeiltour-register-product-title]: 금까기·진짜 제거 — manifest
 */
import { stripSupplierTitleUiNoise } from '@/lib/supplier-product-title-display'

/** 등록·저장 노출명 — 「금까기」「진짜」 브랜드 접미/수식어 제거 (원문 rawTitle은 별도 보존) */
export function normalizeNaeiltourRegisterListingTitle(s: string | null | undefined): string {
  let t = stripSupplierTitleUiNoise(String(s ?? ''))
  t = t.replace(/금까기/g, '').replace(/진짜/g, '')
  return tidyBracketSpacesAfterTokenStrip(t)
}

/**
 * 토큰 제거 뒤 괄호 안 앞뒤 공백·빈 괄호 정리 — 「[ 영국일주 9일]」→「[영국일주 9일]」, 「[ ]」 삭제.
 * REGRESSION-FREEZE[naeiltour-title-bracket-tidy]: 금까기·진짜 제거 후 빈칸 괄호 정리(등록·표시 공통) — manifest
 */
export function tidyBracketSpacesAfterTokenStrip(s: string): string {
  let t = String(s ?? '')
  t = t.replace(/\[\s*([^\]]*?)\s*\]/g, (_m, inner: string) => {
    const c = inner.replace(/\s+/g, ' ').trim()
    return c ? `[${c}]` : ' '
  })
  t = t.replace(/【\s*([^】]*?)\s*】/g, (_m, inner: string) => {
    const c = inner.replace(/\s+/g, ' ').trim()
    return c ? `【${c}】` : ' '
  })
  t = t.replace(/\(\s*([^)]*?)\s*\)/g, (_m, inner: string) => {
    const c = inner.replace(/\s+/g, ' ').trim()
    return c ? `(${c})` : ' '
  })
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * 공개 표시용(공급사 무관) — 내일투어 브랜드 접미 「금까기」, 괄호·머리 「진짜 」 수식어만 제거.
 * 본문 속 일반 단어 「진짜」는 건드리지 않음. DB 원문은 그대로.
 */
export function stripNaeiltourBrandTokensForDisplay(s: string): string {
  const src = String(s ?? '')
  if (!/금까기|진짜/.test(src)) return src
  let t = src.replace(/\s*금까기/g, ' ')
  t = t.replace(/(^|[\[【(\s])진짜\s+/g, '$1')
  return tidyBracketSpacesAfterTokenStrip(t)
}
