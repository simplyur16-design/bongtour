# `missing required error components, refreshing...` 점검

브라우저·Next 개발 오버레이에 **`missing required error components, refreshing...`** 가 보일 때, 대개 **현재 페이지가 500 등으로 깨졌고**, Next가 **에러 화면을 그릴 최소 컴포넌트까지 정상적으로 불러오지 못해** 새로고침 재시도를 하는 상태로 해석할 수 있다.

## 원인 파악 핵심 (stylesheet보다 앞)

**현재는 stylesheet 문제보다 document / SSR 실패를 먼저 본다.**

- **`/admin?auth=...`** (또는 해당 URL)의 **Network → document 요청**: **Status**, **Content-Type**, **Response 본문 첫 줄** (`<!DOCTYPE` 여부 포함).
- **`next dev` 터미널**의 **첫 스택 트레이스** (같은 시각에 찍힌 서버 오류).

위 둘이 원인 파악의 중심이다. 스타일시트·CSS는 그다음이다.

## 점검 순서 (우선순위)

1. **문서 요청(Document)의 HTTP 상태**  
   DevTools **Network**에서 최상위 HTML(문서) 요청이 **500**인지 확인한다.

2. **서버 로그**  
   터미널에서 `next dev` / 배포 로그의 **스택 트레이스**를 확인한다 (React 렌더 오류, `layout`/`page` 예외 등).

3. **root layout**  
   `app/layout.tsx` 의 `<html>` / `<body>` 구조가 유효한지, 서버 컴포넌트에서 **던져지는 예외**가 없는지 본다.

4. **`global-error.tsx` / `error.tsx`**  
   App Router에서는 경계별 에러 UI를 위해 `app/error.tsx`, 루트 전역이면 `app/global-error.tsx` 를 둘 수 있다.  
   **현재 저장소**: `app/error.tsx`, `app/global-error.tsx` **없음** — 필요 시 [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling) 기준으로 추가·검증한다.

## 참고

- 근본 원인은 거의 항상 **에러 UI 부재**가 아니라 **그 전에 발생한 500/런타임 오류**이다. 로그와 문서 500부터 잡는다.

---

## Quirks Mode (`/admin?auth=...` 등)

MDN 기준, **Quirks Mode**는 보통 문서 시작부에 `<!doctype html>` 이 없거나, **정상 HTML이 아닌 비정상 응답**이 문서로 렌더링될 때 발생한다.

### 점검 순서

1. **`/admin?auth=...` 문서 요청** — Network에서 **Status**, **Content-Type**, **Response body 첫 줄** 확인.
2. Response 맨 앞에 **`<!DOCTYPE html>`** (또는 `<!doctype html>`) 존재 여부.
3. **View Source** 로도 첫 줄이 동일한지 확인 (클라이언트만 수정된 것과 구분).
4. **`app/layout.tsx`** — `<html>`, `<body>` 를 반드시 렌더하는지 (현재 저장소: **있음**).
5. **`app/global-error.tsx` / `app/error.tsx`** — 존재 여부·전역 에러 fallback (현재 저장소: **둘 다 없음**, 선택 사항).
6. **`missing required error components, refreshing...`** 와 Quirks Mode — **같은 원인 축**(문서/SSR 실패·500)일 수 있으나, **독립 증거**로 각각 Network·로그로 확인한다.
7. **CSS를 먼저 고치지 말 것** — 문서가 **정상 HTML인지**부터 확정한다.

### `layout.css?v=...` 와 Next 번들

Network **이름** 열에 `layout.css?v=...` 만 보일 수 있으나, 실제 **Request URL** 은 종종 **`/_next/static/css/app/layout.css?v=...`** 이다(Next 14 App Router·`app/layout` 기준). 이는 **비정상 루트 경로가 아니라** 일반적인 번들 CSS다. 분류할 때는 **전체 URL** 을 연다.

### 저장소 점검 요약 (코드만)

| 항목 | 결과 |
|------|------|
| `app/layout.tsx` | `<html lang="ko">` + `<body>` 있음 |
| `app/global-error.tsx` | 없음 |
| `app/error.tsx` | 없음 |

### 원인 후보 (우선순위)

1. **문서 응답이 HTML이 아님** — 500 본문이 JSON/플레인 텍스트, 또는 **DOCTYPE 없는** 에러 HTML.
2. **리다이렉트/프록시** — 최종 문서가 아닌 중간 응답이 문서 창에 남는 경우(드묾).
3. **확장 프로그램·개발자 도구** — 표시만 Quirks 로 잘못 나오는 경우(드묾). 시크릿으로 재확인.

### 가장 안전한 수정안

- **Network**에서 문서 요청의 **Status·Content-Type·첫 바이트** 로 **정상 HTML 여부**를 먼저 확정한다.
- **500 + 서버 로그** 가 있으면 **그 스택**을 수정한다 (`layout`/`admin` 서버 컴포넌트 예외 등).
- `error.tsx` / `global-error.tsx` 는 **UX·복구**용으로 추가할 수 있으나, **DOCTYPE 누락의 근본**은 보통 **앞선 렌더 실패**이다.
