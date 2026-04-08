# -*- coding: utf-8 -*-
"""탐색 범위만 검증: 월별 ENUM 슬롯 전부 클릭 시도 → 다음 달 이동 (수집·list_wait 생략)."""
from __future__ import annotations

import asyncio
import json
import os
import sys

from . import configDEV as config
from . import scraperDEV as _han_scraper
from .scraperDEV import (
    _CALENDAR_SELECTED_ISO_JS,
    _ENUM_DAYS_JS,
    _LIST_SNAPSHOT_JS,
    _MONTH_LABEL_JS,
    _click_day,
    _next_month,
    _open_modal,
    _post_page_load_delay,
)
from .utilsDEV import close_hanatour_browser, kst_collect_start_ymd, launch_hanatour_browser


def _uniq_enum_days(days: list) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for slot in days or []:
        iiso = str((slot or {}).get("iso") or "")
        if len(iiso) < 10 or iiso in seen:
            continue
        seen.add(iiso)
        out.append(slot)
    return out


async def _run(url: str, *, max_months: int = 2, june_clicks: int = 3) -> dict:
    kst_collect_start = kst_collect_start_ymd()
    pw, browser, _, page = await launch_hanatour_browser(headless=True)
    report: dict = {
        "url": url,
        "kst_collect_start": kst_collect_start,
        "months": [],
        "may": {},
        "june": {},
        "failure": None,
    }
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=config.PAGE_LOAD_TIMEOUT_MS)
        try:
            await page.wait_for_load_state("networkidle", timeout=config.NETWORK_IDLE_TIMEOUT_MS)
        except Exception:
            pass
        await _post_page_load_delay()
        if not await _open_modal(page):
            report["failure"] = {
                "failed_step": "open_modal",
                "current_month": None,
                "last_clicked_iso": None,
                "fail_reason": "modal not opened",
            }
            return report

        for mi in range(max(1, max_months)):
            ym = await page.evaluate(_MONTH_LABEL_JS)
            wy = int((ym or {}).get("y") or 0)
            wm = int((ym or {}).get("month") or 0)
            if not wy or not wm:
                report["failure"] = {
                    "failed_step": "read_month_label",
                    "current_month": None,
                    "last_clicked_iso": report.get("last_iso"),
                    "fail_reason": "month_label_unreadable",
                }
                break

            raw_days = await page.evaluate(_ENUM_DAYS_JS, [wy, wm])
            days = _uniq_enum_days(raw_days if isinstance(raw_days, list) else [])
            month_entry = {
                "month_index": mi,
                "y": wy,
                "m": wm,
                "enum_slot_count": len(days),
                "clicks": [],
            }
            expected_isos = [str((s or {}).get("iso") or "") for s in days]
            expected_isos = [x for x in expected_isos if len(x) >= 10]
            attempted: list[str] = []

            june_limit = june_clicks if wm == 6 else 0

            for slot in days:
                iso = str((slot or {}).get("iso") or "")
                if len(iso) < 10 or iso < kst_collect_start:
                    continue
                sel_b = await page.evaluate(_CALENDAR_SELECTED_ISO_JS)
                before_iso = str((sel_b or {}).get("iso") or "").strip()
                snap0 = await page.evaluate(_LIST_SNAPSHOT_JS) or {}
                bh = str(snap0.get("hash") or "")
                cc = await _click_day(page, iso, month_wy=wy, month_wm=wm)
                await asyncio.sleep(0.35)
                sel_a = await page.evaluate(_CALENDAR_SELECTED_ISO_JS)
                after_iso = str((sel_a or {}).get("iso") or "").strip()
                snap1 = await page.evaluate(_LIST_SNAPSHOT_JS) or {}
                ah = str(snap1.get("hash") or "")
                rlc = (ah != bh) or (after_iso != before_iso)
                attempted.append(iso)
                month_entry["clicks"].append(
                    {
                        "clicked_iso": iso,
                        "selectedIsoAfter": after_iso,
                        "rightListChanged": rlc,
                        "sameProductMatched": None,
                        "click_ok": bool((cc or {}).get("ok")),
                        "click_reason": (cc or {}).get("reason"),
                    }
                )
                report["last_iso"] = iso
                if june_limit and len(
                    [x for x in month_entry["clicks"] if x.get("clicked_iso")]
                ) >= june_limit:
                    break

            month_entry["attempted_isos"] = attempted
            month_entry["expected_enum_isos"] = expected_isos
            exp_set = set(expected_isos)
            att_set = set(attempted)
            if wm == 5:
                missing_m = sorted(exp_set - att_set)
            else:
                missing_m = []
            month_entry["missing_isos"] = missing_m
            report["months"].append(month_entry)

            if wm == 5:
                report["may"] = {
                    "enum_slot_count": month_entry["enum_slot_count"],
                    "attempted_count": len(attempted),
                    "attempted_isos": attempted,
                    "missing_isos": missing_m,
                    "last_may_iso": attempted[-1] if attempted else None,
                }

            if wm == 6:
                cl = month_entry["clicks"][:june_clicks]
                report["juneClickedIsos"] = [str(c.get("clicked_iso") or "") for c in month_entry["clicks"]][
                    : max(0, june_clicks)
                ]
                report["june"] = {
                    "enum_slot_count": month_entry["enum_slot_count"],
                    "sample_clicks": cl,
                    "selected_after_samples": [c.get("selectedIsoAfter") for c in cl],
                    "next_month_via": "calendar header right chevron (scraper._nav_month_by_header_arrow), legacy selectors last",
                }

            if mi >= max_months - 1:
                break
            month_before_str = f"{wy}년 {wm}월"
            nxt = await _next_month(page)
            if wm == 5:
                report["monthBefore"] = month_before_str
                ym2 = await page.evaluate(_MONTH_LABEL_JS)
                wy2 = int((ym2 or {}).get("y") or 0)
                wm2 = int((ym2 or {}).get("month") or 0)
                report["monthAfter"] = f"{wy2}년 {wm2}월" if wy2 and wm2 else None
                report["nextMonthClickPath"] = _han_scraper._LAST_MONTH_NAV_PATH
                exp_y = wy + (1 if wm == 12 else 0)
                exp_m = 1 if wm == 12 else wm + 1
                report["juneEntered"] = bool(wy2 and wm2 and wy2 == exp_y and wm2 == exp_m)
            if not nxt:
                report["failure"] = {
                    "failed_step": "next_month",
                    "current_month": f"{wy}-{wm:02d}",
                    "last_clicked_iso": report.get("last_iso"),
                    "fail_reason": "next_month failed (calendar header arrow + legacy CALENDAR_MONTH_NEXT_SELECTORS)",
                }
                break

    finally:
        await close_hanatour_browser(pw, browser)

    return report


def main() -> int:
    url = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200"
        "?pkgCd=JKP130260501TWK&prePage=major-products"
    )
    os.environ.setdefault("HANATOUR_E2E_PROGRESS", "0")
    rep = asyncio.run(_run(url, max_months=2, june_clicks=3))
    print(json.dumps(rep, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
