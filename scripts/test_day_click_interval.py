# -*- coding: utf-8 -*-
"""
날짜별 달력 클릭 간격 SSOT 검증 — 공급사별 1.0초(1000ms).

실행:
  PYTHONPATH=. python scripts/test_day_click_interval.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_MS = 1000
TOL_MS = 50


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _config_day_click_ms(config_src: str) -> int | None:
    m = re.search(
        r"DAY_CLICK_INTERVAL_MS\s*=\s*_int_env\([^,]+,\s*(\d+)\)",
        config_src,
    )
    if not m:
        return None
    return int(m.group(1))


def main() -> int:
    errors: list[str] = []

    hanatour_cfg = _read(ROOT / "scripts/calendar_e2e_scraper_hanatour/config.py")
    hanatour_scr = _read(ROOT / "scripts/calendar_e2e_scraper_hanatour/scraper.py")
    modetour_cfg = _read(ROOT / "scripts/calendar_e2e_scraper_modetour/config.py")
    modetour_scr = _read(ROOT / "scripts/calendar_e2e_scraper_modetour/calendar_price_scraper.py")
    ybtour_cfg = _read(ROOT / "scripts/calendar_e2e_scraper_ybtour/config.py")
    ybtour_scr = _read(ROOT / "scripts/calendar_e2e_scraper_ybtour/calendar_price_scraper.py")

    for label, cfg_src, scr_src in (
        ("hanatour", hanatour_cfg, hanatour_scr),
        ("modetour", modetour_cfg, modetour_scr),
        ("ybtour", ybtour_cfg, ybtour_scr),
    ):
        ms = _config_day_click_ms(cfg_src)
        if ms is None:
            errors.append(f"{label}: config DAY_CLICK_INTERVAL_MS missing")
        elif abs(ms - EXPECTED_MS) > TOL_MS:
            errors.append(f"{label}: config DAY_CLICK_INTERVAL_MS={ms} (expected {EXPECTED_MS})")
        if "DAY_CLICK_INTERVAL_MS" not in scr_src:
            errors.append(f"{label}: scraper does not reference DAY_CLICK_INTERVAL_MS")

    # 구 fast/light 0.28-0.55s 경로가 남아 있으면 실패
    if re.search(r"await human_delay\(0\.28,\s*0\.55\)", hanatour_scr):
        errors.append("hanatour: legacy fast post-click 0.28-0.55s still present")
    if re.search(r"await human_delay\(0\.35,\s*0\.65\)", modetour_scr):
        errors.append("modetour: legacy post-click 0.35-0.65s still present")

    if errors:
        print("[FAIL] day-click interval check")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"[ok] day-click interval: hanatour/modetour/ybtour use {EXPECTED_MS}ms between date clicks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
