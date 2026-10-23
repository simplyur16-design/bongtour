# -*- coding: utf-8 -*-
"""naeiltour 목록 — 사람처럼 해외여행 클릭. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: naeiltour overseas click — manifest
# REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행→메가메뉴 지명 클릭 — manifest
# REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
# REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: view.asp good_cd only — no seed detail — manifest
# REGRESSION-FREEZE[register-pre-photo-ingest-naeiltour-fit-first]: 메뉴 없으면 FIT · 자유여행 클릭 — manifest
# REGRESSION-FREEZE[register-ingest-local-departure-reserve]: 지방출발·테마 홈 검색함 — manifest
# REGRESSION-FREEZE[register-listing-discover-naeiltour-search-list-in]: search_list_in.asp SSOT · cp949 — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys
from urllib.parse import quote

from scripts.listing_prefer_no_shop_option import order_codes_prefer_no_option_no_shopping

PAUSE_MS_MIN = 14000
PAUSE_MS_MAX = 20000
SETTLE_MS = 6100
GOTO_TIMEOUT_MS = 50000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
# 목록·상세 링크는 /Tour/view.asp (sub/view.asp 도 동일 본문이나 목록 SSOT 는 Tour)
DETAIL = "https://www.naeiltour.co.kr/Tour/view.asp"
HOME = "https://www.naeiltour.co.kr/"
SEARCH_LIST = "https://www.naeiltour.co.kr/Tour/search/search_list.asp"
SEARCH_LIST_IN = "https://www.naeiltour.co.kr/Tour/search/search_list_in.asp"
LOCAL_DEP_WORDS = frozenset({"부산출발", "대구출발", "청주출발"})
THEME_SEARCH_WORDS = frozenset({"골프", "러닝", "트레킹", "다이빙"})
HOME_SEARCH_WORDS = LOCAL_DEP_WORDS | THEME_SEARCH_WORDS
GOOD_RE = re.compile(r"(?:[?&]good_cd=|\"(?:good_cd|goodCd)\"\s*:\s*\")([A-Za-z0-9]+)", re.I)
GOOD_OK = re.compile(r"^[A-Za-z0-9]{4,}$")
SEED_RE = re.compile(r"[?&]good_cd=([A-Za-z0-9]+)", re.I)


def _decode_html(raw: bytes | str | None) -> str:
    """내일투어 본문은 euc-kr/cp949 가 흔함 — utf-8 강제 디코드 금지."""
    if raw is None:
        return ""
    if isinstance(raw, str):
        return raw
    for enc in ("utf-8", "cp949", "euc-kr"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", errors="replace")


async def _response_text(resp) -> str:
    try:
        body = await resp.body()
        return _decode_html(body)
    except Exception:
        try:
            return _decode_html(await resp.text())
        except Exception:
            return ""


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


def _seed_code(url: str) -> str:
    m = SEED_RE.search(url or "")
    return (m.group(1) if m else "").upper()


def _without_seed(ids: list[str], seed: str) -> list[str]:
    if not seed:
        return ids
    return [x for x in ids if x.upper() != seed]


def _extract(blob: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in GOOD_RE.finditer(blob or ""):
        code = m.group(1).strip()
        if not GOOD_OK.match(code):
            continue
        key = code.upper()
        if key in seen:
            continue
        seen.add(key)
        out.append(code)
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


def _urls(codes: list[str]) -> list[str]:
    return [f"{DETAIL}?good_cd={quote(c)}" for c in codes[:12]]


async def _filter_live_detail_codes(page, codes: list[str], limit: int = 12) -> list[str]:
    """상세 HTML이 너무 짧으면(빈 껍데기) 목록에서 제외 — title_placeholder 예방.
    전체 page.goto 연타는 차단·타임아웃 유발 → request.get + 사람 간격."""
    out: list[str] = []
    req = page.context.request
    for code in codes:
        if len(out) >= limit:
            break
        url = f"{DETAIL}?good_cd={quote(code)}"
        try:
            await page.wait_for_timeout(1400 + random.randint(0, 900))
            resp = await req.get(url, timeout=18000, max_redirects=5)
            status = int(getattr(resp, "status", 200) or 200)
            html = await _response_text(resp)
            if status >= 400 or len(html or "") < 8000:
                print(
                    f"[listing-discover-naeiltour] skip empty detail {code} len={len(html or '')} status={status}",
                    file=sys.stderr,
                )
                continue
            upper = (html or "").upper()
            if "GOOD_CD" not in upper and code.upper() not in upper:
                print(f"[listing-discover-naeiltour] skip no-body detail {code}", file=sys.stderr)
                continue
            # 판매 불가·에러 껍데기 흔한 문구
            if any(tok in (html or "") for tok in ("상품이 존재하지", "판매종료", "없는 상품", "오류가 발생")):
                print(f"[listing-discover-naeiltour] skip unsellable {code}", file=sys.stderr)
                continue
            out.append(code)
        except Exception as e:
            print(f"[listing-discover-naeiltour] probe fail {code} {e}", file=sys.stderr)
            continue
    return out


def _parents(word: str) -> list[str]:
    # REGRESSION-FREEZE[mega-menu-discover-parents]: 공급사 GNB parent = 그룹·탭 줄기 — manifest
    from scripts.listing_discover_shared.mega_menu_parents import mega_menu_discover_parents

    return mega_menu_discover_parents(word)


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
        async def _body() -> str:
            try:
                return _decode_html(await resp.body())
            except Exception:
                return await resp.text()

        text = await asyncio.wait_for(_body(), timeout=6)
        if "good_cd" in text or "goodCd" in text:
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
            await page.wait_for_timeout(1800)
            return True
        except Exception:
            continue
    return False


async def _fill_home_search(page, word: str) -> bool:
    # REGRESSION-FREEZE[register-ingest-local-departure-reserve]: 홈 검색함 — manifest
    # name=keyword 가 내일투어 실제 검색 슬롯 (placeholder 계열만 잡으면 빈 랜딩 코드가 섞임)
    for sel in (
        'input[name="keyword"]',
        'input#keyword',
        'form[action*="search"] input[type="text"]',
        'input[type="search"]',
        'input[placeholder*="검색"]',
        'input[placeholder*="어디"]',
        'input[aria-label*="검색"]',
        'input[class*="search" i]',
        '[role="search"] input',
        'header input[type="text"]',
    ):
        loc = page.locator(sel).first
        try:
            if await loc.count() == 0:
                continue
            await loc.click(timeout=2500, force=True)
            await loc.fill("")
            await loc.fill(word)
            await page.wait_for_timeout(350)
            await loc.press("Enter")
            return True
        except Exception:
            continue
    return False


def _euc_kr_form(fields: dict[str, str]) -> bytes:
    """내일투어 ASP 검색은 euc-kr form — UTF-8 POST 면 codes=0."""
    from urllib.parse import quote as _q

    parts: list[str] = []
    for k, v in fields.items():
        try:
            enc = _q(v, encoding="euc-kr", safe="")
        except Exception:
            enc = _q(v, safe="")
        parts.append(f"{_q(k, safe='')}={enc}")
    return "&".join(parts).encode("ascii", errors="ignore")


async def _fetch_search_list_in(page, word: str, bag: list[str]) -> list[str]:
    """검색 결과 본문은 search_list_in.asp XHR — 셸 search_list.asp 만보면 good_cd 0건."""
    try:
        await page.wait_for_timeout(1200 + random.randint(0, 800))
        body = _euc_kr_form({"keyword": word})
        resp = await page.context.request.post(
            SEARCH_LIST_IN,
            data=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": f"{SEARCH_LIST}?keyword={quote(word)}",
            },
            timeout=25000,
        )
        text = await _response_text(resp)
        if text:
            bag.append(text[:1_500_000])
        codes = _extract(text or "")
        print(
            f"[listing-discover-naeiltour] list_in word={word[:20]} status={resp.status} codes={len(codes)}",
            file=sys.stderr,
        )
        return codes
    except Exception as e:
        print(f"[listing-discover-naeiltour] list_in fail {word} {e}", file=sys.stderr)
        return []


async def _browse_home_search(page, word: str, bag: list[str]) -> list[str]:
    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    try:
        if page.is_closed():
            return []
        page.on("response", on_resp)
        await page.goto(HOME, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        await page.wait_for_timeout(SETTLE_MS)
        if not await _fill_home_search(page, word):
            print(f"[listing-discover-naeiltour] no search box {word}", file=sys.stderr)
            return await _fetch_search_list_in(page, word, bag)
        await page.wait_for_timeout(SETTLE_MS + 1800)
        try:
            cur = page.url or ""
            if "search_list" not in cur and "search" not in cur.lower():
                await page.goto(
                    f"{SEARCH_LIST}?keyword={quote(word)}",
                    wait_until="domcontentloaded",
                    timeout=GOTO_TIMEOUT_MS,
                )
                await page.wait_for_timeout(SETTLE_MS)
        except Exception:
            pass
        try:
            await page.mouse.wheel(0, 900)
            await page.wait_for_timeout(800)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=8)
        # 검색 결과 SSOT = list_in. 랜딩/메가메뉴 스냅샷 good_cd 는 잡음이라 뒤에만 붙인다.
        ids = await _fetch_search_list_in(page, word, bag)
        if len(ids) < 3:
            ids = _merge(ids, await _snapshot(page, bag))
        return ids
    except Exception as e:
        print(f"[listing-discover-naeiltour] home search fail {e}", file=sys.stderr)
        return await _fetch_search_list_in(page, word, bag)
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


async def _browse_mega_menu(page, word: str, bag: list[str], menu: str) -> list[str]:
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
            print("[listing-discover-naeiltour] no 해외여행 menu", file=sys.stderr)
            return []
        # 랜딩 HTML 의 good_cd 는 상세 빈페이지·다른 테마 잡음 — 클릭 이후 스냅샷만 사용
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
            print(f"[listing-discover-naeiltour] no click {word}", file=sys.stderr)
            return []
        await page.wait_for_timeout(SETTLE_MS + 1600)
        try:
            await page.mouse.wheel(0, 900)
            await page.wait_for_timeout(800)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=6)
        ids = await _snapshot(page, bag)
        if len(ids) < 3:
            ids = _merge(ids, await _fetch_search_list_in(page, word, bag))
        return ids
    except Exception as e:
        print(f"[listing-discover-naeiltour] browse fail {e}", file=sys.stderr)
        return []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


async def _browse_overseas(page, word: str, bag: list[str], menu: str) -> list[str]:
    # REGRESSION-FREEZE[register-ingest-local-departure-reserve]: 홈 keyword 우선 · 실패 시 메가메뉴 — manifest
    # 내일투어는 메가메뉴 랜딩 good_cd 잡음이 커서 모든 검색어를 홈 검색부터 탄다.
    w = (word or "").strip()
    if w:
        urls = await _browse_home_search(page, w, bag)
        if urls:
            return urls
        print(f"[listing-discover-naeiltour] home search empty → mega menu {w}", file=sys.stderr)
        stem = w.replace("출발", "").strip()
        return await _browse_mega_menu(page, stem or w, bag, menu)
    return await _browse_mega_menu(page, word, bag, menu)


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
            viewport={"width": 1380, "height": 840},
            user_agent=UA,
        )
        page = await ctx.new_page()
        page.set_default_timeout(GOTO_TIMEOUT_MS)
        try:
            for slot in slots:
                sid = str(slot.get("id") or "")
                raw = str(slot.get("searchWord") or "").strip()
                # 내일투어는 자유여행 위주. 메뉴가 없으면 패키지가 아니라 FIT.
                menu = str(slot.get("listingMenu") or "FIT").upper()
                word = _short_word(raw)
                seed = str(slot.get("seedOriginUrl") or "").strip()
                seed_code = _seed_code(seed)
                try:
                    page = await _ensure_page(ctx, page)
                    bag: list[str] = []
                    await asyncio.sleep(_pause_s())
                    ids: list[str] = []
                    if word:
                        ids = await _browse_overseas(page, word, bag, menu)
                    ids = _without_seed(ids, seed_code)
                    ids = order_codes_prefer_no_option_no_shopping(ids, "\n".join(bag))
                    # 후보가 있으면 상세 프로브로 빈 페이지 걸러 낸 뒤 URL화 (연타 금지)
                    if ids:
                        page = await _ensure_page(ctx, page)
                        ids = await _filter_live_detail_codes(page, ids[:16], limit=12)
                    results.append({"id": sid, "urls": _urls(ids)})
                    print(
                        f"[listing-discover-naeiltour] slot={sid} menu={menu} word={word[:40]} urls={len(ids)}",
                        file=sys.stderr,
                    )
                except Exception as e:
                    print(f"[listing-discover-naeiltour] slot-fail {sid} {e}", file=sys.stderr)
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
        print(f"[listing-discover-naeiltour] fatal {e}", file=sys.stderr)
        print(json.dumps({"ok": False, "results": [], "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
