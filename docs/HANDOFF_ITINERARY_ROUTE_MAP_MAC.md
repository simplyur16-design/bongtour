# HANDOFF — 여정지도(일정 동선) Mac → Windows

> **작성:** 2026-10-20 (Mac)  
> **브랜치:** `handoff/itinerary-route-map`  
> **레포:** `bongtour` (Simplyur/봉투어 Next 앱 — `simplyur-trip` 아님)  
> **사용자 판정:** 샘플 퀄 **「봐줄 만하다 / 자동 생성 기준 현실선에 가깝다」** → Windows는 **일괄 적용·운영 마무리**가 다음 일.

---

## 0. Windows가 절대 하지 말 것

1. **Gemini / Imagen으로 베이스맵 다시 만들지 말 것.**  
   이미 버리고 **코드 SVG**로 고정함. `generateImageWithGemini` / Imagen `:predict` 경로로 회귀 금지.
2. **손으로 그린 폴리곤을 다시 넣지 말 것.**  
   해안선은 Natural Earth 10m bake (`data/itinerary-route-maps/*.json`).
3. **사용자 OK 없이 대규모 `--apply` 금지**였으나, 2026-10-20 Mac에서 샘플 OK 받음 →  
   **이제** `generate:itinerary-route-maps:apply` 진행 가능. 단 limit부터.
4. 홋카이도 브로슈어형 **일러스트 콜라주**는 목표가 아님.  
   자동 동선맵(정보용)만 유지.

---

## 1. 한 줄 요약 (현재 SSOT)

상품 `schedule` → 거점/구간 추출 → **권역 SVG 렌더(sharp PNG/WebP)** → Object Storage →  
`Product.rawMeta.itineraryRouteMap` 저장.

| 항목 | 값 |
|------|-----|
| source | `svg_vector_2d` |
| promptVersion | `v4` |
| 엔진 | `lib/itinerary-route-map-render-svg.ts` |
| 지리 | `lib/itinerary-route-map-geo.ts` + `data/itinerary-route-maps/` |
| 구버전 | Gemini/v1~v3 URL은 version 불일치로 **재생성** |

**자동화 (이미 연결됨):**

- 등록 confirm 후: `finalizeRegisterConfirmAfterSave` → `scheduleItineraryRouteMapGeneration` (백그라운드)
- `process-images` 성공 경로(풀/프리메이드/본경로 포함)
- 관리자 `registrationStatus=registered` PATCH
- 수동: `POST /api/admin/products/[id]/itinerary-route-map`

---

## 2. 디자인·제품 결정 (사용자와 합의된 것)

- **목적:** 등록 시 자동 여정지도 (마케팅 일러스트 아님).
- **톤:** 편집형 — 종이 배경, 낮은 채도, 얇은 해안선, 스티커형 흰 박스 스택 제거.
- **한글만** (바다/호수/권역/도시).
- **육지 / 바다 / 호수** 색 구분 + 권역 타원(오사카·교토 등) + 일차 핀 + 점선 동선.
- **라벨 중첩 규칙:** 방문 거점과 이름이 같은 권역명은 **타원만** 그리고 큰 구역 텍스트는 생략(핀 도시명과 중복 방지). 미방문(나라/고베 등)만 구역명 표기.
- 짧은 코스(오사카·교토) → `kansai` 권역 줌. 다낭·호이안 → `central-vietnam`.

레퍼런스 홋카이도 맵(아이콘·사진 콜라주)은 **다른 회사 수작업 에셋**이고, 우리 파이프라인 목표가 아님.

---

## 3. 핵심 파일

| 역할 | 경로 |
|------|------|
| 타입 | `lib/itinerary-route-map-types.ts` |
| 거점 추출 | `lib/itinerary-route-map-hubs.ts` |
| lat/lon·권역 | `lib/itinerary-route-map-geo.ts` |
| SVG 렌더 SSOT | `lib/itinerary-route-map-render-svg.ts` |
| 생성·업로드 | `lib/itinerary-route-map-generate.ts` |
| 등록 스케줄 | `lib/itinerary-route-map-ensure.ts` |
| confirm 훅 | `lib/register-confirm-after-save.ts` |
| 권역 path JSON | `data/itinerary-route-maps/{kansai,kanto,central-vietnam,japan,vietnam}.json` |
| NE bake 스크립트 | `scripts/build-itinerary-route-map-assets.py` |
| 샘플 | `scripts/sample-itinerary-route-map.ts` |
| 픽스처 | `scripts/verify-itinerary-route-map-fixtures.ts` |
| 감사 / 일괄 | `scripts/audit-itinerary-route-maps.ts`, `scripts/generate-itinerary-route-maps.ts` |
| Admin API | `app/api/admin/products/[id]/itinerary-route-map/route.ts` |
| process-images | `app/api/travel/process-images/route.ts` |

**죽은/비생성 경로 (참고만):**  
`lib/itinerary-route-map-prompt.ts`, Gemini `flat_itinerary_map` 스타일 — 생성 파이프라인에서 사용 안 함.

---

## 4. 권역 path 다시 굽기 (해안선 수정 시)

Mac에서 NE 10m를 `tmp/geo-src/`에 받아 둔 상태. Windows에서도:

```bash
# shapely + pyshp 필요
pip install shapely pyshp
# NE 10m land/lakes zip을 tmp/geo-src/land10, lakes10 에 압축 해제 후:
python scripts/build-itinerary-route-map-assets.py
```

권역 라벨(오사카/교토 타원)은 bake 스크립트 `areaLabels`에 정의됨.  
JSON만 손으로 고치면 다음 bake에 덮어씀 → **스크립트 쪽을 고칠 것.**

---

## 5. 샘플 (승인본)

| 파일 | 내용 | 상품 id (참고) |
|------|------|----------------|
| `docs/handoff-itinerary-route-map-samples/sample-osaka-kyoto.png` | 칸사이·오사카→교토 | `cmtolhjvr03v4o8zud7v1kr3g` |
| `docs/handoff-itinerary-route-map-samples/sample-danang-hoian.png` | 중부베트남·다낭↔호이안 | `cmv4spkqx0i33vfapisezv0j3` |

재생성:

```bash
npx tsx scripts/sample-itinerary-route-map.ts --id=cmtolhjvr03v4o8zud7v1kr3g --tag=osaka-kyoto
npx tsx scripts/sample-itinerary-route-map.ts --id=cmv4spkqx0i33vfapisezv0j3 --tag=danang-hoian
```

검증:

```bash
npm run verify:itinerary-route-map-fixtures   # 또는 npx tsx scripts/verify-itinerary-route-map-fixtures.ts
npx vitest run lib/itinerary-route-map-hubs.test.ts lib/register-confirm-after-save.test.ts
```

---

## 6. rawMeta 스키마

```ts
Product.rawMeta.itineraryRouteMap = {
  url: string
  source: 'svg_vector_2d'
  promptVersion: 'v4'
  generatedAt: string
  countryKo: string
  countryEn: string
  hubs: { cityKo, cityEn, dayLabel, days }[]
  legs: { fromCityKo, toCityKo, icon, durationLabel, lineStyle }[]
}
```

키: `ITINERARY_ROUTE_MAP_RAW_META_KEY = 'itineraryRouteMap'`

---

## 7. 환경변수 (Windows)

여정지도 **생성**에 Gemini 불필요. 업로드용 스토리지만 필수:

- `DATABASE_URL` / `DIRECT_URL`
- NCLOUD Object Storage (`NCLOUD_*` 또는 프로젝트 기존 스토리지 env)
- `.env.local`은 Mac에서 복사하지 말고 Railway/기존 Windows env 사용

---

## 8. Windows 다음 할 일 (우선순위)

1. `git fetch && git checkout handoff/itinerary-route-map && git pull`
2. `npm i` 후 fixtures / vitest 통과 확인
3. 샘플 PNG 눈으로 한 번 더 확인 (`docs/handoff-itinerary-route-map-samples/`)
4. dry-run → apply:

```bash
npm run audit:itinerary-route-maps
npm run generate:itinerary-route-maps              # dry-run
npm run generate:itinerary-route-maps:apply -- --limit=30
# OK면
npm run generate:itinerary-route-maps:apply -- --limit=250
```

5. 거점 &lt;2 상품은 스킵이 정상.
6. (선택) 도도부현 경계 폴리곤으로 권역 타원 대신 행정구역 채우기 — **필 아님**, 품질 업그레이드용.

---

## 9. 검색 키워드

`itineraryRouteMap`, `svg_vector_2d`, `itinerary-route-map-render-svg`, `scheduleItineraryRouteMapGeneration`, `HANDOFF_ITINERARY_ROUTE_MAP`, `areaLabels`, `naturalearth_10m`

---

## 10. Mac 작업 맥락 (히스토리 압축)

1. Gemini 플랫맵 → 바다 호 점선·영문 라벨·가독성 실패  
2. 코드 점선 오버레이 → 짧은 코스는 전국 맵에 뭉침  
3. 권역 줌 + 한글 지명 → 디자인 부족  
4. **코드 SVG + NE 10m** 로 전환 → 편집형 톤 + **오사카/교토 권역 타원**  
5. 사용자: 「봐줄 만하다 / 자동 생성 최선에 가깝다」→ **일괄 적용은 Windows**
