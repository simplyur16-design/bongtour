/** [kyowontour] register-admin-audit-status */
/** 관리자 등록 입력 스냅샷(RegisterAdminInputSnapshot.status) */
export const REGISTER_ADMIN_SNAPSHOT_STATUS = {
  raw_saved: 'raw_saved',
  analysis_running: 'analysis_running',
  analysis_failed: 'analysis_failed',
  parsed: 'parsed',
  normalized_ready: 'normalized_ready',
  review_required: 'review_required',
  pending_saved: 'pending_saved',
} as const

/** 분석 행(RegisterAdminAnalysis.status) */
export const REGISTER_ADMIN_ANALYSIS_STATUS = {
  analysis_running: 'analysis_running',
  analysis_failed: 'analysis_failed',
  parsed: 'parsed',
  normalized_ready: 'normalized_ready',
  review_required: 'review_required',
  pending_saved: 'pending_saved',
} as const

export type RegisterAdminSnapshotStatus =
  (typeof REGISTER_ADMIN_SNAPSHOT_STATUS)[keyof typeof REGISTER_ADMIN_SNAPSHOT_STATUS]

export type RegisterAdminAnalysisStatus =
  (typeof REGISTER_ADMIN_ANALYSIS_STATUS)[keyof typeof REGISTER_ADMIN_ANALYSIS_STATUS]
