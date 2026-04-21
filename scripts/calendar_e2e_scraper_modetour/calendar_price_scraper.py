# -*- coding: utf-8 -*-
"""
modetour 전용: 패키지 상세 출발일 모달·달력·우측 패널 기반 E2E.
KST 기준 과거 출발 제외, playwright-stealth 및 인간 모사 딜레이 적용.
"""
import asyncio
import datetime as dt
import json
import os
import re
import urllib.parse
from typing import Any, Dict, List, Optional

from playwright.async_api import Page, async_playwright

from scripts.shared.airline_encoding_fix import fix_airline_name_str

from . import config
from .utils import (
    human_delay,
    get_random_user_agent,
    get_user_agent,
    clean_price_to_int,
    STEALTH_INIT_SCRIPT,
    random_mouse_move,
)

_KST = dt.timezone(dt.timedelta(hours=9))
# lib/scrape-date-bounds.ts SCRAPE_DEFAULT_MONTHS_FORWARD 와 맞춤
DEFAULT_CALENDAR_MONTH_LIMIT = 3


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


# 명세: 화살표/로딩 대기 딜레이
DELAY_MIN = 0.8
DELAY_MAX = 1.8
SLIDE_WAIT_MS = 800
MONTH_WAIT_MS = 1000

MODETOUR_GENERIC_MONTH_NEXT_SELECTORS = [
    ".month_next",
    ".calendar_next",
    "button.next",
    "a.next",
    "button:has-text('다음달')",
    "a:has-text('다음달')",
    "button.calendar_next",
    "a.calendar_next",
]

MODETOUR_ALT_POPUP_OPEN_SELECTORS = [
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

# package 상세: '출발일 보기' 없이 '출발일 변경'만 있는 경우가 많음 → 변경/선택 CTA 우선, 보기 라벨 보조
MODETOUR_POPUP_OPEN_SELECTORS = [
    "button:has-text('출발일 변경')",
    "a:has-text('출발일 변경')",
    "[role='button']:has-text('출발일 변경')",
    "button:has-text('출발일선택')",
    "a:has-text('출발일선택')",
    "button:has-text('출발일 선택')",
    "a:has-text('출발일 선택')",
] + list(MODETOUR_ALT_POPUP_OPEN_SELECTORS)

# SPA 달력: 아이콘/클래스 기반 다음달 컨트롤 보조
MODETOUR_MONTH_NEXT_SELECTORS = list(MODETOUR_GENERIC_MONTH_NEXT_SELECTORS) + [
    "button[aria-label*='다음']",
    "a[aria-label*='다음']",
    "[class*='calendar'] [class*='next']:not([class*='prev'])",
    "button[class*='Next']:not([class*='Prev'])",
]


def _modetour_log(msg: str) -> None:
    print(msg, file=__import__("sys").stderr, flush=True)


def _modetour_modal_log(msg: str) -> None:
    """관리자 subprocess stderr: modal 단계 진단."""
    print(f"[modetour] [modetour-modal] {msg}", file=__import__("sys").stderr, flush=True)


def _modetour_detail_url_summary(detail_url: str) -> str:
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


def _modetour_row_richness_score(r: Dict[str, Any]) -> int:
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


def _modetour_iso_from_year_month_day(year: Optional[str], month: Optional[str], day: int) -> Optional[str]:
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


def _modetour_dedupe_by_departure_date_richer(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
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
        elif _modetour_row_richness_score(r) > _modetour_row_richness_score(by_date[d]):
            by_date[d] = r
    return [by_date[k] for k in sorted(order)]


def _parse_year_month(text: Optional[str]) -> tuple:
    """연/월 텍스트(예: '2026. 04', '2026년 4월')에서 (year, month) 추출."""
    if not text or not str(text).strip():
        return None, None
    text = str(text).strip()
    m = re.search(r"(\d{4})\s*[.\s년]*\s*(\d{1,2})\s*월?", text)
    if m:
        return m.group(1), m.group(2).zfill(2)
    nums = re.findall(r"\d+", text)
    if len(nums) >= 2:
        return nums[0], nums[1].zfill(2)
    return None, None


def _day_num_from_text(s: str) -> Optional[int]:
    """날짜 텍스트에서 일(1-31) 추출."""
    if not s or not str(s).strip():
        return None
    s = re.sub(r"\D", "", str(s).strip())
    if not s:
        return None
    try:
        d = int(s)
        return d if 1 <= d <= 31 else None
    except ValueError:
        return None


def _is_price_absent(price_text: Optional[str]) -> bool:
    """가격이 없거나 선택 불가 상태면 True (Skip 대상)."""
    if price_text is None:
        return True
    t = str(price_text).strip()
    if not t or t in ("-", "—", ""):
        return True
    return False


class CalendarPriceScraper:
    """
    modetour 상세 달력: 출발일 모달·td 셀·우측 패널을 순회해 출발일별 row를 수집한다.
    레거시 인라인 달력 경로는 모달 실패 시에만 보조로 사용한다.
    """

    def __init__(
        self,
        headless: bool = True,
        randomize_ua: bool = True,
        random_mouse: bool = False,
    ):
        self.site = "modetour"
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

    async def _eval_modetour_calendar_cells(self) -> List[Dict[str, Any]]:
        """
        modetour 달력 td: '12 64만' 형태(만원) → 날짜·추정가·td 인덱스.
        table td 순서는 클릭 시 locator.nth 와 일치해야 함.
        """
        script = """
() => {
  function modetourLayerRoot() {
    const d = document.querySelector('[role="dialog"],[aria-modal="true"]');
    if (d && d.querySelectorAll('table td').length > 5) return d;
    const candidates = Array.from(document.querySelectorAll('div, section')).filter((el) => {
      const t = el.innerText || '';
      return /20\\d{2}\\.\\d{2}/.test(t) && /만/.test(t) && el.querySelectorAll('table td').length > 10;
    });
    return candidates[0] || d || null;
  }
  const modal = modetourLayerRoot();
  if (!modal) return [];
  const head = (modal.innerText || '').match(/(20\\d{2})\\.(\\d{2})/);
  let y = head ? parseInt(head[1], 10) : 2026;
  let mo = head ? parseInt(head[2], 10) : 4;
  const all = Array.from(modal.querySelectorAll('table td'));
  let lastDay = -1;
  const out = [];
  for (let i = 0; i < all.length; i++) {
    const raw = (all[i].innerText || '').replace(/\\s+/g, ' ').trim();
    if (!raw) continue;
    const dm = raw.match(/^(\\d{1,2})\\s+(\\d+)만$/);
    const dayOnly = raw.match(/^(\\d{1,2})$/);
    if (dayOnly) {
      const d = parseInt(dayOnly[1], 10);
      if (lastDay > 0 && d === 1 && lastDay >= 28) {
        mo += 1;
        if (mo > 12) { mo = 1; y += 1; }
      } else if (lastDay > 0 && d < lastDay && lastDay > 20) {
        mo += 1;
        if (mo > 12) { mo = 1; y += 1; }
      }
      lastDay = d;
      continue;
    }
    if (dm) {
      const d = parseInt(dm[1], 10);
      const man = parseInt(dm[2], 10);
      if (lastDay > 0 && d < lastDay && lastDay > 20) {
        mo += 1;
        if (mo > 12) { mo = 1; y += 1; }
      }
      lastDay = d;
      const price = man * 10000;
      const iso = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      out.push({ date: iso, price, tdIndex: i });
    }
  }
  return out;
}
"""
        try:
            rows = await self._page.evaluate(script)
            if not rows:
                dbg = await self._page.evaluate(
                    """() => {
  function modetourLayerRoot() {
    const d = document.querySelector('[role="dialog"],[aria-modal="true"]');
    if (d && d.querySelectorAll('table td').length > 5) return d;
    const candidates = Array.from(document.querySelectorAll('div, section')).filter((el) => {
      const t = el.innerText || '';
      return /20\\d{2}\\.\\d{2}/.test(t) && /만/.test(t) && el.querySelectorAll('table td').length > 10;
    });
    return candidates[0] || d || null;
  }
  const m = modetourLayerRoot();
  if (!m) return { err: 'no_layer' };
  const tds = m.querySelectorAll('table td');
  const samples = Array.from(tds).slice(0, 24).map((td) =>
    (td.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40)
  );
  return { tdCount: tds.length, samples };
}"""
                )
                _modetour_modal_log(f"phase=modetour-calendar-empty-debug {dbg!r}")
            return rows if isinstance(rows, list) else []
        except Exception:
            return []

    def _modetour_panel_range_text(self, txt: str) -> str:
        try:
            dep = re.search(r"출발\s*:\s*([^\n]+)", txt)
            arr = re.search(r"도착\s*:\s*([^\n]+)", txt)
            if not dep or not arr:
                return ""
            t1 = re.search(
                r"(20\d{2}\.\d{2}\.\d{2}\([^)]+\)\s*\d{1,2}:\d{2})", dep.group(1)
            )
            arr_line = arr.group(1)
            t2_list = re.findall(
                r"(20\d{2}\.\d{2}\.\d{2}\([^)]+\)\s*\d{1,2}:\d{2})", arr_line
            )
            if t1 and t2_list:
                return f"{t1.group(1)} - {t2_list[-1]}"
        except Exception:
            pass
        return ""

    def _modetour_merge_cell_and_panel(
        self, cell: Dict[str, Any], panel_txt: str
    ) -> Dict[str, Any]:
        price = int(cell.get("price") or 0)
        m = re.search(r"([0-9]{1,3}(?:,[0-9]{3})+)\s*원", panel_txt)
        if m:
            p2 = int(m.group(1).replace(",", ""), 10)
            if p2 > 0:
                price = p2
        range_text = self._modetour_panel_range_text(panel_txt)
        carrier = ""
        m2 = re.search(r"항공여정\s*\n+\s*([^\n]+)", panel_txt)
        if m2:
            carrier = m2.group(1).strip()
        seats_text = ""
        m3 = re.search(r"여유좌석\s*:\s*([^/\n]+)", panel_txt)
        if m3:
            seats_text = m3.group(1).strip()
        availability = "예약가능"
        if "예약마감" in panel_txt:
            availability = "예약마감"
        elif "대기예약" in panel_txt:
            availability = "대기예약"
        return {
            "date": str(cell.get("date") or "")[:10],
            "price": price,
            "departureRangeText": range_text,
            "airlineName": carrier,
            "availabilityText": availability,
            "seatsText": seats_text,
            "titleText": None,
            "tripNightsDaysText": None,
        }

    async def _read_modetour_modal_panel_text(self) -> str:
        try:
            t = await self._page.evaluate(
                """() => {
  function modetourLayerRoot() {
    const d = document.querySelector('[role="dialog"],[aria-modal="true"]');
    if (d && d.querySelectorAll('table td').length > 5) return d;
    const candidates = Array.from(document.querySelectorAll('div, section')).filter((el) => {
      const t = el.innerText || '';
      return /20\\d{2}\\.\\d{2}/.test(t) && /만/.test(t) && el.querySelectorAll('table td').length > 10;
    });
    return candidates[0] || d || null;
  }
  const m = modetourLayerRoot();
  if (m && m.innerText) return m.innerText;
  return document.body.innerText || '';
}"""
            )
            return t if isinstance(t, str) else ""
        except Exception:
            return ""

    async def _modetour_try_month_next(self) -> bool:
        month_next_selectors = (
            getattr(self, "_month_next_selectors", None) or MODETOUR_MONTH_NEXT_SELECTORS
        )
        for nsel in month_next_selectors:
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
        return False

    async def _run_modetour_departures(self) -> List[Dict[str, Any]]:
        """package 상세: 출발일 변경 모달 → 달력 td(NN만) + 일자 클릭 후 우측 패널에서 항공·좌석·정확가."""
        popup_open_selectors = MODETOUR_POPUP_OPEN_SELECTORS
        opened = False
        _modetour_modal_log(
            f"phase=modetour-open trying_selectors count={len(popup_open_selectors)}"
        )
        for sel in popup_open_selectors:
            try:
                btn = await self._page.query_selector(sel)
                if btn:
                    await human_delay(DELAY_MIN, DELAY_MAX)
                    await btn.click()
                    await self._page.wait_for_timeout(950)
                    opened = True
                    break
            except Exception:
                continue
        if not opened:
            _modetour_modal_log("phase=modetour-open failed")
            return []
        await human_delay(DELAY_MIN, DELAY_MAX)
        await self._page.wait_for_timeout(700)
        await self._page.wait_for_timeout(2000)
        try:
            await self._page.wait_for_selector("table td", timeout=20000)
        except Exception:
            pass
        await self._page.wait_for_timeout(800)
        await self._scroll_modetour_modal_list()

        kst_floor = _kst_today_ymd()
        rows_merged: Dict[str, Dict[str, Any]] = {}
        done_dates: set = set()
        max_clicks = 16

        for mi in range(DEFAULT_CALENDAR_MONTH_LIMIT):
            cells = await self._eval_modetour_calendar_cells()
            _modetour_modal_log(
                f"phase=modetour-calendar monthRound={mi + 1} pricedCells={len(cells)}"
            )
            for c in cells:
                if not isinstance(c, dict):
                    continue
                d = str(c.get("date") or "")[:10]
                if len(d) != 10 or d < kst_floor:
                    continue
                if d in done_dates:
                    continue
                if len(done_dates) >= max_clicks:
                    break
                td_idx = c.get("tdIndex")
                if td_idx is None:
                    continue
                try:
                    td_i = int(td_idx)
                    clicked = await self._page.evaluate(
                        """(idx) => {
  function modetourLayerRoot() {
    const d = document.querySelector('[role="dialog"],[aria-modal="true"]');
    if (d && d.querySelectorAll('table td').length > 5) return d;
    const candidates = Array.from(document.querySelectorAll('div, section')).filter((el) => {
      const t = el.innerText || '';
      return /20\\d{2}\\.\\d{2}/.test(t) && /만/.test(t) && el.querySelectorAll('table td').length > 10;
    });
    return candidates[0] || d || null;
  }
  const m = modetourLayerRoot();
  if (!m) return false;
  const tds = m.querySelectorAll('table td');
  const el = tds[idx];
  if (!el) return false;
  try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
  try { el.click(); } catch (e) { return false; }
  return true;
}""",
                        td_i,
                    )
                    if not clicked:
                        continue
                except Exception:
                    continue
                await human_delay(0.35, 0.65)
                panel_txt = ""
                d_dot = d.replace("-", ".")
                for _ in range(28):
                    await self._page.wait_for_timeout(90)
                    panel_txt = await self._read_modetour_modal_panel_text()
                    if d_dot in panel_txt and "항공여정" in panel_txt:
                        break
                item = self._modetour_merge_cell_and_panel(c, panel_txt)
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
                done_dates.add(d)
            if len(done_dates) >= max_clicks:
                break
            # 모달 안에 2개월 이상이 한꺼번에 그려지는 경우가 많음 → '다음달' 클릭은 다른 UI를 건드릴 수 있어 생략
            if len(cells) >= 20:
                _modetour_modal_log(
                    "phase=modetour-calendar skip-month-nav multi_month_dom=true"
                )
                break
            if not await self._modetour_try_month_next():
                break

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
                if m:
                    y1, mo1, day1, h1, mi1, y2, mo2, day2, h2, mi2 = m.groups()
                    dep_at = f"{y1}-{int(mo1):02d}-{int(day1):02d} {int(h1):02d}:{mi1}"
                    arr_at = f"{y2}-{int(mo2):02d}-{int(day2):02d} {int(h2):02d}:{mi2}"
            status_raw = availability or (seats if seats else "예약가능")
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
                }
            )
        out = _modetour_dedupe_by_departure_date_richer(out)
        _modetour_log(f"[modetour] priced rows after modal scrape: {len(out)}")
        return out

    async def _run_legacy_inline_calendar_only(self) -> List[Dict[str, Any]]:
        """모달 없이 본문에 달력이 바로 노출되는 레이아웃 보조."""
        try:
            wrap = await self._page.query_selector(config.SELECTOR_CALENDAR_WRAP)
            if wrap:
                await wrap.evaluate("el => el.scrollIntoView({ behavior: 'smooth' })")
                await human_delay(DELAY_MIN, DELAY_MAX)
        except Exception:
            pass

        seen_dates: set = set()
        result: List[Dict[str, Any]] = []
        month_count = 0
        month_limit = DEFAULT_CALENDAR_MONTH_LIMIT

        while month_count < month_limit:
            result_before_month = len(result)
            try:
                year_month_text = await self._get_current_year_month()
                if not year_month_text:
                    break
                y, m = _parse_year_month(year_month_text)
                if not y or not m:
                    break
            except Exception:
                break

            inner_rounds = 0
            max_inner = 1
            while inner_rounds < max_inner:
                try:
                    cells = await self._collect_visible_date_price_only(y, m)
                    for item in cells:
                        d = item.get("date")
                        if d and d not in seen_dates:
                            seen_dates.add(d)
                            result.append(item)
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
                    await human_delay(DELAY_MIN, DELAY_MAX)
                    await slide_btn.click()
                    await self._page.wait_for_timeout(SLIDE_WAIT_MS)
                except Exception:
                    break
                inner_rounds += 1

            month_count += 1
            if month_count > 1 and len(result) == result_before_month:
                break
            try:
                month_btn = await self._page.query_selector(
                    config.SELECTOR_MONTH_NEXT_ARROW
                )
                if not month_btn:
                    break
                disabled = await month_btn.get_attribute("disabled")
                if disabled is not None:
                    break
                await human_delay(DELAY_MIN, DELAY_MAX)
                await month_btn.click()
                await self._page.wait_for_timeout(MONTH_WAIT_MS)
            except Exception:
                break

        return _filter_calendar_rows_kst_floor(sorted(result, key=lambda x: x.get("date", "")))

    async def run_on_detail_url(self, detail_url: str) -> List[Dict[str, Any]]:
        """
        상품 상세 URL 한 건에 대해 출발일 변경 모달 기준으로 [날짜, 가격, 좌석, 항공…] 수집.
        반환: 모달 경로와 동일한 풍부 필드 (관리자 JSON 파싱 호환).
        """
        if not self._page:
            return []
        self._detail_url = detail_url
        try:
            await human_delay(DELAY_MIN, DELAY_MAX)
            await self._page.goto(
                detail_url,
                wait_until="domcontentloaded",
                timeout=config.PAGE_LOAD_TIMEOUT_MS,
            )
            await self._page.wait_for_load_state(
                "networkidle",
                timeout=config.NETWORK_IDLE_TIMEOUT_MS,
            )
            if self.random_mouse:
                await random_mouse_move(self._page)
            await human_delay(DELAY_MIN, DELAY_MAX)
        except Exception:
            return []

        modal_rows = await self._run_modetour_departures()
        if len(modal_rows) > 0:
            return modal_rows
        return await self._run_legacy_inline_calendar_only()

    async def _get_current_year_month(self) -> Optional[str]:
        try:
            el = await self._page.query_selector(config.SELECTOR_CALENDAR_YEAR_MONTH)
            if el:
                return (await el.text_content() or "").strip()
        except Exception:
            pass
        return None

    async def _collect_visible_date_price_only(
        self, year: str, month: str
    ) -> List[Dict[str, Any]]:
        """
        현재 화면에 노출된 날짜 셀 중 '가격이 존재하는' 셀만 추출.
        가격 없음(빈칸, '-')이면 즉시 Skip. 반환 형식: [ {"date": "YYYY-MM-DD", "price": int}, ... ]
        """
        out: List[Dict[str, Any]] = []
        try:
            containers = await self._page.query_selector_all(
                config.SELECTOR_DATE_CELL_CONTAINER
            )
        except Exception:
            return out

        for cell in containers:
            try:
                # 날짜(일) 추출
                day_el = await cell.query_selector(config.SELECTOR_CELL_DAY_NUM)
                day_text = (
                    (await day_el.text_content() or "").strip() if day_el else ""
                )
                if not day_text:
                    full = await cell.text_content() or ""
                    parts = full.strip().split()
                    day_text = parts[0] if parts else ""
                day_num = _day_num_from_text(day_text)
                if not day_num:
                    continue
                date_str = f"{year}-{month}-{day_num:02d}"
                if date_str < _kst_today_ymd():
                    continue

                # 가격 추출 — 없으면 Skip (규칙: 선택 불가 = 추출 안 함)
                price_el = await cell.query_selector(config.SELECTOR_CELL_PRICE)
                price_text = (
                    (await price_el.text_content() or "").strip() if price_el else ""
                )
                if not price_text:
                    full_cell = (await cell.text_content() or "").strip()
                    for token in full_cell.replace("\n", " ").split():
                        t = token.strip()
                        if _is_price_absent(t):
                            continue
                        if "만" in t or "," in t or re.search(r"\d", t):
                            price_text = t
                            break
                if _is_price_absent(price_text):
                    continue
                price_int = clean_price_to_int(price_text)
                if price_int <= 0:
                    continue
                out.append({"date": date_str, "price": price_int})
            except Exception:
                continue
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


if __name__ == "__main__":
    import json
    import sys
    url = (sys.argv[1] or "").strip() if len(sys.argv) > 1 else ""
    if not url or not url.startswith("http"):
        print("Usage: python -m scripts.calendar_e2e_scraper_modetour.calendar_price_scraper <detail_url>")
        sys.exit(1)
    result = asyncio.run(run_calendar_price_from_url(url, headless=True))
    print(json.dumps(result, ensure_ascii=False, indent=2))
