# -*- coding: utf-8 -*-
"""
달력 가격 스크래퍼 자동 실행: 상품을 하나씩 순차 처리 후 DB 저장.
공급사별 calendar E2E 모듈로만 위임한다 (스크래프 로직은 각 패키지 내부).

환경변수(선택):
  SCRAPER_CALENDAR_RANGE_START, SCRAPER_CALENDAR_RANGE_END — YYYY-MM-DD 닫힌 구간 필터
  SCRAPER_BATCH_MODE — initial | maintenance (로그용)
  SCRAPER_MAX_PRODUCTS_PER_RUN — 기본 30 (한 실행당 상품 수 상한)
  SCRAPER_DAY_ROTATION_SLOTS — 기본 3 (KST 일자 기준 로테이션, API 목록 순서대로 3일에 나눠 처리)
완료 시 stdout 마지막에 `BONGTOUR_BATCH_RESULT:{json}` 1줄 출력.
"""
from __future__ import annotations

import asyncio
import importlib
import json
import logging
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
RANGE_START = (os.getenv("SCRAPER_CALENDAR_RANGE_START") or "").strip()[:10]
MAX_PRODUCTS_PER_RUN = int(os.getenv("SCRAPER_MAX_PRODUCTS_PER_RUN", "30"))
DAY_ROTATION_SLOTS = int(os.getenv("SCRAPER_DAY_ROTATION_SLOTS", "3"))
MAX_RETRIES_PER_PRODUCT = 3
RANGE_END = (os.getenv("SCRAPER_CALENDAR_RANGE_END") or "").strip()[:10]
BATCH_MODE = (os.getenv("SCRAPER_BATCH_MODE") or "").strip() or "daemon"

_CALENDAR_MODULE_BY_SITE: Dict[str, str] = {
    "hanatour": "scripts.calendar_e2e_scraper_hanatour.calendar_price_scraper",
    "modetour": "scripts.calendar_e2e_scraper_modetour.calendar_price_scraper",
    "verygoodtour": "scripts.calendar_e2e_scraper_verygoodtour.calendar_price_scraper",
    "ybtour": "scripts.calendar_e2e_scraper_ybtour.calendar_price_scraper",
    "yellowballoon": "scripts.calendar_e2e_scraper_ybtour.calendar_price_scraper",
}


def _calendar_module_for_site(site: str) -> str:
    raw = (site or "hanatour").strip().lower()
    if raw == "yellowballoon":
        raw = "ybtour"
    return _CALENDAR_MODULE_BY_SITE.get(raw) or _CALENDAR_MODULE_BY_SITE["hanatour"]


def _run_calendar_price_from_url(detail_url: str, site: str, headless: bool) -> Any:
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


def _parse_range() -> Optional[Tuple[str, str]]:
    if not RANGE_START or not RANGE_END or len(RANGE_START) != 10 or len(RANGE_END) != 10:
        return None
    if RANGE_START > RANGE_END:
        return None
    return (RANGE_START, RANGE_END)


def _in_range(ymd: str, lo: str, hi: str) -> bool:
    return bool(ymd) and len(ymd) >= 10 and lo <= ymd[:10] <= hi


def _filter_items_by_range(items: List[Dict[str, Any]], lo: str, hi: str) -> List[Dict[str, Any]]:
    return [x for x in items if _in_range(_item_date_ymd(x), lo, hi)]


def _ordinal_kst_date() -> int:
    from datetime import datetime, timedelta, timezone

    kst = timezone(timedelta(hours=9))
    return datetime.now(kst).date().toordinal()


def _select_products_for_run(products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """ScraperQueue 우선 순서 유지한 채, KST 기준 3일 로테이션으로 최대 30건만."""
    n = len(products)
    if n == 0:
        return []
    if n <= MAX_PRODUCTS_PER_RUN:
        return list(products)
    slot = _ordinal_kst_date() % DAY_ROTATION_SLOTS
    start = slot * MAX_PRODUCTS_PER_RUN
    if start >= n:
        start = 0
    end = min(start + MAX_PRODUCTS_PER_RUN, n)
    return products[start:end]


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
    logger.info("Start id=%s site=%s", product_id, site)
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


def run_batch() -> Dict[str, Any]:
    rng = _parse_range()
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

    products = _select_products_for_run(all_products)
    logger.info(
        "Batch slice: %d / %d total (max %d, KST day_slot=%s)",
        len(products),
        len(all_products),
        MAX_PRODUCTS_PER_RUN,
        _ordinal_kst_date() % DAY_ROTATION_SLOTS,
    )

    max_saved_ymd: List[str] = [""]
    ok_c = 0
    fail_c = 0
    skip_c = 0
    prev_site: Optional[str] = None
    consecutive_site_fail: Dict[str, int] = {}
    skipped_sites: set[str] = set()

    logger.info("Batch start: %d products mode=%s range=%s", len(products), BATCH_MODE, rng or "full")

    for i, product in enumerate(products, 1):
        site = str(product.get("site") or "hanatour").strip().lower()
        if site in skipped_sites:
            skip_c += 1
            logger.info("Skip (supplier blocked): %s id=%s", site, product.get("id"))
            continue
        if prev_site is not None:
            if site != prev_site:
                sw = random.uniform(8.0, 15.0)
                logger.info("Site switch delay %.1fs (%s -> %s)", sw, prev_site, site)
                time.sleep(sw)
            else:
                gap = random.uniform(4.0, 7.0)
                logger.info("Product gap %.1fs (same site)", gap)
                time.sleep(gap)
        prev_site = site

        try:
            st = process_one_with_retries(product, rng, max_saved_ymd)
            if st == "ok":
                ok_c += 1
                consecutive_site_fail[site] = 0
            elif st == "skip":
                skip_c += 1
            else:
                fail_c += 1
                consecutive_site_fail[site] = consecutive_site_fail.get(site, 0) + 1
                if consecutive_site_fail[site] >= 3:
                    logger.error("Skip supplier after 3 consecutive failures: %s", site)
                    skipped_sites.add(site)
        except Exception as e:
            logger.exception("Item %d failed: %s", i, e)
            fail_c += 1
            consecutive_site_fail[site] = consecutive_site_fail.get(site, 0) + 1
            if consecutive_site_fail[site] >= 3:
                skipped_sites.add(site)

    total = len(products)
    if ok_c == 0:
        status = "failed"
        last_ymd = None
    elif fail_c > 0:
        status = "partial"
        last_ymd = max_saved_ymd[0] or None
    else:
        status = "success"
        last_ymd = (rng[1] if rng else None) or max_saved_ymd[0] or None

    out = {
        "status": status,
        "lastCollectedDateYmd": last_ymd,
        "totalProducts": total,
        "succeeded": ok_c,
        "failed": fail_c,
        "skipped": skip_c,
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
