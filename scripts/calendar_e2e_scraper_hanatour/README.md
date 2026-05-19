# 하나투어 달력 E2E (SSOT · 봉인)

**유일한 구현 위치.** 스케줄러·Node·수동 실행은 모두 이 패키지를 통해서만 호출한다.

## 진입점 (이것만 사용)

| 용도 | 명령 |
|------|------|
| 단일 URL JSON | `python -m scripts.calendar_e2e_scraper_hanatour.main <url> [max_months]` |
| 스모크 보고 | `python -m ...main --report [url]` |
| 다중 URL 검증 | `python -m ...main --batch <url> [url...]` |
| DB 상품 검증 | `npm run verify:hanatour-e2e-db` |
| 달력 탐색만(개발) | `python -m ...main --explore <url>` |
| 배치 가격 수집 | `calendar_price_scraper.run_calendar_price_from_url` (scheduler) |

## 모듈 (쪼개기 최소)

- `scraper.py` — Playwright·모달·달력·리스트·동일상품
- `calendar_price_scraper.py` — collect / scheduler env / batch / report
- `utils.py` — 동일상품 키·브라우저
- `config.py` — 타임아웃·셀렉터 (hanatour 전용)
- `main.py` — CLI만
- `verify_exploration_range.py` — `--explore` 내부용 (직접 실행 금지)

## UI 계약

1. 「다른 출발일」 모달 → 좌 달력 · 우 상품 리스트  
2. **금액(N만) 있는 날만** 클릭 → 우측 리스트 갱신  
3. 달력·리스트 각각 **스크롤** 후 전체 일자/행 탐색  
4. 헤더 **← 이전달 · → 다음달**  
5. `utils.filter_hanatour_same_product_rows` — 등록 상품명과 동일 row만 수집  

## 봉인 (오염 금지)

- `calendar_e2e_scraper_hanatourDEV` · `*DEV.py` · 루트 `validate_hanatour_*.py` **생성 금지**
- 타 공급사 스크래퍼 설정을 hanatour `config.py`에 합치지 않음
- 변경 후: `npm run verify:hanatour-e2e-seal`

상세: `docs/ops/hanatour-e2e-ssot.md` · `SEAL.json`
