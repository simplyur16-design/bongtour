# 상품 상세 네비게이션 — 근본 원인·해결 로드맵

## 증상 (운영 체감)

- 목록에서 상품 탭 → **~1초 후** 화면이 **한 번에** 채워짐
- 그 1초 동안 **화면 아래쪽이 올라왔다 내려가는** 느낌 (푸터만 먼저가 아님)
- 히어로 스트리밍(2단) 도입 시 **가운데 히어로만 튕김** — 단계적 UI 교체가 레이아웃 시프트 유발

## 근본 원인 (3층)

### 1. 서버: 한 덩어리 RSC (주 병목)

- `/products/[idOrSlug]`는 `headers()`(UA)로 **dynamic** → HTML Full Route Cache 없음
- `ProductDetailPageContent`가 **끝날 때까지** 브라우저에 본문 HTML이 거의 없음
- DB는 `unstable_cache` v2 + select push-down으로 **짧아질 수 있음**
- 남는 시간: `ProductDetailView` **rawMeta/schedule 파싱** + **클라이언트 상세 1벌 SSR** (~700–900행)

**근본 해결:** 공개 DTO를 등록·동기화 시 DB에 저장 → 상세는 DTO만 소비 (옵션 C 2단계).  
또는 상세를 **안정 껍데기 RSC + 지연 슬롯**으로 쪼개되, **슬롯마다 높이가 바뀌면 안 됨** (히어로만 먼저 X).

### 2. 레이아웃: 루트 `flex` + 푸터 항상 표시

```
body.flex-col
  ├─ flex-1 {children}   ← 상세 본문
  └─ SiteFooter          ← pathname 바뀌면 즉시 렌더
```

- 본문이 **짧은 순간**(Suspense·로딩·`invisible`+부분 스트림) → flex-1 안이 비어 보이고 **푸터가 뷰포트 하단**에 붙음
- 이후 본문이 길어지면 문서 높이 증가 → **스크롤 위치 대비** “아래가 올라갔다 내려감”

### 3. 스크롤: 목록 스크롤 위치 유지

- browse 목록을 **아래까지 스크롤**한 뒤 상세 이동 시, Next가 본문을 채우기 전 **이전 스크롤/짧은 문서**와 맞물림
- `Link` `scroll`만으로는 **첫 페인트 타이밍**에 한 번 틀어질 수 있음 → 진입 시 **`scrollTo(0)` 강제** 필요

## 하지 말 것 (교훈)

| 시도 | 왜 실패했는지 |
|------|----------------|
| pulse `loading.tsx` 스켈레톤 | “로딩 중” 체감, 근본 대기 시간 동일 |
| 히어로만 먼저 Suspense 스트림 | 짧은 페이지 → 전체 교체로 **CLS·튕김** |
| `visibility:invisible` + 부분 스트림 | DOM 높이 잡힘 → 스크롤 튐 |
| `absolute` 카드 오버레이(본문 div 안) | 푸터·하단 반 화면 가림 불가 |

## 현재 완화 (코드)

- **prefetch** + 카드 **preview** → `fixed inset-0` 오버레이 (뷰포트 전체)
- 본문은 `serverReady` 전 **`hidden`** (레이아웃에 안 잡힘)
- 진입 **`scrollTo(0)`**, 로딩 중 **`data-bt-detail-loading`** → 푸터 숨김
- **히어로 청크 제거** (2단 스트리밍 롤백)

## 근본 해결 로드맵 (권장 순)

1. **공개 `ProductPublicDto` JSON** (Product 행 또는 별도 컬럼) — sync 시 계산, 상세는 파싱 최소화  
2. **단일 Suspense 경계** + 고정 `min-height` 껍데기 (히어로·탭 영역 placeholder 높이 고정)  
3. browse → 상세 **동일 필드**만 전달 (이미 preview; slug URL은 id resolve 후 키 통일)  
4. (선택) PPR/세그먼트 캐시 — UA dynamic과 정책 정합 후 검토

## 측정

`BONGTOUR_PERF_LOG=1` → `[product-detail-perf] resolve=… product+fit=… total=… cache=…`

- `product+fit` 큼 → DB/캐시  
- `product+fit` 작은데 `total` 큼 → `ProductDetailView` CPU  
- 체감 CLS → Performance panel Layout Shift + 네비게이션 녹화
