# 봉심(BONGSIM) × USIMSA 통합 계획

**범위:** 분석·계획 문서만 (코드 변경 없음).  
**근거:** `app/travel/esim`, `EsimCityHub`, `app/api/usimsa`, `lib/usimsa`, `docs/BONGSIM_*.md`, `docs/BONGTOUR_*BONGSIM*.md`, `docs/USIMSA_API_ANALYSIS_20260422.md`, Postman 컬렉션 JSON fetch(2026-04-22 기준).

---

## 1. 현재 상태

### 1.1 공개 E-SIM 페이지 (`/travel/esim`)

| 항목 | 상태 |
|------|------|
| **엔트리** | `app/travel/esim/page.tsx` — `Header`, `OverseasTravelSubMainNav`, `?city=` 쿼리로 도시 선택. |
| **UI** | `app/components/travel/esim/EsimCityHub.tsx` — 도시 탭(`Link`), `dangerouslySetInnerHTML`로 `esimEmbedHtml` 삽입, 선택적 `next/script`로 외부 스크립트. |
| **데이터** | `lib/travel-esim-city-config.ts` — `ESIM_CITY_ENTRIES` 정적 배열(도쿄/오사카/방콕 등), **상업용 카탈로그·주문 없음**. |
| **결제·주문·DB** | 이 경로 전용 **없음** (`docs/BONGTOUR_CURRENT_ESIM_AUDIT_FINAL.md`와 일치). |

### 1.2 `app/api/usimsa/`

| 경로 | 역할 |
|------|------|
| `GET /api/usimsa/health` | `{ ok, service: "usimsa-webhook" }` 고정 응답 — 운영 헬스/프로브용으로 추정. |
| `POST /api/usimsa/webhook` | JSON 파싱 실패 시 400, 성공 시 본문 요약 로그 후 **항상 200** — **영속화·서명 검증·멱등 없음**. |

### 1.3 `lib/usimsa/` (서버 전용 연동 골격)

| 모듈 | 역할 |
|------|------|
| `config.ts` | `USIMSA_BASE_URL` 또는 `USIMSA_ENV`로 prod/dev 베이스 URL, `USIMSA_ACCESS_KEY` / `USIMSA_SECRET_KEY` 필수. `USIMSA_WEBHOOK_SECRET`, `USIMSA_WEBHOOK_URL`은 읽기만 하고 **웹훅 라우트에서 미사용**. |
| `signature.ts` | `x-gat-*`용 StringToSign + HMAC-SHA256(Base64 secret) + Base64 서명. |
| `client.ts` | `usimsaRequest` — 공통 헤더, `fetch`, 비 OK 시 `UsimsaRequestError`. |
| `products.ts` | **`GET /v2/products`만** 호출·DTO 정규화(`fetchUsimsaProducts`). |

**정리:** 봉투어 저장소에는 **USIMSA 상품 조회 + 웹훅 스텁 + 서명 클라이언트**까지 있으나, **발급 주문·취소·연장·조회 API는 미연결**, **프런트 `/travel/esim`과도 미연결**.

### 1.4 Postman 문서 fetch (Usimsa Partner API v2)

- **접근:** `https://documenter.gw.postman.com/api/collections/33332387/2sB3QDwt5F?segregateAuth=true&versionTag=latest` → **HTTP 200**, 약 184KB (curl 기준).
- **엔드포인트(컬렉션 기준, 베이스 `…/api` + path):**

| Method | Path | 설명(컬렉션 표기) |
|--------|------|-------------------|
| POST | `/v2/order` | eSIM 발급 요청 |
| POST | `/v2/cancel/:topupId` | eSIM 취소 |
| POST | `/v2/cancel/usim/:topupId` | USIM 취소 |
| POST | `/v2/order/usim` | USIM 활성화 |
| POST | `/v2/extend` | 연장 |
| GET | `/v2/products` | 상품 조회 (**봉투어에서 유일 구현**) |
| GET | `/v2/order/:orderId` | 주문 조회 |
| GET | `/v2/topup/:topupId` | ICCID/topup 상태 |
| GET | `/v2/topup/:topupId/usage/daily` | 일별 사용량 |

상세 필드·웹훅 페이로드는 `docs/USIMSA_API_ANALYSIS_20260422.md` 참고.

### 1.5 `docs/BONGSIM_*.md` 네 편 요약

`docs/` 기준 **`BONGSIM_*.md` 패턴 파일은 2개**뿐이며, 나머지 2편은 **BONGTOUR 접두**의 봉심 연동 문서로 함께 요약한다.

| 문서 | 한 줄 요약 |
|------|------------|
| **`BONGSIM_MIGRATION_INPUT.md`** | Bongtour의 E-SIM은 플레이스홀더뿐이며 **카트·결제·주문·웹훅은 재구축**; BONGSIM 권장 라우트·컴포넌트·목 데이터·**usimsa 어댑터 슬롯** 제안. *(문서 내 “Bongtour에 usimsa 없음” 구절은 현재 코드와 불일치 — 레거시 서술로 간주.)* |
| **`BONGSIM_UI_REFERENCE_FROM_BONGTOUR.md`** | `/travel/esim` 주변 **헤더·서브내비·탭·타이포·카드 클래스**를 복제용 레퍼런스로 정리; `dangerouslySetInnerHTML`/플레이스홀더는 **재사용 비권장**. |
| **`BONGTOUR_CURRENT_ESIM_AUDIT_FINAL.md`** | 메뉴·라우트·컴포넌트 **감사 결과**; 백엔드·DB·주문 **없음**; Bongtour에 상거래 이심 풀스택 넣는 **리스크**와 **별도 BONGSIM** 권장 근거. |
| **`BONGTOUR_BONGSIM_INTEGRATION_BASE.md`** | 브랜드(봉투어 vs 봉심), **라우트/링크 전략**, UI·데이터 **공통 규칙**, **소유 경계**(주문 상태·PCI·시크릿 단일 소스) 정책 초안. |

---

## 2. USIMSA(및 운영)에 추가 요청할 정보

다음은 공개 Postman 문서·기존 분석만으로는 **결정 불가**이거나 **사고 방지**에 필요한 항목이다.

1. **웹훅 인증:** 콜백에 **HMAC·공유 시크릿 헤더·IP 고정** 등이 있는지; 없다면 권장 보완책.
2. **웹훅 재시도:** 재전송 횟수·간격·**멱등 키** 권장 패턴; HTTP 응답 타임아웃 기준.
3. **필드명 안정성:** `qrcodeImgUrl` vs `qrCodeImgUrl` 등 **문서/실응답 일치** 표.
4. **`code` / `message` 전체 코드표** 및 HTTP 상태와의 매핑(실패 시 파싱 규칙).
5. **환불·정산 API:** 소개 문구에만 있고 컬렉션에 없는 **별도 스펙** 존재 여부.
6. **콜백 URL 등록 절차:** 환경별(dev/prod) URL, **Usimsa 측 반영 리드타임**.
7. **`orderId`와 웹훅:** 웹후에 파트너 `orderId`가 오는지; 없으면 **`topupId`만으로 역매핑**하는 공식 권장안.
8. **레이트 리밋·동시 주문** 제한 및 idempotency 키 지원 여부.
9. **가격·재고:** `GET /v2/products` 외 **실시간 재고/가격 변동** 알림 여부.
10. **규제·영수증:** 국내 PG/세금계산서와 별도로 Usimsa 측에서 제공해야 하는 **정산 증빙** 범위.

---

## 3. Phase별 구현 순서 (제안)

**전제:** 장기적으로 **BONGSIM이 주문·결제·USIMSA 풀필의 단일 소유자**인 방향이 문서들과 일치한다. 봉투어는 얇은 진입점만 유지한다.

| Phase | 목표 | 주요 산출물 |
|-------|------|-------------|
| **P0** | 사실 확인·계약 | 위 “추가 요청” 항목에 대한 Usimsa 답변, Bongtour↔Bongsim **도메인·링크** 확정 (`BONGTOUR_BONGSIM_INTEGRATION_BASE` 반영). |
| **P1** | BONGSIM 스캐폴드 | 별도 앱/레포에서 카탈로그 UI(목 데이터), 정책 페이지, **서버 전용** env에 Access/Secret. |
| **P2** | Usimsa 읽기 전용 | `GET /v2/products` 캐시·매핑(내부 SKU), (필요 시) **주문 조회/탑업 조회**로 상태 표시. |
| **P3** | 주문·발급 | `POST /v2/order`, 응답의 `topupId` 저장, **웹훅 수신**에서 LPA/QR 반영; 멱등·재시도 처리. |
| **P4** | 운영 완성 | `cancel` / `extend` / `usim` 경로는 SKU 정책에 맞게 노출; `usage`는 마이페이지·디테일에 선택적 표시. |
| **P5** | Bongtour 진입 | `/travel/esim`을 **봉심 URL로 리다이렉트** 또는 공식 위젯/iframe만 유지; 서브내비 `href` 변경은 북마크·SEO와 함께 릴리즈 노트. |
| **P6** | 관측·정산 | 로그/알람, 정산 데이터 API 제공 시 **대사** 파이프라인. |

봉투어 모노레포 안에서 **P3 이상을 풀스택으로 구현할지**는 스코프·보안·배포 분리 관점에서 **P0 의사결정** 후에만 진행하는 것이 안전하다.

---

## 4. 의사결정 필요 항목

1. **소유권:** USIMSA 주문·웹훅·고객 PII의 **시스템 of record**를 BONGSIM 단독으로 할지, 봉투어에 **일시 이중**할지.
2. **인증:** Bongtour 세션과 Bongsim 주문 조회를 **어떻게 연결**할지(SSO, 토큰 딥링크, 이메일 매직링크 등).
3. **결제:** 국내 PG vs Usimsa 과금 모델 — **고객 청구 주체**와 환불 책임 분리.
4. **`/travel/esim`의 미래:** 완전 리다이렉트 vs **짧은 안내 + 링크** 유지 vs Bongtour 내 **임베드**(법무·보안).
5. **웹훅 URL:** 프로덕션에서 `…/api/usimsa/webhook`(봉투어) vs **BONGSIM 전용 경로** — 하나만 진실 원천으로 둘 것.
6. **`USIMSA_WEBHOOK_SECRET`:** Usimsa가 검증 규격을 주지 않으면 **사용 목적(자체 토큰? 향후 HMAC?)** 재정의 또는 제거 정리.
7. **MVP SKU 범위:** 국가/일수/데이터량 컷라인과 **USIM vs eSIM** 노출 여부.
8. **문서 정합:** `BONGSIM_MIGRATION_INPUT.md`의 “usimsa 없음” 등 **현 코드와 모순되는 문구**를 다음 문서 패치 티켓에서 갱신할지.

---

## 5. 참고 링크 (문서·도구)

- Postman Documenter: `https://documenter.getpostman.com/view/33332387/2sB3QDwt5F`
- 봉투어 USIMSA API 분석: `docs/USIMSA_API_ANALYSIS_20260422.md`
- FAQ(원문 붙여넣기 대기): `docs/USIMSA_FAQ_20260422.md`
