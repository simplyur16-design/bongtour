# -*- coding: utf-8 -*-
"""modetour 목록 — 사람처럼 검색·대기. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-listing-discover-playwright]: modetour listing B2C (SearchProductMaster) · 사람 간격 — manifest
# REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: listingMenu FIT/PKG — manifest
# REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: search list only — no /package/{id} seed — manifest
# REGRESSION-FREEZE[register-listing-discover-human-pace]: B2C 사람 간격 · 설치 Chrome 채널 금지 — manifest
# REGRESSION-FREEZE[register-listing-discover-human-search-not-404]: 홈 검색함 · /search 404 금지 — manifest
# REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행→메가메뉴 지명 클릭 — manifest
# REGRESSION-FREEZE[register-listing-discover-modetour-festa-dismiss]: 페스타·쿠폰 팝업 닫고 진입 — manifest
# REGRESSION-FREEZE[register-ingest-local-departure-reserve]: 지방출발은 홈 검색함 — manifest
# REGRESSION-FREEZE[register-ingest-theme-category-slots]: 테마 검색어도 홈 검색함 — manifest
# REGRESSION-FREEZE[register-listing-discover-modetour-b2c-search]: B2C SearchThemeAndLocalKey→SearchProductMaster — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

from scripts.listing_prefer_no_shop_option import order_codes_prefer_no_option_no_shopping

# 슬롯 간·B2C 호출 간 간격 — 공급사 전용(공통 SSOT 아님). 연타 금지.
PAUSE_MS_MIN = 18000
PAUSE_MS_MAX = 28000
B2C_PAUSE_MS_MIN = 14000
B2C_PAUSE_MS_MAX = 22000
# 슬롯당 URL 상한 — confirm 연타 방지 (할당량은 ingest 쪽에서 채움)
URLS_PER_SLOT = 4
SETTLE_MS = 6200
GOTO_TIMEOUT_MS = 70000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)
PATH_RE = re.compile(r"/package/(\d{6,12})")
JSON_RE = re.compile(r"\"(?:productNo|ProductNo)\"\s*:\s*\"?(\d{6,12})\"?")
CODE_RE = re.compile(r"\"computedProductCode\"\s*:\s*\"([A-Za-z0-9]{6,20})\"")
LOCAL_DEP_WORDS = frozenset({"부산출발", "대구출발", "청주출발"})
THEME_SEARCH_WORDS = frozenset({"골프", "러닝", "트레킹", "다이빙"})
HOME_SEARCH_WORDS = LOCAL_DEP_WORDS | THEME_SEARCH_WORDS
LOCAL_DEP_IATA = {"부산출발": "PUS", "대구출발": "TAE", "청주출발": "CJJ"}
# 지방출발: 목적지 1곳만 먼저. 0건일 때만 다음 시드 (연타 금지)
LOCAL_DEP_AREA_SEEDS = (177, 4, 110)
MODETOUR_API = "https://b2c-api.modetour.com"
MODETOUR_WEB_API_REQ_HEADER = (
    '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC",'
    '"ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}'
)


def _pause_s() -> float:
    return (PAUSE_MS_MIN + random.randint(0, PAUSE_MS_MAX - PAUSE_MS_MIN)) / 1000.0


def _b2c_pause_s() -> float:
    # REGRESSION-FREEZE[register-listing-discover-modetour-b2c-search]: B2C 호출 간 사람 간격 — manifest
    return (B2C_PAUSE_MS_MIN + random.randint(0, B2C_PAUSE_MS_MAX - B2C_PAUSE_MS_MIN)) / 1000.0


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
    for rx in (CODE_RE, PATH_RE, JSON_RE):
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


def _resolve_package_code_to_product_no(code: str) -> str | None:
    """상품코드 → 단체번호. /package/{code} 리다이렉트 (사람 간격은 호출측)."""
    # REGRESSION-FREEZE[register-listing-discover-modetour-b2c-search]: code→productNo redirect — manifest
    c = (code or "").strip()
    if not c:
        return None
    if re.fullmatch(r"\d{6,12}", c):
        return c
    seed = f"https://www.modetour.com/package/{urllib.parse.quote(c)}"
    try:
        req = urllib.request.Request(
            seed,
            method="GET",
            headers={
                "user-agent": UA,
                "accept": "text/html,application/xhtml+xml",
                "accept-language": "ko-KR,ko;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            final = str(getattr(resp, "geturl", lambda: seed)() or seed)
        m = re.search(r"/package/(\d{6,12})(?:[/?#]|$)", final, re.I)
        if m and m.group(1) != "0":
            return m.group(1)
    except Exception as e:
        print(f"[listing-discover-modetour] resolve-fail {c} {e}", file=sys.stderr)
    return None


def _urls(nos: list[str]) -> list[str]:
    # confirm/lane 필터는 숫자 productNo URL만 받는다 — 코드는 리다이렉트로 푼다
    out: list[str] = []
    for raw in nos[: URLS_PER_SLOT * 3]:
        if len(out) >= URLS_PER_SLOT:
            break
        c = (raw or "").strip()
        if not c:
            continue
        if not re.fullmatch(r"\d{6,12}", c):
            time.sleep(_b2c_pause_s())
        product_no = _resolve_package_code_to_product_no(c)
        if not product_no:
            continue
        out.append(f"https://www.modetour.com/package/{product_no}")
    return out


def _b2c_headers() -> dict[str, str]:
    return {
        "content-type": "application/json",
        "accept": "application/json, text/plain, */*",
        "accept-language": "ko-KR",
        "user-agent": UA,
        "referer": "https://www.modetour.com/",
        "modewebapireqheader": MODETOUR_WEB_API_REQ_HEADER,
        "x-platform": "ModeEcommerce",
        "x-salespartner": "2",
        "x-userdepartment": "ModeEcommerce",
    }


def _b2c_json(path: str, body: dict | None = None) -> dict:
    # 호출 직전 대기 — SearchTheme/SearchProductMaster 연타 방지
    time.sleep(_b2c_pause_s())
    url = MODETOUR_API + path
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST" if body is not None else "GET",
        headers=_b2c_headers(),
    )
    with urllib.request.urlopen(req, timeout=35) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _search_window() -> tuple[str, str]:
    start = date.today() + timedelta(days=5)
    end = date.today() + timedelta(days=365)
    return start.isoformat(), end.isoformat()


def _search_product_master(
    *,
    area_no: int = 0,
    theme_no: int = 0,
    starting_point: list[str] | None = None,
) -> list[dict]:
    sf, st = _search_window()
    body = {
        "areaNo": int(area_no or 0),
        "themeNo": int(theme_no or 0),
        "searchFrom": sf,
        "searchTo": st,
        "travelType": "GNBOverseasTravel",
        "deviceType": "DVTPC",
        "page": 1,
        "filter": {
            "typeFilter": "PGTOverseasTravel",
            "minPrice": 0,
            "maxPrice": 0,
            "startingPoint": list(starting_point or []),
            "destination": None,
            "travelConcept": None,
            "endLocation": None,
            "transport": None,
            "transportation": None,
            "promotion": None,
            "tourCondition": {
                "airSeatClass": None,
                "airPortTax": None,
                "localTraffic": None,
                "mealFee": None,
                "dolomites": None,
                "roomCharge": None,
                "entranceFee": None,
                "neccessaryLocalExpenses": None,
                "localGuide": None,
                "guideYn": None,
                "shopping": None,
                "freeSchedule": None,
                "optionalTour": None,
                "departureFixed": None,
            },
            "coupon": None,
            "discountCondition": None,
            "depatureDay": None,
            "productBrand": None,
            "lodgment": None,
            "travelPeriod": None,
            "travelType": None,
            "depatureTime": None,
            "isViewAllAvailableSeat": True,
            "sort": "Recommend",
            "promotions": None,
        },
    }
    j = _b2c_json("/Package/SearchProductMaster", body)
    pm = ((j.get("result") or {}).get("productMaster") or [])
    return pm if isinstance(pm, list) else []


def _codes_from_masters(masters: list[dict], *, prefer_theme: str | None = None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    ranked: list[tuple[int, str]] = []
    for m in masters:
        if not isinstance(m, dict):
            continue
        themes = [str(t) for t in (m.get("themes") or [])]
        rank = 0
        if prefer_theme == "FIT":
            rank = 0 if any("에어텔" in t or "자유" in t for t in themes) else 1
        elif prefer_theme == "PKG":
            rank = 0 if any("패키지" in t for t in themes) else 1
        for pc in m.get("productCodes") or []:
            if not isinstance(pc, dict):
                continue
            code = str(pc.get("computedProductCode") or "").strip()
            if not code or code in seen:
                continue
            seen.add(code)
            ranked.append((rank, code))
    ranked.sort(key=lambda x: x[0])
    for _, code in ranked:
        out.append(code)
        if len(out) >= 24:
            break
    return out


def _resolve_keyword(word: str) -> tuple[int, int]:
    """SearchThemeAndLocalKey → (areaNo, themeNo)."""
    q = urllib.parse.quote(word)
    j = _b2c_json(f"/Content/SearchThemeAndLocalKey?keyword={q}")
    result = j.get("result") or {}
    local_keys = result.get("localKeys") or []
    themes = result.get("themes") or []
    # 지역 우선 (도시→나라)
    for want in ("AKWArea", "AKWCountry"):
        for row in local_keys:
            if not isinstance(row, dict):
                continue
            if str(row.get("type") or "") != want:
                continue
            area_no = int(row.get("areaKeywordNo") or 0)
            if area_no > 0:
                return area_no, 0
    for row in local_keys:
        if not isinstance(row, dict):
            continue
        area_no = int(row.get("areaKeywordNo") or 0)
        if area_no > 0:
            return area_no, 0
    for row in themes:
        if not isinstance(row, dict):
            continue
        # 국내 테마(부산출발 DomesticTravel)는 해외 목록에 쓰지 않는다
        if str(row.get("type") or "") == "DomesticTravel":
            continue
        theme_no = int(row.get("themeNo") or 0)
        if theme_no > 0:
            return 0, theme_no
    return 0, 0


def _b2c_codes_for_word(word: str, menu: str) -> list[str]:
    # REGRESSION-FREEZE[register-listing-discover-modetour-b2c-search]: B2C 목록 — manifest
    prefer = "FIT" if menu == "FIT" else "PKG"
    w = (word or "").strip()
    if not w:
        return []

    if w in LOCAL_DEP_WORDS:
        iata = LOCAL_DEP_IATA.get(w)
        if not iata:
            return []
        codes: list[str] = []
        for area_no in LOCAL_DEP_AREA_SEEDS:
            try:
                masters = _search_product_master(area_no=area_no, starting_point=[iata])
            except Exception as e:
                print(f"[listing-discover-modetour] b2c local-dep fail area={area_no} {e}", file=sys.stderr)
                continue
            chunk = _codes_from_masters(masters, prefer_theme=prefer)
            codes = _merge(codes, chunk)
            # 한 area에서 충분하면 추가 시드 조회하지 않는다
            if len(codes) >= URLS_PER_SLOT:
                break
        print(f"[listing-discover-modetour] b2c local-dep {w} iata={iata} codes={len(codes)}", file=sys.stderr)
        return codes[:URLS_PER_SLOT]

    try:
        area_no, theme_no = _resolve_keyword(w)
    except Exception as e:
        print(f"[listing-discover-modetour] b2c resolve fail {w} {e}", file=sys.stderr)
        return []
    if area_no <= 0 and theme_no <= 0:
        print(f"[listing-discover-modetour] b2c no area/theme {w}", file=sys.stderr)
        return []
    try:
        masters = _search_product_master(area_no=area_no, theme_no=theme_no)
    except Exception as e:
        print(f"[listing-discover-modetour] b2c search fail {w} {e}", file=sys.stderr)
        return []
    codes = _codes_from_masters(masters, prefer_theme=prefer)
    print(
        f"[listing-discover-modetour] b2c word={w} area={area_no} theme={theme_no} codes={len(codes)}",
        file=sys.stderr,
    )
    return codes[:URLS_PER_SLOT]


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
    # REGRESSION-FREEZE[mega-menu-discover-parents]: 공급사 GNB parent = 그룹·탭 줄기 — manifest
    from scripts.listing_discover_shared.mega_menu_parents import mega_menu_discover_parents

    return mega_menu_discover_parents(word)


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


def _is_home_search_word(word: str) -> bool:
    return (word or "").strip() in HOME_SEARCH_WORDS


async def _submit_home_search(page) -> bool:
    """검색 돋보기 — Enter만으로는 SPA 이동이 안 된다. /package/overseas?keyword= 로 간다."""
    for sel in (
        ".Header_inputSearch__ySaJp svg",
        ".ant-input-affix-wrapper svg",
        ".Header_inputSearch__ySaJp",
    ):
        loc = page.locator(sel).first
        try:
            if await loc.count() == 0:
                continue
            await loc.click(timeout=2500, force=True)
            return True
        except Exception:
            continue
    return False


async def _fill_home_search(page, word: str) -> bool:
    """홈 검색함 — 지방출발·테마 전용. 메가메뉴 클릭 경로와 분리."""
    # REGRESSION-FREEZE[register-ingest-local-departure-reserve]: 홈 검색함 — manifest
    # REGRESSION-FREEZE[register-ingest-theme-category-slots]: 테마 홈 검색함 — manifest
    await _dismiss_home_overlay(page)
    # 닫기 텍스트 한 번 더 (유류할증 모달이 검색 클릭을 가로챔)
    try:
        await page.get_by_text("닫기", exact=True).first.click(timeout=1200, force=True)
        await page.wait_for_timeout(300)
    except Exception:
        pass
    # 모두투어 홈 검색함은 ant-input(type=text, placeholder 없음) — 메가메뉴 클릭과 분리.
    selectors = (
        "input.ant-input",
        ".Header_inputSearch__ySaJp input",
        ".ant-input-affix-wrapper input",
        'input[type="text"]',
    )
    for sel in selectors:
        loc = page.locator(sel).first
        try:
            if await loc.count() == 0:
                continue
            try:
                if not await loc.is_visible(timeout=800):
                    continue
            except Exception:
                pass
            await loc.click(timeout=2500, force=True)
            await loc.fill("")
            await loc.fill(word)
            await page.wait_for_timeout(350)
            if await _submit_home_search(page):
                return True
            await loc.press("Enter")
            return True
        except Exception:
            continue
    return False


async def _browse_home_search(page, word: str, bag: list[str]) -> list[str]:
    """지방출발·테마 키워드 — 랜딩 상품과 섞지 않는다.
    홈 검색 결과 URL: /package/overseas?keyword=… (/search 404 금지와 별개).
    """
    from urllib.parse import quote

    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    try:
        page.on("response", on_resp)
        await _goto_home(page)
        await page.wait_for_timeout(SETTLE_MS)
        filled = await _fill_home_search(page, word)
        if not filled:
            print(f"[listing-discover-modetour] no search box {word}", file=sys.stderr)
        try:
            await page.wait_for_url(re.compile(r"keyword="), timeout=8000)
        except Exception:
            # 홈 검색함과 같은 결과 주소로 직접 이동 (사람 검색과 동일 경로)
            dest = f"https://www.modetour.com/package/overseas?keyword={quote(word)}"
            await page.goto(dest, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        await page.wait_for_timeout(SETTLE_MS + 2200)
        try:
            await page.mouse.wheel(0, 1600)
            await page.wait_for_timeout(900)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=8)
        return await _snapshot(page, bag)
    except Exception as e:
        print(f"[listing-discover-modetour] home search fail {e}", file=sys.stderr)
        return []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


async def _browse_local_departure_menu(page, word: str, bag: list[str]) -> list[str]:
    """지방출발 — 홈 검색 keyword 가 아니라 해외여행→지방출발→부산/대구/청주."""
    # REGRESSION-FREEZE[register-ingest-local-departure-reserve]: 메가메뉴 지방출발 — manifest
    city = (word or "").replace("출발", "").strip()  # 부산출발 → 부산
    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    try:
        page.on("response", on_resp)
        await _goto_home(page)
        await page.wait_for_timeout(SETTLE_MS)
        await _dismiss_home_overlay(page)
        if not await _hover_overseas(page):
            print("[listing-discover-modetour] no 해외여행 menu (local-dep)", file=sys.stderr)
            return []
        # 해외여행 패널의 지방출발
        if not await _click_label(page, "지방출발"):
            print("[listing-discover-modetour] no click 지방출발", file=sys.stderr)
            return []
        await page.wait_for_timeout(1200)
        # 부산/대구/청주 탭·라벨
        clicked_city = False
        if city:
            clicked_city = await _click_label(page, city) or await _click_label(page, word)
        if not clicked_city and city:
            # 출발지 콤보에 도시명
            for sel in (
                f"button:has-text('{city}')",
                f"a:has-text('{city}')",
                f"span:has-text('{city}')",
                f"li:has-text('{city}')",
            ):
                loc = page.locator(sel).first
                try:
                    if await loc.count() == 0:
                        continue
                    await loc.click(timeout=2500, force=True)
                    clicked_city = True
                    break
                except Exception:
                    continue
        if not clicked_city:
            print(f"[listing-discover-modetour] no click local city {city or word}", file=sys.stderr)
        await page.wait_for_timeout(SETTLE_MS + 2000)
        try:
            await page.mouse.wheel(0, 1800)
            await page.wait_for_timeout(900)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=8)
        return await _snapshot(page, bag)
    except Exception as e:
        print(f"[listing-discover-modetour] local-dep menu fail {e}", file=sys.stderr)
        return []
    finally:
        try:
            page.remove_listener("response", on_resp)
        except Exception:
            pass


async def _browse_overseas(page, word: str, bag: list[str], menu: str) -> list[str]:
    # REGRESSION-FREEZE[register-ingest-local-departure-reserve]: 지방출발 → 메가메뉴 — manifest
    # REGRESSION-FREEZE[register-ingest-theme-category-slots]: 테마 → 홈 검색 — manifest
    if (word or "").strip() in LOCAL_DEP_WORDS:
        urls = await _browse_local_departure_menu(page, word, bag)
        if urls:
            return urls
        # 메가메뉴 지방출발 실패 시 홈 검색으로 보완 (정지 회피용 느린 경로)
        print(f"[listing-discover-modetour] local-dep menu empty → home search {word}", file=sys.stderr)
        return await _browse_home_search(page, word, bag)
    if _is_home_search_word(word):
        return await _browse_home_search(page, word, bag)

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
            return []
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
    """목록 SSOT = B2C API (SearchThemeAndLocalKey → SearchProductMaster).
    Playwright 메가메뉴는 폴백 전용 — DOM 클릭이 깨져도 API로 수집한다.
    """
    # REGRESSION-FREEZE[register-listing-discover-modetour-b2c-search]: discover B2C first — manifest
    results: list[dict] = []
    for slot in slots:
        sid = str(slot.get("id") or "")
        raw = str(slot.get("searchWord") or "").strip()
        menu = str(slot.get("listingMenu") or "PKG").upper()
        # 지방출발·테마는 토큰 절단하지 않는다
        word = raw if raw in HOME_SEARCH_WORDS else _short_word(raw)
        await asyncio.sleep(_pause_s())
        ids: list[str] = []
        bag_blob = ""
        try:
            if word:
                ids = await asyncio.to_thread(_b2c_codes_for_word, word, menu)
            ids = order_codes_prefer_no_option_no_shopping(ids, bag_blob)
            results.append({"id": sid, "urls": _urls(ids)})
            print(
                f"[listing-discover-modetour] slot={sid} menu={menu} word={word[:40]} urls={len(ids)} via=b2c",
                file=sys.stderr,
            )
        except Exception as e:
            print(f"[listing-discover-modetour] slot-fail {sid} {e}", file=sys.stderr)
            results.append({"id": sid, "urls": []})
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
