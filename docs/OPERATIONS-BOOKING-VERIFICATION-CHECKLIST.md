# 예약·PII 운영 검증 체크리스트 (GitHub / DB)

**판정 기준**: 코드·문서는 저장소에 반영됨. 아래 항목은 **저장소 관리자·운영자가 GitHub/DB에서 직접 수행**한다.

상세 설정: [OPERATIONS-GITHUB-PURGE-SETUP.md](./OPERATIONS-GITHUB-PURGE-SETUP.md)  
프론트 구현(4순위 이후): [BOOKING-FRONTEND-INTAKE-CONTRACT.md](./BOOKING-FRONTEND-INTAKE-CONTRACT.md) §7

---

## 1) 전체 판정 (이 문서의 목표)

| 단계 | 목표 | 완료 조건 |
|------|------|-----------|
| 1순위 | Secrets / Variables 입력 | 아래 표 모두 해당 환경에 맞게 설정 |
| 2순위 | 운영 DB 기준 status inspect 1회 | distinct·unknownTotal 기록, legacy 여부 판단 |
| 3순위 | purge **dry-run** 먼저 | 대상 건수·웹훅/로그 확인 후에만 apply 또는 월간 자동화 검토 |
| 4순위 | 고객 예약 UI 1차 | §「고객 예약 UI 다음 작업 범위」 참고 |

---

## 2) GitHub 운영 설정 체크리스트

저장소 **Settings → Secrets and variables → Actions**

### Secrets

- [ ] `DATABASE_URL` — Prisma URL (Actions 러너에서 DB에 도달 가능해야 함)
- [ ] `BOOKING_PII_PURGE_ALERT_WEBHOOK_URL` — JSON 수신 URL (성공 `apply_success` / 실패 `apply_failure`)

### Variables (비밀 아님)

- [ ] `BOOKING_PII_RETENTION_DAYS` — 예: `365` (미설정 시 스크립트 기본)
- [ ] `BOOKING_PII_PURGE_ENABLED` — **월간 자동 purge를 켤 때만** `true`. 켜기 전 3순위 dry-run 완료 권장

> Retention은 Secret `BOOKING_PII_RETENTION_DAYS`로 둘 수도 있음. 워크플로는 `vars || secrets` 우선순위 사용.

---

## 3) Inspect 실행 결과 정리 방식 (2순위)

### 실행

1. Actions → **Booking status inspect** → Run workflow  
2. 또는 VPN/허용망에서 로컬: `DATABASE_URL=... npm run booking:statuses:inspect`

### 기록 템플릿 (운영 일지에 복붙)

```
날짜: YYYY-MM-DD
실행: GitHub Actions / 로컬
DB: 운영(또는 스테이징)

[출력 요약]
- distinct status 개수: N
- 각 행: ✓/✗ "<문자열>" : 건수
- unknownTotal: 0 이면 legacy 이상 없음. >0 이면 normalize 검토

[조치]
- unknown 없음 / normalize dry-run·apply 일자
```

### 판단

- **unknownTotal = 0**: `BOOKING_STATUSES`와만 일치 → legacy status **없음**
- **✗ 행 존재**: `scripts/normalize-booking-statuses.ts` 및 `docs/BOOKING-STATUS-POLICY.md` 절차

---

## 4) Purge dry-run 확인 포인트 (3순위)

**월간 자동화(`BOOKING_PII_PURGE_ENABLED`)는 여기 통과 전에 켜지 말 것.**

1. Actions → **Booking PII purge** → **mode: dry-run** 실행  
2. 로그 JSON에서 확인:
   - `event`: `dry-run`
   - `candidates`: 대상 건수 (의도와 맞는지)
   - `cutoff`: 기준 시각
3. (선택) 로컬/CI에서 `BOOKING_PII_PURGE_NOTIFY_DRY_RUN=1` 시 dry-run도 웹훅 전송 가능  
4. 이상 없으면:
   - 수동 **apply** 한 번 검토 **또는**
   - 자동화: Variable `BOOKING_PII_PURGE_ENABLED=true` + 월간 cron은 이미 워크플로에 있음

---

## 5) 고객 예약 UI 다음 작업 범위 (4순위)

`BOOKING-FRONTEND-INTAKE-CONTRACT.md` §7 기준:

- 예약 폼 (상품 컨텍스트, 출발일 이중 정책, 인원·생년월일 동적 필드)
- 클라이언트 검증 (서버 최종 판정)
- `POST /api/bookings` 성공/실패 처리
- 접수 완료 안내 (`message`, `pricingMode` 반영)

---

## 6) 남은 TODO

| 담당 | 내용 |
|------|------|
| 운영 | §2 Secrets/Variables 실제 입력 |
| 운영 | §3 inspect 1회·결과 기록 |
| 운영 | §4 purge dry-run → 검토 후 apply 또는 `BOOKING_PII_PURGE_ENABLED` |
| 개발 | §5 UI 1차 (위 1~3 완료 후 착수 권장) |
