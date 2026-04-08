# 복합 도시 패키지 상세 스크래퍼 (하나투어 / 모두투어)

다중 도시(최대 20개) 라우팅, 일자별 아코디언 일정 해체, 도시별 대표 이미지 1:1 매핑, 달력 페이징으로 날짜별 요금/좌석 로그 추출.

## 요구사항

- Python 3.10+
- Playwright

## 설치

```bash
pip install playwright
playwright install chromium
```

## 실행

```bash
# 기본: 오사카/교토/고베, 해외여행>일본>간사이, 하나투어
python -m scripts.tour_detail_scraper.main

# target_cities, menu_path 지정 (쉼표 구분)
python -m scripts.tour_detail_scraper.main "오사카,교토,고베" "해외여행,일본,간사이"

# 사이트 + 상품 수 제한
python -m scripts.tour_detail_scraper.main "오사카,교토" "해외여행,일본,간사이" modetour 3

# 브라우저 표시
python -m scripts.tour_detail_scraper.main "오사카,교토,고베" "해외여행,일본,간사이" hanatour --no-headless
```

## 산출물 스키마 (JSON)

- `data/tour_detail/{site}_{cities}_detail.json`
- 구조:
  - `target_cities`, `site`
  - `products[]`: 각 상품별
    - `product_info`: name, base_price, tags, min_pax
    - `city_images`: { "오사카": "url", "교토": "url", ... }
    - `itinerary`: [{ day, cities_visited, spots, meals, hotel }, ...]
    - `calendar_logs`: [{ date, price, status, seats_left }, ...]

## DOM 셀렉터

실제 사이트에 맞게 `config.py`의 `SELECTOR_*` 수정 필요.

- Stealth: 랜덤 User-Agent, 클릭 간 `random.uniform(1.5, 3.5)` 딜레이 필수.
- 아코디언: 클릭 후 `wait_for_selector`/대기 적용.
- 달력: 빈 셀·요금 없음 셀은 에러 없이 패스.
