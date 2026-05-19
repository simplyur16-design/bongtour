# -*- coding: utf-8 -*-
"""
JKP140 등 지정 출발일 — 달력 가격일 존재·동일상품 매칭·수집 검증.

  python -m scripts.calendar_e2e_scraper_hanatour.verify_target_dates
  python -m scripts.calendar_e2e_scraper_hanatour.verify_target_dates <detail_url>
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any

from . import config
from .scraper import (
    _ENUM_DAYS_WITH_SCROLL_JS,
    _LIST_SNAPSHOT_JS,
    _MONTH_LABEL_JS,
    _click_day,
    _collect_rows_match_same_product,
    _ensure_departure_list_visible,
    _next_month,
    _open_modal,
    _prev_month,
    _wait_list_change,
)
from .utils import (
    extract_hanatour_detail_raw_title,
    filter_hanatour_same_product_rows,
    hanatour_extract_anchor_tail,
    launch_hanatour_browser,
    parse_hanatour_product_identifiers,
)

DEFAULT_URL = (
    "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200"
    "?pkgCd=JKP140260628RSH&prePage=CHPC0PKG0119P200&isChanged=Y&type=H01"
)

TARGET_BY_MONTH: dict[str, list[str]] = {
    "2026-05": ["2026-05-28", "2026-05-29", "2026-05-30"],
    "2026-06": [
        "2026-06-01",
        "2026-06-02",
        "2026-06-04",
        "2026-06-05",
        "2026-06-06",
    ],
}

# 재수집 시 DB originalTitle — env HANATOUR_REGISTERED_RAW_TITLE 로 덮어쓰기
DEFAULT_REGISTERED = (
    "규슈 4일 #온천의 진수 #완벽한 동선 #천연 온천 루프탑 아마네크 유라리 2박 "
    "#후쿠오카 시내 숙박 #일본품격여행 #일본 폭포 100선 #일본 100대 야경 슈몬지바루"
)


async def _align_month(page, y: int, m: int) -> bool:
    for _ in range(24):
        ym = await page.evaluate(_MONTH_LABEL_JS)
        wy = int((ym or {}).get("y") or 0)
        wm = int((ym or {}).get("month") or 0)
        if wy == y and wm == m:
            return True
        if (wy < y) or (wy == y and wm < m):
            ok = await _next_month(page)
        else:
            ok = await _prev_month(page)
        if not ok:
            return False
        await asyncio.sleep(0.35)
    return False


async def verify(url: str, registered: str) -> dict[str, Any]:
    os.environ.setdefault("HANATOUR_REGISTERED_RAW_TITLE", registered)
    ident = parse_hanatour_product_identifiers(url)
    pkg_cd = str(ident.get("pkg_cd") or "").strip() or None

    pw, browser, _, page = await launch_hanatour_browser(headless=True)
    report: dict[str, Any] = {
        "url": url,
        "pkgCd": pkg_cd,
        "registeredRawTitle": registered,
        "registeredAnchorTail": hanatour_extract_anchor_tail(registered),
        "months": {},
    }
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=config.PAGE_LOAD_TIMEOUT_MS)
        await asyncio.sleep(2.5)
        detail_title = extract_hanatour_detail_raw_title(await page.content())
        if not await _open_modal(page):
            report["error"] = "modal_open_failed"
            return report
        await _ensure_departure_list_visible(page)
        await asyncio.sleep(0.5)

        for ym, targets in TARGET_BY_MONTH.items():
            y, m = int(ym[:4]), int(ym[5:7])
            month_out: dict[str, Any] = {
                "targetDates": targets,
                "enumeratedPricedIsos": [],
                "days": {},
            }
            if not await _align_month(page, y, m):
                month_out["calendarAlignFailed"] = True
                report["months"][ym] = month_out
                continue

            enum_raw = await page.evaluate(_ENUM_DAYS_WITH_SCROLL_JS, [y, m])
            enum_isos = sorted(
                {str((x or {}).get("iso") or "") for x in (enum_raw or []) if (x or {}).get("iso")}
            )
            month_out["enumeratedPricedIsos"] = enum_isos
            month_out["enumeratedCount"] = len(enum_isos)

            raw_title = registered or detail_title
            for iso in targets:
                day: dict[str, Any] = {
                    "inCalendarEnum": iso in enum_isos,
                    "clickOk": False,
                    "listRefreshOk": False,
                    "matched": False,
                    "matchKind": None,
                    "collectedPrice": None,
                    "rowTitleSample": None,
                    "anchorTailSample": None,
                }
                if iso not in enum_isos:
                    day["skipReason"] = "not_in_priced_calendar_enum"
                    month_out["days"][iso] = day
                    continue

                click_r = await _click_day(page, iso, month_wy=y, month_wm=m)
                day["clickOk"] = bool((click_r or {}).get("ok"))
                day["clickReason"] = (click_r or {}).get("reason")
                await asyncio.sleep(0.45)
                await _ensure_departure_list_visible(page)
                before = await page.evaluate(_LIST_SNAPSHOT_JS) or {}
                lr_ok, _, lr_reason = await _wait_list_change(
                    page,
                    str((before or {}).get("hash") or ""),
                    int(os.environ.get("HANATOUR_E2E_LIST_REFRESH_MS", "8000") or "8000"),
                    iso_label=iso,
                )
                day["listRefreshOk"] = lr_ok
                day["listRefreshReason"] = lr_reason

                same, best, attempts, cands = await _collect_rows_match_same_product(
                    page,
                    raw_title,
                    iso,
                    [],
                    supplier_pkg_cd=pkg_cd,
                )
                day["matchAttempts"] = attempts
                day["candidateCount"] = len(cands)
                if same and best:
                    day["matched"] = True
                    day["matchKind"] = same[0].get("_match")
                    day["collectedPrice"] = best.get("candidatePrice")
                    t = (best.get("candidateRawTitle") or "")[:200]
                    day["rowTitleSample"] = t
                    day["anchorTailSample"] = hanatour_extract_anchor_tail(t)
                elif cands:
                    probe = filter_hanatour_same_product_rows(
                        cands[:12], raw_title, supplier_pkg_cd=pkg_cd
                    )
                    if not probe and cands:
                        day["rowTitleSample"] = (cands[0].get("candidateRawTitle") or "")[:200]
                        day["anchorTailSample"] = hanatour_extract_anchor_tail(
                            cands[0].get("candidateRawTitle") or ""
                        )
                    day["skipReason"] = "no_same_product_row"
                else:
                    day["skipReason"] = "empty_list"
                month_out["days"][iso] = day

            report["months"][ym] = month_out
    finally:
        await browser.close()
        await pw.stop()

    return report


def _print_summary(rep: dict[str, Any]) -> None:
    print("\n=== 하나투어 지정일 검증 ===")
    print(f"pkgCd: {rep.get('pkgCd')}")
    print(f"등록 anchor tail: {rep.get('registeredAnchorTail')}")
    for ym, mo in (rep.get("months") or {}).items():
        print(f"\n--- {ym} (달력 가격일 {mo.get('enumeratedCount')}개) ---")
        enum = mo.get("enumeratedPricedIsos") or []
        if enum:
            print(f"  열거된 날짜: {', '.join(enum[:40])}{'...' if len(enum) > 40 else ''}")
        for iso, d in (mo.get("days") or {}).items():
            flags = []
            flags.append("달력O" if d.get("inCalendarEnum") else "달력X")
            flags.append("클릭O" if d.get("clickOk") else "클릭X")
            flags.append("매칭O" if d.get("matched") else "매칭X")
            extra = d.get("skipReason") or d.get("matchKind") or ""
            price = d.get("collectedPrice")
            pstr = f" price={price}" if price else ""
            print(f"  {iso}: {' | '.join(flags)}{pstr} {extra}")
            if d.get("rowTitleSample"):
                print(f"    row: {d['rowTitleSample'][:120]}")
            if d.get("anchorTailSample"):
                print(f"    anchor: {d['anchorTailSample'][:100]}")


def main() -> int:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    url = (
        sys.argv[1].strip()
        if len(sys.argv) > 1 and sys.argv[1].startswith("http")
        else DEFAULT_URL
    )
    reg = (os.environ.get("HANATOUR_REGISTERED_RAW_TITLE") or DEFAULT_REGISTERED).strip()
    rep = asyncio.run(verify(url, reg))
    print(json.dumps(rep, ensure_ascii=False, indent=2))
    _print_summary(rep)
    all_days = [
        d
        for mo in (rep.get("months") or {}).values()
        for d in (mo.get("days") or {}).values()
    ]
    ok = sum(1 for d in all_days if d.get("matched"))
    total = len(all_days)
    print(f"\n수집 매칭 성공: {ok}/{total}")
    return 0 if ok == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
