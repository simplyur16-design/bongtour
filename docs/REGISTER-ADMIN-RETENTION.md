# 관리자 등록 스냅샷·분석 보관 정책

## 요약

- `RegisterAdminInputSnapshot.retentionExpiresAt`에 만료 시각을 저장한다. 만료 후 `scripts/cleanup-register-admin-records.ts`가 스냅샷을 **물리삭제**하면, Prisma `onDelete: Cascade`로 연결된 `RegisterAdminAnalysis` 행도 함께 삭제된다.
- 공급사 전용 코드는 변경하지 않으며, `lib/register-admin-analysis-store.ts` / `lib/register-admin-input-persist.ts` / `lib/register-admin-retention.ts`에서만 만료 시각을 갱신한다.

## 기본 보관 일수 (환경변수로 덮어쓰기)

| 단계 | ENV | 기본값(일) |
|------|-----|------------|
| 신규 스냅샷 `raw_saved` | `REGISTER_ADMIN_RETENTION_RAW_SAVED_DAYS` | 14 |
| 분석 시도 시작 `analysis_running` | `REGISTER_ADMIN_RETENTION_ANALYSIS_RUNNING_DAYS` | 30 |
| LLM parse 성공 후 `parsed` | `REGISTER_ADMIN_RETENTION_PARSED_DAYS` | 60 |
| 스냅샷 재사용 터치 | `REGISTER_ADMIN_RETENTION_REUSE_TOUCH_DAYS` | 7 |
| `analysis_failed` | `REGISTER_ADMIN_RETENTION_ANALYSIS_FAILED_DAYS` | 90 |
| `review_required` | `REGISTER_ADMIN_RETENTION_REVIEW_REQUIRED_DAYS` | 120 |
| `normalized_ready` | `REGISTER_ADMIN_RETENTION_NORMALIZED_READY_DAYS` | 90 |
| `pending_saved` (confirm 성공) | `REGISTER_ADMIN_RETENTION_PENDING_SAVED_DAYS` | 365 |
| 기타 스냅샷 상태 | `REGISTER_ADMIN_RETENTION_DEFAULT_DAYS` | 90 |

## cleanup 실행

```bash
# 삭제 대상만 JSON 로그 (기본)
npm run cleanup:register-admin

# 실제 삭제
npm run cleanup:register-admin:apply

# 레거시: retentionExpiresAt 없고 analysis_failed 이며 updatedAt 이 N일 지난 행 (배포 직후 백필 전용)
npx tsx scripts/cleanup-register-admin-records.ts --apply --legacy-failed-days=120
```

운영 순서: **수동 dry-run → 소량 `--apply` → 주기 스케줄(예: 일 1회)**.

## DB 마이그레이션

`retentionExpiresAt` 컬럼 추가 후 기존 행은 `null`이다. 신규 트래픽부터 자동 설정되며, 레거시는 `--legacy-failed-days` 또는 별도 백필 작업으로 정리한다.
