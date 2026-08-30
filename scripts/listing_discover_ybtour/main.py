# -*- coding: utf-8 -*-
"""ybtour 목록 — 사람처럼 localList 읽기. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-listing-discover-playwright]: ybtour listing Playwright — manifest
# REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: localList only — no detailPackage fallback — manifest
# REGRESSION-FREEZE[register-listing-discover-human-pace]: parent localList first · bundled Chromium — manifest
# REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행 클릭 후 localList 보완 — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys
from urllib.parse import parse_qs, quote, urlparse

from scripts.listing_prefer_no_shop_option import (
    order_codes_prefer_no_option_no_shopping,
    order_urls_prefer_no_option_no_shopping,
)

PAUSE_MS_MIN = 7000
PAUSE_MS_MAX = 12000
SETTLE_MS = 4500
GOTO_TIMEOUT_MS = 50000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
EV_RE = re.compile(r"(?:[?&]evCd=|\"(?:evCd|evcd|eventCd)\"\s*:\s*\")([A-Za-z0-9-]+)", re.I)
EV_OK = re.compile(r"^[A-Z0-9]+-\d{6}", re.I)
GOODS_RE = re.compile(r"(?:[?&]goodsCd=|\"(?:goodsCd|goodscd)\"\s*:\s*\")([A-Za-z0-9]+)", re.I)
GOODS_OK = re.compile(r"^[A-Z]{2,4}\d{3,5}$", re.I)


def _pause_s() -> float:
    return (PAUSE_MS_MIN + random.randint(0, PAUSE_MS_MAX - PAUSE_MS_MIN)) / 1000.0


def _dsp_sid(url: str) -> str:
    q = parse_qs(urlparse(url).query)
    v = (q.get("dspSid") or [""])[0].strip()
    return v


def _extract(blob: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in EV_RE.finditer(blob or ""):
        ev = m.group(1).strip()
        if not EV_OK.match(ev):
            continue
        key = ev.upper()
        if key in seen:
            continue
        seen.add(key)
        out.append(ev)
    return out


def _extract_goods(blob: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in GOODS_RE.finditer(blob or ""):
        goods = m.group(1).strip()
        if EV_OK.match(goods):
            goods = goods.split("-", 1)[0]
        if not GOODS_OK.match(goods):
            continue
        key = goods.upper()
        if key in seen:
            continue
        seen.add(key)
        out.append(goods)
    return out


def _merge(a: list[str], b: list[str]) -> list[str]:
    seen = {x.upper() for x in a}
    out = list(a)
    for x in b:
        k = x.upper()
        if k in seen:
            continue
        seen.add(k)
        out.append(x)
    return out


def _urls(ev_cds: list[str], goods_cds: list[str], dsp_sid: str, menu: str) -> list[str]:
    out: list[str] = []
    bases = {ev.split("-", 1)[0].upper() for ev in ev_cds}
    dsp_q = f"&dspSid={quote(dsp_sid)}" if dsp_sid else ""
    for ev in ev_cds:
        out.append(
            "https://prdt.ybtour.co.kr/product/detailPackage"
            f"?menu={quote(menu)}{dsp_q}&evCd={quote(ev)}"
        )
    for goods in goods_cds:
        if goods.upper() in bases:
            continue
        out.append(
            "https://prdt.ybtour.co.kr/product/detailPackage"
            f"?menu={quote(menu)}{dsp_q}&goodsCd={quote(goods)}"
        )
    return out[:24]


def _short_word(raw: str) -> str:
    s = (raw or "").strip()
    s = re.sub(r"\([^)]*\)", " ", s)
    for sep in ("·", ",", "/", "|", " 외"):
        if sep in s:
            s = s.split(sep, 1)[0]
    s = re.sub(r"\s+", " ", s).strip()
    first = (s.split(" ") or [""])[0]
    return first[:12]


def _parents(word: str) -> list[str]:
    table = {
        "프랑스": ["유럽"],
        "파리": ["유럽", "프랑스"],
        "오사카": ["일본"],
        "도쿄": ["일본"],
        "다낭": ["동남아", "동남아시아", "베트남"],
        "스페인": ["유럽"],
        "바르셀로나": ["유럽", "스페인"],
        "마드리드": ["유럽", "스페인"],
    }
    return table.get(word, [])


async def _capture(resp, bag: list[str]) -> None:
    try:
        ct = (resp.headers or {}).get("content-type", "")
        if "json" not in ct and "text" not in ct and "javascript" not in ct:
            return
        text = await asyncio.wait_for(resp.text(), timeout=4)
        if "evCd" in text or "goodsCd" in text:
            bag.append(text[:1_500_000])
    except Exception:
        return


async def _snapshot(page, bag: list[str]) -> tuple[list[str], list[str]]:
    html = await page.content()
    hrefs = await page.eval_on_selector_all(
        "a[href]",
        "els => els.map(e => e.href || '')",
    )
    blob = html + "\n" + "\n".join(hrefs or []) + "\n" + "\n".join(bag)
    return _extract(blob), _extract_goods(blob)


async def _goto_collect(page, url: str, bag: list[str]) -> tuple[list[str], list[str]]:
    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    page.on("response", on_resp)
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        await page.wait_for_timeout(SETTLE_MS)
        try:
            await page.wait_for_selector('a[href*="evCd"], a[href*="goodsCd"]', timeout=12000)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=8)
        ids, goods = await _snapshot(page, bag)
        for _ in range(8):
            try:
                await page.mouse.wheel(0, 1600)
                await page.wait_for_timeout(1100)
            except Exception:
                break
            more_ids, more_goods = await _snapshot(page, bag)
            ids = _merge(ids, more_ids)
            goods = _merge(goods, more_goods)
            if len(ids) + len(goods) >= 24:
                return ids[:24], goods[:24]
        for _ in range(3):
            clicked = False
            for sel in ("button:has-text('더보기')", "a:has-text('더보기')", "a:has-text('다음')", "a:has-text('2')"):
                loc = page.locator(sel).first
                try:
                    if await loc.count() == 0:
                        continue
                    await loc.click(timeout=2500)
                    await page.wait_for_timeout(SETTLE_MS)
                    more_ids, more_goods = await _snapshot(page, bag)
                    ids = _merge(ids, more_ids)
                    goods = _merge(goods, more_goods)
                    clicked = True
                    break
                except Exception:
                    continue
            if not clicked:
                break
        return ids[:24], goods[:24]
    except Exception as e:
        print(f"[listing-discover-ybtour] goto fail {url[:80]} {e}", file=sys.stderr)
        return [], []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


async def _click_label(page, word: str) -> bool:
    escaped = re.escape(word)
    for loc in (
        page.get_by_role("link", name=word, exact=True),
        page.get_by_role("button", name=word, exact=True),
        page.get_by_text(word, exact=True),
        page.get_by_role("link", name=re.compile(escaped)),
        page.locator("a", has_text=word),
        page.locator("span", has_text=word),
        page.locator("li", has_text=word),
    ):
        try:
            target = loc.first
            if await target.count() == 0:
                continue
            try:
                await target.scroll_into_view_if_needed(timeout=2000)
            except Exception:
                pass
            await target.click(timeout=4000, force=True)
            return True
        except Exception:
            continue
    return False


async def _hover_overseas(page) -> bool:
    for text in ("해외여행", "해외패키지", "패키지"):
        loc = page.get_by_role("link", name=text).first
        try:
            if await loc.count() == 0:
                continue
            await loc.hover(timeout=2500)
            await page.wait_for_timeout(1500)
            return True
        except Exception:
            continue
    return False


async def _browse_overseas(page, word: str, bag: list[str], menu: str) -> tuple[list[str], list[str]]:
    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    try:
        page.on("response", on_resp)
        await page.goto("https://www.ybtour.co.kr/", wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        await page.wait_for_timeout(SETTLE_MS)
        if not await _hover_overseas(page):
            print("[listing-discover-ybtour] no 해외여행 menu", file=sys.stderr)
            return [], []
        landing_ids, landing_goods = await _snapshot(page, bag)
        if menu == "FIT":
            await _click_label(page, "자유여행")
            await page.wait_for_timeout(700)
            await _hover_overseas(page)
        clicked = await _click_label(page, word)
        if not clicked:
            for parent in _parents(word)[:1]:
                if await _click_label(page, parent):
                    await page.wait_for_timeout(800)
                    await _hover_overseas(page)
                    clicked = await _click_label(page, word)
                    if clicked:
                        break
        if not clicked:
            for text in ("해외여행", "해외패키지"):
                loc = page.get_by_role("link", name=text).first
                try:
                    if await loc.count() == 0:
                        continue
                    await loc.click(timeout=2500)
                    break
                except Exception:
                    continue
            await page.wait_for_timeout(900)
            clicked = await _click_label(page, word)
        if not clicked:
            print(f"[listing-discover-ybtour] no click {word}", file=sys.stderr)
        await page.wait_for_timeout(SETTLE_MS + 1400)
        try:
            await page.mouse.wheel(0, 1200)
            await page.wait_for_timeout(800)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=6)
        after_ids, after_goods = await _snapshot(page, bag)
        return _merge(landing_ids, after_ids), _merge(landing_goods, after_goods)
    except Exception as e:
        print(f"[listing-discover-ybtour] browse fail {e}", file=sys.stderr)
        return [], []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


async def discover_slots(slots: list[dict]) -> list[dict]:
    from playwright.async_api import async_playwright

    results: list[dict] = []
    async with async_playwright() as p:
        launch_args = [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ]
        browser = await p.chromium.launch(headless=True, args=launch_args)
        ctx = await browser.new_context(
            locale="ko-KR",
            viewport={"width": 1920, "height": 1080},
            user_agent=UA,
        )
        page = await ctx.new_page()
        page.set_default_timeout(GOTO_TIMEOUT_MS)
        try:
            for slot in slots:
                sid = str(slot.get("id") or "")
                seed = str(slot.get("seedOriginUrl") or "").strip()
                word = _short_word(str(slot.get("searchWord") or "").strip())
                menu = str(slot.get("listingMenu") or "PKG").upper()
                if menu != "FIT":
                    menu = "PKG"
                dsp = _dsp_sid(seed)
                bag: list[str] = []
                await asyncio.sleep(_pause_s())
                ids: list[str] = []
                goods: list[str] = []
                try:
                    if word:
                        ids, goods = await _browse_overseas(page, word, bag, menu)
                    if len(ids) + len(goods) < 8 and dsp:
                        parent = (dsp[:-3] + "000") if len(dsp) >= 6 and not dsp.endswith("000") else ""
                        if parent and parent != dsp:
                            parent_url = (
                                "https://prdt.ybtour.co.kr/product/localList"
                                f"?menu={quote(menu)}&dspSid={quote(parent)}"
                            )
                            more_ids, more_goods = await _goto_collect(page, parent_url, bag)
                            ids = _merge(ids, more_ids)
                            goods = _merge(goods, more_goods)
                            await asyncio.sleep(_pause_s())
                        if len(ids) + len(goods) < 12:
                            list_url = (
                                "https://prdt.ybtour.co.kr/product/localList"
                                f"?menu={quote(menu)}&dspSid={quote(dsp)}"
                            )
                            more_ids, more_goods = await _goto_collect(page, list_url, bag)
                            ids = _merge(ids, more_ids)
                            goods = _merge(goods, more_goods)
                    # 시드 상세(detailPackage)는 이미 등록된 상품 1~2개만 나온다. 목록 대신 쓰지 않는다.
                    blob = "\n".join(bag)
                    ids = order_codes_prefer_no_option_no_shopping(ids, blob)
                    goods = order_codes_prefer_no_option_no_shopping(goods, blob)
                    urls = order_urls_prefer_no_option_no_shopping(_urls(ids, goods, dsp, menu), blob)
                    results.append({"id": sid, "urls": urls})
                    print(
                        f"[listing-discover-ybtour] slot={sid} ev={len(ids)} goods={len(goods)} urls={len(urls)}",
                        file=sys.stderr,
                    )
                except Exception as e:
                    print(f"[listing-discover-ybtour] slot-fail {sid} {e}", file=sys.stderr)
                    results.append({"id": sid, "urls": []})
                    try:
                        await page.close()
                    except Exception:
                        pass
                    page = await ctx.new_page()
                    page.set_default_timeout(GOTO_TIMEOUT_MS)
        finally:
            await browser.close()
    return results


def main() -> None:
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")
    payload = json.loads(raw or "{}")
    slots = payload.get("slots") if isinstance(payload, dict) else []
    if not isinstance(slots, list):
        slots = []
    try:
        results = asyncio.run(discover_slots(slots))
        print(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
    except Exception as e:
        print(f"[listing-discover-ybtour] fatal {e}", file=sys.stderr)
        print(json.dumps({"ok": False, "results": [], "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
