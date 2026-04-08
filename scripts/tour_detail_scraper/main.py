# -*- coding: utf-8 -*-
"""
복합 도시 패키지 상세 스크래퍼 진입점.
하나투어/모두투어: target_cities 최대 20개, 아코디언 일정 해체, 도시별 이미지 1:1, 달력 페이징.
"""
import asyncio
import json
import sys
from pathlib import Path
from typing import List

from playwright.async_api import async_playwright

from . import config
from .utils import get_random_user_agent, random_delay, set_delay_bounds
from .navigation import navigate_to_list_and_collect_urls
from .detail_parser import parse_detail_page


async def run(
    target_cities: List[str],
    menu_path: List[str],
    site: str = "hanatour",
    headless: bool = True,
    max_products: int = 0,
) -> List[dict]:
    """
    target_cities: ['오사카', '교토', '고베'] (최대 20개)
    menu_path: ['해외여행', '일본', '간사이']
    site: 'hanatour' | 'modetour'
    반환: 산출물 스키마 리스트 (상품별 1개).
    """
    if len(target_cities) > config.MAX_TARGET_CITIES:
        target_cities = target_cities[: config.MAX_TARGET_CITIES]
    set_delay_bounds(config.MIN_DELAY, config.MAX_DELAY)

    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        context = await browser.new_context(
            user_agent=get_random_user_agent(),
            viewport={"width": 1920, "height": 1080},
            locale="ko-KR",
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )
        page = await context.new_page()
        page.set_default_timeout(config.PAGE_LOAD_TIMEOUT_MS)

        try:
            urls = await navigate_to_list_and_collect_urls(
                page, menu_path, target_cities, site
            )
            if max_products > 0:
                urls = urls[:max_products]
            for url in urls:
                await random_delay(1.5, 3.5)
                try:
                    data = await parse_detail_page(page, url, target_cities)
                    data["detail_url"] = url
                    results.append(data)
                except Exception as e:
                    results.append({
                        "product_info": {"name": "", "base_price": 0, "tags": [], "min_pax": 0},
                        "city_images": {},
                        "itinerary": [],
                        "calendar_logs": [],
                        "_error": str(e),
                        "detail_url": url,
                    })
        finally:
            await browser.close()

    return results


def save_results(
    results: List[dict],
    site: str,
    target_cities: List[str],
) -> Path:
    cities_key = "_".join(target_cities[:10])
    if len(target_cities) > 10:
        cities_key += f"_외{len(target_cities) - 10}개"
    out_path = config.get_output_path(site, cities_key)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "target_cities": target_cities,
                "site": site,
                "products": results,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    return out_path


def main():
    target_cities = ["오사카", "교토", "고베"]
    menu_path = ["해외여행", "일본", "간사이"]
    site = "hanatour"
    headless = "--no-headless" not in sys.argv
    max_products = 0
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) >= 1:
        target_cities = [c.strip() for c in args[0].split(",") if c.strip()]
    if len(args) >= 2:
        menu_path = [p.strip() for p in args[1].split(",") if p.strip()]
    if len(args) >= 3:
        site = args[2].strip().lower() or "hanatour"
    for a in args[3:]:
        if a.isdigit():
            max_products = int(a)
            break
    results = asyncio.run(
        run(
            target_cities=target_cities,
            menu_path=menu_path,
            site=site,
            headless=headless,
            max_products=max_products,
        )
    )
    out = save_results(results, site, target_cities)
    print(f"저장: {out}, 상품 수: {len(results)}")


if __name__ == "__main__":
    main()
