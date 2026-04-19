# 문의 접수 — 운영자 자동 알림(이메일)

코드 기준: `app/api/inquiries/route.ts` — **순서: DB 저장 → SMTP 이메일**.  
문의 접수에 **운영자 SMS는 사용하지 않음**(`CustomerInquiry` Prisma 모델에도 SMS 추적 필드 없음 — 이메일 필드만 사용).  
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
| `SMTP_HOST` | 예 | SMTP 서버 호스트(예: 네이버 `smtp.naver.com`) |
| `SMTP_PORT` | 예 | 포트 문자열(예: `587`, `465`) |
| `SMTP_SECURE` | 아니오 | `"true"`면 TLS 직결(보통 465), 그 외 STARTTLS(보통 587) |
| `SMTP_USER` | 예 | SMTP 인증 계정 |
| `SMTP_PASS` | 예 | 네이버는 **애플리케이션 비밀번호**(IMAP·POP·SMTP 공통) 권장 |
| `SMTP_FROM_NAME` | 예 | 발신 표시 이름(예: `봉투어`) |
| `SMTP_FROM_EMAIL` | 예 | 발신 주소(From). **고객 이메일을 여기 넣지 말 것** |
| `INQUIRY_NOTIFICATION_EMAIL` | 예 | 운영자 수신(To) |

고객이 입력한 이메일은 **Reply-To** 로만 설정됨(`lib/inquiry-email.ts`).

필수 조합: 위 표의 **예** 항목이 모두 비어 있지 않아야 `sendInquiryReceivedEmail` 이 발송한다. 누락 시 `throw` 전 `[inquiry-email] smtp_env_presence` 로그(비밀번호 미출력).

### 네이버 웹 도움말과 env 매칭 (POP·IMAP·SMTP 안내 기준)

네이버 메일 도움말에 나오는 내용과 이 레포 env는 다음처럼 맞추면 된다.

| 네이버 안내 | 이 프로젝트 |
|-------------|-------------|
| SMTP 서버명 `smtp.naver.com` | `SMTP_HOST=smtp.naver.com` |
| POP/SMTP 안내: SMTP 포트 **465**, 보안연결(SSL) 필요 | `SMTP_PORT=465`, `SMTP_SECURE=true` |
| IMAP 연동 예시(Thunderbird 등): SMTP 포트 **587** | `SMTP_PORT=587`, `SMTP_SECURE=false` (`lib/inquiry-email.ts`에서 587일 때 `requireTLS`) |
| 비밀번호: **애플리케이션 비밀번호**(2단계 인증 전제, 웹 로그인 비번 아님) | `SMTP_PASS` |
| 아이디: 도움말에 짧은 아이디만 적힌 경우가 있으나, 클라이언트 예시에는 **전체 메일 주소**를 Username으로 쓰는 경우가 많다 | `SMTP_USER`는 **`id@naver.com` 전체 주소** 권장 |
| **POP3/SMTP 사용**을 **사용함**으로 (공지: 유예 종료 후 필수) | 웹메일 **환경설정 → POP3/IMAP·SMTP**(또는 POP3/SMTP 설정 탭)에서 **사용** 켜기. 탭이 나뉘어 있으면 **보내기(SMTP)에 해당하는 사용함**까지 포함해 확인 |

465와 587은 도움말 **섹션별로 예시가 다를 뿐** 둘 다 네이버가 제시하는 방식이다. 지금처럼 465+SSL이 공식 POP/SMTP 블록과 일치한다. 535가 계속이면 같은 비번으로 **587+STARTTLS**(`npm run test:inquiry-smtp:587`)로만 비교해 보면 된다.

### 네이버 SMTP에서 `535` (Username and Password not accepted)인데 앱 비밀번호·아이디가 맞다고 느껴질 때

- **애플리케이션 비밀번호**는 네이버 안내상 **IMAP·POP·SMTP** 등 외부 앱에서 쓰는 **동일한 비밀번호**이다. “POP 전용”과 **SMTP 전용이 따로 있는 구조가 아니다**. 계정 **보안 설정 → 애플리케이션 비밀번호**에서 발급한 값을 `SMTP_PASS`에 넣는다(아웃룩 등과 같은 자리).
- 웹메일 **환경설정 → POP3/IMAP·SMTP** 에서 **SMTP 사용**(및 필요 시 외부메일 관련 허용)이 켜져 있는지 확인한다.
- **포트와 `SMTP_SECURE` 쌍**: `587` → `SMTP_SECURE=false`(STARTTLS, 코드에서 `requireTLS` 사용). `465` → `SMTP_PORT=465` 와 **`SMTP_SECURE=true`** 를 같이 쓴다(한쪽만 바꾸면 실패하기 쉽다). 465에서만 535가 반복되면 `npm run test:inquiry-smtp:587`(일회 587 시도)로 비교한다.
- **`SMTP_FROM_EMAIL`**: 네이버는 발신 주소를 인증 계정과 다르게 두면 이후 단계에서 거절되는 경우가 있어, **가능하면 `SMTP_USER`와 동일한 `@naver.com` 주소**로 맞춘다.
- 앱 비밀번호를 **재발급**하면 이전 문자열은 즉시 무효이므로 `.env`에 새 값만 남긴다. 값 앞뒤 **따옴표·공백·줄바꿈**이 붙지 않았는지 확인한다.
- 네이버 메일 앱 비밀번호는 발급 화면 안내 기준 **12자리, 알파벳 대문자+숫자**이다. `npm run test:inquiry-smtp` 의 `smtp_pass_char_count`가 그 길이·형식과 맞는지 확인한다(잘림·따옴표·줄바꿈 없이 한 줄).

## 2. 미설정·발송 실패 시 동작

- **미설정 / 검증 전 단계**: `sendInquiryReceivedEmail`이 `throw` → `POST /api/inquiries`는 **DB `CustomerInquiry` 저장은 유지**, `emailSentStatus=failed`, `emailError`에 메시지 저장, 응답 `ok: true`, `notification.ok: false`, `notification.channels.email.ok: false`
- **SMTP 연결·전송 중 오류**: 동일하게 catch 후 DB·로그 기록, 사용자에게는 접수 성공 + 알림 지연 문구(`InquiryFormShell`)
- 서버 로그: `[POST /api/inquiries] notification_email_failed` + JSON 한 줄

## 3. 운영 서버 반영 (이 프로젝트: PM2, `docs/DEPLOY-NAVER-CLOUD.md`)

1. **로컬에서 검증된 값**을 기준으로, 서버의 **레포 루트** `.env.production`(또는 운영에서 쓰는 `.env`)에 아래 키를 **한 세트로** 복사한다. **Git·슬랙·티켓에 붙여 넣지 말 것.**
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`, `INQUIRY_NOTIFICATION_EMAIL`
   - 로컬 `.env.local`과 **동일한 포트·SSL 조합**을 유지한다(예: 네이버 POP/SMTP 안내대로 `465` + `SMTP_SECURE=true` 또는 IMAP/SMTP 안내대로 `587` + `false`).
2. 서버 SSH 후 예: `nano /var/www/bongtour/.env.production` — 위 변수만 추가·수정하고 저장한다. 템플릿: `.env.production.example`
3. 적용: **`pm2 restart bongtour --update-env`** (환경만 바꿔도 Next 런타임이 읽도록 **반드시** 재시작)
4. (선택) 서버 프로젝트 디렉터리에서 동일 env로 스모크: `npm run test:inquiry-smtp` — `sendMail ok` 확인
5. 코드·CSP 변경이 포함된 배포면: `git pull && npm ci && npm run build && pm2 restart bongtour --update-env`

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
