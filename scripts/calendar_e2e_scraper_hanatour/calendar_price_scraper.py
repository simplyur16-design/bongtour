# -*- coding: utf-8 -*-
"""
하나투어 달력 E2E 엔트리 — 실전 복제본; 정본은 calendar_e2e_scraper_hanatourDEV/calendar_price_scraperDEV.py.

반환: ``collect_hanatour_departure_inputs`` →
``{ "departures": [...], "notes": [...], "log": {...}, "collectorStatus": str, "validation": {...} }``

각 departure 예:
``departureDate``, ``adultPrice``, ``statusRaw``, ``airlineName``, ``outboundAt``, ``inboundAt``, …
"""
from __future__ import annotations

import json
import urllib.parse
from typing import Any

from . import config
from .scraper import HanatourCalendarE2EScraper
from .utils import DEFAULT_MAX_MONTHS

HANATOUR_TRP_PKG_DETAIL_PATH = "/trp/pkg/CHPC0PKG0200M200"


def normalize_hanatour_detail_url_to_trp(detail_url: str) -> str:
    s = (detail_url or "").strip()
    if not s:
        return s
    try:
        p = urllib.parse.urlparse(s)
        host = (p.netloc or "").lower()
        if "hanatour.com" not in host:
            return s
        path = (p.path or "").rstrip("/") or "/"
        q = urllib.parse.parse_qs(p.query, keep_blank_values=False)

        def _first_ci(key: str) -> str:
            for k in (key, key.lower(), key.upper()):
                v = q.get(k)
                if v and str(v[0]).strip():
                    return str(v[0]).strip()
            return ""

        pkg = _first_ci("pkgCd")
        if not pkg:
            return s

        if path == "/package/detail" or path.endswith("/package/detail"):
            return urllib.parse.urlunparse(
                (
                    p.scheme or "https",
                    p.netloc,
                    HANATOUR_TRP_PKG_DETAIL_PATH,
                    "",
                    urllib.parse.urlencode([("pkgCd", pkg), ("type", "H01")]),
                    p.fragment or "",
                )
            )

        if "/trp/pkg/" in path:
            u = urllib.parse.urlsplit(s)
            pairs = list(urllib.parse.parse_qsl(u.query, keep_blank_values=True))
            d = dict(pairs)
            d["pkgCd"] = pkg
            t = str(d.get("type") or "").strip()
            pre_page = str(d.get("prePage") or "").strip()
            if not t and not pre_page:
                d["type"] = "H01"
            new_q = urllib.parse.urlencode(list(d.items()))
            return urllib.parse.urlunsplit(
                (u.scheme or "https", u.netloc, u.path, new_q, u.fragment)
            )
    except Exception:
        return s
    return s


async def collect_hanatour_departure_inputs(
    detail_url: str,
    session: Any = None,
    page: Any = None,
    max_months: int = DEFAULT_MAX_MONTHS,
    headless: bool = True,
    target_month_ym: str | None = None,
) -> dict[str, Any]:
    _ = session
    u = normalize_hanatour_detail_url_to_trp((detail_url or "").strip())
    scraper = HanatourCalendarE2EScraper(headless=headless)
    return await scraper.run(
        u,
        max_months=max_months,
        page=page,
        own_browser=page is None,
        target_month_ym=target_month_ym,
    )


async def run_calendar_price_from_url(
    detail_url: str,
    *,
    max_months: int = DEFAULT_MAX_MONTHS,
    headless: bool = True,
) -> dict[str, Any]:
    return await collect_hanatour_departure_inputs(
        detail_url, max_months=max_months, headless=headless
    )


def _failure_stage_and_reason(result: dict[str, Any]) -> tuple[str, str]:
    notes = result.get("notes") or []
    log = result.get("log") or {}
    st = str(result.get("collectorStatus") or "")
    if not log.get("modal_opened"):
        return ("modal_open", "모달이 열리지 않음 (다른 출발일 보기 CTA 미클릭 또는 레이어 미노출)")
    if st == "modal_empty" or not (result.get("departures") or []):
        for n in notes:
            if "list_static:" in n:
                return ("list_refresh", "날짜 클릭 후 우측 리스트 해시가 변하지 않음 (rightListChanged 불가)")
            if "calendar_selection_unchanged:" in n:
                return (
                    "calendar_selection",
                    "달력 선택 상태 시그니처가 클릭 전후 동일 (selectedChanged 불가)",
                )
            if "no_same_product_row:" in n:
                return (
                    "same_product_row",
                    "리스트는 갱신됐으나 동일 상품명 row 없음 (필터/제목 불일치)",
                )
            if "click_fail:" in n:
                return ("calendar_click", f"날짜 클릭 실패: {n}")
        return ("collect", "수집된 출발 행 없음 (modal_empty)")
    return ("", "")


def format_e2e_report(result: dict[str, Any]) -> str:
    """요청 보고 형식 1~6 (텍스트)."""
    log = result.get("log") or {}
    deps = result.get("departures") or []
    first = deps[0] if deps else {}
    trace: dict[str, Any] = {}
    if first.get("matchingTraceRaw"):
        try:
            trace = json.loads(str(first["matchingTraceRaw"]))
        except Exception:
            trace = {}
    modal_ok = bool(log.get("modal_opened"))
    scrolled = bool(log.get("e2e_calendar_scrolled"))
    rlc = trace.get("rightListChanged")
    slc = trace.get("selectedChanged")
    list_ok = rlc is True and slc is True
    row_ok = bool(first)
    stage, reason = _failure_stage_and_reason(result)

    lines = [
        "=== 하나투어 달력 E2E 보고 ===",
        f"1. 모달 열림 여부: {'예' if modal_ok else '아니오'}",
        f"2. 달력 스크롤 여부: {'예 (스크롤 스텝 있음)' if scrolled else '아니오 또는 불필요(한 화면에 일자 노출)'}",
        f"3. 날짜 클릭 후 우측 리스트 갱신 여부: "
        f"{'예 (rightListChanged=True)' if rlc is True else '아니오' if rlc is False else '알 수 없음'}",
        f"   · selectedChanged={slc!r} / rightListChanged={rlc!r}",
        f"4. 같은 상품명 row 탐색: {'예' if row_ok else '아니오'}",
        "5. 가져온 값 (첫 행):",
        f"   · departureDate: {first.get('departureDate')!r}",
        f"   · adultPrice: {first.get('adultPrice')!r}",
        f"   · statusRaw: {first.get('statusRaw')!r}",
        f"   · airlineName: {first.get('airlineName')!r}",
        f"   · outboundAt: {first.get('outboundAt')!r}",
        f"   · inboundAt: {first.get('inboundAt')!r}",
    ]
    if row_ok and list_ok:
        lines.append("6. 실패 시 원인: (해당 없음 — 성공)")
    else:
        lines.append(f"6. 실패 시 원인: [{stage}] {reason}")
    lines.append("")
    lines.append(
        "※ 상품명 비교: utils.filter_hanatour_same_product_rows → "
        "hanatour_same_product_anchor_decision (도시/대륙+N일 anchor 이후 꼬리 완전 일치)"
    )
    lines.append(f"※ 기본 CTA 라벨: {config.OPEN_MODAL_PRIMARY_LABEL!r}")
    val = result.get("validation") if isinstance(result.get("validation"), dict) else {}
    if val:
        lines.append(
            f"※ 검증 요약: runOutcome={val.get('runOutcome')!r} "
            f"countsByTier={val.get('countsByTier')!r}"
        )
    return "\n".join(lines)


async def run_e2e_with_report(
    detail_url: str | None = None,
    *,
    max_months: int = 1,
    headless: bool = True,
    stop_after_first: bool = True,
) -> tuple[dict[str, Any], str]:
    """스모크용: 첫 출발 1건까지 수집 후 JSON + 보고 문자열."""
    import os

    if detail_url is None or not str(detail_url).strip():
        detail_url = config.DEFAULT_E2E_TEST_URL
    if stop_after_first:
        os.environ["HANATOUR_E2E_STOP_AFTER_FIRST_DEPARTURE"] = "1"
    raw = await collect_hanatour_departure_inputs(
        str(detail_url).strip(),
        max_months=max_months,
        headless=headless,
    )
    return raw, format_e2e_report(raw)
