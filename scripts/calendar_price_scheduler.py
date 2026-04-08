# -*- coding: utf-8 -*-
"""
달력 가격 스크래퍼 자동 실행: 상품을 하나씩 순차 처리 후 DB 저장.
공급사별 calendar E2E 모듈로만 위임한다 (스크래프 로직은 각 패키지 내부).
"""
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
from typing import Any, Dict, List

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
REST_MIN = float(os.getenv("SCHEDULER_REST_MIN", "30"))
REST_MAX = float(os.getenv("SCHEDULER_REST_MAX", "60"))

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


def _run_calendar_price_from_url(detail_url: str, site: str, headless: bool) -> List[Dict[str, Any]]:
    mod_name = _calendar_module_for_site(site)
    mod = importlib.import_module(mod_name)
    return asyncio.run(
        mod.run_calendar_price_from_url(detail_url, headless=headless)
    )


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


def process_one(product: Dict[str, Any]) -> None:
    product_id = product.get("id") or ""
    detail_url = (product.get("detailUrl") or "").strip()
    site = (product.get("site") or "hanatour").strip().lower()
    if not product_id or not detail_url or not detail_url.startswith("http"):
        logger.warning("Skip (no id or detailUrl): %s", product)
        return
    headless = os.getenv("HEADLESS", "1") != "0"
    logger.info("Start id=%s site=%s", product_id, site)
    try:
        items = _run_calendar_price_from_url(detail_url, site, headless=headless)
        logger.info("Scraped id=%s count=%d", product_id, len(items))
        if items:
            if save_calendar_prices(product_id, items):
                logger.info("Saved id=%s", product_id)
            else:
                logger.warning("Save failed id=%s", product_id)
    except Exception as e:
        logger.exception("Product id=%s error: %s", product_id, e)


def run_batch() -> None:
    products = fetch_products()
    if not products:
        logger.info("No products.")
        return
    logger.info("Batch start: %d products", len(products))
    for i, product in enumerate(products, 1):
        try:
            process_one(product)
        except Exception as e:
            logger.exception("Item %d failed: %s", i, e)
        if i < len(products):
            rest = random.uniform(REST_MIN, REST_MAX)
            logger.info("Rest %.1fs...", rest)
            time.sleep(rest)
    logger.info("Batch done: %d products", len(products))


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
