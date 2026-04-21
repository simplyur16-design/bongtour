# -*- coding: utf-8 -*-
"""하나투어 TRP 달력 E2E — 셀렉터·타임아웃 (본 패키지 SSOT)."""
import os
from pathlib import Path

BASE_URL = os.getenv("HANATOUR_BASE_URL", "https://www.hanatour.com")


def _int_env(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return max(0, int(raw))
    except ValueError:
        return default


# 타임아웃은 env로 덮어쓸 수 있음 (HANATOUR_E2E_*_MS).
PAGE_LOAD_TIMEOUT_MS = _int_env("HANATOUR_E2E_PAGE_LOAD_MS", 45000)
NETWORK_IDLE_TIMEOUT_MS = _int_env("HANATOUR_E2E_NETWORK_IDLE_MS", 6000)
MODAL_WAIT_MS = _int_env("HANATOUR_E2E_MODAL_WAIT_MS", 10000)
# 우측 리스트 비동기 갱신·레이아웃 지연 대비 (기본 32s)
LIST_REFRESH_TIMEOUT_MS = _int_env("HANATOUR_E2E_LIST_REFRESH_MS", 4000)
LIST_POLL_MS = _int_env("HANATOUR_E2E_LIST_POLL_MS", 100)
LIST_POLL_FAST_MS = _int_env("HANATOUR_E2E_LIST_POLL_FAST_MS", 45)
LIST_FAST_PHASE_MS = _int_env("HANATOUR_E2E_LIST_FAST_PHASE_MS", 2800)
LIST_WAIT_HEAVY_PROBE_EVERY = max(1, _int_env("HANATOUR_E2E_LIST_HEAVY_PROBE_EVERY", 2))
POST_CLICK_BEFORE_LIST_MS = _int_env("HANATOUR_E2E_POST_CLICK_BEFORE_LIST_MS", 85)
# 날짜 클릭·리스트 갱신 직후 수집 전 안정화 대기
POST_CLICK_LIST_SETTLE_MS = _int_env("HANATOUR_E2E_POST_CLICK_SETTLE_MS", 380)
# 첫 list_wait 실패 시 스크롤 후 재시도할 때 사용하는 타임아웃
LIST_REFRESH_RETRY_TIMEOUT_MS = _int_env("HANATOUR_E2E_LIST_REFRESH_RETRY_MS", 4000)
# 두 번의 list_wait 실패 후 강제 스크롤·재클릭 뒤 세 번째 list_wait 타임아웃
LIST_REFRESH_FORCE_TIMEOUT_MS = _int_env("HANATOUR_E2E_LIST_REFRESH_FORCE_MS", 4000)
# 동일 ISO 클릭 후 강제 리스트 스크롤(nudge) 뒤 추가 안정화(ms)
SAME_DAY_ADDITIONAL_SETTLE_MS = _int_env("HANATOUR_E2E_SAME_DAY_ADDITIONAL_SETTLE_MS", 450)
# HANATOUR_E2E_ALLOW_COLLECT_WITHOUT_LIST_REFRESH:
#   >0 이면 1·2차 list_wait 직후에도 rightListChanged 없이 미검증 수집(listRefreshUnverifiedSource=env_allow).
#   0이어도 강제 파이프라인(스크롤·3·4차 list_wait·재클릭)까지 실패한 뒤에는 env와 무관하게
#   미검증 수집을 시도한다(listRefreshUnverifiedSource=after_aggressive_pipeline). 운영 기본 0.
ALLOW_COLLECT_WITHOUT_LIST_REFRESH = _int_env(
    "HANATOUR_E2E_ALLOW_COLLECT_WITHOUT_LIST_REFRESH", 0
)
# 1이면 클릭 전·후 모두 동일 ISO가 이미 선택된 경우 list_wait 통과 후 강제 리스트 nudge·수집(기본 1).
ALLOW_SAME_DAY_SELECTION_COMMIT = _int_env(
    "HANATOUR_E2E_ALLOW_SAME_DAY_SELECTION_COMMIT", 1
)
# 콤마 구분 ISO만 클릭(예: 2026-05-17,2026-05-18) — 날짜 전환 검증 실험 시 전체 월 루프 방지
PROBE_ONLY_DATES = (os.getenv("HANATOUR_E2E_PROBE_ONLY_DATES") or "").strip()
SAMPLE_MODE = (os.getenv("HANATOUR_E2E_SAMPLE_MODE") or "").strip().lower() in (
    "1",
    "true",
    "yes",
)
DAY_BUDGET_MS = _int_env("HANATOUR_E2E_DAY_BUDGET_MS", 0)
LIST_REFRESH_SAMPLE_MS = _int_env("HANATOUR_E2E_LIST_REFRESH_SAMPLE_MS", 10000)
MONTH_FIRST_MATCH_ONLY = (
    os.getenv("HANATOUR_E2E_MONTH_FIRST_MATCH_ONLY") or ""
).strip().lower() in ("1", "true", "yes")
FIRST_VERIFY_YM = (os.getenv("HANATOUR_E2E_FIRST_VERIFY_YM") or "").strip()
# 1이면 클릭 전/후 row·달력 프로브를 stderr에 요약 출력
PROBE_LOG = (os.getenv("HANATOUR_E2E_PROBE_LOG") or "").strip().lower() in (
    "1",
    "true",
    "yes",
)
TIMING_LOG = (os.getenv("HANATOUR_E2E_TIMING") or "").strip().lower() in (
    "1",
    "true",
    "yes",
)
# Playwright 뷰포트 (작은 화면 재현: HANATOUR_E2E_VIEWPORT_WIDTH=390 등)
VIEWPORT_WIDTH = _int_env("HANATOUR_E2E_VIEWPORT_WIDTH", 1920)
VIEWPORT_HEIGHT = _int_env("HANATOUR_E2E_VIEWPORT_HEIGHT", 1080)

# 운영 기본 CTA: 「다른 출발일 보기」(스크래퍼는 role/텍스트 매칭으로 최우선 시도)
OPEN_MODAL_PRIMARY_LABEL = "다른 출발일 보기"

OPEN_MODAL_TRIGGERS = [
    "button:has-text('다른 출발일 보기')",
    "a:has-text('다른 출발일 보기')",
    "[role='button']:has-text('다른 출발일 보기')",
    "button:has-text('다른출발일보기')",
    "a:has-text('다른출발일보기')",
    "button:has-text('다른 출발일 선택')",
    "a:has-text('다른 출발일 선택')",
    "[role='button']:has-text('다른 출발일 선택')",
    "button:has-text('다른출발일선택')",
    "a:has-text('다른출발일선택')",
    "[role='button']:has-text('다른출발일선택')",
    "button:has-text('출발일 변경')",
    "a:has-text('출발일 변경')",
    "[role='button']:has-text('출발일 변경')",
    "button:has-text('출발일 보기')",
    "a:has-text('출발일 보기')",
    "[role='button']:has-text('출발일 보기')",
    "button:has-text('다른 출발일')",
    "a:has-text('다른 출발일')",
    "button:has-text('출발일 선택')",
    "a:has-text('출발일 선택')",
    "[role='button']:has-text('출발일 선택')",
]

DIALOG_SELECTOR_PARTS = [
    "[role='dialog']",
    ".lypop_wrap",
    ".fx-dialog",
    ".q-dialog",
]
DIALOG_SELECTOR = ", ".join(DIALOG_SELECTOR_PARTS)

RIGHT_LIST_ROW_SELECTOR = (
    ".sub_list_wrap li, div.list_srchword_wrap li, [class*='list_srchword'] li"
)
# 달력 헤더(YYYY년 M월) 좌우 화살표가 우선(scraper._nav_month_by_header_arrow). 아래는 실패 시만.
CALENDAR_MONTH_NEXT_SELECTORS = [
    "button[aria-label*='다음']",
    "a[aria-label*='다음']",
    "button:has-text('다음')",
    ".calendar_next",
    "[class*='btn_next']",
]
CALENDAR_MONTH_PREV_SELECTORS = [
    "button[aria-label*='이전']",
    "a[aria-label*='이전']",
    "button:has-text('이전')",
    ".calendar_prev",
    "[class*='btn_prev']",
]

_SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = _SCRIPT_DIR.parent.parent / "data" / "calendar_e2e"


def get_output_path(pkg_cd: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "_-" else "_" for c in (pkg_cd or "hanatour"))
    return OUTPUT_DIR / f"hanatour_{safe}_calendar.json"


# 스모크/E2E 보고용 고정 URL (요청 시 main --report)
DEFAULT_E2E_TEST_URL = (
    "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200"
    "?pkgCd=PNP101260501KE1&prePage=major-products"
)
