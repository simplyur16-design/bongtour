# -*- coding: utf-8 -*-
"""
하나투어 / 모두투어 복합 도시 패키지 상품 상세 스크래퍼 - DOM/경로 설정.
최대 20개 도시 연계, 아코디언 일정 해체, 도시별 이미지 1:1, 달력 페이징.
"""
import os
from pathlib import Path

# ----- 사이트별 Base URL -----
HANATOUR_BASE_URL = os.getenv("HANATOUR_BASE_URL", "https://www.hanatour.com")
MODETOUR_BASE_URL = os.getenv("MODETOUR_BASE_URL", "https://www.modetour.com")

# ----- 다중 도시 제한 -----
MAX_TARGET_CITIES = 20

# ----- Stealth & Timing (필수: 인간 모사 딜레이) -----
MIN_DELAY = 1.5
MAX_DELAY = 3.5
PAGE_LOAD_TIMEOUT_MS = 35000
NETWORK_IDLE_TIMEOUT_MS = 8000
CALENDAR_PAGE_WAIT_MS = 1000

# ----- Depth 1~4: 메가 메뉴 및 상품 리스트 -----
SELECTOR_GNB_FIRST = "nav a, .gnb a, header a, [class*='menu'] a"
SELECTOR_SUB_MENU = ".gnb_sub a, .sub_menu a, .depth2 a, [class*='submenu'] a"
SELECTOR_DEPTH3_CLICK = ".gnb_sub a, .depth3 a, .sub_list a"
SELECTOR_PRODUCT_CARD = ".product_item, .tour_item, .package_card, [class*='productCard'], [class*='tourCard']"
SELECTOR_PRODUCT_NAME = ".tit, .product_name, .title, [class*='productName'], [class*='tourName']"
SELECTOR_PRODUCT_TAGS = ".tag, .hash, [class*='tag'], [class*='hashtag']"
SELECTOR_PRODUCT_LINK = "a[href*='/package/'], a[href*='/tour/'], a[href*='detail'], a[href*='product']"

# ----- Depth 5: 상세 헤더/메타데이터 -----
SELECTOR_DETAIL_TITLE = "h1.tit, .product_title, .detail_title, [class*='productName'], [class*='detailName']"
SELECTOR_DETAIL_TAGS = ".tag, .badge, [class*='tag'], [class*='keyword']"
SELECTOR_DETAIL_BASE_PRICE = ".price_num, .sale_price, .base_price, [class*='price'] strong, [class*='amount']"
SELECTOR_DETAIL_MIN_PAX = "[class*='minPax'], [class*='min_pax'], .min_person, :text-is('최소출발')"

# ----- Depth 6: 일자별 아코디언 일정 -----
SELECTOR_ITINERARY_WRAP = ".itinerary_wrap, .schedule_wrap, [class*='itinerary'], [class*='daySchedule']"
SELECTOR_DAY_ACCORDION_BTN = "button:has-text('일차'), [class*='dayTab'], .accordion_head:has-text('일차'), [class*='day'] button"
SELECTOR_DAY_ACCORDION_BTN_PATTERN = "button, .accordion_head, [role='button']"  # N일차 텍스트 포함 요소
SELECTOR_DAY_BODY = ".accordion_body, .day_content, [class*='dayBody'], [class*='scheduleDetail']"
SELECTOR_CITY_IN_DAY = "[class*='city'], .spot_title, :text-matches('로 이동|도착|방문')"
SELECTOR_SPOT_NAME = ".spot_name, .attraction, [class*='spot'] .tit"
SELECTOR_SPOT_DESC = ".spot_desc, .desc, [class*='description']"
SELECTOR_MEALS = ".meal, [class*='meal'], .breakfast, .lunch, .dinner"
SELECTOR_DAY_IMAGES = ".day_content img, .schedule_detail img, [class*='itinerary'] img"

# ----- Depth 7: 호텔 & 관광지 탭 -----
SELECTOR_TAB_HOTEL = "a:has-text('호텔'), a:has-text('관광지'), [data-tab*='hotel']"
SELECTOR_HOTEL_BY_DAY = ".hotel_list li, [class*='hotel'] .item, .day_hotel"
SELECTOR_HOTEL_NAME = ".hotel_name, .name, [class*='hotelName']"
SELECTOR_HOTEL_GRADE = ".grade, .star, [class*='grade'], [class*='star']"

# ----- Depth 8: 달력 페이징 -----
SELECTOR_CALENDAR_WRAP = ".calendar_wrap, .price_calendar, .depart_calendar, [class*='calendar']"
SELECTOR_CALENDAR_YEAR_MONTH = ".calendar_title, .year_month, [class*='calendar'] h3"
SELECTOR_CALENDAR_GRID = "table tbody, .cal_body, .date_grid"
SELECTOR_CALENDAR_CELL = "td:not(.empty):not(.disabled), .date_cell:not(.off)"
SELECTOR_CELL_DATE = ".date, .day_num"
SELECTOR_CELL_PRICE = ".price, .low_price"
SELECTOR_CELL_STATUS = ".status, [class*='status']"
SELECTOR_CELL_SEATS = ".seats, .remain, [class*='seat']"
SELECTOR_CALENDAR_NEXT = "button.next, .next_month, a.next, [class*='next']"
CALENDAR_MAX_MONTHS = 12

# ----- 출력 -----
_SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = _SCRIPT_DIR.parent.parent / "data" / "tour_detail"


def get_base_url(site: str) -> str:
    return HANATOUR_BASE_URL if site == "hanatour" else MODETOUR_BASE_URL


def get_output_path(site: str, cities_key: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "_-" else "_" for c in cities_key)
    return OUTPUT_DIR / f"{site}_{safe}_detail.json"
