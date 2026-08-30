# -*- coding: utf-8 -*-
"""lottetour 목록 — 사람처럼 해외여행 클릭. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: lottetour overseas click — manifest
# REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행→메가메뉴 지명 클릭 — manifest
# REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
# REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: page hrefs only — no invented evtDetail — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys

from scripts.listing_prefer_no_shop_option import order_urls_prefer_no_option_no_shopping

PAUSE_MS_MIN = 13000
PAUSE_MS_MAX = 19000
SETTLE_MS = 5800
GOTO_TIMEOUT_MS = 52000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
HOME = "https://www.lottetour.com/"
HREF_RE = re.compile(
    r"https?://(?:www\.)?lottetour\.com/(?:evtDetail|evtList)/[^\s\"'<>#]+",
    re.I,
)
SEED_EVT = re.compile(r"[?&]evtCd=([A-Za-z0-9]+)", re.I)
SEED_GOD = re.compile(r"[?&]godId=(\d+)", re.I)


def _pause_s() -> float:
    return (PAUSE_MS_MIN + random.randint(0, PAUSE_MS_MAX - PAUSE_MS_MIN)) / 1000.0


def _short_word(raw: str) -> str:
    s = (raw or "").strip()
    s = re.sub(r"\([^)]*\)", " ", s)
    for sep in ("·", ",", "/", "|", " 외"):
        if sep in s:
            s = s.split(sep, 1)[0]
    s = re.sub(r"\s+", " ", s).strip()
    first = (s.split(" ") or [""])[0]
    return first[:12]


def _seed_keys(url: str) -> set[str]:
    keys: set[str] = set()
    m = SEED_EVT.search(url or "")
    if m:
        keys.add(f"evt:{m.group(1).upper()}")
    g = SEED_GOD.search(url or "")
    if g:
        keys.add(f"god:{g.group(1)}")
    return keys


def _url_keys(url: str) -> set[str]:
    keys: set[str] = set()
    m = SEED_EVT.search(url)
    if m:
        keys.add(f"evt:{m.group(1).upper()}")
    g = SEED_GOD.search(url)
    if g:
        keys.add(f"god:{g.group(1)}")
    return keys


def _extract(blob: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in HREF_RE.finditer(blob or ""):
        url = (m.group(0) or "").split("#")[0].replace("&amp;", "&")
        if not url:
            continue
        if "evtCd=" not in url and "godId=" not in url and "/evtDetail/" not in url.lower():
            continue
        key = url.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(url)
    return out


def _without_seed(urls: list[str], seed_keys: set[str]) -> list[str]:
    if not seed_keys:
        return urls
    out: list[str] = []
    for u in urls:
        if _url_keys(u) & seed_keys:
            continue
        out.append(u)
    return out


def _merge(a: list[str], b: list[str]) -> list[str]:
    seen = {x.lower() for x in a}
    out = list(a)
    for x in b:
        k = x.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(x)
    return out


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
        if resp is None:
            return
        try:
            if int(getattr(resp, "status", 200) or 200) >= 400:
                return
        except Exception:
            pass
        ct = (resp.headers or {}).get("content-type", "")
        if "json" not in ct and "text" not in ct and "javascript" not in ct:
            return
        text = await asyncio.wait_for(resp.text(), timeout=4)
        if "evtCd" in text or "godId" in text or "evtDetail" in text:
            bag.append(text[:1_500_000])
    except Exception:
        return


async def _snapshot(page, bag: list[str]) -> list[str]:
    try:
        html = await page.content()
        hrefs = await page.eval_on_selector_all(
            "a[href]",
            "els => els.map(e => e.href || '')",
        )
    except Exception:
        return _extract("\n".join(bag))
    return _extract(html + "\n" + "\n".join(hrefs or []) + "\n" + "\n".join(bag))


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
            await page.wait_for_timeout(1700)
            return True
        except Exception:
            continue
    return False


async def _browse_overseas(page, word: str, bag: list[str], menu: str) -> list[str]:
    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    try:
        if page.is_closed():
            return []
        page.on("response", on_resp)
        await page.goto(HOME, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        await page.wait_for_timeout(SETTLE_MS)
        if not await _hover_overseas(page):
            print("[listing-discover-lottetour] no 해외여행 menu", file=sys.stderr)
            return []
        landing = await _snapshot(page, bag)
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
            print(f"[listing-discover-lottetour] no click {word}", file=sys.stderr)
        await page.wait_for_timeout(SETTLE_MS + 1600)
        try:
            await page.mouse.wheel(0, 900)
            await page.wait_for_timeout(800)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=6)
        after = await _snapshot(page, bag)
        return _merge(landing, after)[:24]
    except Exception as e:
        print(f"[listing-discover-lottetour] browse fail {e}", file=sys.stderr)
        return []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


async def _ensure_page(ctx, page):
    try:
        if page is not None and not page.is_closed():
            return page
    except Exception:
        pass
    nxt = await ctx.new_page()
    nxt.set_default_timeout(GOTO_TIMEOUT_MS)
    return nxt


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
            viewport={"width": 1410, "height": 860},
            user_agent=UA,
        )
        page = await ctx.new_page()
        page.set_default_timeout(GOTO_TIMEOUT_MS)
        try:
            for slot in slots:
                sid = str(slot.get("id") or "")
                raw = str(slot.get("searchWord") or "").strip()
                menu = str(slot.get("listingMenu") or "PKG").upper()
                word = _short_word(raw)
                seed = str(slot.get("seedOriginUrl") or "").strip()
                seed_keys = _seed_keys(seed)
                try:
                    page = await _ensure_page(ctx, page)
                    bag: list[str] = []
                    await asyncio.sleep(_pause_s())
                    urls: list[str] = []
                    if word:
                        urls = await _browse_overseas(page, word, bag, menu)
                    urls = _without_seed(urls, seed_keys)
                    urls = order_urls_prefer_no_option_no_shopping(urls, "\n".join(bag))
                    results.append({"id": sid, "urls": urls[:24]})
                    print(
                        f"[listing-discover-lottetour] slot={sid} menu={menu} word={word[:40]} urls={len(urls)}",
                        file=sys.stderr,
                    )
                except Exception as e:
                    print(f"[listing-discover-lottetour] slot-fail {sid} {e}", file=sys.stderr)
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
        print(f"[listing-discover-lottetour] fatal {e}", file=sys.stderr)
        print(json.dumps({"ok": False, "results": [], "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
