/** [lottetour] register-admin-retention */
/**
 * 관리자 등록 스냅샷 보관 만료 시각 계산 (공용 저장 레이어만).
 * 일수는 환경변수로 덮어쓸 수 있으며, 미설정 시 아래 기본값.
 */
import {
  REGISTER_ADMIN_SNAPSHOT_STATUS,
  type RegisterAdminSnapshotStatus,
} from '@/lib/register-admin-audit-status-lottetour'

export function daysFromNow(days: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function readEnvDays(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/** 신규 스냅샷(raw_saved) — 미완료 유기 시 상한 */
export function retentionExpiresAtNewSnapshot(): Date {
  return daysFromNow(readEnvDays('REGISTER_ADMIN_RETENTION_RAW_SAVED_DAYS', 14))
}

/** 분석 시도 행 생성 직후(진행 중) */
export function retentionExpiresAtAnalysisRunning(): Date {
  return daysFromNow(readEnvDays('REGISTER_ADMIN_RETENTION_ANALYSIS_RUNNING_DAYS', 30))
}

/** LLM parse 성공 후(parsed) 스냅샷 연장 */
export function retentionExpiresAtAfterParsedPersist(): Date {
  return daysFromNow(readEnvDays('REGISTER_ADMIN_RETENTION_PARSED_DAYS', 60))
}

export function retentionExpiresAtAnalysisFailed(): Date {
  return daysFromNow(readEnvDays('REGISTER_ADMIN_RETENTION_ANALYSIS_FAILED_DAYS', 90))
}

export function retentionExpiresAtReviewRequired(): Date {
  return daysFromNow(readEnvDays('REGISTER_ADMIN_RETENTION_REVIEW_REQUIRED_DAYS', 120))
}

export function retentionExpiresAtNormalizedReady(): Date {
  return daysFromNow(readEnvDays('REGISTER_ADMIN_RETENTION_NORMALIZED_READY_DAYS', 90))
}

export function retentionExpiresAtPendingSaved(): Date {
  return daysFromNow(readEnvDays('REGISTER_ADMIN_RETENTION_PENDING_SAVED_DAYS', 365))
}

/** 클라이언트가 동일 스냅샷 id로 재요청 시 최소 연장 */
export function retentionExpiresAtReuseTouch(): Date {
  return daysFromNow(readEnvDays('REGISTER_ADMIN_RETENTION_REUSE_TOUCH_DAYS', 7))
}

export function retentionExpiresAtForSnapshotStatus(status: RegisterAdminSnapshotStatus): Date {
  if (status === REGISTER_ADMIN_SNAPSHOT_STATUS.review_required) {
    return retentionExpiresAtReviewRequired()
  }
  if (status === REGISTER_ADMIN_SNAPSHOT_STATUS.normalized_ready) {
    return retentionExpiresAtNormalizedReady()
  }
  if (status === REGISTER_ADMIN_SNAPSHOT_STATUS.analysis_failed) {
    return retentionExpiresAtAnalysisFailed()
  }
  if (status === REGISTER_ADMIN_SNAPSHOT_STATUS.pending_saved) {
    return retentionExpiresAtPendingSaved()
  }
  return daysFromNow(readEnvDays('REGISTER_ADMIN_RETENTION_DEFAULT_DAYS', 90))
}

export function laterOf(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b
}
