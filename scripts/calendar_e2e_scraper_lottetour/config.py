# -*- coding: utf-8 -*-
"""롯데관광(lottetour) E2E 스크래퍼 설정 (환경변수 `LOTTETOUR_*`)."""
from __future__ import annotations

import os

BASE_URL: str = (os.environ.get("LOTTETOUR_BASE_URL") or "https://www.lottetour.com").rstrip("/")

MONTH_LIMIT: int = max(1, min(36, int(os.environ.get("LOTTETOUR_CALENDAR_MONTH_COUNT", "12"))))
MAX_EVT_CNT: int = max(5, min(50, int(os.environ.get("LOTTETOUR_E2E_MAX_EVT_CNT", "19"))))
EVT_ORDER_BY: str = (os.environ.get("LOTTETOUR_EVT_ORDER_BY") or "DT").strip().upper() or "DT"

REQUEST_TIMEOUT_S: int = max(10, min(120, int(os.environ.get("LOTTETOUR_E2E_REQUEST_TIMEOUT_S", "45"))))

DATE_FROM: str | None = (os.environ.get("LOTTETOUR_DATE_FROM") or "").strip() or None
DATE_TO: str | None = (os.environ.get("LOTTETOUR_DATE_TO") or "").strip() or None

USER_AGENT: str | None = (os.environ.get("LOTTETOUR_USER_AGENT") or "").strip() or None
