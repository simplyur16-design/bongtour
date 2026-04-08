# -*- coding: utf-8 -*-
"""하나투어 TRP 달력·출발 E2E (본 패키지가 구현 SSOT).

정책: `calendar_e2e_scraper_*DEV` 복제본은 하나투어에만 둔다. 모두투어·참좋은여행·노랑풍선 등
타 공급사는 `scripts/calendar_e2e_scraper_<supplier>/` 실전 원본만 유지하고 DEV 폴더를 만들지 않는다.
"""

from .calendar_price_scraperDEV import (
    collect_hanatour_departure_inputs,
    format_e2e_report,
    normalize_hanatour_detail_url_to_trp,
    run_calendar_price_from_url,
    run_e2e_with_report,
)
from .scraperDEV import HanatourCalendarE2EScraper

__all__ = [
    "HanatourCalendarE2EScraper",
    "collect_hanatour_departure_inputs",
    "format_e2e_report",
    "normalize_hanatour_detail_url_to_trp",
    "run_calendar_price_from_url",
    "run_e2e_with_report",
]
