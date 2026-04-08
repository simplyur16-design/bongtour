"""
하나투어 동일상품 키·제목 레이어 검증 (정본: scripts/calendar_e2e_scraper_hanatour/utils.py).

  PYTHONPATH=<repo-root> python scripts/verify-hanatour-variant-label-key.py
"""

from __future__ import annotations

import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from scripts.calendar_e2e_scraper_hanatour.utils import (  # noqa: E402
    filter_hanatour_same_product_rows,
    hanatour_raw_title_exact_match_key,
    hanatour_title_layers,
)


def main() -> None:
    layers = hanatour_title_layers("도쿄3일#x")
    assert layers.get("normalizedBaseTitle"), "normalizedBaseTitle nonempty"
    assert hanatour_raw_title_exact_match_key(" x \u00a0") == "x"

    r_ok = {"candidateRawTitle": "도쿄3일#벚꽃놀이#자유일정"}
    r_bad = {"candidateRawTitle": "도쿄3일#봄여행#자유일정"}
    rows = filter_hanatour_same_product_rows(
        [r_ok, r_bad],
        "도쿄3일#벚꽃놀이#자유일정",
    )
    assert len(rows) == 1
    assert rows[0].get("candidateRawTitle") == r_ok.get("candidateRawTitle")

    print("verify-hanatour-variant-label-key: ok")


if __name__ == "__main__":
    main()
