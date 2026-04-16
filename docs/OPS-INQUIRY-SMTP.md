# 문의 접수 — 운영자 자동 알림(이메일)

코드 기준: `app/api/inquiries/route.ts` — **순서: DB 저장 → SMTP 이메일**.  
문의 접수에 **운영자 SMS는 사용하지 않음**(레거시 DB 컬럼 `operatorSms*`만 존재, 신규 행에는 미기록).  
이메일: `lib/inquiry-email.ts`, 본문·제목 조립: `lib/inquiry-notification-format.ts`.

**고객 상담 진입(자동 푸시 아님)**  
- 카카오: `lib/kakao-open-chat.ts`, `KakaoCounselCta` 등 — 사용자가 링크로 진입·요약 복사.  
- 네이버 톡톡: `lib/naver-talktalk-counsel.ts`, `NaverTalktalkCounselCta` — URL 진입·클립보드 요약.  
서버가 운영자에게 카카오/톡톡으로 자동 발송하는 코드는 **없음**.

**카카오 알림톡(운영자 수신)** 템플릿 연동도 문의 경로에는 없음.

## 0. 운영 최종 검수 (`npm run verify:inquiry:live`)

- **명령**: `npm run verify:inquiry:live` → `scripts/local-verify-inquiry-live.ts` (sandbox 플래그 **없음**).
- **env 검증**: `lib/verify-inquiry-operational-env.ts` — Ethereal·example.com·코드 기본 카카오 URL과 동일한 값·빈 톡톡 URL 등은 **검수 시작 전 실패**.
- **자동으로 하는 일**: Next `dev -p 3001` 기동 → `POST /api/inquiries` 3건 → DB·SMTP 성공·여행 제목에 `(상품번호 없음)` 금지·Puppeteer로 카카오/톡톡 **팝업 URL이 env와 동일 진입점인지** 확인.
- **반드시 사람이 할 일**: 실제 수신 메일함 열람, 카카오/톡톡 앱에서 실제 방·채널 진입 확인, 요약문 필드 확인. 이 수동 단계 없이 **운영 통과로 인정하지 않음**.
- **구조/회귀만**: `npx tsx scripts/local-verify-inquiry-live.ts --sandbox` (Ethereal 등) — **운영 통과로 쓰지 말 것**.

## 1. 환경 변수 (이름 정확히 일치)

| 변수 | 필수 | 설명 |
|------|------|------|
| `SMTP_HOST` | 예 | SMTP 서버 호스트 |
| `SMTP_USER` | 예 | SMTP 로그인 사용자(일반적으로 발신 메일과 동일 계정) |
| `SMTP_PASS` | 예 | 비밀번호 또는 제공사의 앱 비밀번호 |
| `INQUIRY_MAIL_FROM` | 조건부 | 발신(From). **비우면 `SMTP_USER`가 From으로 사용됨** — 이 경우에도 `SMTP_USER`는 반드시 있어야 함 |
| `SMTP_PORT` | 아니오 | 비우면 `SMTP_SECURE=true` → `465`, 아니면 `587` |
| `SMTP_SECURE` | 아니오 | `"true"`면 TLS 직결(보통 465), 그 외 STARTTLS(보통 587) |
| `INQUIRY_RECEIVER_EMAIL` | 아니오 | 수신(To) 관리자 주소. 비우면 코드 기본 `bongtour24@naver.com` — **운영에서는 명시 권장** |

필수 조합(코드의 `if (!host || !port || !user || !pass || !from)`):

- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` 비어 있으면 안 됨
- `from` = `INQUIRY_MAIL_FROM?.trim() || user` 이므로 `INQUIRY_MAIL_FROM`이 비어 있어도 `SMTP_USER`로 충족

## 2. 미설정·발송 실패 시 동작

- **미설정 / 검증 전 단계**: `sendInquiryReceivedEmail`이 `throw` → `POST /api/inquiries`는 **DB `CustomerInquiry` 저장은 유지**, `emailSentStatus=failed`, `emailError`에 메시지 저장, 응답 `ok: true`, `notification.ok: false`, `notification.channels.email.ok: false`
- **SMTP 연결·전송 중 오류**: 동일하게 catch 후 DB·로그 기록, 사용자에게는 접수 성공 + 알림 지연 문구(`InquiryFormShell`)
- 서버 로그: `[POST /api/inquiries] notification_email_failed` + JSON 한 줄

## 3. 운영 서버 반영 (이 프로젝트: PM2, `docs/DEPLOY-NAVER-CLOUD.md`)

1. 서버에서 `.env` 또는 `.env.production` 편집 (레포 루트). 템플릿: `.env.production.example`, 샘플 설명: `.env.example`
2. 위 SMTP 변수 입력(비밀은 Git에 넣지 않음)
3. 적용: **`pm2 restart bongtour --update-env`** (환경만 바꿔도 Next 런타임이 읽도록 재시작)
4. 코드·CSP 변경이 포함된 배포면: `git pull && npm ci && npm run build && pm2 restart bongtour --update-env`

직접 `NODE_ENV=production npm run start`만 쓰는 경우: 프로세스를 종료한 뒤 동일 셸에서 env를 읽어 다시 기동.

## 4. 점검 스크립트

- **운영 최종 검수(권장 단일 진입점)**: `npm run verify:inquiry:live` — 위 §0 참고.
- 전체 필수 env: `bash deploy/verify-production-env.sh` (SMTP는 **[권장]** 구간으로 표시)
- SMTP 연결 스모크만: `npm run test:inquiry-smtp` (실 SMTP) — **운영 통과 전용 아님**. `npm run test:inquiry-smtp -- --ethereal` 는 **구조용**이며 `verify:inquiry:live` 와 혼동 금지.

## 5. 테스트 절차

1. 운영 통과: `npm run verify:inquiry:live` 후 §0 수동 체크리스트 수행.
2. SMTP 단독 스모크: `npm run test:inquiry-smtp` (실 계정) — 필요 시에만.
3. `npm run dev` 후 실제 `/inquiry` 폼 제출 → 관리자 수신함 확인
4. DB: 최신 `CustomerInquiry`에서 `emailSentStatus`가 `sent`, `emailSentAt` 설정, `emailError` null 인지 확인
5. 의도적으로 잘못된 비밀번호로 바꿔 제출 → 사용자 화면은 접수 성공 유지, DB `failed` + 로그 `notification_email_failed` 확인

## 6. 재시도 큐

당장 필수는 아님. `emailSentStatus`와 에러 필드·서버 로그로 추적 가능. 재전송이 필요하면 큐 테이블에서 `nextRetryAt`을 두는 형태가 자연스럽다.
