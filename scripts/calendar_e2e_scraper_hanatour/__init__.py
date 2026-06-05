# -*- coding: utf-8 -*-
"""하나투어 TRP 달력·출발 E2E (`scripts/calendar_e2e_scraper_hanatour/` SSOT)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .calendar_price_scraper import (
        collect_hanatour_departure_inputs,
        format_e2e_report,
        normalize_hanatour_detail_url_to_trp,
        run_calendar_price_from_url,
        run_e2e_with_report,
    )
    from .scraper import HanatourCalendarE2EScraper

__all__ = [
    "HanatourCalendarE2EScraper",
    "collect_hanatour_departure_inputs",
    "format_e2e_report",
    "normalize_hanatour_detail_url_to_trp",
    "run_calendar_price_from_url",
    "run_e2e_with_report",
]

_EXPORTS: dict[str, tuple[str, str]] = {
    "HanatourCalendarE2EScraper": (".scraper", "HanatourCalendarE2EScraper"),
    "collect_hanatour_departure_inputs": (
        ".calendar_price_scraper",
        "collect_hanatour_departure_inputs",
    ),
    "format_e2e_report": (".calendar_price_scraper", "format_e2e_report"),
    "normalize_hanatour_detail_url_to_trp": (
        ".calendar_price_scraper",
        "normalize_hanatour_detail_url_to_trp",
    ),
    "run_calendar_price_from_url": (
        ".calendar_price_scraper",
        "run_calendar_price_from_url",
    ),
    "run_e2e_with_report": (".calendar_price_scraper", "run_e2e_with_report"),
}


def __getattr__(name: str):
    if name in _EXPORTS:
        module_name, attr = _EXPORTS[name]
        import importlib

        return getattr(importlib.import_module(module_name, __name__), attr)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
