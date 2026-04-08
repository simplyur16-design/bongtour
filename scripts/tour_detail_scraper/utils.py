# -*- coding: utf-8 -*-
"""
Stealth, 랜덤 딜레이(1.5~3.5), 가격 클렌징(정규식).
"""
import asyncio
import random
import re

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

MIN_DELAY = 1.5
MAX_DELAY = 3.5


def set_delay_bounds(min_sec: float, max_sec: float) -> None:
    global MIN_DELAY, MAX_DELAY
    MIN_DELAY, MAX_DELAY = min_sec, max_sec


async def random_delay(min_sec: float = None, max_sec: float = None) -> None:
    lo = min_sec if min_sec is not None else MIN_DELAY
    hi = max_sec if max_sec is not None else MAX_DELAY
    await asyncio.sleep(random.uniform(lo, hi))


def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)


def clean_price_to_int(text: str) -> int:
    """
    '899,000원', '1,899,000' -> 899000, 1899000.
    콤마·'원' 제거 후 순수 Integer.
    """
    if not text or not str(text).strip():
        return 0
    s = re.sub(r"[,원\s]", "", str(text).strip())
    s = re.sub(r"[^\d]", "", s)
    try:
        return int(s) if s else 0
    except ValueError:
        return 0


def extract_min_pax_from_text(text: str) -> int:
    """'최소출발 6명', '6명' -> 6."""
    if not text:
        return 0
    m = re.search(r"(\d+)\s*명", str(text))
    return int(m.group(1)) if m else 0
