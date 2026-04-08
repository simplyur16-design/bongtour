# -*- coding: utf-8 -*-
"""
수동 실행:

  python -m scripts.calendar_e2e_scraper_hanatour.main <detail_url> [max_months]

JSON + 사람이 읽는 E2E 보고:

  python -m scripts.calendar_e2e_scraper_hanatour.main --report
  python -m scripts.calendar_e2e_scraper_hanatour.main --report <detail_url> [max_months]

기본 테스트 URL: ``config.DEFAULT_E2E_TEST_URL`` (--report 만 줄 때)

환경 변수 (디버그·속도):
- ``HANATOUR_E2E_PROGRESS=0`` — stderr 진행 로그 끔 (기본 1)
- ``HANATOUR_E2E_DEBUG=1`` — list_wait 폴링 등 상세
- ``HANATOUR_E2E_FAST=1`` — 초기 human_delay 단축
- ``HANATOUR_E2E_LIST_REFRESH_MS`` (기본 28000) / ``HANATOUR_E2E_NETWORK_IDLE_MS`` 등 — ``config`` 타임아웃 덮어쓰기
- ``HANATOUR_E2E_ALLOW_SAME_DAY_SELECTION_COMMIT`` (기본 1) — 동일 ISO 재클릭 시 list_wait 통과 후 우측 리스트 강제 스크롤(nudge)·수집
- ``HANATOUR_E2E_SAME_DAY_ADDITIONAL_SETTLE_MS`` — 동일 날짜 nudge 후 추가 안정화(ms)
- ``HANATOUR_E2E_LIST_REFRESH_FORCE_MS`` — 강제 스크롤 후 3차 list_wait / 재클릭 후 4차 list_wait 타임아웃 상한(ms, 기본 22000)
- ``HANATOUR_E2E_ALLOW_COLLECT_WITHOUT_LIST_REFRESH`` — ``>0`` 이면 1·2차 실패 직후 미검증 수집(``matchingTraceRaw.listRefreshUnverifiedSource=env_allow``). ``0`` 이면 강제 파이프라인(스크롤·3·4차 대기·재클릭)까지 실패한 뒤에만 env 없이 미검증 수집(``after_aggressive_pipeline``). 검증된 갱신만 성공 시 해당 필드는 JSON ``null``.
- ``HANATOUR_E2E_VIEWPORT_WIDTH`` / ``HANATOUR_E2E_VIEWPORT_HEIGHT`` — 좁은 화면(리스트가 달력 아래) 재현 시 사용
"""
from __future__ import annotations

import asyncio
import importlib
import json
import os
import sys

from . import config
from .utils import DEFAULT_MAX_MONTHS
from .calendar_price_scraper import (
    collect_hanatour_departure_inputs,
    format_e2e_report,
    run_e2e_with_report,
)
from .scraper import _e2e_timing_phase


def _safe_stdout_print(s: str) -> None:
    try:
        print(s)
    except UnicodeEncodeError:
        enc = getattr(sys.stdout, "encoding", None) or "utf-8"
        sys.stdout.buffer.write((s + "\n").encode(enc, errors="replace"))


def _strip_month_flag(argv: list[str]) -> tuple[list[str], str | None]:
    out = list(argv)
    month: str | None = None
    if "--month" in out:
        i = out.index("--month")
        if i + 1 < len(out):
            month = out[i + 1].strip()
            out = out[:i] + out[i + 2 :]
        else:
            out = out[:i] + out[i + 1 :]
    return out, month


async def _amain(
    url: str,
    max_months: int,
    *,
    report: bool,
    target_month_ym: str | None = None,
) -> int:
    if report:
        raw, text = await run_e2e_with_report(
            url if url else None,
            max_months=max_months,
            headless=True,
            stop_after_first=True,
        )
        if not raw.pop("_hanatourStdoutEmitted", False):
            print(json.dumps(raw, ensure_ascii=False, indent=2))
        print()
        _safe_stdout_print(text)
        _e2e_timing_phase("before_process_exit")
        return 0
    sys.stderr.write(
        f"[HANATOUR_E2E] cli_entry\tmax_months={1 if target_month_ym else max_months}\t"
        f"target_month={target_month_ym or 'multi'}\n"
    )
    sys.stderr.flush()
    if target_month_ym:
        os.environ.setdefault("HANATOUR_E2E_ADMIN_MONTH_SESSION", "1")
    out = await collect_hanatour_departure_inputs(
        url,
        max_months=1 if target_month_ym else max_months,
        headless=True,
        target_month_ym=target_month_ym,
    )
    if not out.pop("_hanatourStdoutEmitted", False):
        print(json.dumps(out, ensure_ascii=False, indent=2))
    if os.environ.get("HANATOUR_E2E_PRINT_REPORT", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        print()
        _safe_stdout_print(format_e2e_report(out))
    _e2e_timing_phase("before_process_exit")
    return 0


def _parse_args() -> tuple[bool, str, int, str | None] | None:
    argv = [a for a in sys.argv[1:] if a.strip()]
    want_report = "--report" in argv
    argv = [a for a in argv if a != "--report"]
    argv, target_month_ym = _strip_month_flag(argv)

    if want_report:
        os.environ["HANATOUR_E2E_STOP_AFTER_FIRST_DEPARTURE"] = "1"
        mo = 1
        if not argv:
            return want_report, config.DEFAULT_E2E_TEST_URL, mo, target_month_ym
        if argv[0].strip().lower().startswith("http"):
            url = argv[0].strip()
            if len(argv) > 1:
                try:
                    mo = max(1, int(argv[1]))
                except ValueError:
                    mo = 1
            return want_report, url, mo, target_month_ym
        try:
            mo = max(1, int(argv[0]))
            return want_report, config.DEFAULT_E2E_TEST_URL, mo, target_month_ym
        except ValueError:
            return want_report, argv[0].strip(), mo, target_month_ym

    if not argv:
        return None
    url = argv[0].strip()
    mo = 1 if target_month_ym else DEFAULT_MAX_MONTHS
    if not target_month_ym and len(argv) > 1:
        try:
            mo = max(1, int(argv[1]))
        except ValueError:
            mo = DEFAULT_MAX_MONTHS
    return want_report, url, mo, target_month_ym


def main() -> int:
    if sys.platform == "win32":
        try:
            if hasattr(sys.stdout, "reconfigure"):
                sys.stdout.reconfigure(encoding="utf-8")
            if hasattr(sys.stderr, "reconfigure"):
                sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    parsed = _parse_args()
    if parsed is None:
        sys.stderr.write(
            "usage: python -m scripts.calendar_e2e_scraper_hanatour.main "
            "<detail_url> [max_months] | <detail_url> --month YYYY-MM\n"
            "       python -m scripts.calendar_e2e_scraper_hanatour.main --report "
            "[detail_url] [max_months]\n"
            "       python -m scripts.calendar_e2e_scraper_hanatour.main --report [max_months]  "
            "(숫자만 주면 기본 테스트 URL 사용)\n"
            f"기본 테스트 URL: {config.DEFAULT_E2E_TEST_URL}\n"
        )
        return 2
    want_report, url, mo, target_month_ym = parsed
    if not want_report and not target_month_ym:
        if (os.environ.get("HANATOUR_E2E_MONTH_FIRST_MATCH_ONLY") or "").strip().lower() in (
            "1",
            "true",
            "yes",
        ):
            os.environ.setdefault("HANATOUR_E2E_FIRST_VERIFY_YM", "2026-05")
            os.environ["HANATOUR_E2E_PROGRESS"] = "0"
            mo = 4
            importlib.reload(config)
        elif (os.environ.get("HANATOUR_E2E_SAMPLE_MODE") or "").strip().lower() in (
            "1",
            "true",
            "yes",
        ):
            if not (os.environ.get("HANATOUR_E2E_PROBE_ONLY_DATES") or "").strip():
                os.environ["HANATOUR_E2E_PROBE_ONLY_DATES"] = (
                    "2026-05-01,2026-05-05,2026-05-13,2026-05-15,2026-05-25"
                )
            os.environ["HANATOUR_E2E_PROGRESS"] = "0"
            mo = 1
            importlib.reload(config)
    return asyncio.run(
        _amain(url, mo, report=want_report, target_month_ym=target_month_ym)
    )


if __name__ == "__main__":
    raise SystemExit(main())
