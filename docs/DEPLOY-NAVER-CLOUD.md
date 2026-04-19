# 네이버 클라우드 Ubuntu 배포 (Node 20 / PM2 / nginx)

BongTour Next.js 앱을 단일 서버에 올릴 때의 최소 절차입니다. 공급사 스크래퍼·어댑터 코드와 무관합니다.

- **비밀 파일**: 루트 `.env.production`은 `.gitignore`에 포함되어 **커밋되지 않습니다**. 저장소에는 `.env.production.example`만 두고, 서버에서 `cp .env.production.example .env.production` 후 편집하세요.
- **문의 관리자 메일(SMTP)**: `docs/OPS-INQUIRY-SMTP.md` — 배포 후 `pm2 restart … --update-env`, 검증은 `npm run test:inquiry-smtp`.

## 전제

- **Node**: 20.x (`package.json`의 `engines.node` 참고)
- **DB**: Prisma **SQLite** — 동시 쓰기에 약하므로 **PM2는 인스턴스 1개(fork)** 만 사용합니다. Cluster 모드로 여러 프로세스를 띄우지 마세요.
- **Prisma 클라이언트**: `npm run build` 전에 `prisma generate`가 필요합니다. 저장소에는 `prebuild`로 `npm run build` 직전에 자동 실행됩니다.

## 최초 배포 순서

1. 서버에 저장소 클론(또는 아티팩트 배치)
2. 프로젝트 루트에 `.env.production` 또는 `.env.local` 생성 — 아래 예시·`.env.example` 참고
3. `DATABASE_URL`에 서버에서 쓰기 가능한 경로 지정(예: `file:/var/www/bongtour/prisma/prod.db`)
4. 의존성 및 빌드:

```bash
cd /path/to/bongtour
npm ci
# prebuild 훅으로 prisma generate 가 build 직전에 실행됨
npm run build
```

5. 기동:

```bash
NODE_ENV=production PORT=3000 npm run start
```

## 재배포 순서

```bash
cd /var/www/bongtour
git pull
npm ci
npm run build
pm2 restart bongtour --update-env
```

`next.config.js`의 CSP 등 **헤더 변경은 반드시 `npm run build` 후** 재시작해야 브라우저에 반영된다.

## PM2 (단일 인스턴스)

```bash
pm2 start npm --name bongtour -- start
# 또는
pm2 start node_modules/next/dist/bin/next --name bongtour -- start
```

- **instances: 1** 유지. SQLite 사용 시 scale-out/ cluster 금지.

## nginx

- `next start` 기본 포트: **3000** (`PORT` 미설정 시)
- TLS 종료는 nginx, 앱에는 **`Host` · `X-Forwarded-Proto` · `X-Forwarded-For`** 전달 (Auth.js·CSP·RSC에 필요)

**적용 가능한 예시 파일:** 저장소 `deploy/nginx-bongtour-site.conf.example`

1. 서버에 복사 후 인증서 경로·`server_name` 확인
2. `sudo nginx -t` → `sudo systemctl reload nginx`

예시는 **`www.bongtour.com` → `https://bongtour.com` 301** 과 **canonical 호스트 `bongtour.com`용 reverse proxy** 를 포함한다.  
운영 env는 **`NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` / `NAVER_CALLBACK_URL` 호스트를 실제 canonical 과 동일하게** 맞출 것 (예: 모두 `https://bongtour.com`).

## 환경 변수 (필수에 가까운 것)

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | SQLite 파일 URL. 미설정 시 `lib/prisma.ts`에서 기동 실패 |
| `AUTH_SECRET` 또는 `NEXTAUTH_SECRET` | 운영 필수 |
| `NEXTAUTH_URL` | 공개 사이트 베이스 URL (https 권장). `getSiteOrigin()` 폴백에도 사용 |
| `NEXT_PUBLIC_SITE_URL` | 선호. 공개 URL·SEO·메타 |
| `NEXT_PUBLIC_APP_URL` | `NEXT_PUBLIC_SITE_URL` 보조 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` / `NAVER_CALLBACK_URL` | 네이버 로그인 사용 시 필수. `NAVER_CALLBACK_URL`은 네이버 개발자센터에 등록한 Callback URL과 **완전히 동일**해야 함 — 보통 `https://도메인/api/auth/naver/callback` (`.env.example` 참고) |
| 문의 SMTP 일곱 키 + 수신 | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`, `INQUIRY_NOTIFICATION_EMAIL` — 로컬에서 통과한 값을 서버 `.env.production`에 복사 후 `pm2 restart bongtour --update-env`. 절차: `docs/OPS-INQUIRY-SMTP.md` §3 |

기능별 선택 변수는 루트 `.env.example` 전체를 참고하세요.

## 운영 리스크 요약

1. **AUTH / NEXTAUTH_URL** 미설정 → 세션·OAuth 이상
2. **DATABASE_URL** 오류 → 기동 불가
3. **PM2 cluster + SQLite** → 잠금/손상 위험
4. **NEXT_PUBLIC_* 미설정** → 빌드 시점에 localhost가 박힐 수 있음 — 배포 전 `NEXT_PUBLIC_SITE_URL` 등 설정 후 빌드 권장
5. **Puppeteer·외부 API** → 서버 패키지·키·타임아웃 별도 점검
6. **네이버 로그인** → 개발자센터 Callback URL이 `/api/auth/callback/naver`가 아니라 **`/api/auth/naver/callback`** 이어야 하며, `NAVER_CALLBACK_URL`·`NEXTAUTH_URL`의 호스트(www 유무)·`https`가 실제 접속과 일치해야 함

## `.env.production` 예시 (값은 실제로 교체)

```env
NODE_ENV=production
PORT=3000

DATABASE_URL="file:/var/www/bongtour/prisma/prod.db"

AUTH_SECRET="여기에_강한_랜덤_문자열"
NEXTAUTH_URL="https://your-domain.example.com"
NEXT_PUBLIC_SITE_URL="https://your-domain.example.com"
NEXT_PUBLIC_APP_URL="https://your-domain.example.com"

BONGTOUR_API_BASE="https://your-domain.example.com"
```

---

`DATABASE_URL`은 `lib/prisma.ts`에서 비어 있으면 즉시 예외를 던지도록 유지됩니다. 운영에서는 반드시 서버 경로로 설정하세요.
