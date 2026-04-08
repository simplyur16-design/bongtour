# Next.js 로컬 개발: `.next` / webpack dev 산출물 꼬임 복구

## 원칙

**기능·보안·CSS 코드를 고치기 전에**, 먼저 아래 **복구 순서**로 dev 서버 상태를 정상화한다. 대부분의 stylesheet / chunk / vendor 오류는 **`.next` 산출물 불일치**에서 온다.

---

## 증상 분류

| 증상 | 메모 |
|------|------|
| Chrome **Verify stylesheet URLs** / stylesheet 로드 실패 | Network에서 `/_next/static/css/app/layout.css?...` 가 **404/500** 등. HTML의 `href`는 보통 **절대경로가 맞음**. |
| `/_next/static/*` **404** (JS/CSS) | HTML이 가리키는 포트·호스트와 브라우저 접속이 다르거나, 산출물이 꼬인 경우. |
| 서버 로그 **`Cannot find module './9276.js'`** (숫자는 변동) | `.next/server` webpack 청크와 실제 파일 불일치. |
| **vendor-chunks** ENOENT / resolve 실패 | `.next/server/vendor-chunks/...` 누락·불일치. |

위 증상은 **잘못된 `import './globals.css'`** 나 **`?auth=` 때문에 상대경로가 깨진 것**이 아닐 가능성이 높다. 직접 원인은 대개 **중단된 `next dev`**, **여러 포트의 dev 동시 실행(로컬은 `http://localhost:3000` 고정 — `npm run dev`가 `next dev -p 3000`)**, **`next build` 산출물과 `next dev` 혼용**, **손상된 `.next` / `node_modules/.cache`** 등이다.

### middleware / `?auth=` / admin bypass 와의 관계

- **`/_next/static/*`·CSS 요청은** `middleware` **matcher 밖**이라 바이패스·인증과 **직접 연관되지 않는다.**
- DevTools 소스가 `admin?auth=...:1`처럼 보이는 것은 **열려 있는 페이지 URL** 표시일 뿐, stylesheet `href`가 쿼리 기준으로 해석되는 것이 아니다.
- **dev bypass** 설정은 그대로 두며, 이 문서는 **산출물 복구 절차**만 다룬다.

---

## 복구 순서 (3단계)

1. **실행 중인** `next dev` / `next start` 및 동일 프로젝트에 묶인 **node** 프로세스를 **모두 종료**한다.
2. 프로젝트 루트에서 **`npm run dev:clean`** 을 실행한다 (`clean:next` 후 `next dev -p 3000` 기동).
3. 브라우저는 **`http://localhost:3000`** 으로만 접속한다 (`NEXTAUTH_URL`·`NEXT_PUBLIC_*` 도 동일 origin).

`dev:clean`이 하는 일: `scripts/clean-next.js`로 **`.next` 전체** 및 **있을 때만 `node_modules/.cache`** 삭제 후 `next dev -p 3000` 재기동.  
스크립트 요약: `scripts/README-dev.md`.

---

## 일상 개발

- **`npm run dev`** — 이미 `.next`가 정상일 때 빠른 재시작(항상 **3000**).
- chunk 404·stylesheet 이상·vendor ENOENT가 보이면 **`npm run dev:clean`**.

---

## 설정 (참고)

- `next.config.js`의 `experimental.optimizePackageImports: ['lucide-react']` 는 lucide 사용량을 줄여 chunk 분절을 완화한다.

---

## parse-and-register(전용·공용) 등 API 500

UI·정적 자산이 **정상화된 뒤에도** 관리자 등록 API(`POST /api/travel/parse-and-register-modetour` · `…-verygoodtour` · `…-hanatour` · `…-ybtour`(레거시 `…-yellowballoon`) 또는 잔여 `POST /api/travel/parse-and-register`)가 500이면, 그때 서버 로그·`stage`를 본다. 앞선 증상은 **산출물 꼬임의 2차 증상**인 경우가 많다.

---

## 보안 분기와 dev 증상 분리 (요약)

| 증상 | 보안 변경과의 관계 | 비고 |
|------|-------------------|------|
| HTML 200 + `/_next/static/*` 404 | **직접 관계 낮음** | 포트·`.next` 꼬임·다중 `next dev` → 위 **복구 순서**. |
| `hasAuthSession: false` + `isBypassAllowed: true` | **의도된 dev 동작** | `BONGTOUR_DEV_ADMIN_BYPASS=true` + secret + `?auth=` 또는 쿠키. |
| `POST /api/travel/parse-and-register*` **401** | **경로별** | middleware 미적용; `requireAdmin()` + 쿠키. |
| 동일 계열 POST **500** | **대부분 비관** | 로그 prefix는 `[parse-and-register-modetour]` 등 브랜드별·`[parse-and-register]`(공용/fallback) — `fail` 의 `stage` 확인. |
| `registration-preview-token` | **dev 폴백** | `production` 에서만 강제. |

**유지할 보안:** `NODE_ENV` / `VERCEL_ENV` 봉인, `BONGTOUR_DEV_ADMIN_BYPASS` 명시, 운영 preview secret, middleware 정적 early return.
