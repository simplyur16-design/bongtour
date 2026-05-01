# -*- coding: utf-8 -*-
"""modetour calendar E2E 설정 (이 패키지 SSOT)."""
import os
from pathlib import Path

BASE_URL = os.getenv("MODETOUR_BASE_URL", "https://www.modetour.com")

MIN_DELAY = 2.0
MAX_DELAY = 4.0
PRODUCT_INTERVAL_MIN = 4.0
PRODUCT_INTERVAL_MAX = 7.0
PAGEDOWN_DELAY_MIN = 2.0
PAGEDOWN_DELAY_MAX = 3.5
PAGE_LOAD_TIMEOUT_MS = 35000
NETWORK_IDLE_TIMEOUT_MS = 10000

SELECTOR_GNB_OVERSEAS = "a:has-text('해외여행'), nav a:has-text('해외여행'), .gnb a:has-text('해외여행')"
SELECTOR_COUNTRY = ".gnb_sub a, .sub_menu a, .depth2 a"
SELECTOR_CITY = ".gnb_sub a, .depth3 a, .sub_list a"
SELECTOR_PRODUCT_CARD = ".product_item, .tour_item, .package_card, [class*='productCard'], [class*='tourCard']"
SELECTOR_PRODUCT_NAME_LINK = ".tit a, .product_name a, a[href*='/package/'], a[href*='/tour/'], a[href*='detail']"
PAGEDOWN_COUNT = 5
SELECTOR_CALENDAR_WRAP = ".calendar_wrap, .price_calendar, .depart_calendar, [class*='calendar']"
SELECTOR_CALENDAR_YEAR_MONTH = ".calendar_title, .year_month, .cal_head, [class*='calendar'] h3, [class*='month']"
SELECTOR_MONTH_NEXT_ARROW = "button.next, .next_month, a.next, [class*='nextMonth'], [aria-label*='다음'], .month_next"
SELECTOR_MONTH_PREV_ARROW = "button.prev, .prev_month, a.prev, [class*='prevMonth']"
SELECTOR_HALF_SLIDE_RIGHT = "[class*='slide'] button[class*='right'], .slide_next, .half_next, [aria-label*='다음'], .calendar_slide_right"
SELECTOR_HALF_SLIDE_RIGHT_ALT = "button:has-text('>'), .arrow_right, [class*='arrow']:has-text('>')"
SELECTOR_DATE_CELLS = "td:not(.empty):not(.disabled) .date, .date_cell:not(.off), .day_cell"
SELECTOR_DATE_CELL_CONTAINER = "table tbody td, .cal_body td, .date_grid td"
SELECTOR_CELL_PRICE = ".price, .low_price, [class*='price']"
SELECTOR_CELL_STATUS = ".status, [class*='status']"
SELECTOR_CELL_DAY_NUM = ".date, .day_num, [class*='date']"
CALENDAR_MAX_MONTHS = 12

_SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = _SCRIPT_DIR.parent.parent / "data" / "calendar_e2e"


def get_output_path(city: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "_-" else "_" for c in city)
    return OUTPUT_DIR / f"modetour_{safe}_calendar.json"
