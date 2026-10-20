# 동선지도 · Gemini 그림 + 구간 교통수단 v1

**상태:** 공개 `/products` 연결됨 — `viewProduct.routeMap` + 일정 아래 **동선지도** 섹션 (등록 시 저장분만 표시, 조회 시 재생성 없음).  
**연동:** `bongtour-product-surface-v1.md` §4.4 · `lib/bongtour-route-map-chain-ssot.ts` · `lib/bongtour-route-map-public.ts`.

---

## 1. 역할 분담

| 층 | 담당 | 산출 |
|----|------|------|
| A | 결정론 `buildBongtourRouteMapChain` | 방문 도시 순서 (허브·POI 제외, 상한 6) |
| T | 결정론 `inferBongtourRouteMapTransport` | 구간 `mode` + 한글 라벨 |
| B | Gemini JSON (선택) | 일정에 교통 단서 없을 때만 `mode` 보강 |
| I | **Gemini/Imagen** | **동선지도 이미지 1장** (도시 핀·구간 라벨) |
| C | 미리보기 UI | 이미지 + `routeSummary` + 교통 범례 |

**잠긴 원칙**

- 지도를 **Gemini로 그린다.** 무료 OSM/Leaflet/Nominatim 타일맵 **비목표**.
- 도시 목록·순서는 A가 SSOT. 교통 라벨은 원문(대형버스·국내선 이동 등) 우선.
- 추상 스토리보드(균등 곡선·blurb만)도 비목표 — **그림 지도 + 교통수단**이 보여야 한다.

---

## 2. 교통수단 enum (T)

`flight` | `domestic_flight` | `coach` | `rail` | `private_car` | `cable_car` | `ferry` | `walk` | `transfer`

표시 라벨: 항공 / **국내선 이동** / 버스(대형버스 등 원문) / 기차 / 전용차량 / 케이블카 / 선박 / 도보 / 이동  
원문에 `국내선`·`대형버스`·`45인승` 등이 있으면 그 라벨을 우선한다.

---

## 3. Gemini JSON (B) — mode 보강

입력: `{ productId?, heroShortTitle, cities, schedule, edgesNeedingMode? }`

출력:

```json
{
  "version": "route-map-gemini-v1",
  "layout": "geographic",
  "nodes": [{ "order": 1, "city": "부다페스트" }],
  "edges": [
    { "from": 1, "to": 2, "mode": "coach", "label": "대형버스" }
  ],
  "routeSummary": "부다페스트 —대형버스→ 브르노"
}
```

규칙:

- `nodes[].city` = 입력 cities와 동일 순서·집합
- `edges` 인접만, `mode`는 위 enum
- 좌표/km 필드 **hard reject**
- 형용사(프리미엄·환상 등) 금지

검증: `validateBongtourRouteMapGeminiDraft`

---

## 4. Gemini 지도 이미지 (I) — **등록 시 생성·저장**

- **언제:** 상품 등록 confirm 직후 (`finalizeRegisterConfirmAfterSave` → `ensureBongtourRouteMapPersisted`).
- **무엇을:** `generateBongtourRouteMapImage` (Imagen `route_map`) → Object Storage 업로드 → `Product.rawMeta.bongtourRouteMapV1.imageUrl`.
- **조회:** 저장된 URL만 표시. **탭 클릭·페이지 로드로 새로 그리지 않음.**
- 백필: `npx tsx scripts/persist-bongtour-route-map.ts --slug=… --force`
- **비주얼 목표:** `docs/design/refs/route-map-turkiye-baseline.jpg`보다 한 단계 고급. 가짜 SVG·OSM/Leaflet **금지**.
- 교통 라벨은 **지도 안 배지**만.

혜택 아이콘 레퍼런스: `docs/design/refs/benefit-icons-row.jpg` (pastel squircle · Lucide stroke · 이모지 금지).

---

## 5. 일정 탭 밀도

동선지도와 일정 탭은 같은 상품 SSOT.  
일정 `description`은 **원문 길이·줄바꿈 유지** (한 줄 압축·짧은 절단으로 화면을 줄이지 않음).

---

## 모듈 맵

| 파일 | 역할 |
|------|------|
| `lib/bongtour-route-map-chain-ssot.ts` | 도시 체인 |
| `lib/bongtour-route-map-transport-ssot.ts` | 교통 추론 |
| `lib/bongtour-route-map-gemini-*.ts` | mode 보강·검증 |
| `lib/bongtour-route-map-image.ts` | Gemini 지도 그림 |
| `lib/bongtour-route-map-persist-ssot.ts` | 등록 시 저장·rawMeta |
| `scripts/persist-bongtour-route-map.ts` | 백필 |

회귀: `REGRESSION-FREEZE[bongtour-route-map-gemini-v1]`

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-10-15 | 초안 스토리보드 |
| 2026-10-15 | M0+M1 검증·목업 |
| 2026-10-15 | 실지도+교통 시도 (Nominatim/Leaflet) |
| 2026-10-16 | **운영 교정:** 무료맵 폐기 → **Gemini가 지도를 그림** · 일정 description 원문 유지 |
