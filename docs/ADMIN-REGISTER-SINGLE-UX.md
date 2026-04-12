# 상품 등록 단일 UX 정리

> **등록 API 구조(현재):** 여행사(브랜드)에 따라 `app/admin/register/page.tsx`의 `parseRegisterApiPath`가 **4개 전용 엔드포인트** 또는 **`/api/travel/parse-and-register` 잔여 fallback** 중 하나를 고른다.  
> - 전용: `parse-and-register-modetour` · `parse-and-register-verygoodtour` · `parse-and-register-hanatour` · `parse-and-register-ybtour`(레거시 `…-yellowballoon`)  
> - 잔여: 교원·기타 등 위 네 곳에 매핑되지 않는 브랜드, 및 내부 QA 스크립트 등이 공용 경로를 쓸 수 있음.

## 1. 현재 등록 플로우 문제점

### 플로우가 여러 갈래임

| 구분 | 진입점 | API | 입력 | 저장 후 동작 | 비고 |
|------|--------|-----|------|--------------|------|
| A | `/admin/register` | 브랜드별 `parse-and-register-*` 또는 fallback `parse-and-register` | 텍스트(+ 정형칸 등) | (과거) priceViewPath 리다이렉트 이슈는 UX 제안에서 다룸 | 여행사 선택 시 전용 URL로 라우팅. |
| B | AdminProductPasteForm | parse-and-upsert | 여행사 + 텍스트 | process-images 호출 후 /admin/products/[id] 링크 | **현재 미사용**(대시보드에서 제거됨). |
| C | `/admin/dashboard` | (다른 플로우) | 수동 폼·달력 등 | 상품 등록과 별개 | 사이드바에서 제거됨. “상품 등록”은 /admin/register만 노출. |

### 구체적 문제

- **진입점 분산**: 실제 사용하는 상품 등록은 `/admin/register` 하나뿐이지만, PasteForm(여행사+텍스트) 로직은 다른 API(parse-and-upsert)를 쓰며 현재 어디에서도 쓰이지 않음.
- **저장 후 이동 불일치**: (과거/UX 이슈) 등록 API 성공 시 `priceViewPath`(/products/[id])로 **자동 이동**하면 **고객용 페이지**로 나감. 관리자 플로우는 “저장 → 등록대기”여야 함.
- **여행사(브랜드) 미선택**: 과거에는 여행사 미선택 시 공용 API만 호출되는 문제가 있었음. 현재는 드롭다운 선택값에 따라 **전용/fallback URL**이 갈린다(`parseRegisterApiPath`).
- **미리보기 없음**: “분석 → 미리보기 → 저장”이 아니라 “분석+저장 한 번에”만 있어, 저장 전 확인 단계가 없음(선택 개선).
- **AdminProductPasteForm**: parse-and-upsert + process-images 조합이고 “등록대기로 이동”이 아니라 “저장된 상품 보기” 링크만 있음. 현재 import되는 곳 없음 → **흡수 또는 제거 대상**.

---

## 2. 최종 단일 등록 UX 제안

- **유일한 진입점**: `/admin/register`
- **흐름**: 여행사 선택 → **텍스트/HTML 붙여넣기** → [AI 분석 및 저장] → 성공 시 “저장되었습니다. 등록대기에서 이미지·검수 후 승인하세요.” + **[등록대기로 이동]** 버튼. (선택) “상품 상세 보기” 링크는 `/admin/products/[id]`로.
- **URL 입력**: 1차에서는 같은 textarea에 “URL 또는 텍스트/HTML 붙여넣기”로 안내만 하고, URL 전용 필드·fetch는 2차에서 추가 가능.
- **탭 구조**: 1차에서는 **탭 없이** 한 화면에 “여행사 선택 + 한 개 입력 영역(텍스트/HTML) + 버튼 + 성공 시 안내”만 두어 단순화.

---

## 3. 필요한 입력 섹션 설계

| 순서 | 섹션 | 필수 | 내용 |
|------|------|------|------|
| 1 | 여행사(브랜드) 선택 | ✅ | 드롭다운. GET /api/admin/brands. 선택값을 originSource/brandKey로 API에 전달. |
| 2 | 입력 영역 | ✅ | 단일 textarea. placeholder: "여행사 상세페이지에서 복사한 텍스트 또는 HTML을 붙여넣으세요. AI가 상품코드·가격·일정을 추출합니다." |
| 3 | [AI 분석 및 상품 등록] 버튼 | ✅ | 클릭 시 **선택 브랜드에 맞는** `POST /api/travel/parse-and-register-…` 또는 잔여 시 `parse-and-register` 호출. body: preview/confirm 계약은 엔드포인트 공통(`mode`, `text`, `originSource`, `brandKey` 등). |
| 4 | 성공 시 | ✅ | 문구 + [등록대기로 이동] (→ /admin/pending) + (선택) [상품 상세 보기] (→ /admin/products/[id]). **저장 후 자동 리다이렉트는 제거** (고객 페이지로 가지 않도록). |

- **URL 전용 입력**: 2차에서 “URL 입력” 필드 추가 시, 서버에서 URL fetch 후 텍스트 추출해 위와 동일한 text 파라미터로 넘기는 방식 권장.

---

## 4. 저장 후 이동 규칙

| 상황 | 동작 |
|------|------|
| 저장 성공 | 현재 페이지 유지. “저장되었습니다. 등록대기에서 이미지 수급 후 승인해 주세요.” 표시. [등록대기로 이동] 버튼 노출. (선택) [상품 상세 보기] 링크. **priceViewPath로의 자동 리다이렉트 제거.** |
| 저장 실패 | 에러 메시지 표시. 입력 유지. |

---

## 5. 수정 대상 파일 목록

| 파일 | 조치 |
|------|------|
| `app/admin/register/page.tsx` | 여행사 선택 + `parseRegisterApiPath(brandKey)`로 전용/fallback URL 선택. originSource/brandKey 전달. 성공 시 자동 리다이렉트 제거, 등록대기/상품 상세 링크만 표시. |
| `app/admin/AdminProductPasteForm.tsx` | **사용처 없음 → 삭제 또는 deprecated 주석.** 기능은 register 페이지로 흡수. |
| `app/api/travel/parse-and-register/route.ts` | **잔여 fallback** 진입점. 네 공급사 전용 키는 서버에서 400 안내 가능. 교원·기타·내부 스크립트 등이 여기로 올 수 있음. |
| 문서 | `docs/ADMIN-REGISTER-SINGLE-UX.md` (본 문서) |

---

## 6. 파일별 코드 패치 초안

### 6.1 `app/admin/register/page.tsx`

- **추가**: 여행사(브랜드) 드롭다운. `GET /api/admin/brands`로 목록 로드. 기본값 하나투어 등.
- **변경**: `handleSubmit`에서 `fetch(parseRegisterApiPath(brandKey), { body: JSON.stringify({ … }) })` — 모두/참좋은/하나/노랑은 전용 경로, 그 외는 `/api/travel/parse-and-register`.

#### 6.1.1 복붙용 요청 body (`originSource` / `brandKey` — canonical만)

관련 SSOT: [register-supplier-extraction-spec.md](./register-supplier-extraction-spec.md) 「표기·키 SSOT (요약)」·부록-2 · [register_schedule_expression_ssot.md](./register_schedule_expression_ssot.md) §15 · `lib/parse-api-origin-source.ts` (`normalizeParseRequestOriginSource`).

드롭다운의 한글 라벨(모두투어 등)과 무관하게, **`originSource`와 `brandKey`는 동일한 canonical 키**가 들어간다(`app/admin/register/page.tsx`의 `selectedBrandKey`).

**미리보기:**

```json
{
  "mode": "preview",
  "text": "…",
  "originSource": "modetour",
  "brandKey": "modetour",
  "travelScope": "overseas"
}
```

**확정 저장 (supplier 키 축; `previewToken`·`parsed`·`previewContentDigest` 등은 실제 응답값으로 채움):**

```json
{
  "mode": "confirm",
  "previewToken": "…",
  "text": "…",
  "parsed": {},
  "originSource": "modetour",
  "brandKey": "modetour",
  "previewContentDigest": "…",
  "travelScope": "overseas"
}
```
- **제거**: 성공 시 `window.location.href = path` (priceViewPath 리다이렉트) 제거.
- **유지**: 성공 시 `setRedirectPath(productId 또는 detailPath)` 로 “등록대기로 이동” / “상품 상세 보기” 링크만 표시.

### 6.2 `app/admin/AdminProductPasteForm.tsx`

- **판단**: **흡수 후 제거.** register 페이지에 여행사 선택 + 텍스트 + 브랜드별 등록 API 호출 + 성공 시 등록대기 링크를 두었으므로, PasteForm은 삭제해도 됨. 다른 페이지에서 import하지 않음.
- **구현**: 파일 삭제 완료. 기능은 `app/admin/register/page.tsx`로 통합됨.

### 6.3 등록 API 라우트들

- **전용**: `app/api/travel/parse-and-register-modetour/route.ts`, `…-verygoodtour`, `…-hanatour`, `…-ybtour`(레거시 `…-yellowballoon`) — 브랜드별 핸들러·parse 래퍼 연결.
- **잔여 공용**: `app/api/travel/parse-and-register/route.ts` — 교원·기타·내부 스크립트 등 fallback. `originSource` / `brandKey` 등 body 처리는 각 핸들러 구현을 따름.

---

## 7. 남은 후속 작업

- **미리보기 단계**: “분석만” API(예: POST /api/travel/parse)를 두고, 클라이언트에서 “분석하기” → 미리보기 표시 → “저장” 시 저장 API 호출하도록 2차에서 분리 검토.
- **URL 입력**: 입력 영역에 “URL에서 가져오기” 또는 URL 전용 필드 + 서버에서 fetch 후 텍스트 추출해 기존 text 플로우로 넘기는 기능 추가.
- **HTML 전용 처리**: 텍스트와 동일 textarea로 받고, 서버에서 HTML 태그 제거 후 파싱하거나, parseForRegister가 이미 HTML을 처리하는지 확인 후 필요 시 전처리만 추가.
