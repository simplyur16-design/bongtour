# 관리자 상품 등록 — 공급사별 초정밀 입력 규약

운영 SSOT: 본 문서와 `lib/admin-register-supplier-input-frames.ts`(placeholder·표 요약·우선순위·삭제 후보 상수)를 함께 본다.  
어댑터·스크래퍼·DB 스키마와 무관.

---

## 본문 섹션 분리·추출 SSOT (공급사별)

**상위 정책(본 문서·아래 공통 규칙):** 어떤 칸이 LLM·정형인지, 정형칸이 본문보다 우선인지.  
**결정적 자르기(앵커·정규화·슬라이스·항공 시드 하한):** 공급사별 문서가 **코드 1급 SSOT**이며, 구현 파일 상단 `@see`와 아래 표가 쌍을 이룬다.

| 공급사 | 본문 섹션 분리·추출 SSOT |
|--------|-------------------------|
| hanatour | `docs/body-parser-hanatour-ssot.md` |
| modetour | `docs/body-parser-modetour-ssot.md` |
| verygoodtour | `docs/body-parser-verygoodtour-ssot.md` |
| ybtour | `docs/body-parser-ybtour-ssot.md` |

`docs/register_schedule_expression_ssot.md`는 **일정 표현층**(브리프·저장·식사·숙소 표기 규칙)만 다룬다. 붙여넣기 본문을 `flight_section` / `hotel_section` 등으로 나누는 알고리즘은 **위 공급사별 SSOT**를 본다(일정 SSOT 문서 §2.2 비적용과 동일 취지).

---

## 공급사 공통 입력 우선순위 규칙

1. **본문 입력칸**은 Gemini(LLM) 처리 대상이다. 일정·관광·식사·이동·포함/불포함·주의사항·일차별 서술·(참좋은) 여정 요약문 등 **자연어**가 주력이다.
2. **항공·호텔·옵션·쇼핑 정형칸**에 비어 있지 않은 값이 있으면, 해당 섹션의 **원문·구조화 SSOT 후보는 정형칸이 본문 자동추출보다 항상 우선**한다. (구현: `sliceDetailBodySections`에서 paste로 섹션 텍스트 덮어쓰기, `flightRaw`에 항공 붙여넣기 병합.)
3. 본문 LLM 출력만으로 **항공 스케줄·호텔 표·옵션 전 행·쇼핑 전 행의 최종 확정 SSOT**를 대체하지 않는다. 최종 확정은 **정형칸 + 교정 승인** 흐름을 본다.
4. **항공**이 본문 `flight_section`과 정형칸에 **동시에** 있으면: `flightRaw`에 **병합** 후 파싱한다. 충돌 시 **정형칸 블록이 같은 슬롯을 보완·덮어쓰기에 유리**하다(운영상 정형칸을 “확정”에 가깝게 둔다).
5. **호텔**: 후보/일자 표(정형칸)와 본문 설명형이 같이 있으면 **표(정형칸)가 `hotelStructured` 등 구조화 우선**; 설명 문구는 본문·`note`·비고로 병행 보관.
6. **쇼핑**: `shoppingVisitCount`(또는 본문/메타의 횟수 문구)와 `shoppingItems[]`(표 행)는 **분리 전제**. 횟수만 있고 리스트 없음·리스트만 있음·리스트가 횟수보다 많음 모두 허용. **충돌 시** 행 리스트·교정·검수에서 사실 확인; 횟수는 요약 필드로 유지.
7. **옵션관광**: 정형칸에 표/블록이 있으면 그것이 **옵션 행 데이터의 1차 SSOT**; 본문 LLM 보조(`optionalToursLlmSupplementJson` 등)는 정형칸·승인된 교정에 종속.

---

## 1. 모두투어

**전용 파이프:** `POST /api/travel/parse-and-register-modetour` → `parse-and-register-modetour-handler.ts` → `register-parse-modetour.ts` → `detail-body-parser-modetour.ts` → `flight-parser-modetour.ts` 등.

### 본문 입력칸 (LLM)

| 담당 | 비담당(최종 SSOT로 쓰지 않음) |
|------|-------------------------------|
| 일정 설명, 관광지, 식사, 이동, 포함/불포함, 주의사항, 일차별 서술 | 항공 최종 SSOT, 호텔 표 최종 SSOT, 옵션 표 최종 SSOT, 쇼핑 표 최종 SSOT |

**넣으면 안 되는 것(원칙):** 항공·호텔·옵션·쇼핑을 “확정 데이터”로만 본문에 두고 정형칸을 비우는 운영(검수·교정 난이도 증가).

**날짜:** 본문·항공에 `2026.07.07(화)` 형태 허용(파서·히어로 유틸이 숫자 날짜 추출).

### 항공여정 입력칸 (정형)

**구조:** 항공사 1줄 + **출발**(가는편) 라벨 1줄 + **도착**(오는편) 라벨 1줄(모두투어 원문 관례).  
**논리 슬롯(출발편/귀국편 분리):**

- 항공사 (1)
- **출발편(가는 편):** 출발도시, 출발일시, 도착도시, 도착일시, 편명 — 공항코드(ICN 등) 있으면 그대로 보존
- **귀국편(오는 편):** 동일 슬롯  
- **경로 변형:** `A→B` + 귀국 `C→A` 가능(도시·공항 슬롯이 편별로 다름).
- **소요시간:** 줄 안에 `(약 N시간)` 등 **보조 슬롯**으로 허용.

**예시 형식:**

```text
항공사: 중국남방항공
출발 : 인천 2026.07.07(화) 19:20 → 연길 2026.07.07(화) 20:40 CZ6074
도착 : 연길 2026.07.10(금) 10:10 → 인천 2026.07.10(금) 13:25 CZ6073
```

### 호텔 입력칸 (정형)

**반복 행:** 일차 | 날짜 | 도시 | 호텔명 (동일 호텔 여러 일자 반복 허용).

### 옵션 입력칸 (정형)

**표형 슬롯:** 옵션명, 통화, 성인가, 아동가, 소요시간, 최소인원, 동행여부, 미참여시 대기장소/일정. (30행+ 허용, 중복 제거 안 함.)

### 쇼핑 입력칸 (정형)

**필드:** 쇼핑항목, 대표쇼핑장소, 추가장소목록(쉼표·줄바꿈), 소요시간, 환불여부.  
**쇼핑횟수:** 본문/메타 `shoppingVisitCount`와 **분리** — 정형칸 상단에 `쇼핑 2회` 한 줄로 적어도 됨(리스트와 불일치 시 교정).

**충돌 시:** 횟수 vs 리스트 → **리스트·교정 우선**으로 사실 확정, 횟수 필드는 요약 정합 맞춤.

---

## 2. 참좋은여행

**전용 파이프:** `POST /api/travel/parse-and-register-verygoodtour` → `parse-and-register-verygoodtour-handler.ts` → `register-parse-verygoodtour.ts` → `detail-body-parser-verygoodtour.ts` → `flight-parser-verygoodtour.ts`, `hotel-parser-verygoodtour.ts`.

### 본문 입력칸 (LLM)

| 담당 | 비담당 |
|------|--------|
| 일정·관광, 이동·식사, 포함/불포함, 호텔 **설명형** 문구, 유의사항, (별도 블록이 있으면) 여정 요약문 | 항공·호텔 **표**·옵션 표·쇼핑 표 최종 SSOT |

### 항공여정 입력칸 (정형)

**블록:** 항공사 + **출국** + **입국** 각각: 출발도시, 출발일시, 도착도시, 도착일시, 편명. 공항코드·소요시간 보조 허용.

### 호텔 입력칸 (정형)

호텔유형 | 확정여부 | 호텔명 또는 미정 | 설명/비고 (이름 미정·설명형 허용).

### 옵션 입력칸 (정형)

번호 | 옵션명 | 내용요약 | 비용 | 소요시간 | 미참가시 대기일정 | 대기장소 | 동행여부.

### 쇼핑 입력칸 (정형)

첫 줄 **쇼핑총횟수** + 회차 | 쇼핑항목 | 쇼핑장소 | 소요시간 | 환불여부.

---

## 3. 하나투어

**전용 라우트:** `POST /api/travel/parse-and-register-hanatour` → `parseForRegisterHanatour` → **`detail-body-parser-hanatour`**(본문 슬라이스·호텔·포함불포함) + **`register-parse-hanatour`**/`register-input-parse-hanatour`(정형 입력란 기준 항공·옵션·쇼핑). (`parseDetailBodyStructuredLegacyOtherBrands`는 공용 `/parse-and-register`·preset 없음 경로용.)  
관리자는 `parseRegisterApiPath('hanatour')`로 위 URL만 호출한다. `POST /api/travel/parse-and-register`는 **교원·기타 등 잔여 브랜드용 fallback**이며, 네 공급사 키로의 오남용은 서버에서 차단·안내할 수 있다.

### 본문 입력칸 (LLM)

| 담당 | 비담당 |
|------|--------|
| 일정·관광·식사, 포함/불포함, 주의사항, 가이드/미팅, 호텔 소개 문구 | 항공·호텔 후보 리스트·옵션·쇼핑 **행** 최종 SSOT |

### 항공여정 입력칸 (정형)

항공사 + **출발편** + **귀국편** 각각: 출발도시, 출발공항, 출발일시, 도착도시, 도착공항, 도착일시, 편명, 소요시간(선택). 요약 한 줄형·상세 다줄형 **혼용 가능**.

### 호텔 입력칸 (정형)

호텔유형 | 후보호텔목록[] | 객실기준 | 확정시점 | 설명/비고.

### 옵션 입력칸 (정형)

옵션명, 성인가, 아동가, 소요시간, 대체일정, 미선택시 가이드동행, 비고 — 블록 반복.

### 쇼핑 입력칸 (정형)

도시 | 쇼핑샵명 | 위치 | 품목 | 소요시간. (횟수는 본문/메타와 분리 전제 동일.)

---

## 4. 노랑풍선

**전용 라우트(HTTP SSOT):** `POST /api/travel/parse-and-register-ybtour` → 공유 오케스트레이션 + `parseForRegisterYbtour` + **`detail-body-parser-ybtour`**. 레거시 URL `…-yellowballoon`은 **동일 핸들러**만 호출(deprecated — 신규는 ybtour 경로만).  
관리자는 `brandKey: 'ybtour'`로 위 URL만 호출한다(`yellowballoon` 키는 alias). 공용 `parse-and-register`는 preset 없이 하나/노랑에 **legacy-other-brands**를 태울 수 있어 정식 등록과 혼동 금지.

### 본문 입력칸 (LLM)

| 담당 | 비담당 |
|------|--------|
| 일정·관광, 포함/불포함, 주의사항, 상품 소개 | 항공·호텔·옵션·쇼핑 표 최종 SSOT |

**주의:** 옵션 vs 쇼핑이 본문에서 비슷해 보일 수 있음 → **정형칸으로 분리**해 넣을 것.

### 항공여정 입력칸 (정형)

항공사 + **출발편** + **귀국편**: 편명, 출발도시, 출발일시, 도착도시, 도착일시.

### 호텔 입력칸 (정형)

일정구간 또는 도시 | 호텔명 | 확정여부 | 비고 **또는** 호텔설명만.

### 옵션 입력칸 (정형)

옵션명 | 비용 | 소요시간 | 미참여시 내용 | 동행여부 | 비고.

### 쇼핑 입력칸 (정형)

쇼핑총횟수 + 회차 | 쇼핑품목 | 쇼핑장소 | 소요시간 | 환불여부.

---

## 7. 공용 파이프 잔재 — 삭제·정리 후보 (실삭제 전 검증 필수)

| 대상 | 삭제·축소 후보 이유 | 반드시 확인할 참조 | 삭제 시 영향 |
|------|---------------------|-------------------|--------------|
| `app/api/travel/parse-and-register/route.ts` + `lib/parse-and-register-handler.ts` | 잔여 fallback·하나·노랑 전용이 handler 공유 | `register/page.tsx`(fallback·전용 URL), `scripts/qa-*.ts`, `docs/*` | 공용 **route**만 제거 시 교원·기타·내부 도구 등 깨짐. **handler** 제거 시 하나·노랑 전용 route도 깨짐(모두·참좋은 전용 핸들러는 별도 파일). |
| `lib/detail-body-parser-legacy-register.ts` | 모두/참좋은을 라우터로 완전 분리 후 레거시만 남길 때 | `register-parse.ts`의 `presetDetailBody` 없을 때 분기 | 공용 `parseForRegister` 단독 호출 경로 깨짐 |
| `lib/detail-body-parser-legacy-other-brands.ts` | 하나·노랑 전용 detail-body 생기면 | 위와 동일 + `verify-detail-body-parser-regression.ts` | 동일 |
| `lib/register-parse.ts` (본체) | “공용 LLM 본체”를 공급사별로 복제할 경우에만 | modetour/verygood이 `presetDetailBody`로 호출 | **고위험** — 전역 등록 파싱 중단 |
| `docs/ADMIN-REGISTER-SINGLE-UX.md` 등 | (과거) 단일 `/parse-and-register` 전제 문구 | 문서만 | **개정 진행** — 4 전용 + fallback 명시 |
| `scripts/qa-verygoodtour-preview-smoke.ts` | 참좋은은 `parse-and-register-verygoodtour` 고정 여부 재확인 | 스크립트 | URL·주석만 정리 시 영향 |

**현재 상태:** 모두·참좋은·하나·노랑은 **전용 route + `parseRegisterApiPath`**가 이미 연결됨.  
**남은 정리:** 공용 `parse-and-register`는 **교원·기타·QA 스크립트** 등 잔여 호출부가 붙은 채 유지. 실행 코드 삭제 전에 해당 참조를 이관·축소할 것.

---

## 동기화

- Placeholder·표 요약 UI: `lib/admin-register-supplier-input-frames.ts`
- 본 문서: 운영·검수·온보딩용 전체 규약
