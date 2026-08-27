# -*- coding: utf-8 -*-
"""verygoodtour 목록 — 사람처럼 ProductList 읽기. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-listing-discover-playwright]: verygoodtour listing Playwright — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys
from urllib.parse import quote

PAUSE_MS_MIN = 2500
PAUSE_MS_MAX = 4300
SETTLE_MS = 3400
GOTO_TIMEOUT_MS = 50000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
PRO_RE = re.compile(r"(?:[?&]ProCode=|\"(?:ProCode|proCode)\"\s*:\s*\")([A-Za-z0-9-]+)", re.I)
PRO_OK = re.compile(r"^[A-Z]{2,4}\d{3,5}-[A-Z0-9]+$|^[A-Z]{2,4}\d{4,}", re.I)


def _pause_s() -> float:
    return (PAUSE_MS_MIN + random.randint(0, PAUSE_MS_MAX - PAUSE_MS_MIN)) / 1000.0


def _extract(blob: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in PRO_RE.finditer(blob or ""):
        code = m.group(1).strip()
        if not PRO_OK.match(code):
            continue
        key = code.upper()
        if key in seen:
            continue
        seen.add(key)
        out.append(code)
    return out


def _urls(codes: list[str]) -> list[str]:
    return [
        f"https://www.verygoodtour.com/Product/PackageDetail?ProCode={quote(c)}"
        for c in codes[:24]
    ]


async def _capture(resp, bag: list[str]) -> None:
    try:
        ct = (resp.headers or {}).get("content-type", "")
        if "json" not in ct and "text" not in ct and "javascript" not in ct:
            return
        text = await resp.text()
        if "ProCode" in text or "proCode" in text:
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
            await page.mouse.wheel(0, 1000)
            await page.wait_for_timeout(850)
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
        print(f"[listing-discover-verygoodtour] goto fail {url[:80]} {e}", file=sys.stderr)
        return []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


async def _search_box(page, word: str, bag: list[str]) -> list[str]:
    selectors = (
        "input[name='SearchWord']",
        "input#SearchWord",
        "input[type='search']",
        "input[placeholder*='검색']",
    )
    await page.goto(
        "https://www.verygoodtour.com/",
        wait_until="domcontentloaded",
        timeout=GOTO_TIMEOUT_MS,
    )
    await page.wait_for_timeout(SETTLE_MS)
    for sel in selectors:
        loc = page.locator(sel).first
        try:
            if await loc.count() == 0:
                continue
            await loc.click(timeout=2500)
            await loc.fill(word, timeout=2500)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(SETTLE_MS + 1200)
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
            viewport={"width": 1440, "height": 900},
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
                    candidates.append(
                        "https://www.verygoodtour.com/Product/ProductList"
                        f"?SearchWord={quote(word)}"
                    )
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
                    f"[listing-discover-verygoodtour] slot={sid} urls={len(ids)}",
                    file=sys.stderr,
                )
        finally:
            await browser.close()
    return results


def main() -> None:
    raw = sys.stdin.read()
    payload = json.loads(raw or "{}")
    slots = payload.get("slots") if isinstance(payload, dict) else []
    if not isinstance(slots, list):
        slots = []
    try:
        results = asyncio.run(discover_slots(slots))
        print(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
    except Exception as e:
        print(f"[listing-discover-verygoodtour] fatal {e}", file=sys.stderr)
        print(json.dumps({"ok": False, "results": [], "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
