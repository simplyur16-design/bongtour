# 하나투어 달력 E2E — SSOT · 봉인

**갱신:** 2026-05 · **코드 SSOT:** `scripts/calendar_e2e_scraper_hanatour/`

과거 `*DEV*` 복제본·루트 검증 스크립트는 제거됨. 새 파일로 되돌리지 않는다.

---

## 실행 (통합)

| 목적 | 명령 |
|------|------|
| 단일 수집 | `python -m scripts.calendar_e2e_scraper_hanatour.main <trp_url> [max_months]` |
| 다중 검증 | `python -m scripts.calendar_e2e_scraper_hanatour.main --batch <url>...` |
| DB 회귀 | `npm run verify:hanatour-e2e-db` |
| originUrl 감사 | `npm run verify:hanatour-e2e-db -- --audit-urls` |
| 봉인 가드 | `npm run verify:hanatour-e2e-seal` |
| 스케줄러 | `scripts/calendar_price_scheduler.py` → `calendar_price_scraper.run_calendar_price_from_url` |

Node: `lib/hanatour-departures.ts` → 위 `main` subprocess.

---

## 모달 UI (운영 계약)

1. CTA: 「다른 출발일 보기/선택」·「다른 출발일 상품」 등  
2. 좌측 달력: **가격(만) 표시된 일자만** 클릭 대상 (`__hanatourPricedDayCell`)  
3. 달력 영역 **스크롤**로 비가시 일자까지 ENUM  
4. 일자 클릭 시 우측 리스트 **갱신** (list_wait)  
5. 우측 리스트 **스크롤** 후 동일 상품명 row 매칭  
6. `YYYY년 M월` **← 이전 · → 다음** 월 이동  

기본 회귀 URL: `config.DEFAULT_E2E_TEST_URL` (`ATP300260601BX2`).

---

## 파일 역할 (재분할 금지)

| 파일 | 역할 |
|------|------|
| `scraper.py` | 브라우저·달력·리스트 수집 전부 |
| `calendar_price_scraper.py` | API·scheduler env·batch·report |
| `utils.py` | 동일상품·UA·가격 파싱 |
| `config.py` | hanatour 전용 타임아웃/셀렉터 |
| `main.py` | CLI 전용 |

---

## 봉인 규칙

- `calendar_e2e_scraper_hanatourDEV` 또는 `*DEV.py` hanatour 달력 복제 **추가 금지**
- `scripts/validate_hanatour_e2e_validation_set.py` 등 **루트 Python E2E** 추가 금지 → `main --batch`
- 공급사 공통 스크래퍼 설정을 hanatour `config.py`에 합치지 않음 (`.cursor/rules/supplier-adapters-human-browsing.mdc`)
- CI/로컬: `npm run verify:hanatour-e2e-seal` 실패 시 머지 전 수정

등록·본문 파싱: `docs/ops/hanatour-lib-inventory.md` (E2E와 별도 SSOT).
