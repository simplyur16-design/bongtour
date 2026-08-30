# -*- coding: utf-8 -*-
"""modetour 목록 — 사람처럼 검색·대기. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-listing-discover-playwright]: modetour listing Playwright — manifest
# REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: listingMenu FIT/PKG — manifest
# REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: search list only — no /package/{id} seed — manifest
# REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
# REGRESSION-FREEZE[register-listing-discover-human-search-not-404]: 홈 검색함 · /search 404 금지 — manifest
# REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행→메가메뉴 지명 클릭 — manifest
# REGRESSION-FREEZE[register-listing-discover-modetour-festa-dismiss]: 페스타·쿠폰 팝업 닫고 진입 — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys

from scripts.listing_prefer_no_shop_option import order_codes_prefer_no_option_no_shopping

PAUSE_MS_MIN = 11000
PAUSE_MS_MAX = 17000
SETTLE_MS = 6200
GOTO_TIMEOUT_MS = 70000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)
PATH_RE = re.compile(r"/package/(\d{6,12})")
JSON_RE = re.compile(r"\"(?:productNo|ProductNo)\"\s*:\s*\"?(\d{6,12})\"?")


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


def _merge(a: list[str], b: list[str]) -> list[str]:
    seen = set(a)
    out = list(a)
    for x in b:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def _urls(nos: list[str]) -> list[str]:
    return [f"https://www.modetour.com/package/{n}" for n in nos[:24]]


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
        if "productNo" in text or "/package/" in text:
            bag.append(text[:1_500_000])
    except Exception:
        return


async def _snapshot(page, bag: list[str]) -> list[str]:
    html = await page.content()
    hrefs = await page.eval_on_selector_all(
        "a[href]",
        "els => els.map(e => e.href || '')",
    )
    return _extract(html + "\n" + "\n".join(hrefs or []) + "\n" + "\n".join(bag))


async def _goto_collect(page, url: str, bag: list[str]) -> list[str]:
    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    page.on("response", on_resp)
    try:
        resp = await page.goto(url, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        try:
            code = int(getattr(resp, "status", 200) or 200)
        except Exception:
            code = 200
        if code >= 400:
            print(f"[listing-discover-modetour] goto status {code} {url[:80]}", file=sys.stderr)
            return []
        await page.wait_for_timeout(SETTLE_MS)
        try:
            await page.wait_for_selector('a[href*="/package/"]', timeout=12000)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=6)
        ids = await _snapshot(page, bag)
        for _ in range(4):
            try:
                await page.mouse.wheel(0, 1600)
                await page.wait_for_timeout(800)
            except Exception:
                break
            ids = _merge(ids, await _snapshot(page, bag))
            if len(ids) >= 24:
                return ids[:24]
        for sel in ("a:has-text('다음')", "button:has-text('더보기')", "a:has-text('2')"):
            loc = page.locator(sel).first
            try:
                if await loc.count() == 0:
                    continue
                await loc.click(timeout=2500)
                await page.wait_for_timeout(SETTLE_MS)
                ids = _merge(ids, await _snapshot(page, bag))
                break
            except Exception:
                continue
        return ids[:24]
    except Exception as e:
        print(f"[listing-discover-modetour] goto fail {url[:80]} {e}", file=sys.stderr)
        return []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


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


async def _dismiss_home_overlay(page) -> None:
    # REGRESSION-FREEZE[register-listing-discover-modetour-festa-dismiss]: 페스타·쿠폰 팝업 닫고 해외여행 — manifest
    try:
        await page.wait_for_selector("text=오늘하루 보지 않기", timeout=5000, state="visible")
    except Exception:
        pass
    for loc in (
        page.get_by_text("오늘하루 보지 않기", exact=True),
        page.get_by_text("다시 보지 않기", exact=True),
        page.locator("[class*='popup']").get_by_text("닫기", exact=True),
        page.locator("[class*='layer']").get_by_text("닫기", exact=True),
        page.locator("[class*='festa']").get_by_text("닫기", exact=True),
        page.get_by_role("button", name="닫기"),
        page.locator("[aria-label='닫기']"),
    ):
        try:
            target = loc.first
            if await target.count() == 0:
                continue
            await target.click(timeout=1800, force=True)
            await page.wait_for_timeout(500)
        except Exception:
            continue
    try:
        await page.evaluate(
            """() => {
              const want = ['오늘하루 보지 않기', '다시 보지 않기'];
              const nodes = [...document.querySelectorAll('button,a,span,label')];
              const el = nodes.find((n) => {
                const t = (n.textContent || '').replace(/\\s+/g, ' ').trim();
                return t.length < 24 && want.includes(t);
              });
              if (el) el.click();
            }"""
        )
        await page.wait_for_timeout(400)
    except Exception:
        pass


async def _hover_overseas(page) -> bool:
    await _dismiss_home_overlay(page)
    try:
        await page.wait_for_selector("text=해외여행", timeout=14000, state="visible")
    except Exception:
        pass
    for loc in (
        page.locator("a, button, span, li").filter(has_text=re.compile(r"^[\s]*해외여행[\s]*$")),
        page.get_by_text("해외여행", exact=True),
        page.locator("a[href*='/package/overseas']"),
        page.locator("a:has-text('해외여행')"),
        page.locator("nav :text('해외여행')"),
        page.locator("header :text('해외여행')"),
        page.locator(".gnb :text('해외여행')"),
        page.locator("a:has-text('패키지')"),
    ):
        target = loc.first
        try:
            if await target.count() == 0:
                continue
            try:
                await target.hover(timeout=4000)
            except Exception:
                try:
                    await target.hover(timeout=2500, force=True)
                except Exception:
                    await target.click(timeout=2500, force=True)
            await page.wait_for_timeout(1600)
            return True
        except Exception:
            continue
    try:
        for node in await page.query_selector_all("header a, header span, header button, nav a, nav span, .gnb a, .gnb span"):
            t = (await node.text_content() or "").replace(" ", "").strip()
            if t == "해외여행":
                try:
                    await node.hover()
                except Exception:
                    await node.hover(force=True)
                await page.wait_for_timeout(1600)
                return True
    except Exception:
        pass
    return False


async def _goto_home(page) -> None:
    last: Exception | None = None
    for attempt in range(2):
        try:
            await page.goto("https://www.modetour.com/", wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
            return
        except Exception as e:
            last = e
            msg = str(e)
            if "ERR_NAME_NOT_RESOLVED" not in msg and "ERR_NAME_RESOLUTION_FAILED" not in msg:
                raise
            print(f"[listing-discover-modetour] goto retry {attempt + 1} {e}", file=sys.stderr)
            await asyncio.sleep(_pause_s())
    if last:
        raise last


async def _browse_overseas(page, word: str, bag: list[str], menu: str) -> list[str]:
    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    try:
        page.on("response", on_resp)
        await _goto_home(page)
        await page.wait_for_timeout(SETTLE_MS)
        if not await _hover_overseas(page):
            try:
                body = await page.inner_text("body")
                print(
                    f"[listing-discover-modetour] no 해외여행 menu title={await page.title()!r} "
                    f"url={page.url} has_text={('해외여행' in (body or ''))}",
                    file=sys.stderr,
                )
            except Exception as e:
                print(f"[listing-discover-modetour] no 해외여행 menu ({e})", file=sys.stderr)
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
            for sel in ("a[href*='/package/overseas']", "a:has-text('해외여행')"):
                loc = page.locator(sel).first
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
            print(f"[listing-discover-modetour] no click {word}", file=sys.stderr)
        await page.wait_for_timeout(SETTLE_MS + 1600)
        try:
            await page.mouse.wheel(0, 1600)
            await page.wait_for_timeout(800)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=6)
        after = await _snapshot(page, bag)
        return _merge(landing, after)
    except Exception as e:
        print(f"[listing-discover-modetour] browse fail {e}", file=sys.stderr)
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
            viewport={"width": 1366, "height": 768},
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
                bag: list[str] = []
                await asyncio.sleep(_pause_s())
                ids: list[str] = []
                try:
                    try:
                        if page.is_closed():
                            page = await ctx.new_page()
                            page.set_default_timeout(GOTO_TIMEOUT_MS)
                    except Exception:
                        page = await ctx.new_page()
                        page.set_default_timeout(GOTO_TIMEOUT_MS)
                    if word:
                        ids = await _browse_overseas(page, word, bag, menu)
                    # 시드 /package/{id} 상세는 이미 등록된 상품 1개만 나온다. 목록 대신 쓰지 않는다.
                    ids = order_codes_prefer_no_option_no_shopping(ids, "\n".join(bag))
                    results.append({"id": sid, "urls": _urls(ids)})
                    print(
                        f"[listing-discover-modetour] slot={sid} menu={menu} word={word[:40]} urls={len(ids)}",
                        file=sys.stderr,
                    )
                except Exception as e:
                    print(f"[listing-discover-modetour] slot-fail {sid} {e}", file=sys.stderr)
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
        print(f"[listing-discover-modetour] fatal {e}", file=sys.stderr)
        print(json.dumps({"ok": False, "results": [], "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
