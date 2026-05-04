# -*- coding: utf-8 -*-
"""
롯데관광(lottetour) 출발일 목록 E2E.

공개 GET `https://www.lottetour.com/evtlist/evtListAjax` (HTML 테이블)을 `requests`로 수집한다.
진행 로그는 stderr, 결과는 stdout 한 줄 JSON(Node `lottetour-departures.ts` spawn 파싱용).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from . import config

_EVT_CD_RE = re.compile(r"^[A-Z]\d{2}[A-Z]\d{6}[A-Z]{2}\d{3}$")


def _log(msg: str, logs: List[str]) -> None:
    line = f"[lottetour-e2e] {msg}"
    logs.append(line)
    print(line, file=sys.stderr, flush=True)


def _ua() -> str:
    if config.USER_AGENT:
        return config.USER_AGENT
    return (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )


def _session() -> requests.Session:
    s = requests.Session()
    retries = Retry(total=2, backoff_factor=0.4, status_forcelist=(502, 503, 504))
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.mount("http://", HTTPAdapter(max_retries=retries))
    s.headers.update(
        {
            "User-Agent": _ua(),
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        }
    )
    return s


def _depart_date_from_evt_cd(evt_cd: str) -> str:
    t = (evt_cd or "").strip()
    if not _EVT_CD_RE.match(t):
        return ""
    six = t[4:10]
    yy2 = int(six[0:2], 10)
    mm, dd = six[2:4], six[4:6]
    yyyy = 1900 + yy2 if yy2 >= 70 else 2000 + yy2
    return f"{yyyy}-{mm}-{dd}"


def _parse_price_cell(html: str) -> int:
    m = re.search(r"<strong>\s*([\d,]+)\s*원\s*</strong>", html, re.I)
    if not m:
        return 0
    return int(m.group(1).replace(",", ""), 10)


def _parse_evt_cd_from_row(row_html: str) -> str:
    m = re.search(r"/evtDetail/[^\s\"'<>]+\?[^\s\"'<>]*evtCd=([A-Z0-9]+)", row_html, re.I) or re.search(
        r"[?&]evtCd=([A-Z0-9]+)", row_html, re.I
    )
    if not m:
        return ""
    code = m.group(1).strip()
    return code if _EVT_CD_RE.match(code) else ""


def _fix_strip(s: str) -> str:
    t = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", t).strip()


def _parse_time_cell(html: str, year_hint: int) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    plain = _fix_strip(html)
    re_t = re.compile(r"(\d{2})/(\d{2})\s*\([^)]*\)\s*(\d{2}):(\d{2})")
    hits: List[Tuple[str, str]] = []
    for m in re_t.finditer(plain):
        mm, dd, hh, mi = m.group(1), m.group(2), m.group(3), m.group(4)
        ymd = f"{year_hint}-{mm}-{dd}"
        hits.append((f"{mm}/{dd} {hh}:{mi}", ymd))
    if not hits:
        return None, None, None, None
    if len(hits) == 1:
        return hits[0][0], None, hits[0][1], None
    return hits[0][0], hits[1][0], hits[0][1], hits[1][1]


def _parse_seat_count(text: str) -> Optional[int]:
    m = re.search(r"잔여석\s*(\d+)\s*석", text)
    if m:
        return int(m.group(1), 10)
    return None


def _parse_status_parts(text: str) -> Tuple[Optional[str], Optional[str]]:
    t = _fix_strip(text)
    if not t:
        return None, None
    status_raw: Optional[str] = t[:200]
    if re.search(r"출발\s*확정", t):
        status_raw = "출발확정"
    elif re.search(r"대기\s*예약", t):
        status_raw = "대기예약"
    elif re.search(r"예약\s*가능|예약가능", t):
        status_raw = "예약가능"
    seats_raw = t[:200] if "잔여석" in t else None
    return status_raw, seats_raw


def _map_status_for_row(status_raw: Optional[str], seats_raw: Optional[str]) -> str:
    raw = f"{status_raw or ''} {seats_raw or ''}"
    if re.search(r"마감|매진|sold\s*out|불가|취소|종료", raw, re.I):
        return "soldout"
    if re.search(r"출발\s*확정", raw, re.I):
        return "departure_confirmed"
    if re.search(r"대기\s*예약|대기", raw, re.I):
        return "standby"
    if re.search(r"예약\s*가능|예약가능|잔여", raw, re.I):
        return "available"
    if re.search(r"미운영|휴무|없음|준비중", raw, re.I):
        return "closed"
    return "unknown"


def _parse_more_total(html: str) -> Optional[int]:
    m = re.search(r"더보기[^0-9]*(\d+)\s*건\s*/\s*(\d+)\s*건", html)
    if m:
        return int(m.group(2), 10)
    m2 = re.search(r"(\d+)\s*건\s*/\s*(\d+)\s*건", html)
    if m2:
        return int(m2.group(2), 10)
    return None


def parse_evt_list_ajax_html(html: str, dep_ym: str, god_id: str, warnings: List[str]) -> List[Dict[str, Any]]:
    """dep_ym: YYYYMM (6 chars)."""
    year_hint = int(dep_ym[0:4], 10)
    soup = BeautifulSoup(html, "html.parser")
    tbody = soup.find("tbody")
    container = tbody if tbody else soup
    rows_out: List[Dict[str, Any]] = []
    for tr in container.find_all("tr"):
        inner = str(tr)
        evt_cd = _parse_evt_cd_from_row(inner)
        if not evt_cd:
            continue
        cells = tr.find_all("td")
        if len(cells) < 6:
            warnings.append(f"evtCd={evt_cd}: td {len(cells)}개만 확인")
        time_cell = cells[0] if cells else tr
        carrier_cell = cells[1] if len(cells) > 1 else None
        grade_cell = cells[2] if len(cells) > 2 else None
        title_cell = cells[3] if len(cells) > 3 else None
        duration_cell = cells[4] if len(cells) > 4 else None
        price_cell = cells[5] if len(cells) > 5 else tr
        status_cell = cells[6] if len(cells) > 6 else None

        price = _parse_price_cell(str(price_cell))
        dep_txt, ret_txt, html_dep, html_ret = _parse_time_cell(str(time_cell), year_hint)
        evt_ymd = _depart_date_from_evt_cd(evt_cd)
        depart_date = evt_ymd or (html_dep or "")
        if not depart_date:
            warnings.append(f"evtCd={evt_cd}: 출발일 파싱 실패")
            continue
        if evt_ymd and html_dep and evt_ymd != html_dep:
            warnings.append(f"evtCd={evt_cd}: HTML 출발일({html_dep})과 evtCd({evt_ymd}) 불일치 — evtCd SSOT")

        st_cell = str(status_cell) if status_cell else ""
        status_raw, seats_raw = _parse_status_parts(st_cell)
        seat_count = _parse_seat_count(_fix_strip(st_cell))
        status = _map_status_for_row(status_raw, seats_raw)

        rows_out.append(
            {
                "depYm": dep_ym,
                "godId": god_id,
                "evtCd": evt_cd,
                "departDate": depart_date,
                "returnDate": html_ret,
                "departTimeText": dep_txt,
                "returnTimeText": ret_txt,
                "carrierText": (_fix_strip(str(carrier_cell))[:200] if carrier_cell else None) or None,
                "gradeText": (_fix_strip(str(grade_cell))[:120] if grade_cell else None) or None,
                "tourTitleRaw": (_fix_strip(str(title_cell))[:400] if title_cell else None) or None,
                "durationText": (_fix_strip(str(duration_cell))[:80] if duration_cell else None) or None,
                "adultPrice": price,
                "statusRaw": status_raw,
                "seatsStatusRaw": seats_raw,
                "seatCount": seat_count,
                "status": status,
            }
        )
    return rows_out


def _build_url(
    dep_dt: str,
    god_id: str,
    m1: str,
    m2: str,
    m3: str,
    m4: str,
    page_index: int,
    max_evt_cnt: int,
    evt_order_by: str,
) -> str:
    from urllib.parse import urlencode

    q = {
        "depDt": dep_dt,
        "godId": god_id,
        "menuNo1": m1,
        "menuNo2": m2,
        "menuNo3": m3,
        "menuNo4": m4,
        "evtOrderBy": evt_order_by,
        "pageIndex": str(page_index),
        "maxEvtCnt": str(max_evt_cnt),
        "template": "evtList",
    }
    return f"{config.BASE_URL}/evtlist/evtListAjax?{urlencode(q)}"


def _ym_to_dep_dt(ym: str) -> str:
    y, mo = ym.split("-")
    return f"{y}{mo}"


def _enumerate_ym(start_ym: str, count: int) -> List[str]:
    m = re.match(r"^(\d{4})-(\d{2})$", start_ym.strip())
    if not m:
        return []
    y, mo = int(m.group(1)), int(m.group(2))
    out: List[str] = []
    for _ in range(count):
        out.append(f"{y}-{mo:02d}")
        mo += 1
        if mo > 12:
            mo = 1
            y += 1
    return out


def _parse_iso_ymd(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s.strip())
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def _default_start_ym() -> str:
    if config.DATE_FROM and re.match(r"^\d{4}-\d{2}$", config.DATE_FROM):
        return config.DATE_FROM
    t = date.today().replace(day=1)
    return f"{t.year}-{t.month:02d}"


def run_scrape(
    god_id: str,
    menu1: str,
    menu2: str,
    menu3: str,
    menu4: str,
    months: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    depart_month: Optional[str] = None,
    evt_cd_hint: Optional[str] = None,
) -> Dict[str, Any]:
    logs: List[str] = []
    warnings: List[str] = []
    gid = (god_id or "").strip()
    a, b, c, d = (menu1 or "").strip(), (menu2 or "").strip(), (menu3 or "").strip(), (menu4 or "").strip()
    if not gid or not a or not b or not c or not d:
        raise RuntimeError("godId·menuNo1~4가 모두 필요합니다.")
    if evt_cd_hint:
        _log(f"evtCd 힌트(참고): {evt_cd_hint[:40]!r}", logs)

    month_limit = min(max(1, months), config.MONTH_LIMIT, 36)
    if depart_month and re.match(r"^\d{6}$", depart_month.strip()):
        dm = depart_month.strip()
        ym_list = [f"{dm[0:4]}-{dm[4:6]}"]
    else:
        raw_start = (date_from or "").strip() if date_from else _default_start_ym()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", raw_start):
            start_ym = raw_start[0:7]
        else:
            start_ym = raw_start
        if not re.match(r"^\d{4}-\d{2}$", start_ym):
            start_ym = _default_start_ym()
        ym_list = _enumerate_ym(start_ym, month_limit)

    df = _parse_iso_ymd((date_from or config.DATE_FROM or "")[:10] if (date_from or config.DATE_FROM) else None)
    dt = _parse_iso_ymd((date_to or config.DATE_TO or "")[:10] if (date_to or config.DATE_TO) else None)
    if config.DATE_TO and re.match(r"^\d{4}-\d{2}$", config.DATE_TO):
        cap = config.DATE_TO
        ym_list = [x for x in ym_list if x <= cap]

    acc: List[Dict[str, Any]] = []
    sess = _session()
    max_evt = config.MAX_EVT_CNT
    order_by = config.EVT_ORDER_BY if config.EVT_ORDER_BY in ("DT", "PR") else "DT"

    for ym in ym_list:
        dep_dt = _ym_to_dep_dt(ym)
        page_index = 1
        reported_total: Optional[int] = None
        while True:
            url = _build_url(dep_dt, gid, a, b, c, d, page_index, max_evt, order_by)
            _log(f"GET evtListAjax ym={ym} page={page_index}", logs)
            try:
                r = sess.get(url, timeout=config.REQUEST_TIMEOUT_S)
                if r.status_code >= 500:
                    warnings.append(f"{ym} p{page_index}: HTTP {r.status_code}")
                    break
                r.raise_for_status()
                html = r.text or ""
            except Exception as ex:
                warnings.append(f"{ym} p{page_index}: {ex}")
                break
            if reported_total is None:
                reported_total = _parse_more_total(html)
            part = parse_evt_list_ajax_html(html, dep_dt, gid, warnings)
            if not part:
                break
            acc.extend(part)
            if len(part) < max_evt:
                break
            if reported_total is not None and page_index * max_evt >= reported_total:
                break
            page_index += 1
            if page_index > 200:
                warnings.append(f"{ym}: pageIndex 200 초과 중단")
                break
            time.sleep(0.35 + 0.1 * page_index)

    if df or dt:
        filt: List[Dict[str, Any]] = []
        for row in acc:
            d = _parse_iso_ymd(str(row.get("departDate", ""))[:10])
            if not d:
                continue
            if df and d < df:
                continue
            if dt and d > dt:
                continue
            filt.append(row)
        if len(filt) < len(acc):
            warnings.append(f"날짜 필터: {len(acc)} → {len(filt)}")
        acc = filt

    acc.sort(key=lambda x: (str(x.get("departDate", "")), str(x.get("evtCd", ""))))
    return {
        "phase": "rows",
        "godId": gid,
        "rows": acc,
        "warnings": warnings,
        "phase_logs": logs,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Lottetour calendar E2E (requests GET evtListAjax HTML)")
    p.add_argument("--god-id", required=True, help="마스터 상품 ID (godId)")
    p.add_argument("--menu-no1", required=True)
    p.add_argument("--menu-no2", required=True)
    p.add_argument("--menu-no3", required=True)
    p.add_argument("--menu-no4", required=True)
    p.add_argument("--months", type=int, default=config.MONTH_LIMIT, help="월 순회 수")
    p.add_argument("--from", dest="date_from", default=None, help="YYYY-MM-DD 필터 시작")
    p.add_argument("--to", dest="date_to", default=None, help="YYYY-MM-DD 필터 끝")
    p.add_argument("--depart-month", default=None, help="단일 월 YYYYMM (지정 시 해당 월만)")
    p.add_argument("--evt-cd-hint", default=None, help="evtCd 힌트(로그·운영 참고)")
    p.add_argument("--tour-code", default=None, help="evtCd 힌트 별칭(kyowontour CLI 호환)")
    args = p.parse_args()
    hint = (args.evt_cd_hint or args.tour_code or "").strip() or None
    try:
        out = run_scrape(
            god_id=args.god_id.strip(),
            menu1=args.menu_no1.strip(),
            menu2=args.menu_no2.strip(),
            menu3=args.menu_no3.strip(),
            menu4=args.menu_no4.strip(),
            months=max(1, int(args.months)),
            date_from=args.date_from,
            date_to=args.date_to,
            depart_month=(args.depart_month or "").strip() or None,
            evt_cd_hint=hint,
        )
        print(json.dumps(out, ensure_ascii=False, default=str), flush=True)
        sys.exit(0)
    except Exception as ex:
        err = {"phase": "error", "message": str(ex), "warnings": [str(ex)]}
        print(json.dumps(err, ensure_ascii=False), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
