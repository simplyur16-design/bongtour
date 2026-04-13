# -*- coding: utf-8 -*-
"""
인간 모사·UA·가격·동일상품 키·브라우저 기동 — 실전 복제본; 정본은 calendar_e2e_scraper_hanatourDEV/utilsDEV.py.
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

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

_scripts_dir = Path(__file__).resolve().parents[1]
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))
from calendar_e2e_common.kst_collect_start import kst_collect_start_ymd

from . import config as _e2e_config

# --- KST (TS SCRAPE_DEFAULT_MONTHS_FORWARD 와 맞춤) ---
KST = timezone(timedelta(hours=9))
DEFAULT_MAX_MONTHS = 6


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


# --- 딜레이·가격 ---
MIN_DELAY = 1.5
MAX_DELAY = 3.5


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
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
) -> tuple[object, Browser, BrowserContext, Page]:
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


async def close_hanatour_browser(pw: object | None, browser: Browser | None) -> None:
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
    m = re.search(r"<h1[^>]*>([\s\S]*?)</h1>", html, re.I)
    if m:
        t = re.sub(r"<[^>]+>", " ", m.group(1))
        return unescape(re.sub(r"\s+", " ", t).strip())
    m2 = re.search(r"<title>([^<]+)</title>", html, re.I)
    return (m2.group(1).strip() if m2 else "") or ""


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


def hanatour_pre_hash_title(raw_title: str) -> str:
    """TS `buildDepartureTitleLayers`와 동일 축: 맨 앞 연속 `[...]`만 제거, 본문·`#`·괄호 유지, 공백만 정리."""
    if not raw_title:
        return ""
    s = raw_title.replace("\u00a0", " ").strip()
    s = _BADGE_PREFIX.sub("", s).strip()
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


def hanatour_prepare_for_anchor_compare(s: str) -> str:
    """동일상품 anchor 비교용 문자열: `[...]`·장식·volatile 제거 후 공백 정규화."""
    if not s:
        return ""
    t = str(s).replace("\u00a0", " ").replace("\u3000", " ")
    t = " ".join(t.split())
    hi = t.find("#")
    if hi >= 0:
        t = t[:hi].strip()
    t = _strip_all_square_brackets(t)
    t = _DECORATIVE_CHARS.sub("", t)
    t = hanatour_raw_title_exact_match_key(t)
    t = _strip_volatile_for_anchor_compare(t)
    t = _hanatour_glue_hangul_before_nday(t)
    t = " ".join(t.split())
    return t.strip()


def hanatour_same_product_anchor_decision(
    registered_raw: str,
    row_raw: str,
) -> dict[str, Any]:
    """
    `도시/대륙 + N일` anchor부터 끝까지 문자열이 **완전히 동일**할 때만 sameProductMatch.
    추론·fuzzy 없음.
    """
    pr = hanatour_prepare_for_anchor_compare(registered_raw)
    rw = hanatour_prepare_for_anchor_compare(row_raw)
    out: dict[str, Any] = {
        "sameProductMatch": False,
        "mismatchReason": "empty_after_prepare",
        "registeredAnchorText": "",
        "rowAnchorText": "",
        "registeredPrepared": pr,
        "rowPrepared": rw,
    }
    if not pr or not rw:
        out["mismatchReason"] = "empty_after_prepare"
        return out
    m1 = _NDAY_IN_PRE.search(pr)
    m2 = _NDAY_IN_PRE.search(rw)
    if not m1:
        out["mismatchReason"] = "no_anchor_registered"
        out["rowAnchorText"] = rw[m2.start() :].strip() if m2 else ""
        return out
    if not m2:
        out["mismatchReason"] = "no_anchor_row"
        out["registeredAnchorText"] = pr[m1.start() :].strip()
        return out
    tail1 = pr[m1.start() :].strip()
    tail2 = rw[m2.start() :].strip()
    out["registeredAnchorText"] = tail1
    out["rowAnchorText"] = tail2
    if tail1 == tail2:
        out["sameProductMatch"] = True
        out["mismatchReason"] = "none"
    else:
        out["mismatchReason"] = "anchor_tail_mismatch"
    return out


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
) -> list[dict[str, Any]]:
    if not candidate_rows:
        return []
    cur = (current_raw_title or "").strip()
    if not cur:
        return []
    out: list[dict[str, Any]] = []
    for r in candidate_rows:
        raw_c = (
            r.get("candidateRawTitle")
            or r.get("candidate_raw_title")
            or r.get("candidatePreHashTitle")
            or r.get("raw")
            or ""
        )
        dec = hanatour_same_product_anchor_decision(cur, str(raw_c))
        if dec.get("sameProductMatch"):
            out.append({**r, "_match": "hanatour_anchor_exact", "_anchor_match": dec})
    return out
