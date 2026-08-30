# -*- coding: utf-8 -*-
"""교원투어 메가메뉴 라벨만 고른다. 우리 트리 지명을 그대로 누르지 않는다."""
# REGRESSION-FREEZE[register-listing-discover-kyowontour-mega-menu]: 사이트 메뉴 글자만 클릭 — manifest

from __future__ import annotations

SKIP_KYOWONTOUR_MENU = frozenset(
    {
        "해외여행",
        "해외패키지",
        "패키지",
        "자유여행",
        "홈",
        "닫기",
        "검색",
    }
)


def fold_kyowontour_menu_label(raw: str) -> str:
    s = (raw or "").replace(" ", "").replace("/", "").replace("·", "").replace("-", "")
    return s.replace("쓰", "츠")


def pick_kyowontour_mega_menu_label(word: str, labels: list[str]) -> str:
    want = fold_kyowontour_menu_label(word)
    if not want:
        return ""
    folded: list[tuple[str, str]] = []
    for lab in labels:
        t = (lab or "").replace("\n", " ").strip()
        if not t or t in SKIP_KYOWONTOUR_MENU:
            continue
        if len(t) < 2 or len(t) > 18:
            continue
        folded.append((t, fold_kyowontour_menu_label(t)))
    for lab, f in folded:
        if f == want:
            return lab
    for lab, f in folded:
        if want and want in f:
            return lab
    return ""
