# HANDOFF — 일정 동선 플랫 지도 (Mac 에이전트 → Windows)

> **목적:** Mac에서 구현한 등록/등록대기 상품 일정 동선 지도 작업을 Windows PC 에이전트가 바로 이어받게 함.  
> **작성:** 2026-10-20 (Mac)  
> **상태:** 로컬 구현 완료 + 샘플 생성까지. **전체 DB 일괄 적용은 아직 안 함.** 선(route) 품질 이슈로 코드 합성 방식 전환 중이었음.

---

## 1. 한 줄 요약

등록(`registered`) + 등록대기(`pending`) 상품의 `schedule`에서 거점을 뽑아 **Gemini 이미지**로 플랫 2D 일정 지도를 만들고 `Product.rawMeta.itineraryRouteMap`에 저장하는 파이프라인.

- **Imagen `:predict` 쓰지 말 것.** `GEMINI_API_KEY` + Gemini native image (`generateContent`)만.
- 샘플 품질 확인 전 **전체 `--apply` 금지** (이전에 Imagen 404로 220건 실패 = DB에 지도 0건).

---

## 2. 파일 목록 (검색 키워드)

| 역할 | 경로 |
|------|------|
| 타입 / SSOT 키 | `lib/itinerary-route-map-types.ts` |
| 거점·구간 추출 | `lib/itinerary-route-map-hubs.ts` (+ `.test.ts`) |
| 프롬프트 빌더 | `lib/itinerary-route-map-prompt.ts` |
| 국가명 해석 | `lib/itinerary-route-map-country.ts` |
| rawMeta 병합 | `lib/itinerary-route-map-raw-meta.ts` |
| 생성·업로드·저장 | `lib/itinerary-route-map-generate.ts` |
| Gemini 이미지 생성 | `lib/gemini-image-generate.ts` (`stylePreset: 'flat_itinerary_map'`) |
| 스타일 접미사 | `lib/image-style.ts` → `IMAGEN_FLAT_ITINERARY_MAP_STYLE_SUFFIX` |
| 스토리지 키 | `lib/object-storage.ts` → `buildItineraryRouteMapObjectKey` |
| 관리자 API | `app/api/admin/products/[id]/itinerary-route-map/route.ts` |
| 등록/대기 UI 훅 | `app/admin/products/[id]/page.tsx`, `app/admin/pending/components/AdminPendingDetailPanel.tsx` |
| process-images 연동 | `app/api/travel/process-images/route.ts` |
| 상세 노출 | `components/itinerary/ItineraryViewPackageMain.tsx`, `lib/public-product-extras.ts` |
| 샘플 1건 | `scripts/sample-itinerary-route-map.ts` |
| 감사 | `scripts/audit-itinerary-route-maps.ts` |
| 일괄 생성 | `scripts/generate-itinerary-route-maps.ts` |
| 픽스처 검증 | `scripts/verify-itinerary-route-map-fixtures.ts` |

`package.json` scripts:

```bash
npm run audit:itinerary-route-maps
npm run generate:itinerary-route-maps          # dry-run
npm run generate:itinerary-route-maps:apply    # --apply
npm run verify:itinerary-route-map-fixtures
npx tsx scripts/sample-itinerary-route-map.ts
npx tsx scripts/sample-itinerary-route-map.ts --id=<productId>
npx tsx scripts/sample-itinerary-route-map.ts --persist   # 샘플 1건만 DB 반영
```

---

## 3. 데이터 스키마

`Product.rawMeta.itineraryRouteMap`:

```ts
{
  url: string
  source: 'gemini_flat_2d'
  promptVersion: 'v1'
  generatedAt: string
  countryKo: string
  countryEn: string
  hubs: { cityKo, cityEn, dayLabel, days }[]
  legs: { fromCityKo, toCityKo, icon, durationLabel, lineStyle }[]
}
```

키 상수: `ITINERARY_ROUTE_MAP_RAW_META_KEY = 'itineraryRouteMap'`

---

## 4. 환경변수 (Windows `.env.local`)

필수:

- `DATABASE_URL` / `DIRECT_URL`
- `GEMINI_API_KEY`
- `GEMINI_IMAGE_MODEL=gemini-3-pro-image` (없으면 코드 기본값 동일)
- NCLOUD Object Storage: `NCLOUD_ACCESS_KEY`, `NCLOUD_SECRET_KEY`, `NCLOUD_OBJECT_STORAGE_*`

Mac에서는 Railway CLI로 `zealous-harmony` / service `bongtour` vars를 `.env.local`에 넣었음.  
**Windows에 `.env.local` 복사하지 말고** 같은 Railway 프로젝트에서 다시 받거나 기존 Windows env 사용.

---

## 5. 샘플 (이미 뽑아둔 것)

경로 (Mac workspace / Desktop에도 복사됨):

- `tmp/sample-osaka-kyoto.png` — 오사카→교토 (`cmv9rrdt70ss41wlkk3wri3sc`)
- `tmp/sample-danang-hoian.png` — 다낭→호이안→다낭 (`cmnwqc0to0316kvo6t2swdmxq`)
- webp: `tmp/itinerary-route-map-sample-*.webp`

감사 결과(대략):

- products ~684 / withMap 0 / readyToGenerate ~212 / blockedHubs(~거점&lt;2) ~464

---

## 6. 남은 이슈 (Windows가 이어서 할 일)

1. **선(route) 모양**  
   Gemini가 반원·바다 우회 점선을 그림. 사용자 피드백: “선이 왜 이모양”.  
   **다음 설계(미구현):**  
   - Gemini는 **실루엣+캡슐만** 그리게 프롬프트 변경  
   - 점선은 `sharp`/SVG로 코드 합성 (`layout` 좌표 → overlay)  
   - 파일 후보명: `lib/itinerary-route-map-layout.ts`, `lib/itinerary-route-map-draw-routes.ts` (작성 중 중단됨)

2. **샘플 OK 후에만** `npm run generate:itinerary-route-maps:apply -- --limit=250`  
   거점 &lt;2 상품은 스킵/실패 정상.

3. Git 브랜치: **`handoff/itinerary-route-map`** (remote push 대상).  
   Windows: `git fetch && git checkout handoff/itinerary-route-map`

---

## 7. Windows에서 바로 확인

```bash
cd <bongtour>
git pull
git checkout handoff/itinerary-route-map   # 또는 푸시된 브랜치명
rg -n "itineraryRouteMap|flat_itinerary_map" lib app scripts --glob '!node_modules'
npm run verify:itinerary-route-map-fixtures
npm run audit:itinerary-route-maps
npx tsx scripts/sample-itinerary-route-map.ts --id=cmv9rrdt70ss41wlkk3wri3sc
# 결과: tmp/itinerary-route-map-sample-*.webp → Preview
```

검색 키워드: `itineraryRouteMap`, `flat_itinerary_map`, `HANDOFF_ITINERARY_ROUTE_MAP`, `sample-itinerary-route-map`.
