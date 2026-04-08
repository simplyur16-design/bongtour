# -*- coding: utf-8 -*-
"""수집 시작일: KST 기준 오늘의 다음날 (오늘·과거 출발 제외)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def kst_collect_start_ymd() -> str:
    return (datetime.now(KST) + timedelta(days=1)).strftime("%Y-%m-%d")
