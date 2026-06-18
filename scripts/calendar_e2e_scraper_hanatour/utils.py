# -*- coding: utf-8 -*-
"""
인간 모사·UA·가격·동일상품 키·브라우저 기동 — calendar_e2e_scraper_hanatour SSOT.
"""
from __future__ import annotations

import asyncio
import difflib
import random
import re
from datetime import datetime, timedelta, timezone
from html import unescape
from typing import Any
from urllib.parse import parse_qs, urlparse

from pathlib import Path
import sys

_scripts_dir = Path(__file__).resolve().parents[1]
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))
from calendar_e2e_common.kst_collect_start import kst_collect_start_ymd

from . import config as _e2e_config

from calendar_e2e_common.horizon import CALENDAR_PRICE_HORIZON_MONTHS_FORWARD

# --- KST (lib/calendar-price-horizon.ts 와 맞춤) ---
KST = timezone(timedelta(hours=9))
DEFAULT_MAX_MONTHS = CALENDAR_PRICE_HORIZON_MONTHS_FORWARD


def kst_today_ymd() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


# --- 항공사명 모지바케 (airline_encoding_fix 최소 이식) ---
def _hangul_count(s: str) -> int:
    return len(re.findall(r"[가-힣]", s))


def _replacement_count(s: str) -> int:
    return s.count("\ufffd")


def _looks_like_mojibake_garbage(s: str) -> bool:
    if not s:
        return False
    if _replacement_count(s) >= 1:
        return True
    if re.search(r"[\uE000-\uF8FF]", s):
        return True
    if _hangul_count(s) >= 2:
        return False
    if re.search(r"[?]{2,}", s) and _hangul_count(s) == 0:
        return True
    return False


def _latin1_misread_candidates(t: str) -> list[str]:
    out: list[str] = []
    try:
        b = t.encode("latin-1")
        out.append(b.decode("utf-8"))
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    try:
        b = t.encode("latin-1")
        out.append(b.decode("cp949"))
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    return [x for x in out if isinstance(x, str) and x and x != t]


def _pick_best_recovered(original: str, candidates: list[str]) -> str | None:
    if not candidates:
        return None
    h0 = _hangul_count(original)
    r0 = _replacement_count(original)
    best: str | None = None
    best_score = -10_000
    for c in candidates:
        h1 = _hangul_count(c)
        r1 = _replacement_count(c)
        score = h1 * 20 - r1 * 15 - len(re.findall(r"\?", c)) * 2
        if h1 >= max(2, h0) and r1 <= r0:
            score += 50
        if h0 == 0 and h1 >= 2:
            score += 40
        if score > best_score:
            best_score = score
            best = c
    if best is None:
        return None
    if h0 >= 2 and _hangul_count(best) < h0 - 1:
        return None
    return best


def fix_mojibake_korean_str(s: str | None, *, max_len: int = 500) -> str | None:
    if s is None:
        return None
    t = str(s).strip()
    if not t:
        return None
    caps = _latin1_misread_candidates(t)
    picked = _pick_best_recovered(t, caps)
    if picked:
        out = picked.strip()[:max_len]
        if out:
            return out
    try:
        t.encode("latin-1")
    except (UnicodeDecodeError, UnicodeEncodeError):
        if _replacement_count(t) > 3:
            return None
        if re.search(r"[?]{3,}", t) and _hangul_count(t) < 2:
            return None
        if _looks_like_mojibake_garbage(t):
            return None
        return t[:max_len]
    if picked is None:
        if _replacement_count(t) > 3:
            return None
        if re.search(r"[?]{3,}", t) and _hangul_count(t) < 2:
            return None
        if _looks_like_mojibake_garbage(t):
            return None
    return t[:max_len]


def fix_airline_name_str(s: str | None) -> str | None:
    return fix_mojibake_korean_str(s, max_len=120)


# --- 딜레이·가격 (기본 액션 2초 미만 방지) ---
MIN_DELAY = 2.0
MAX_DELAY = 4.0


async def human_delay(min_sec: float | None = None, max_sec: float | None = None) -> None:
    lo = min_sec if min_sec is not None else MIN_DELAY
    hi = max_sec if max_sec is not None else MAX_DELAY
    await asyncio.sleep(random.uniform(lo, hi))


def clean_price_to_int(text: str) -> int:
    if not text or not str(text).strip():
        return 0
    s = str(text).strip().replace(",", "").replace(" ", "")
    if s in ("-", "—", ""):
        return 0
    if "만" in s:
        s = s.replace("만", "")
        try:
            return int(float(s) * 10000)
        except ValueError:
            pass
    s = re.sub(r"[^\d]", "", s)
    try:
        return int(s) if s else 0
    except ValueError:
        return 0


def dedupe_departures_by_date(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_date: dict[str, dict[str, Any]] = {}
    for r in rows:
        d = str(r.get("departureDate") or "").strip()[:10]
        if len(d) != 10:
            continue
        if d not in by_date:
            by_date[d] = r
    return sorted(by_date.values(), key=lambda x: str(x.get("departureDate") or ""))


# --- UA / stealth / 브라우저 ---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
]


def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)


STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5], configurable: true });
Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
"""


async def launch_hanatour_browser(
    headless: bool = True,
) -> tuple[object, object, object, object]:
    from playwright.async_api import async_playwright

    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=headless,
        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    )
    context = await browser.new_context(
        user_agent=get_random_user_agent(),
        viewport={
            "width": max(320, _e2e_config.VIEWPORT_WIDTH),
            "height": max(240, _e2e_config.VIEWPORT_HEIGHT),
        },
        locale="ko-KR",
        extra_http_headers={
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    )
    await context.add_init_script(STEALTH_INIT_SCRIPT)
    page = await context.new_page()
    page.set_default_timeout(45000)
    return pw, browser, context, page


async def close_hanatour_browser(pw: object | None, browser: object | None) -> None:
    try:
        if browser:
            await browser.close()
    except Exception:
        pass
    try:
        if pw is not None:
            await pw.stop()  # type: ignore[union-attr]
    except Exception:
        pass


# --- 상세 HTML에서 baseline 제목 (product_core 의 h1/title 최소 추출) ---
def extract_hanatour_detail_raw_title(html: str) -> str:
    m_og = re.search(
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
        html,
        re.I,
    )
    if m_og:
        t = unescape(m_og.group(1).strip())
        t = re.sub(r"\s*[|\-–]\s*하나투어.*$", "", t, flags=re.I).strip()
        if len(t) >= 8:
            return t
    for pat in (
        r'class="[^"]*(?:prod(?:uct)?_title|goods_title|tit_product)[^"]*"[^>]*>([\s\S]*?)</',
        r"<h1[^>]*>([\s\S]*?)</h1>",
    ):
        m = re.search(pat, html, re.I)
        if m:
            t = re.sub(r"<[^>]+>", " ", m.group(1))
            t = unescape(re.sub(r"\s+", " ", t).strip())
            if len(t) >= 8:
                return t
    m2 = re.search(r"<title>([^<]+)</title>", html, re.I)
    if m2:
        t = m2.group(1).strip()
        t = re.sub(r"\s*[|\-–]\s*하나투어.*$", "", t, flags=re.I).strip()
        return t
    return ""


_HANATOUR_LIST_CHROME_PREFIX = re.compile(
    r"^(?:"
    r"총\s*\d+\s*개\s*"
    r"|현지\s*합류\s*"
    r"|출발시간\s*빠른순\s*"
    r"|가격\s*낮은순\s*"
    r"|가격\s*높은순\s*"
    r"|인기\s*순\s*"
    r")+",
    re.I,
)


def hanatour_strip_modal_list_chrome(s: str) -> str:
    """모달 우측 리스트 정렬·집계 문구 제거."""
    t = (s or "").replace("\u00a0", " ").strip()
    if not t:
        return ""
    for _ in range(10):
        old = t
        t = _HANATOUR_LIST_CHROME_PREFIX.sub("", t).strip()
        if t == old:
            break
    return " ".join(t.split())


def hanatour_split_concatenated_list_text(text: str) -> list[str]:
    """우측 리스트가 한 DOM 노드에 합쳐진 경우 패키지 단위로 분할."""
    t = (text or "").replace("\u00a0", " ").strip()
    if not t:
        return []
    if not re.search(r"총\s*\d+\s*개", t) and len(t) < 900:
        return [t]
    t = hanatour_strip_modal_list_chrome(t)
    parts = re.split(
        r"(?=(?:\[스마트초이스\]\s*)?(?:\[한정특가\]\s*)?패키지\s+(?:스탠다드|세이브|이코노미|프리미엄|\[))",
        t,
    )
    out = [p.strip() for p in parts if len(p.strip()) > 24 and re.search(r"\d+\s*일", p)]
    return out if len(out) > 1 else [t]


def hanatour_pick_product_row_baseline_text(rows_raw: Any) -> str | None:
    """리스트에서 출발 상품 행( N일 포함) 첫 건 — 헤더·정렬 문구 제외."""
    if not isinstance(rows_raw, list):
        return None
    for r in rows_raw:
        if not isinstance(r, dict):
            continue
        tx = (r.get("text") or "").replace("\u00a0", " ").strip()
        if len(tx) < 16:
            continue
        if re.match(
            r"^(?:총\s*\d+\s*개|출발일|다른\s*출발|상품\s*안내|이용\s*안내)",
            tx[:48],
            re.I,
        ):
            continue
        if not re.search(r"\b\d+\s*일\b", tx):
            continue
        line = tx.split("\n")[0].strip()
        picked = line if len(line) >= 12 else tx[:800]
        return hanatour_strip_modal_list_chrome(picked)
    return None


def parse_hanatour_product_identifiers(detail_url: str) -> dict[str, str | None]:
    out: dict[str, str | None] = {"pkg_cd": None, "path": None}
    try:
        u = urlparse(detail_url)
        out["path"] = u.path or None
        qs = parse_qs(u.query)
        if "pkgCd" in qs and qs["pkgCd"]:
            out["pkg_cd"] = qs["pkgCd"][0]
    except Exception:
        pass
    return out


# --- 하나투어 동일상품 키 (identifiers.py 핵심 이식) ---
_BADGE_PREFIX = re.compile(r"^(?:\[[^\]]*]\s*)+")
_HANATOUR_PROMO_BLOCK_RE = re.compile(
    r"^[★☆♥♡✦•●◆□▪❤♪♫♬♭♮♯][^★☆♥♡✦•●◆□▪❤♪♫♬♭♮♯#\n]{0,80}[★☆♥♡✦•●◆□▪❤♪♫♬♭♮♯]\s*"
)
_HANATOUR_LEADING_SPECIAL_RE = re.compile(r"^[★☆♥♡✦•●◆□▪❤♪♫♬♭♮♯\s]+")
_WS_COLLAPSE_VARIANT = re.compile(r"\s+")
_STATUS_ONLY_BADGE_INNER = re.compile(
    r"^(?:"
    r"출발\s*확정|예약\s*가능|대기\s*예약|예약\s*마감|항공\s*확정|일정\s*확정|"
    r"호텔\s*확정|가격\s*확정|마감|출발\s*예정|대기"
    r")$",
    re.I,
)


def normalize_hanatour_variant_label_key(s: str | None) -> str:
    if not s:
        return ""
    t = str(s).replace("\u00a0", " ").strip()
    return _WS_COLLAPSE_VARIANT.sub(" ", t).strip()


def hanatour_variant_inner_is_status_only(inner: str) -> bool:
    t = normalize_hanatour_variant_label_key(inner)
    return bool(t and _STATUS_ONLY_BADGE_INNER.match(t))


_NDAY_IN_PRE = re.compile(r"([^#\[\]]+?/)*[^#\[\]]+?\s+\d+\s*일")
# REGRESSION-FREEZE[hanatour-e2e-airtel-same-product]: 자유여행(방콕 N일) anchor·동일상품 매칭
_GEO_NDAY_ANCHOR = re.compile(
    r"([가-힣]{2,24}(?:\s*/\s*[가-힣]{2,24})*(?:\s+\d+\s*박)?(?:\s+\d+\s*국)?)"
    r"(?:\s+자유\s*여행)?"
    r"\s+(\d+)\s*일",
)
_HANATOUR_LEADING_NON_TITLE = re.compile(
    r"^(?:"
    r"스마트\s*초이스|스마트초이스|"
    r"한정\s*특가|한정특가|"
    r"최저가|"
    r"출발\s*확정|출발확정|"
    r"출발\s*예정|출발예정|"
    r"가격\s*예정|일정\s*예정|"
    r"특가|초특가|마감\s*임박|"
    r"패키지\s*(?:스탠다드|세이브|이코노미|프리미엄|골드|실버)|"
    r"패키지|"
    r"이코노미|프리미엄|"
    r")\s*",
    re.I,
)
_HANATOUR_ROW_META_TAIL = re.compile(
    r"\s+(?:"
    r"\d+\s*박\s*\d+\s*일\s*호텔.*"
    r"|호텔\s*\d+\s*성급.*"
    r"|쇼핑\s*\d+.*"
    r")$",
    re.I,
)
_HANATOUR_ANCHOR_OP_SUFFIX = re.compile(
    r"(?:"
    r",\s*잔여[\s\S]*$"
    r"|\s+잔여\s*\d+[\s\S]*$"
    r"|\s+(?:"
    r"[가-힣A-Za-z0-9·&]{2,22}항공"
    r"|이스타항공|진에어|에어서울|에어부산|제주항공|티웨이항공|에어프레미아|에어아시아"
    r"|타이\s*에어아시아|타이에어아시아"
    r"|[가-힣]{2,12}에어[가-힣]{0,8}"
    r")[\s\S]*$"
    r"|\s+\d{1,2}/\d{1,2}\s*\([^)]*\)[\s\S]*$"
    r")",
    re.I,
)


def hanatour_pre_hash_title(raw_title: str) -> str:
    """TS `buildDepartureTitleLayers`와 동일 축: 맨 앞 연속 `[...]`만 제거, 본문·`#`·괄호 유지, 공백만 정리."""
    if not raw_title:
        return ""
    s = raw_title.replace("\u00a0", " ").strip()
    s = _BADGE_PREFIX.sub("", s).strip()
    s = _HANATOUR_PROMO_BLOCK_RE.sub("", s).strip()
    s = _HANATOUR_LEADING_SPECIAL_RE.sub("", s).strip()
    return " ".join(s.split())


def _hanatour_glue_hangul_before_nday(s: str) -> str:
    if not s:
        return ""
    t = s.replace("\u00a0", " ")
    return re.sub(r"([가-힣])(\d{1,2}\s*일)", r"\1 \2", t)


def hanatour_normalized_base_title_from_pre_hash(pre_hash_title: str) -> str:
    if not pre_hash_title:
        return ""
    collapsed = " ".join(pre_hash_title.replace("\u00a0", " ").split())
    collapsed = " ".join(_hanatour_glue_hangul_before_nday(collapsed).split())
    m = _NDAY_IN_PRE.search(collapsed)
    if m:
        key = " ".join(m.group(0).split()).strip()
        if key:
            return key
    return collapsed


def hanatour_title_layers(raw_title: str) -> dict[str, str]:
    raw = (raw_title or "").replace("\u00a0", " ").strip()
    pre = hanatour_pre_hash_title(raw)
    cmp_no_space = re.sub(r"\s+", "", pre)
    return {
        "rawTitle": raw,
        "preHashTitle": pre,
        "comparisonTitle": pre,
        "comparisonTitleNoSpace": cmp_no_space,
        "normalizedBaseTitle": pre,
    }


_HANATOUR_AIR_TOKEN = (
    r"(?:[가-힣A-Za-z0-9·&]{2,24}항공|[가-힣A-Za-z0-9·&]{1,16}에어웨이|[가-힣A-Za-z0-9·&]{1,16}에어)"
)
_HANATOUR_FLIGHT_SEAT_HEAD = re.compile(
    r"\s+(?=(?:[가-힣A-Za-z]{2,22}항공|[가-힣A-Za-z]{1,14}에어)\s*,\s*잔여)"
)
_HANATOUR_FLIGHT_SEAT_TAIL = re.compile(
    rf"\s+{_HANATOUR_AIR_TOKEN}\s*[,，]?\s*잔여(?:\s*\d{{1,4}}\s*석)?"
)


def _hanatour_strip_status_brackets_for_match_key(t: str) -> str:
    s = " ".join(t.split())
    for _ in range(32):
        removed = False
        for m in re.finditer(r"\[([^\]]*)\]", s):
            inner = normalize_hanatour_variant_label_key(m.group(1))
            if inner and hanatour_variant_inner_is_status_only(inner):
                s = (s[: m.start()] + " " + s[m.end() :]).strip()
                s = " ".join(s.split())
                removed = True
                break
        if not removed:
            break
    return s


def hanatour_raw_title_exact_match_key(s: Any) -> str:
    if s is None:
        return ""
    t = str(s).replace("\u00a0", " ").replace("\u3000", " ").replace("，", ",")
    t = " ".join(t.split())
    if not t:
        return ""
    t = _hanatour_strip_status_brackets_for_match_key(t)
    for _ in range(6):
        old = t
        m = _HANATOUR_FLIGHT_SEAT_HEAD.search(t)
        if m:
            t = t[: m.start()].rstrip()
        m2 = _HANATOUR_FLIGHT_SEAT_TAIL.search(t)
        if m2:
            t = t[: m2.start()].rstrip()
        if old == t:
            break
    return t


_HANATOUR_STATUS_TAIL = re.compile(
    r"(?:예약가능|예약\s*가능|대기\s*예약|출발\s*확정|예약\s*마감|항공\s*확정|"
    r"일정\s*확정|대기|마감|출발\s*예정)(?:\s*\|[^\s|]*)*",
    re.I,
)
_HANATOUR_PRICE_WON = re.compile(r"[\d,]{2,}\s*원|\d{1,3}(?:,\d{3})+\s*원")
_HANATOUR_VOLATILE_EDGE = re.compile(
    r"^(?:특가|마감임박|선착순|초특가)\s+|\s+(?:특가|마감임박|선착순|초특가)$"
)


def _strip_all_square_brackets(s: str) -> str:
    """동일상품 비교: `[ ... ]` 전부 제거 (상태/장식 구분 없음)."""
    if not s:
        return ""
    t = s
    for _ in range(64):
        nu = re.sub(r"\[[^\]]*\]", " ", t)
        nu = " ".join(nu.split())
        if nu == t:
            break
        t = nu
    return t.strip()


_DECORATIVE_CHARS = re.compile(
    r"[\u2660-\u2668\u266A-\u266F\u2600-\u2605\u2609\u2614\u2615"
    r"\u263A\u263B\u2764\u2765\u2728\u2744\u2756\u2757"
    r"♥♡★☆✦✧•●○◆◇□▪▫❤♪♫♬♭♮♯]"
)


def _strip_volatile_for_anchor_compare(s: str) -> str:
    """날짜·시간·가격·항공사·잔여석·예약상태 등 비교 전 제거 (hanatour_raw_title_core_match_key와 동일 계열)."""
    if not s:
        return ""
    u = s.replace("\u00a0", " ").strip()
    u = _BADGE_PREFIX.sub("", u).strip()
    u = _HANATOUR_VOLATILE_EDGE.sub(" ", u)
    u = " ".join(u.split())
    u = re.sub(r"\d{1,2}/\d{1,2}\s*\([^)]*\)", " ", u)
    u = re.sub(r"\d{4}-\d{2}-\d{2}", " ", u)
    u = re.sub(r"\b\d{1,2}:\d{2}\b", " ", u)
    u = re.sub(r"잔여\s*\d{1,4}\s*석", " ", u)
    u = _HANATOUR_PRICE_WON.sub(" ", u)
    u = _HANATOUR_STATUS_TAIL.sub(" ", u)
    u = u.replace("/", " ")
    u = re.sub(rf"\s+{_HANATOUR_AIR_TOKEN}\s+", " ", u)
    u = re.sub(r"\b[가-힣]{2,10}항공\b", " ", u)
    u = re.sub(r"\b에어[가-힣]{2,10}\b", " ", u)
    u = re.sub(r"[,，|]+\s*", " ", u)
    u = " ".join(u.split())
    return u.strip()


def hanatour_strip_leading_non_title_badge(s: str) -> str:
    """스마트초이스·최저가·출발확정·패키지 티어·리스트 크롬 등 상품명 앞 배지만 제거."""
    t = (s or "").replace("\u00a0", " ").replace("\u3000", " ")
    t = " ".join(t.split())
    if not t:
        return ""
    t = hanatour_strip_modal_list_chrome(t)
    t = hanatour_pre_hash_title(t)
    for _ in range(24):
        old = t
        t = _HANATOUR_LEADING_NON_TITLE.sub("", t).strip()
        if t == old:
            break
    return " ".join(t.split())


def hanatour_row_title_from_text(text: str) -> str:
    """모달 행 전체 텍스트에서 상품명(지역+N일+#옵션)만 추출 — 항공·잔여석·출발일시 제외."""
    t = hanatour_strip_leading_non_title_badge(text or "")
    if not t:
        return ""
    t = _DECORATIVE_CHARS.sub("", t)
    t = hanatour_raw_title_exact_match_key(t)
    t = _HANATOUR_ANCHOR_OP_SUFFIX.sub("", t).strip()
    t = _HANATOUR_ROW_META_TAIL.sub("", t).strip()
    return " ".join(t.split())


def hanatour_anchor_tail_comparison_key(tail: str) -> str:
    """공백·# 앞뒤 간격 차이 허용(벳부 온천 vs 벳부온천)."""
    t = (tail or "").replace("\u00a0", " ")
    t = " ".join(t.split())
    t = re.sub(r"[-－―]\s*[>＞→﹥]\s*", ">", t)
    t = re.sub(r"\s+#", "#", t)
    return re.sub(r"\s+", "", t)


def hanatour_anchor_tails_compatible(registered_raw: str, row_raw: str) -> bool:
    """등록명 꼬리와 행 꼬리 — 완전 일치 또는 행에만 추가 #태그(운영 문구)."""
    dec = hanatour_same_product_anchor_decision(registered_raw, row_raw)
    if dec.get("sameProductMatch"):
        return True
    k1 = hanatour_anchor_tail_comparison_key(hanatour_extract_anchor_tail(registered_raw))
    k2 = hanatour_anchor_tail_comparison_key(hanatour_extract_anchor_tail(row_raw))
    if not k1 or not k2 or len(k1) < 6:
        return False
    if k2 == k1:
        return True
    if k2.startswith(k1) and k2[len(k1) :].startswith("#"):
        return True
    return False


def hanatour_extract_anchor_tail(s: str) -> str:
    """
    동일상품 비교 꼬리: (지역/국가 + N일)부터 #옵션·변형 태그까지 포함.
    앞쪽 배지·뒤쪽 항공/날짜/잔여석만 제거.
    """
    base = hanatour_strip_leading_non_title_badge(s)
    if not base:
        return ""
    base = _strip_all_square_brackets(base)
    base = _DECORATIVE_CHARS.sub("", base)
    base = _hanatour_glue_hangul_before_nday(base)
    matches = list(_GEO_NDAY_ANCHOR.finditer(base))
    if not matches:
        return ""
    tail = base[matches[-1].start() :].strip()
    tail = hanatour_raw_title_exact_match_key(tail)
    tail = _HANATOUR_ANCHOR_OP_SUFFIX.sub("", tail).strip()
    tail = _HANATOUR_ROW_META_TAIL.sub("", tail).strip()
    return " ".join(tail.split())


def hanatour_prepare_for_anchor_compare(s: str) -> str:
    """디버그·로그용 준비 문자열(anchor tail)."""
    return hanatour_extract_anchor_tail(s)


def hanatour_same_product_anchor_decision(
    registered_raw: str,
    row_raw: str,
) -> dict[str, Any]:
    """
    지역/국가+N일부터 #변형 태그까지 동일할 때 sameProductMatch.
    앞 배지(스마트초이스·최저가·패키지 티어 등)만 제거, fuzzy 없음.
    """
    tail1 = hanatour_extract_anchor_tail(registered_raw)
    tail2 = hanatour_extract_anchor_tail(row_raw)
    out: dict[str, Any] = {
        "sameProductMatch": False,
        "mismatchReason": "empty_after_prepare",
        "registeredAnchorText": tail1,
        "rowAnchorText": tail2,
        "registeredPrepared": tail1,
        "rowPrepared": tail2,
    }
    if not tail1 or not tail2:
        out["mismatchReason"] = "empty_after_prepare"
        return out
    k1 = hanatour_anchor_tail_comparison_key(tail1)
    k2 = hanatour_anchor_tail_comparison_key(tail2)
    if k1 == k2:
        out["sameProductMatch"] = True
        out["mismatchReason"] = "none"
    else:
        out["mismatchReason"] = "anchor_tail_mismatch"
    return out


def hanatour_pkg_cd_from_row_html(html: str | None) -> str | None:
    if not html:
        return None
    m = re.search(r"pkgCd=([A-Za-z0-9]+)", html, re.I)
    return m.group(1) if m else None


def hanatour_raw_title_core_match_key(s: Any) -> str:
    if s is None:
        return ""
    t = hanatour_raw_title_exact_match_key(s)
    if not t:
        return ""
    pre = hanatour_pre_hash_title(t)
    if not (pre or "").strip():
        pre = t
    u = (pre or "").replace("\u00a0", " ").strip()
    u = _BADGE_PREFIX.sub("", u).strip()
    u = _HANATOUR_VOLATILE_EDGE.sub(" ", u)
    u = " ".join(u.split())
    u = re.sub(r"\d{1,2}/\d{1,2}\s*\([^)]*\)", " ", u)
    u = re.sub(r"\d{4}-\d{2}-\d{2}", " ", u)
    u = re.sub(r"\b\d{1,2}:\d{2}\b", " ", u)
    u = re.sub(r"잔여\s*\d{1,4}\s*석", " ", u)
    u = _HANATOUR_PRICE_WON.sub(" ", u)
    u = _HANATOUR_STATUS_TAIL.sub(" ", u)
    u = u.replace("/", " ")
    u = re.sub(rf"\s+{_HANATOUR_AIR_TOKEN}\s+", " ", u)
    u = re.sub(r"\b[가-힣]{2,10}항공\b", " ", u)
    u = re.sub(r"\b에어[가-힣]{2,10}\b", " ", u)
    u = re.sub(r"[,，|]+\s*", " ", u)
    u = " ".join(u.split())
    return u.strip()


def hanatour_same_product_core_fuzzy_match(a: str, b: str) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    if difflib.SequenceMatcher(None, a, b).ratio() >= 0.62:
        return True
    ta = set(re.findall(r"[가-힣]{2,}", a)) | set(re.findall(r"\d+\s*[박일]", a))
    tb = set(re.findall(r"[가-힣]{2,}", b)) | set(re.findall(r"\d+\s*[박일]", b))
    if not ta or not tb:
        return False
    inter = ta & tb
    union = ta | tb
    if not union:
        return False
    j = len(inter) / len(union)
    if len(inter) >= 5:
        return True
    if len(inter) >= 3 and j >= 0.38:
        return True
    return False


_KNOWN_AIRLINE_NAMES = (
    "대한항공",
    "아시아나항공",
    "진에어",
    "제주항공",
    "티웨이항공",
    "에어부산",
    "이스타항공",
)


def _extract_airline_hint_from_raw_title(t: str) -> str:
    if not t:
        return ""
    for k in _KNOWN_AIRLINE_NAMES:
        if k in t:
            return k
    m = re.search(r"\b([가-힣]{2,10}항공|[가-힣]{1,12}에어)\b", t)
    return m.group(1).strip() if m else ""


def _extract_time_pair_from_raw_title(t: str) -> tuple[str, str]:
    if not t:
        return "", ""
    times = re.findall(r"\b\d{1,2}:\d{2}\b", t)
    if len(times) >= 2:
        return times[0], times[1]
    if len(times) == 1:
        return times[0], ""
    return "", ""


_STATUS_CANON_ORDER = (
    "예약가능",
    "예약마감",
    "대기예약",
    "출발확정",
    "잔여",
    "항공확정",
    "일정확정",
    "마감",
    "대기",
)


def hanatour_normalize_status_raw(s: str | None) -> str:
    """statusRaw 파이프 구분을 정규화된 단일 문자열로 정렬·중복 제거."""
    if not s or not str(s).strip():
        return ""
    t = str(s).replace("\u00a0", " ").strip()
    parts = [p.strip() for p in re.split(r"[|]", t) if p.strip()]
    if not parts:
        return ""
    idx = {k: i for i, k in enumerate(_STATUS_CANON_ORDER)}
    out: list[str] = []
    seen: set[str] = set()
    for p in sorted(parts, key=lambda x: (idx.get(x, 999), x)):
        if p not in seen:
            seen.add(p)
            out.append(p)
    return "|".join(out)


def hanatour_same_product_match_trace(
    baseline_raw: str,
    row: dict[str, Any],
) -> dict[str, Any]:
    """동일 상품: anchor(`도시/대륙+N일`) 이후 꼬리 완전 일치 + row 항공여정 vs baseline(제목 힌트) 로그."""
    raw_c = (
        row.get("candidateRawTitle")
        or row.get("candidate_raw_title")
        or row.get("candidatePreHashTitle")
        or row.get("raw")
        or ""
    )
    dec = hanatour_same_product_anchor_decision(str(baseline_raw or ""), str(raw_c))
    same = bool(dec.get("sameProductMatch"))
    bas_air = _extract_airline_hint_from_raw_title(str(baseline_raw or ""))
    bas_ob, bas_ib = _extract_time_pair_from_raw_title(str(baseline_raw or ""))
    row_air = str(row.get("candidateAirlineName") or "").strip()
    row_ob = str(row.get("candidateOutboundDepartureAt") or "").strip()
    row_ib = str(row.get("candidateInboundArrivalAt") or "").strip()
    airline_changed = bas_air != row_air
    time_changed = (bas_ob != row_ob) or (bas_ib != row_ib)
    flight_itinerary_updated = same
    match_result = "anchor_exact" if same else "none"
    return {
        "registered_raw_title": (baseline_raw or "")[:1200],
        "registered_anchor_text": str(dec.get("registeredAnchorText") or "")[:1200],
        "row_raw_title": str(raw_c or "")[:1200],
        "row_anchor_text": str(dec.get("rowAnchorText") or "")[:1200],
        "same_product_match": same,
        "sameProductMatch": same,
        "mismatch_reason": str(dec.get("mismatchReason") or "none"),
        "mismatchReason": str(dec.get("mismatchReason") or "none"),
        "baseline_airlineName": bas_air,
        "row_airlineName": row_air,
        "baseline_outboundAt": bas_ob,
        "row_outboundAt": row_ob,
        "baseline_inboundAt": bas_ib,
        "row_inboundAt": row_ib,
        "flight_itinerary_updated": flight_itinerary_updated,
        "flightItineraryUpdated": flight_itinerary_updated,
        "airline_changed_from_baseline": airline_changed,
        "time_changed_from_baseline": time_changed,
        "registeredPrepared": str(dec.get("registeredPrepared") or "")[:1200],
        "rowPrepared": str(dec.get("rowPrepared") or "")[:1200],
        "registered_compare_title": str(dec.get("registeredPrepared") or "")[:1200],
        "row_compare_title": str(dec.get("rowPrepared") or "")[:1200],
        "matchResult": match_result,
        "baselineRawTitle": (baseline_raw or "")[:800],
        "rowRawTitle": str(raw_c or "")[:800],
        "fuzzySequenceScore": 0.0,
        "tokenJaccard": 0.0,
        "tokenIntersectionCount": 0,
    }


def hanatour_field_confidence_from_candidate_row(parsed: dict[str, Any]) -> dict[str, Any]:
    """price / airline / time / status — 필드별 신뢰도·경고."""
    price = parsed.get("candidatePrice")
    price_raw = parsed.get("candidatePriceRawText")
    air = str(parsed.get("candidateAirlineName") or "").strip()
    st = str(parsed.get("statusRaw") or "").strip()
    ob = str(parsed.get("candidateOutboundDepartureAt") or "").strip()
    ib = str(parsed.get("candidateInboundArrivalAt") or "").strip()
    row_text = str(parsed.get("rowText") or parsed.get("candidateRawTitle") or "")

    out: dict[str, Any] = {
        "price": {"level": "low", "warning": None},
        "airline": {"level": "low", "warning": None},
        "time": {"level": "low", "warning": None},
        "status": {"level": "low", "warning": None},
    }

    if isinstance(price, int) and price > 0:
        out["price"]["level"] = "high" if price_raw else "medium"
        if not price_raw:
            out["price"]["warning"] = "price_no_raw_text"
    else:
        out["price"]["warning"] = "price_missing_or_zero"

    if air:
        known_in_row = any(k in row_text for k in _KNOWN_AIRLINE_NAMES)
        if known_in_row:
            out["airline"]["level"] = "high"
        else:
            out["airline"]["level"] = "medium"
            out["airline"]["warning"] = "airline_from_regex_or_unlisted"
    else:
        out["airline"]["warning"] = "airline_missing"

    if ob and ib:
        out["time"]["level"] = "high"
    elif ob or ib:
        out["time"]["level"] = "medium"
        out["time"]["warning"] = "one_leg_time_missing"
    else:
        out["time"]["warning"] = "times_missing"

    if st:
        if re.search(r"예약\s*가능|예약가능", st) and "잔여" in st:
            out["status"]["level"] = "high"
        elif re.search(
            r"예약|마감|대기|확정|잔여",
            st,
        ):
            out["status"]["level"] = "medium"
        else:
            out["status"]["level"] = "low"
            out["status"]["warning"] = "status_weak_signal"
    else:
        out["status"]["warning"] = "status_missing"

    return out


def hanatour_e2e_verification_tier(
    *,
    selected_iso_ok: bool,
    right_list_changed: bool,
    list_refresh_unverified: bool,
    row_complete: bool,
    match_result: str,
    fuzzy_sequence_score: float,
) -> str:
    if not selected_iso_ok or not right_list_changed:
        return "partial_success"
    if list_refresh_unverified:
        return "partial_success"
    if not row_complete:
        return "partial_success"
    if match_result in ("exact", "anchor_exact"):
        return "verified_success"
    if match_result == "fuzzy" and fuzzy_sequence_score >= 0.72:
        return "verified_success"
    if match_result == "fuzzy":
        return "partial_success"
    return "partial_success"


def hanatour_partial_success_primary_reason(
    *,
    selected_iso_ok: bool,
    right_list_changed: bool,
    list_refresh_unverified: bool,
    row_complete: bool,
    match_result: str,
    fuzzy_sequence_score: float,
) -> str:
    """partial_success일 때 단일 원인 코드(검증셋 집계용)."""
    if not selected_iso_ok:
        return "selected_iso_mismatch"
    if not right_list_changed:
        return "list_not_refreshed"
    if list_refresh_unverified:
        return "list_refresh_unverified"
    if not row_complete:
        return "row_incomplete"
    if match_result == "fuzzy" and fuzzy_sequence_score < 0.72:
        return "fuzzy_low_score"
    if match_result == "fuzzy":
        return "fuzzy_borderline"
    if match_result == "none":
        return "same_product_anchor_mismatch"
    return "other"


def filter_hanatour_same_product_rows(
    candidate_rows: list[dict[str, Any]],
    current_raw_title: str,
    *,
    supplier_pkg_cd: str | None = None,
) -> list[dict[str, Any]]:
    if not candidate_rows:
        return []
    pkg = (supplier_pkg_cd or "").strip()
    if pkg:
        by_pkg: list[dict[str, Any]] = []
        for r in candidate_rows:
            row_pkg = (
                (r.get("rowPkgCd") or r.get("pkg_cd") or r.get("pkgCd") or "").strip()
            )
            if not row_pkg:
                row_pkg = (hanatour_pkg_cd_from_row_html(r.get("rowHtml")) or "").strip()
            if row_pkg and row_pkg.upper() == pkg.upper():
                by_pkg.append({**r, "_match": "hanatour_pkg_cd", "rowPkgCd": row_pkg})
        if by_pkg:
            return by_pkg
    cur = hanatour_strip_leading_non_title_badge((current_raw_title or "").strip())
    if not cur:
        return []
    out: list[dict[str, Any]] = []
    for r in candidate_rows:
        raw_c = (
            r.get("candidateRawTitle")
            or r.get("candidate_raw_title")
            or r.get("rowText")
            or r.get("raw")
            or ""
        )
        dec = hanatour_same_product_anchor_decision(cur, str(raw_c))
        if dec.get("sameProductMatch"):
            out.append({**r, "_match": "hanatour_anchor_exact", "_anchor_match": dec})
    return out
