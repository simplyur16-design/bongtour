# -*- coding: utf-8 -*-
"""
하나투어/모두투어/참좋은/노랑풍선 상품 상세 페이지 달력 위젯 전용 스크래퍼.
타겟: 오직 [날짜] + [가격]만 1년 치 수집. 가격 없는 셀(빈칸, '-') 즉시 Skip.
이중 화살표: 보름 슬라이드(Inner) + 월 변경(Outer). playwright-stealth, 1.5~3.0초 딜레이, try-except 전 단계.
"""
import asyncio
import datetime as dt
import json
import os
import re
import urllib.parse
import urllib.request
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


# 명세: 화살표/로딩 대기 딜레이
DELAY_MIN = 1.5
DELAY_MAX = 3.0
SLIDE_WAIT_MS = 1000
MONTH_WAIT_MS = 1500

VERYGOOD_POPUP_OPEN_SELECTORS = [
    "button:has-text('출발일 변경')",
    "a:has-text('출발일 변경')",
    "button:has-text('출발일선택')",
    "a:has-text('출발일선택')",
    "button:has-text('출발일')",
]
VERYGOOD_MONTH_NEXT_SELECTORS = [
    ".month_next",
    ".calendar_next",
    "button.next",
    "a.next",
    "button:has-text('다음달')",
    "a:has-text('다음달')",
]

# 노랑풍선(ybtour): 출발일 변경 모달 — 좌측 달력은 가격·날짜 인덱스, 우측 리스트가 출발옵션 SSOT(제목 필터 없음)
YBTOUR_POPUP_OPEN_SELECTORS = [
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
YBTOUR_MONTH_NEXT_SELECTORS = list(VERYGOOD_MONTH_NEXT_SELECTORS) + [
    "button.calendar_next",
    "a.calendar_next",
    "button:has-text('다음달')",
    "a:has-text('다음달')",
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

# 노랑풍선: 모달 기본 월이 URL/페이지 상태일 수 있어 KST 현재 월까지 이전/다음으로 맞춘 뒤 루프 시작
YBTOUR_MONTH_ALIGN_MAX_STEPS = 24


def _verygood_log(msg: str) -> None:
    """관리자 subprocess는 stdout=JSON 이므로 진단은 stderr."""
    print(msg, file=__import__("sys").stderr, flush=True)


def _ybtour_log(msg: str) -> None:
    print(msg, file=__import__("sys").stderr, flush=True)


def _ybtour_modal_log(msg: str) -> None:
    """관리자 stderr 필터([ybtour]) 유지 + 모달 단계 구분용 [ybtour-modal]."""
    print(f"[ybtour] [ybtour-modal] {msg}", file=__import__("sys").stderr, flush=True)


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


def _to_iso_datetime(s: str) -> Optional[str]:
    if not s:
        return None
    m = re.search(
        r"(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2}).*?(\d{1,2})\s*:\s*(\d{2})",
        s,
    )
    if not m:
        return None
    yyyy, mm, dd, hh, mi = m.groups()
    return f"{yyyy}-{int(mm):02d}-{int(dd):02d} {int(hh):02d}:{int(mi):02d}"


def _extract_shared_departure_meta_from_text(page_text: str) -> Dict[str, Any]:
    txt = page_text or ""
    meta: Dict[str, Any] = {
        "carrierName": None,
        "outboundFlightNo": None,
        "outboundDepartureAirport": None,
        "outboundDepartureAt": None,
        "outboundArrivalAirport": None,
        "outboundArrivalAt": None,
        "inboundFlightNo": None,
        "inboundDepartureAirport": None,
        "inboundDepartureAt": None,
        "inboundArrivalAirport": None,
        "inboundArrivalAt": None,
        "meetingInfoRaw": None,
        "meetingPointRaw": None,
        "meetingTerminalRaw": None,
        "meetingGuideNoticeRaw": None,
        "minPax": None,
    }
    carrier = re.search(r"(티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공)", txt)
    if carrier:
        meta["carrierName"] = fix_airline_name_str(carrier.group(1))
    min_pax = re.search(r"최소\s*출발\s*인원\s*[:：]?\s*(\d+)\s*명", txt)
    if min_pax:
        try:
            meta["minPax"] = int(min_pax.group(1))
        except Exception:
            pass
    meet = re.search(r"(미팅\s*장소|집결지)[^\n\r]*[:：]?\s*([^\n\r]{4,160})", txt)
    if meet:
        info = meet.group(0).strip()
        point = meet.group(2).strip()
        meta["meetingInfoRaw"] = info
        meta["meetingPointRaw"] = point
        term = re.search(r"(제\d터미널|T\d)", point)
        if term:
            meta["meetingTerminalRaw"] = term.group(1)
    # 출국/입국 블록(원문 변형 허용) - 첫 매치를 보수적으로 사용
    out = re.search(r"출국[\s\S]{0,200}?(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}[^\n\r]{0,30}\d{1,2}:\d{2})", txt)
    inn = re.search(r"입국[\s\S]{0,200}?(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}[^\n\r]{0,30}\d{1,2}:\d{2})", txt)
    if out:
        meta["outboundDepartureAt"] = _to_iso_datetime(out.group(1))
    if inn:
        meta["inboundArrivalAt"] = _to_iso_datetime(inn.group(1))
    flight = re.findall(r"\b([A-Z]{2}\d{2,4})\b", txt)
    if flight:
        meta["outboundFlightNo"] = flight[0]
        if len(flight) > 1:
            meta["inboundFlightNo"] = flight[1]
    return meta


def _http_get_text(url: str, referer: Optional[str] = None) -> str:
    headers = {"User-Agent": get_user_agent(fixed=True)}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _extract_calendar_json_from_html(html: str) -> List[Dict[str, Any]]:
    m = re.search(r"var\s+\$calendarProductListJson\s*=\s*(\[[\s\S]*?\]);", html)
    if not m:
        return []
    raw = m.group(1)
    try:
        return json.loads(raw)
    except Exception:
        return []


def _extract_airports_from_detail_html(html: str) -> Dict[str, Optional[str]]:
    out: Dict[str, Optional[str]] = {
        "outboundDepartureAirport": None,
        "outboundArrivalAirport": None,
        "inboundDepartureAirport": None,
        "inboundArrivalAirport": None,
    }
    # 한국출발 블록: "... 15:30</b> 인천 출발" / "... 17:55</b> 도쿄 도착"
    dep_block = re.search(r'<div class="inout depature">([\s\S]*?)</div></div>', html)
    if dep_block:
        t = dep_block.group(1)
        m1 = re.search(r"</b>\s*([^<\s]+)\s*출발", t)
        m2 = re.search(r"</b>\s*([^<\s]+)\s*도착", t)
        if m1:
            out["outboundDepartureAirport"] = m1.group(1).strip()
        if m2:
            out["outboundArrivalAirport"] = m2.group(1).strip()
    ent_block = re.search(r'<div class="inout entry">([\s\S]*?)</div></div>', html)
    if ent_block:
        t = ent_block.group(1)
        m1 = re.search(r"</b>\s*([^<\s]+)\s*출발", t)
        m2 = re.search(r"</b>\s*([^<\s]+)\s*도착", t)
        if m1:
            out["inboundDepartureAirport"] = m1.group(1).strip()
        if m2:
            out["inboundArrivalAirport"] = m2.group(1).strip()
    return out


def _extract_meeting_from_detail_html(html: str) -> Dict[str, Optional[str]]:
    out: Dict[str, Optional[str]] = {
        "meetingInfoRaw": None,
        "meetingPointRaw": None,
        "meetingTerminalRaw": None,
        "meetingGuideNoticeRaw": None,
    }
    m = re.search(r"<h4 class=\"detail-h\">미팅장소</h4>[\s\S]*?<p>\s*([\s\S]*?)\s*</p>", html)
    if not m:
        return out
    raw = re.sub(r"<[^>]+>", " ", m.group(1))
    point = re.sub(r"\s+", " ", raw).strip()
    if point:
        out["meetingInfoRaw"] = point
        out["meetingPointRaw"] = point
        tm = re.search(r"(제\d터미널|T\d)", point)
        if tm:
            out["meetingTerminalRaw"] = tm.group(1)
    return out


def _month_iter_from_procode(procode: str, months: int = 12) -> List[tuple]:
    # 예: JPP423-260329TW -> 시작월 2026-03 (단, KST 오늘 이전 월은 건너뜀)
    start = _kst_month_start()
    m = re.search(r"-(\d{2})(\d{2})\d{2}", procode or "")
    if m:
        yy = int(m.group(1))
        mm = int(m.group(2))
        start = dt.date(2000 + yy, max(1, min(mm, 12)), 1)
    floor_m = _kst_month_start()
    if start < floor_m:
        start = floor_m
    out: List[tuple] = []
    cur = start
    for _ in range(months):
        out.append((cur.year, cur.month))
        if cur.month == 12:
            cur = dt.date(cur.year + 1, 1, 1)
        else:
            cur = dt.date(cur.year, cur.month + 1, 1)
    return out


def scrape_verygood_departures_from_network(detail_url: str) -> List[Dict[str, Any]]:
    u = urllib.parse.urlparse(detail_url)
    q = urllib.parse.parse_qs(u.query)
    procode = (q.get("ProCode") or [""])[0].strip()
    menu_code = (q.get("MenuCode") or ["leaveLayer"])[0].strip() or "leaveLayer"
    if not procode:
        return []
    master_code = procode.split("-")[0].strip()
    detail_html = _http_get_text(detail_url)
    shared_text = re.sub(r"<[^>]+>", " ", detail_html)
    shared = _extract_shared_departure_meta_from_text(re.sub(r"\s+", " ", shared_text))
    airports = _extract_airports_from_detail_html(detail_html)
    meeting = _extract_meeting_from_detail_html(detail_html)

    merged: Dict[str, Dict[str, Any]] = {}
    base = f"{u.scheme}://{u.netloc}"
    # 참좋은여행: 월 단위로 다음 달 이동하며 수집 (과거 월은 procode 기준에서도 KST 오늘 이후로 클램프)
    for year, month in _month_iter_from_procode(procode, months=DEFAULT_CALENDAR_MONTH_LIMIT):
        cal_url = f"{base}/Product/ProductCalendarSearch?MasterCode={master_code}&MenuCode={menu_code}&Year={year}&Month={month:02d}"
        try:
            html = _http_get_text(cal_url, referer=detail_url)
        except Exception:
            continue
        rows = _extract_calendar_json_from_html(html)
        for v in rows:
            date = str(v.get("DepartureDateToShortString") or "").strip()
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
                continue
            if date < _kst_today_ymd():
                continue
            status_raw = str(v.get("BtnReserveAltTag") or "").strip() or "예약가능"
            seats = None
            rest = v.get("restSeatCount")
            if isinstance(rest, int) and rest > 0:
                seats = f"잔여{rest}"
            trans_code = str(v.get("TransCode") or "").strip()
            trans_num = str(v.get("TransNumber") or "").strip().replace(" ", "")
            dep_time = str(v.get("DepartureDepartureTime") or "").strip()
            arr_time = str(v.get("ArrivalArrivalTime") or "").strip()
            out_dep_at = f"{date} {dep_time}" if dep_time else None
            # 도착일은 ArrivalDateToShortString 사용
            arr_date = str(v.get("ArrivalDateToShortString") or "").strip()
            in_arr_at = f"{arr_date} {arr_time}" if arr_date and arr_time else None
            row = {
                "date": date,
                "price": int(v.get("AdultPrice") or 0),
                "status": status_raw,
                "statusRaw": status_raw,
                "seatsStatusRaw": seats,
                "adultPrice": int(v.get("AdultPrice") or 0),
                "childBedPrice": None,
                "childNoBedPrice": None,
                "infantPrice": None,
                "localPriceText": None,
                "minPax": int(v.get("MinCount")) if str(v.get("MinCount") or "").isdigit() else shared.get("minPax"),
                "carrierName": fix_airline_name_str(
                    str(v.get("TrasnName") or "").strip()
                    or str(shared.get("carrierName") or "").strip()
                ),
                "outboundFlightNo": f"{trans_code}{trans_num}" if trans_code and trans_num else shared.get("outboundFlightNo"),
                "outboundDepartureAirport": airports.get("outboundDepartureAirport") or shared.get("outboundDepartureAirport"),
                "outboundDepartureAt": out_dep_at or shared.get("outboundDepartureAt"),
                "outboundArrivalAirport": airports.get("outboundArrivalAirport") or shared.get("outboundArrivalAirport"),
                "outboundArrivalAt": None,
                "inboundFlightNo": shared.get("inboundFlightNo"),
                "inboundDepartureAirport": airports.get("inboundDepartureAirport") or shared.get("inboundDepartureAirport"),
                "inboundDepartureAt": None,
                "inboundArrivalAirport": airports.get("inboundArrivalAirport") or shared.get("inboundArrivalAirport"),
                "inboundArrivalAt": in_arr_at or shared.get("inboundArrivalAt"),
                "meetingInfoRaw": meeting.get("meetingInfoRaw") or shared.get("meetingInfoRaw"),
                "meetingPointRaw": meeting.get("meetingPointRaw") or shared.get("meetingPointRaw"),
                "meetingTerminalRaw": meeting.get("meetingTerminalRaw") or shared.get("meetingTerminalRaw"),
                "meetingGuideNoticeRaw": meeting.get("meetingGuideNoticeRaw") or shared.get("meetingGuideNoticeRaw"),
            }
            key = f"{date}|{v.get('ProductCode')}|{v.get('PriceSeq')}"
            merged[key] = row
    return _filter_calendar_rows_kst_floor(
        sorted(list(merged.values()), key=lambda x: x.get("date", ""))
    )


class CalendarPriceScraper:
    """
    하나투어/모두투어 상품 상세 페이지 달력에서
    '출발 일정이 있는 날짜'의 [날짜]와 [가격]만 1년 치 추출.
    - 가격 없는 셀(빈칸, '-') 즉시 Skip.
    - 출력: [ {"date": "2026-04-03", "price": 890000}, ... ]
    - 이중 루프: Outer=월 변경(최대 12), Inner=보름 슬라이드.
    - IP 차단 방지: stealth, random 1.5~3.0초, try-except 전 단계.
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
        for nsel in YBTOUR_POPUP_NEXT_MONTH_SELECTORS + YBTOUR_MONTH_NEXT_SELECTORS:
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
        for nsel in YBTOUR_POPUP_PREV_MONTH_SELECTORS + YBTOUR_MONTH_PREV_SELECTORS:
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
    try {{
      td.click();
      return true;
    }} catch (e) {{}}
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
    if (/20\\d{{2}}\\s*[./]\\s*\\d{{1,2}}/.test(s)) return s.slice(0, 64);
  }}
  const blob = (root.innerText || '').replace(/\\s+/g, ' ').trim();
  const m = blob.match(/(20\\d{{2}}\\s*[./]\\s*\\d{{1,2}})/);
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
        """모달 우측 리스트 row 전체 후보 — 상품명 비교·제목 정규화 매칭 없음(리스트는 동일 상품 전제)."""
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
            f"phase=detail-title-hint audit_only raw_len={len(raw_title)} (not used for row filter)"
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
            batch = await self._collect_ybtour_popup_rows()
            if len(batch) == 0 and priced_days > 0:
                merged_click: List[Dict[str, Any]] = []
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
                    clicked = await self._ybtour_click_calendar_day(d_int)
                    if not clicked:
                        continue
                    await self._page.wait_for_timeout(400)
                    await self._scroll_ybtour_popup_list_deep()
                    part = await self._collect_ybtour_popup_rows()
                    merged_click.extend(part)
                batch = merged_click
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

            yp, mp = _parse_year_month(ym)
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

            moved = await self._ybtour_click_next_month_nav()
            _ybtour_modal_log(
                f"phase=move-month monthRound={mi + 1} success={moved} source=ybtour_click_next_month_nav"
            )
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

    async def _run_verygoodtour_departures(self) -> List[Dict[str, Any]]:
        """
        참좋은여행 전용:
        1) 출발일 변경 팝업 열기
        2) 월 이동(최대 12)하며 팝업 리스트의 출발일/가격/상태 수집
        3) 상세 본문에서 항공/미팅/최소출발인원 추출하여 각 row에 병합
        """
        page_text = ""
        try:
            page_text = await self._page.evaluate("document.body.innerText || ''")
        except Exception:
            page_text = ""
        shared = _extract_shared_departure_meta_from_text(page_text)

        # 팝업 열기
        opened = False
        for sel in VERYGOOD_POPUP_OPEN_SELECTORS:
            try:
                btn = await self._page.query_selector(sel)
                if btn:
                    await human_delay(DELAY_MIN, DELAY_MAX)
                    await btn.click()
                    await self._page.wait_for_timeout(800)
                    opened = True
                    break
            except Exception:
                continue
        # 버튼 못 찾은 경우에도 현재 DOM에서 리스트 추출 시도
        rows: Dict[str, Dict[str, Any]] = {}
        for mi in range(12):
            await self._scroll_verygood_popup_list()
            for item in await self._collect_verygood_popup_rows():
                date = item.get("date")
                if not date:
                    continue
                price_v = int(item.get("price") or 0)
                dedupe_key = "|".join(
                    [
                        str(date),
                        str(price_v),
                        str(item.get("carrierName") or ""),
                        str(item.get("departureRangeText") or "")[:48],
                    ]
                )
                prev = rows.get(dedupe_key)
                if not prev or price_v > int(prev.get("price") or 0):
                    rows[dedupe_key] = item
            _verygood_log(
                f"[verygoodtour] month_round={mi + 1} unique_row_keys={len(rows)} (modal opened={opened})"
            )
            moved = False
            for sel in VERYGOOD_MONTH_NEXT_SELECTORS:
                try:
                    nxt = await self._page.query_selector(sel)
                    if not nxt:
                        continue
                    disabled = await nxt.get_attribute("disabled")
                    if disabled is not None:
                        continue
                    await human_delay(DELAY_MIN, DELAY_MAX)
                    await nxt.click()
                    await self._page.wait_for_timeout(MONTH_WAIT_MS)
                    moved = True
                    break
                except Exception:
                    continue
            if not moved:
                break

        out: List[Dict[str, Any]] = []
        for dedupe_key in sorted(rows.keys(), key=lambda k: str(rows[k].get("date") or "")):
            item = rows[dedupe_key]
            d = str(item.get("date") or "").strip()[:10]
            if len(d) != 10 or d < _kst_today_ymd():
                continue
            status_raw = (item.get("status") or "").strip()
            _rc = ((item.get("carrierName") or "").strip() or shared.get("carrierName") or "")
            row_carrier = fix_airline_name_str(str(_rc)) if _rc else None
            out.append(
                {
                    "date": d,
                    "price": int(item.get("price") or 0),
                    "status": status_raw or "예약가능",
                    "statusRaw": status_raw or "예약가능",
                    "seatsStatusRaw": item.get("seatsStatusRaw"),
                    "adultPrice": int(item.get("price") or 0),
                    "childBedPrice": None,
                    "childNoBedPrice": None,
                    "infantPrice": None,
                    "localPriceText": None,
                    "minPax": shared.get("minPax"),
                    "carrierName": row_carrier,
                    "outboundFlightNo": shared.get("outboundFlightNo"),
                    "outboundDepartureAirport": shared.get("outboundDepartureAirport"),
                    "outboundDepartureAt": shared.get("outboundDepartureAt"),
                    "outboundArrivalAirport": shared.get("outboundArrivalAirport"),
                    "outboundArrivalAt": shared.get("outboundArrivalAt"),
                    "inboundFlightNo": shared.get("inboundFlightNo"),
                    "inboundDepartureAirport": shared.get("inboundDepartureAirport"),
                    "inboundDepartureAt": shared.get("inboundDepartureAt"),
                    "inboundArrivalAirport": shared.get("inboundArrivalAirport"),
                    "inboundArrivalAt": shared.get("inboundArrivalAt"),
                    "meetingInfoRaw": shared.get("meetingInfoRaw"),
                    "meetingPointRaw": shared.get("meetingPointRaw"),
                    "meetingTerminalRaw": shared.get("meetingTerminalRaw"),
                    "meetingGuideNoticeRaw": shared.get("meetingGuideNoticeRaw"),
                    "_popupOpened": opened,
                }
            )
        _verygood_log(f"[verygoodtour] total unique departure rows built: {len(out)}")
        return out

    async def _scroll_verygood_popup_list(self) -> None:
        """모달 우측 리스트 끝까지 스크롤해 가려진 row 로딩 유도."""
        try:
            await self._page.evaluate(
                """() => {
  const modal = document.querySelector('[role="dialog"], .ui-dialog, .layer_pop, .pop_layer, #divLayerCalendar, [class*="layer_pop"], [class*="calendar_layer"], .pop_calendar');
  const root = modal || document.body;
  const scrollables = root.querySelectorAll('.scroll_wrap, .list_wrap, [class*="scroll"], ul, .mCustomScrollBox, [style*="overflow"]');
  for (const el of scrollables) {
    try {
      el.scrollTop = el.scrollHeight;
    } catch (e) {}
  }
}"""
            )
            await self._page.wait_for_timeout(500)
        except Exception:
            pass

    async def _collect_verygood_popup_rows(self) -> List[Dict[str, Any]]:
        """
        참좋은여행 '출발일 변경' 모달 우측 카드 리스트 DOM 기준 추출.
        전체 날짜(YYYY.MM.DD) 또는 월 헤더 + MM-DD 조합, 가격/잔여/항공/기간 문자열 보존.
        """
        script = """
(() => {
  const modal = document.querySelector('[role="dialog"], .ui-dialog, .layer_pop, .pop_layer, #divLayerCalendar, [class*="layer_pop"], [class*="calendar_layer"], .pop_calendar');
  const root = modal || document.body;
  const headText = (root.innerText || '').slice(0, 5000);
  let yPart = '';
  let mPart = '';
  const ymh = headText.match(/(20\\d{2})\\s*[.년\\s/]*\\s*(\\d{1,2})\\s*월?/);
  if (ymh) {
    yPart = ymh[1];
    mPart = String(parseInt(ymh[2], 10)).padStart(2, '0');
  }
  const carriers = '티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|루프트한자|싱가포르항공';
  const carrierRe = new RegExp('(' + carriers + ')');
  const cands = Array.from(root.querySelectorAll('li, tr, div[class*="item"], div[class*="row"], a[href*="ProCode"], div[class*="list"] > div'));
  const out = [];
  for (const el of cands) {
    const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    if (t.length < 10 || t.length > 2500) continue;
    let date = '';
    const dm = t.match(/(20\\d{2})\\s*[.\\-\\/]\\s*(\\d{1,2})\\s*[.\\-\\/]\\s*(\\d{1,2})/);
    if (dm) {
      date = dm[1] + '-' + String(parseInt(dm[2], 10)).padStart(2, '0') + '-' + String(parseInt(dm[3], 10)).padStart(2, '0');
    } else if (yPart) {
      const sm = t.match(/(?:^|\\s)(\\d{1,2})\\s*[.\\-\\/]\\s*(\\d{1,2})(?:\\s|$)/);
      if (sm) {
        const mm = String(parseInt(sm[1], 10)).padStart(2, '0');
        const dd = String(parseInt(sm[2], 10)).padStart(2, '0');
        date = yPart + '-' + mm + '-' + dd;
      }
    }
    if (!date) continue;
    const pm = t.match(/([0-9]{1,3}(?:,[0-9]{3})+)\\s*원/);
    if (!pm) continue;
    const price = parseInt(pm[1].replace(/,/g, ''), 10);
    if (!price || price <= 0) continue;
    let status = '';
    let seatsRaw = '';
    const seatM = t.match(/(\\d+)\\s*석/);
    if (seatM) seatsRaw = seatM[0];
    if (/대기예약/.test(t)) status = '대기예약';
    else if (/예약마감|마감/.test(t)) status = '예약마감';
    else if (/예약가능/.test(t)) status = '예약가능';
    else if (seatsRaw) status = seatsRaw;
    const rangeM = t.match(/20\\d{2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*\\([^)]+\\)\\s*\\d{1,2}:\\d{2}\\s*[~∼～-]\\s*[\\s\\S]{0,120}/);
    const rangeText = rangeM ? rangeM[0].replace(/\\s+/g, ' ').trim() : '';
    let carrierName = '';
    const cm = t.match(carrierRe);
    if (cm) carrierName = cm[1];
    out.push({ date, price, status, seatsStatusRaw: seatsRaw || null, carrierName, departureRangeText: rangeText || null });
  }
  return out;
})()
"""
        try:
            rows = await self._page.evaluate(script)
            if isinstance(rows, list):
                dedup: Dict[str, Dict[str, Any]] = {}
                for r in rows:
                    if not isinstance(r, dict):
                        continue
                    d = str(r.get("date") or "").strip()
                    if not d:
                        continue
                    price = int(r.get("price") or 0)
                    ck = "|".join(
                        [
                            d,
                            str(price),
                            str(r.get("carrierName") or ""),
                            str(r.get("departureRangeText") or "")[:40],
                        ]
                    )
                    if ck not in dedup:
                        dedup[ck] = {
                            "date": d,
                            "price": price,
                            "status": str(r.get("status") or "").strip(),
                            "seatsStatusRaw": r.get("seatsStatusRaw"),
                            "carrierName": (r.get("carrierName") or "").strip(),
                            "departureRangeText": (r.get("departureRangeText") or "").strip() or None,
                        }
                return list(dedup.values())
        except Exception:
            pass
        return []

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


def _emit_stdout_json_utf8(obj: object) -> None:
    """
    관리자 Node(execFile)가 stdout을 UTF-8로 파싱할 때, Windows 기본 콘솔(cp949)로
    한글 JSON이 깨지는 문제 방지: UTF-8 바이트를 그대로 stdout에 기록.
    """
    import sys as _sys

    payload = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
    _sys.stdout.buffer.write(payload)
    _sys.stdout.buffer.write(b"\n")


if __name__ == "__main__":
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    url = (sys.argv[1] or "").strip() if len(sys.argv) > 1 else ""
    if not url or not url.startswith("http"):
        print("Usage: python -m scripts.calendar_e2e_scraper_ybtour.calendar_price_scraper <detail_url>")
        sys.exit(1)
    result = asyncio.run(run_calendar_price_from_url(url, headless=True))
    _emit_stdout_json_utf8(result)
