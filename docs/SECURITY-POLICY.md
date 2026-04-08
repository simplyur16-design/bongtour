# 봉투어 보안/인증 정책

## 1. 개발 vs 운영 정책 비교

| 구분 | 로컬 개발 (`NODE_ENV=development`, 명시 플래그) | 운영·프리뷰(production 성격) |
|------|-----------------------------------------------|------------------------------|
| **임시 우회 허용** | `BONGTOUR_DEV_ADMIN_BYPASS=true` **이고** `VERCEL_ENV !== 'production'` **이고** `ADMIN_BYPASS_SECRET` 일치 시에만 `?auth=`·`admin_bypass` 쿠키로 `/admin/*`·`/api/admin/*` 우회 가능. | **절대 비활성.** `NODE_ENV=production` 또는 `VERCEL_ENV=production` 이면 `isDevAdminBypassRuntimeAllowed()` 가 항상 false. |
| **layout (getAdminSession)** | 위 런타임 허용 **+** `ALLOW_MOCK_ADMIN=true` 일 때만 mock admin. | 세션 없으면 null → production 에서 redirect('/auth/signin'). |
| **API (requireAdmin 등)** | 세션 없을 때: 동일 런타임 허용 하에 바이패스 쿠키 또는 ALLOW_MOCK_ADMIN mock. | 세션 + role 만. 없으면 401. |
| **등록 미리보기 토큰** | `REGISTRATION_PREVIEW_SECRET` 미설정 시 AUTH_SECRET 또는 개발 전용 fallback 허용. | `REGISTRATION_PREVIEW_SECRET` **또는** 개발 플레이스홀더가 아닌 `AUTH_SECRET` 필수. 누락 시 토큰 발급/검증 실패. |

**의도:** 운영에서 `BONGTOUR_DEV_ADMIN_BYPASS` 를 실수로 켜도 `NODE_ENV=production` 이면 우회가 열리지 않는다. 로컬에서는 `.env.local` 에 `BONGTOUR_DEV_ADMIN_BYPASS=true` 를 명시해야 임시 접근이 켜진다.

## 2. 기준 일치 여부

- **middleware**: req.auth (NextAuth) 기준. role 불일치 시 /auth/error.
- **layout**: getAdminSession() (auth() 또는 mock) 기준. production 에서 null 이면 redirect.
- **API**: requireAdmin() / requireMembersEditor() 등 (auth() 또는 개발 시 mock·바이패스 쿠키) 기준.

**공통 조건:** `lib/admin-bypass.ts` 의 `isDevAdminBypassRuntimeAllowed()` → `isAdminBypassAllowed()`. 운영·Vercel production 배포에서는 항상 우회 불가.

## 3. 테스트 시나리오

| # | 시나리오 | 예상 결과 |
|---|----------|-----------|
| 1 | 비로그인 상태에서 /admin 접근 (production) | middleware가 /auth/signin 으로 리다이렉트. |
| 2 | 비로그인 + development + `BONGTOUR_DEV_ADMIN_BYPASS` 미설정 또는 false | 우회 비활성 → signin 리다이렉트(또는 instrumentation 안내). |
| 3 | 비로그인 + development + `BONGTOUR_DEV_ADMIN_BYPASS=true` + `?auth=<ADMIN_BYPASS_SECRET>` | middleware 통과·쿠키 설정. **동일 출처 `/api/admin/*`** 는 바이패스 쿠키로 middleware·requireAdmin 통과 가능. |
| 4 | 위 3과 동일 + 쿠키 전송 fetch | ALLOW_MOCK_ADMIN 없어도 바이패스 쿠키 일치 시 requireAdmin mock 가능. |
| 4b | development + `BONGTOUR_DEV_ADMIN_BYPASS=true` + ALLOW_MOCK_ADMIN=true + **쿠키 없이** `/api/admin/*` 만 호출 | middleware에서 401. 먼저 `/admin?auth=…` 로 쿠키 또는 정상 로그인 필요. |
| 5 | 비관리자 로그인(role !== ADMIN) 후 /admin | middleware에서 /auth/error 리다이렉트. |
| 6 | 관리자 로그인(role=ADMIN) 후 /admin | layout·API 정상. |
| 7 | production 에서 `?auth=아무값` | bypass 비활성 → 세션 없으면 signin 리다이렉트. |

## 4. 등록대기(`/admin/pending`)와 `인증이 필요합니다`

개발에서 **`/admin?auth=<secret>` 로 쿠키가 잡힌 뒤**에는 `/api/admin/*` 도 동일 바이패스로 통과한다(`lib/admin-bypass.ts`).

**운영(production)** 에서는 바이패스가 없으므로 **세션 없이 API를 호출하면 401**이며, 이는 정상이다.

**실제 기능 검증**은 **정상 관리자 로그인** 기준으로 하고, **바이패스·mock** 은 개발에서만 **제한적으로** 사용한다.

## 5. `Verify stylesheet URLs` 경고 시 조사 순서

**vendor-chunks ENOENT / `/_next/static` 404 연쇄** 는 미들웨어보다 **`.next` 산출물 꼬임**이 흔한 1차 원인이다. 복구 절차는 [DEV-NEXT-CACHE.md](./DEV-NEXT-CACHE.md) 를 따른다.

`middleware.ts` 는 `matcher` 상 **`/_next/static/*` 등 정적 경로를 다루지 않으므로**, Next 앱 CSS가 미들웨어에 의해 막히는 구조로 보이지 않는다.

조치 순서:

1. 브라우저 **Network**에서 실패한 stylesheet의 **전체 Request URL** 을 특정한다.
2. 그 URL이 **Next 앱 CSS**(`/_next/static/...`)인지, **외부 폰트·서드파티·GTM·확장 프로그램** 리소스인지 분류한다.
3. **현 단계**에서는 미들웨어를 크게 수정하기보다 **Network 기준 실측**이 우선이다.

### 5.1 `layout.css?v=...` 경고

현재 저장소 기준으로 **`layout.css` 참조나 수동 stylesheet `<link>` 는 없으므로**, `layout.css?v=...` 경고는 **앱 코드가 직접 만든 요청일 가능성이 낮다.**

먼저 **Network**의 전체 **Request URL** 과 **Initiator** 를 확인하고, **시크릿 창**에서 재현 여부를 비교해 **외부 주입·확장·환경** 문제인지 분류한 **뒤에만** 코드 수정을 검토하는 것이 맞다.

## 6. 남은 보안 구멍 (추가 적용 권장)

- 아래 admin API들은 아직 requireAdmin 미적용. 동일하게 맨 앞에 `requireAdmin()` 추가 권장.
  - GET/POST `app/api/admin/products/route.ts`
  - GET `app/api/admin/products/list/route.ts`
  - GET/PATCH/DELETE `app/api/admin/products/[id]/route.ts`
  - 기타 `/api/admin/*` 라우트 전역

## 7. 보안 2단계(운영 봉인) 완료 조건 요약

- **개발 임시 접근:** 로컬에서만 `BONGTOUR_DEV_ADMIN_BYPASS=true` + `ADMIN_BYPASS_SECRET` (+ 필요 시 `ALLOW_MOCK_ADMIN`) 로 제한. 운영에서는 해당 분기가 코드상 true 가 될 수 없음(`NODE_ENV`·`VERCEL_ENV` 이중 봉인).
- **미리보기 토큰:** 운영에서 `REGISTRATION_PREVIEW_SECRET` 또는 유효한 `AUTH_SECRET` 필수. 개발 전용 fallback 문자열·AUTH 플레이스홀더는 운영에서 사용 불가.
- **관리자 API:** `requireAdmin` / `requireMembersViewer` / `requireMembersEditor` 패턴으로 인증·권한 분리(401 미인증 / 403 권한 부족).

## 8. 운영 배포 전 확인 체크리스트 (3~5)

1. 배포 환경에 `NODE_ENV=production` 이고, **우회용** `BONGTOUR_DEV_ADMIN_BYPASS` 가 `true` 로 들어가 있지 않은지 확인한다.
2. `REGISTRATION_PREVIEW_SECRET` 을 설정했거나, **개발 플레이스홀더가 아닌** 강한 `AUTH_SECRET` 이 있는지 확인한다.
3. `ADMIN_BYPASS_SECRET` 은 운영에 두지 않거나, 있다면 우회가 물리적으로 불가능한지(위 1번) 재확인한다.
4. Vercel 등에서 `VERCEL_ENV=production` 인 프로젝트에 개발용 시크릿이 노출되지 않았는지 확인한다.
5. 관리자 로그인 없이 `/admin`·`parse-and-register` confirm 이 **운영 URL**에서 불가능한지 스모크 테스트한다.
