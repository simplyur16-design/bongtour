# P2 설계안 (미구현)

## A. app/products/[id]/page.tsx — 단일 렌더링 경로 통일

### 현재 문제
- `travelProduct && travelProduct.prices.length > 0` 일 때: Prisma 직렬화 → TravelProductDetail / MobileProductDetail (신규 UI).
- (적용됨) 상세는 Prisma 단일 경로 + getScheduleFromProduct. 레거시 fallback 제거됨.
- 가격 0건 상품은 레거시 경로로 가며 primaryDestination 등이 항상 null, 데이터 불일치 가능.

### 최소 수정안
1. **단일 데이터 소스**: 페이지 상단에서 `prisma.product.findUnique({ where: { id }, include: { prices, itineraries, optionalTours } })` 한 번만 호출.
2. **단일 직렬화**: `travelProduct`가 있으면 항상 동일한 직렬화 함수로 `TravelProduct` 형태 생성 (schedule은 JSON 파싱, prices 0건이어도 동일 구조).
3. **단일 렌더 경로**: `travelProduct`가 있으면 항상 `TravelProductDetail` / `MobileProductDetail`에 넘기고, 가격 0건이면 컴포넌트 내부에서 "가격 문의" 등으로 표시.
4. **fallback 제거**: 적용됨. `travelProduct`가 null일 때 notFound(). getProductById 및 정적 productDetail 데이터 제거 완료.

---

## B. schedule / Itinerary SSOT

### 읽기용 임시 통합 함수 (구현됨)
- **위치**: `lib/schedule-from-product.ts`
- **역할**: Product 한 건(schedule 문자열 + itineraries 배열)을 받아, 화면에서 쓸 "일정 배열" 하나로 통합 반환.
- **로직**: `getScheduleFromProduct(product)` — schedule JSON 우선, 실패/없으면 itineraries 변환, 둘 다 없으면 `[]`.
- **상세페이지 연결 예시** (`app/products/[id]/page.tsx`):

```ts
// 기존: schedule 수동 파싱
let schedule: TravelProduct['schedule'] = null
if (travelProduct.schedule && typeof travelProduct.schedule === 'string') {
  try {
    schedule = JSON.parse(travelProduct.schedule) as TravelProduct['schedule']
  } catch { schedule = null }
}

// P2 적용: 통합 함수 사용 (itineraries fallback 포함)
import { getScheduleFromProduct } from '@/lib/schedule-from-product'

const schedule = getScheduleFromProduct(travelProduct).length > 0
  ? getScheduleFromProduct(travelProduct)
  : null
const serialized: TravelProduct = {
  ...travelProduct,
  schedule: schedule ?? null,
  // ...
}
```

- 단일 렌더 경로로 갈 때는 `travelProduct`가 있으면 항상 `schedule: getScheduleFromProduct(travelProduct)` 로 넣고, 가격 0건이어도 동일 직렬화 후 TravelProductDetail 로 넘기면 됨.

---

## C. 상세페이지 직렬화 계약 (적용됨)

- **데이터 소스**: `prisma.product.findUnique` 한 번만 사용. 없으면 `notFound()`.
- **schedule**: `getScheduleFromProduct(product)` 결과만 사용. JSON 우선, 없으면 itineraries 변환.
- **prices**: `ProductPrice[]` 그대로. 0건이어도 동일 구조.
- **optionalTours**: relation `optionalTours` 매핑. 없으면 `[]`.
- **bgImageUrl**: `Product.bgImageUrl` 유지.
- **기타**: counselingNotes, criticalExclusions, shoppingCount, shoppingItems 는 Product 필드 그대로.

### 장기 SSOT 2안 비교

| 구분 | 안 1: Itinerary 테이블 SSOT | 안 2: Product.schedule SSOT |
|------|-----------------------------|-----------------------------|
| **쓰기** | 모든 일정 변경은 Itinerary create/update/delete. schedule JSON은 읽기 시 Itinerary에서 파생해 생성하거나 캐시용. | 모든 일정 변경은 schedule JSON 덮어쓰기. Itinerary는 deprecated 또는 동기화용 보조. |
| **읽기** | 상세/API는 Itinerary 조회 후 DTO 변환. | 상세/API는 schedule JSON 파싱 후 사용. |
| **장점** | 정규화, 일차별 쿼리/인덱스 가능. | 이미지 등 메타를 JSON에 함께 저장하기 쉬움, 마이그레이션 적음. |
| **단점** | schedule 필드와 이중 유지 시 불일치 위험. 이미지는 별도 처리 필요. | JSON 단일 필드라 스키마 변경/쿼리 제한. |
| **권장** | 일정 "항목"이 단순(day, description)이고 향후 확장이 적으면 Itinerary SSOT. | 일정에 imageUrl·imageSource 등 메타가 계속 붙고 한 덩어리로 다루는 게 편하면 schedule SSOT. |

현재 코드는 **쓰기 시** parse-and-upsert 등에서 schedule JSON과 Itinerary를 둘 다 채우고 있으므로, 단기적으로는 **읽기만** `schedule-from-product`로 통일하고, 장기적으로 위 두 안 중 하나로 쓰기 경로를 일원화하는 것이 좋음.
