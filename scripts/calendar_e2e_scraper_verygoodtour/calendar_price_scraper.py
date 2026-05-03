# -*- coding: utf-8 -*-
"""
참좋은여행(verygoodtour) 달력 + 출발일 변경 **일정행** 기준.
- 네트워크 JSON 경로: 월별 `ProductCalendarSearch` + 상세 1회(패키지 제목·N박M일 베이스만).
- 같은 일정행: **MasterCode 접두 + N박M일 일치** + **상품명 전체 일치**(상세 preHash vs 행 ProductName, 공백 정규화).
- 행에서 채움: 출발·귀국 일시, 가격, 예약가능 문구, 항공사 등.
- 모달 일정 리스트는 스크롤 가능 → Playwright 경로에서 `_scroll_verygood_popup_list` 로 끝까지 스크롤.
- 출발일·금액 수집 하한: KST **오늘 +3일**(`_kst_verygood_departure_floor_ymd`) 미만 제외.
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

from scripts.shared.airline_encoding_fix import fix_airline_name_str, fix_mojibake_korean_str

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

_LEADING_BADGE_RE_VG = re.compile(r"^(?:\[[^\]]*\]\s*)+")
_VERYGOOD_PROMO_BLOCK_RE = re.compile(
    r"^[★☆♥♡✦•●◆□▪❤♪♫♬♭♮♯][^★☆♥♡✦•●◆□▪❤♪♫♬♭♮♯#\n]{0,80}[★☆♥♡✦•●◆□▪❤♪♫♬♭♮♯]\s*"
)
_VERYGOOD_LEADING_SPECIAL_RE = re.compile(r"^[★☆♥♡✦•●◆□▪❤♪♫♬♭♮♯\s]+")


def _verygood_strip_tags(html: str) -> str:
    t = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", t).strip()


def _verygood_detail_title_raw(detail_html: str) -> str:
    m = re.search(r'<h3[^>]*class="[^"]*package-title[^"]*"[^>]*>([\s\S]*?)</h3>', detail_html, re.I)
    if m:
        return m.group(1)
    og = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', detail_html, re.I)
    if og:
        return og.group(1)
    m2 = re.search(r"<title[^>]*>([\s\S]*?)</title>", detail_html, re.I)
    return (m2.group(1) if m2 else "") or ""


def _verygood_title_pre_hash(raw: str) -> str:
    t = _verygood_strip_tags(raw)
    t = _LEADING_BADGE_RE_VG.sub("", t)
    t = _VERYGOOD_PROMO_BLOCK_RE.sub("", t).strip()
    t = _VERYGOOD_LEADING_SPECIAL_RE.sub("", t).strip()
    return (t.split("#")[0] or "").strip()


def _verygood_nm_from_text(blob: str) -> Optional[tuple[int, int]]:
    m = re.search(r"(\d+)\s*박\s*(\d+)\s*일", blob or "")
    if not m:
        return None
    n, d = int(m[1]), int(m[2])
    if n < 0 or d < 1 or d < n:
        return None
    return (n, d)


def _verygood_trip_label_from_json(v: Dict[str, Any]) -> Optional[str]:
    def pos_int(x: Any) -> Optional[int]:
        try:
            n = int(x)
            return n if n > 0 else None
        except (TypeError, ValueError):
            return None

    n = pos_int(v.get("TripNight")) or pos_int(v.get("TourNight")) or pos_int(v.get("NightCount"))
    d = pos_int(v.get("TripDay")) or pos_int(v.get("TourDay")) or pos_int(v.get("DayCount"))
    if n is not None and d is not None and d >= n:
        return f"{n}박{d}일"
    return None


def _verygood_calendar_json_haystack(v: Dict[str, Any]) -> str:
    parts: List[str] = []
    for val in v.values():
        if isinstance(val, str) and val.strip():
            parts.append(val.strip())
    return "\n".join(parts)


def _verygood_row_primary_nm(v: Dict[str, Any], row_title: str) -> Optional[tuple[int, int]]:
    """JSON → 행 제목 → 행 전체 문자열 순으로 N박M일(첫 유효값). 불일치 탈락 없음."""
    j = _verygood_trip_label_from_json(v)
    if j:
        p = _verygood_nm_from_text(j)
        if p:
            return p
    p = _verygood_nm_from_text(row_title)
    if p:
        return p
    return _verygood_nm_from_text(_verygood_calendar_json_haystack(v))


def _verygood_detail_nm_and_title_front(detail_html: str) -> tuple[Optional[tuple[int, int]], str]:
    raw_title = _verygood_detail_title_raw(detail_html)
    pre = _verygood_title_pre_hash(raw_title)
    trip = _verygood_nm_from_text(pre)
    if trip is None:
        trip = _verygood_nm_from_text(_verygood_strip_tags(detail_html))
    return trip, pre


def _verygood_product_name_exact(detail_pre: str, row_title: str) -> bool:
    d = re.sub(r"\s+", " ", (detail_pre or "").strip())
    r = re.sub(r"\s+", " ", _verygood_title_pre_hash(row_title).strip())
    d = fix_mojibake_korean_str(d) or d
    r = fix_mojibake_korean_str(r) or r
    return bool(d) and bool(r) and d == r


def _kst_today_ymd() -> str:
    return dt.datetime.now(_KST).strftime("%Y-%m-%d")


def _kst_verygood_departure_floor_ymd() -> str:
    """KST 오늘 +3일부터 출발·금액 수집 (4/11 → 4/14)."""
    return (dt.datetime.now(_KST).date() + dt.timedelta(days=3)).strftime("%Y-%m-%d")


def _kst_month_start() -> dt.date:
    d = dt.datetime.now(_KST).date()
    return d.replace(day=1)


def _filter_calendar_rows_kst_floor(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    floor = _kst_verygood_departure_floor_ymd()
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = str(r.get("date") or "").strip()[:10]
        if len(d) == 10 and d >= floor:
            out.append(r)
    return out


# 명세: 화살표/로딩 대기 딜레이
DELAY_MIN = 0.5
DELAY_MAX = 0.5
SLIDE_WAIT_MS = 1000
MONTH_WAIT_MS = 1000

VERYGOOD_POPUP_OPEN_SELECTORS = [
    "a.btn.small.jq_cl_dayChange",
    "a.jq_cl_dayChange",
    "button:has-text('출발일변경')",
    "a:has-text('출발일변경')",
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
    "a.date_arr.date_next.jq_cl_moveMonth",
    "a.jq_cl_moveMonth.date_next",
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
VERYGOOD_MODAL_WAIT_SELECTORS = [
    ".ui-dialog.ui-widget",
    ".ui-dialog .pop_wrap.layer_pop",
    ".dep_left_wrap",
    ".dep_right_wrap",
    "[role='dialog']",
]


def _verygood_log(msg: str) -> None:
    """관리자 subprocess는 stdout=JSON 이므로 진단은 stderr."""
    print(msg, file=__import__("sys").stderr, flush=True)


def _verygood_phase_always(phase: str, detail: str = "") -> None:
    """환경과 무관하게 stderr phase 한 줄 (운영 로그·Node 진단용)."""
    d = (detail or "").strip()
    if d:
        _verygood_log(f"[verygoodtour] phase={phase} {d}")
    else:
        _verygood_log(f"[verygoodtour] phase={phase}")


def _verygood_detail_url_summary(detail_url: str) -> str:
    try:
        p = urllib.parse.urlparse(detail_url)
        host = p.netloc or "—"
        path = (p.path or "—")[:96]
        q = urllib.parse.parse_qs(p.query)
        pc = (q.get("ProCode") or q.get("procode") or [None])[0]
        ps = (q.get("PriceSeq") or q.get("priceseq") or [None])[0]
        c = str(pc)[:48] if pc else "—"
        s = str(ps)[:12] if ps else "—"
        return f"host={host} path={path} ProCode={c} PriceSeq={s}"
    except Exception:
        return "host=? url_parse_error"


# 좌측 td.jq_cl_day + 우측 li.jq_cl_detailViewBtn 일괄 (명세 DOM)
VERYGOOD_MODAL_DOM_BUNDLE_JS = r"""
() => {
  const dialog =
    document.querySelector('.ui-dialog.ui-widget') ||
    document.querySelector('.ui-dialog.ui-widget-content') ||
    document.querySelector('.ui-dialog') ||
    document.querySelector('[role="dialog"]');
  const pop = dialog ? (dialog.querySelector('.pop_wrap.layer_pop') || dialog) : null;
  const root = pop || document.body;
  const left = root.querySelector('.dep_left_wrap') || root;
  const dateTxtEl =
    root.querySelector('span.date_txt') ||
    left.querySelector('span.date_txt') ||
    document.querySelector('.dep_left_wrap span.date_txt');
  const dtRaw = dateTxtEl ? String(dateTxtEl.innerText || '').replace(/\s+/g, '').trim() : '';
  let y = '';
  let mo = '';
  const dtM = dtRaw.match(/^(20\d{2})\.(\d{1,2})$/);
  if (dtM) {
    y = dtM[1];
    mo = String(parseInt(dtM[2], 10)).padStart(2, '0');
  }
  const leftCells = [];
  if (y && mo) {
    for (const td of left.querySelectorAll('td.jq_cl_day')) {
      const raw = (td.innerText || '').replace(/\s+/g, ' ').trim();
      const mm = raw.match(/^(\d{1,2})(?:\s+(\d+)\s*만원~?)?$/);
      if (!mm) continue;
      const day = parseInt(mm[1], 10);
      const man = mm[2] ? parseInt(mm[2], 10) : 0;
      const iso = y + '-' + mo + '-' + String(day).padStart(2, '0');
      leftCells.push({ date: iso, approxPrice: man > 0 ? man * 10000 : 0, raw });
    }
  }
  const right = root.querySelector('.dep_right_wrap') || root;
  const carriers =
    '에미레이트항공|에미레이트|튀르키예항공|터키항공|카타르항공|카타르|' +
    '에티하드항공|에티하드|영국항공|싱가포르항공|태국항공|베트남항공|티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|' +
    '에어프레미아|플라이강원|루프트한자|에어부산항공|에어캐나다|델타항공|유나이티드항공|에뉴질랜드|핀에어|ANA|전일본공수';
  const carrierRe = new RegExp('(' + carriers + ')');
  const rightRows = [];
  for (const li of right.querySelectorAll('li.jq_cl_detailViewBtn')) {
    const t = (li.innerText || '').replace(/\s+/g, ' ').trim();
    if (t.length < 8 || t.length > 2500) continue;
    let price = 0;
    const pw =
      li.querySelector('.price_wrap.fs18.mr0') ||
      li.querySelector('.price_wrap.fs18') ||
      li.querySelector('.price_wrap');
    if (pw) {
      const ptx = (pw.innerText || '').replace(/\s+/g, ' ');
      let pm = ptx.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
      if (!pm) pm = ptx.match(/([0-9]{4,9})\s*원/);
      if (pm) price = parseInt(pm[1].replace(/,/g, ''), 10);
    }
    let date = '';
    const dm = t.match(/(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/);
    if (dm) {
      date =
        dm[1] +
        '-' +
        String(parseInt(dm[2], 10)).padStart(2, '0') +
        '-' +
        String(parseInt(dm[3], 10)).padStart(2, '0');
    } else if (y && mo) {
      const sm = t.match(/(?:^|\s)(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?:\s|$)/);
      if (sm) {
        const mm = String(parseInt(sm[1], 10)).padStart(2, '0');
        const dd = String(parseInt(sm[2], 10)).padStart(2, '0');
        date = y + '-' + mm + '-' + dd;
      }
    }
    if (!date) continue;
    if (!price || price <= 0) continue;
    let status = '';
    let seatsRaw = '';
    const seatM = t.match(/(\d+)\s*석/);
    if (seatM) seatsRaw = seatM[0];
    if (!seatsRaw) {
      const jm = t.match(/잔여\s*(\d+)/);
      if (jm) seatsRaw = '잔여' + jm[1];
    }
    if (/대기예약/.test(t)) status = '대기예약';
    else if (/예약마감|마감/.test(t)) status = '예약마감';
    else if (/예약가능/.test(t)) status = '예약가능';
    else if (seatsRaw) status = seatsRaw;
    const rangeM = t.match(
      /20\d{2}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2}\s*\([^)]+\)\s*\d{1,2}:\d{2}\s*[~∼～-]\s*[\s\S]{0,120}/
    );
    const rangeText = rangeM ? rangeM[0].replace(/\s+/g, ' ').trim() : '';
    let carrierName = '';
    const cm = t.match(carrierRe);
    if (cm) carrierName = cm[1];
    let flightNo = '';
    const fn = t.match(/\b([A-Z]{2}\d{3,4})\b/);
    if (fn) flightNo = fn[1];
    rightRows.push({
      date,
      price,
      status,
      seatsStatusRaw: seatsRaw || null,
      carrierName,
      departureRangeText: rangeText || null,
      flightNo: flightNo || null,
    });
  }
  return { ym: dtRaw, leftCells, rightRows };
}
"""


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


def _verygood_pad_hhmm(hhmm: str) -> str:
    t = (hhmm or "").strip()
    m = re.match(r"^(\d{1,2}):(\d{2})$", t)
    if not m:
        return t
    return f"{int(m.group(1)):02d}:{m.group(2)}"


def _verygood_norm_ymd(s: str) -> Optional[str]:
    t = (s or "").strip()
    if not t:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", t)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{4})\.(\d{2})\.(\d{2})$", t)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2})$", t)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return None


def _verygood_row_string_haystack(v: Dict[str, Any]) -> str:
    parts: List[str] = []
    for x in v.values():
        if isinstance(x, str) and x.strip():
            parts.append(x.strip())
    return "\n".join(parts)


def _verygood_try_combined_schedule_range(v: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """
    리스트 한 줄: `2026.07.14(화) 23:40 ~ 2026.07.23(목) 17:00 | 7박10일`
    분리 JSON 필드가 비었을 때 보조.
    """
    hay = _verygood_row_string_haystack(v)
    if not hay:
        return None
    m = re.search(
        r"(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?:\s*\([^)]*\))?\s+(\d{1,2}):(\d{2})\s*~\s*"
        r"(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?:\s*\([^)]*\))?\s+(\d{1,2}):(\d{2})",
        hay,
    )
    if not m:
        return None
    y1, mo1, d1, h1, mi1, y2, mo2, d2, h2, mi2 = m.groups()
    return {
        "departure_date": f"{y1}-{mo1}-{d1}",
        "dep_time": _verygood_pad_hhmm(f"{int(h1)}:{mi1}"),
        "arrival_date": f"{y2}-{mo2}-{d2}",
        "arr_time": _verygood_pad_hhmm(f"{int(h2)}:{mi2}"),
    }


# 본문/모달 텍스트에서 항공사명 후보 (긴 이름을 앞에 두어 우선 매칭)
_VERYGOOD_CARRIER_PATTERN = (
    r"(에미레이트항공|에미레이트|튀르키예항공|터키항공|카타르항공|카타르|"
    r"에티하드항공|에티하드|영국항공|싱가포르항공|태국항공|베트남항공|"
    r"티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|"
    r"에어프레미아|플라이강원|루프트한자|에어캐나다|델타항공|유나이티드항공|"
    r"에뉴질랜드|핀에어|ANA|전일본공수)"
)


def _verygood_calendar_rest_seat_int(v: Dict[str, Any]) -> Optional[int]:
    rest = v.get("restSeatCount")
    if isinstance(rest, bool):
        return None
    if isinstance(rest, int) and rest >= 0:
        return rest
    if isinstance(rest, str) and rest.strip().isdigit():
        return int(rest.strip())
    return None


def _verygood_modal_remain_seats_int(item: Dict[str, Any], status_raw: str) -> Optional[int]:
    """모달 DOM row에서 잔여석 정수 — 숫자 없으면 None (8필드 완전성 위해 행 제외)."""
    ss = item.get("seatsStatusRaw")
    if isinstance(ss, str) and ss.strip():
        m = re.search(r"잔여\s*(\d+)", ss)
        if m:
            return int(m.group(1))
        m2 = re.search(r"(\d+)\s*석", ss)
        if m2:
            return int(m2.group(1))
    if re.search(r"마감|예약\s*마감|예약마감|불가", status_raw or ""):
        return 0
    return None


def _verygood_attach_canonical_row_fields(
    row: Dict[str, Any],
    *,
    departure_date: str,
    departure_time: str,
    return_date: str,
    return_time: str,
    price: int,
    remain_seats: Optional[int],
    booking_status: str,
    airline_name: Optional[str],
) -> None:
    """저장·검증용 표준 8필드 키(항상 동일 row dict에 병기)."""
    row["airlineName"] = airline_name
    row["departureDate"] = departure_date
    row["departureTime"] = departure_time
    row["returnDate"] = return_date
    row["returnTime"] = return_time
    row["price"] = price
    row["remainSeats"] = remain_seats
    row["bookingStatus"] = booking_status
    row["seatCount"] = remain_seats


def _verygood_calendar_optional_int_price(v: Dict[str, Any], *keys: str) -> Optional[int]:
    for k in keys:
        raw = v.get(k)
        if raw is None:
            continue
        try:
            s = str(raw).replace(",", "").strip()
            if not s:
                continue
            n = int(float(s))
            if n > 0:
                return n
        except Exception:
            continue
    return None


def _verygood_modal_schedule_from_range(
    range_text: Optional[str], row_date_iso: str
) -> Dict[str, Optional[str]]:
    """
    모달 행의 departureRangeText(출발~귀국 한 줄)만으로 일정을 만든다.
    본문/상세 HTML·shared 보강 없음 — 파싱 실패 시 null.
    """
    out_dep: Optional[str] = None
    in_arr: Optional[str] = None
    rt = (range_text or "").strip().replace("～", "~").replace("∼", "~")
    if rt:
        m = re.search(
            r"(20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*(?:\([^)]*\))?\s*"
            r"(\d{1,2})\s*:\s*(\d{2})\s*[~～∼\-]\s*"
            r"(20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*(?:\([^)]*\))?\s*"
            r"(\d{1,2})\s*:\s*(\d{2})",
            rt,
        )
        if m:
            y1, mo1, d1, h1, mi1, y2, mo2, d2, h2, mi2 = m.groups()
            parsed_start = f"{y1}-{int(mo1):02d}-{int(d1):02d}"
            out_dep = f"{parsed_start} {int(h1):02d}:{mi1}"
            in_arr = f"{y2}-{int(mo2):02d}-{int(d2):02d} {int(h2):02d}:{mi2}"
            # 행 출발일과 범위 문자열 앞날짜가 어긋나면(인접 행 텍스트 누수) 본문 shared 대신
            # **행 출발일 + 범위에서 읽은 시각**으로 맞춤 — 본문 기본 일정으로 덮어쓰지 않음.
            if re.match(r"^\d{4}-\d{2}-\d{2}$", row_date_iso) and parsed_start != row_date_iso:
                out_dep = f"{row_date_iso} {int(h1):02d}:{mi1}"
                # 귀국일이 출발일보다 앞이면(잘못 붙은 문자열) 본문 shared로 되돌리지 않고 비움
                if in_arr and in_arr[:10] < row_date_iso:
                    in_arr = None
    return {"outboundDepartureAt": out_dep, "inboundArrivalAt": in_arr}


def _verygood_flight_pair_from_texts(*chunks: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    blob = " ".join((c or "").strip() for c in chunks if c)
    flights = re.findall(r"\b([A-Z]{2}\d{3,4})\b", blob)
    if not flights:
        return None, None
    if len(flights) == 1:
        return flights[0], None
    return flights[0], flights[-1]


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
    carrier = re.search(_VERYGOOD_CARRIER_PATTERN, txt)
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
    menu_code = (q.get("MenuCode") or q.get("menuCode") or ["leaveLayer"])[0].strip() or "leaveLayer"
    if not procode:
        return []
    master_code = procode.split("-")[0].strip()
    # 달력 JSON + 상세 1회(패키지 제목·N박M일)로 일정행 필터. 본문 shared 보강 없음.

    detail_html = ""
    try:
        detail_html = _http_get_text(detail_url, referer=detail_url)
    except Exception:
        pass
    base_trip, base_title_front = _verygood_detail_nm_and_title_front(detail_html)

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
            if date < _kst_verygood_departure_floor_ymd():
                continue
            adult_price = _verygood_calendar_adult_price(v)
            if adult_price <= 0:
                continue
            row_pc = str(v.get("ProductCode") or "").strip()
            if row_pc and master_code and not row_pc.upper().startswith(master_code.upper()):
                continue
            row_title_raw = str(v.get("ProductName") or v.get("ProductTitle") or v.get("Title") or "").strip()
            row_title = fix_mojibake_korean_str(row_title_raw) or row_title_raw
            has_trip = base_trip is not None
            has_title = bool((base_title_front or "").strip())
            if has_trip or has_title:
                if has_trip:
                    row_nm = _verygood_row_primary_nm(v, row_title)
                    if not row_nm or tuple(row_nm) != tuple(base_trip):
                        continue
                if has_title:
                    if not _verygood_product_name_exact(base_title_front, row_title):
                        continue
            _btn = str(v.get("BtnReserveAltTag") or "").strip() or "예약가능"
            status_raw = fix_mojibake_korean_str(_btn) or _btn
            trans_code = str(v.get("TransCode") or "").strip()
            trans_num = str(v.get("TransNumber") or "").strip().replace(" ", "")
            dep_time = _verygood_pad_hhmm(str(v.get("DepartureDepartureTime") or "").strip())
            arr_time = _verygood_pad_hhmm(str(v.get("ArrivalArrivalTime") or "").strip())
            arr_date = str(v.get("ArrivalDateToShortString") or "").strip()
            tn = str(v.get("TrasnName") or "").strip()
            comb = _verygood_try_combined_schedule_range(v)
            dep_norm = _verygood_norm_ymd(date)
            if comb and dep_norm:
                c0 = _verygood_norm_ymd(comb["departure_date"])
                if c0 == dep_norm:
                    if not dep_time:
                        dep_time = comb["dep_time"]
                    if not arr_date:
                        arr_date = comb["arrival_date"]
                    if not arr_time:
                        arr_time = comb["arr_time"]
            # 출발·귀국 일시: 셋 다 없을 때만 버림. 일부만 없으면 null 허용.
            if not tn:
                tn = "미표기"
            if not dep_time and not arr_date and not arr_time:
                continue
            out_dep_at = f"{date} {dep_time}" if dep_time else None
            in_arr_at = f"{arr_date} {arr_time}" if arr_date and arr_time else None
            rest_int = _verygood_calendar_rest_seat_int(v)
            if rest_int is None:
                if re.search(r"마감|예약\s*마감|예약마감|불가", status_raw):
                    rest_int = 0
            seats = f"잔여{rest_int}" if rest_int is not None else "좌석수미표기"
            child_bed = _verygood_calendar_optional_int_price(
                v, "ChildPrice", "SaleChildPrice", "ChildBedPrice", "ChildBedAmt"
            )
            child_no_bed = _verygood_calendar_optional_int_price(
                v, "ChildNoBedPrice", "ChildNoBedAmt", "SaleChildNoBedPrice"
            )
            infant = _verygood_calendar_optional_int_price(
                v, "InfantPrice", "BabyPrice", "InfantAmt", "SaleInfantPrice"
            )
            row = {
                "date": date,
                "price": adult_price,
                "status": status_raw,
                "statusRaw": status_raw,
                "seatsStatusRaw": seats,
                "adultPrice": adult_price,
                "childBedPrice": child_bed,
                "childNoBedPrice": child_no_bed,
                "infantPrice": infant,
                "localPriceText": None,
                "minPax": int(v.get("MinCount")) if str(v.get("MinCount") or "").isdigit() else None,
                "carrierName": fix_airline_name_str(tn),
                "outboundFlightNo": (f"{trans_code}{trans_num}" if trans_code and trans_num else None),
                "outboundDepartureAirport": None,
                "outboundDepartureAt": out_dep_at,
                "outboundArrivalAirport": None,
                "outboundArrivalAt": None,
                "inboundFlightNo": None,
                "inboundDepartureAirport": None,
                "inboundDepartureAt": None,
                "inboundArrivalAirport": None,
                "inboundArrivalAt": in_arr_at,
                "meetingInfoRaw": None,
                "meetingPointRaw": None,
                "meetingTerminalRaw": None,
                "meetingGuideNoticeRaw": None,
            }
            _verygood_attach_canonical_row_fields(
                row,
                departure_date=date,
                departure_time=dep_time,
                return_date=arr_date,
                return_time=arr_time,
                price=adult_price,
                remain_seats=rest_int,
                booking_status=status_raw,
                airline_name=row["carrierName"],
            )
            key = f"{date}|{v.get('ProductCode')}|{v.get('PriceSeq')}"
            merged[key] = row
    return _filter_calendar_rows_kst_floor(
        sorted(list(merged.values()), key=lambda x: x.get("date", ""))
    )


class CalendarPriceScraper:
    """
    참좋은여행(verygoodtour) 달력 + 출발일 변경 **일정행**(모달 우측 스크롤 리스트).
    - 모달 열린 뒤 `_scroll_verygood_popup_list` 로 리스트 끝까지 스크롤 후 DOM에서 행 수집.
    - 네트워크 JSON 경로(`scrape_verygood_departures_from_network`)는 월별 캘린더 JSON + 상세 1회로 N박M일·제목 앞부분 필터.
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
            _verygood_phase_always("browser-launching", "playwright_ready")
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
            _verygood_phase_always("script-entry", "no_page")
            _verygood_phase_always("process-exit", "no_page")
            return []
        summ = _verygood_detail_url_summary(detail_url)
        _verygood_phase_always("script-entry", summ)
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
            _verygood_phase_always("page-navigated", summ)
            priced_popup = await self._run_verygoodtour_departures()
        except Exception as ex:
            _verygood_log(f"[verygoodtour] modal scrape failed: {ex}")
        finally:
            _verygood_phase_always("process-exit", summ)
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

    async def _verygood_eval_modal_bundle_py(self) -> Dict[str, Any]:
        try:
            data = await self._page.evaluate(VERYGOOD_MODAL_DOM_BUNDLE_JS)
            if isinstance(data, dict):
                return data
        except Exception:
            pass
        return {"ym": "", "leftCells": [], "rightRows": []}

    async def _verygood_wait_month_label_changed(self, prev_norm: str) -> None:
        if not self._page:
            return
        prev = re.sub(r"\s+", "", (prev_norm or "").strip())[:32]
        fb_ms = int(getattr(config, "VERYGOOD_E2E_MONTH_NAV_POST_MS", 1500) or 1500)
        timeout_ms = int(getattr(config, "VERYGOOD_E2E_MONTH_HEADER_TIMEOUT_MS", 5000) or 5000)
        if not prev:
            await self._page.wait_for_timeout(fb_ms)
            return
        js = (
            "(p) => {\n"
            "  const el = document.querySelector('.ui-dialog span.date_txt, .dep_left_wrap span.date_txt, span.date_txt');\n"
            "  const cur = el ? String(el.innerText || '').replace(/\\s+/g, '').trim().slice(0, 32) : '';\n"
            "  return cur && cur !== p && /20\\d{2}\\.\\d{1,2}/.test(cur);\n"
            "}"
        )
        try:
            await self._page.wait_for_function(js, arg=prev, timeout=timeout_ms)
        except Exception:
            await self._page.wait_for_timeout(min(fb_ms, timeout_ms))

    async def _run_verygoodtour_departures(self) -> List[Dict[str, Any]]:
        """
        참좋은여행 전용:
        1) 출발일 변경(단순 click) → .ui-dialog / .pop_wrap.layer_pop 대기
        2) 좌측 td.jq_cl_day(만원~) + 우측 li.jq_cl_detailViewBtn(원) 일괄 추출 후 dedupe
        3) 다음달 a.date_next.jq_cl_moveMonth → span.date_txt 변경 대기 + 보조 sleep
        """
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
        if opened:
            modal_ms = int(getattr(config, "VERYGOOD_E2E_MODAL_VISIBLE_MS", 15000) or 15000)
            for msel in VERYGOOD_MODAL_WAIT_SELECTORS:
                try:
                    await self._page.wait_for_selector(
                        msel, state="visible", timeout=min(12000, modal_ms)
                    )
                    _verygood_phase_always("modal-opened", msel)
                    break
                except Exception:
                    continue
        scroll_passes = int(getattr(config, "VERYGOOD_E2E_RIGHT_SCROLL_PASSES", 2) or 2)
        post_nav = int(getattr(config, "VERYGOOD_E2E_MONTH_NAV_POST_MS", 1500) or 1500)
        rows: Dict[str, Dict[str, Any]] = {}
        e2e_month_limit = int(getattr(config, "VERYGOOD_E2E_MONTH_LIMIT", 12) or 12)

        for mi in range(e2e_month_limit):
            mo_phase = mi + 1
            _verygood_phase_always(f"verygood-month-{mo_phase}-collect-start", "")
            rows_before_month = len(rows)
            spec = await self._verygood_eval_modal_bundle_py()
            prev_ym = re.sub(r"\s+", "", str(spec.get("ym") or "").strip())[:32]
            left_cells = spec.get("leftCells") if isinstance(spec.get("leftCells"), list) else []
            by_left: Dict[str, Dict[str, Any]] = {}
            for c in left_cells:
                if isinstance(c, dict):
                    ds = str(c.get("date") or "").strip()[:10]
                    if len(ds) == 10:
                        by_left[ds] = c
            for _ in range(max(1, scroll_passes)):
                await self._scroll_verygood_popup_list()
            rlist = spec.get("rightRows") if isinstance(spec.get("rightRows"), list) else []
            if not rlist:
                rlist = await self._collect_verygood_popup_rows()
            for item in rlist:
                if not isinstance(item, dict):
                    continue
                date = item.get("date")
                if not date:
                    continue
                price_v = int(item.get("price") or 0)
                d10 = str(date).strip()[:10]
                if len(d10) == 10 and d10 in by_left:
                    approx = int(by_left[d10].get("approxPrice") or 0)
                    if approx > 0 and price_v > 0:
                        rel = abs(approx - price_v) / max(price_v, 1)
                        if rel > 0.12:
                            _verygood_phase_always(
                                "price-hint-mismatch",
                                f"date={d10} leftApproxWon={approx} rightExactWon={price_v}",
                            )
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
                f"[verygoodtour] month_round={mo_phase} unique_row_keys={len(rows)} "
                f"(modal opened={opened} right_rows={len(rlist)})"
            )
            _verygood_phase_always(f"verygood-month-{mo_phase}-collect-end", f"keys={len(rows)}")
            moved = False
            for nsel in VERYGOOD_MONTH_NEXT_SELECTORS:
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
                    await self._verygood_wait_month_label_changed(prev_ym)
                    await self._page.wait_for_timeout(post_nav)
                    moved = True
                    break
                except Exception:
                    continue
            if mi > 0 and len(rows) == rows_before_month:
                break
            if not moved:
                break

        out: List[Dict[str, Any]] = []
        for dedupe_key in sorted(rows.keys(), key=lambda k: str(rows[k].get("date") or "")):
            item = rows[dedupe_key]
            d = str(item.get("date") or "").strip()[:10]
            if len(d) != 10 or d < _kst_verygood_departure_floor_ymd():
                continue
            _st = (item.get("status") or "").strip()
            status_raw = fix_mojibake_korean_str(_st) or _st
            _rc = (item.get("carrierName") or "").strip()
            row_carrier = fix_airline_name_str(str(_rc)) if _rc else None
            range_txt = (item.get("departureRangeText") or "").strip() or None
            sched = _verygood_modal_schedule_from_range(range_txt, d)
            ob_fn, in_fn = _verygood_flight_pair_from_texts(
                str(item.get("flightNo") or "").strip() or None,
                range_txt,
            )
            out_fno = ob_fn
            in_fno = in_fn if in_fn and in_fn != ob_fn else None
            ob_at = sched.get("outboundDepartureAt")
            ib_at = sched.get("inboundArrivalAt")
            if not row_carrier or not ob_at or not ib_at:
                continue
            rest_int = _verygood_modal_remain_seats_int(item, status_raw)
            if rest_int is None:
                seats_line = "좌석수미표기"
                _verygood_phase_always("verygood-row-kept-no-seats", f"date={d}")
            else:
                ss_raw = item.get("seatsStatusRaw")
                seats_line = (
                    ss_raw
                    if isinstance(ss_raw, str) and ss_raw.strip()
                    else f"잔여{rest_int}"
                )
            price_v = int(item.get("price") or 0)
            if price_v <= 0:
                continue
            dep_dt_m = re.match(
                r"^(20\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})$",
                str(ob_at).strip(),
            )
            ret_dt_m = re.match(
                r"^(20\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})$",
                str(ib_at).strip(),
            )
            if not dep_dt_m or not ret_dt_m:
                continue
            row = {
                "date": d,
                "price": price_v,
                "status": status_raw or "예약가능",
                "statusRaw": status_raw or "예약가능",
                "seatsStatusRaw": seats_line,
                "adultPrice": price_v,
                "childBedPrice": None,
                "childNoBedPrice": None,
                "infantPrice": None,
                "localPriceText": None,
                "minPax": None,
                "carrierName": row_carrier,
                "outboundFlightNo": out_fno,
                "outboundDepartureAirport": None,
                "outboundDepartureAt": ob_at,
                "outboundArrivalAirport": None,
                "outboundArrivalAt": None,
                "inboundFlightNo": in_fno,
                "inboundDepartureAirport": None,
                "inboundDepartureAt": None,
                "inboundArrivalAirport": None,
                "inboundArrivalAt": ib_at,
                "meetingInfoRaw": None,
                "meetingPointRaw": None,
                "meetingTerminalRaw": None,
                "meetingGuideNoticeRaw": None,
                "seatCount": rest_int,
                "_popupOpened": opened,
            }
            _verygood_attach_canonical_row_fields(
                row,
                departure_date=dep_dt_m.group(1),
                departure_time=dep_dt_m.group(2),
                return_date=ret_dt_m.group(1),
                return_time=ret_dt_m.group(2),
                price=price_v,
                remain_seats=rest_int,
                booking_status=str(row["statusRaw"]),
                airline_name=row_carrier,
            )
            out.append(row)
        _verygood_log(f"[verygoodtour] total unique departure rows built: {len(out)}")
        return out

    async def _scroll_verygood_popup_list(self) -> None:
        """모달 `.dep_right_wrap` 우선 스크롤 → 가려진 li 로딩 유도."""
        try:
            await self._page.evaluate(
                """() => {
  const dialog = document.querySelector('.ui-dialog.ui-widget') || document.querySelector('.ui-dialog');
  const wrap = dialog ? (dialog.querySelector('.pop_wrap.layer_pop') || dialog) : null;
  const right = wrap ? wrap.querySelector('.dep_right_wrap') : null;
  const root = right || wrap || document.body;
  const scrollables = root.querySelectorAll(
    '.dep_right_wrap, .scroll_wrap, .list_wrap, [class*="scroll"], ul, .mCustomScrollBox, [style*="overflow"]'
  );
  for (const el of scrollables) {
    try {
      el.scrollTop = el.scrollHeight;
    } catch (e) {}
  }
}"""
            )
            await self._page.wait_for_timeout(320)
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
  const carriers = '에미레이트항공|에미레이트|튀르키예항공|터키항공|카타르항공|카타르|에티하드항공|에티하드|영국항공|싱가포르항공|태국항공|베트남항공|티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|루프트한자|에어부산항공|에어캐나다|델타항공|유나이티드항공|에뉴질랜드|핀에어|ANA|전일본공수';
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
    if (!seatsRaw) {
      const jm = t.match(/잔여\\s*(\\d+)/);
      if (jm) seatsRaw = '잔여' + jm[1];
    }
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
                if date_str < _kst_verygood_departure_floor_ymd():
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
