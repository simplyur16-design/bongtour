# originUrl 기반 가격/달력 자동 수집 설계

## 1) originUrl 자동화 연결이 필요한 이유

- 봉투어는 **공급사 상품을 검수·연결하는 창구**이며, 공급사 일정/상품 내용을 다시 해석하거나 바꾸지 않는다.
- **자동화는 원본 상세페이지를 다시 열어 가격·달력·출발 가능 여부만 갱신**하는 데 쓰인다.
- `Product.originUrl`은 원본 상세 추적과 **자동 수집의 기준 키**다. 같은 URL로 재방문해 최신 가격/달력을 가져와 `ProductPrice`를 보강한다.
- 수동으로 매번 공급사 사이트를 열어 확인하는 부담을 줄이고, 고객 노출 가격·출발일 목록을 일정 수준으로 유지하기 위함이다.

---

## 2) 최소 수집 범위

- **날짜**: 출발일(달력에서 선택 가능한 날짜 목록).
- **가격**: 출발일별 성인/아동(베드·노베드)/유아 요금. 기존 `ProductPrice` 필드와 1:1 매핑 가능한 수준.
- **출발 가능 여부**: 해당 날짜에 출발 가능한지(예: 마감/취소 아님).
- **좌석/예약 상태**: 선택. “잔여석 N석”, “예약마감” 등이 있으면 수집해 표시·필터에 활용할 수 있음. MVP에서는 가격·날짜만 필수로 두고, 상태는 후속 확장으로 둘 수 있다.

---

## 3) 연결 구조 제안

### 3.1 자동 수집 대상 정의

- **대상**: `Product` 중 **originUrl이 비어 있지 않고**, `http://` 또는 `https://` 로 시작하는 상품.
- **추가 필터(선택)**:  
  - `registrationStatus = 'registered'` 인 상품만 수집하거나,  
  - 관리자가 “가격 동기화”를 요청한 상품만 큐에 넣는 방식.  
- **우선순위**: 기존 `ScraperQueue`에 넣어 순차 처리하거나, “1회 동기화” 시 해당 상품 1건만 즉시 실행.

### 3.2 공급사별 분기

- **필요함.** 하나투어/모두투어/노랑풍선 등 **도메인·페이지 구조가 다르므로**, 공급사(브랜드)별로 다른 수집 로직이 필요하다.
- **구분 키**: `Product.brandId` → Brand.brandKey, 또는 `Product.originSource` 문자열. `originUrl` 호스트/경로 패턴으로도 보조 판별 가능.
- **구현 형태**: `lib/price-sync/` 또는 `lib/scrapers/` 아래에 `hanatour.ts`, `modetour.ts` 등 **어댑터**를 두고, URL/브랜드에 따라 하나를 선택해 실행. 공통 인터페이스: `fetchPriceCalendar(originUrl: string, productId: string): Promise<PriceCalendarResult>`.

### 3.3 Product / ProductPrice 연결

- **Product**: 변경하지 않음. `originUrl`, `originSource`, `brandId`는 읽기 전용으로만 사용.
- **ProductPrice**:  
  - **출발일(date)** 기준으로 upsert. `(productId, date)` unique이므로, 수집한 날짜별 행을 그대로 upsert.  
  - 필드: `date`, `adult`, `childBed`, `childNoBed`, `infant`, `localPrice`, `priceGap`.  
  - 출발 가능 여부/좌석 상태를 넣으려면 후속으로 `status`(예: `available` / `sold_out`), `seatCount` 등 컬럼 추가 검토.
- **일정/상품 내용**: 수정하지 않음. `schedule`, `title`, `destination` 등은 기존 등록·검수 데이터 유지.

### 3.4 큐·스케줄러와의 연결

- **ScraperQueue**: 이미 `productId` 단위로 존재. “가격 동기화 1회” 시 해당 상품을 큐에 넣고, **워커(또는 run-once)** 가 큐를 소비하면서 `originUrl`을 열어 가격/달력만 수집 → ProductPrice upsert.
- **스케줄러**: 주기 실행(예: 매일 새벽)에서 “originUrl이 있는 상품 중 등록 완료 상품”을 큐에 넣거나, 큐에 쌓인 건만 순차 처리. 기존 `run-once`와 동일한 큐 소비 로직을 재사용할 수 있음.

---

## 4) 수정/생성할 파일 목록

| 파일 | 용도 |
|------|------|
| `docs/ORIGIN-URL-PRICE-SYNC-DESIGN.md` | 본 설계 문서 (이 파일) |
| `lib/price-sync/types.ts` | 공통 타입: `PriceCalendarResult`, `PriceRow` 등 |
| `lib/price-sync/dispatch.ts` | originUrl/브랜드에 따라 어댑터 선택 후 `fetchPriceCalendar` 호출 |
| `lib/price-sync/upsert-prices.ts` | 수집 결과를 ProductPrice upsert (productId, date 기준) |
| `lib/price-sync/adapters/hanatour.ts` | 하나투어 상세 페이지 파싱 (예시 1개) |
| `app/api/admin/products/[id]/sync-price/route.ts` | 단일 상품 “가격 동기화 1회” API (관리자 전용) |
| `app/api/admin/price-sync/run/route.ts` | (선택) 큐 1건 소비 또는 N건 배치 실행 API |
| `app/admin/products/[id]/page.tsx` | “가격 동기화 1회” 버튼 추가 → sync-price API 호출 |

---

## 5) MVP 구현안

- **Phase 1 (최소)**  
  1. **대상 정의**: originUrl이 not null이고 유효 URL인 Product만 수집 대상.  
  2. **공급사 분기**: `Brand.brandKey` 또는 originUrl 호스트로 어댑터 선택. 미지원 공급사는 “미지원” 반환.  
  3. **수집 항목**: 날짜, 성인/아동/유아 가격. 출발 가능 여부는 선택(가능하면 수집, DB 반영은 Phase 2에서).  
  4. **ProductPrice 연동**: 수집 결과를 `(productId, date)` 기준으로 upsert. priceGap은 기존 로직(전일 대비 차액) 유지.  
  5. **관리자 “가격 동기화 1회”**: 상품 상세 페이지에 버튼 하나. 클릭 시 `POST /api/admin/products/[id]/sync-price` 호출 → 해당 상품만 동기화(또는 큐에 넣고 “큐에 추가됨” 반환).  
  6. **스케줄러 연동**: 기존 ScraperQueue 소비 로직에서 “가격/달력 수집” 단계를 호출하거나, 별도 cron에서 큐만 소비하는 엔드포인트 호출.

- **Phase 2 (후속)**  
  - 출발 가능 여부·좌석 상태 컬럼 추가 및 수집.  
  - 여러 공급사 어댑터 추가.  
  - 에러 시 AgentScrapeReport 기록, 스크린샷 저장.

---

## 6) 후속 TODO

- **공급사 어댑터**: 하나투어·모두투어·노랑풍선 등 실제 DOM/API 기준으로 `fetchPriceCalendar` 구현. UI 변경 시 AgentScrapeReport + 경로 이탈 처리.
- **출발 가능 여부/좌석**: ProductPrice에 `status`, `seatCount` 등 필드 추가 검토 후 수집·표시.
- **스케줄러 정기 실행**: 매일 또는 주 N회, originUrl 있는 등록 상품을 ScraperQueue에 넣고, run-once(또는 price-sync/run)로 큐 소비.
- **수동 “가격 동기화 1회”**: 상품 상세 페이지 버튼 + `POST /api/admin/products/[id]/sync-price` 구현.
- **에러 처리**: 타임아웃, 로그인 필요 페이지, 캡차 등 예외 시 재시도·관리자 알림 정책 정리.
