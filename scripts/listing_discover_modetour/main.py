# -*- coding: utf-8 -*-
"""modetour 목록 — 사람처럼 검색·대기. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-listing-discover-playwright]: modetour listing Playwright — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys
from urllib.parse import quote

PAUSE_MS_MIN = 2000
PAUSE_MS_MAX = 3600
SETTLE_MS = 2600
GOTO_TIMEOUT_MS = 45000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)
PATH_RE = re.compile(r"/package/(\d{6,12})")
JSON_RE = re.compile(r"\"(?:productNo|ProductNo)\"\s*:\s*\"?(\d{6,12})\"?")


def _pause_s() -> float:
    return (PAUSE_MS_MIN + random.randint(0, PAUSE_MS_MAX - PAUSE_MS_MIN)) / 1000.0


def _extract(blob: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for rx in (PATH_RE, JSON_RE):
        for m in rx.finditer(blob or ""):
            no = m.group(1).strip()
            if no == "0" or no in seen:
                continue
            seen.add(no)
            out.append(no)
    return out


def _urls(nos: list[str]) -> list[str]:
    return [f"https://www.modetour.com/package/{n}" for n in nos[:24]]


async def _capture(resp, bag: list[str]) -> None:
    try:
        ct = (resp.headers or {}).get("content-type", "")
        if "json" not in ct and "text" not in ct and "javascript" not in ct:
            return
        text = await resp.text()
        if "productNo" in text or "/package/" in text:
            bag.append(text[:1_500_000])
    except Exception:
        return


async def _goto_collect(page, url: str, bag: list[str]) -> list[str]:
    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    page.on("response", on_resp)
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        await page.wait_for_timeout(SETTLE_MS)
        try:
            await page.mouse.wheel(0, 1100)
            await page.wait_for_timeout(800)
        except Exception:
            pass
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        html = await page.content()
        hrefs = await page.eval_on_selector_all(
            "a[href]",
            "els => els.map(e => e.href || '')",
        )
        blob = html + "\n" + "\n".join(hrefs or []) + "\n" + "\n".join(bag)
        return _extract(blob)
    except Exception as e:
        print(f"[listing-discover-modetour] goto fail {url[:80]} {e}", file=sys.stderr)
        return []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


async def _search_box(page, word: str, bag: list[str]) -> list[str]:
    selectors = (
        "input[name='keyword']",
        "input[type='search']",
        "input[placeholder*='검색']",
        "header input[type='text']",
    )
    await page.goto("https://www.modetour.com/", wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
    await page.wait_for_timeout(SETTLE_MS)
    for sel in selectors:
        loc = page.locator(sel).first
        try:
            if await loc.count() == 0:
                continue
            await loc.click(timeout=2500)
            await loc.fill(word, timeout=2500)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(SETTLE_MS + 1000)
            html = await page.content()
            hrefs = await page.eval_on_selector_all(
                "a[href]",
                "els => els.map(e => e.href || '')",
            )
            blob = html + "\n" + "\n".join(hrefs or []) + "\n" + "\n".join(bag)
            ids = _extract(blob)
            if ids:
                return ids
        except Exception:
            continue
    return []


async def discover_slots(slots: list[dict]) -> list[dict]:
    from playwright.async_api import async_playwright

    results: list[dict] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            viewport={"width": 1366, "height": 768},
            user_agent=UA,
        )
        page = await ctx.new_page()
        page.set_default_timeout(GOTO_TIMEOUT_MS)
        try:
            for slot in slots:
                sid = str(slot.get("id") or "")
                word = str(slot.get("searchWord") or "").strip()
                seed = str(slot.get("seedOriginUrl") or "").strip()
                bag: list[str] = []
                await asyncio.sleep(_pause_s())
                ids: list[str] = []
                candidates = []
                if word:
                    candidates.append(f"https://www.modetour.com/search?keyword={quote(word)}")
                    candidates.append(f"https://www.modetour.com/package?keyword={quote(word)}")
                if seed:
                    candidates.append(seed)
                for url in candidates:
                    ids = await _goto_collect(page, url, bag)
                    if ids:
                        break
                if not ids and word:
                    ids = await _search_box(page, word, bag)
                results.append({"id": sid, "urls": _urls(ids)})
                print(
                    f"[listing-discover-modetour] slot={sid} urls={len(ids)}",
                    file=sys.stderr,
                )
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
        print(f"[listing-discover-modetour] fatal {e}", file=sys.stderr)
        print(json.dumps({"ok": False, "results": [], "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
