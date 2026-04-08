/**
 * 테스트·샘플 상품 삭제 판별 (운영 `registered` 보호).
 * 스크립트 `scripts/purge-test-products.ts` 와 문서가 동일 기준을 참조한다.
 */

export type TestProductRuleId = 'title_marker' | 'origin_code_marker' | 'origin_source_marker' | 'non_registered'

export type TestProductClassification = {
  id: string
  title: string
  originCode: string
  originSource: string
  registrationStatus: string | null
  matchedRules: TestProductRuleId[]
  /** 기본 삭제 후보: 명시적 테스트 표식이 있는 경우만 */
  purgeByMarkers: boolean
  /** 등록 완료가 아님 */
  isNonRegistered: boolean
}

const TITLE_RE = /테스트|\btest\b|샘플|sample|dummy|mock|스텁|stub|\[TEST\]|\[샘플\]|\[sample\]/i
const ORIGIN_CODE_RE = /^(TEST|TMP|DEBUG|MOCK|SAMPLE|STUB)[-_]?/i
const ORIGIN_SOURCE_RE = /테스트|test[_-]?supplier|^test$/i

export function classifyTestProduct(row: {
  id: string
  title: string
  originCode: string
  originSource: string
  registrationStatus: string | null
}): TestProductClassification {
  const matchedRules: TestProductRuleId[] = []
  if (TITLE_RE.test(row.title)) matchedRules.push('title_marker')
  if (ORIGIN_CODE_RE.test(row.originCode.trim())) matchedRules.push('origin_code_marker')
  if (ORIGIN_SOURCE_RE.test(row.originSource.trim())) matchedRules.push('origin_source_marker')

  const isNonRegistered = (row.registrationStatus ?? 'pending') !== 'registered'
  if (isNonRegistered) matchedRules.push('non_registered')

  const purgeByMarkers =
    matchedRules.includes('title_marker') ||
    matchedRules.includes('origin_code_marker') ||
    matchedRules.includes('origin_source_marker')

  return {
    ...row,
    matchedRules,
    purgeByMarkers,
    isNonRegistered,
  }
}

export const TEST_PRODUCT_POLICY_SUMMARY = [
  '삭제 후보(기본 `--mode markers`): 상품명·상품코드·출처문자열에 테스트/샘플 등 명시적 표식이 있는 행만.',
  '등록 상태만으로는 삭제하지 않음(`registered` 이 아니어도 표식 없으면 유지) — 운영 대기 상품 오삭제 방지.',
  '`--overseas-only`: 위 표식 매칭 중에서도 제목 분류가 해외 패키지·자유형인 상품만 삭제(국내 테스트 상품은 제외).',
  '예외: `--mode non-registered --confirm-non-registered` 로 `registrationStatus !== "registered"` 전체 삭제(예: 로컬 DB 초기화). 예약(Booking)이 연결된 상품은 스킵.',
].join('\n')
