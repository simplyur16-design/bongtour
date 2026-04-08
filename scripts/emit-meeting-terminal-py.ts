/**
 * `lib/meeting-terminal-rules.ts` → `scripts/shared/meeting_terminal_rules.py`
 * 실행: npx tsx scripts/emit-meeting-terminal-py.ts
 *
 * 터미널 안내 기준(요약): 출발공항 코드 + 최종 항공 입력값(또는 최종 구조화 항공값).
 * 스크래퍼 원문 항공사명은 fallback 참고만. ICN만 문구 생성, 시간·장소 문구 없음.
 */
import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  ICN_TERMINAL_MAP_BY_AIRLINE_KEY,
  RAW_AIRLINE_NAME_ALIASES,
} from '../lib/meeting-terminal-rules'

const icn = JSON.stringify(ICN_TERMINAL_MAP_BY_AIRLINE_KEY)
const raw = JSON.stringify(RAW_AIRLINE_NAME_ALIASES)

const py = `# -*- coding: utf-8 -*-
"""인천공항(ICN) 터미널 안내 — Next SSOT: lib/meeting-terminal-rules.ts (emit-meeting-terminal-py.ts 동기화).

공용 터미널 안내는 출발공항 코드 + 최종 항공 입력값(또는 최종 구조화 항공값)을 기준으로 생성한다.
스크래퍼 원문 항공사명은 직접 SSOT로 쓰지 않고, 필요 시 최종 항공 입력값이 비어 있을 때만 보조/fallback 참고값으로 제한한다.
ICN일 때만 터미널 문구를 생성하고, ICN 외 공항은 null 또는 비노출 처리한다. 시간/장소 문구는 포함하지 않는다.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

_ICN_JSON = ${JSON.stringify(icn)}
_RAW_JSON = ${JSON.stringify(raw)}

ICN_TERMINAL_MAP_BY_AIRLINE_KEY: Dict[str, Dict[str, Any]] = json.loads(_ICN_JSON)
RAW_AIRLINE_NAME_ALIASES: Dict[str, str] = json.loads(_RAW_JSON)

_ICN_FALLBACK_MESSAGE = (
    "인천공항 출발 예정입니다. 이용 항공사 기준 터미널은 출발 전 별도 확인 부탁드립니다."
)


def normalize_airline_name(name: Optional[str]) -> str:
    if name is None:
        return ""
    s = str(name).replace("\\u00a0", " ")
    s = re.sub(r"\\([^)]*\\)", " ", s)
    s = re.sub(r"['\`´]", "", s)
    s = re.sub(r"[^0-9a-zA-Z\\uac00-\\ud7a3\\s\\-/&.]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\\s+", " ", s).strip()
    if not s:
        return ""
    s = "".join(ch.lower() if "a" <= ch <= "z" or "A" <= ch <= "Z" else ch for ch in s)
    return re.sub(r"\\s+", " ", s).strip()


def _build_airline_name_aliases() -> Dict[str, str]:
    out: Dict[str, str] = {}
    for k, v in RAW_AIRLINE_NAME_ALIASES.items():
        out[normalize_airline_name(k)] = v
    for key in ICN_TERMINAL_MAP_BY_AIRLINE_KEY.keys():
        out[normalize_airline_name(key)] = key
    return out


AIRLINE_NAME_ALIASES: Dict[str, str] = _build_airline_name_aliases()


def resolve_airline_terminal_key(airline_name: Optional[str]) -> Optional[str]:
    n = normalize_airline_name(airline_name)
    if not n:
        return None
    return AIRLINE_NAME_ALIASES.get(n)


def resolve_icn_terminal_info(airline_name: Optional[str]) -> Optional[Dict[str, Any]]:
    key = resolve_airline_terminal_key(airline_name)
    if not key:
        return None
    return ICN_TERMINAL_MAP_BY_AIRLINE_KEY.get(key)


def normalize_departure_airport_code(code: Optional[str]) -> Optional[str]:
    if code is None:
        return None
    raw = str(code).strip()
    if not raw:
        return None
    u = raw.upper()
    if u == "ICN" or re.search(r"\\bICN\\b", u):
        return "ICN"
    if "인천" in raw and (re.search(r"(ICN|국제|공항)", raw) or len(raw) <= 12):
        return "ICN"
    return None


def build_departure_terminal_info(
    departure_airport_code: Optional[str], airline_name: Optional[str]
) -> Optional[str]:
    if normalize_departure_airport_code(departure_airport_code) != "ICN":
        return None
    n = normalize_airline_name(airline_name)
    if not n:
        return _ICN_FALLBACK_MESSAGE
    info = resolve_icn_terminal_info(airline_name)
    if not info:
        return _ICN_FALLBACK_MESSAGE
    t_label = "제1터미널" if info["terminal"] == "T1" else "제2터미널"
    parts = [f"인천공항 {t_label} 출발 예정입니다."]
    counter = str(info.get("checkin_counter", "")).strip()
    if counter:
        parts.append(f"{info['airline_name_kr']} 체크인 카운터는 {counter} 구역입니다.")
    else:
        parts.append(f"{info['airline_name_kr']} 이용 고객은 {t_label}에서 수속해 주세요.")
    note = str(info.get("note", "")).strip()
    if note:
        parts.append(note)
    return " ".join(parts)
`

writeFileSync(join(process.cwd(), 'scripts/shared/meeting_terminal_rules.py'), py, 'utf-8')
console.log('ok scripts/shared/meeting_terminal_rules.py')
