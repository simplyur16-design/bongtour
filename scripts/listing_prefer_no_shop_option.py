# -*- coding: utf-8 -*-
"""목록 상품 — 노옵션·노쇼핑을 앞에. 공급사 딜레이 SSOT 아님."""
# REGRESSION-FREEZE[register-pre-photo-ingest-no-option-no-shopping]: 패키지 노옵션·노쇼핑 우선 — manifest
from __future__ import annotations

import re

_NO_SHOP = re.compile(r"노\s*쇼핑|NO\s*쇼핑|쇼핑\s*없음", re.I)
_NO_OPT = re.compile(r"노\s*옵션|노\s*업션|NO\s*옵션|옵션\s*없음|선택관광\s*없음", re.I)


def listing_haystack_no_option_no_shopping_score(hay: str) -> int:
    h = hay or ""
    return (2 if _NO_SHOP.search(h) else 0) + (2 if _NO_OPT.search(h) else 0)


def order_codes_prefer_no_option_no_shopping(codes: list[str], blob: str) -> list[str]:
    text = blob or ""
    upper = text.upper()

    def key(code: str) -> tuple[int, int]:
        c = (code or "").upper()
        i = upper.find(c) if c else -1
        window = text[max(0, i - 500) : i + 500] if i >= 0 else ""
        return (-listing_haystack_no_option_no_shopping_score(window), codes.index(code))

    return sorted(codes, key=key)


def order_urls_prefer_no_option_no_shopping(urls: list[str], blob: str) -> list[str]:
    text = blob or ""

    def key(url: str) -> tuple[int, int]:
        i = text.find(url) if url else -1
        if i < 0:
            tail = url.rsplit("=", 1)[-1][:24] if url else ""
            i = text.upper().find(tail.upper()) if tail else -1
        window = text[max(0, i - 500) : i + 500] if i >= 0 else ""
        return (-listing_haystack_no_option_no_shopping_score(window), urls.index(url))

    return sorted(urls, key=key)
