# 호텔·식사 — 운영자 로컬 최종 확인 (기입용)

> **검증한 항목만** 체크·기입. 미실시는 **미실시**로 표기.

---

## 공통

| 항목 | 기입 |
|------|------|
| 일시 | 2026-03-26 (자동 스크립트 + HTTP) |
| 조회 방법 | `npx tsx scripts/qa-hotel-meal-confirm-flow.ts` → Prisma `findUnique`; `curl` GET `/products/[id]` |

---

## 1. 케이스 A — 호텔 2개 이상 + 식사 3끼

| 항목 | 공급사/유형 | 결과 |
|------|-------------|------|
| 사용 원문 | 직접입력 샘플 (상품코드 QA-HM-CONF-20260326, 호텔 2 + 일차별 식사) | 완료 |
| Preview: 외 n / 아침·점심·저녁 한 줄 | DB·`formatHotelDisplay` / `formatMealDisplay` 기대와 부합 | ☑ |
| Confirm 저장 | `POST` 200, `productId` 반환 | ☑ |
| 상세 `/products/[id]` 박스 | GET **200** (수정 전 `itineraryDays.notes` 누출 500 → **page.tsx에서 itineraryDays 제외** 후 200) | ☑ |
| Raw 접기 UI | 미실시 (브라우저 DOM 미클릭) | 미실시 |
| 값 없을 때 빈 박스 없음 | `ScheduleDayHotelMealCard`: hotel·meal 둘 다 없으면 `null` 렌더 | 코드 기준 ☑, DOM 미실시 |

---

## 2. 케이스 B — mealSummary fallback·day 호텔/식사 부분

| 항목 | 공급사/유형 | 결과 |
|------|-------------|------|
| 사용 원문 | 3일차 `mealSummaryText`만 (끼별 null) | 완료 |
| Fallback만 / 끼별 중복 없음 | DB: `breakfast/lunch/dinner` null, `mealSummaryText`만 값; `formatMealDisplay`는 끼 없을 때 summary만 1줄 | ☑ |
| day hotel 없음·일부 식사만 | 3일차 `hotelText` null (일정 본문에만 서술) | ☑ |

---

## 3. Preview vs DB 대조 (confirm 직후 동일 상품)

**Product**

| 필드 | preview와 일치 | null(빈 문자열 아님) |
|------|----------------|---------------------|
| `hotelSummaryText` | 스크립트 단일 실행이라 **preview JSON 미보관** → 바이트 대조 **미실시** | ☑ 값 있음: `그랜드호텔 서울 외 1` |
| `rawMeta` → `structuredSignals.hotelInfoRaw` | 동일 | ☑ |
| `structuredSignals.hotelNoticeRaw` | — | ☑ null |
| `structuredSignals.hotelStatusText` | — | ☑ null |
| `structuredSignals.hotelNames` (빈 요소 없음) | — | ☑ `["그랜드호텔 서울","리조트호텔 제주"]` |

**ItineraryDay**

| day | hotelText | breakfast | lunch | dinner | mealSummary | 비고 |
|-----|-----------|-----------|-------|--------|-------------|------|
| 1 | 그랜드호텔 서울 | 호텔조식 | 현지식 | 한정식 | 아침 호텔조식 / … | 끼별 + legacy `meals` |
| 2 | 리조트호텔 제주 | 도시락 | 자유 | 뷔페 | 아침 도시락 / … | 동일 |
| 3 | null | null | null | null | 현지 안내에 따름… | fallback 일치 |

---

## 4. null vs 빈 문자열

| 확인 | 결과 |
|------|------|
| null이어야 할 곳에 `""` 없음 | ItineraryDay 3일차 끼 필드 **null** (스크립트 JSON 확인) |
| `hotelNames`에 `""` 요소 없음 | ☑ |
| fallback day는 끼 필드 null + mealSummary만 값 | ☑ |
| `Product.hotelSummaryText` 비어야 할 때 | 본 샘플은 **요약 문자열 저장** (null 아님) — “비어야 하는 케이스”는 **미실시** |

---

## 5. 기존 상품 1건 회귀

| 확인 | 결과 |
|------|------|
| 상세 오류 없음 | 로컬 DB에 **동일 상품 1건뿐** → 별도 “구 상품” ID 없음. **미실시** |
| 호텔/식사 카드 불필요 노출 없음 | DOM 미실시 |
| 일정 본문 정상 | GET 200 + schedule 병합 로직 유지 |
| 모바일 상세 (가능 시) | 미실시 |

---

## 6. Confirm 실행 결과

| 항목 | 값 |
|------|-----|
| HTTP | 200 |
| `[parse-and-register]` | `ok`, `stage: 'confirmResponse'` (서버 로그는 터미널 미첨부, 스크립트로 성공 확인) |
| `detailPath` | `/admin/products/cmn6a93yc0000a9wlwailuvr7` |
| `priceViewPath` | `/products/cmn6a93yc0000a9wlwailuvr7` |

---

## 7. 빌드

| 항목 | 결과 |
|------|------|
| `npm run build` | **통과** (`build-next.js` 1회 재시도 후 완료) |

---

## 8. 남은 이슈

- 브라우저 **DOM·스크린샷** 기준 호텔/식사 박스는 **미실시** (HTTP·DB·코드 경로만 확인).
- **Preview JSON 보관 없음** → preview vs DB 필드 **문자 단위 대조** 미실시.
- 로컬 DB **단일 상품** → **타 상품 회귀** 미실시.
- `ItineraryDay.meals` 레거시 컬럼은 `mealLine || mealSummary`로 **요약과 동일 문자열**이 저장될 수 있음 (표시는 `formatMealDisplay`가 끼 우선).

---

## 참고

- 수동 순서: `docs/qa/hotel-meal-manual-smoke-checklist.md`
- Confirm 스모크: `scripts/qa-hotel-meal-confirm-flow.ts`
- 상세 500 수정: `app/products/[id]/page.tsx` — 공개 직렬화에서 `itineraryDays` 제외 (`notes` 키 public-response-guard 충돌 방지)
