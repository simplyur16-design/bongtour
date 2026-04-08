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
    "button:has-text('출발일 선택')",
    "a:has-text('출발일 선택')",
    "button:has-text('출발일')",
    "a:has-text('출발일 선택/예약')",
    "[class*='btn']:has-text('출발일')",
]
VERYGOOD_MONTH_NEXT_SELECTORS = [
    ".month_next",
    ".calendar_next",
    "button.next",
    "a.next",
    "button:has-text('다음달')",
    "a:has-text('다음달')",
    "[aria-label*='다음']",
    "[class*='btn_next']",
    "[class*='next_month']",
    "button[title*='다음']",
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
]


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
    """ProductCalendarSearch HTML에서 달력 JSON — lib/verygoodtour-departures.ts parseCalendarJson 과 동일 패턴."""
    patterns = [
        r"var\s+\$calendarProductListJson\s*=\s*(\[[\s\S]*?\]);",
        r"\$calendarProductListJson\s*=\s*(\[[\s\S]*?\]);",
        r"calendarProductListJson\s*=\s*(\[[\s\S]*?\]);",
        r"ProductCalendar\w*Json\s*=\s*(\[[\s\S]*?\]);",
    ]
    for pat in patterns:
        m = re.search(pat, html, re.I)
        if not m:
            continue
        raw = m.group(1)
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                return data
        except Exception:
            continue
    return _extract_calendar_json_array_balanced(html)


def _extract_calendar_json_array_balanced(html: str) -> List[Dict[str, Any]]:
    """
    정규식 non-greedy가 중첩 대괄호/긴 배열에서 잘못 자를 때를 대비해
    $calendarProductListJson = [...] 구간을 괄호 균형으로 잘라 JSON 파싱.
    """
    markers = ("$calendarProductListJson", "calendarProductListJson")
    for mk in markers:
        i = html.find(mk)
        if i < 0:
            continue
        eq = html.find("=", i)
        if eq < 0:
            continue
        j = html.find("[", eq)
        if j < 0:
            continue
        depth = 0
        in_str = False
        esc = False
        for k in range(j, len(html)):
            ch = html[k]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
                continue
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    raw = html[j : k + 1]
                    try:
                        data = json.loads(raw)
                        if isinstance(data, list):
                            return data
                    except Exception:
                        pass
                    break
    return []


def _verygood_calendar_adult_price(v: Dict[str, Any]) -> int:
    ap = v.get("AdultPrice")
    if ap is None:
        return 0
    try:
        s = str(ap).replace(",", "").strip()
        if not s:
            return 0
        return int(float(s))
    except Exception:
        return 0


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
            adult_price = _verygood_calendar_adult_price(v)
            if adult_price <= 0:
                continue
            status_raw = str(v.get("BtnReserveAltTag") or "").strip() or "예약가능"
            seats = None
            rest = v.get("restSeatCount")
            if isinstance(rest, str) and rest.strip().isdigit():
                rest = int(rest.strip())
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
                "price": adult_price,
                "status": status_raw,
                "statusRaw": status_raw,
                "seatsStatusRaw": seats,
                "adultPrice": adult_price,
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
        self.site = "verygoodtour"
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
        # 1순위: 상세 → 출발일 변경 모달 우측 리스트 DOM (사이트 변경 시 ProductCalendarSearch JSON이 빌 수 있음)
        priced_popup: List[Dict[str, Any]] = []
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
            priced_popup = await self._run_verygoodtour_departures()
        except Exception as ex:
            _verygood_log(f"[verygoodtour] modal scrape failed: {ex}")
        with_price = [
            r
            for r in priced_popup
            if int(r.get("adultPrice") or r.get("price") or 0) > 0
        ]
        if with_price:
            _verygood_log(
                f"[verygoodtour] modal rows with price: {len(with_price)} "
                f"(dates {with_price[0].get('date')} … {with_price[-1].get('date')})"
            )
            for r in with_price:
                r.pop("_popupOpened", None)
            return _filter_calendar_rows_kst_floor(
                sorted(with_price, key=lambda x: str(x.get("date", "")))
            )
        try:
            net = scrape_verygood_departures_from_network(detail_url)
            _verygood_log(f"[verygoodtour] network fallback rows: {len(net)}")
            return net
        except Exception as ex2:
            _verygood_log(f"[verygoodtour] network fallback failed: {ex2}")
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
  const modal = document.querySelector('[role="dialog"], .modal, .pop_layer, .layer_pop, .ly_pop, [class*="layer_pop"], [class*="popCal"], [class*="calendar_pop"], .ui-dialog, #divLayerCalendar');
  const root = modal || document.body;
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
  const modal = document.querySelector('[role="dialog"], .modal, .pop_layer, .layer_pop, .ly_pop, [class*="layer_pop"], [class*="popCal"], [class*="calendar_pop"], .ui-dialog, #divLayerCalendar');
  const root = modal || document.body;
  const scrollables = root.querySelectorAll('.scroll_wrap, .list_wrap, [class*="scroll"], ul, .mCustomScrollBox, [style*="overflow-y"]');
  for (const el of scrollables) {
    try { el.scrollTop = el.scrollHeight; } catch (e) {}
  }
}"""
            )
            await self._page.wait_for_timeout(550)
        except Exception:
            pass

    async def _ybtour_read_month_label(self) -> str:
        try:
            ym_el = await self._page.query_selector(
                ".calendar_title, .year_month, [class*='month_tit'], [class*='cal_head'], .cal_head, [class*='CalendarHead']"
            )
            if ym_el:
                return (await ym_el.text_content() or "").strip()[:64]
        except Exception:
            pass
        return ""

    async def _collect_ybtour_calendar_price_index(self) -> List[Dict[str, Any]]:
        """좌측 달력 셀: 일자 + 가격 문구(인덱스·보조 검증)."""
        script = """
() => {
  const modal = document.querySelector('[role="dialog"], .modal, .pop_layer, .layer_pop, .ly_pop, [class*="layer_pop"], [class*="popCal"], [class*="calendar_pop"], [class*="calendarLayer"], .ui-dialog, #divLayerCalendar');
  const root = modal || document.body;
  const tds = root.querySelectorAll(
    '.calendar_wrap td, .cal_wrap td, table.calendar td, .ui-datepicker-calendar td, tbody.cal_body td, [class*="calendar"] table td, .cal td'
  );
  const out = [];
  const seen = new Set();
  for (const td of tds) {
    const raw = (td.innerText || '').replace(/\\s+/g, ' ').trim();
    if (!raw || raw.length > 100) continue;
    const dm = raw.match(/^(\\d{1,2})\\b/);
    if (!dm) continue;
    const day = parseInt(dm[1], 10);
    if (day < 1 || day > 31) continue;
    const key = day + '|' + raw.slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    const looksPrice = /[\\d,]+\\s*원\\~?|[\\d,]+\\s*만\\s*~?|\\d+\\s*만|만\\s*~/.test(raw);
    if (!looksPrice) continue;
    out.push({ calendarDate: day, calendarPriceText: raw.slice(0, 72) });
  }
  return out;
}"""
        try:
            rows = await self._page.evaluate(script)
            return rows if isinstance(rows, list) else []
        except Exception:
            return []

    async def _collect_ybtour_popup_rows(self) -> List[Dict[str, Any]]:
        """모달 우측 리스트 row 전체 후보 — 상품명 비교·제목 정규화 매칭 없음(리스트는 동일 상품 전제)."""
        script = """
() => {
  function layersFromText(raw) {
    const s = String(raw || '').replace(/\\s+/g, ' ').trim();
    const noBadge = s.replace(/^(?:\\[[^\\]]*\\]\\s*)+/, '');
    const preHash = noBadge.split('#')[0].trim();
    const comparisonTitle = preHash.replace(/\\s+/g, ' ').trim();
    const comparisonTitleNoSpace = comparisonTitle.replace(/\\s+/g, '');
    return { rawTitle: s, comparisonTitle, comparisonTitleNoSpace };
  }
  const carriers =
    '티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|스칸디나비아항공|핀에어|루프트한자|싱가포르항공|에티하드|카타르항공|에어뉴질랜드|에어캐나다|유나이티드항공|델타항공|일본항공|중화항공';
  const carrierRe = new RegExp('(' + carriers + ')');
  const modal = document.querySelector('[role="dialog"], .modal, .pop_layer, .layer_pop, .ly_pop, [class*="layer_pop"], [class*="popCal"], [class*="calendarLayer"], .ui-dialog');
  const root = modal || document.body;
  const cands = Array.from(
    root.querySelectorAll('li, tr, div[class*="item"], div[class*="row"], div[class*="card"], div[class*="list"] > div, a[href*="goods"]')
  );
  const out = [];
  for (const el of cands) {
    const full = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    if (full.length < 15 || full.length > 3500) continue;
    let titleRaw = '';
    const te = el.querySelector('strong, .tit, .title, [class*="subject"], [class*="goods_name"], em');
    if (te) titleRaw = (te.innerText || '').replace(/\\s+/g, ' ').trim();
    if (!titleRaw || titleRaw.length < 4) {
      const lines = full.split(/[\\n\\r|]/).map((x) => x.trim()).filter(Boolean);
      titleRaw = lines.length ? lines[0] : full.slice(0, 120);
    }
    const tl = layersFromText(titleRaw);
    const priceM = full.match(/([0-9]{1,3}(?:,[0-9]{3})+)\\s*원\\~?/);
    if (!priceM) continue;
    const price = parseInt(priceM[1].replace(/,/g, ''), 10);
    if (!price || price <= 0) continue;
    const rangeM = full.match(
      /20\\d{2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*\\([^)]+\\)\\s*\\d{1,2}:\\d{2}\\s*[-–—~∼～]\\s*20\\d{2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*[.\\-\\/]\\s*\\d{1,2}\\s*\\([^)]+\\)\\s*\\d{1,2}:\\d{2}/
    );
    const departureRangeText = rangeM ? rangeM[0].replace(/\\s+/g, ' ').trim() : '';
    let date = '';
    const dm = departureRangeText.match(/(20\\d{2})\\s*[.\\-\\/]\\s*(\\d{1,2})\\s*[.\\-\\/]\\s*(\\d{1,2})/);
    if (dm) {
      date =
        dm[1] +
        '-' +
        String(parseInt(dm[2], 10)).padStart(2, '0') +
        '-' +
        String(parseInt(dm[3], 10)).padStart(2, '0');
    }
    if (!date) continue;
    const tripM = full.match(/(\\d+)\\s*박\\s*(\\d+)\\s*일/);
    const tripNightsDaysText = tripM ? tripM[0] : '';
    let airlineName = '';
    const cm = full.match(carrierRe);
    if (cm) airlineName = cm[1];
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
      priceText: priceM[0],
      badgesText,
      rowSummaryText: full.slice(0, 400),
    });
  }
  return out;
}
"""
        try:
            rows = await self._page.evaluate(script)
            return rows if isinstance(rows, list) else []
        except Exception:
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
            await self._page.wait_for_timeout(700)
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
        for mi in range(DEFAULT_CALENDAR_MONTH_LIMIT if opened else 0):
            ym = await self._ybtour_read_month_label()
            cal_cells = await self._collect_ybtour_calendar_price_index()
            priced_days = len(cal_cells)
            samp = [c.get("calendarPriceText") for c in cal_cells[:4]]
            _ybtour_modal_log(
                f"phase=calendar monthKey={ym!r} pricedDays={priced_days} samplePrices={samp!r}"
            )

            await self._scroll_ybtour_popup_list()
            await human_delay(0.35, 0.75)
            batch = await self._collect_ybtour_popup_rows()
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

            moved = False
            move_src = ""
            for nsel in YBTOUR_MONTH_NEXT_SELECTORS:
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
                    moved = True
                    move_src = nsel[:88]
                    break
                except Exception:
                    continue
            _ybtour_modal_log(
                f"phase=move-month monthRound={mi + 1} success={moved} source={move_src!r}"
            )
            if not moved:
                stop_reason = "next-month-control-unavailable-or-disabled"
                break
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
        for mi in range(DEFAULT_CALENDAR_MONTH_LIMIT):
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
                    "outboundFlightNo": (str(item.get("flightNo") or "").strip() or shared.get("outboundFlightNo")),
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
  const modalSel = '[role="dialog"], .ui-dialog, .layer_pop, .pop_layer, #divLayerCalendar, [class*="layer_pop"], [class*="calendar_layer"], .pop_calendar, [class*="q-dialog"], [class*="calendar_wrap"], [class*="leaveLayer"], [class*="LayerCalendar"], [class*="modal"]';
  const modal = document.querySelector(modalSel);
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
  const modalSel = '[role="dialog"], .ui-dialog, .layer_pop, .pop_layer, #divLayerCalendar, [class*="layer_pop"], [class*="calendar_layer"], .pop_calendar, [class*="q-dialog"], [class*="calendar_wrap"], [class*="leaveLayer"], [class*="LayerCalendar"], [class*="modal"]';
  const modal = document.querySelector(modalSel);
  const root = modal || document.body;
  const headText = (root.innerText || '').slice(0, 5000);
  let yPart = '';
  let mPart = '';
  const ymh = headText.match(/(20\\d{2})\\s*[.년\\s/]*\\s*(\\d{1,2})\\s*월?/);
  if (ymh) {
    yPart = ymh[1];
    mPart = String(parseInt(ymh[2], 10)).padStart(2, '0');
  }
  const carriers = '티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|루프트한자|싱가포르항공|에어부산항공|에어캐나다|델타항공|유나이티드항공|에뉴질랜드|핀에어';
  const carrierRe = new RegExp('(' + carriers + ')');
  const cands = Array.from(root.querySelectorAll(
    'li, tr, tbody tr, div[class*="item"], div[class*="row"], a[href*="ProCode"], div[class*="list"] > div, div[class*="departure"], div[class*="card"], [class*="schedule"] > div, [class*="leave"] div[class*="list"] > *'
  ));
  const out = [];
  for (const el of cands) {
    const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    if (t.length < 8 || t.length > 2500) continue;
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
    let price = 0;
    let pm = t.match(/([0-9]{1,3}(?:,[0-9]{3})+)\\s*원~?/);
    if (!pm) pm = t.match(/([0-9]{1,3}(?:,[0-9]{3})+)\\s*원\\s*~/);
    if (!pm) pm = t.match(/([0-9]{4,7})\\s*원~?/);
    if (!pm) pm = t.match(/([0-9]{4,7})\\s*원\\s*~/);
    if (pm) {
      price = parseInt(pm[1].replace(/,/g, ''), 10);
    } else {
      const m2 = t.match(/(\\d{1,3}(?:,\\d{3})*)\\s*만\\s*(?:원)?~?/);
      if (m2) price = parseInt(m2[1].replace(/,/g, ''), 10) * 10000;
    }
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
    let flightNo = '';
    const fn = t.match(/\\b([A-Z]{2}\\d{3,4})\\b/);
    if (fn) flightNo = fn[1];
    out.push({ date, price, status, seatsStatusRaw: seatsRaw || null, carrierName, departureRangeText: rangeText || null, flightNo: flightNo || null });
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
                            "flightNo": (r.get("flightNo") or "").strip() or None,
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


if __name__ == "__main__":
    import json
    import sys
    url = (sys.argv[1] or "").strip() if len(sys.argv) > 1 else ""
    if not url or not url.startswith("http"):
        print("Usage: python -m scripts.calendar_e2e_scraper_verygoodtour.calendar_price_scraper <detail_url>")
        sys.exit(1)
    result = asyncio.run(run_calendar_price_from_url(url, headless=True))
    print(json.dumps(result, ensure_ascii=False, indent=2))
