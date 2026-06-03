# 해외·자유여행 목록 / 상품 상세 — 체감 속도 (운영)

## 왜 1.6~2.9초가 줄지 않는 것처럼 느껴지나

| 구간 | 병목 | prefetch·UI 완화만으로 줄기 어려운 이유 |
|------|------|----------------------------------------|
| **상품 상세** (`/products/…`) | 서버가 RSC 한 덩어리를 끝까지 렌더 | `headers()`(모바일 UA) 때문에 Full Route Cache 없음. DB는 `unstable_cache`로 짧아질 수 있으나 **본문 조립 CPU**가 남음 |
| **해외·자유여행 허브** | 첫 진입 RSC + (필터 시) `/api/products/browse` | 서버 `prefetchOverseasHubBrowse` / `prefetchAirHotelHubBrowse` + 클라이언트 목록 |
| **뒤로가기 ~0.2초 개선** | Router cache·브라우저 일부 재사용 | **첫 진입**은 여전히 서버/RSC 대기 |

이전에 한 prefetch 제한·카드 preview·`publicDetailPayloadJson` 은 **서버 폭주·CLS** 완화용이다. **첫 탭 1.6초를 절반으로** 만들려면 아래 **데이터 사전 계산(백필)** 이 가장 효과가 크다.

## 안전하게 체감을 줄이는 순서 (권장)

### 1. 상세 DTO 백필 (효과 큼 · **프로덕션 DB**)

등록 상품마다 `publicDetailPayloadJson` 이 있으면 상세 RSC는 **파싱·재계산 생략** (`payload=computed` → `payload=payload`).

**`npm run build` 안에 넣지 않는다** — CI/이미지 빌드 단계는 DB가 없거나 pooler 차단(sitemap과 동일).  
**배포(release) 직후** 에만 자동 배치:

| 명령 | 용도 |
|------|------|
| `npm run postdeploy:detail-payload` | Railway **Release Command** — payload 없는 등록 상품 최대 40건/배포 (환경변수 `POSTDEPLOY_DETAIL_PAYLOAD_BATCH`) |
| `npm run db:backfill-detail-payload` | 수동 전량 (로컬에서 **프로덕션 `DATABASE_URL`** 로 실행 시 bongtour.com 반영) |
| `npm run db:backfill-detail-payload:missing` | 수동 — 비어 있는 것만 |

Railway (`railway.json` — 저장소에 반영됨):

- **Build:** `npm run build` (nixpacks)
- **preDeployCommand:** `npm run postdeploy:detail-payload` (배포마다 자동, 로컬에서 손으로 `npx tsx` 할 필요 없음)
- 비활성: `SKIP_POSTDEPLOY_DETAIL_PAYLOAD_BACKFILL=1`

신규·재등록 상품은 등록/동기화 시 `rebuildProductPublicDetailPayload` 로 이미 채워짐 — postdeploy는 **기존 누락분** 소진용.

측정: `BONGTOUR_PERF_LOG=1` → `[product-detail-perf] payload=payload` 비율.

### 2. prefetch 폭주 방지 (배포 필수)

- `lib/route-prefetch-policy.ts` — 무거운 `/travel/*`, `/products/*` viewport prefetch 끔
- `ProductDetailNavLink` — hover prefetch 없음
- 모바일 2×2 캐러셀 — 인접 페이지만 DOM 마운트

미배포 시 Network에 `?_rsc` 다수 + Server Components render 오류가 다시 난다.

### 3. 뒤로가기·목록 복귀 (코드)

- `next.config.js` `experimental.staleTimes.dynamic: 60` — 짧은 시간 동안 App Router RSC 재사용
- `lib/products-browse-client-cache.ts` — 같은 필터 목록을 sessionStorage에 10분 보관, 복귀 시 **즉시 표시 후 백그라운드 갱신**

### 4. 측정 (원인 분리)

| 로그 | 의미 |
|------|------|
| `[product-detail-perf] product+fit=…ms` 큼 | DB/캐시 |
| `product+fit` 작은데 `total` 큼 | `ProductDetailView` CPU → 백필·payload hit 확인 |
| `[browse-client-perf] clientFetchMs` | 목록 API만 느림 |
| `[page-rsc-perf] route=/travel/overseas` | 허브 RSC 전체 |

## 하지 않는 것 (이미 실패한 시도)

- 히어로만 먼저 Suspense 스트림 → 레이아웃 튐
- 목록 viewport prefetch 복구 → RSC 폭주
- UA `headers()` 제거 → 모바일/SEO 분기 회귀 위험

## 관련 문서

- `docs/ops/product-detail-navigation-root-cause.md` — 상세 전환·CLS·payload 설계
