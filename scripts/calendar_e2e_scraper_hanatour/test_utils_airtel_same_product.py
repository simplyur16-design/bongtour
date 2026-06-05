"""하나투어 자유여행 동일상품 anchor 매칭 회귀."""
from __future__ import annotations

import unittest

from scripts.calendar_e2e_scraper_hanatour.utils import (
    filter_hanatour_same_product_rows,
    hanatour_same_product_anchor_decision,
)


BANGKOK_REGISTERED = (
    "방콕 자유여행 5일 #패러독스 방콕 수쿰윗 #BTS아속역&MRT수쿰빗역5분거리 "
    "#터미널21쇼핑몰근처 #위치BEST #공항-＞호텔 편도 픽업포함"
)
BANGKOK_MODAL_ROW = (
    "[유류비포함] 방콕 자유여행 5일 #패러독스 방콕 수쿰윗 #BTS아속역&MRT수쿰빗역5분거리 "
    "#터미널21쇼핑몰근처 #위치BEST #공항->호텔 편도 픽업 포함 타이 에어아시아"
)


class HanatourAirtelSameProductTest(unittest.TestCase):
    def test_bangkok_free_travel_anchor_match(self) -> None:
        dec = hanatour_same_product_anchor_decision(BANGKOK_REGISTERED, BANGKOK_MODAL_ROW)
        self.assertTrue(dec.get("sameProductMatch"), dec)

    def test_bangkok_free_travel_filter_rows(self) -> None:
        rows = filter_hanatour_same_product_rows(
            [{"candidateRawTitle": BANGKOK_MODAL_ROW}],
            BANGKOK_REGISTERED,
            supplier_pkg_cd="AAB261260706FDB",
        )
        self.assertEqual(len(rows), 1)


if __name__ == "__main__":
    unittest.main()
