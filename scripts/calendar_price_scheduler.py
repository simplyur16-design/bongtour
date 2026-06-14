# -*- coding: utf-8 -*-
"""
달력 가격 스크래퍼 자동 실행: 상품을 하나씩 순차 처리 후 DB 저장.
공급사별 calendar E2E 모듈로만 위임한다 (스크래프 로직은 각 패키지 내부).

환경변수(선택):
  SCRAPER_CALENDAR_HORIZON_END — YYYY-MM-DD 지평선 상한 (로그용)
  SCRAPER_CALENDAR_SEQ_START_INDEX — sequential 시작 상품 인덱스
  CALENDAR_BATCH_WALL_BUDGET_SEC — 1 run wall-clock 상한 (기본 36000)
  SCRAPER_BATCH_MODE — sequential | manual (로그용)
  공급사별 DATE_FROM/TO — 상품별 in-window 수집 (하나투어 HANATOUR_E2E_DATE_FROM/TO 포함)
완료 시 stdout 마지막에 `BONGTOUR_BATCH_RESULT:{json}` 1줄 출력.
"""
from __future__ import annotations

import asyncio
import importlib
import json
import logging
import re
import os
import random
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from apscheduler.schedulers.blocking import BlockingScheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

API_BASE = os.getenv("BONGTOUR_API_BASE", "http://localhost:3000").rstrip("/")
ADMIN_SECRET = os.getenv("ADMIN_BYPASS_SECRET", "")
SCHEDULER_HOUR = int(os.getenv("SCHEDULER_HOUR", "12"))
SCHEDULER_MINUTE = int(os.getenv("SCHEDULER_MINUTE", "30"))
HORIZON_END = (os.getenv("SCRAPER_CALENDAR_HORIZON_END") or "").strip()[:10]
SEQ_START_INDEX = int(os.getenv("SCRAPER_CALENDAR_SEQ_START_INDEX", "0") or "0")
WALL_BUDGET_SEC = float(os.getenv("CALENDAR_BATCH_WALL_BUDGET_SEC", "36000"))
MAX_RETRIES_PER_PRODUCT = 3
BATCH_MODE = (os.getenv("SCRAPER_BATCH_MODE") or "").strip() or "daemon"
# modetour만 공급사 단위 연속 실패 차단(기본 30회). 그 외는 상품별 cursor 전진만 — 3회 차단 금지.
MODETOUR_SUPPLIER_BLOCK_CONSECUTIVE_FAILS = int(
    os.getenv("MODETOUR_SUPPLIER_BLOCK_CONSECUTIVE_FAILS", "30") or "30"
)

_CALENDAR_MODULE_BY_SITE: Dict[str, str] = {
    "hanatour": "scripts.calendar_e2e_scraper_hanatour.calendar_price_scraper",
    "modetour": "scripts.calendar_e2e_scraper_modetour.calendar_price_scraper",
    "verygoodtour": "scripts.calendar_e2e_scraper_verygoodtour.calendar_price_scraper",
    "ybtour": "scripts.calendar_e2e_scraper_ybtour.calendar_price_scraper",
    "yellowballoon": "scripts.calendar_e2e_scraper_ybtour.calendar_price_scraper",
    "kyowontour": "scripts.calendar_e2e_scraper_kyowontour.calendar_price_scraper",
    "lottetour": "scripts.calendar_e2e_scraper_lottetour.calendar_price_scraper",
}


def _lottetour_ids_from_url(detail_url: str) -> Tuple[str, Tuple[str, str, str, str], str]:
    from urllib.parse import parse_qs, urlparse

    u = urlparse((detail_url or "").strip())
    q = parse_qs(u.query)
    god = ""
    vals = q.get("godId")
    if vals and str(vals[0]).strip():
        god = str(vals[0]).strip()
    evt = ""
    for key in ("evtCd", "EVT_CD"):
        ev = q.get(key)
        if ev and str(ev[0]).strip():
            evt = str(ev[0]).strip()
            break
    m = re.search(r"/evt(?:Detail|List)/(\d+)/(\d+)/(\d+)/(\d+)", u.path, re.I)
    if not m:
        raise ValueError("lottetour: 상세·목록 URL 경로에서 menuNo1~4를 찾을 수 없습니다.")
    menus = (m.group(1), m.group(2), m.group(3), m.group(4))
    if not god:
        raise ValueError("lottetour: URL에 godId가 없습니다. evtList URL을 쓰거나 Product 메타를 보강하세요.")
    return god, menus, evt


def _kyowontour_tour_code_from_url(detail_url: str) -> str:
    from urllib.parse import parse_qs, urlparse

    try:
        u = urlparse((detail_url or "").strip())
        q = parse_qs(u.query)
        for key in ("tourCd", "goodsCd", "goodscd", "TOUR_CD", "GOODS_CD"):
            vals = q.get(key)
            if vals and str(vals[0]).strip():
                return str(vals[0]).strip()
    except Exception:
        pass
    return ""


def _calendar_module_for_site(site: str) -> str:
    raw = (site or "hanatour").strip().lower()
    if raw == "yellowballoon":
        raw = "ybtour"
    return _CALENDAR_MODULE_BY_SITE.get(raw) or _CALENDAR_MODULE_BY_SITE["hanatour"]


def _run_calendar_price_from_url(detail_url: str, site: str, headless: bool) -> Any:
    s = (site or "").strip().lower()
    if s == "lottetour":
        god, menus, evt = _lottetour_ids_from_url(detail_url)
        from scripts.calendar_e2e_scraper_lottetour import config as lcfg
        from scripts.calendar_e2e_scraper_lottetour.calendar_price_scraper import run_scrape

        date_from = (os.getenv("LOTTETOUR_DATE_FROM") or "").strip() or lcfg.DATE_FROM
        date_to = (os.getenv("LOTTETOUR_DATE_TO") or "").strip() or lcfg.DATE_TO
        raw = run_scrape(
            god_id=god,
            menu1=menus[0],
            menu2=menus[1],
            menu3=menus[2],
            menu4=menus[3],
            months=lcfg.MONTH_LIMIT,
            date_from=date_from,
            date_to=date_to,
            depart_month=None,
            evt_cd_hint=evt or None,
        )
        rows = raw.get("rows") if isinstance(raw, dict) else None
        out_lt: List[Dict[str, Any]] = []
        if isinstance(rows, list):
            for r in rows:
                if not isinstance(r, dict):
                    continue
                dd = str(r.get("departDate") or "")[:10]
                if not dd:
                    continue
                ap = r.get("adultPrice")
                price: Any = None
                if ap is not None and str(ap).strip():
                    try:
                        price = int(float(str(ap).replace(",", "")))
                    except ValueError:
                        price = None
                row_lt: Dict[str, Any] = {
                    "date": dd,
                    "adultPrice": price,
                    "price": price,
                    "statusRaw": str(r.get("statusRaw") or r.get("status") or ""),
                    "seatsStatusRaw": str(r.get("seatsStatusRaw") or ""),
                }
                out_lt.append(row_lt)
        return out_lt
    if s == "kyowontour":
        from scripts.calendar_e2e_scraper_kyowontour import config as kcfg
        from scripts.calendar_e2e_scraper_kyowontour.calendar_price_scraper import run_scrape

        tour = _kyowontour_tour_code_from_url(detail_url)
        if not tour:
            raise ValueError("kyowontour: detail URL에서 tourCd/goodsCd를 찾을 수 없습니다.")
        date_from = (os.getenv("KYOWONTOUR_DATE_FROM") or "").strip() or kcfg.DATE_FROM
        date_to = (os.getenv("KYOWONTOUR_DATE_TO") or "").strip() or kcfg.DATE_TO
        raw = run_scrape(tour, None, kcfg.MONTH_LIMIT, date_from, date_to)
        rows = raw.get("rows") if isinstance(raw, dict) else None
        out: List[Dict[str, Any]] = []
        if isinstance(rows, list):
            for r in rows:
                if not isinstance(r, dict):
                    continue
                dd = str(r.get("departDate") or "")[:10]
                if not dd:
                    continue
                ap = r.get("adultPriceFromCalendar", r.get("adultPrice"))
                price: Any = None
                if ap is not None and str(ap).strip():
                    try:
                        price = int(float(str(ap).replace(",", "")))
                    except ValueError:
                        price = None
                row: Dict[str, Any] = {
                    "date": dd,
                    "adultPrice": price,
                    "price": price,
                    "statusRaw": str(r.get("status") or ""),
                }
                out.append(row)
        return out
    mod_name = _calendar_module_for_site(site)
    mod = importlib.import_module(mod_name)
    return asyncio.run(mod.run_calendar_price_from_url(detail_url, headless=headless))


def _item_date_ymd(item: Dict[str, Any]) -> str:
    d = item.get("date") or item.get("departureDate") or ""
    s = str(d).strip()[:10]
    return s


def _normalize_scraper_payload_to_api_items(raw: Any, _site: str) -> List[Dict[str, Any]]:
    """calendar-prices API 형식: { date, price|adultPrice, ... } 리스트."""
    if isinstance(raw, list):
        out: List[Dict[str, Any]] = []
        for row in raw:
            if not isinstance(row, dict):
                continue
            it = dict(row)
            if "date" not in it or not str(it.get("date") or "").strip():
                dd = _item_date_ymd(it)
                if dd:
                    it["date"] = dd
            out.append(it)
        return out
    if isinstance(raw, dict):
        deps = raw.get("departures")
        if isinstance(deps, list):
            mapped: List[Dict[str, Any]] = []
            for drow in deps:
                if not isinstance(drow, dict):
                    continue
                dd = str(drow.get("departureDate") or "").strip()[:10]
                if not dd:
                    continue
                ap = drow.get("adultPrice")
                price = int(ap) if ap is not None and str(ap).strip().isdigit() else drow.get("price")
                row: Dict[str, Any] = {
                    "date": dd,
                    "adultPrice": price,
                    "price": price,
                    "statusRaw": drow.get("statusRaw"),
                    "seatsStatusRaw": drow.get("seatsStatusRaw"),
                }
                for k in (
                    "childBedPrice",
                    "childNoBedPrice",
                    "infantPrice",
                    "localPriceText",
                    "minPax",
                    "carrierName",
                    "outboundFlightNo",
                    "outboundDepartureAirport",
                    "outboundDepartureAt",
                    "outboundArrivalAirport",
                    "outboundArrivalAt",
                    "inboundFlightNo",
                    "inboundDepartureAirport",
                    "inboundDepartureAt",
                    "inboundArrivalAirport",
                    "inboundArrivalAt",
                    "meetingInfoRaw",
                    "meetingPointRaw",
                    "meetingTerminalRaw",
                    "meetingGuideNoticeRaw",
                ):
                    if k in drow:
                        row[k] = drow.get(k)
                mapped.append(row)
            return mapped
    return []


def _in_range(ymd: str, lo: str, hi: str) -> bool:
    return bool(ymd) and len(ymd) >= 10 and lo <= ymd[:10] <= hi


def _filter_items_by_range(items: List[Dict[str, Any]], lo: str, hi: str) -> List[Dict[str, Any]]:
    return [x for x in items if _in_range(_item_date_ymd(x), lo, hi)]


def _product_rng(product: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    lo = str(product.get("rangeStartYmd") or "").strip()[:10]
    hi = str(product.get("rangeEndYmd") or "").strip()[:10]
    if len(lo) == 10 and len(hi) == 10 and lo <= hi:
        return (lo, hi)
    return None


def _legacy_rng(product: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    lo = str(product.get("rangeStartYmd") or product.get("todaySeoulYmd") or "").strip()[:10]
    hi = str(product.get("rangeEndYmd") or product.get("horizonYmd") or "").strip()[:10]
    if len(lo) == 10 and len(hi) == 10 and lo <= hi:
        return (lo, hi)
    return None


def _is_modetour_legacy(product: Dict[str, Any], site: str) -> bool:
    if site == "modetour":
        return True
    return product.get("sequentialEligible") is False


def _clear_site_date_env() -> None:
    for key in (
        "HANATOUR_E2E_DATE_FROM",
        "HANATOUR_E2E_DATE_TO",
        "HANATOUR_E2E_PROBE_ONLY_DATES",
        "VERYGOOD_DATE_FROM",
        "VERYGOOD_DATE_TO",
        "YBTOUR_DATE_FROM",
        "YBTOUR_DATE_TO",
        "LOTTETOUR_DATE_FROM",
        "LOTTETOUR_DATE_TO",
        "KYOWONTOUR_DATE_FROM",
        "KYOWONTOUR_DATE_TO",
    ):
        os.environ.pop(key, None)


def _set_site_date_env(site: str, lo: str, hi: str) -> None:
    _clear_site_date_env()
    s = (site or "hanatour").strip().lower()
    if s == "hanatour":
        os.environ["HANATOUR_E2E_DATE_FROM"] = lo
        os.environ["HANATOUR_E2E_DATE_TO"] = hi
    elif s == "verygoodtour":
        os.environ["VERYGOOD_DATE_FROM"] = lo
        os.environ["VERYGOOD_DATE_TO"] = hi
    elif s in ("ybtour", "yellowballoon"):
        os.environ["YBTOUR_DATE_FROM"] = lo
        os.environ["YBTOUR_DATE_TO"] = hi
    elif s == "lottetour":
        os.environ["LOTTETOUR_DATE_FROM"] = lo
        os.environ["LOTTETOUR_DATE_TO"] = hi
    elif s == "kyowontour":
        os.environ["KYOWONTOUR_DATE_FROM"] = lo
        os.environ["KYOWONTOUR_DATE_TO"] = hi


def _patch_product_cursor(product_id: str, payload: Dict[str, Any]) -> bool:
    url = f"{API_BASE}/api/admin/products/{product_id}/calendar-batch-cursor"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {**_headers(), "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
            return True
    except Exception as e:
        logger.error("patch_cursor %s: %s", product_id, e)
        return False


def _advance_product_after_window(product: Dict[str, Any], range_end_ymd: str) -> None:
    pid = str(product.get("id") or "")
    if not pid:
        return
    if product.get("atHorizon") or product.get("windowEmpty"):
        if product.get("hasFutureDepartures") is True:
            _patch_product_cursor(pid, {"horizonRolling": True})
        else:
            _patch_product_cursor(pid, {"retired": True})
        return
    if range_end_ymd:
        _patch_product_cursor(pid, {"advanceToYmd": range_end_ymd})


def _emit_batch_result(payload: Dict[str, Any]) -> None:
    line = "BONGTOUR_BATCH_RESULT:" + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    print(line, flush=True)


def _headers() -> Dict[str, str]:
    h = {"Content-Type": "application/json"}
    if ADMIN_SECRET:
        h["Authorization"] = f"Bearer {ADMIN_SECRET}"
    return h


def fetch_products() -> List[Dict[str, Any]]:
    url = f"{API_BASE}/api/admin/scheduler/products"
    req = urllib.request.Request(url, headers=_headers(), method="GET")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data if isinstance(data, list) else []
    except urllib.error.HTTPError as e:
        logger.error("fetch_products HTTPError %s: %s", e.code, e.read().decode("utf-8")[:200])
        return []
    except Exception as e:
        logger.exception("fetch_products: %s", e)
        return []


def save_calendar_prices(product_id: str, items: List[Dict[str, Any]]) -> bool:
    url = f"{API_BASE}/api/admin/products/{product_id}/calendar-prices"
    body = json.dumps({"items": items}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
            return True
    except urllib.error.HTTPError as e:
        logger.error("save_calendar_prices %s HTTPError %s", product_id, e.code)
        return False
    except Exception as e:
        logger.exception("save_calendar_prices %s: %s", product_id, e)
        return False


def _process_one_attempt(
    product: Dict[str, Any],
    rng: Optional[Tuple[str, str]],
    max_saved_ymd_holder: List[str],
) -> str:
    """returns 'ok' | 'fail' | 'skip'"""
    product_id = product.get("id") or ""
    detail_url = (product.get("detailUrl") or "").strip()
    site = (product.get("site") or "hanatour").strip().lower()
    if not product_id or not detail_url or not detail_url.startswith("http"):
        logger.warning("Skip (no id or detailUrl): %s", product)
        return "skip"
    headless = os.getenv("HEADLESS", "1") != "0"
    logger.info("Start id=%s site=%s range=%s", product_id, site, rng or "full")
    try:
        raw = _run_calendar_price_from_url(detail_url, site, headless=headless)
        items = _normalize_scraper_payload_to_api_items(raw, site)
        if rng:
            lo, hi = rng
            items = _filter_items_by_range(items, lo, hi)
        logger.info("Scraped id=%s rows=%d (after range filter)", product_id, len(items))
        if not items:
            return "fail"
        if save_calendar_prices(product_id, items):
            logger.info("Saved id=%s", product_id)
            for it in items:
                y = _item_date_ymd(it)
                if y and (not max_saved_ymd_holder[0] or y > max_saved_ymd_holder[0]):
                    max_saved_ymd_holder[0] = y
            return "ok"
        logger.warning("Save failed id=%s", product_id)
        return "fail"
    except Exception as e:
        logger.exception("Product id=%s error: %s", product_id, e)
        return "fail"


def process_one_with_retries(
    product: Dict[str, Any],
    rng: Optional[Tuple[str, str]],
    max_saved_ymd_holder: List[str],
) -> str:
    for attempt in range(1, MAX_RETRIES_PER_PRODUCT + 1):
        st = _process_one_attempt(product, rng, max_saved_ymd_holder)
        if st == "ok" or st == "skip":
            return st
        if attempt < MAX_RETRIES_PER_PRODUCT:
            backoff = random.uniform(30.0, 60.0)
            logger.warning(
                "Retry id=%s attempt %d/%d after %.1fs",
                product.get("id"),
                attempt,
                MAX_RETRIES_PER_PRODUCT,
                backoff,
            )
            time.sleep(backoff)
    return "fail"


def _is_modetour_site(site: str) -> bool:
    return (site or "").strip().lower() == "modetour"


def _supplier_block_applies(site: str) -> bool:
    """non-modetour: 상품 단위 cursor 전진만. modetour legacy만 연속 실패 시 공급사 일괄 skip."""
    return _is_modetour_site(site) and MODETOUR_SUPPLIER_BLOCK_CONSECUTIVE_FAILS > 0


def _reset_site_fail_counter(site: str, consecutive_site_fail: Dict[str, int]) -> None:
    if _supplier_block_applies(site):
        consecutive_site_fail[site] = 0


def _bump_site_fail_counter(
    site: str,
    consecutive_site_fail: Dict[str, int],
    skipped_sites: set[str],
) -> None:
    if not _supplier_block_applies(site):
        return
    consecutive_site_fail[site] = consecutive_site_fail.get(site, 0) + 1
    threshold = MODETOUR_SUPPLIER_BLOCK_CONSECUTIVE_FAILS
    if consecutive_site_fail[site] >= threshold:
        logger.error(
            "Skip supplier after %d consecutive failures: %s",
            threshold,
            site,
        )
        skipped_sites.add(site)


def _apply_site_gaps(prev_site: Optional[str], site: str) -> None:
    if prev_site is None:
        return
    if site != prev_site:
        sw = random.uniform(8.0, 15.0)
        logger.info("Site switch delay %.1fs (%s -> %s)", sw, prev_site, site)
        time.sleep(sw)
    else:
        gap = random.uniform(4.0, 7.0)
        logger.info("Product gap %.1fs (same site)", gap)
        time.sleep(gap)


def run_batch() -> Dict[str, Any]:
    run_started = time.monotonic()
    all_products = fetch_products()
    if not all_products:
        logger.info("No products.")
        out = {
            "status": "failed",
            "lastCollectedDateYmd": None,
            "totalProducts": 0,
            "succeeded": 0,
            "failed": 0,
            "reason": "no_products",
        }
        _emit_batch_result(out)
        return out

    n_total = len(all_products)
    start_idx = max(0, min(SEQ_START_INDEX, n_total))
    products = all_products[start_idx:]
    logger.info(
        "Batch sequential: %d products from index=%d / %d total horizon=%s budget=%.0fs",
        len(products),
        start_idx,
        n_total,
        HORIZON_END or "-",
        WALL_BUDGET_SEC,
    )

    max_saved_ymd: List[str] = [""]
    ok_c = 0
    fail_c = 0
    skip_c = 0
    prev_site: Optional[str] = None
    consecutive_site_fail: Dict[str, int] = {}
    skipped_sites: set[str] = set()
    last_completed_index = start_idx - 1
    processed_count = 0

    logger.info("Batch start mode=%s per-product windows", BATCH_MODE)

    for i, product in enumerate(products, 1):
        if time.monotonic() - run_started > WALL_BUDGET_SEC:
            logger.info("Wall budget reached before product i=%d", i)
            break

        abs_index = start_idx + i - 1
        site = str(product.get("site") or "hanatour").strip().lower()

        if _supplier_block_applies(site) and site in skipped_sites:
            skip_c += 1
            logger.info("Skip (supplier blocked): %s id=%s", site, product.get("id"))
            last_completed_index = abs_index
            processed_count += 1
            continue

        if product.get("retired"):
            skip_c += 1
            logger.info("Skip retired id=%s", product.get("id"))
            last_completed_index = abs_index
            processed_count += 1
            continue

        _apply_site_gaps(prev_site, site)
        prev_site = site

        if _is_modetour_legacy(product, site):
            legacy_rng = _legacy_rng(product)
            try:
                st = process_one_with_retries(product, legacy_rng, max_saved_ymd)
                if st == "ok":
                    ok_c += 1
                    _reset_site_fail_counter(site, consecutive_site_fail)
                elif st == "skip":
                    skip_c += 1
                else:
                    fail_c += 1
                    _bump_site_fail_counter(site, consecutive_site_fail, skipped_sites)
            except Exception as e:
                logger.exception("modetour legacy item failed: %s", e)
                fail_c += 1
                _bump_site_fail_counter(site, consecutive_site_fail, skipped_sites)
            last_completed_index = abs_index
            processed_count += 1
            continue

        rng = _product_rng(product)
        range_end = str(product.get("rangeEndYmd") or (rng[1] if rng else ""))[:10]

        if product.get("windowEmpty") or not rng:
            _advance_product_after_window(product, range_end)
            skip_c += 1
            logger.info(
                "Skip empty window id=%s atHorizon=%s windowEmpty=%s",
                product.get("id"),
                product.get("atHorizon"),
                product.get("windowEmpty"),
            )
            last_completed_index = abs_index
            processed_count += 1
            continue

        lo, hi = rng
        try:
            _set_site_date_env(site, lo, hi)
            st = process_one_with_retries(product, rng, max_saved_ymd)
            if st in ("ok", "fail"):
                _advance_product_after_window(product, hi)
            if st == "ok":
                ok_c += 1
                _reset_site_fail_counter(site, consecutive_site_fail)
            elif st == "skip":
                skip_c += 1
            else:
                fail_c += 1
                # 실패해도 _advance_product_after_window 로 해당 상품 cursor 전진 → 다음 상품으로
                _bump_site_fail_counter(site, consecutive_site_fail, skipped_sites)
        except Exception as e:
            logger.exception("Item %d failed: %s", i, e)
            fail_c += 1
            _advance_product_after_window(product, hi)
            _bump_site_fail_counter(site, consecutive_site_fail, skipped_sites)
        finally:
            _clear_site_date_env()

        last_completed_index = abs_index
        processed_count += 1

    next_index = last_completed_index + 1
    if next_index >= n_total:
        next_index = 0

    if ok_c == 0:
        status = "failed"
        last_ymd = None
    elif fail_c > 0:
        status = "partial"
        last_ymd = max_saved_ymd[0] or None
    else:
        status = "success"
        last_ymd = max_saved_ymd[0] or None

    out = {
        "status": status,
        "lastCollectedDateYmd": last_ymd,
        "totalProducts": processed_count,
        "succeeded": ok_c,
        "failed": fail_c,
        "skipped": skip_c,
        "nextProductIndex": next_index,
        "resumedFromIndex": start_idx,
        "wallBudgetSec": WALL_BUDGET_SEC,
    }
    logger.info("Batch done: %s", out)
    _emit_batch_result(out)
    return out


def main() -> None:
    if "--once" in sys.argv:
        logger.info("Run once (--once)")
        run_batch()
        return
    scheduler = BlockingScheduler()
    scheduler.add_job(
        run_batch,
        "cron",
        hour=SCHEDULER_HOUR,
        minute=SCHEDULER_MINUTE,
        id="calendar_price_batch",
    )
    logger.info("Scheduler: daily at %02d:%02d", SCHEDULER_HOUR, SCHEDULER_MINUTE)
    scheduler.start()


if __name__ == "__main__":
    main()
