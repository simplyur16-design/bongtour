# -*- coding: utf-8 -*-
"""
ybtour 전용: 상품 상세 출발일 모달·달력·우측 리스트 기반 E2E.
타겟: 출발일별 가격·상태 등 row 수집(KST 오늘 이전 제외). playwright-stealth, 액션 간 0.5~1.0초 딜레이.
"""
import asyncio
import datetime as dt
import json
import os
import re
import sys
import traceback
import urllib.parse
from typing import Any, Dict, List, Optional

from playwright.async_api import Page, async_playwright

from scripts.shared.airline_encoding_fix import fix_airline_name_str

from . import config
from .utils import (
    human_delay,
    get_random_user_agent,
    get_user_agent,
    STEALTH_INIT_SCRIPT,
    random_mouse_move,
)

_KST = dt.timezone(dt.timedelta(hours=9))
# lib/scrape-date-bounds.ts SCRAPE_DEFAULT_MONTHS_FORWARD 와 맞춤
DEFAULT_CALENDAR_MONTH_LIMIT = 6


def _kst_today_ymd() -> str:
    return dt.datetime.now(_KST).strftime("%Y-%m-%d")


def _kst_month_start() -> dt.date:
    d = dt.datetime.now(_KST).date()
    return d.replace(day=1)


def _filter_calendar_rows_kst_floor(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    floor = _kst_today_ymd()
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = str(r.get("date") or "").strip()[:10]
        if len(d) == 10 and d >= floor:
            out.append(r)
    return out


# 명세: 모달/월 이동/클릭 사이 대기(차단 완화는 공급사별 상수로 유지·이전보다 짧게)
DELAY_MIN = 0.5
DELAY_MAX = 1.0
SLIDE_WAIT_MS = 1000
MONTH_WAIT_MS = 1500

# 출발일 변경: 우측 스티키/요약 영역 CTA 우선, 이후 일반 본문 버튼
YBTOUR_POPUP_OPEN_SELECTORS = [
    "aside button:has-text('출발일 변경')",
    "aside a:has-text('출발일 변경')",
    "[class*='sticky'] button:has-text('출발일 변경')",
    "[class*='sticky'] a:has-text('출발일 변경')",
    ".product_summary button:has-text('출발일 변경')",
    ".product_summary a:has-text('출발일 변경')",
    "button:has-text('출발일 보기')",
    "a:has-text('출발일 보기')",
    "button:has-text('출발일보기')",
    "a:has-text('출발일보기')",
    "button:has-text('출발일 변경')",
    "a:has-text('출발일 변경')",
    "button:has-text('출발일변경')",
    "a:has-text('출발일변경')",
    "button:has-text('출발일 선택')",
    "a:has-text('출발일 선택')",
    "[role='button']:has-text('출발일 보기')",
]
YBTOUR_MONTH_NEXT_SELECTORS = [
    ".month_next",
    ".calendar_next",
    "button.next",
    "a.next",
    "button:has-text('다음달')",
    "a:has-text('다음달')",
    "button.calendar_next",
    "a.calendar_next",
    "button:has-text('다음 달')",
    "[class*='month_nav'] button:last-child",
    "[class*='MonthNav'] button:last-child",
    ".cal_nav .next",
    "button[aria-label*='다음']",
]
YBTOUR_MONTH_PREV_SELECTORS = [
    "button:has-text('이전달')",
    "a:has-text('이전달')",
    "button:has-text('이전 달')",
    "[class*='month_nav'] button:first-child",
    "button[aria-label*='이전']",
    ".cal_nav .prev",
]

# prdt.ybtour.co.kr 등: 출발일 팝업이 styled-components `.popup_content` — 기존 dialog 순서만 보면 body로 떨어져 달력 td/가격을 못 찾음.
YBTOUR_MODAL_ROOT_JS = r"""
function ybtourModalRoot() {
  var p = document.querySelector('.popup_content, [class*="popup_content"]');
  if (p && (p.querySelector('table') || p.querySelector('li'))) return p;
  var m = document.querySelector('[role="dialog"], .modal, .pop_layer, .layer_pop, .ly_pop, [class*="layer_pop"], [class*="popCal"], [class*="calendar_pop"], [class*="calendarLayer"], .ui-dialog, #divLayerCalendar');
  return m || document.body;
}
"""

YBTOUR_POPUP_NEXT_MONTH_SELECTORS = [
    ".popup_content button:has-text('다음달')",
    ".popup_content a:has-text('다음달')",
    "[class*='popup_content'] button:has-text('다음달')",
    "[class*='popup_content'] a:has-text('다음달')",
]
YBTOUR_POPUP_PREV_MONTH_SELECTORS = [
    ".popup_content button:has-text('이전달')",
    ".popup_content a:has-text('이전달')",
    "[class*='popup_content'] button:has-text('이전달')",
    "[class*='popup_content'] a:has-text('이전달')",
]

# 모달 기본 월이 URL/페이지 상태일 수 있어 KST 현재 월까지 이전/다음으로 맞춘 뒤 루프 시작
YBTOUR_MONTH_ALIGN_MAX_STEPS = 24


def _ybtour_log(msg: str) -> None:
    """진행/phase 로그는 stderr만 (stdout은 Node JSON.parse 전용)."""
    try:
        sys.stderr.write(msg + "\n")
        sys.stderr.flush()
    except Exception:
        pass


def _ybtour_modal_log(msg: str) -> None:
    """관리자 stderr 필터([ybtour]) 유지 + 모달 단계 구분용 [ybtour-modal]."""
    try:
        sys.stderr.write(f"[ybtour] [ybtour-modal] {msg}\n")
        sys.stderr.flush()
    except Exception:
        pass


def _ybtour_detail_url_summary(detail_url: str) -> str:
    """로그용 URL 요약(host/path/goodsCd). 쿼리 전체·비밀값 출력 금지."""
    try:
        p = urllib.parse.urlparse(detail_url)
        host = p.netloc or "—"
        path = (p.path or "—")[:96]
        q = urllib.parse.parse_qs(p.query)
        goods = (q.get("goodsCd") or q.get("goodscd") or [None])[0]
        g = str(goods)[:40] if goods else "—"
        return f"host={host} path={path} goodsCd={g}"
    except Exception:
        return "host=? url_parse_error"


def _yb_row_richness_score(r: Dict[str, Any]) -> int:
    s = 0
    if int(r.get("adultPrice") or r.get("price") or 0) > 0:
        s += 4
    if str(r.get("statusRaw") or r.get("status") or "").strip():
        s += 2
    if str(r.get("seatsStatusRaw") or "").strip():
        s += 2
    if str(r.get("carrierName") or "").strip():
        s += 1
    if str(r.get("outboundDepartureAt") or "").strip():
        s += 1
    if str(r.get("inboundArrivalAt") or "").strip():
        s += 1
    return s


def _ybtour_iso_from_year_month_day(year: Optional[str], month: Optional[str], day: int) -> Optional[str]:
    if not year or not month:
        return None
    try:
        mo = int(str(month), 10)
        d = int(day)
        y = int(str(year), 10)
        if d < 1 or d > 31 or mo < 1 or mo > 12:
            return None
        return f"{y:04d}-{mo:02d}-{d:02d}"
    except Exception:
        return None


def _ybtour_dedupe_by_departure_date_richer(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """DB (productId, departureDate) 유니크에 맞춰 동일 출발일은 더 풍부한 row 1건만 유지."""
    by_date: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []
    for r in rows:
        d = str(r.get("date") or "").strip()[:10]
        if len(d) != 10:
            continue
        if d not in by_date:
            by_date[d] = r
            order.append(d)
        elif _yb_row_richness_score(r) > _yb_row_richness_score(by_date[d]):
            by_date[d] = r
    return [by_date[k] for k in sorted(order)]


def _ybtour_title_layers_from_text(raw: str) -> Dict[str, str]:
    """상세 제목·리스트 행 제목을 동일 규칙으로 정규화(baseline JS와 동일 계열)."""
    s = re.sub(r"\s+", " ", str(raw or "").strip())
    if not s:
        return {"rawTitle": "", "comparisonTitle": "", "comparisonTitleNoSpace": ""}
    no_badge = re.sub(r"^(?:\[[^\]]*\]\s*)+", "", s)
    pre_hash = no_badge.split("#")[0].strip()
    comparison = re.sub(r"\s+", " ", pre_hash).strip()
    comparison_ns = re.sub(r"\s+", "", comparison)
    return {
        "rawTitle": s,
        "comparisonTitle": comparison,
        "comparisonTitleNoSpace": comparison_ns,
    }


def _ybtour_row_matches_product_baseline(
    item: Dict[str, Any], baseline: Dict[str, str]
) -> bool:
    """우측 리스트 행이 현재 상품 제목과 동일 계열인지(공백·뱃지·# 앞·무공백 비교)."""
    base_ns = str(baseline.get("comparisonTitleNoSpace") or "").strip()
    base_ct = str(baseline.get("comparisonTitle") or "").strip()
    if len(base_ns) < 4 and len(base_ct) < 4:
        return True
    # prdt SPA 등에서 h1/타이틀이 짧거나 공통 문구만 잡히면 비교 신뢰도가 낮음 → 모달은 동일 상품 전제로 필터 완화
    if max(len(base_ns), len(base_ct)) < 22:
        return True
    row_ns = str(item.get("comparisonTitleNoSpace") or "").strip()
    row_ct = str(item.get("comparisonTitle") or "").strip()
    if not row_ns and not row_ct:
        layers = _ybtour_title_layers_from_text(str(item.get("titleText") or ""))
        row_ns = layers["comparisonTitleNoSpace"]
        row_ct = layers["comparisonTitle"]
    if base_ns and row_ns:
        if row_ns == base_ns:
            return True
        if len(base_ns) >= 10 and (base_ns in row_ns or row_ns in base_ns):
            ratio = min(len(row_ns), len(base_ns)) / max(len(row_ns), len(base_ns), 1)
            if ratio >= 0.88:
                return True
    if base_ct and row_ct:
        if row_ct == base_ct:
            return True
        if len(base_ct) >= 10 and base_ct in row_ct and len(row_ct) <= int(len(base_ct) * 1.12) + 2:
            return True
        if len(row_ct) >= 10 and row_ct in base_ct and len(base_ct) <= int(len(row_ct) * 1.12) + 2:
            return True
    summary = str(item.get("rowSummaryText") or "")[:500]
    if summary and base_ns:
        head = summary.split("|")[0].strip()
        sl = _ybtour_title_layers_from_text(head)
        sns = sl["comparisonTitleNoSpace"]
        if sns and sns == base_ns:
            return True
    return False


def _ybtour_extract_schedule_time_range(range_text: str) -> Optional[str]:
    if not range_text:
        return None
    m = re.search(
        r"(\d{1,2}:\d{2})\s*[-–—~∼～]\s*(\d{1,2}:\d{2})",
        range_text,
    )
    if m:
        return f"{m.group(1)} - {m.group(2)}"
    return None


def _ybtour_extract_date_display_line(range_text: str) -> Optional[str]:
    """예: 2026.07.11 (토) … 형태 선두 구간."""
    if not range_text:
        return None
    m = re.search(
        r"20\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\s*\([^)]+\)",
        range_text,
    )
    return m.group(0).strip() if m else None


def _parse_year_month(text: Optional[str]) -> tuple:
    """연/월 텍스트(예: '2026. 04', '2026년 4월', '4월 2026')에서 (year, month) 추출."""
    if not text or not str(text).strip():
        return None, None
    text = str(text).strip()
    m = re.search(r"(\d{4})\s*[.\s/년]+\s*(\d{1,2})\s*월?", text)
    if m:
        mo = int(m.group(2))
        if 1 <= mo <= 12:
            return m.group(1), str(mo).zfill(2)
    m = re.search(r"(\d{1,2})\s*월[^\d]{0,12}(\d{4})", text)
    if m:
        mo = int(m.group(1))
        y = m.group(2)
        if 2000 <= int(y) <= 2099 and 1 <= mo <= 12:
            return y, str(mo).zfill(2)
    nums = re.findall(r"\d+", text)
    if len(nums) >= 2:
        for i, a in enumerate(nums):
            if len(a) == 4 and a.startswith("20"):
                for b in nums[i + 1 :]:
                    if len(b) <= 2:
                        bi = int(b)
                        if 1 <= bi <= 12:
                            return a, str(bi).zfill(2)
        ys = [x for x in nums if len(x) == 4 and x.startswith("20")]
        if len(ys) == 1:
            y = ys[0]
            for b in nums:
                if b == y or len(b) > 2:
                    continue
                bi = int(b)
                if 1 <= bi <= 12:
                    return y, str(bi).zfill(2)
    return None, None


class CalendarPriceScraper:
    """
    ybtour 상품 상세 출발일 모달에서 우측 리스트·달력을 순회하며
    출발일별 가격·항공·기간 등 row를 수집한다.
    """

    def __init__(
        self,
        headless: bool = True,
        randomize_ua: bool = True,
        random_mouse: bool = False,
    ):
        self.site = "ybtour"
        self.headless = headless
        self.randomize_ua = randomize_ua
        self.random_mouse = random_mouse
        self.base_url = config.BASE_URL
        self._page: Optional[Page] = None
        self._browser = None
        self._playwright = None
        self._context = None

    async def __aenter__(self) -> "CalendarPriceScraper":
        await self._launch_browser()
        return self

    async def __aexit__(self, *args) -> None:
        await self._close_browser()

    async def _launch_browser(self) -> None:
        """Playwright 기동 + stealth + 랜덤 UA."""
        try:
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=self.headless,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )
            ua = get_random_user_agent() if self.randomize_ua else get_user_agent(fixed=True)
            self._context = await self._browser.new_context(
                user_agent=ua,
                viewport={"width": 1920, "height": 1080},
                locale="ko-KR",
            )
            await self._context.add_init_script(STEALTH_INIT_SCRIPT)
            self._page = await self._context.new_page()
            self._page.set_default_timeout(config.PAGE_LOAD_TIMEOUT_MS)
        except Exception:
            raise

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

    async def run_on_detail_url(self, detail_url: str) -> List[Dict[str, Any]]:
        """
        상품 상세 URL 한 건에 대해 달력 1년 치 [날짜, 가격]만 수집.
        반환: [ {"date": "YYYY-MM-DD", "price": int}, ... ] (중복 제거, 정렬)
        """
        if not self._page:
            return []
        priced_popup: List[Dict[str, Any]] = []
        self._detail_url = detail_url
        _ybtour_log(f"[ybtour] phase=scraper-entry site=ybtour {_ybtour_detail_url_summary(detail_url)}")
        page_load_ok = False
        try:
            await human_delay(DELAY_MIN, DELAY_MAX)
            try:
                await self._page.goto(
                    detail_url,
                    wait_until="domcontentloaded",
                    timeout=config.PAGE_LOAD_TIMEOUT_MS,
                )
                await self._page.wait_for_load_state(
                    "networkidle",
                    timeout=config.NETWORK_IDLE_TIMEOUT_MS,
                )
                page_load_ok = True
                _ybtour_log("[ybtour] phase=detail-page-loaded ok=true (domcontentloaded+networkidle)")
            except Exception as ex:
                _ybtour_log(
                    f"[ybtour] phase=detail-page-load-failed err={type(ex).__name__} msg={str(ex)[:160]!r}"
                )
                _ybtour_log("[ybtour] phase=diagnosis code=detail-page-load-failed")
                raise
            if self.random_mouse:
                await random_mouse_move(self._page)
            await human_delay(DELAY_MIN, DELAY_MAX)
            priced_popup = await self._run_ybtour_departures()
        except Exception as ex:
            if page_load_ok:
                _ybtour_log(
                    f"[ybtour] phase=ybtour-after-load-failed err={type(ex).__name__} msg={str(ex)[:160]!r}"
                )
                _ybtour_log("[ybtour] phase=diagnosis code=modal-or-inner-exception")
            _ybtour_log(f"[ybtour] phase=catch summary={type(ex).__name__}")
        with_price = [
            r
            for r in priced_popup
            if int(r.get("adultPrice") or r.get("price") or 0) > 0
        ]
        if with_price:
            _ybtour_log(
                f"[ybtour] priced rows after modal scrape: {len(with_price)} "
                f"(first date {with_price[0].get('date')}, last {with_price[-1].get('date')})"
            )
            return _filter_calendar_rows_kst_floor(
                sorted(with_price, key=lambda x: str(x.get("date", "")))
            )
        _ybtour_log(
            "[ybtour] priced rows after modal scrape: 0 — see stderr lines phase=final-diagnosis / modal-inventory"
        )
        _ybtour_log("[ybtour] phase=final-diagnosis code=priced-rows-zero (post-modal pipeline)")
        return []

    async def _ybtour_baseline_title_layers(self) -> Dict[str, str]:
        try:
            data = await self._page.evaluate(
                """() => {
  function layersFromText(raw) {
    const s = String(raw || '').replace(/\\s+/g, ' ').trim();
    const noBadge = s.replace(/^(?:\\[[^\\]]*\\]\\s*)+/, '');
    const preHash = noBadge.split('#')[0].trim();
    const comparisonTitle = preHash.replace(/\\s+/g, ' ').trim();
    const comparisonTitleNoSpace = comparisonTitle.replace(/\\s+/g, '');
    return { rawTitle: s, comparisonTitle, comparisonTitleNoSpace };
  }
  const sels = ['h1', '.product_tit', '.goods_tit', '.tit_type', '[class*="goodsName"]', '[class*="goods_name"]', '.view_top .tit', 'main h1'];
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (el) {
      const t = (el.innerText || '').trim();
      if (t.length > 5) return layersFromText(t);
    }
  }
  return layersFromText(document.title || '');
}"""
            )
            if isinstance(data, dict):
                return {
                    "rawTitle": str(data.get("rawTitle") or ""),
                    "comparisonTitle": str(data.get("comparisonTitle") or ""),
                    "comparisonTitleNoSpace": str(data.get("comparisonTitleNoSpace") or ""),
                }
        except Exception:
            pass
        return {"rawTitle": "", "comparisonTitle": "", "comparisonTitleNoSpace": ""}

    async def _ybtour_modal_list_node_count(self) -> int:
        """모달(또는 body) 안 li/tr 개수 — '모달에 후보 줄이 얼마나 보이는지' 대략치."""
        try:
            n = await self._page.evaluate(
                """() => {
"""
                + YBTOUR_MODAL_ROOT_JS
                + """
  const root = ybtourModalRoot();
  return root.querySelectorAll('li, tr').length;
}"""
            )
            return int(n) if isinstance(n, int) else 0
        except Exception:
            return -1

    async def _scroll_ybtour_popup_list(self) -> None:
        try:
            await self._page.evaluate(
                """() => {
"""
                + YBTOUR_MODAL_ROOT_JS
                + """
  const root = ybtourModalRoot();
  const scrollables = root.querySelectorAll('.scroll_wrap, .list_wrap, [class*="scroll"], [class*="Scroll"], aside ul, .departure_list, [class*="departure"], [class*="list_area"], ul, .mCustomScrollBox, [style*="overflow-y"], .popup_content ul, [class*="popup_content"] ul');
  for (const el of scrollables) {
    try { el.scrollTop = el.scrollHeight; } catch (e) {}
  }
}"""
            )
            await self._page.wait_for_timeout(550)
        except Exception:
            pass

    async def _scroll_ybtour_popup_list_deep(self) -> None:
        """우측 리스트 lazy-load — 여러 번 끝까지 스크롤."""
        for _ in range(5):
            await self._scroll_ybtour_popup_list()
            await self._page.wait_for_timeout(220)

    async def _ybtour_list_rows_digest(self) -> str:
        """우측 리스트 상단 몇 줄 요약 — 갱신 여부 감지용."""
        try:
            d = await self._page.evaluate(
                """() => {
"""
                + YBTOUR_MODAL_ROOT_JS
                + """
  const root = ybtourModalRoot();
  const items = root.querySelectorAll(
    'aside li, .popup_content li, [class*="popup_content"] li, [class*="list_area"] li, [class*="departure"] li'
  );
  const bits = [];
  let n = 0;
  for (const li of items) {
    const t = (li.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 140);
    if (t.length > 24) {
      bits.push(t);
      n++;
      if (n >= 8) break;
    }
  }
  return bits.join('@@');
}"""
            )
            return str(d) if isinstance(d, str) else ""
        except Exception:
            return ""

    async def _ybtour_await_list_digest_change(
        self, prev_digest: str, timeout_ms: int = 4200
    ) -> None:
        prev_digest = prev_digest or ""
        steps = max(4, min(32, int(timeout_ms / 130)))
        for _ in range(steps):
            await self._page.wait_for_timeout(130)
            cur = await self._ybtour_list_rows_digest()
            if cur != prev_digest:
                await human_delay(0.2, 0.45)
                return
        await human_delay(0.25, 0.5)

    async def _ybtour_collect_popup_rows_filtered(
        self, baseline: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        raw = await self._collect_ybtour_popup_rows()
        return [
            x
            for x in raw
            if isinstance(x, dict) and _ybtour_row_matches_product_baseline(x, baseline)
        ]

    async def _ybtour_click_next_month_in_popup(self) -> bool:
        """prdt 팝업 내 '다음달' — 셀렉터 실패 시 텍스트 매칭으로 클릭."""
        script = (
            """() => {
"""
            + YBTOUR_MODAL_ROOT_JS
            + """
  const root = ybtourModalRoot();
  const btns = root.querySelectorAll('button, a, [role="button"], span[role="button"]');
  for (const b of btns) {
    const t = (b.textContent || '').replace(/\\s+/g, ' ').trim();
    if (/다음/.test(t) && /달/.test(t) && !/이전/.test(t)) {
      try {
        b.click();
        return true;
      } catch (e) {}
    }
  }
  return false;
}"""
        )
        try:
            return bool(await self._page.evaluate(script))
        except Exception:
            return False

    async def _ybtour_click_prev_month_in_popup(self) -> bool:
        """prdt 팝업 내 '이전달' — 셀렉터 실패 시 텍스트 매칭으로 클릭."""
        script = (
            """() => {
"""
            + YBTOUR_MODAL_ROOT_JS
            + """
  const root = ybtourModalRoot();
  const btns = root.querySelectorAll('button, a, [role="button"], span[role="button"]');
  for (const b of btns) {
    const t = (b.textContent || '').replace(/\\s+/g, ' ').trim();
    if (/이전/.test(t) && /달/.test(t) && !/다음/.test(t)) {
      try {
        b.click();
        return true;
      } catch (e) {}
    }
  }
  return false;
}"""
        )
        try:
            return bool(await self._page.evaluate(script))
        except Exception:
            return False

    async def _ybtour_click_next_month_nav(self) -> bool:
        """다음달 컨트롤(셀렉터 우선, 실패 시 JS 텍스트 매칭)."""
        for nsel in YBTOUR_MONTH_NEXT_SELECTORS + YBTOUR_POPUP_NEXT_MONTH_SELECTORS:
            try:
                nxt = await self._page.query_selector(nsel)
                if not nxt:
                    continue
                disabled = await nxt.get_attribute("disabled")
                if disabled is not None:
                    continue
                txt = (await nxt.text_content() or "").strip()
                if txt and re.search(r"이전|prev|전달", txt, re.I) and not re.search(
                    r"다음|next", txt, re.I
                ):
                    continue
                await human_delay(DELAY_MIN, DELAY_MAX)
                await nxt.click()
                await self._page.wait_for_timeout(MONTH_WAIT_MS)
                return True
            except Exception:
                continue
        moved = await self._ybtour_click_next_month_in_popup()
        if moved:
            await self._page.wait_for_timeout(MONTH_WAIT_MS)
        return moved

    async def _ybtour_click_prev_month_nav(self) -> bool:
        """이전달 컨트롤(셀렉터 우선, 실패 시 JS 텍스트 매칭)."""
        for nsel in YBTOUR_MONTH_PREV_SELECTORS + YBTOUR_POPUP_PREV_MONTH_SELECTORS:
            try:
                prv = await self._page.query_selector(nsel)
                if not prv:
                    continue
                disabled = await prv.get_attribute("disabled")
                if disabled is not None:
                    continue
                txt = (await prv.text_content() or "").strip()
                if txt and re.search(r"다음|next|후달", txt, re.I) and not re.search(
                    r"이전|prev|전달", txt, re.I
                ):
                    continue
                await human_delay(DELAY_MIN, DELAY_MAX)
                await prv.click()
                await self._page.wait_for_timeout(MONTH_WAIT_MS)
                return True
            except Exception:
                continue
        moved = await self._ybtour_click_prev_month_in_popup()
        if moved:
            await self._page.wait_for_timeout(MONTH_WAIT_MS)
        return moved

    async def _ybtour_align_popup_to_kst_month_floor(self) -> None:
        """모달 첫 화면 월이 과거/미래여도, 수집 루프는 KST 현재 월(1일)부터 시작하도록 맞춘다."""
        target = _kst_month_start()
        _ybtour_modal_log(
            f"phase=month-policy align_kst_floor target={target.isoformat()} "
            f"(ignore URL/detail default month; then scan forward if empty)"
        )
        prev_label: Optional[str] = None
        for step in range(YBTOUR_MONTH_ALIGN_MAX_STEPS):
            ym = await self._ybtour_read_month_label()
            yp, mp = _parse_year_month(ym)
            if not yp or not mp:
                _ybtour_modal_log(
                    f"phase=align-kst parse-fail label={ym!r} step={step} stop=keep_dom_month"
                )
                break
            try:
                cur = dt.date(int(yp), int(mp), 1)
            except ValueError:
                break
            if cur == target:
                _ybtour_modal_log(
                    f"phase=align-kst ok label={ym!r} step={step} cur={cur.isoformat()}"
                )
                return
            if ym == prev_label:
                _ybtour_modal_log(
                    f"phase=align-kst stuck label={ym!r} step={step} stop=label-unchanged"
                )
                break
            prev_label = ym
            if cur < target:
                moved = await self._ybtour_click_next_month_nav()
                direction = "next"
            else:
                moved = await self._ybtour_click_prev_month_nav()
                direction = "prev"
            if not moved:
                _ybtour_modal_log(
                    f"phase=align-kst move-fail direction={direction} step={step} label={ym!r}"
                )
                break
            await human_delay(DELAY_MIN, DELAY_MAX)
        _ybtour_modal_log("phase=align-kst end (exhausted, parse fail, or move fail)")

    async def _ybtour_click_calendar_day(self, day: int) -> bool:
        """좌측 달력에서 가격 있는 해당 일(day) 셀 클릭 — 우측 리스트 갱신용."""
        d = int(day)
        if d < 1 or d > 31:
            return False
        script = f"""
() => {{
  {YBTOUR_MODAL_ROOT_JS}
  const root = ybtourModalRoot();
  const tds = root.querySelectorAll(
    '.calendar_wrap td, .cal_wrap td, table.calendar td, .ui-datepicker-calendar td, tbody.cal_body td, [class*="calendar"] table td, .cal td, table td'
  );
  const want = {d};
  for (const td of tds) {{
    const raw = (td.innerText || '').replace(/\\s+/g, ' ').trim();
    const dm = raw.match(/^(\\d{{1,2}})\\b/);
    if (!dm) continue;
    const dnum = parseInt(dm[1], 10);
    if (dnum !== want) continue;
    const looksPrice = /[\\d,]+\\s*원\\~?|[\\d,]+\\s*만\\s*~?|\\d+\\s*만\\~?|\\d{{1,2}}\\s+\\d+만\\~?|\\d+\\s*만|만\\s*~/.test(raw);
    if (!looksPrice) continue;
    let target = td;
    const inner = td.querySelector('button, a[href], [role="button"], span[role="button"]');
    if (inner) target = inner;
    try {{
      target.click();
      return true;
    }} catch (e1) {{}}
    try {{
      const ev = new MouseEvent('click', {{ bubbles: true, cancelable: true, view: window }});
      target.dispatchEvent(ev);
      return true;
    }} catch (e2) {{}}
  }}
  return false;
}}
"""
        try:
            return bool(await self._page.evaluate(script))
        except Exception:
            return False

    async def _ybtour_read_month_label(self) -> str:
        try:
            t = await self._page.evaluate(
                f"""() => {{
  {YBTOUR_MODAL_ROOT_JS}
  const root = ybtourModalRoot();
  const heads = root.querySelectorAll('h2, h3, h4, .calendar_title, .year_month, [class*="month_tit"], [class*="cal_head"], [class*="CalendarHead"]');
  for (const el of heads) {{
    const s = (el.innerText || '').trim();
    if (/20\\d{{2}}\\s*[.년\\s/]*\\s*\\d{{1,2}}\\s*월?/.test(s)) return s.slice(0, 64);
  }}
  const blob = (root.innerText || '').replace(/\\s+/g, ' ').trim();
  const m = blob.match(/(20\\d{{2}}\\s*[.년\\s/]*\\s*\\d{{1,2}}\\s*월?)/);
  return m ? m[1].replace(/\\s+/g, '') : '';
}}"""
            )
            if isinstance(t, str) and t.strip():
                return t.strip()[:64]
        except Exception:
            pass
        try:
            ym_el = await self._page.query_selector(
                ".popup_content .calendar_title, .popup_content [class*='month'], .calendar_title, .year_month, [class*='month_tit'], [class*='cal_head'], .cal_head, [class*='CalendarHead']"
            )
            if ym_el:
                return (await ym_el.text_content() or "").strip()[:64]
        except Exception:
            pass
        return ""

    async def _collect_ybtour_calendar_price_index(self) -> List[Dict[str, Any]]:
        """좌측 달력 셀: 일자 + 가격 문구(인덱스·보조 검증)."""
        script = f"""
() => {{
  {YBTOUR_MODAL_ROOT_JS}
  const root = ybtourModalRoot();
  const tds = root.querySelectorAll(
    '.calendar_wrap td, .cal_wrap td, table.calendar td, .ui-datepicker-calendar td, tbody.cal_body td, [class*="calendar"] table td, .cal td, table td'
  );
  const out = [];
  const seen = new Set();
  for (const td of tds) {{
    const raw = (td.innerText || '').replace(/\\s+/g, ' ').trim();
    if (!raw || raw.length > 100) continue;
    const dm = raw.match(/^(\\d{{1,2}})\\b/);
    if (!dm) continue;
    const day = parseInt(dm[1], 10);
    if (day < 1 || day > 31) continue;
    const key = day + '|' + raw.slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    const looksPrice =
      /[\\d,]+\\s*원\\~?|[\\d,]+\\s*만\\s*~?|\\d+\\s*만\\~?|\\d{{1,2}}\\s+\\d+만\\~?|\\d+\\s*만|만\\s*~/.test(raw);
    if (!looksPrice) continue;
    out.push({{ calendarDate: day, calendarPriceText: raw.slice(0, 72) }});
  }}
  return out;
}}"""
        try:
            rows = await self._page.evaluate(script)
            return rows if isinstance(rows, list) else []
        except Exception:
            return []

    async def _collect_ybtour_popup_rows(self) -> List[Dict[str, Any]]:
        """모달 우측 리스트 row 후보(상품명 레이어 필터는 호출측에서 baseline 대조)."""
        script = (
            """() => {
"""
            + YBTOUR_MODAL_ROOT_JS
            + """
  function layersFromText(raw) {
    const s = String(raw || '').replace(/\\s+/g, ' ').trim();
    const noBadge = s.replace(/^(?:\\[[^\\]]*\\]\\s*)+/, '');
    const preHash = noBadge.split('#')[0].trim();
    const comparisonTitle = preHash.replace(/\\s+/g, ' ').trim();
    const comparisonTitleNoSpace = comparisonTitle.replace(/\\s+/g, '');
    return { rawTitle: s, comparisonTitle, comparisonTitleNoSpace };
  }
  function parsePriceWon(full) {
    const s = String(full || '').replace(/\\s+/g, ' ').replace(/，/g, ',').trim();
    let m = s.match(/([0-9]{1,3}(?:,[0-9]{3})+)\\s*원\\s*~?/);
    if (m) return { n: parseInt(m[1].replace(/,/g, ''), 10), text: m[0] };
    m = s.match(/([0-9]{1,3}(?:,[0-9]{3})+)\\s*원/);
    if (m) return { n: parseInt(m[1].replace(/,/g, ''), 10), text: m[0] };
    m = s.match(/(\\d{6,8})\\s*원\\s*~?/);
    if (m) return { n: parseInt(m[1], 10), text: m[0] };
    m = s.match(/(\\d{1,4})\\s*만\\s*원/);
    if (m) return { n: parseInt(m[1], 10) * 10000, text: m[0] };
    m = s.match(/(\\d{1,4})\\s*만(?!\\s*원)/);
    if (m) {
      const v = parseInt(m[1], 10) * 10000;
      if (v > 0) return { n: v, text: m[0] };
    }
    return null;
  }
  function firstYmdFromText(full) {
    const re = /(20\\d{2})\\s*[.\\-\\/]\\s*(\\d{1,2})\\s*[.\\-\\/]\\s*(\\d{1,2})/g;
    let m;
    while ((m = re.exec(full)) !== null) {
      const y = m[1];
      const mo = String(parseInt(m[2], 10)).padStart(2, '0');
      const d = String(parseInt(m[3], 10)).padStart(2, '0');
      return y + '-' + mo + '-' + d;
    }
    return '';
  }
  const carriersKnown =
    '티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|스칸디나비아항공|핀에어|루프트한자|싱가포르항공|에티하드|카타르항공|에어뉴질랜드|에어캐나다|유나이티드항공|델타항공|일본항공|중화항공';
  const carrierRe = new RegExp('(' + carriersKnown + ')');
  const carrierGeneric = /([가-힣A-Za-z·\\.]{2,22}항공)/;
  const root = ybtourModalRoot();
  const narrow = root.querySelectorAll(
    '.popup_content li, [class*="popup_content"] li, aside li, [class*="list_area"] li, [class*="departure"] li, [class*="Departure"] li, [class*="goods_list"] li, ul.scroll_wrap li, .scroll_wrap li, .departure_list li, tbody tr'
  );
  let cands = [];
  root.querySelectorAll('li').forEach(function (li) {
    const t = (li.innerText || '').replace(/\\s+/g, ' ').trim();
    if (
      t.length >= 32 &&
      /20\\d{2}[.\\-\\/]\\d{1,2}[.\\-\\/]\\d{1,2}/.test(t) &&
      (/[\\d,]+\\s*원|만\\s*~?|\\d+만/).test(t)
    ) {
      cands.push(li);
    }
  });
  if (cands.length < 1) {
    cands = Array.from(narrow);
  }
  if (cands.length < 1) {
    cands = Array.from(
      root.querySelectorAll('li, tr, div[class*="item"], div[class*="row"], div[class*="card"], a[href*="goods"]')
    );
  }
  const out = [];
  const seen = new Set();
  for (const el of cands) {
    const full = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    if (full.length < 8 || full.length > 4200) continue;
    const priceInfo = parsePriceWon(full);
    if (!priceInfo || !priceInfo.n || priceInfo.n <= 0) continue;
    const price = priceInfo.n;
    const strictRange = full.match(
      /20\\d{2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*\\([^)]+\\)\\s*\\d{1,2}:\\d{2}\\s*[-–—~∼～]\\s*20\\d{2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*\\([^)]+\\)\\s*\\d{1,2}:\\d{2}/
    );
    let departureRangeText = strictRange ? strictRange[0].replace(/\\s+/g, ' ').trim() : '';
    if (!departureRangeText) {
      const loose = full.match(
        /20\\d{2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*[.\\-\\/]\\s*\\d{1,2}[\\s\\S]{0,48}\\d{1,2}:\\d{2}\\s*[-–—~∼～]\\s*20\\d{2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*[.\\-\\/]\\s*\\d{1,2}[\\s\\S]{0,48}\\d{1,2}:\\d{2}/
      );
      if (loose) departureRangeText = loose[0].replace(/\\s+/g, ' ').trim();
    }
    let date = '';
    if (departureRangeText) {
      const dm0 = departureRangeText.match(/(20\\d{2})\\s*[.\\-\\/]\\s*(\\d{1,2})\\s*[.\\-\\/]\\s*(\\d{1,2})/);
      if (dm0) {
        date =
          dm0[1] +
          '-' +
          String(parseInt(dm0[2], 10)).padStart(2, '0') +
          '-' +
          String(parseInt(dm0[3], 10)).padStart(2, '0');
      }
    }
    if (!date) date = firstYmdFromText(full);
    if (!date) continue;
    const sig = date + '|' + String(price) + '|' + full.slice(0, 120);
    if (seen.has(sig)) continue;
    seen.add(sig);
    let titleRaw = '';
    const te = el.querySelector('strong, .tit, .title, [class*="subject"], [class*="goods_name"], em');
    if (te) titleRaw = (te.innerText || '').replace(/\\s+/g, ' ').trim();
    if (!titleRaw || titleRaw.length < 4) {
      const lines = full.split(/[\\n\\r|]/).map((x) => x.trim()).filter(Boolean);
      titleRaw = lines.length ? lines[0] : full.slice(0, 120);
    }
    const tl = layersFromText(titleRaw);
    const tripM = full.match(/(\\d+)\\s*박\\s*(\\d+)\\s*일/);
    const tripNightsDaysText = tripM
      ? parseInt(tripM[1], 10) + '박' + parseInt(tripM[2], 10) + '일'
      : '';
    let airlineName = '';
    const cm = full.match(carrierRe);
    if (cm) airlineName = cm[1];
    else {
      const cg = full.match(carrierGeneric);
      if (cg) airlineName = cg[1];
    }
    let availabilityText = '';
    if (/대기예약/.test(full)) availabilityText = '대기예약';
    else if (/예약대기|대기\\s*예약/.test(full)) availabilityText = '예약대기';
    else if (/예약마감|마감/.test(full)) availabilityText = '예약마감';
    else if (/예약가능|예약\\s*가능/.test(full)) availabilityText = '예약가능';
    const seatM = full.match(/(?:잔여\\s*\\d+\\s*석|\\(\\s*잔여\\s*\\d+\\s*석\\s*\\)|\\d+\\s*석)/);
    const seatsText = seatM ? seatM[0].replace(/\\s+/g, ' ').trim() : '';
    const badgeParts = [];
    if (/담당자추천/.test(full)) badgeParts.push('담당자추천');
    if (/100%\\s*출발|출발확정/.test(full)) badgeParts.push('100%출발');
    const badgesText = badgeParts.join(' ');
    out.push({
      date,
      price,
      titleText: tl.rawTitle,
      comparisonTitle: tl.comparisonTitle,
      comparisonTitleNoSpace: tl.comparisonTitleNoSpace,
      departureRangeText,
      tripNightsDaysText,
      airlineName,
      availabilityText,
      seatsText,
      priceText: priceInfo.text || String(price),
      badgesText,
      rowSummaryText: full.slice(0, 400),
    });
  }
  return out;
}
"""
        )
        try:
            rows = await self._page.evaluate(script)
            if not isinstance(rows, list):
                _ybtour_modal_log(f"phase=collect-rows-bad-return type={type(rows).__name__!r}")
                return []
            return rows
        except Exception as ex:
            _ybtour_modal_log(f"phase=collect-rows-exception {type(ex).__name__}:{str(ex)[:220]!r}")
            return []

    async def _run_ybtour_departures(self) -> List[Dict[str, Any]]:
        du = ""
        try:
            du = str(getattr(self, "_detail_url", "") or "")
        except Exception:
            du = ""
        summ = _ybtour_detail_url_summary(du) if du else "url=unknown"
        _ybtour_modal_log(f"phase=entry begin modal_scrape {summ}")
        _ybtour_log(f"[ybtour] phase=scraper-modal-path site=ybtour {summ}")

        baseline = await self._ybtour_baseline_title_layers()
        raw_title = str(baseline.get("rawTitle") or "").strip()
        base_ns = str(baseline.get("comparisonTitleNoSpace") or "").strip()
        _ybtour_modal_log(
            f"phase=detail-title-hint filter=on raw_len={len(raw_title)} base_ns_len={len(base_ns)}"
        )
        _ybtour_log(
            f"[ybtour] phase=baseline-title-hint raw_len={len(raw_title)} comparison_no_space_len={len(base_ns)}"
        )

        opened = False
        opening_sel_hit: Optional[str] = None
        selectors_tried = 0
        last_modal_open_err: Optional[str] = None
        _ybtour_modal_log(
            f"phase=modal-open trying_selectors count={len(YBTOUR_POPUP_OPEN_SELECTORS)}"
        )
        for sel in YBTOUR_POPUP_OPEN_SELECTORS:
            selectors_tried += 1
            try:
                btn = await self._page.query_selector(sel)
                if btn:
                    await human_delay(DELAY_MIN, DELAY_MAX)
                    await btn.click()
                    await self._page.wait_for_timeout(950)
                    opened = True
                    opening_sel_hit = sel[:100]
                    break
            except Exception as ex:
                last_modal_open_err = f"{type(ex).__name__}:{str(ex)[:100]}"
                continue

        if opened:
            _ybtour_modal_log(
                f"phase=modal-open ok=true hit_sel={opening_sel_hit!r} selectors_tried={selectors_tried}"
            )
            await human_delay(DELAY_MIN, DELAY_MAX)
            try:
                await self._page.wait_for_selector(
                    ".popup_content, [class*='popup_content']", timeout=9000, state="visible"
                )
            except Exception:
                pass
            await self._page.wait_for_timeout(700)
            await self._ybtour_align_popup_to_kst_month_floor()
        else:
            reason = last_modal_open_err or "no_button_found"
            _ybtour_modal_log(f"phase=modal-open ok=false reason={reason!r}")
        _ybtour_log(
            f"[ybtour] phase=modal-open success={opened} selectors_tried={selectors_tried} hit_sel={opening_sel_hit!r}"
        )
        if not opened and last_modal_open_err:
            _ybtour_log(f"[ybtour] phase=modal-open last_click_error={last_modal_open_err!r}")

        inv = await self._ybtour_modal_list_node_count()
        _ybtour_modal_log(f"phase=modal-dom approx_li_tr_count={inv}")
        _ybtour_log(f"[ybtour] modal rows seen (approx li/tr in modal/body): {inv}")

        rows_merged: Dict[str, Dict[str, Any]] = {}
        total_list_row_batches = 0
        months_collected = 0
        stop_reason = "modal-open-failed"
        if not opened:
            _ybtour_modal_log("phase=abort skip_month_loop reason=modal-not-opened")
        else:
            stop_reason = "not-started"
        prev_cal_sig: Optional[str] = None
        for mi in range(DEFAULT_CALENDAR_MONTH_LIMIT if opened else 0):
            ym = await self._ybtour_read_month_label()
            cal_cells = await self._collect_ybtour_calendar_price_index()
            priced_days = len(cal_cells)
            samp = [c.get("calendarPriceText") for c in cal_cells[:4]]
            cal_sig = "|".join(
                f"{c.get('calendarDate')}|{str(c.get('calendarPriceText') or '')[:40]}"
                for c in cal_cells[:48]
            )
            if mi > 0 and prev_cal_sig is not None and cal_sig == prev_cal_sig:
                _ybtour_modal_log("phase=month-stop calendar-unchanged-after-advance")
                stop_reason = "next-month-no-calendar-change"
                break
            _ybtour_modal_log(
                f"phase=calendar monthKey={ym!r} pricedDays={priced_days} samplePrices={samp!r}"
            )

            await self._scroll_ybtour_popup_list_deep()
            await human_delay(0.35, 0.75)
            yp, mp = _parse_year_month(ym)
            kst_floor = _kst_today_ymd()
            merged_month: List[Dict[str, Any]] = []
            if priced_days > 0 and yp and mp:
                for cell in cal_cells:
                    if not isinstance(cell, dict):
                        continue
                    cd = cell.get("calendarDate")
                    if cd is None:
                        continue
                    try:
                        d_int = int(cd)
                    except Exception:
                        continue
                    if d_int < 1 or d_int > 31:
                        continue
                    if not str(cell.get("calendarPriceText") or "").strip():
                        continue
                    iso = _ybtour_iso_from_year_month_day(yp, mp, d_int)
                    if not iso or iso < kst_floor:
                        continue
                    prev_d = await self._ybtour_list_rows_digest()
                    clicked = await self._ybtour_click_calendar_day(d_int)
                    if clicked:
                        await self._ybtour_await_list_digest_change(prev_d)
                    await self._scroll_ybtour_popup_list_deep()
                    part = await self._ybtour_collect_popup_rows_filtered(baseline)
                    merged_month.extend(part)
                batch = merged_month
            else:
                batch = await self._ybtour_collect_popup_rows_filtered(baseline)
            total_list_row_batches += len(batch)
            months_collected = mi + 1

            priced_rows = sum(1 for x in batch if isinstance(x, dict) and int(x.get("price") or 0) > 0)
            ranges = [
                str(x.get("departureRangeText") or "").strip()
                for x in batch
                if isinstance(x, dict) and x.get("departureRangeText")
            ]
            fr = (ranges[0][:96] + "…") if ranges else ""
            lr = (ranges[-1][:96] + "…") if ranges else ""
            _ybtour_modal_log(
                f"phase=list monthRound={mi + 1} rowsSeen={len(batch)} pricedRows={priced_rows} "
                f"firstRange={fr!r} lastRange={lr!r}"
            )
            if priced_rows == 0 and len(batch) == 0:
                _ybtour_modal_log(
                    f"phase=month-empty-continue monthRound={mi + 1} monthKey={ym!r} "
                    f"(no priced list rows this month; advance next-month)"
                )

            batch_dates = {
                str(x.get("date") or "")[:10]
                for x in batch
                if isinstance(x, dict) and len(str(x.get("date") or "")) >= 10
            }
            if yp and mp and priced_days > 0:
                kst_floor = _kst_today_ymd()
                for cell in cal_cells:
                    if not isinstance(cell, dict):
                        continue
                    cd = cell.get("calendarDate")
                    if cd is None:
                        continue
                    try:
                        d_int = int(cd)
                    except Exception:
                        continue
                    iso = _ybtour_iso_from_year_month_day(yp, mp, d_int)
                    if (
                        iso
                        and iso >= kst_floor
                        and iso not in batch_dates
                        and str(cell.get("calendarPriceText") or "").strip()
                    ):
                        cpt = str(cell.get("calendarPriceText") or "")[:56]
                        _ybtour_modal_log(
                            f"phase=calendar-only-price monthKey={ym!r} date={iso} "
                            f"calendarPriceText={cpt!r} (no matching list row with parsed date)"
                        )

            before_keys = len(rows_merged)
            for item in batch:
                if not isinstance(item, dict):
                    continue
                dedupe_key = "|".join(
                    [
                        str(item.get("date") or "")[:10],
                        str(item.get("departureRangeText") or "")[:160],
                        str(item.get("airlineName") or ""),
                        str(item.get("price") or 0),
                    ]
                )
                if dedupe_key.replace("|", "").strip() in ("", "0"):
                    continue
                prev = rows_merged.get(dedupe_key)
                pr = int(item.get("price") or 0)
                if not prev or pr >= int(prev.get("price") or 0):
                    rows_merged[dedupe_key] = item
            new_keys = len(rows_merged) - before_keys
            _ybtour_modal_log(
                f"phase=merge monthRound={mi + 1} batchRows={len(batch)} new_unique_keys={new_keys} "
                f"cumulative_unique={len(rows_merged)}"
            )

            ym_before_nav = ym
            moved = await self._ybtour_click_next_month_nav()
            ym_after = await self._ybtour_read_month_label()
            _ybtour_modal_log(
                f"phase=move-month monthRound={mi + 1} success={moved} "
                f"labelBefore={ym_before_nav!r} labelAfter={ym_after!r}"
            )
            if moved and ym_after == ym_before_nav:
                _ybtour_modal_log("phase=move-month warn=label-unchanged-after-click")
                stop_reason = "next-month-label-stuck"
                break
            if not moved:
                stop_reason = "next-month-control-unavailable-or-disabled"
                break
            prev_cal_sig = cal_sig
            stop_reason = "month-limit" if mi + 1 >= DEFAULT_CALENDAR_MONTH_LIMIT else "continuing"

        if opened and stop_reason == "continuing":
            stop_reason = "completed-month-loop"
        if not opened:
            stop_reason = "modal-open-failed"
        _ybtour_modal_log(
            f"phase=summary totalMonths={months_collected} totalDepartureRowKeys={len(rows_merged)} "
            f"totalListRowsBatches={total_list_row_batches} stopReason={stop_reason!r}"
        )
        out: List[Dict[str, Any]] = []
        dropped_past_kst = 0
        invalid_date = 0
        skipped_zero_price = 0
        for item in rows_merged.values():
            d = str(item.get("date") or "").strip()[:10]
            if len(d) != 10:
                invalid_date += 1
                continue
            if d < _kst_today_ymd():
                dropped_past_kst += 1
                continue
            price = int(item.get("price") or 0)
            if price <= 0:
                skipped_zero_price += 1
                continue
            availability = str(item.get("availabilityText") or "").strip()
            seats = str(item.get("seatsText") or "").strip()
            carrier = fix_airline_name_str(str(item.get("airlineName") or "").strip()) or ""
            range_text = str(item.get("departureRangeText") or "").strip()
            dep_at = None
            arr_at = None
            if range_text:
                m = re.search(
                    r"(20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\([^)]+\)\s*(\d{1,2}):(\d{2})\s*[-–—~∼～]\s*(20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\([^)]+\)\s*(\d{1,2}):(\d{2})",
                    range_text,
                )
                if not m:
                    m = re.search(
                        r"(20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\D{0,12}(\d{1,2}):(\d{2})\s*[-–—~∼～]\s*(20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\D{0,12}(\d{1,2}):(\d{2})",
                        range_text,
                    )
                if m:
                    y1, mo1, day1, h1, mi1, y2, mo2, day2, h2, mi2 = m.groups()
                    dep_at = f"{y1}-{int(mo1):02d}-{int(day1):02d} {int(h1):02d}:{mi1}"
                    arr_at = f"{y2}-{int(mo2):02d}-{int(day2):02d} {int(h2):02d}:{mi2}"
            status_raw = availability or (seats if seats else "예약가능")
            date_disp = _ybtour_extract_date_display_line(range_text) or None
            time_rng = _ybtour_extract_schedule_time_range(range_text) or None
            out.append(
                {
                    "date": d,
                    "price": price,
                    "adultPrice": price,
                    "status": status_raw,
                    "statusRaw": status_raw,
                    "seatsStatusRaw": seats or None,
                    "carrierName": carrier or None,
                    "outboundDepartureAt": dep_at,
                    "inboundArrivalAt": arr_at,
                    "titleText": item.get("titleText"),
                    "departureRangeText": range_text or None,
                    "tripNightsDaysText": item.get("tripNightsDaysText") or None,
                    "dateDisplayText": date_disp,
                    "scheduleTimeRange": time_rng,
                }
            )
        out = _ybtour_dedupe_by_departure_date_richer(out)
        _ybtour_log(f"[ybtour] priced rows after modal scrape (pre-stdout-json): {len(out)}")
        _ybtour_log(
            f"[ybtour] phase=kst-and-date-hints dropped_past_kst={dropped_past_kst} invalid_date={invalid_date} "
            f"skipped_zero_price={skipped_zero_price} kst_floor={_kst_today_ymd()!r}"
        )
        if len(out) == 0:
            if not opened:
                diag = "modal-open-failed"
            elif total_list_row_batches == 0:
                diag = "modal-list-zero"
            elif len(rows_merged) > 0 and dropped_past_kst + invalid_date >= len(rows_merged):
                diag = "kst-or-date-parse-zero"
            elif len(rows_merged) > 0 and skipped_zero_price > 0:
                diag = "priced-rows-zero"
            elif len(rows_merged) > 0:
                diag = "priced-rows-zero-or-filtered"
            else:
                diag = "unknown-empty"
            _ybtour_modal_log(f"phase=final-diagnosis code={diag} merged_keys={len(rows_merged)}")
            _ybtour_log(
                f"[ybtour] phase=final-diagnosis code={diag} merged_keys={len(rows_merged)} "
                f"list_row_batches_sum={total_list_row_batches}"
            )
        else:
            _ybtour_log(f"[ybtour] phase=final-diagnosis code=ok priced_rows={len(out)}")
        return out


def _env_bool(key: str, default: bool = True) -> bool:
    val = os.getenv(key, "1" if default else "0")
    return val in ("1", "true", "yes", "on")


async def run_calendar_price_from_url(
    detail_url: str,
    headless: bool = True,
    randomize_ua: bool = True,
    random_mouse: bool = False,
) -> List[Dict[str, Any]]:
    """
    상품 상세 URL 한 건에 대해 달력 [날짜, 가격]만 수집.
    randomize_ua/random_mouse는 env RANDOMIZE_UA, RANDOM_MOUSE로 오버라이드 가능.
    """
    randomize_ua = _env_bool("RANDOMIZE_UA", randomize_ua)
    random_mouse = _env_bool("RANDOM_MOUSE", random_mouse)
    async with CalendarPriceScraper(
        headless=headless,
        randomize_ua=randomize_ua,
        random_mouse=random_mouse,
    ) as scraper:
        return await scraper.run_on_detail_url(detail_url)


def _emit_ybtour_admin_stdout_envelope(payload: Dict[str, Any]) -> None:
    """
    관리자 Node(execFile)용: stdout 한 줄은 항상 {"ok", "rows", ...} 객체.
    실패도 exit 0 + ok=false 로 남겨 subprocess 예외와 구분한다.
    """
    if "rows" not in payload:
        payload["rows"] = []
    _emit_stdout_json_utf8(payload)


def _emit_stdout_json_utf8(obj: object) -> None:
    """
    관리자 Node(execFile)가 stdout 전체를 JSON.parse 할 수 있게:
    UTF-8 바이트 1회 기록 + 단일 개행만 (로그·배너·BOM 금지).

    Windows PowerShell의 `1>파일` 리다이렉트는 파일을 UTF-16으로 저장해
    `json.load(..., encoding="utf-8")` 검증이 실패할 수 있다.
    동일 UTF-8 바이트를 파일로도 남기려면 환경변수 YBTOUR_JSON_UTF8_FILE 에 경로를 넣는다.
    """
    payload = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.write(b"\n")
    sys.stdout.buffer.flush()
    mirror = str(os.environ.get("YBTOUR_JSON_UTF8_FILE") or "").strip()
    if mirror:
        try:
            with open(mirror, "wb") as fp:
                fp.write(payload)
                fp.write(b"\n")
            sys.stderr.write(f"[ybtour] wrote utf-8 json mirror: {mirror}\n")
            sys.stderr.flush()
        except Exception as ex:
            sys.stderr.write(f"[ybtour] json mirror write failed: {type(ex).__name__}: {ex}\n")
            sys.stderr.flush()


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    def _admin_fail(phase: str, msg: str, exc_type: Optional[str] = None) -> None:
        payload: Dict[str, Any] = {
            "ok": False,
            "rows": [],
            "phase": phase,
            "message": (msg or "")[:800],
        }
        if exc_type:
            payload["errorType"] = exc_type
        try:
            _emit_ybtour_admin_stdout_envelope(payload)
        except Exception:
            traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
            sys.exit(1)
        sys.exit(0)

    url = (sys.argv[1] or "").strip() if len(sys.argv) > 1 else ""
    if not url or not url.startswith("http"):
        sys.stderr.write(
            "Usage: python -m scripts.calendar_e2e_scraper_ybtour.calendar_price_scraper <detail_url>\n"
        )
        sys.stderr.flush()
        _admin_fail("bad-args", "detail_url must start with http(s)")

    try:
        result = asyncio.run(run_calendar_price_from_url(url, headless=True))
    except Exception as ex:
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        _admin_fail("asyncio-run-exception", str(ex), type(ex).__name__)

    try:
        _emit_ybtour_admin_stdout_envelope({"ok": True, "rows": result})
    except Exception as ex:
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        _admin_fail("emit-json-exception", str(ex), type(ex).__name__)
    sys.exit(0)
