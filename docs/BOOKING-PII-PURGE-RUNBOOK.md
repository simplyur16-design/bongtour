# 예약 PII 익명화 배치 운영 런북

코드: `scripts/purge-old-bookings.ts`  
관련 정책: `docs/BOOKING-INTAKE-POLICY.md`

**GitHub Secrets / Variables / 워크플로 연결**: [OPERATIONS-GITHUB-PURGE-SETUP.md](./OPERATIONS-GITHUB-PURGE-SETUP.md)

## 목적

보관기간(`BOOKING_PII_RETENTION_DAYS`)을 초과한 `Booking` 행의 **고객 PII**를 익명화한다.  
자동 예약이 아닌 **접수 데이터**이므로, 법/내부 정책에 맞춘 보관 후 파기(익명화) 절차로 취급한다.

## 익명화 대상 필드

- `customerName` → `삭제됨`
- `customerPhone` → `deleted` (재실행 시 동일 행 제외 판별에 사용)
- `customerEmail` → `null`
- `requestNotes` → `null`
- `childInfantBirthDatesJson` → `null`
- `notificationError` → `null`

**조건**: `createdAt < now - retentionDays` **이고** `customerPhone != 'deleted'` (미처리 건만 배치 처리)

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | 예 | Prisma 연결 URL |
| `BOOKING_PII_RETENTION_DAYS` | 아니오 | 기본 `365`, 최소 `30`으로 클램프 |
| `BOOKING_PII_PURGE_ALERT_WEBHOOK_URL` | 강력 권장 | 실패 시 POST. 성공 시에도 동일 URL로 `event: apply_success` 전달 |
| `BOOKING_PII_PURGE_NOTIFY_DRY_RUN` | 아니오 | `1`이면 dry-run 후에도 웹훅 전송(기본은 dry-run은 웹훅 없음) |

## 로컬 / 서버 CLI

```bash
# 건수만 확인 (DB 변경 없음)
npm run booking:purge-pii

# 익명화 실행
npm run booking:purge-pii:apply
```

직접 실행:

```bash
npx tsx scripts/purge-old-bookings.ts --dry-run --log-json
npx tsx scripts/purge-old-bookings.ts --apply --log-json
```

종료 코드: 실패 시 `1`. JSON 한 줄 로그는 `--log-json` 시 stdout.

## 실패 알림

스크립트가 예외로 종료하면 `BOOKING_PII_PURGE_ALERT_WEBHOOK_URL`로 JSON POST:

- `event`: `apply_failure`
- `message`: 에러 문자열
- `retentionDays`, `at` 등

성공 시(`--apply`):

- `event`: `apply_success`
- `anonymized`: 처리 건수
- `cutoff`: 기준 시각 ISO 문자열

Slack/기타는 웹훅 수신측에서 `event`로 분기한다.

## 주기 스케줄 옵션

### A) GitHub Actions

`.github/workflows/booking-pii-purge.yml`

- **수동**: Actions → `Booking PII purge` → `workflow_dispatch` → `dry-run` 또는 `apply`
- **월간 자동**: 워크플로 파일에서 `schedule` 블록 주석 해제 후, 저장소 **Secrets**에 `DATABASE_URL` 등 설정

`DATABASE_URL` 미설정 시 잡은 실패한다(의도적).

### B) 자체 서버 (cron)

```cron
# 매월 1일 04:00 (서버 로컬 시간 — 운영 표준에 맞출 것)
0 4 1 * * cd /path/to/BONGTOUR && BOOKING_PII_RETENTION_DAYS=365 BOOKING_PII_PURGE_ALERT_WEBHOOK_URL=https://... npm run booking:purge-pii:apply >> /var/log/bongtour-purge.log 2>&1
```

- `.env` 또는 systemd `EnvironmentFile`에 동일 변수 설정 권장
- 로그 로테이션·실패 시 알림은 인프라 정책에 따른다

## 운영 절차 (권장)

1. **스테이징**에서 `dry-run`으로 `candidates` 건수 확인  
2. **프로덕션**에서 `dry-run` 재확인  
3. **프로덕션** `apply` 실행 (GitHub 수동 또는 cron)  
4. 웹훅/로그에서 `apply_success` 및 `anonymized` 수 확인  
5. 이상 시 `apply_failure` 알림·로그로 원인 조사

## 주의

- SQLite 로컬 `dev.db`와 운영 DB는 **동일 스크립트, 다른 `DATABASE_URL`**로 구분한다.
- 대량 건은 **500건 단위**로 반복 처리한다.
