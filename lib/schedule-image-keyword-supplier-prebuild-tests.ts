/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]
 * 6공급사 imageKeyword prebuild node:test SSOT — 공급사별 분리·일괄 실행 목록.
 */
export const SCHEDULE_IMAGE_KEYWORD_SUPPLIER_PREBUILD_TESTS = [
  {
    supplier: 'hanatour',
    nodeTest: 'tests/hanatour-schedule-image-keyword-prebuild.test.ts',
  },
  {
    supplier: 'modetour',
    nodeTest: 'tests/modetour-schedule-image-keyword.test.ts',
  },
  {
    supplier: 'ybtour',
    nodeTest: 'tests/ybtour-schedule-image-keyword.test.ts',
  },
  {
    supplier: 'lottetour',
    nodeTest: 'tests/lottetour-schedule-image-keyword-turkey.test.ts',
  },
  {
    supplier: 'verygoodtour',
    nodeTest: 'tests/verygoodtour-schedule-image-keyword.test.ts',
  },
  {
    supplier: 'kyowontour',
    nodeTest: 'tests/kyowontour-schedule-image-keyword.test.ts',
  },
] as const

export type ScheduleImageKeywordPrebuildSupplier =
  (typeof SCHEDULE_IMAGE_KEYWORD_SUPPLIER_PREBUILD_TESTS)[number]['supplier']
