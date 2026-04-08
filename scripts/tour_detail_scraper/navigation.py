# -*- coding: utf-8 -*-
"""
다중 도시 라우팅: 메가 메뉴(Depth 1~4) + target_cities 필터링.
상품명 또는 해시태그에 target_cities 전체가 포함된 카드만 수집.
"""
from typing import List

from playwright.async_api import Page

from . import config
from .utils import random_delay, set_delay_bounds


async def navigate_to_list_and_collect_urls(
    page: Page,
    menu_path: List[str],
    target_cities: List[str],
    site: str,
) -> List[str]:
    """
    menu_path: ['해외여행', '일본', '간사이']
    target_cities: ['오사카', '교토', '고베'] (최대 20개)
    상품명 또는 해시태그에 target_cities의 모든 도시가 포함된 상품의 상세 URL만 반환.
    """
    set_delay_bounds(config.MIN_DELAY, config.MAX_DELAY)
    base_url = config.get_base_url(site)
    urls: List[str] = []

    await page.goto(base_url, wait_until="domcontentloaded", timeout=config.PAGE_LOAD_TIMEOUT_MS)
    await page.wait_for_load_state("networkidle", timeout=config.NETWORK_IDLE_TIMEOUT_MS)
    await random_delay(2.0, 4.0)

    # Depth 1~3: Hover -> Hover -> Click
    path = [p.strip() for p in menu_path if p and str(p).strip()]
    for i, label in enumerate(path):
        await random_delay()
        if i < len(path) - 1:
            ok = await _hover_by_text(page, label)
            if not ok:
                return []
        else:
            ok = await _click_by_text(page, label)
            if not ok:
                return []

    await random_delay(1.5, 3.0)

    # Depth 4: 상품 카드 순회, target_cities 전부 포함된 것만
    cards = await page.query_selector_all(config.SELECTOR_PRODUCT_CARD)
    for card in cards:
        try:
            name_el = await card.query_selector(config.SELECTOR_PRODUCT_NAME)
            name_text = (await name_el.text_content() or "").strip() if name_el else ""
            tags_el = await card.query_selector_all(config.SELECTOR_PRODUCT_TAGS)
            tags_text = " ".join((await t.text_content() or "").strip() for t in tags_el)
            combined = f"{name_text} {tags_text}"
            if not combined:
                continue
            if not all(city in combined for city in target_cities):
                continue
            link_el = await card.query_selector(config.SELECTOR_PRODUCT_LINK)
            if not link_el:
                link_el = await card.query_selector("a")
            if link_el:
                href = await link_el.get_attribute("href")
                if href:
                    full = href if href.startswith("http") else (base_url.rstrip("/") + href)
                    if full not in urls:
                        urls.append(full)
        except Exception:
            continue

    return urls


async def _hover_by_text(page: Page, text: str) -> bool:
    try:
        sel = f"a:has-text('{text}'), button:has-text('{text}'), [class*='menu']:has-text('{text}')"
        el = await page.wait_for_selector(sel, timeout=6000, state="visible")
        if el:
            await random_delay(0.5, 1.2)
            await el.hover()
            await random_delay(1.0, 2.0)
            return True
    except Exception:
        pass
    try:
        for node in await page.query_selector_all("nav a, .gnb a, header a"):
            t = await node.text_content()
            if t and text in (t or "").strip():
                await node.hover()
                await random_delay(1.0, 2.0)
                return True
    except Exception:
        pass
    return False


async def _click_by_text(page: Page, text: str) -> bool:
    try:
        sel = f"a:has-text('{text}'), .gnb_sub a:has-text('{text}'), .depth3 a:has-text('{text}')"
        el = await page.wait_for_selector(sel, timeout=6000, state="visible")
        if el:
            await random_delay(0.5, 1.2)
            await el.click()
            await random_delay(1.5, 3.0)
            return True
    except Exception:
        pass
    try:
        for node in await page.query_selector_all(".gnb_sub a, .sub_menu a, .depth3 a"):
            t = await node.text_content()
            if t and text in (t or "").strip():
                await node.click()
                await random_delay(1.5, 3.0)
                return True
    except Exception:
        pass
    return False
