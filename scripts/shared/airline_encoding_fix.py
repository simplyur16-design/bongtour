# -*- coding: utf-8 -*-
"""항공사명 모지바케 복구 — 공급사 E2E 공용."""

from __future__ import annotations

import re


def _hangul_count(s: str) -> int:
    return len(re.findall(r"[가-힣]", s))


def _replacement_count(s: str) -> int:
    return s.count("\ufffd")


def _looks_like_mojibake_garbage(s: str) -> bool:
    if not s:
        return False
    if _replacement_count(s) >= 1:
        return True
    if re.search(r"[\uE000-\uF8FF]", s):
        return True
    if _hangul_count(s) >= 2:
        return False
    if re.search(r"[?]{2,}", s) and _hangul_count(s) == 0:
        return True
    return False


def _latin1_misread_candidates(t: str) -> list[str]:
    out: list[str] = []
    try:
        b = t.encode("latin-1")
        out.append(b.decode("utf-8"))
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    try:
        b = t.encode("latin-1")
        out.append(b.decode("cp949"))
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    return [x for x in out if isinstance(x, str) and x and x != t]


def _pick_best_recovered(original: str, candidates: list[str]) -> str | None:
    if not candidates:
        return None
    h0 = _hangul_count(original)
    r0 = _replacement_count(original)
    best: str | None = None
    best_score = -10_000
    for c in candidates:
        h1 = _hangul_count(c)
        r1 = _replacement_count(c)
        score = h1 * 20 - r1 * 15 - len(re.findall(r"\?", c)) * 2
        if h1 >= max(2, h0) and r1 <= r0:
            score += 50
        if h0 == 0 and h1 >= 2:
            score += 40
        if score > best_score:
            best_score = score
            best = c
    if best is None:
        return None
    if h0 >= 2 and _hangul_count(best) < h0 - 1:
        return None
    return best


def fix_mojibake_korean_str(s: str | None, *, max_len: int = 500) -> str | None:
    if s is None:
        return None
    t = str(s).strip()
    if not t:
        return None
    caps = _latin1_misread_candidates(t)
    picked = _pick_best_recovered(t, caps)
    if picked:
        out = picked.strip()[:max_len]
        if out:
            return out
    try:
        t.encode("latin-1")
    except (UnicodeDecodeError, UnicodeEncodeError):
        if _replacement_count(t) > 3:
            return None
        if re.search(r"[?]{3,}", t) and _hangul_count(t) < 2:
            return None
        if _looks_like_mojibake_garbage(t):
            return None
        return t[:max_len]
    if picked is None:
        if _replacement_count(t) > 3:
            return None
        if re.search(r"[?]{3,}", t) and _hangul_count(t) < 2:
            return None
        if _looks_like_mojibake_garbage(t):
            return None
    return t[:max_len]


def fix_airline_name_str(s: str | None) -> str | None:
    return fix_mojibake_korean_str(s, max_len=120)
