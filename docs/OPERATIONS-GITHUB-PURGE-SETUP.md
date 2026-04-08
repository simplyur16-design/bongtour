# GitHub — 예약 PII purge / DB 점검 운영 편입 체크리스트

코드는 저장소에 있으나, **아래 설정은 GitHub 저장소·조직에서 수동으로** 한다.

**한 페이지 체크리스트(검증 순서)**: [OPERATIONS-BOOKING-VERIFICATION-CHECKLIST.md](./OPERATIONS-BOOKING-VERIFICATION-CHECKLIST.md)

| 워크플로 파일 | 용도 |
|---------------|------|
| `.github/workflows/booking-pii-purge.yml` | PII 익명화 dry-run / apply |
| `.github/workflows/booking-status-inspect.yml` | `booking:statuses:inspect` (운영 DB 상태 분포) |

---

## 1. Repository secrets (필수: purge / inspect 공통)

| Secret 이름 | 용도 |
|-------------|------|
| `DATABASE_URL` | Prisma가 접속 가능한 **운영(또는 스테이징) DB URL**. GitHub 호스티드 러너에서 네트워크로 도달 가능해야 한다. |

**등록 경로**: 저장소 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

> SQLite `file:./dev.db`는 Actions 러너에 파일이 없으므로 **운영이 PostgreSQL 등 원격 DB**일 때만 사용한다.

---

## 2. Repository secrets (purge 알림·보관일)

| Secret 이름 | 용도 |
|-------------|------|
| `BOOKING_PII_PURGE_ALERT_WEBHOOK_URL` | 익명화 **성공/실패** JSON POST (Slack Incoming Webhook 등). 없으면 알림 없음. |
| `BOOKING_PII_RETENTION_DAYS` | (선택) 숫자 문자열, 예 `365`. 미설정 시 스크립트 기본값 사용. |

---

## 3. Repository variables (권장: 비밀 아님)

| Variable 이름 | 용도 |
|-----------------|------|
| `BOOKING_PII_RETENTION_DAYS` | 보관 일수. Secret과 동일 이름이면 **Variable이 우선**되도록 워크플로에서 처리됨. |
| `BOOKING_PII_PURGE_ENABLED` | `true`로 두면 **스케줄(cron) 트리거** 시에만 purge 잡이 실행된다. 미설정/`true` 아니면 schedule 이벤트는 스킵. |

**등록 경로**: **Settings** → **Secrets and variables** → **Actions** → **Variables** 탭

---

## 4. 워크플로 동작 요약

### `Booking PII purge`

- **Actions** → **Booking PII purge** → **Run workflow** → `dry-run` 또는 `apply`
- `DATABASE_URL` 없으면 실패(의도적).
- **월간 자동 apply**: `booking-pii-purge.yml`에 `schedule`이 있을 때, **`BOOKING_PII_PURGE_ENABLED`가 `true`인 경우에만** 해당 커밋 기준으로 실행. 수동 `workflow_dispatch`는 Variable과 무관하게 항상 실행.

### `Booking status inspect`

- **Actions** → **Booking status inspect** → **Run workflow**
- `npm run booking:statuses:inspect`만 실행. unknown status 있으면 **exit 2**로 잡 실패 → PR/알림 연동 가능.

---

## 5. 운영 편입 순서 (권장)

1. 스테이징 DB `DATABASE_URL` Secret 등록 → **Booking PII purge** 수동 `dry-run` → `apply` (선택)
2. 동일 Secret을 운영 DB로 교체하거나, 별도 브랜치/환경 전략에 맞게 분리
3. `BOOKING_PII_PURGE_ALERT_WEBHOOK_URL` 등록 후 `apply` 한 번 더 확인
4. 월간 자동 apply가 필요하면: Variable `BOOKING_PII_PURGE_ENABLED` = `true` 저장 후, 스케줄이 활성화된 커밋이 기본 브랜치에 있어야 함

---

## 6. 로컬에서 운영 DB 점검 (VPN/허용 IP 필요 시)

운영 URL을 로컬 `.env`에 두지 않는 것이 원칙이면, **일회성**으로만:

```bash
set DATABASE_URL=postgresql://...   # Windows PowerShell: $env:DATABASE_URL="..."
npm run booking:statuses:inspect
```

또는 위 **Booking status inspect** 워크플로를 사용한다.
