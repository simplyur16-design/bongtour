# -*- coding: utf-8 -*-
"""modetour E2E 모달·상세 ready 계약 — prebuild static guard."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRAPER = ROOT / "scripts" / "calendar_e2e_scraper_modetour" / "calendar_price_scraper.py"


class ModetourE2eModalContractTest(unittest.TestCase):
    def test_scraper_has_modal_ready_contract(self) -> None:
        text = SCRAPER.read_text(encoding="utf-8")
        for needle in (
            "REGRESSION-FREEZE[modetour-sweep-e2e-recheck]",
            "다른 출발일 보기",
            "_wait_for_modetour_detail_ready",
            "_open_modetour_departure_modal",
            "_modetour_modal_is_open",
            "modetour-prices-ready",
            "cellRawText",
        ):
            self.assertIn(needle, text, msg=f"missing {needle!r} in modetour calendar scraper")


if __name__ == "__main__":
    unittest.main()
