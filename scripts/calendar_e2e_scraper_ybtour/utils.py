# -*- coding: utf-8 -*-
"""
인간 모사 & Anti-Blocking: Action Delay 1.5~3.5초, Product Interval 5~10초, PageDown 간 1~2초.
playwright-stealth 스타일 WebDriver/User-Agent 숨김.

전사 공통 원칙·표준 이벤트 로그: docs/SCRAPER-HUMAN-OPERATOR-PRINCIPLES.md
"""
import asyncio
import random
import re

from .config import (
    MIN_DELAY,
    MAX_DELAY,
    PRODUCT_INTERVAL_MIN,
    PRODUCT_INTERVAL_MAX,
    PAGEDOWN_DELAY_MIN,
    PAGEDOWN_DELAY_MAX,
)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


async def human_delay(min_sec: float = None, max_sec: float = None) -> None:
    """Action Delay: 페이지 이동, Hover, 달력 화살표 Click 사이 random.uniform(1.5, 3.5) 초 강제."""
    lo = min_sec if min_sec is not None else MIN_DELAY
    hi = max_sec if max_sec is not None else MAX_DELAY
    await asyncio.sleep(random.uniform(lo, hi))


async def product_interval() -> None:
    """Product Interval: 상품 A 파싱 완료 후 B로 넘어가기 전 5~10초 휴식 (WAF/IP 차단 방지)."""
    await asyncio.sleep(random.uniform(PRODUCT_INTERVAL_MIN, PRODUCT_INTERVAL_MAX))


async def pagedown_delay() -> None:
    """각 PageDown 사이 random.uniform(1.0, 2.0) 초 대기."""
    await asyncio.sleep(random.uniform(PAGEDOWN_DELAY_MIN, PAGEDOWN_DELAY_MAX))


def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)


def get_user_agent(fixed: bool = False) -> str:
    """fixed=True면 첫 번째 UA 고정 (Randomize User-Agent 끄기용)."""
    return USER_AGENTS[0] if fixed else get_random_user_agent()


def clean_price_to_int(text: str) -> int:
    """89만 -> 890000, 1,899,000원 -> 1899000."""
    if not text or not str(text).strip():
        return 0
    s = str(text).strip().replace(",", "").replace(" ", "")
    if s in ("-", "—", ""):
        return 0
    if "만" in s:
        s = s.replace("만", "")
        try:
            return int(float(s) * 10000)
        except ValueError:
            pass
    s = re.sub(r"[^\d]", "", s)
    try:
        return int(s) if s else 0
    except ValueError:
        return 0


async def random_mouse_move(page) -> None:
    """Random Mouse Movement: 페이지 내 랜덤 좌표로 마우스 이동 (봇 탐지 완화)."""
    if not page:
        return
    try:
        for _ in range(random.randint(2, 5)):
            x = random.randint(100, 1800)
            y = random.randint(100, 900)
            await page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.05, 0.2))
    except Exception:
        pass


# playwright-stealth 스타일: WebDriver 속성, User-Agent, Navigator.webdriver 플래그 숨김
STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5], configurable: true });
Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
"""
