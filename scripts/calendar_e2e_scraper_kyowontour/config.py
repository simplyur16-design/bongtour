# -*- coding: utf-8 -*-
"""교원이지(kyowontour) E2E 스크래퍼 설정."""
from __future__ import annotations

import os

# --- 클릭·월 범위 ---
MAX_CLICKS: int = max(1, int(os.environ.get("KYOWONTOUR_E2E_MAX_CLICKS", "32")))
MONTH_LIMIT: int = max(1, min(36, int(os.environ.get("KYOWONTOUR_E2E_MONTH_LIMIT", "12"))))

# --- 브라우저 ---
HEADLESS: bool = os.environ.get("KYOWONTOUR_E2E_HEADLESS", "true").lower() in ("1", "true", "yes", "on")
TIMEOUT_S: int = max(15, min(300, int(os.environ.get("KYOWONTOUR_E2E_TIMEOUT_S", "60"))))
PAGE_LOAD_TIMEOUT_S: int = max(10, min(120, int(os.environ.get("KYOWONTOUR_E2E_PAGE_LOAD_TIMEOUT_S", "30"))))
AJAX_WAIT_S: int = max(3, min(60, int(os.environ.get("KYOWONTOUR_E2E_AJAX_WAIT_S", "10"))))

# --- 날짜 필터 (verygoodtour 패턴) ---
DATE_FROM: str | None = (os.environ.get("KYOWONTOUR_DATE_FROM") or "").strip() or None
DATE_TO: str | None = (os.environ.get("KYOWONTOUR_DATE_TO") or "").strip() or None

USER_AGENT: str | None = (os.environ.get("KYOWONTOUR_USER_AGENT") or "").strip() or None

API_BASE: str = (os.environ.get("KYOWONTOUR_API_BASE_URL") or "https://www.kyowontour.com").rstrip("/")

# 상세 URL 후보 (사이트 변경 시 env 로 덮어쓰기)
DETAIL_URL_TEMPLATE: str | None = (os.environ.get("KYOWONTOUR_E2E_DETAIL_URL") or "").strip() or None

DEFAULT_DETAIL_URL_CANDIDATES: list[str] = [
    "https://www.kyowontour.com/goods/goodsDetail.do?tourCd={tourCode}",
    "https://www.kyowontour.com/goods/goodsDetail.do?goodsCd={tourCode}",
    "https://www.kyowontour.com/goods/goodsDetail?tourCd={tourCode}",
    "https://www.kyowontour.com/goods/goodsDetail?goodsCd={tourCode}",
]
