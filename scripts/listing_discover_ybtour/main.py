# -*- coding: utf-8 -*-
"""ybtour 목록 — 사람처럼 localList 읽기. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-listing-discover-playwright]: ybtour listing Playwright — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys
from urllib.parse import parse_qs, quote, urlparse

PAUSE_MS_MIN = 1800
PAUSE_MS_MAX = 3400
SETTLE_MS = 3200
GOTO_TIMEOUT_MS = 50000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
EV_RE = re.compile(r"(?:[?&]evCd=|\"evCd\"\s*:\s*\")([A-Za-z0-9-]+)", re.I)
EV_OK = re.compile(r"^[A-Z0-9]+-\d{6}", re.I)


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


def _urls(ev_cds: list[str], dsp_sid: str, menu: str) -> list[str]:
    return [
        (
            "https://prdt.ybtour.co.kr/product/detailPackage"
            f"?menu={quote(menu)}&dspSid={quote(dsp_sid)}&evCd={quote(ev)}"
        )
        for ev in ev_cds[:24]
    ]


async def _capture(resp, bag: list[str]) -> None:
    try:
        ct = (resp.headers or {}).get("content-type", "")
        if "json" not in ct and "text" not in ct and "javascript" not in ct:
            return
        text = await resp.text()
        if "evCd" in text:
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
            await page.mouse.wheel(0, 1200)
            await page.wait_for_timeout(900)
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
        print(f"[listing-discover-ybtour] goto fail {url[:80]} {e}", file=sys.stderr)
        return []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


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
            viewport={"width": 1920, "height": 1080},
            user_agent=UA,
        )
        page = await ctx.new_page()
        page.set_default_timeout(GOTO_TIMEOUT_MS)
        try:
            for slot in slots:
                sid = str(slot.get("id") or "")
                seed = str(slot.get("seedOriginUrl") or "").strip()
                menu = str(slot.get("listingMenu") or "PKG").upper()
                if menu != "FIT":
                    menu = "PKG"
                dsp = _dsp_sid(seed)
                bag: list[str] = []
                await asyncio.sleep(_pause_s())
                ids: list[str] = []
                if dsp:
                    list_url = (
                        "https://prdt.ybtour.co.kr/product/localList"
                        f"?menu={quote(menu)}&dspSid={quote(dsp)}"
                    )
                    ids = await _goto_collect(page, list_url, bag)
                if not ids and seed:
                    ids = await _goto_collect(page, seed, bag)
                results.append({"id": sid, "urls": _urls(ids, dsp, menu) if dsp else []})
                print(
                    f"[listing-discover-ybtour] slot={sid} urls={len(ids)}",
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
        print(f"[listing-discover-ybtour] fatal {e}", file=sys.stderr)
        print(json.dumps({"ok": False, "results": [], "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
