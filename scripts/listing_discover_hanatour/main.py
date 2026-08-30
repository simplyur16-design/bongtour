# -*- coding: utf-8 -*-
"""hanatour 목록 — 사람처럼 검색·대기. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-listing-discover-playwright]: hanatour listing Playwright — manifest
# REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: listingMenu FIT/PKG — manifest
# REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: search list only — no CHPC0PKG0200M200 seed — manifest
# REGRESSION-FREEZE[register-listing-discover-human-pace]: 홈 검색함 · bundled Chromium — manifest
# REGRESSION-FREEZE[register-hanatour-listing-package-first]: 해외여행 클릭 · 짧은 검색어 · 시드 pkgCd 제외 — manifest
# REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행→메가메뉴 지명 클릭 — manifest
# REGRESSION-FREEZE[register-pre-photo-ingest-no-option-no-shopping]: 노옵션·노쇼핑 우선 — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys
from urllib.parse import quote

from scripts.listing_prefer_no_shop_option import order_codes_prefer_no_option_no_shopping

PAUSE_MS_MIN = 8000
PAUSE_MS_MAX = 14000
SETTLE_MS = 4800
GOTO_TIMEOUT_MS = 45000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
DETAIL = "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200"
HOME = "https://www.hanatour.com/"
PKG_RE = re.compile(r"(?:[?&]pkgCd=|\"(?:saleProdCd|pkgCd)\"\s*:\s*\")([A-Za-z0-9]+)", re.I)
PKG_OK = re.compile(r"^[A-Z]{2,4}\d{3}[A-Z0-9]{6,}$|^[A-Z0-9]{10,}$", re.I)
SEED_PKG_RE = re.compile(r"[?&]pkgCd=([A-Za-z0-9]+)", re.I)


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


def _seed_pkg(url: str) -> str:
    m = SEED_PKG_RE.search(url or "")
    return (m.group(1) if m else "").upper()


def _without_seed(ids: list[str], seed_pkg: str) -> list[str]:
    if not seed_pkg:
        return ids
    return [x for x in ids if x.upper() != seed_pkg]


def _extract(blob: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in PKG_RE.finditer(blob or ""):
        pkg = m.group(1).strip()
        if not PKG_OK.match(pkg):
            continue
        key = pkg.upper()
        if key in seen:
            continue
        seen.add(key)
        out.append(pkg)
    return out


def _urls(pkg_cds: list[str], menu: str = "PKG") -> list[str]:
    # REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: FIT URL type=H01 — manifest
    extra = "&type=H01" if str(menu).upper() == "FIT" else ""
    return [f"{DETAIL}?pkgCd={quote(c)}&prePage=major-products{extra}" for c in pkg_cds[:24]]


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
        if "saleProdCd" in text or "pkgCd" in text:
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
            await page.wait_for_timeout(1600)
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
            print("[listing-discover-hanatour] no 해외여행 menu", file=sys.stderr)
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
            print(f"[listing-discover-hanatour] no click {word}", file=sys.stderr)
        await page.wait_for_timeout(SETTLE_MS + 1600)
        try:
            await page.mouse.wheel(0, 900)
            await page.wait_for_timeout(700)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=6)
        after = await _snapshot(page, bag)
        return _merge(landing, after)
    except Exception as e:
        print(f"[listing-discover-hanatour] browse fail {e}", file=sys.stderr)
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
            viewport={"width": 1400, "height": 900},
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
                seed_pkg = _seed_pkg(seed)
                try:
                    page = await _ensure_page(ctx, page)
                    bag: list[str] = []
                    await asyncio.sleep(_pause_s())
                    ids: list[str] = []
                    if word:
                        ids = await _browse_overseas(page, word, bag, menu)
                    ids = _without_seed(ids, seed_pkg)
                    ids = order_codes_prefer_no_option_no_shopping(ids, "\n".join(bag))
                    results.append({"id": sid, "urls": _urls(ids, menu)})
                    print(
                        f"[listing-discover-hanatour] slot={sid} menu={menu} word={word[:40]} urls={len(ids)}",
                        file=sys.stderr,
                    )
                except Exception as e:
                    print(f"[listing-discover-hanatour] slot-fail {sid} {e}", file=sys.stderr)
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
        print(f"[listing-discover-hanatour] fatal {e}", file=sys.stderr)
        print(json.dumps({"ok": False, "results": [], "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
