# -*- coding: utf-8 -*-
"""
Depth 5~8: 상세 헤더, 일자별 아코디언 해체, 도시-이미지 1:1, 호텔, 달력 페이징.
"""
import asyncio
import re
from typing import Any, Dict, List

from playwright.async_api import Page

from . import config
from .utils import random_delay, clean_price_to_int, extract_min_pax_from_text


async def parse_detail_page(page: Page, detail_url: str, target_cities: List[str]) -> Dict[str, Any]:
    """
    상세 페이지 1개에 대해 product_info, city_images, itinerary, calendar_logs 추출.
    """
    result = {
        "product_info": {"name": "", "base_price": 0, "tags": [], "min_pax": 0},
        "city_images": {},
        "itinerary": [],
        "calendar_logs": [],
    }
    try:
        await page.goto(detail_url, wait_until="domcontentloaded", timeout=config.PAGE_LOAD_TIMEOUT_MS)
        await page.wait_for_load_state("networkidle", timeout=config.NETWORK_IDLE_TIMEOUT_MS)
        await random_delay(1.5, 2.5)
    except Exception as e:
        result["_error"] = str(e)
        return result

    result["product_info"] = await _parse_header_metadata(page)
    result["itinerary"], result["city_images"] = await _parse_accordion_itinerary(page, target_cities)
    result["itinerary"] = await _merge_hotels_into_itinerary(page, result["itinerary"])
    result["calendar_logs"] = await _parse_calendar_paging(page)
    return result


# ----- Depth 5: 헤더/메타데이터 -----
async def _parse_header_metadata(page: Page) -> Dict[str, Any]:
    info = {"name": "", "base_price": 0, "tags": [], "min_pax": 0}
    try:
        title_el = await page.query_selector(config.SELECTOR_DETAIL_TITLE)
        if title_el:
            info["name"] = (await title_el.text_content() or "").strip()
    except Exception:
        pass
    try:
        tag_els = await page.query_selector_all(config.SELECTOR_DETAIL_TAGS)
        tags = []
        for el in tag_els:
            t = (await el.text_content() or "").strip()
            if t and t not in tags:
                tags.append(t)
        info["tags"] = tags[:20]
    except Exception:
        pass
    try:
        price_el = await page.query_selector(config.SELECTOR_DETAIL_BASE_PRICE)
        if price_el:
            raw = (await price_el.text_content() or "").strip()
            info["base_price"] = clean_price_to_int(raw)
    except Exception:
        pass
    try:
        pax_el = await page.query_selector(config.SELECTOR_DETAIL_MIN_PAX)
        if pax_el:
            info["min_pax"] = extract_min_pax_from_text(await pax_el.text_content() or "")
        else:
            all_text = await page.evaluate("() => document.body.innerText")
            info["min_pax"] = extract_min_pax_from_text(all_text)
    except Exception:
        pass
    return info


# ----- Depth 6: 일자별 아코디언 + 도시-이미지 1:1 -----
async def _parse_accordion_itinerary(
    page: Page,
    target_cities: List[str],
) -> tuple:
    itinerary: List[Dict[str, Any]] = []
    city_images: Dict[str, str] = {}

    wrap = await page.query_selector(config.SELECTOR_ITINERARY_WRAP)
    if not wrap:
        return itinerary, city_images

    # N일차 버튼/아코디언 헤더 수집
    buttons = await page.query_selector_all(config.SELECTOR_DAY_ACCORDION_BTN_PATTERN)
    day_buttons = []
    for btn in buttons:
        try:
            text = (await btn.text_content() or "").strip()
            m = re.search(r"(\d+)\s*일\s*차", text)
            if m:
                day_buttons.append((int(m.group(1)), btn))
        except Exception:
            continue
    day_buttons.sort(key=lambda x: x[0])

    for day_num, btn in day_buttons:
        try:
            await random_delay(0.5, 1.2)
            await btn.click()
            await asyncio.sleep(0.8)
            try:
                await page.wait_for_selector(config.SELECTOR_DAY_BODY, timeout=3000)
            except Exception:
                pass
        except Exception:
            continue
        day_data = {
            "day": day_num,
            "cities_visited": [],
            "spots": [],
            "meals": {"조식": "", "중식": "", "석식": ""},
            "hotel": "",
        }
        body = await page.query_selector(config.SELECTOR_DAY_BODY)
        if not body:
            try:
                body = await page.query_selector(f"[class*='day']:has-text('{day_num}')")
            except Exception:
                pass
        if body:
            cities_in_day = await _extract_cities_from_day_body(body, target_cities)
            day_data["cities_visited"] = cities_in_day
            day_data["spots"] = await _extract_spots_from_body(body)
            day_data["meals"] = await _extract_meals_from_body(body)
            img_urls = await _extract_images_from_body(body)
            for idx, city in enumerate(cities_in_day):
                if city not in city_images:
                    url = img_urls[idx] if idx < len(img_urls) else (img_urls[0] if img_urls else "")
                    if url:
                        city_images[city] = url
        itinerary.append(day_data)

    return itinerary, city_images


def _city_from_text(text: str, target_cities: List[str]) -> List[str]:
    found = []
    for city in target_cities:
        if city in text:
            found.append(city)
    return found


async def _extract_cities_from_day_body(body, target_cities: List[str]) -> List[str]:
    cities = []
    try:
        text = await body.inner_text()
        for city in target_cities:
            if city in text and city not in cities:
                cities.append(city)
    except Exception:
        pass
    try:
        nodes = await body.query_selector_all(config.SELECTOR_CITY_IN_DAY)
        for node in nodes:
            t = (await node.text_content() or "").strip()
            for city in target_cities:
                if city in t and city not in cities:
                    cities.append(city)
    except Exception:
        pass
    return cities


async def _extract_spots_from_body(body) -> List[Dict[str, str]]:
    spots = []
    try:
        name_els = await body.query_selector_all(config.SELECTOR_SPOT_NAME)
        for el in name_els[:30]:
            name = (await el.text_content() or "").strip()
            if not name:
                continue
            desc = ""
            try:
                desc_el = await el.evaluate_handle("el => el.nextElementSibling")
                if desc_el:
                    desc = (await desc_el.text_content() or "").strip()
            except Exception:
                pass
            if not desc:
                try:
                    desc_el = await body.query_selector(config.SELECTOR_SPOT_DESC)
                    if desc_el:
                        desc = (await desc_el.text_content() or "").strip()
                except Exception:
                    pass
            spots.append({"name": name, "desc": desc[:500]})
    except Exception:
        pass
    return spots


async def _extract_meals_from_body(body) -> Dict[str, str]:
    out = {"조식": "", "중식": "", "석식": ""}
    try:
        text = (await body.inner_text() or "").strip()
        for key in ("조식", "중식", "석식"):
            m = re.search(rf"{key}\s*[:\-]?\s*([^\n]+)", text)
            if m:
                out[key] = m.group(1).strip()[:200]
    except Exception:
        pass
    try:
        meal_els = await body.query_selector_all(config.SELECTOR_MEALS)
        for el in meal_els:
            t = (await el.text_content() or "").strip()
            if "조식" in t:
                out["조식"] = t.replace("조식", "").strip()[:200]
            elif "중식" in t:
                out["중식"] = t.replace("중식", "").strip()[:200]
            elif "석식" in t:
                out["석식"] = t.replace("석식", "").strip()[:200]
    except Exception:
        pass
    return out


async def _extract_images_from_body(body) -> List[str]:
    urls = []
    try:
        imgs = await body.query_selector_all("img")
        for img in imgs:
            src = await img.get_attribute("src")
            if src and src.startswith("http") and "pixel" not in src and "blank" not in src:
                urls.append(src)
    except Exception:
        pass
    return urls


# ----- Depth 7: 호텔 탭 -> itinerary에 hotel 병합 -----
async def _merge_hotels_into_itinerary(page: Page, itinerary: List[Dict]) -> List[Dict]:
    try:
        tab = await page.query_selector(config.SELECTOR_TAB_HOTEL)
        if tab:
            await tab.click()
            await asyncio.sleep(1.0)
    except Exception:
        return itinerary
    hotels_by_day: Dict[int, str] = {}
    try:
        items = await page.query_selector_all(config.SELECTOR_HOTEL_BY_DAY)
        for i, item in enumerate(items):
            name_el = await item.query_selector(config.SELECTOR_HOTEL_NAME)
            name = (await name_el.text_content() or "").strip() if name_el else ""
            if name:
                hotels_by_day[i + 1] = name
    except Exception:
        pass
    for day_data in itinerary:
        d = day_data.get("day")
        if d and d in hotels_by_day:
            day_data["hotel"] = hotels_by_day[d]
    return itinerary


# ----- Depth 8: 달력 페이징 -----
async def _parse_calendar_paging(page: Page) -> List[Dict[str, Any]]:
    logs = []
    wrap = await page.query_selector(config.SELECTOR_CALENDAR_WRAP)
    if not wrap:
        return logs
    month_count = 0
    while month_count < config.CALENDAR_MAX_MONTHS:
        await asyncio.sleep(config.CALENDAR_PAGE_WAIT_MS / 1000.0)
        year_month_el = await page.query_selector(config.SELECTOR_CALENDAR_YEAR_MONTH)
        ym_text = (await year_month_el.text_content() or "").strip() if year_month_el else ""
        y, m = _parse_ym(ym_text)
        if not y or not m:
            break
        grid = await page.query_selector(config.SELECTOR_CALENDAR_GRID)
        if not grid:
            break
        cells = await grid.query_selector_all(config.SELECTOR_CALENDAR_CELL)
        for cell in cells:
            try:
                date_el = await cell.query_selector(config.SELECTOR_CELL_DATE)
                day_text = (await date_el.text_content() or "").strip() if date_el else ""
                if not day_text:
                    day_text = (await cell.text_content() or "").strip().split()[0]
                day = _day_num(day_text)
                if not day:
                    continue
                date_str = f"{y}-{m}-{day:02d}"
                price_el = await cell.query_selector(config.SELECTOR_CELL_PRICE)
                price_text = (await price_el.text_content() or "").strip() if price_el else ""
                if not price_text or price_text == "-":
                    continue
                price = clean_price_to_int(price_text)
                status_el = await cell.query_selector(config.SELECTOR_CELL_STATUS)
                status = (await status_el.text_content() or "").strip() if status_el else ""
                seats_el = await cell.query_selector(config.SELECTOR_CELL_SEATS)
                seats_text = (await seats_el.text_content() or "").strip() if seats_el else ""
                seats_left = 0
                sm = re.search(r"(\d+)\s*명", seats_text)
                if sm:
                    seats_left = int(sm.group(1))
                logs.append({
                    "date": date_str,
                    "price": price,
                    "status": status or "예약가능",
                    "seats_left": seats_left,
                })
            except Exception:
                continue
        month_count += 1
        next_btn = await page.query_selector(config.SELECTOR_CALENDAR_NEXT)
        if not next_btn:
            break
        try:
            dis = await next_btn.get_attribute("disabled")
            if dis is not None:
                break
        except Exception:
            pass
        try:
            await next_btn.click()
        except Exception:
            break
    return logs


def _parse_ym(text: str) -> tuple:
    if not text:
        return None, None
    m = re.search(r"(\d{4})\s*년?\s*(\d{1,2})\s*월?", text)
    if m:
        return m.group(1), m.group(2).zfill(2)
    nums = re.findall(r"\d+", text)
    if len(nums) >= 2:
        return nums[0], nums[1].zfill(2)
    return None, None


def _day_num(s: str):
    if not s:
        return None
    s = re.sub(r"\D", "", s)
    if not s:
        return None
    d = int(s)
    return d if 1 <= d <= 31 else None
