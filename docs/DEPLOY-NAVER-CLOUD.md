# 네이버 클라우드 Ubuntu 배포 (Node 20 / PM2 / nginx)

BongTour Next.js 앱을 단일 서버에 올릴 때의 최소 절차입니다. 공급사 스크래퍼·어댑터 코드와 무관합니다.

- **비밀 파일**: 루트 `.env.production`은 `.gitignore`에 포함되어 **커밋되지 않습니다**. 저장소에는 `.env.production.example`만 두고, 서버에서 `cp .env.production.example .env.production` 후 편집하세요.

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
git pull
npm ci
npm run build
pm2 restart bongtour
```

## PM2 (단일 인스턴스)

```bash
pm2 start npm --name bongtour -- start
# 또는
pm2 start node_modules/next/dist/bin/next --name bongtour -- start
```

- **instances: 1** 유지. SQLite 사용 시 scale-out/ cluster 금지.

## nginx

- `next start` 기본 포트: **3000** (`PORT` 미설정 시)
- `proxy_pass http://127.0.0.1:3000;` (또는 PM2가 바인딩한 포트)
- TLS 종료는 nginx에서 처리하고, 앱에는 `X-Forwarded-Proto` / `Host` 전달

## 환경 변수 (필수에 가까운 것)

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | SQLite 파일 URL. 미설정 시 `lib/prisma.ts`에서 기동 실패 |
| `AUTH_SECRET` 또는 `NEXTAUTH_SECRET` | 운영 필수 |
| `NEXTAUTH_URL` | 공개 사이트 베이스 URL (https 권장). `getSiteOrigin()` 폴백에도 사용 |
| `NEXT_PUBLIC_SITE_URL` | 선호. 공개 URL·SEO·메타 |
| `NEXT_PUBLIC_APP_URL` | `NEXT_PUBLIC_SITE_URL` 보조 |

기능별 선택 변수는 루트 `.env.example` 전체를 참고하세요.

## 운영 리스크 요약

1. **AUTH / NEXTAUTH_URL** 미설정 → 세션·OAuth 이상
2. **DATABASE_URL** 오류 → 기동 불가
3. **PM2 cluster + SQLite** → 잠금/손상 위험
4. **NEXT_PUBLIC_* 미설정** → 빌드 시점에 localhost가 박힐 수 있음 — 배포 전 `NEXT_PUBLIC_SITE_URL` 등 설정 후 빌드 권장
5. **Puppeteer·외부 API** → 서버 패키지·키·타임아웃 별도 점검

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
