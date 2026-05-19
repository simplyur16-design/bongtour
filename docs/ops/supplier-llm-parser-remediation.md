# 공급사별 LLM·파서 정리 — 점검·교정 로드맵

**목표 화면:** 모두투어(`modetour`)가 가장 최근 교정된 기준. 공개 상세·관리자 미리보기·일정·항공·가격 카드가 **모두투어와 같은 품질·레이아웃**이 되도록 맞춘다.

**범위:** LLM·등록 파서·`register-parse-*`·`register-from-llm-*`·공개 `public-consumption-*`  
**제외:** `scripts/calendar_e2e_scraper_*` 전부 (E2E·스크래퍼 건드리지 않음)

**진행 방식:** 공급사 **한 곳씩**. 각 공급사마다 **점검(읽기) → 합의 → 교정 → verify** 후 다음으로.

---

## 공급사 키 (운영·문서)

`hanatour` · `modetour` · `verygoodtour` · `ybtour`  
(코드에 `lottetour` / `kyowontour` 가 남아 있으면 이번 4공급사 라운드 **범위 밖** — 별도 라운드)

---

## 레이어 구조 (모두투어 기준)

```
관리자 붙여넣기
  → detail-body-parser-{supplier}     ← 섹션 앵커·정형칸 우선 (문서: body-parser-*-ssot.md)
  → register-input-parse-{supplier}     ← 항공·옵션·쇼핑 정형칸 SSOT
  → register-parse-{supplier}.ts        ← orchestration (LLM 호출 전후 병합)
  → register-from-llm-{supplier}.ts     ← Gemini JSON 본체 (~2.1k lines)
  → register-schedule-extract-{supplier}
  → parse-and-register-{supplier}-handler / orchestration
  → syncProductGeoTags                  ← 메가메뉴 (공통, docs/ops/mega-menu-geo-tags-contract.md)
  → public-consumption-{supplier}       ← 공개 상세 탭·쇼핑·옵션 resolution
```

모두투어 전용 계약: `docs/ops/modetour-parse-contract.md` (타 공급사에 **옮기지 않음** — 해당 공급사 전용 계약을 **따로** 쓴다)

---

## Phase 0 — 공통 고정 (이미 적용·유지)

- [x] 메가메뉴 `menuGroup` + `syncProductGeoTags` + 클러스터·메가메뉴 도시 다중 태그
- [ ] 공급사 정리 PR마다 `npx tsx scripts/verify-mega-menu-ssot-browse.ts` 통과
- [ ] 공급사 정리 PR마다 `npx tsx scripts/verify-supplier-pipeline-alignment.ts` (해당 brand 샘플)

---

## Phase 1 — 모두투어 (코드 정리 완료 · 운영 회귀만 잔여)

**역할:** “정답 화면” 레퍼런스 + **lib 쓰레기 더미부터** 정리.

| 항목 | 경로·문서 |
|------|-----------|
| **인벤토리 SSOT** | `docs/ops/modetour-lib-inventory.md` |
| LLM 본체 | `lib/register-from-llm-modetour.ts` (~2157 lines) |
| Orchestration | `lib/register-parse-modetour.ts` |
| 스키마·블록 | `lib/register-llm-schema-modetour.ts`, `lib/register-llm-blocks-modetour.ts` |
| 항공 | `lib/flight-modetour-parser.ts`, `lib/register-modetour-flight.ts` |
| 공개 소비 | `lib/public-consumption-modetour.ts`, `lib/modetour-product-public-display.ts` |
| 문서 | `docs/body-parser-modetour-ssot.md`, `docs/ops/modetour-parse-contract.md` |

**P0 완료:**

- [x] 58파일 인벤토리·책임 그룹·명명 규칙 문서화
- [x] 크로스 공급사 오염 제거: `flight-preferred-legs-modetour` → `flight-preferred-legs-kr-out-in`
- [x] `npm run verify:modetour-lib` 회귀 가드

**P1b 완료 (코드 정리):**

- [x] `register-from-llm-modetour.ts` dead branch·중복 프롬프트 제거 — 항공·옵션·쇼핑·`prices[]`는 pastedBlocks/E2E SSOT, LLM 본문에서 제거; `resolveDirectedFlightLines` 필수; `npm run verify:modetour-avp603` 통과

**P1 잔여 (운영) — 문서 SSOT 완료:**

- [x] 회귀 체크리스트·URL 템플릿 — `docs/ops/modetour-regression-baseline.md` (스크린은 운영자가 `docs/ops/screenshots/`에 날짜 붙여 저장)
- [x] 전용 플래그·분기 목록 — `docs/ops/modetour-only-flags.md` (**공통화 금지**)

---

## Phase 2~ — 공급사별 (한 번에 하나만)

각 공급사 **시작 전** 아래 표를 채운 뒤, **코드 수정은 표 승인 후**.

### 공통 점검 체크리스트 (복사용)

| # | 점검 | 모두투어 | 대상 공급사 |
|---|------|----------|-------------|
| A | `register-from-llm-*.ts` 줄 수·구조 diff (복붙 덩어리·죽은 분기) | ✓ | hanatour 2616줄 — P1b 대기 |
| B | `register-schedule-extract-*.ts`가 modetour와 동일 복사본인지 | 507 | 509 — 거의 동일, supplier 유지 |
| C | `register-llm-schema` / `register-llm-blocks` 필드·프롬프트 블록 차이 | ✓ | diff 필요 |
| D | `register-parse-*` 단계 순서 (정형칸 우선·일정 보강·가격 finalize) | ✓ | ✓ 181줄, flight directed 주입 |
| E | `detail-body-parser-*` 앵커·섹션 SSOT 문서 ↔ 코드 일치 | ✓ | `body-parser-hanatour-ssot.md` |
| F | `public-consumption-*` API가 modetour와 같은 `resolve*` 패턴인지 | ✓ | ✓ ~289줄, 대조 잔여 |
| G | 공개 `product-detail-view` 분기·FMC·가격 merge 동작 샘플 1건 | ✓ | 샘플 1건 운영 |
| H | `parse-and-register` → `syncProductGeoTags` 호출 여부 | ✓ | ✓ orchestration |
| I | 패턴 혼재: hanatour 전용 로직이 ybtour 파일에 섞임 등 `rg` 스캔 | — | 1차 이상 없음 |

**교정 원칙**

1. 모두투어 **화면·데이터 shape** 맞추기 (코드 통합·공통 거대 if 금지).
2. 공급사 전용 모듈 유지 (`flight-*-{supplier}`, `register-*-{supplier}`).
3. 한 PR = 한 공급사 + verify 스크립트.
4. E2E 스크래퍼·`calendar_e2e_*` 무터치.

---

### 2-A. 하나투어 `hanatour` (권장 1순위)

**규모:** lib `*hanatour*` 약 58파일 · `register-from-llm-hanatour.ts` ~2492 lines (modetour보다 큼)

**문서:** `docs/body-parser-hanatour-ssot.md`, `docs/PARSING_MANUAL_HANATOUR.md`

**1차 점검 소견 (2026-05, 코드 읽기만)**

| 이슈 | 설명 |
|------|------|
| LLM 파일 비대 | `register-from-llm-hanatour`가 modetour보다 ~300줄 큼 — 중복·실험 프롬프트(`COMPACT_INTRO` vs `INTRO`) 혼재 가능 |
| schedule extract | `register-schedule-extract-hanatour` ~483 lines — modetour와 거의 동일 복사 추정 → diff 필요 |
| 항공 | `register-flight-hanatour` — modetour `flight-modetour-parser` / directed 계약과 **별도** 유지 (옮기지 말 것) |
| 하나투어 전용 | 쇼핑 횟수 추출 `register-hanatour-shopping`, 예약상태 본문 파싱 등 — 유지·문서화 |
| 공개 소비 | `public-consumption-hanatour` 존재 — modetour와 API 대조 필요 |

**P3 완료 (2026-05):** `register-admin-core-hanatour` · orchestration digest 중복 제거 · `docs/ops/hanatour-lib-inventory.md` · `npm run verify:hanatour-lib`

**P1b 완료 (2026-05):** LLM trim · `requireDirectedFlightLineResolver` · `verify:hanatour-atp207` · 쇼핑 횟수 규칙 `docs/ops/supplier-shopping-visit-count.md`

**P2 완료 (2026-05):** `docs/ops/hanatour-parse-contract.md` · 항공 9파일 P2 경계 주석

**상태:** 🔄 공개 상세 출발일 변경 시 hero↔일정 항공 동기화 점검 잔여

---

### 2-B. 노랑풍선 `ybtour`

**규모:** lib `*ybtour*` 약 59파일 · `register-from-llm-ybtour.ts` ~2349 lines

**문서:** `docs/body-parser-ybtour-ssot.md` (modetour 대비 문서 적음)

**1차 점검 소견**

| 이슈 | 설명 |
|------|------|
| 문서 밀도 | body-parser SSOT 1개 — 교정 시 modetour 수준 체크리스트·계약 문서 보강 검토 |
| orchestration | `parse-and-register-ybtour-orchestration` ~1685 lines — handler 분리 구조는 hanatour와 유사 |
| schedule extract | 483 lines — 타 공급사와 동일 패턴 복사 의심 |

**P3 완료 (2026-05):** `register-admin-core-ybtour` · orchestration digest 중복 제거 · `docs/ops/ybtour-lib-inventory.md` · `npm run verify:ybtour-lib`

**P1b 완료 (2026-05):** LLM trim · `requireDirectedFlightLineResolver` · `docs/ops/supplier-shopping-visit-count.md` (ybtour 횟수=시그널)

**P2 완료 (2026-05):** `docs/ops/ybtour-parse-contract.md` · 항공 P2 경계 주석

**상태:** 🔄 운영 회귀·달력 E2E는 별도 지시 시만

---

### 2-C. 참좋은여행 `verygoodtour`

**규모:** lib `*verygoodtour*` 약 58파일 · handler ~1542 lines (orchestration이 handler에 가깝게 통합)

**문서:** `docs/body-parser-verygoodtour-ssot.md` (확인 필요)

**1차 점검 소견**

| 이슈 | 설명 |
|------|------|
| handler 형태 | modetour/hanatour는 handler + orchestration 분리, verygoodtour는 handler 비대 — 책임 분리가 1차 과제일 수 있음 |
| LLM | `register-from-llm-verygoodtour` ~2427 lines |

**P3 완료 (2026-05):** `register-admin-core-verygoodtour` · handler digest 중복 제거 · `docs/ops/verygoodtour-lib-inventory.md` · `npm run verify:verygoodtour-lib`

**P1b 완료 (2026-05):** LLM trim · `requireDirectedFlightLineResolver` · ybtour 교차 문단 제거

**P2 완료 (2026-05):** `docs/ops/verygoodtour-parse-contract.md` · 항공 P2 경계 주석

**상태:** 🔄 handler 분리·운영 회귀는 별도 라운드

---

## 권장 순서

1. **Phase 0** — geo·메가메뉴 verify 고정 (완료 유지)
2. **Phase 1** — modetour 스냅샷·동결 (반나절, 수정 없이 캡처만 해도 됨)
3. **hanatour** — 점검표 A~I 작성 → 교정 PR
4. **ybtour**
5. **verygoodtour**

한 공급사 **교정 PR이 머지된 뒤** 다음 공급사 점검을 시작한다 (패턴 혼재 재발 방지).

---

## 다음 세션에서 할 일 (에이전트·운영)

1. ~~첫 교정 대상: `hanatour`~~ — P3 완료.
2. **다음:** hanatour P2·공개 상세 항공 동기화. 쇼핑 횟수: `docs/ops/supplier-shopping-visit-count.md` (modetour·hanatour=LLM, ybtour·verygoodtour=목록/시그널).
3. 공개 상세 출발일 변경 시 항공 표시 hero↔일정 동기화 여부 샘플 1건.
4. E2E 스크래퍼 무터치.

---

## 참고 스크립트 (E2E 아님)

| 스크립트 | 용도 |
|----------|------|
| `scripts/verify-mega-menu-ssot-browse.ts` | 메가메뉴 URL·태그 |
| `scripts/verify-supplier-pipeline-alignment.ts` | 공개 consumption·가격·FMC 샘플 |
| `scripts/audit-public-product-display.ts` | 공개 표시 감사 |
| `npm run backfill:product-city-tag` | 기존 상품 도시 태그 |
