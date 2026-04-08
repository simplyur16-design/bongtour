# -*- coding: utf-8 -*-
"""
E2E 달력 스크래퍼 진입점.
메인 페이지 ~ 이중 화살표 달력 1년 치 수집 후 JSON 저장.
"""
import asyncio
import json
import sys
from pathlib import Path

from . import config
from .scraper import CalendarE2EScraper


def save_result(data: dict, city: str) -> Path:
    """산출물 JSON 저장. 구조: city, products: [ { product_name, calendar_logs }, ... ]."""
    out_path = config.get_output_path(city)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "city": data.get("city", city),
        "products": data.get("products", []),
    }
    if "_error" in data:
        payload["_error"] = data["_error"]
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return out_path


async def run_async(
    target_country: str = "일본",
    target_city: str = "오사카",
    headless: bool = True,
) -> dict:
    async with CalendarE2EScraper(
        target_country=target_country,
        target_city=target_city,
        headless=headless,
    ) as scraper:
        return await scraper.run()


def main():
    target_country = "일본"
    target_city = "오사카"
    headless = "--no-headless" not in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) >= 1:
        target_city = args[0].strip()
    if len(args) >= 2:
        target_country = args[1].strip()
    result = asyncio.run(
        run_async(
            target_country=target_country,
            target_city=target_city,
            headless=headless,
        )
    )
    out = save_result(result, target_city)
    products = result.get("products", [])
    total_logs = sum(len(p.get("calendar_logs", [])) for p in products)
    print(f"저장: {out}, 상품 수: {len(products)}, 수집 일수: {total_logs}")


if __name__ == "__main__":
    main()
