"""공급사 GNB parent 펼침 — lib/mega-menu-discover-parents.ts 생성 JSON.

REGRESSION-FREEZE[mega-menu-discover-parents]: 공급사 GNB parent = 그룹·탭 줄기 — manifest
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_JSON = Path(__file__).with_name("mega_menu_parents.json")


@lru_cache(maxsize=1)
def _load() -> dict[str, list[str]]:
    if not _JSON.is_file():
        return {}
    data = json.loads(_JSON.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return {}
    out: dict[str, list[str]] = {}
    for k, v in data.items():
        if not isinstance(k, str) or not isinstance(v, list):
            continue
        out[k] = [str(x) for x in v if str(x).strip()]
    return out


def mega_menu_discover_parents(word: str) -> list[str]:
    """leaf(또는 soft 도시) 한글 라벨 → 공급사 메뉴에서 먼저 펼칠 parent 후보."""
    key = (word or "").strip()
    if not key:
        return []
    return list(_load().get(key, []))
