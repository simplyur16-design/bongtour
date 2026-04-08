# -*- coding: utf-8 -*-
"""
End-to-End 달력 스크래퍼: 메인 진입 ~ 이중 화살표 달력 1년 치 수집.
클래스 아키텍처, 인간 모사 딜레이, try-except 겹겹이 적용.
"""
import asyncio
import re
from typing import Any, Dict, List, Optional

from playwright.async_api import Page, async_playwright

from . import config
from .utils import (
    human_delay,
    product_interval,
    pagedown_delay,
    get_random_user_agent,
    clean_price_to_int,
    STEALTH_INIT_SCRIPT,
)


class CalendarE2EScraper:
    """
    여행사 메인 페이지 진입부터 상세 페이지의 이중 화살표 달력(보름 슬라이드 + 월 변경)을
    완벽 제어하여 최소 1년 치 날짜별 가격·예약 상태를 수집하는 E2E 자동화 클래스.
    """

    def __init__(
        self,
        target_country: str = "일본",
        target_city: str = "오사카",
        headless: bool = True,
    ):
        self.site = "verygoodtour"
        self.target_country = target_country
        self.target_city = target_city
        self.headless = headless
        self.base_url = config.BASE_URL
        self._page: Optional[Page] = None
        self._browser = None
        self._context = None
        self.result: Dict[str, Any] = {
            "city": target_city,
            "products": [],
        }

    async def __aenter__(self) -> "CalendarE2EScraper":
        await self._launch_browser()
        return self

    async def __aexit__(self, *args) -> None:
        await self._close_browser()

    async def _launch_browser(self) -> None:
        """Playwright 기동 + Stealth(WebDriver 속성 숨김) + 랜덤 UA."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        self._context = await self._browser.new_context(
            user_agent=get_random_user_agent(),
            viewport={"width": 1920, "height": 1080},
            locale="ko-KR",
        )
        await self._context.add_init_script(STEALTH_INIT_SCRIPT)
        self._page = await self._context.new_page()
        self._page.set_default_timeout(config.PAGE_LOAD_TIMEOUT_MS)

    async def _close_browser(self) -> None:
        try:
            if self._browser:
                await self._browser.close()
        except Exception:
            pass
        try:
            if getattr(self, "_playwright", None):
                await self._playwright.stop()
        except Exception:
            pass

    # ----- Depth 1: 메인 페이지 및 GNB '해외여행' Hover -----
    async def depth1_main_and_gnb_hover(self) -> bool:
        """메인 접속 후 networkidle 대기, '해외여행' Hover로 메가 메뉴 전개."""
        try:
            await self._page.goto(
                self.base_url,
                wait_until="domcontentloaded",
                timeout=config.PAGE_LOAD_TIMEOUT_MS,
            )
            await self._page.wait_for_load_state(
                "networkidle",
                timeout=config.NETWORK_IDLE_TIMEOUT_MS,
            )
            await human_delay(2.0, 3.0)
        except Exception:
            return False
        try:
            el = await self._page.wait_for_selector(
                config.SELECTOR_GNB_OVERSEAS,
                timeout=8000,
                state="visible",
            )
            if el:
                await human_delay()
                await el.hover()
                await human_delay()
                return True
        except Exception:
            pass
        try:
            for node in await self._page.query_selector_all("nav a, .gnb a, header a"):
                t = await node.text_content()
                if t and "해외여행" in (t or "").strip():
                    await node.hover()
                    await human_delay()
                    return True
        except Exception:
            pass
        return False

    # ----- Depth 2~3: 국가 Hover / 도시 Click -----
    async def depth2_3_country_and_city_click(self) -> bool:
        """타겟 국가 Hover 후 타겟 도시 Click으로 상품 리스트 페이지 진입."""
        await human_delay()
        try:
            country_links = await self._page.query_selector_all(config.SELECTOR_COUNTRY)
            for node in country_links:
                t = await node.text_content()
                if t and self.target_country in (t or "").strip():
                    await human_delay()
                    await node.hover()
                    await human_delay()
                    break
        except Exception:
            pass
        await human_delay()
        try:
            city_links = await self._page.query_selector_all(config.SELECTOR_CITY)
            for node in city_links:
                t = await node.text_content()
                if t and self.target_city in (t or "").strip():
                    await human_delay()
                    await node.click()
                    await human_delay()
                    return True
        except Exception:
            pass
        return False

    # ----- Depth 4: 검색 결과 페이지 - PageDown(Lazy Load) 후 상품 링크 리스트업 (직렬 처리용) -----
    async def depth4_list_pagedown_and_collect_links(self) -> List[str]:
        """PageDown 수회 발생(각 회당 1.0~2.0초 대기), 렌더링된 상품 카드 링크를 배열로 리스트업. For 루프 직렬 진입용."""
        await human_delay()
        try:
            for _ in range(config.PAGEDOWN_COUNT):
                await self._page.keyboard.press("PageDown")
                await pagedown_delay()
        except Exception:
            pass
        await human_delay()
        urls: List[str] = []
        seen: set = set()
        try:
            links = await self._page.query_selector_all(config.SELECTOR_PRODUCT_NAME_LINK)
            if not links:
                cards = await self._page.query_selector_all(config.SELECTOR_PRODUCT_CARD)
                for card in cards:
                    a = await card.query_selector("a")
                    if a:
                        links.append(a)
            for a in links:
                try:
                    href = await a.get_attribute("href")
                    if not href or href in seen:
                        continue
                    full = href if href.startswith("http") else (self.base_url.rstrip("/") + href)
                    seen.add(href)
                    urls.append(full)
                except Exception:
                    continue
        except Exception:
            pass
        return urls

    # ----- Depth 5: 상세 페이지 로드 및 달력 영역 포커싱 (smooth 스크롤) -----
    async def depth5_detail_load_and_scroll_to_calendar(self) -> str:
        """상세 페이지 로드 대기 후, 달력 위젯이 보이도록 behavior: 'smooth' 스크롤. 상품명 반환."""
        product_name = ""
        try:
            await self._page.wait_for_load_state(
                "networkidle",
                timeout=config.NETWORK_IDLE_TIMEOUT_MS,
            )
            await human_delay()
        except Exception:
            pass
        try:
            title_el = await self._page.query_selector(
                "h1.tit, .product_title, [class*='productName']"
            )
            if title_el:
                product_name = (await title_el.text_content() or "").strip()
        except Exception:
            pass
        try:
            wrap = await self._page.query_selector(config.SELECTOR_CALENDAR_WRAP)
            if wrap:
                await wrap.evaluate("el => el.scrollIntoView({ behavior: 'smooth' })")
                await human_delay()
        except Exception:
            pass
        try:
            await self._page.evaluate(
                "const el = document.querySelector('[class*=\"calendar\"]'); if (el) el.scrollIntoView({ behavior: 'smooth' });"
            )
            await human_delay()
        except Exception:
            pass
        return product_name

    # ----- Depth 6: 이중 화살표 달력 - 중첩 While 루프 (보름 클릭 후 1~2초, 월 클릭 후 1.5~3초) -----
    async def depth6_dual_arrow_calendar_parse(self) -> List[Dict[str, Any]]:
        """
        Outer Loop: 월 단위 최대 12회. 월 변경 화살표 클릭 후 random.uniform(1.5, 3.0) 초 대기.
        Inner Loop: 보름 슬라이드 클릭 후 random.uniform(1.0, 2.0) 초 대기. Deduplication: Set으로 중복 방지.
        """
        seen_dates: set = set()
        logs: List[Dict[str, Any]] = []
        month_count = 0

        while month_count < config.CALENDAR_MAX_MONTHS:
            try:
                year_month_text = await self._parse_current_year_month()
                if not year_month_text:
                    break
                y, m = self._parse_ym(year_month_text)
                if not y or not m:
                    break
            except Exception:
                break

            # ----- Inner Loop: 보름(Half) 슬라이드 순회 -----
            inner_loop_count = 0
            max_inner = 3
            while inner_loop_count < max_inner:
                try:
                    cells_data = await self._collect_visible_date_cells(y, m)
                    for item in cells_data:
                        date_key = item.get("date")
                        if date_key and date_key not in seen_dates:
                            seen_dates.add(date_key)
                            logs.append(item)
                except Exception:
                    pass

                try:
                    slide_btn = await self._page.query_selector(
                        config.SELECTOR_HALF_SLIDE_RIGHT
                    )
                    if not slide_btn:
                        slide_btn = await self._page.query_selector(
                            config.SELECTOR_HALF_SLIDE_RIGHT_ALT
                        )
                    if not slide_btn:
                        break
                    disabled = await slide_btn.get_attribute("disabled")
                    if disabled is not None:
                        break
                    await slide_btn.click()
                    await human_delay(1.0, 2.0)
                    inner_loop_count += 1
                except Exception:
                    break

            # ----- 월 변경 화살표(다음 달) 클릭 후 1.5~3.0초 대기 -----
            month_count += 1
            try:
                month_btn = await self._page.query_selector(
                    config.SELECTOR_MONTH_NEXT_ARROW
                )
                if not month_btn:
                    break
                disabled = await month_btn.get_attribute("disabled")
                if disabled is not None:
                    break
                await month_btn.click()
                await human_delay(1.5, 3.0)
            except Exception:
                break

        return sorted(logs, key=lambda x: x.get("date", ""))

    async def _parse_current_year_month(self) -> Optional[str]:
        try:
            el = await self._page.query_selector(config.SELECTOR_CALENDAR_YEAR_MONTH)
            if el:
                return (await el.text_content() or "").strip()
        except Exception:
            pass
        return None

    def _parse_ym(self, text: str) -> tuple:
        if not text:
            return None, None
        m = re.search(r"(\d{4})\s*[.\s]*\s*(\d{1,2})\s*월?", text)
        if m:
            return m.group(1), m.group(2).zfill(2)
        nums = re.findall(r"\d+", text)
        if len(nums) >= 2:
            return nums[0], nums[1].zfill(2)
        return None, None

    async def _collect_visible_date_cells(
        self, year: str, month: str
    ) -> List[Dict[str, Any]]:
        """현재 화면에 노출된 날짜 셀만 순회하여 date, price, status 추출. '-'/빈 셀 continue."""
        out = []
        try:
            containers = await self._page.query_selector_all(
                config.SELECTOR_DATE_CELL_CONTAINER
            )
            for cell in containers:
                try:
                    day_el = await cell.query_selector(config.SELECTOR_CELL_DAY_NUM)
                    day_text = (
                        (await day_el.text_content() or "").strip() if day_el else ""
                    )
                    if not day_text:
                        day_text = (await cell.text_content() or "").strip().split()[0]
                    day_num = self._day_num(day_text)
                    if not day_num:
                        continue
                    date_str = f"{year}-{month}-{day_num:02d}"
                    price_el = await cell.query_selector(config.SELECTOR_CELL_PRICE)
                    price_text = (
                        (await price_el.text_content() or "").strip() if price_el else ""
                    )
                    if not price_text or price_text.strip() == "-":
                        continue
                    price = clean_price_to_int(price_text)
                    status_el = await cell.query_selector(config.SELECTOR_CELL_STATUS)
                    status = (
                        (await status_el.text_content() or "").strip()
                        if status_el
                        else "예약가능"
                    )
                    out.append(
                        {
                            "date": date_str,
                            "price": price,
                            "status": status or "예약가능",
                        }
                    )
                except Exception:
                    continue
        except Exception:
            pass
        return out

    def _day_num(self, s: str) -> Optional[int]:
        if not s:
            return None
        s = re.sub(r"\D", "", s)
        if not s:
            return None
        d = int(s)
        return d if 1 <= d <= 31 else None

    # ----- 통합 실행 (직렬: 상품 하나씩 처리, 상품 간 Product Interval 5~10초) -----
    async def run(self) -> Dict[str, Any]:
        """
        메인 진입 ~ 리스트 링크 수집 ~ For 루프로 상품 URL 하나씩 순차 진입(동시다발 비동기 금지).
        각 상품 파싱 완료 후 Product Interval(5~10초) 수행 후 다음 상품.
        """
        try:
            if not await self.depth1_main_and_gnb_hover():
                self.result["_error"] = "Depth1: GNB 해외여행 Hover 실패"
                return self.result
            if not await self.depth2_3_country_and_city_click():
                self.result["_error"] = "Depth2-3: 국가/도시 클릭 실패"
                return self.result
            urls = await self.depth4_list_pagedown_and_collect_links()
            if not urls:
                self.result["_error"] = "Depth4: 상품 링크 0건"
                return self.result
            for url in urls:
                try:
                    await human_delay()
                    await self._page.goto(
                        url,
                        wait_until="domcontentloaded",
                        timeout=config.PAGE_LOAD_TIMEOUT_MS,
                    )
                    product_name = await self.depth5_detail_load_and_scroll_to_calendar()
                    calendar_logs = await self.depth6_dual_arrow_calendar_parse()
                    self.result["products"].append(
                        {"product_name": product_name, "calendar_logs": calendar_logs}
                    )
                except Exception as e:
                    self.result["products"].append(
                        {"product_name": "", "calendar_logs": [], "_error": str(e)}
                    )
                await product_interval()
        except Exception as e:
            self.result["_error"] = str(e)
        return self.result
