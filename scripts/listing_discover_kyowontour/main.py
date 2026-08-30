# -*- coding: utf-8 -*-
"""kyowontour 목록 — 사람처럼 해외여행 클릭. 전 공급사 공통 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: kyowontour overseas click — manifest
# REGRESSION-FREEZE[register-listing-discover-overseas-click]: 홈→해외여행→메가메뉴 지명 클릭 — manifest
# REGRESSION-FREEZE[register-listing-discover-human-pace]: bundled Chromium · 공급사 자체 간격 — manifest
# REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: search list only — no tourCode seed — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-dismiss]: 홈 팝업 닫고 해외여행 — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-mega-menu]: 사이트 메뉴 글자만 클릭 — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-calendar-product]: 나라→출발일→달력 아래 상품 — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-detail-schedule]: 달력 아래 목록의 상세일정 클릭 — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-list-depart-calendar]: 나라 목록 상품 출발일→달력→상세일정 — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-menu-navigate]: 나라 클릭 후 목록으로 나감 — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-not-card-close]: 팝업만 닫고 출발일 닫기는 안 누름 — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-listing-menucode]: 클릭 URL 빈 menuCode는 목록 값 — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-x]: 팝업은 ×만 닫기 — manifest
# REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]: 열린 카드 달력·상세만 — manifest
# REGRESSION-FREEZE[register-pre-photo-ingest-no-option-no-shopping]: 노옵션·노쇼핑 우선 — manifest
from __future__ import annotations

import asyncio
import json
import random
import re
import sys
from urllib.parse import quote

from .menu_label import pick_kyowontour_mega_menu_label

PAUSE_MS_MIN = 10000
PAUSE_MS_MAX = 16000
SETTLE_MS = 5200
GOTO_TIMEOUT_MS = 48000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
DETAIL = "https://www.kyowontour.com/goods/goodsEventDetail"
HOME = "https://www.kyowontour.com/"
TOUR_RE = re.compile(r"(?:[?&]tourCode=|\"(?:tourCode|TourCode)\"\s*:\s*\")([A-Za-z0-9]+)", re.I)
TOUR_OK = re.compile(r"^[A-Za-z0-9]{8,}$")
SEED_RE = re.compile(r"[?&]tourCode=([A-Za-z0-9]+)", re.I)


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
    for m in TOUR_RE.finditer(blob or ""):
        code = m.group(1).strip()
        if not TOUR_OK.match(code):
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
    return [f"{DETAIL}?tourCode={quote(c)}" for c in codes[:24]]


def _without_seed_url(urls: list[str], seed: str) -> list[str]:
    if not seed:
        return urls
    key = seed.upper()
    return [u for u in urls if key not in u.upper()]


def _menu_code_from_url(raw: str) -> str:
    m = re.search(r"[?&]menuCode=([^&]*)", raw or "")
    return (m.group(1) or "").strip() if m else ""


def _fill_listing_menu_code(detail_url: str, listing_url: str) -> str:
    # 상세일정보기 클릭 URL에 menuCode가 비면 목록 menuCode를 쓴다. tourCode는 클릭으로 받은 것만.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-listing-menucode]: 빈 menuCode는 목록 값 — manifest
    u = (detail_url or "").split("#")[0].strip()
    if "goodsEventDetail" not in u or not re.search(r"[?&]tourCode=[^&]+", u):
        return u
    if _menu_code_from_url(u):
        return u
    menu = _menu_code_from_url(listing_url)
    if not menu:
        return u
    if re.search(r"[?&]menuCode=", u):
        return re.sub(r"([?&]menuCode=)[^&]*", rf"\1{menu}", u)
    return f"{u}{'&' if '?' in u else '?'}menuCode={menu}"


def _is_real_detail_url(raw: str) -> bool:
    u = (raw or "").split("#")[0].strip()
    if "goodsEventDetail" not in u:
        return False
    menu = ""
    tour = ""
    m = re.search(r"[?&]menuCode=([^&]*)", u)
    if m:
        menu = (m.group(1) or "").strip()
    t = re.search(r"[?&]tourCode=([^&]*)", u)
    if t:
        tour = (t.group(1) or "").strip()
    return bool(tour and menu)


def _keep_clicked_detail_hrefs(hrefs: list[str]) -> list[str]:
    # tourCode만 붙여 만든 주소는 안 쓴다. 상세일정을 눌러 나온 menuCode URL만.
    # 같은 tourCode를 menuCode만 바꿔 다시 쓰지 않는다.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-calendar-product]: menuCode 있는 상세만 — manifest
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-detail-schedule]: 상세일정 클릭 URL만 — manifest
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]: tourCode 중복 금지 — manifest
    seen: set[str] = set()
    seen_codes: set[str] = set()
    out: list[str] = []
    for raw in hrefs:
        u = (raw or "").split("#")[0].strip()
        if not _is_real_detail_url(u):
            continue
        code = _seed_code(u)
        if code and code in seen_codes:
            continue
        k = u.lower()
        if k in seen:
            continue
        seen.add(k)
        if code:
            seen_codes.add(code)
        out.append(u)
        if len(out) >= 24:
            break
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
        if "tourCode" in text or "TourCode" in text:
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


async def _click_mega_menu_country(page, lab: str) -> bool:
    # 메가메뉴 나라 글자의 <a href>를 눌러 목록으로 들어간다. 홈에 남으면 실패.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-menu-navigate]: 나라 클릭 후 홈이면 안 됨 — manifest
    href = ""
    try:
        dump = await page.evaluate(
            """(lab) => {
              const want = (lab || '').replace(/\\s+/g, '');
              const nodes = [...document.querySelectorAll('a[href], button, span, li')];
              const out = [];
              for (const n of nodes) {
                const t = (n.textContent || '').replace(/\\s+/g, ' ').trim();
                const compact = t.replace(/\\s+/g, '');
                if (t !== lab && compact !== want) continue;
                const a = n.tagName === 'A' ? n : n.closest('a');
                out.push({
                  tag: n.tagName,
                  href: a ? (a.getAttribute('href') || '') : '',
                });
                if (out.length >= 8) break;
              }
              return out;
            }""",
            lab,
        )
        print(f"[listing-discover-kyowontour] menu-hrefs {lab} {dump}", file=sys.stderr)
    except Exception as e:
        print(f"[listing-discover-kyowontour] menu-hrefs-fail {e}", file=sys.stderr)
    try:
        href = str(
            await page.evaluate(
                """(lab) => {
                  const want = (lab || '').replace(/\\s+/g, '');
                  const as = [...document.querySelectorAll('a[href]')];
                  const el = as.find((a) => {
                    const t = (a.textContent || '').replace(/\\s+/g, ' ').trim();
                    const compact = t.replace(/\\s+/g, '');
                    if (t !== lab && compact !== want) return false;
                    if (compact.length > 22) return false;
                    const h = a.getAttribute('href') || '';
                    if (!h || h === '#' || h.toLowerCase().startsWith('javascript')) return false;
                    return /goods|menuCode|list|List|pkg/i.test(h);
                  }) || as.find((a) => {
                    const t = (a.textContent || '').replace(/\\s+/g, ' ').trim();
                    return t === lab && (a.getAttribute('href') || '').length > 1;
                  });
                  if (!el) return '';
                  el.click();
                  return el.href || '';
                }""",
                lab,
            )
            or ""
        )
    except Exception:
        href = ""
    if not href:
        if not await _click_label(page, lab):
            return False
    try:
        await page.wait_for_url(re.compile(r"goods|menuCode|List|list"), timeout=20000)
    except Exception:
        cur = (page.url or "").rstrip("/")
        home = HOME.rstrip("/")
        if cur == home and href and href.rstrip("/") != home:
            try:
                await page.goto(href, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
            except Exception:
                return False
    await page.wait_for_timeout(SETTLE_MS)
    left_home = (page.url or "").rstrip("/") != HOME.rstrip("/")
    print(
        f"[listing-discover-kyowontour] menu-nav lab={lab} url={page.url} left_home={left_home}",
        file=sys.stderr,
    )
    return left_home


async def _listing_detail_hrefs(page) -> list[str]:
    try:
        hrefs = await page.eval_on_selector_all(
            "a[href*='goodsEventDetail']",
            "els => els.map(e => e.href || '')",
        )
    except Exception:
        hrefs = []
    return _keep_clicked_detail_hrefs([str(x) for x in (hrefs or []) if x])


DETAIL_SCHEDULE_LABELS = ("상세일정보기", "상세 일정보기", "상세일정")


async def _wait_listing_detail_schedule(page) -> int:
    # 달력 아래 "상세 일정보기". 영상 SSOT.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-detail-schedule]: 상세일정보기 대기 — manifest
    for label in DETAIL_SCHEDULE_LABELS:
        try:
            await page.wait_for_selector(f"text={label}", timeout=5000, state="visible")
            break
        except Exception:
            continue
    n = 0
    for label in DETAIL_SCHEDULE_LABELS:
        try:
            n = max(n, int(await page.get_by_text(label, exact=True).count()))
        except Exception:
            continue
    return n


async def _click_nth_detail_schedule(page, index: int) -> bool:
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-detail-schedule]: 달력 아래 상세일정보기 — manifest
    await _dismiss_home_overlay(page)
    for label in DETAIL_SCHEDULE_LABELS:
        loc = page.get_by_text(label, exact=True)
        try:
            n = await loc.count()
            if 0 <= index < n:
                target = loc.nth(index)
                if not await target.is_visible():
                    continue
                await target.scroll_into_view_if_needed(timeout=2500)
                await target.click(timeout=4500)
                return True
        except Exception:
            continue
    try:
        return bool(
            await page.evaluate(
                """(i) => {
                  const want = ['상세일정보기', '상세 일정보기', '상세일정'];
                  const nodes = [...document.querySelectorAll('a, button, span, em, div, li')].filter((n) => {
                    const t = (n.textContent || '').replace(/\\s+/g, '').trim();
                    return want.includes(t) || t === '상세일정보기';
                  });
                  const el = nodes[i];
                  if (!el) return false;
                  el.click();
                  return true;
                }""",
                index,
            )
        )
    except Exception:
        return False


async def _restore_listing_after_detail(page, listing_url: str) -> None:
    try:
        if "goodsEventDetail" in (page.url or ""):
            await page.go_back(wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
            await page.wait_for_timeout(900)
    except Exception:
        pass
    if "goodsEventDetail" in (page.url or "") and listing_url:
        try:
            await page.goto(listing_url, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
            await page.wait_for_timeout(SETTLE_MS)
        except Exception:
            pass
    await _close_stale_detail_pages(page)


async def _close_stale_detail_pages(page) -> None:
    # 예전에 열린 goodsEventDetail 탭은 다음 나라 URL로 쓰지 않는다.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]: 남은 탭 금지 — manifest
    for p in list(page.context.pages):
        if p is page:
            continue
        try:
            u = str(p.url or "")
        except Exception:
            continue
        if "goodsEventDetail" not in u:
            continue
        try:
            await p.close()
        except Exception:
            pass


async def _url_from_pages(page, extra: list | None = None) -> str:
    # 방금 연 탭·현재 페이지만. context 전체 leftover ESP210은 버린다.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]: 클릭 URL만 — manifest
    found: list[str] = []
    cur = (page.url or "").split("#")[0].strip()
    if "goodsEventDetail" in cur:
        found.append(cur)
    for p in list(extra or []):
        if p is page:
            continue
        try:
            u = str(p.url or "").split("#")[0].strip()
        except Exception:
            continue
        if "goodsEventDetail" in u:
            found.append(u)
        try:
            await p.close()
        except Exception:
            pass
    return found[0] if found else ""


async def _click_expanded_card_detail_schedule(page) -> bool:
    # 출발일 닫기와 같은 상품 영역의 상세일정보기만. 목록 전체·남은 탭은 안 누른다.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]: 열린 카드 상세 — manifest
    await _dismiss_home_overlay(page)
    try:
        info = await page.evaluate(
            """() => {
              const compact = (n) => (n.textContent || '').replace(/\\s+/g, '').trim();
              const isDetail = (n) => {
                const t = compact(n);
                return t === '상세일정보기' || t === '상세일정';
              };
              const departCount = (n) => ((n.textContent || '').split('출발일 선택').length - 1);
              const closeBtns = [...document.querySelectorAll('a, button, span, em, div')].filter((n) => compact(n) === '닫기');
              const departCloses = closeBtns.filter((n) => {
                const near = n.closest('li, article, section, [class*="goods"], [class*="item"], [class*="product"]') || n.parentElement;
                return /출발/.test((near && near.textContent) || '');
              });
              const close = departCloses[departCloses.length - 1] || closeBtns[closeBtns.length - 1];
              if (!close) return { ok: false, reason: 'no-close' };
              const details = [...document.querySelectorAll('a, button, span, em, div, li, p')].filter(isDetail);
              const lca = (a, b) => {
                const path = [];
                for (let n = a; n; n = n.parentElement) path.push(n);
                for (let n = b; n; n = n.parentElement) if (path.includes(n)) return n;
                return null;
              };
              let best = null;
              let bestSize = Infinity;
              for (const d of details) {
                const root = lca(close, d);
                if (!root || root === document.body || root === document.documentElement) continue;
                if (departCount(root) > 1) continue;
                const size = (root.textContent || '').length;
                if (size < bestSize) {
                  best = d;
                  bestSize = size;
                }
              }
              if (!best) {
                return { ok: false, reason: 'no-detail-near-close', nDetail: details.length, nClose: closeBtns.length };
              }
              best.click();
              return { ok: true, reason: 'clicked', nDetail: details.length };
            }"""
        )
        print(f"[listing-discover-kyowontour] expanded-detail {info}", file=sys.stderr)
        return bool(isinstance(info, dict) and info.get("ok"))
    except Exception as e:
        print(f"[listing-discover-kyowontour] expanded-detail-fail {e}", file=sys.stderr)
        return False


async def _click_listing_detail_schedules(page, listing_url: str = "", start_index: int = 0) -> list[str]:
    # 그 상품 달력 아래 상세일정 하나. 목록 href·남은 버튼 순번은 쓰지 않는다.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-detail-schedule]: 상세일정 클릭 — manifest
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]: leftover nth 금지 — manifest
    _ = start_index
    await _wait_listing_detail_schedule(page)
    extra: list = []

    def on_page(p):  # type: ignore[no-untyped-def]
        extra.append(p)

    page.context.on("page", on_page)
    clicked = await _click_expanded_card_detail_schedule(page)
    try:
        page.context.remove_listener("page", on_page)
    except Exception:
        pass
    if not clicked:
        print("[listing-discover-kyowontour] detail-schedule-click-no", file=sys.stderr)
        return []
    await page.wait_for_timeout(SETTLE_MS)
    if extra:
        try:
            await extra[0].wait_for_load_state("domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        except Exception:
            pass
    try:
        await page.wait_for_url(re.compile(r"goodsEventDetail"), timeout=16000)
    except Exception:
        pass
    print(f"[listing-discover-kyowontour] after-detail-click url={page.url}", file=sys.stderr)
    raw = await _url_from_pages(page, extra)
    if not raw:
        raw = (page.url or "").split("#")[0].strip()
    u = _fill_listing_menu_code(raw, listing_url)
    if _is_real_detail_url(u):
        print(f"[listing-discover-kyowontour] detail-schedule-ok {u}", file=sys.stderr)
        return _keep_clicked_detail_hrefs([u])
    return []


async def _count_depart_pickers(page) -> int:
    n = 0
    for label in ("출발일 선택", "출발일선택"):
        try:
            n = max(n, int(await page.get_by_text(label, exact=True).count()))
        except Exception:
            continue
    return n


async def _click_nth_depart_picker(page, index: int) -> bool:
    # 나라 목록의 그 상품 출발일. 특정 순번 고정 아님.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-list-depart-calendar]: 출발일 선택 — manifest
    for label in ("출발일 선택", "출발일선택"):
        loc = page.get_by_text(label, exact=True)
        try:
            if await loc.count() <= index:
                continue
            target = loc.nth(index)
            await target.scroll_into_view_if_needed(timeout=2500)
            await target.click(timeout=4500)
            return True
        except Exception:
            continue
    try:
        return bool(
            await page.evaluate(
                """(i) => {
                  const nodes = [...document.querySelectorAll('a, button, span, em, div')].filter((n) => {
                    const t = (n.textContent || '').replace(/\\s+/g, '').trim();
                    return t === '출발일선택';
                  });
                  const el = nodes[i];
                  if (!el) return false;
                  el.click();
                  return true;
                }""",
                index,
            )
        )
    except Exception:
        return False


async def _dump_listing_focus(page) -> None:
    # 한 나라만 보고 목록에 어떤 글자가 있는지 찍는다. 여러 나라 연타 금지.
    try:
        info = await page.evaluate(
            """() => {
              const url = location.href;
              const texts = [];
              const seen = new Set();
              for (const n of document.querySelectorAll('a, button, span, em, strong, li, p, h2, h3')) {
                const t = (n.textContent || '').replace(/\\s+/g, ' ').trim();
                if (t.length < 2 || t.length > 24) continue;
                if (seen.has(t)) continue;
                if (!/(출발|일정|상품|예약|상세|달력|선택)/.test(t)) continue;
                seen.add(t);
                texts.push(t);
                if (texts.length >= 36) break;
              }
              return { url, title: document.title || '', texts };
            }"""
        )
        print(
            f"[listing-discover-kyowontour] focus-dump url={(info or {}).get('url', '')} title={(info or {}).get('title', '')} labels={(info or {}).get('texts', [])}",
            file=sys.stderr,
        )
    except Exception as e:
        print(f"[listing-discover-kyowontour] focus-dump-fail {e}", file=sys.stderr)


async def _prefer_listing_no_shop_option_filters(page) -> None:
    # 목록 옆 노쇼핑·노옵션. 교원투어 전용.
    # REGRESSION-FREEZE[register-pre-photo-ingest-no-option-no-shopping]: 노옵션·노쇼핑 필터 — manifest
    for label in ("노쇼핑", "노옵션"):
        try:
            loc = page.get_by_text(label, exact=True)
            if await loc.count() == 0:
                continue
            target = loc.first
            if not await target.is_visible():
                continue
            await target.click(timeout=2000)
            await page.wait_for_timeout(900)
        except Exception:
            continue


async def _depart_picker_priority_indices(page, n: int) -> list[int]:
    # 카드에 노옵션·노쇼핑 있는 출발일 선택을 먼저.
    # REGRESSION-FREEZE[register-pre-photo-ingest-no-option-no-shopping]: 카드 우선 — manifest
    try:
        raw = await page.evaluate(
            """(count) => {
              const btns = [...document.querySelectorAll('a, button, span, em, div')].filter((n) => {
                const t = (n.textContent || '').replace(/\\s+/g, '').trim();
                return t === '출발일선택';
              });
              const scored = [];
              for (let i = 0; i < Math.min(count, btns.length); i++) {
                const card = btns[i].closest('li, article, [class*="goods"], [class*="item"], [class*="product"]') || btns[i].parentElement;
                const h = (card && card.textContent) || '';
                let s = 0;
                if (/노\\s*쇼핑|NO\\s*쇼핑/i.test(h)) s += 2;
                if (/노\\s*옵션|노\\s*업션|NO\\s*옵션/i.test(h)) s += 2;
                scored.push({ i, s });
              }
              scored.sort((a, b) => b.s - a.s || a.i - b.i);
              return scored.map((x) => x.i);
            }""",
            n,
        )
        if isinstance(raw, list) and raw:
            out = [int(x) for x in raw if isinstance(x, (int, float))]
            if out:
                return out
    except Exception:
        pass
    return list(range(n))


async def _collapse_open_depart_calendars(page) -> None:
    # 다음 상품 출발일을 열기 전에 방금 연 달력만 접는다. 팝업 ×와 다름.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]: 다음 카드 전 접기 — manifest
    try:
        await page.evaluate(
            """() => {
              const compact = (n) => (n.textContent || '').replace(/\\s+/g, '').trim();
              for (const n of document.querySelectorAll('a, button, span, em')) {
                if (compact(n) !== '닫기') continue;
                const near = (n.closest('li, article, section, [class*="goods"], [class*="item"], [class*="product"]') || n.parentElement || {}).textContent || '';
                if (!/출발/.test(near)) continue;
                try { n.click(); } catch (e) {}
              }
            }"""
        )
        await page.wait_for_timeout(500)
    except Exception:
        pass


async def _browse_country_listing_products(page) -> list[str]:
    # 나라·도시 목록 상품을 훑는다. 2번째 고정이 아니라 출발일→달력→상세일정.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-list-depart-calendar]: 목록 상품 검색 — manifest
    listing_url = str(page.url or "")
    try:
        await page.wait_for_selector("text=출발일 선택", timeout=14000, state="visible")
    except Exception:
        try:
            await page.wait_for_selector("text=출발일선택", timeout=4000, state="visible")
        except Exception:
            pass
    await _prefer_listing_no_shop_option_filters(page)
    await _dump_listing_focus(page)
    n = await _count_depart_pickers(page)
    print(f"[listing-discover-kyowontour] listing-depart n={n}", file=sys.stderr)
    if n < 1:
        return []
    order = await _depart_picker_priority_indices(page, n)
    out: list[str] = []
    for i in order[:5]:
        if page.is_closed():
            break
        try:
            await _dismiss_home_overlay(page)
            await _collapse_open_depart_calendars(page)
            if not await _click_nth_depart_picker(page, i):
                continue
            await page.wait_for_timeout(SETTLE_MS)
            await _dismiss_home_overlay(page)
            cal = await _click_listing_calendar_day(page)
            print(
                f"[listing-discover-kyowontour] product-calendar i={i} {'ok' if cal else 'no'}",
                file=sys.stderr,
            )
            if not cal:
                continue
            await page.wait_for_timeout(1200)
            hrefs = await _click_listing_detail_schedules(page, listing_url)
            out.extend(hrefs)
            await _restore_listing_after_detail(page, listing_url)
            await page.wait_for_timeout(900)
            if len(_keep_clicked_detail_hrefs(out)) >= 6:
                break
        except Exception as e:
            print(f"[listing-discover-kyowontour] listing-product-fail i={i} {e}", file=sys.stderr)
            try:
                await _restore_listing_after_detail(page, listing_url)
            except Exception:
                pass
    return _keep_clicked_detail_hrefs(out)


async def _click_listing_calendar_day(page) -> bool:
    # 방금 연 그 상품(닫기) 달력에서 출발일 하나. 페이지 첫 달력·남은 위젯 아님.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-calendar-product]: 나라→출발일→달력 아래 상품 — manifest
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-list-depart-calendar]: 상품 달력 — manifest
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]: 열린 카드 달력 — manifest
    try:
        clicked = await page.evaluate(
            """() => {
              const compactText = (n) => (n.textContent || '').replace(/\\s+/g, '').trim();
              const departCount = (n) => ((n.textContent || '').split('출발일 선택').length - 1);
              const findPriced = (root) => {
                const nodes = [...root.querySelectorAll('td, button, a, span, div')];
                return nodes.find((n) => {
                  const t = (n.textContent || '').replace(/\\s+/g, ' ').trim();
                  if (t.length < 2 || t.length > 36) return false;
                  if (!/^\\d{1,2}\\b/.test(t)) return false;
                  const compact = t.replace(/,/g, '').replace(/\\s+/g, '');
                  if (!/(원|[1-9]\\d{4,})/.test(compact) && !/,\\d{3}/.test(t)) return false;
                  const cls = String(n.className || '').toLowerCase();
                  if ((n.getAttribute('aria-disabled') || '') === 'true') return false;
                  if (/(disabled|empty|prev|next|unable|sold|off)/.test(cls)) return false;
                  return true;
                }) || null;
              };
              const closeBtns = [...document.querySelectorAll('a, button, span, em, div')].filter((n) => compactText(n) === '닫기');
              const departCloses = closeBtns.filter((n) => {
                const near = n.closest('li, article, section, [class*="goods"], [class*="item"], [class*="product"]') || n.parentElement;
                return /출발/.test((near && near.textContent) || '');
              });
              const close = departCloses[departCloses.length - 1] || closeBtns[closeBtns.length - 1];
              if (!close) return false;
              for (let n = close; n && n !== document.body; n = n.parentElement) {
                if (departCount(n) > 1) break;
                const el = findPriced(n);
                if (el) {
                  el.click();
                  return true;
                }
              }
              return false;
            }"""
        )
        if clicked:
            await page.wait_for_timeout(SETTLE_MS)
            return True
    except Exception:
        pass
    return False


async def _read_mega_menu_labels(page) -> list[str]:
    # 열린 메가메뉴에 보이는 짧은 글자만. 교원투어 DOM 전용.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-mega-menu]: 사이트 메뉴 글자만 클릭 — manifest
    try:
        raw = await page.evaluate(
            """() => {
              const roots = [...document.querySelectorAll(
                'nav, header, .gnb, .GNB, [class*="gnb"], [class*="Gnb"], [class*="mega"], [class*="submenu"], [class*="depth"]'
              )];
              const seen = new Set();
              const out = [];
              for (const root of roots) {
                for (const n of root.querySelectorAll('a, button, span, li, em, p')) {
                  const t = (n.textContent || '').replace(/\\s+/g, ' ').trim();
                  if (t.length < 2 || t.length > 18) continue;
                  if (seen.has(t)) continue;
                  seen.add(t);
                  out.push(t);
                }
              }
              return out;
            }"""
        )
        if isinstance(raw, list):
            return [str(x) for x in raw if isinstance(x, str)]
    except Exception:
        pass
    return []


async def _dismiss_home_overlay(page) -> None:
    # 교원 팝업은 오늘하루 없이 ×만 있는 경우가 많다. 상품 출발일 '닫기'는 안 누른다.
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-dismiss]: 홈 팝업 닫고 해외여행 — manifest
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-not-card-close]: 목록 닫기≠팝업 — manifest
    # REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-x]: 팝업은 ×만 닫기 — manifest
    for _ in range(5):
        for loc in (
            page.get_by_text("오늘하루 보지 않기", exact=True),
            page.get_by_text("오늘 하루 보지 않기", exact=True),
            page.get_by_text("다시 보지 않기", exact=True),
            page.locator("[role='dialog']").get_by_text("×", exact=True),
            page.get_by_text("×", exact=True),
            page.get_by_text("✕", exact=True),
        ):
            try:
                target = loc.first
                if await target.count() == 0:
                    continue
                if not await target.is_visible():
                    continue
                await target.click(timeout=1400, force=True)
                await page.wait_for_timeout(350)
            except Exception:
                continue
        try:
            n = int(
                await page.evaluate(
                    """() => {
                      const isX = (n) => {
                        const t = (n.textContent || '').replace(/\\s+/g, '').trim();
                        if (t === '×' || t === 'X' || t === '✕') return true;
                        const aria = (n.getAttribute('aria-label') || '').trim();
                        if (aria === '닫기' || aria.toLowerCase() === 'close') return true;
                        const cls = String(n.className || '').toLowerCase();
                        return /(close|cls|btn_close|btn-close|pop-close|layer-close)/.test(cls) && t.length <= 2;
                      };
                      let clicked = 0;
                      for (const n of document.querySelectorAll('button,a,span,label,i,em,div')) {
                        if (!isX(n)) continue;
                        const near = (n.closest('li, article, [class*="goods"], [class*="product"]') || {}).textContent || '';
                        if (/출발일/.test(near)) continue;
                        try { n.click(); clicked += 1; } catch (e) {}
                      }
                      return clicked;
                    }"""
                )
                or 0
            )
            if n:
                await page.wait_for_timeout(400)
            else:
                break
        except Exception:
            break


async def _hover_overseas(page) -> bool:
    await _dismiss_home_overlay(page)
    try:
        await page.wait_for_selector("text=해외여행", timeout=14000, state="visible")
    except Exception:
        pass
    for loc in (
        page.get_by_role("link", name=re.compile(r"해외여행|해외패키지")),
        page.get_by_text("해외여행", exact=False),
        page.locator("a", has_text="해외여행"),
        page.locator("nav :text('해외여행')"),
        page.locator("header :text('해외여행')"),
        page.get_by_role("link", name="패키지"),
    ):
        try:
            target = loc.first
            if await target.count() == 0:
                continue
            try:
                await target.hover(timeout=4000)
            except Exception:
                await target.hover(timeout=2500, force=True)
            await page.wait_for_timeout(1600)
            return True
        except Exception:
            continue
    try:
        for node in await page.query_selector_all("nav a, .gnb a, header a, header span, header button"):
            t = await node.text_content()
            if t and "해외여행" in (t or "").replace(" ", ""):
                try:
                    await node.hover()
                except Exception:
                    await node.hover(force=True)
                await page.wait_for_timeout(1600)
                return True
    except Exception:
        pass
    return False


async def _browse_overseas(page, word: str, bag: list[str], menu: str) -> list[str]:
    tasks: list[asyncio.Task] = []

    def on_resp(r):  # type: ignore[no-untyped-def]
        tasks.append(asyncio.create_task(_capture(r, bag)))

    try:
        if page.is_closed():
            return []
        page.on("response", on_resp)
        await _close_stale_detail_pages(page)
        await page.goto(HOME, wait_until="domcontentloaded", timeout=GOTO_TIMEOUT_MS)
        await page.wait_for_timeout(SETTLE_MS)
        await _dismiss_home_overlay(page)
        if not await _hover_overseas(page):
            print("[listing-discover-kyowontour] no 해외여행 menu", file=sys.stderr)
            return []
        if menu == "FIT":
            await _click_label(page, "자유여행")
            await page.wait_for_timeout(700)
            await _hover_overseas(page)
        labels = await _read_mega_menu_labels(page)
        pick = pick_kyowontour_mega_menu_label(word, labels)
        print(
            f"[listing-discover-kyowontour] menu-label word={word} pick={pick or '-'} n={len(labels)}",
            file=sys.stderr,
        )
        clicked = False
        if pick:
            clicked = await _click_mega_menu_country(page, pick)
        if not clicked:
            for parent in _parents(word)[:1]:
                parent_pick = pick_kyowontour_mega_menu_label(parent, labels)
                if parent_pick and await _click_mega_menu_country(page, parent_pick):
                    await page.wait_for_timeout(800)
                    await _hover_overseas(page)
                    labels = await _read_mega_menu_labels(page)
                    pick = pick_kyowontour_mega_menu_label(word, labels)
                    if pick:
                        clicked = await _click_mega_menu_country(page, pick)
                    if clicked:
                        break
        if not clicked:
            print(f"[listing-discover-kyowontour] no click {word}", file=sys.stderr)
            return []
        await _dismiss_home_overlay(page)
        await page.wait_for_timeout(SETTLE_MS + 1600)
        try:
            await page.mouse.wheel(0, 700)
            await page.wait_for_timeout(800)
        except Exception:
            pass
        if tasks:
            await asyncio.wait(tasks, timeout=6)
        hrefs = await _browse_country_listing_products(page)
        print(f"[listing-discover-kyowontour] calendar-product word={word} urls={len(hrefs)}", file=sys.stderr)
        return hrefs
    except Exception as e:
        print(f"[listing-discover-kyowontour] browse fail {e}", file=sys.stderr)
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
            viewport={"width": 1420, "height": 880},
            user_agent=UA,
        )
        page = await ctx.new_page()
        page.set_default_timeout(GOTO_TIMEOUT_MS)
        seen_codes: set[str] = set()
        try:
            for slot in slots:
                sid = str(slot.get("id") or "")
                raw = str(slot.get("searchWord") or "").strip()
                menu = str(slot.get("listingMenu") or "PKG").upper()
                word = _short_word(raw)
                seed = str(slot.get("seedOriginUrl") or "").strip()
                seed_code = _seed_code(seed)
                try:
                    page = await _ensure_page(ctx, page)
                    bag: list[str] = []
                    await asyncio.sleep(_pause_s())
                    hrefs: list[str] = []
                    if word:
                        hrefs = await _browse_overseas(page, word, bag, menu)
                    hrefs = _without_seed_url(hrefs, seed_code)
                    fresh: list[str] = []
                    for u in hrefs:
                        code = _seed_code(u)
                        if code and code in seen_codes:
                            continue
                        fresh.append(u)
                        if code:
                            seen_codes.add(code)
                    hrefs = fresh
                    results.append({"id": sid, "urls": hrefs[:24]})
                    print(
                        f"[listing-discover-kyowontour] slot={sid} menu={menu} word={word[:40]} urls={len(hrefs)} codes={[ _seed_code(u) for u in hrefs[:6] ]}",
                        file=sys.stderr,
                    )
                except Exception as e:
                    print(f"[listing-discover-kyowontour] slot-fail {sid} {e}", file=sys.stderr)
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
        print(f"[listing-discover-kyowontour] fatal {e}", file=sys.stderr)
        print(json.dumps({"ok": False, "results": [], "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
