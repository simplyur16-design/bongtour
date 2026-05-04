# -*- coding: utf-8 -*-
"""
교원이지(kyowontour) 출발일 캘린더 E2E.

1) Selenium으로 상품 상세 접속 → hidden `#masterCode` (또는 동등 input) 추출
2) 브라우저 쿠키를 `requests` 세션에 이식 후 `/goods/differentDepartDate` 월별 POST
   (캘린더 DOM 클릭 대신 API 호출로 안정화; masterCode 오인 시 빈 dayAirList 방지)
3) stdout 한 줄 JSON (Node `departures.ts` spawn 파싱용). 진행 로그는 stderr.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import date
from typing import Any, Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    from selenium import webdriver
    from selenium.common.exceptions import TimeoutException, WebDriverException
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait
except ImportError as e:  # pragma: no cover
    print(
        json.dumps({"phase": "error", "message": f"selenium import failed: {e}"}, ensure_ascii=False),
        file=sys.stdout,
        flush=True,
    )
    sys.exit(1)

from . import config


def _log(msg: str, logs: List[str]) -> None:
    line = f"[kyowontour-e2e] {msg}"
    logs.append(line)
    print(line, file=sys.stderr, flush=True)


def _ua() -> str:
    if config.USER_AGENT:
        return config.USER_AGENT
    return (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )


def _detail_url_candidates(tour_code: str) -> List[str]:
    if config.DETAIL_URL_TEMPLATE:
        return [config.DETAIL_URL_TEMPLATE.format(tourCode=tour_code, goodsCd=tour_code)]
    return [t.format(tourCode=tour_code) for t in config.DEFAULT_DETAIL_URL_CANDIDATES]


def _build_chrome_driver() -> webdriver.Chrome:
    opts = ChromeOptions()
    if config.HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--lang=ko-KR")
    opts.add_argument(f"--user-agent={_ua()}")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    service = ChromeService()
    drv = webdriver.Chrome(service=service, options=opts)
    drv.set_page_load_timeout(config.PAGE_LOAD_TIMEOUT_S)
    drv.set_script_timeout(config.AJAX_WAIT_S)
    return drv


def _extract_master_code(driver: webdriver.Chrome, logs: List[str]) -> Optional[str]:
    selectors = [
        (By.CSS_SELECTOR, "input#masterCode"),
        (By.CSS_SELECTOR, "#masterCode"),
        (By.NAME, "masterCode"),
        (By.CSS_SELECTOR, 'input[type="hidden"][name="masterCode"]'),
        (By.CSS_SELECTOR, 'input[name="masterCode"]'),
    ]
    for by, sel in selectors:
        try:
            els = driver.find_elements(by, sel)
            for el in els:
                v = (el.get_attribute("value") or el.text or "").strip()
                if v and len(v) >= 3:
                    _log(f"masterCode 추출 OK selector={by} {sel!r} value={v[:32]!r}", logs)
                    return v
        except WebDriverException as ex:
            _log(f"masterCode selector 경고 {sel!r}: {ex}", logs)
    # script/json in page
    try:
        html = driver.page_source or ""
        m = re.search(r'masterCode["\']?\s*[:=]\s*["\']([^"\']+)["\']', html, re.I)
        if m:
            v = m.group(1).strip()
            if v:
                _log(f"masterCode 페이지 소스 정규식 추출: {v[:40]!r}", logs)
                return v
    except WebDriverException:
        pass
    return None


def _wait_calendar(driver: webdriver.Chrome, logs: List[str]) -> bool:
    try:
        WebDriverWait(driver, config.AJAX_WAIT_S).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#tourDatepicker, .tourDatepicker, [id*='Datepicker']"))
        )
        _log("캘린더 컨테이너(#tourDatepicker 등) 감지", logs)
        return True
    except TimeoutException:
        _log("캘린더 #tourDatepicker 미감지(계속 진행)", logs)
        return False


def _session_from_driver(driver: webdriver.Chrome) -> requests.Session:
    s = requests.Session()
    retries = Retry(total=2, backoff_factor=0.4, status_forcelist=(502, 503, 504))
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.mount("http://", HTTPAdapter(max_retries=retries))
    s.headers.update(
        {
            "User-Agent": _ua(),
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
        }
    )
    for c in driver.get_cookies():
        domain = c.get("domain") or None
        try:
            s.cookies.set(c.get("name", ""), c.get("value", ""), domain=domain)
        except Exception:
            pass
    return s


def _extract_data_root(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    d = payload.get("data")
    if isinstance(d, dict):
        return d
    r = payload.get("result")
    if isinstance(r, dict):
        d2 = r.get("data")
        if isinstance(d2, dict):
            return d2
        return r
    return None


def _parse_price(v: Any) -> int:
    if v is None:
        return 0
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return int(v) if v == v else 0  # NaN check
    s = re.sub(r"[^\d]", "", str(v))
    return int(s) if s else 0


def _map_status(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return "unknown"
    if re.search(r"마감|매진|sold\s*out|불가|취소|종료", s, re.I):
        return "soldout"
    if re.search(r"대기|접수|예약\s*가능|가능|진행|모집|확정", s, re.I):
        return "available"
    if re.search(r"미운영|휴무|없음|준비중", s, re.I):
        return "closed"
    return "unknown"


def _normalize_ymd(raw: Any) -> str:
    s = str(raw or "").strip()
    if not s:
        return ""
    s = s.replace(".", "-").replace("/", "-")
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    digits = re.sub(r"\D", "", s)
    if len(digits) >= 8:
        return f"{digits[0:4]}-{digits[4:6]}-{digits[6:8]}"
    return ""


def _day_air_to_row(item: Dict[str, Any], tour_code: str, warnings: List[str]) -> Optional[Dict[str, Any]]:
    dep = _normalize_ymd(
        item.get("departDate")
        or item.get("depDate")
        or item.get("startDate")
        or item.get("goDate")
        or item.get("START_DATE")
    )
    if not dep:
        warnings.append(f"행 스킵: 출발일 없음 keys={list(item.keys())[:8]}")
        return None
    ret = _normalize_ymd(
        item.get("returnDate")
        or item.get("arrDate")
        or item.get("endDate")
        or item.get("comeDate")
        or item.get("RETURN_DATE")
        or ""
    )
    tc = str(
        item.get("tourCode")
        or item.get("goodsCode")
        or item.get("pkgCode")
        or item.get("TOUR_CD")
        or tour_code
        or ""
    ).strip()
    airline = str(
        item.get("airline")
        or item.get("korAirline")
        or item.get("airLineName")
        or item.get("carrierName")
        or item.get("AIRLINE")
        or ""
    ).strip()
    price = _parse_price(
        item.get("adultPrice")
        or item.get("price")
        or item.get("salePrice")
        or item.get("ADULT_PRICE")
        or item.get("adtAmt")
    )
    if price <= 0:
        warnings.append(f"adultPrice 0/누락: {dep} tourCode={tc}")
    st_raw = str(
        item.get("status")
        or item.get("reserveStatus")
        or item.get("statCd")
        or item.get("rsvStatNm")
        or item.get("goodsStat")
        or ""
    )
    st = _map_status(st_raw)
    return {
        "departDate": dep,
        "returnDate": ret,
        "tourCode": tc or tour_code,
        "airline": airline,
        "adultPrice": price,
        "status": st,
        "rawJson": item,
    }


def _post_month(
    session: requests.Session,
    master_code: str,
    yyyymm: str,
    tour_code: str,
    logs: List[str],
    warnings: List[str],
) -> List[Dict[str, Any]]:
    url = f"{config.API_BASE}/goods/differentDepartDate"
    body = {"masterCode": master_code, "departMonth": yyyymm, "departDate": f"{yyyymm}01"}
    for attempt in range(1, 4):
        try:
            r = session.post(url, data=body, timeout=config.AJAX_WAIT_S + 20)
            _log(f"POST differentDepartDate month={yyyymm} status={r.status_code} len={len(r.text)}", logs)
            if r.status_code >= 500 and attempt < 3:
                time.sleep(0.5 * attempt)
                continue
            r.raise_for_status()
            payload = r.json()
            data = _extract_data_root(payload if isinstance(payload, dict) else {}) or {}
            lst = data.get("dayAirList") or data.get("dayairList") or []
            if not isinstance(lst, list):
                return []
            out: List[Dict[str, Any]] = []
            for it in lst:
                if isinstance(it, dict):
                    row = _day_air_to_row(it, tour_code, warnings)
                    if row:
                        out.append(row)
            return out
        except Exception as ex:
            _log(f"POST 실패 attempt={attempt} {yyyymm}: {ex}", logs)
            if attempt >= 3:
                return []
            time.sleep(0.45 * attempt)
    return []


def _month_iter(date_from: Optional[date], date_to: Optional[date], month_limit: int) -> List[str]:
    """YYYYMM 문자열 리스트."""
    today = date.today().replace(day=1)
    start = date_from or today
    out: List[str] = []
    y, m = start.year, start.month
    guard = 0
    while guard < 48:
        guard += 1
        out.append(f"{y}{m:02d}")
        if len(out) >= month_limit:
            break
        if m == 12:
            y += 1
            m = 1
        else:
            m += 1
        cur = date(y, m, 1)
        if date_to and cur > date_to.replace(day=1):
            break
    return out


def _parse_iso(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s.strip())
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def _filter_date_range(rows: List[Dict[str, Any]], df: Optional[date], dt: Optional[date], warnings: List[str]) -> List[Dict[str, Any]]:
    if not df and not dt:
        return rows
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = _parse_iso(str(r.get("departDate", ""))[:10])
        if not d:
            continue
        if df and d < df:
            continue
        if dt and d > dt:
            continue
        out.append(r)
    if (df or dt) and len(out) < len(rows):
        warnings.append(f"날짜 필터 적용: {len(rows)} → {len(out)}")
    return out


def run_scrape(
    tour_code: str,
    master_override: Optional[str],
    months: int,
    date_from: Optional[str],
    date_to: Optional[str],
) -> Dict[str, Any]:
    logs: List[str] = []
    warnings: List[str] = []
    master_code = (master_override or "").strip() or None
    rows_acc: Dict[str, Dict[str, Any]] = {}

    df = _parse_iso(date_from or config.DATE_FROM)
    dt = _parse_iso(date_to or config.DATE_TO)
    month_limit = min(months, config.MONTH_LIMIT, 36)

    driver: Optional[webdriver.Chrome] = None
    try:
        if not master_code:
            driver = _build_chrome_driver()
            opened = False
            for url in _detail_url_candidates(tour_code):
                try:
                    _log(f"상세 로드 시도: {url[:120]}…", logs)
                    driver.get(url)
                    opened = True
                    break
                except TimeoutException:
                    warnings.append(f"페이지 로드 타임아웃: {url[:100]}")
                except WebDriverException as ex:
                    warnings.append(f"페이지 로드 실패: {url[:80]} — {ex}")
            if not opened:
                raise RuntimeError("상품 상세 URL을 열 수 없습니다 (모든 후보 실패)")

            master_code = _extract_master_code(driver, logs)
            if not master_code:
                raise RuntimeError("masterCode 추출 실패 (DOM 변경 또는 상품 없음)")

            _wait_calendar(driver, logs)

            session = _session_from_driver(driver)
        else:
            _log(f"--master-code 로 DOM 생략, 직접 API만 사용: {master_code!r}", logs)
            session = requests.Session()
            session.headers.update(
                {
                    "User-Agent": _ua(),
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest",
                }
            )

        clicks = 0
        for yyyymm in _month_iter(df, dt, month_limit):
            if clicks >= config.MAX_CLICKS:
                warnings.append(f"KYOWONTOUR_E2E_MAX_CLICKS={config.MAX_CLICKS} 도달, 월 순회 중단")
                break
            clicks += 1
            part = _post_month(session, master_code, yyyymm, tour_code, logs, warnings)
            for r in part:
                k = f"{r.get('departDate')}|{r.get('tourCode') or ''}"
                rows_acc[k] = r

        merged = list(rows_acc.values())
        merged.sort(key=lambda x: str(x.get("departDate", "")))
        merged = _filter_date_range(merged, df, dt, warnings)

        return {
            "phase": "rows",
            "tourCode": tour_code,
            "masterCode": master_code,
            "rows": merged,
            "warnings": warnings,
            "phase_logs": logs,
        }
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


def main() -> None:
    p = argparse.ArgumentParser(description="Kyowontour calendar E2E (Selenium + requests)")
    p.add_argument("--tour-code", required=True, help="상품 tourCode / goodsCd")
    p.add_argument("--master-code", default=None, help="이미 알고 있으면 DOM 생략")
    p.add_argument("--months", type=int, default=config.MONTH_LIMIT, help="최대 월 수")
    p.add_argument("--from", dest="date_from", default=None, help="YYYY-MM-DD")
    p.add_argument("--to", dest="date_to", default=None, help="YYYY-MM-DD")
    args = p.parse_args()

    try:
        out = run_scrape(
            tour_code=args.tour_code.strip(),
            master_override=(args.master_code or "").strip() or None,
            months=max(1, int(args.months)),
            date_from=args.date_from,
            date_to=args.date_to,
        )
        print(json.dumps(out, ensure_ascii=False, default=str), flush=True)
        sys.exit(0)
    except Exception as ex:
        err = {"phase": "error", "message": str(ex), "tourCode": getattr(args, "tour_code", ""), "warnings": [str(ex)]}
        print(json.dumps(err, ensure_ascii=False), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
