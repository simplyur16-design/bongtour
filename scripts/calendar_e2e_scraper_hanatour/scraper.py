# -*- coding: utf-8 -*-
"""
하나투어 TRP — 모달 달력 E2E (화면 동작).
실전 복제본 — 수집 로직 정본은 `scripts/calendar_e2e_scraper_hanatourDEV/scraperDEV.py` (동기화 시 복사).

리스트 갱신·미검증 수집 (matchingTraceRaw)
  - ``listRefreshUnverified`` / ``listRefreshUnverifiedSource`` 로 수집 경로 추적.
  - ``listRefreshUnverifiedSource``: ``"env_allow"`` (``HANATOUR_E2E_ALLOW_COLLECT_WITHOUT_LIST_REFRESH``>0,
    1·2차 list_wait 실패 직후 미검증), ``"after_aggressive_pipeline"`` (강제 스크롤·3·4차 list_wait·
    재클릭까지 실패 후 미검증), JSON ``null`` (미검증이 아닌 검증 수집).

검증 시 보고
  - 정상 갱신: ``rightListChanged=true``, ``listRefreshUnverified=false``.
  - 강제 파이프라인 후 미검증 수집: ``rightListChanged=false``, ``listRefreshUnverified=true``,
    ``listRefreshUnverifiedSource="after_aggressive_pipeline"``.
  - env 미검증: ``listRefreshUnverifiedSource="env_allow"``.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import time as _time
from typing import Any

_E2E_T0 = 0.0


def _e2e_progress_enabled() -> bool:
    return (os.environ.get("HANATOUR_E2E_PROGRESS", "1") or "").strip().lower() not in (
        "0",
        "false",
        "no",
    )


def _e2e_debug_enabled() -> bool:
    return (os.environ.get("HANATOUR_E2E_DEBUG", "") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _e2e_progress(msg: str) -> None:
    if not _e2e_progress_enabled():
        return
    elapsed = _time.monotonic() - _E2E_T0 if _E2E_T0 else 0.0
    sys.stderr.write(f"[HANATOUR_E2E] +{elapsed:.1f}s {msg}\n")
    sys.stderr.flush()


def _e2e_timer_reset() -> None:
    global _E2E_T0
    _E2E_T0 = _time.monotonic()


def _e2e_light_ops() -> bool:
    """운영 재수집 경량 모드 — 강제 리스트 재시도·동일일 nudge 생략, phase 로그 축소."""
    return (os.environ.get("HANATOUR_E2E_LIGHT_OPS") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


_LIGHT_OPS_PHASES = frozenset(
    {
        "month_boot",
        "detail_page_loaded",
        "departure_modal_opened",
        "calendar_aligned_to_target_month",
        "left_calendar_scanned",
        "right_list_scan_started",
        "right_list_scan_done",
        "day_click_started",
        "day_click_done",
        "row_collect_started",
        "row_collect_done",
        "month_collect_done",
        "before_collect_return",
        "before_json_build",
        "after_json_build",
        "after_stdout_flush",
        "before_browser_close",
        "after_browser_close",
    }
)

# LIGHT_OPS=1일 때도 stderr에 남겨 병목·lastPhase 진단용(그 외 phase는 기존 화이트리스트만)
_LIGHT_OPS_DIAGNOSTIC_PHASES = frozenset(
    {
        "script-entry",
        "browser-launching",
        "page-navigated",
        "modal-opened",
        "process-exit",
    }
)


def _hanatour_phase_allowed_under_light_ops(phase: str) -> bool:
    if phase in _LIGHT_OPS_PHASES:
        return True
    if phase in _LIGHT_OPS_DIAGNOSTIC_PHASES:
        return True
    if re.match(r"^month-\d+-collect-(start|end)$", phase or ""):
        return True
    return False


def _e2e_admin_progress(message: str) -> None:
    if (os.environ.get("HANATOUR_E2E_ADMIN_MONTH_SESSION") or "").strip().lower() not in (
        "1",
        "true",
        "yes",
    ):
        return
    sys.stderr.write(f"[HANATOUR_E2E_ADMIN] {message}\n")
    sys.stderr.flush()


def _e2e_timing_phase(phase: str) -> None:
    """단계별 경과(초) — stderr만, stdout JSON과 분리."""
    if _e2e_light_ops():
        return
    if not _e2e_progress_enabled():
        return
    elapsed = _time.monotonic() - _E2E_T0 if _E2E_T0 else 0.0
    sys.stderr.write(f"[HANATOUR_E2E_TIMING] +{elapsed:.1f}s phase={phase}\n")
    sys.stderr.flush()


def _e2e_hanatour_phase(
    phase: str,
    *,
    month: str,
    appended_count: int | None = None,
    rows_seen: int | None = None,
    selected_iso: str | None = None,
    current_calendar_label: str | None = None,
    iso: str | None = None,
    extra_ms: float | None = None,
) -> None:
    """병목 가시화용 — HANATOUR_E2E_PROGRESS와 무관하게 stderr에 항상 기록."""
    if _e2e_light_ops() and not _hanatour_phase_allowed_under_light_ops(phase):
        return
    elapsed = _time.monotonic() - _E2E_T0 if _E2E_T0 else 0.0
    parts = [
        f"[HANATOUR_E2E_PHASE] phase={phase}",
        f"month={month}",
        f"elapsed={elapsed:.2f}s",
    ]
    if current_calendar_label is not None:
        parts.append(f"currentCalendarLabel={current_calendar_label}")
    if rows_seen is not None:
        parts.append(f"rowsSeen={rows_seen}")
    if appended_count is not None:
        parts.append(f"appendedCount={appended_count}")
    if selected_iso is not None:
        parts.append(f"selectedIso={selected_iso}")
    if iso is not None:
        parts.append(f"iso={iso}")
    if extra_ms is not None:
        parts.append(f"extraMs={extra_ms:.0f}")
    sys.stderr.write("\t".join(parts) + "\n")
    sys.stderr.flush()


def _e2e_sample_line(
    iso: str,
    selected_committed: bool,
    same_product_matched: bool,
    collected: bool,
    fail_reason: str,
    elapsed_ms: float,
) -> None:
    print(
        f"E2E_SAMPLE\t{iso}\tselected_committed={str(selected_committed).lower()}\t"
        f"same_product_matched={str(same_product_matched).lower()}\tcollected={str(collected).lower()}\t"
        f"fail_reason={fail_reason}\telapsed_ms={elapsed_ms:.0f}",
        flush=True,
    )


def _e2e_sample_record(
    st: dict[str, Any],
    *,
    fail_reason: str,
    selected_committed: bool,
    same_product_matched: bool,
    collected: bool,
) -> None:
    st["scanned"] = int(st.get("scanned") or 0) + 1
    if selected_committed:
        st["committed"] = int(st.get("committed") or 0) + 1
    if same_product_matched:
        st["matched"] = int(st.get("matched") or 0) + 1
    if collected:
        st["collected"] = int(st.get("collected") or 0) + 1
    if fail_reason not in ("none", "ok"):
        st["fail"] = int(st.get("fail") or 0) + 1
        fr = st.setdefault("fr", {})
        fr[fail_reason] = int(fr.get(fail_reason) or 0) + 1


def _e2e_sample_summary(st: dict[str, Any], total_ms: float) -> None:
    fr = st.get("fr") if isinstance(st.get("fr"), dict) else {}
    top = ""
    if fr:
        top = max(fr.items(), key=lambda x: x[1])[0]
    print(
        f"E2E_SAMPLE_SUMMARY\tscannedDatesCount={int(st.get('scanned') or 0)}\t"
        f"committedCount={int(st.get('committed') or 0)}\t"
        f"matchedCount={int(st.get('matched') or 0)}\t"
        f"collectedCount={int(st.get('collected') or 0)}\t"
        f"failCount={int(st.get('fail') or 0)}\t"
        f"totalElapsedMs={total_ms:.0f}\ttopFailReason={top}",
        flush=True,
    )


async def _post_page_load_delay() -> None:
    if (os.environ.get("HANATOUR_E2E_FAST", "") or "").strip().lower() in ("1", "true", "yes"):
        await human_delay(0.45, 0.9)
    else:
        await human_delay(2.0, 3.5)

from playwright.async_api import ElementHandle, Locator, Page

from . import config
from .utils import (
    clean_price_to_int,
    close_hanatour_browser,
    dedupe_departures_by_date,
    extract_hanatour_detail_raw_title,
    filter_hanatour_same_product_rows,
    fix_airline_name_str,
    hanatour_e2e_verification_tier,
    hanatour_partial_success_primary_reason,
    hanatour_field_confidence_from_candidate_row,
    hanatour_normalize_status_raw,
    hanatour_same_product_match_trace,
    hanatour_title_layers,
    human_delay,
    kst_today_ymd,
    launch_hanatour_browser,
    parse_hanatour_product_identifiers,
)

_LAST_MONTH_NAV_PATH: str | None = None

_DIALOG_PICK_FN = """
function __hanatourPickDialog(){
  const parts = __DIALOG_PARTS__;
  function ok(el){
    try {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width < 32 || r.height < 32) return false;
      if (st.visibility === 'hidden' || st.display === 'none') return false;
      return true;
    } catch(e){ return false; }
  }
  for (let i = 0; i < parts.length; i++){
    const els = document.querySelectorAll(parts[i]);
    for (let j = 0; j < els.length; j++){
      if (ok(els[j])) return els[j];
    }
  }
  return document.body;
}
"""


def _inject_dialog_selector(js: str) -> str:
    """최상위에 function + ()=> 를 이어 붙이면 Playwright eval에서 SyntaxError 날 수 있어, 화살표 본문 안에 삽입."""
    pick = _DIALOG_PICK_FN.replace(
        "__DIALOG_PARTS__", json.dumps(config.DIALOG_SELECTOR_PARTS)
    )
    idx = js.find("=>")
    if idx < 0:
        return pick + "\n" + js
    brace = js.find("{", idx)
    if brace < 0:
        return pick + "\n" + js
    return js[: brace + 1] + "\n" + pick + "\n" + js[brace + 1 :]


_LIST_LI_QUERY = (
    ".prod_list_wrap .cont_unit, .prod_list_wrap li, "
    ".sub_list_wrap li, .sub_list_wrap > ul > li, "
    "div.list_srchword_wrap.type.v2 li, div.list_srchword_wrap li, "
    "[class*='list_srchword'] li, [class*='sub_list_wrap'] li, [class*='departure_list'] li"
)


def _inject_list_li_query(js: str) -> str:
    return js.replace("__LIST_LI__", json.dumps(_LIST_LI_QUERY))


_SCROLL_CLICK_JS = _inject_dialog_selector("""
(iso) => {
  function txt(el){ return (el && (el.innerText || el.textContent) || '').replace(/\\s+/g,' ').trim(); }
  function dayNum(li){
    const s = txt(li);
    const m = s.match(/^(\\d{1,2})\\b/);
    return m ? parseInt(m[1],10) : 0;
  }
  const parts = String(iso||'').split('-');
  const y = parseInt(parts[0]||'0',10), mo = parseInt(parts[1]||'0',10), d = parseInt(parts[2]||'0',10);
  if (!d) return { ok:false, reason:'bad_iso' };
  function isPadLi(li) {
    return /\bbefore\b/i.test(li.className||'') && d >= 8;
  }
  function pricedLowCell(li){
    const cls = li.className || '';
    if (!/\\blow\\b/i.test(cls)) return false;
    const s = txt(li);
    return /^\\d{1,2}\\s+.+만\\s*최저가/i.test(s);
  }
  const dialog = __hanatourPickDialog();
  const wrap = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]') || dialog;
  const calArea = wrap.querySelector('.calendar_area') || wrap;
  function isScrollableY(el){
    try {
      const st = getComputedStyle(el);
      const oy = st.overflowY;
      if (!(oy==='auto'||oy==='scroll'||oy==='overlay')) return false;
      if (el.scrollHeight <= el.clientHeight+2) return false;
      const r = el.getBoundingClientRect();
      return r.width>32 && r.height>32;
    } catch(e){ return false; }
  }
  function findScrollerInsideCalendar(li, area){
    let el = li && li.parentElement;
    for (let i=0; i<50 && el; i++){
      if (!area.contains(el)) break;
      if (isScrollableY(el)) return el;
      if (el === area) break;
      el = el.parentElement;
    }
    if (area && area.contains(li) && isScrollableY(area)) return area;
    return null;
  }
  function findScrollerModalFallback(li){
    let el = li && li.parentElement;
    for (let i=0; i<44 && el; i++){
      if (isScrollableY(el)) return el;
      el = el.parentElement;
    }
    return null;
  }
  let li0 = null;
  let bestArea = -1;
  let fb = null;
  let fbArea = -1;
  for (const ul of calArea.querySelectorAll('ul.day, ul[class*="day"]')){
    for (const li of ul.querySelectorAll(':scope > li')){
      if (dayNum(li)!==d) continue;
      if (isPadLi(li)) continue;
      const r = li.getBoundingClientRect();
      const ar = r.width * r.height;
      if (ar < 40) continue;
      if (pricedLowCell(li)) {
        if (ar > bestArea){ bestArea = ar; li0 = li; }
      } else if (ar > fbArea) { fbArea = ar; fb = li; }
    }
  }
  if (!li0) li0 = fb;
  if (!li0){
    for (const ul of calArea.querySelectorAll('ul.day, ul[class*="day"]')){
      for (const li of ul.querySelectorAll(':scope > li')){
        if (dayNum(li)===d && !isPadLi(li)){ li0 = li; break; }
      }
      if (li0) break;
    }
  }
  if (!li0) return { ok:false, reason:'no_li' };
  const sc = findScrollerInsideCalendar(li0, calArea) || findScrollerModalFallback(li0);
  function vis(li, box){
    if (!box) return true;
    try {
      const cr = box.getBoundingClientRect(), lr = li.getBoundingClientRect();
      const ih = Math.min(lr.bottom, cr.bottom-4) - Math.max(lr.top, cr.top+4);
      const iw = Math.min(lr.right, cr.right-4) - Math.max(lr.left, cr.left+4);
      return ih>10 && iw>10;
    } catch(e){ return false; }
  }
  let steps = 0;
  if (sc){
    try { li0.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch(e){}
    for (let i=0;i<60;i++){
      if (vis(li0, sc)) break;
      const lr = li0.getBoundingClientRect(), cr = sc.getBoundingClientRect();
      const prev = sc.scrollTop;
      const step = Math.max(80, Math.floor(sc.clientHeight*0.45));
      let delta = (lr.top >= cr.bottom - 8) ? step : (lr.bottom <= cr.top + 8) ? -step : (lr.top < cr.top) ? -step : step;
      const maxS = Math.max(0, sc.scrollHeight - sc.clientHeight);
      sc.scrollTop = Math.min(Math.max(0, prev + delta), maxS);
      steps++;
      if (sc.scrollTop === prev && i>1){
        try { li0.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch(e){}
      }
      if (sc.scrollTop === prev && i>4) break;
    }
  } else {
    try { li0.scrollIntoView({block:'center', inline:'nearest'}); } catch(e){}
  }
  if (sc && !vis(li0, sc)) {
    return { ok: false, reason: 'day_not_visible_in_calendar_scroller', scrollSteps: steps, hasScroller: true };
  }
  function area(el){
    try { const r = el.getBoundingClientRect(); return r.width * r.height; } catch(e){ return 0; }
  }
  function clickTarget(li){
    const a = li.querySelector('a[href], a');
    const btn = li.querySelector('button');
    if (a && area(a) > 4) return a;
    if (btn && area(btn) > 4) return btn;
    return li;
  }
  function firePointerClick(el, li){
    try { if (el && el.focus) el.focus(); } catch(e){}
    try {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (const type of ['mousedown','mouseup','click']){
        try {
          el.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0
          }));
        } catch(e){}
      }
      return true;
    } catch(e) {}
    try {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const seq = ['pointerdown','pointerup','mousedown','mouseup','click'];
      for (let i = 0; i < seq.length; i++){
        try {
          el.dispatchEvent(new MouseEvent(seq[i], {
            bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0
          }));
        } catch(e){}
      }
      if (typeof el.click === 'function') el.click();
      return true;
    } catch(e) {
      try { if (typeof el.click === 'function') el.click(); return true; } catch(e2) {}
      try { li.click(); return true; } catch(e3) { return false; }
    }
  }
  const target = clickTarget(li0);
  if (!firePointerClick(target, li0)) return { ok:false, reason:'click_fail' };
  return { ok:true, scrollSteps: steps, hasScroller: !!sc, visibleInScroller: !sc || vis(li0, sc) };
}
""")

# _SCROLL_CLICK_JS 와 동일 스크롤·타깃 탐색 후 클릭 없이 뷰포트 좌표만 반환 (Playwright mouse.click 폴백용)
_CALENDAR_DAY_PREPARE_AND_POINT_JS = _inject_dialog_selector("""
(iso) => {
  function txt(el){ return (el && (el.innerText || el.textContent) || '').replace(/\\s+/g,' ').trim(); }
  function dayNum(li){
    const s = txt(li);
    const m = s.match(/^(\\d{1,2})\\b/);
    return m ? parseInt(m[1],10) : 0;
  }
  const parts = String(iso||'').split('-');
  const d = parseInt(parts[2]||'0',10);
  if (!d) return { ok:false, reason:'bad_iso' };
  function isPadLi(li) {
    return /\bbefore\b/i.test(li.className||'') && d >= 8;
  }
  function pricedLowCell(li){
    const cls = li.className || '';
    if (!/\\blow\\b/i.test(cls)) return false;
    const s = txt(li);
    return /^\\d{1,2}\\s+.+만\\s*최저가/i.test(s);
  }
  const dialog = __hanatourPickDialog();
  const wrap = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]') || dialog;
  const calArea = wrap.querySelector('.calendar_area') || wrap;
  function isScrollableY(el){
    try {
      const st = getComputedStyle(el);
      const oy = st.overflowY;
      if (!(oy==='auto'||oy==='scroll'||oy==='overlay')) return false;
      if (el.scrollHeight <= el.clientHeight+2) return false;
      const r = el.getBoundingClientRect();
      return r.width>32 && r.height>32;
    } catch(e){ return false; }
  }
  function findScrollerInsideCalendar(li, area){
    let el = li && li.parentElement;
    for (let i=0; i<50 && el; i++){
      if (!area.contains(el)) break;
      if (isScrollableY(el)) return el;
      if (el === area) break;
      el = el.parentElement;
    }
    if (area && area.contains(li) && isScrollableY(area)) return area;
    return null;
  }
  function findScrollerModalFallback(li){
    let el = li && li.parentElement;
    for (let i=0; i<44 && el; i++){
      if (isScrollableY(el)) return el;
      el = el.parentElement;
    }
    return null;
  }
  let li0 = null;
  let bestArea = -1;
  let fb = null;
  let fbArea = -1;
  for (const ul of calArea.querySelectorAll('ul.day, ul[class*="day"]')){
    for (const li of ul.querySelectorAll(':scope > li')){
      if (dayNum(li)!==d) continue;
      if (isPadLi(li)) continue;
      const r = li.getBoundingClientRect();
      const ar = r.width * r.height;
      if (ar < 40) continue;
      if (pricedLowCell(li)) {
        if (ar > bestArea){ bestArea = ar; li0 = li; }
      } else if (ar > fbArea) { fbArea = ar; fb = li; }
    }
  }
  if (!li0) li0 = fb;
  if (!li0){
    for (const ul of calArea.querySelectorAll('ul.day, ul[class*="day"]')){
      for (const li of ul.querySelectorAll(':scope > li')){
        if (dayNum(li)===d && !isPadLi(li)){ li0 = li; break; }
      }
      if (li0) break;
    }
  }
  if (!li0) return { ok:false, reason:'no_li' };
  const sc = findScrollerInsideCalendar(li0, calArea) || findScrollerModalFallback(li0);
  function vis(li, box){
    if (!box) return true;
    try {
      const cr = box.getBoundingClientRect(), lr = li.getBoundingClientRect();
      const ih = Math.min(lr.bottom, cr.bottom-4) - Math.max(lr.top, cr.top+4);
      const iw = Math.min(lr.right, cr.right-4) - Math.max(lr.left, cr.left+4);
      return ih>10 && iw>10;
    } catch(e){ return false; }
  }
  let steps = 0;
  if (sc){
    try { li0.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch(e){}
    for (let i=0;i<60;i++){
      if (vis(li0, sc)) break;
      const lr = li0.getBoundingClientRect(), cr = sc.getBoundingClientRect();
      const prev = sc.scrollTop;
      const step = Math.max(80, Math.floor(sc.clientHeight*0.45));
      let delta = (lr.top >= cr.bottom - 8) ? step : (lr.bottom <= cr.top + 8) ? -step : (lr.top < cr.top) ? -step : step;
      const maxS = Math.max(0, sc.scrollHeight - sc.clientHeight);
      sc.scrollTop = Math.min(Math.max(0, prev + delta), maxS);
      steps++;
      if (sc.scrollTop === prev && i>1){
        try { li0.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch(e){}
      }
      if (sc.scrollTop === prev && i>4) break;
    }
  } else {
    try { li0.scrollIntoView({block:'center', inline:'nearest'}); } catch(e){}
  }
  if (sc && !vis(li0, sc)) {
    return { ok: false, reason: 'day_not_visible_in_calendar_scroller', scrollSteps: steps, hasScroller: true };
  }
  function area(el){
    try { const r = el.getBoundingClientRect(); return r.width * r.height; } catch(e){ return 0; }
  }
  function clickTarget(li){
    const a = li.querySelector('a[href], a');
    const btn = li.querySelector('button');
    if (a && area(a) > 4) return a;
    if (btn && area(btn) > 4) return btn;
    return li;
  }
  const target = clickTarget(li0);
  if (!target) return { ok:false, reason:'no_target' };
  const pr = target.getBoundingClientRect();
  const x = pr.left + pr.width / 2, y = pr.top + pr.height / 2;
  return { ok: true, x, y, scrollSteps: steps, hasScroller: !!sc, visibleInScroller: !sc || vis(li0, sc) };
}
""")

_CALENDAR_DAY_STATE_JS = _inject_dialog_selector("""
(iso) => {
  const parts = String(iso||'').split('-');
  const d = parseInt(parts[2]||'0', 10);
  if (!d) return { ok: false };
  const dialog = __hanatourPickDialog();
  const wrap = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]') || dialog;
  const calArea = wrap.querySelector('.calendar_area') || wrap;
  function dataAttrs(el){
    const o = {};
    if (!el || !el.attributes) return o;
    for (let i = 0; i < el.attributes.length; i++) {
      const n = el.attributes[i].name;
      if (n.indexOf('data-') === 0) o[n] = String(el.attributes[i].value||'').slice(0, 160);
    }
    return o;
  }
  function txt(el){ return (el && (el.innerText || el.textContent) || '').replace(/\\s+/g,' ').trim(); }
  function dayNum(li){
    const s = txt(li);
    const m = s.match(/^(\\d{1,2})\\b/);
    return m ? parseInt(m[1],10) : 0;
  }
  function pricedLowCell(li){
    const cls = li.className || '';
    if (!/\\blow\\b/i.test(cls)) return false;
    const s = txt(li);
    return /^\\d{1,2}\\s+.+만\\s*최저가/i.test(s);
  }
  let best = null;
  let bestArea = -1;
  let fb = null;
  let fbArea = -1;
  for (const ul of calArea.querySelectorAll('ul.day, ul[class*="day"]')){
    for (const li of ul.querySelectorAll(':scope > li')){
      if (dayNum(li) !== d) continue;
      const r = li.getBoundingClientRect();
      const ar = r.width * r.height;
      if (ar < 40) continue;
      if (pricedLowCell(li)) {
        if (ar > bestArea){ bestArea = ar; best = li; }
      } else if (ar > fbArea) { fbArea = ar; fb = li; }
    }
  }
  if (!best) best = fb;
  if (best){
    const a = best.querySelector('a');
    return {
      ok: true,
      liClass: String(best.className||'').slice(0, 400),
      liAria: String(best.getAttribute('aria-selected')||''),
      aClass: a ? String(a.className||'').slice(0, 400) : '',
      aAria: a ? String(a.getAttribute('aria-selected')||'') : '',
      liAriaCurrent: String(best.getAttribute('aria-current')||''),
      aAriaCurrent: a ? String(a.getAttribute('aria-current')||'') : '',
      liDataAttrsJson: JSON.stringify(dataAttrs(best)),
      aDataAttrsJson: a ? JSON.stringify(dataAttrs(a)) : '{}',
    };
  }
  return { ok: false };
}
""")

_LIST_TOP_DEPARTURE_ROWS_PROBE_JS = _inject_dialog_selector("""
() => {
  const dialog = __hanatourPickDialog();
  const cal = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]');
  const listRoot = dialog.querySelector(
    '.prod_list_wrap, .sub_list_wrap, div.list_srchword_wrap.type.v2, .list_srchword_wrap, [class*="list_srchword"], [class*="sub_list_wrap"]'
  );
  function dataAttrs(el){
    const o = {};
    if (!el || !el.attributes) return o;
    for (let i = 0; i < el.attributes.length; i++) {
      const n = el.attributes[i].name;
      if (n.indexOf('data-') === 0 || n.indexOf('aria-') === 0)
        o[n] = String(el.attributes[i].value||'').slice(0, 160);
    }
    return o;
  }
  if (!listRoot) return { ok: false, rows: [] };
  const out = [];
  let lis = [];
  const units = listRoot.querySelectorAll(':scope > .cont_unit, .cont_unit');
  if (units && units.length) {
    for (const el of units) {
      if (cal && cal.contains(el)) continue;
      lis.push(el);
    }
  }
  if (!lis.length) {
    lis = Array.from(listRoot.querySelectorAll(':scope li')).filter((li) => !(cal && cal.contains(li)));
  }
  for (const li of lis){
    const tx = (li.innerText || '').replace(/\\s+/g,' ').trim();
    if (tx.length < 16) continue;
    if (/^(?:출발일|다른\\s*출발|상품\\s*안내|이용\\s*안내)/.test(tx.slice(0,40))) continue;
    const lines = tx.split(/\\n/).map(function(s){ return s.trim(); }).filter(Boolean);
    const titleLine = (lines[0] || tx.slice(0, 200));
    const a = li.querySelector('a[href], a, button');
    const dm = [];
    const re = /\\d{1,2}\\/\\d{1,2}/g;
    let m;
    while ((m = re.exec(tx)) !== null) dm.push(m[0]);
    out.push({
      fullText: tx.slice(0, 2500),
      titleLine: titleLine.slice(0, 500),
      className: String(li.className||'').slice(0, 400),
      liAriaCurrent: String(li.getAttribute('aria-current')||''),
      liAriaSelected: String(li.getAttribute('aria-selected')||''),
      liDataAttrsJson: JSON.stringify(dataAttrs(li)),
      cardDataAttrsJson: a ? JSON.stringify(dataAttrs(a)) : '{}',
      dateSlashTokens: dm.slice(0, 10),
    });
    if (out.length >= 3) break;
  }
  return { ok: out.length > 0, rows: out };
}
""")

_LIST_SNAPSHOT_JS = _inject_list_li_query(
    _inject_dialog_selector(
        """
() => {
  const dialog = __hanatourPickDialog();
  const cal = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]');
  const listRoot = dialog.querySelector(
    '.prod_list_wrap, .sub_list_wrap, div.list_srchword_wrap.type.v2, .list_srchword_wrap, [class*="list_srchword"], [class*="sub_list_wrap"]'
  );
  function rowNodes(root, dlg, c){
    const acc = [];
    if (root) {
      const units = root.querySelectorAll(':scope > .cont_unit, .cont_unit');
      if (units && units.length) {
        for (const el of units) {
          if (c && c.contains(el)) continue;
          acc.push(el);
        }
        return acc;
      }
      for (const li of root.querySelectorAll(':scope li')) {
        if (c && c.contains(li)) continue;
        acc.push(li);
      }
      return acc;
    }
    for (const li of dlg.querySelectorAll(__LIST_LI__)) {
      if (c && c.contains(li)) continue;
      acc.push(li);
    }
    return acc;
  }
  const lis = rowNodes(listRoot, dialog, cal);
  const parts = [];
  const sep = String.fromCharCode(30);
  for (const li of lis){
    const tx = (li.innerText || '').replace(/\\s+/g,' ').trim();
    if (tx.length < 16) continue;
    if (/^(?:출발일|다른\\s*출발|상품\\s*안내|이용\\s*안내)/.test(tx.slice(0,40))) continue;
    parts.push(tx.slice(0, 500));
  }
  const t = parts.join(sep).slice(0, 12000);
  let h = 0;
  for (let i=0;i<t.length;i++) h = ((h<<5)-h) + t.charCodeAt(i);
  return { hash: String(h) + ':' + parts.length + ':' + t.length, len: t.length, rowCount: parts.length, scoped: !!listRoot };
}
"""
    )
)

# 우측 첫 출발 행 전체 텍스트(해시와 별도 — DOM이 갱신돼도 해시가 동일하게 나오는 경우 대비)
_LIST_FIRST_DEPARTURE_ROW_SNAPSHOT_JS = _inject_dialog_selector("""
() => {
  const dialog = __hanatourPickDialog();
  const cal = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]');
  const listRoot = dialog.querySelector(
    '.prod_list_wrap, .sub_list_wrap, div.list_srchword_wrap.type.v2, .list_srchword_wrap, [class*="list_srchword"], [class*="sub_list_wrap"]'
  );
  if (!listRoot) return { ok: false, reason: 'no_list_root' };
  function rowNodes(root, c){
    const acc = [];
    const units = root.querySelectorAll(':scope > .cont_unit, .cont_unit');
    if (units && units.length) {
      for (const el of units) {
        if (c && c.contains(el)) continue;
        acc.push(el);
      }
      return acc;
    }
    for (const li of root.querySelectorAll(':scope li')) {
      if (c && c.contains(li)) continue;
      acc.push(li);
    }
    return acc;
  }
  const lis = rowNodes(listRoot, cal);
  for (const li of lis){
    const tx = (li.innerText || '').replace(/\\s+/g,' ').trim();
    if (tx.length < 16) continue;
    if (/^(?:출발일|다른\\s*출발|상품\\s*안내|이용\\s*안내)/.test(tx.slice(0,40))) continue;
    return { ok: true, text: tx.slice(0, 2200) };
  }
  return { ok: false, reason: 'no_departure_row' };
}
""")

# 달력 옆 / 달력 아래(좁은 뷰포트) 레이아웃 모두에서 출발 리스트가 보이도록 스크롤 보정
_ENSURE_LIST_VISIBLE_JS = _inject_list_li_query(
    _inject_dialog_selector(
        """
() => {
  const dialog = __hanatourPickDialog();
  const cal = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]');
  const listRoot = dialog.querySelector(
    '.prod_list_wrap, .sub_list_wrap, div.list_srchword_wrap.type.v2, .list_srchword_wrap, [class*="list_srchword"], [class*="sub_list_wrap"]'
  );
  let liCount = 0;
  try {
    liCount = dialog.querySelectorAll(__LIST_LI__).length;
  } catch (e) {
    liCount = 0;
  }
  if (!listRoot) {
    return {
      ok: false,
      reason: 'no_list_root',
      layout: 'unknown',
      liCount,
      viewport: { w: window.innerWidth || 0, h: window.innerHeight || 0 },
    };
  }
  const cr = cal ? cal.getBoundingClientRect() : null;
  const lr0 = listRoot.getBoundingClientRect();
  const stacked = !!(cr && lr0.top >= cr.bottom - 14);
  const vh = window.innerHeight || 0;
  const vw = window.innerWidth || 0;
  let scrolled = false;
  try {
    listRoot.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    scrolled = true;
  } catch (e) {}
  const scrollers = [
    dialog.querySelector('.lypop_container'),
    dialog.querySelector('.lypop_cont'),
    dialog.querySelector('.fx-dialog__body'),
    dialog.querySelector('[class*="pop_cont"]'),
    dialog.querySelector('[class*="dialog_cont"]'),
    dialog.querySelector('[class*="dialog_body"]'),
    dialog.querySelector('.cont'),
  ].filter(Boolean);
  for (let si = 0; si < scrollers.length; si++) {
    const sc = scrollers[si];
    try {
      if (sc.scrollHeight <= sc.clientHeight + 6) continue;
      const sr = sc.getBoundingClientRect();
      const lr = listRoot.getBoundingClientRect();
      if (lr.bottom > sr.bottom - 10) {
        const need = Math.min(lr.bottom - sr.bottom + 56, sc.scrollHeight - sc.clientHeight);
        sc.scrollTop = Math.min(sc.scrollTop + need, sc.scrollHeight - sc.clientHeight);
        scrolled = true;
      }
      if (lr.top < sr.top + 10) {
        const need = Math.min(sr.top - lr.top + 12, sc.scrollTop);
        sc.scrollTop = Math.max(0, sc.scrollTop - need);
        scrolled = true;
      }
    } catch (e) {}
  }
  try {
    dialog.scrollIntoView({ block: 'nearest' });
  } catch (e) {}
  const lr1 = listRoot.getBoundingClientRect();
  const partialVisible =
    lr1.bottom > 4 && lr1.top < vh - 4 && lr1.right > 4 && lr1.left < vw - 4;
  return {
    ok: true,
    layout: stacked ? 'stacked_below_calendar' : 'side_by_side',
    stacked,
    viewport: { w: vw, h: vh },
    calendarBottom: cr ? cr.bottom : null,
    listTop: lr1.top,
    listBottom: lr1.bottom,
    listHeight: lr1.height,
    scrolled,
    listPartiallyInViewport: partialVisible,
    liCount,
  };
}
"""
    )
)


async def _ensure_departure_list_visible(page: Page) -> dict[str, Any]:
    """좁은 화면에서 리스트가 달력 아래로 갈 때 뷰포트 안으로 스크롤 보정."""
    try:
        r = await page.evaluate(_ENSURE_LIST_VISIBLE_JS)
        return r if isinstance(r, dict) else {}
    except Exception:
        return {"ok": False, "reason": "eval_err"}


_COLLECT_ROWS_FULL_JS = _inject_list_li_query(
    _inject_dialog_selector(
        """
() => {
  const dialog = __hanatourPickDialog();
  const cal = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]');
  const listRootForRows = dialog.querySelector(
    '.prod_list_wrap, .sub_list_wrap, div.list_srchword_wrap.type.v2, .list_srchword_wrap, [class*="list_srchword"], [class*="sub_list_wrap"]'
  );
  function isScrollableY(el){
    try {
      const st = getComputedStyle(el);
      const oy = st.overflowY;
      if (!(oy==='auto'||oy==='scroll'||oy==='overlay')) return false;
      if (el.scrollHeight <= el.clientHeight+2) return false;
      const r = el.getBoundingClientRect();
      return r.width>32 && r.height>32;
    } catch(e){ return false; }
  }
  function findRightListScroller(){
    const listRoot = dialog.querySelector(
      '.prod_list_wrap, .sub_list_wrap, div.list_srchword_wrap.type.v2, .list_srchword_wrap, [class*="list_srchword"], [class*="sub_list_wrap"]'
    );
    if (!listRoot) return null;
    const seen = new Set();
    const q = [listRoot];
    while (q.length){
      const x = q.shift();
      if (!x || seen.has(x)) continue;
      seen.add(x);
      if (isScrollableY(x)) return x;
      for (const ch of x.children) q.push(ch);
    }
    let el = listRoot.parentElement;
    for (let i=0; i<44 && el; i++){
      if (isScrollableY(el)) return el;
      el = el.parentElement;
    }
    return null;
  }
  const seen = new Set();
  const out = [];
  function collectRowNodes(root, dlg, c){
    const acc = [];
    if (root) {
      const units = root.querySelectorAll(':scope > .cont_unit, .cont_unit');
      if (units && units.length) {
        for (const el of units) {
          if (c && c.contains(el)) continue;
          acc.push(el);
        }
        return acc;
      }
      for (const li of root.querySelectorAll(':scope li')) {
        if (c && c.contains(li)) continue;
        acc.push(li);
      }
      return acc;
    }
    for (const li of dlg.querySelectorAll(__LIST_LI__)) {
      if (c && c.contains(li)) continue;
      acc.push(li);
    }
    return acc;
  }
  function priceHintFrom(el){
    try {
      const pr = el.querySelector('.inr.right .price, .price_group .price');
      if (pr) return (pr.innerText||'').replace(/\\s+/g,' ').trim();
    } catch (e) {}
    return '';
  }
  function grab(){
    const nodes = collectRowNodes(listRootForRows, dialog, cal);
    for (const li of nodes){
      const tx = (li.innerText || '').replace(/\\s+/g,' ').trim();
      if (tx.length < 16) continue;
      if (/^(?:출발일|다른\\s*출발|상품\\s*안내|이용\\s*안내)/.test(tx.slice(0,40))) continue;
      const key = tx.slice(0, 4000);
      if (seen.has(key)) continue;
      seen.add(key);
      const ph = priceHintFrom(li);
      out.push({
        text: tx.slice(0, 5000),
        html: (li.outerHTML||'').slice(0, 1800),
        priceHint: ph || null,
      });
    }
  }
  grab();
  const sc = findRightListScroller();
  if (sc){
    const maxS = Math.max(0, sc.scrollHeight - sc.clientHeight);
    const step = Math.max(72, Math.floor(sc.clientHeight * 0.4));
    for (let top = 0; top <= maxS + step; top += step){
      sc.scrollTop = Math.min(top, maxS);
      grab();
    }
    if (maxS > 0){
      sc.scrollTop = maxS;
      grab();
    }
    sc.scrollTop = 0;
    grab();
  }
  return out;
}
"""
    )
)

# 우측 출발 리스트 스크롤(매칭 실패 시 재시도용)
_SCROLL_RIGHT_LIST_JS = _inject_dialog_selector("""
(arg) => {
  const mode = (arg && arg.mode) || 'delta';
  const delta = Math.max(0, parseInt(String((arg && arg.delta) != null ? arg.delta : 0), 10) || 0);
  const dialog = __hanatourPickDialog();
  const listRoot = dialog.querySelector(
    '.prod_list_wrap, .sub_list_wrap, div.list_srchword_wrap.type.v2, .list_srchword_wrap, [class*="list_srchword"], [class*="sub_list_wrap"]'
  );
  if (!listRoot) return { ok: false, reason: 'no_list_root' };
  function isScrollableY(el){
    try {
      const st = getComputedStyle(el);
      const oy = st.overflowY;
      if (!(oy==='auto'||oy==='scroll'||oy==='overlay')) return false;
      return el.scrollHeight > el.clientHeight + 4;
    } catch(e){ return false; }
  }
  let sc = null;
  for (let el = listRoot; el && el !== dialog; el = el.parentElement) {
    if (isScrollableY(el)) { sc = el; break; }
  }
  if (!sc) sc = listRoot;
  const maxS = Math.max(0, sc.scrollHeight - sc.clientHeight);
  let st0 = sc.scrollTop;
  if (mode === 'top') sc.scrollTop = 0;
  else if (mode === 'bottom') sc.scrollTop = maxS;
  else sc.scrollTop = Math.min(maxS, Math.max(0, sc.scrollTop + delta));
  return { ok: true, scrollTop: sc.scrollTop, maxS, prevTop: st0, mode };
}
""")


_MONTH_LABEL_JS = _inject_dialog_selector("""
() => {
  const dialog = __hanatourPickDialog();
  const el = dialog.querySelector('.calendar_title, .header p, .year_month, [class*="month"]');
  const t = el ? (el.innerText||'').trim() : '';
  const blob = (dialog.innerText||'').slice(0, 4000);
  let m = t.match(/(20\\d{2})\\s*년\\s*(\\d{1,2})\\s*월/);
  if (m) return { y: parseInt(m[1],10), month: parseInt(m[2],10), via:'label' };
  m = blob.match(/(20\\d{2})\\s*년\\s*(\\d{1,2})\\s*월/);
  if (m) return { y: parseInt(m[1],10), month: parseInt(m[2],10), via:'blob' };
  return { y:0, month:0, via:'none' };
}
""")

_CALENDAR_MONTH_HEADER_NAV_PROBE_JS = _inject_dialog_selector("""
() => {
  const dialog = __hanatourPickDialog();
  function findLabelEl() {
    const reExact = /^20\\d{2}\\s*년\\s*\\d{1,2}\\s*월$/;
    let best = null;
    let bestW = 1e9;
    for (const el of dialog.querySelectorAll('span, p, strong, div, h2, h3, button, a')) {
      const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
      if (!reExact.test(t)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < bestW) {
        bestW = r.width;
        best = el;
      }
    }
    if (best) return best;
    let best2 = null;
    let bestLen = 1e9;
    for (const el of dialog.querySelectorAll('p, span, div, h2, h3, strong')) {
      const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
      if (!/(20\\d{2})\\s*년\\s*(\\d{1,2})\\s*월/.test(t)) continue;
      if (t.length > 90) continue;
      if (t.length < bestLen) {
        bestLen = t.length;
        best2 = el;
      }
    }
    return best2 || dialog.querySelector('.calendar_title, .year_month, [class*="month"]');
  }
  function resolveClickable(el) {
    if (!el) return null;
    const tn = String(el.tagName || '').toUpperCase();
    if (tn === 'SVG' || tn === 'PATH') {
      return el.closest('button, a, [role="button"]') || el.parentElement;
    }
    return el;
  }
  function rectVisible(r) {
    return r && r.width > 2 && r.height > 2;
  }
  const labelEl = findLabelEl();
  if (!labelEl) {
    return { ok: false, reason: 'no_month_label' };
  }
  const lr = labelEl.getBoundingClientRect();
  const midY = lr.top + lr.height / 2;
  const leftProbes = [];
  const rightProbes = [];
  const nodes = dialog.querySelectorAll(
    'button, a, [role="button"], svg, span, i, [class*="btn"], [class*="arrow"]'
  );
  for (let el of nodes) {
    const targ = resolveClickable(el);
    if (!targ) continue;
    if (labelEl.contains(targ) || targ.contains(labelEl)) continue;
    const r = targ.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) continue;
    if (r.bottom < lr.top - 60 || r.top > lr.bottom + 60) continue;
    if (Math.abs(r.top + r.height / 2 - midY) > 56) continue;
    const cx = r.left + r.width / 2;
    const area = r.width * r.height;
    const tag = targ.tagName || '';
    const cls = String(targ.className || '').slice(0, 200);
    const box = {
      tag,
      cls,
      left: r.left,
      top: r.top,
      w: r.width,
      h: r.height,
      visible: rectVisible(r),
    };
    if (cx < lr.left - 2 && cx > lr.left - 72) {
      leftProbes.push({ ...box, dist: lr.left - cx, area });
    }
    if (cx > lr.right + 2 && cx < lr.right + 80) {
      rightProbes.push({ ...box, dist: cx - lr.right, area });
    }
  }
  function arrowScore(p) {
    const tag = (p.tag || '').toUpperCase();
    const cls = String(p.cls || '');
    if (/\\bcount\\b/i.test(cls) && p.w < 72) return 80;
    if (tag === 'BUTTON' || /btn|arrow|next|prev|month|cal/i.test(cls)) return 0;
    if (tag === 'A' || tag === 'I') return 2;
    if (tag === 'SPAN') return 6;
    return 10;
  }
  function pickArrow(list) {
    const small = list.filter((p) => p.w < 96 && p.h < 96);
    const use = small.length ? small : list;
    use.sort((a, b) => arrowScore(a) - arrowScore(b) || a.dist - b.dist || a.area - b.area);
    return use[0] || null;
  }
  const lp = pickArrow(leftProbes);
  const rp = pickArrow(rightProbes);
  const monthLabel = (labelEl.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
  const prevS = labelEl.previousElementSibling;
  const nextS = labelEl.nextElementSibling;
  return {
    ok: true,
    monthLabel,
    labelRect: {
      left: lr.left,
      top: lr.top,
      w: lr.width,
      h: lr.height,
      visible: rectVisible(lr),
    },
    siblingPrev: prevS
      ? {
          tag: prevS.tagName,
          cls: String(prevS.className || '').slice(0, 200),
        }
      : null,
    siblingNext: nextS
      ? {
          tag: nextS.tagName,
          cls: String(nextS.className || '').slice(0, 200),
        }
      : null,
    leftArrow: lp,
    rightArrow: rp,
    nLeft: leftProbes.length,
    nRight: rightProbes.length,
  };
}
""")

_CALENDAR_MONTH_HEADER_NAV_TARGET_JS = _inject_dialog_selector("""
(direction) => {
  const side = String(direction || 'next').toLowerCase();
  const wantNext = side === 'next' || side === 'right';
  const dialog = __hanatourPickDialog();
  function findLabelEl() {
    const reExact = /^20\\d{2}\\s*년\\s*\\d{1,2}\\s*월$/;
    let best = null;
    let bestW = 1e9;
    for (const el of dialog.querySelectorAll('span, p, strong, div, h2, h3, button, a')) {
      const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
      if (!reExact.test(t)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < bestW) {
        bestW = r.width;
        best = el;
      }
    }
    if (best) return best;
    let best2 = null;
    let bestLen = 1e9;
    for (const el of dialog.querySelectorAll('p, span, div, h2, h3, strong')) {
      const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
      if (!/(20\\d{2})\\s*년\\s*(\\d{1,2})\\s*월/.test(t)) continue;
      if (t.length > 90) continue;
      if (t.length < bestLen) {
        bestLen = t.length;
        best2 = el;
      }
    }
    return best2 || dialog.querySelector('.calendar_title, .year_month, [class*="month"]');
  }
  function resolveClickable(el) {
    if (!el) return null;
    const tn = String(el.tagName || '').toUpperCase();
    if (tn === 'SVG' || tn === 'PATH') {
      return el.closest('button, a, [role="button"]') || el.parentElement;
    }
    return el;
  }
  const labelEl = findLabelEl();
  if (!labelEl) return null;
  function pickSiblingArrow() {
    const sib = wantNext ? labelEl.nextElementSibling : labelEl.previousElementSibling;
    if (!sib) return null;
    const tn = String(sib.tagName || '').toUpperCase();
    if (tn === 'BUTTON' || tn === 'A' || sib.getAttribute('role') === 'button') return sib;
    const inner = sib.querySelector && sib.querySelector('button, a, [role="button"], svg');
    if (inner) {
      const hit = inner.closest && inner.closest('button, a, [role="button"]');
      return hit || inner;
    }
    const cls = String(sib.className || '');
    if (/arrow|btn|next|prev|month|cal/i.test(cls)) return sib;
    return null;
  }
  const sibPick = pickSiblingArrow();
  if (sibPick) return sibPick;
  function pickRowSiblingArrow() {
    const row = labelEl.parentElement;
    if (!row || !row.children) return null;
    const children = Array.from(row.children);
    const idx = children.indexOf(labelEl);
    if (idx < 0) return null;
    const sib = wantNext ? children[idx + 1] : children[idx - 1];
    if (!sib) return null;
    const tn = String(sib.tagName || '').toUpperCase();
    if (tn === 'BUTTON' || tn === 'A' || sib.getAttribute('role') === 'button') return sib;
    const inner = sib.querySelector && sib.querySelector('button, a, [role="button"], svg');
    if (inner) {
      const hit = inner.closest && inner.closest('button, a, [role="button"]');
      return hit || inner;
    }
    const cls = String(sib.className || '');
    if (/arrow|btn|next|prev|month|cal/i.test(cls)) return sib;
    return null;
  }
  const rowPick = pickRowSiblingArrow();
  if (rowPick) return rowPick;
  const lr = labelEl.getBoundingClientRect();
  const midY = lr.top + lr.height / 2;
  const leftProbes = [];
  const rightProbes = [];
  const nodes = dialog.querySelectorAll(
    'button, a, [role="button"], svg, span, i, [class*="btn"], [class*="arrow"]'
  );
  for (let el of nodes) {
    const targ = resolveClickable(el);
    if (!targ) continue;
    if (labelEl.contains(targ) || targ.contains(labelEl)) continue;
    const r = targ.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) continue;
    if (r.bottom < lr.top - 60 || r.top > lr.bottom + 60) continue;
    if (Math.abs(r.top + r.height / 2 - midY) > 56) continue;
    const cx = r.left + r.width / 2;
    const area = r.width * r.height;
    const tag = targ.tagName || '';
    const cls = String(targ.className || '').slice(0, 200);
    if (cx < lr.left - 2 && cx > lr.left - 72) {
      leftProbes.push({
        tag,
        cls,
        left: r.left,
        top: r.top,
        w: r.width,
        h: r.height,
        dist: lr.left - cx,
        area,
      });
    }
    if (cx > lr.right + 2 && cx < lr.right + 80) {
      rightProbes.push({
        tag,
        cls,
        left: r.left,
        top: r.top,
        w: r.width,
        h: r.height,
        dist: cx - lr.right,
        area,
      });
    }
  }
  function arrowScore(p) {
    const tag = (p.tag || '').toUpperCase();
    const cls = String(p.cls || '');
    if (/\\bcount\\b/i.test(cls) && p.w < 72) return 80;
    if (tag === 'BUTTON' || /btn|arrow|next|prev|month|cal/i.test(cls)) return 0;
    if (tag === 'A' || tag === 'I') return 2;
    if (tag === 'SPAN') return 6;
    return 10;
  }
  function pickArrow(list) {
    const small = list.filter((p) => p.w < 96 && p.h < 96);
    const use = small.length ? small : list;
    use.sort((a, b) => arrowScore(a) - arrowScore(b) || a.dist - b.dist || a.area - b.area);
    return use[0] || null;
  }
  const pickP = wantNext ? pickArrow(rightProbes) : pickArrow(leftProbes);
  if (!pickP) return null;
  const cx = pickP.left + pickP.w / 2;
  const cy = pickP.top + pickP.h / 2;
  let hit = document.elementFromPoint(cx, cy);
  if (!hit) return null;
  if (hit.nodeType === 3) hit = hit.parentElement;
  const btn = hit && hit.closest ? hit.closest('button, a, [role="button"]') : null;
  return btn || hit;
}
""")

_ENUM_DAYS_JS = _inject_dialog_selector("""
(args) => {
  const wy = args && args[0];
  const wm = args && args[1];
  const dialog = __hanatourPickDialog();
  const wrap = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]') || dialog;
  const grid = wrap.querySelector('.calendar_area') || wrap;
  const out = [];
  function isPricedDayLi(li) {
    const cls = li.className || '';
    if (!/\\blow\\b/i.test(cls)) return false;
    const s = (li.innerText||'').replace(/\\s+/g,' ').trim();
    if (!/^\\d{1,2}\\s+.+만\\s*최저가/i.test(s)) return false;
    return true;
  }
  for (const ul of grid.querySelectorAll('ul.day, ul[class*="day"]')){
    for (const li of ul.querySelectorAll(':scope > li')){
      const r = li.getBoundingClientRect();
      if (r.width * r.height < 40) continue;
      if (!isPricedDayLi(li)) continue;
      const s = (li.innerText||'').trim();
      const m = s.match(/^(\\d{1,2})\\b/);
      if (!m) continue;
      const dd = parseInt(m[1], 10);
      if (dd < 1 || dd > 31) continue;
      let dis = li.className && /off|disabled|block/i.test(li.className);
      if (li.getAttribute('aria-disabled') === 'true') dis = true;
      if (!dis && wy && wm)
        out.push({ day: dd, iso: wy + '-' + String(wm).padStart(2,'0') + '-' + String(dd).padStart(2,'0') });
    }
  }
  return out;
}
""")

_CALENDAR_SELECTED_ISO_JS = _inject_dialog_selector("""
() => {
  const dialog = __hanatourPickDialog();
  const wrap = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]') || dialog;
  const grid = wrap.querySelector('.calendar_area') || wrap;
  const el = dialog.querySelector('.calendar_title, .header p, .year_month, [class*="month"]');
  const t = el ? (el.innerText||'').trim() : '';
  const blob = (dialog.innerText||'').slice(0, 4000);
  let m = t.match(/(20\\d{2})\\s*년\\s*(\\d{1,2})\\s*월/);
  if (!m) m = blob.match(/(20\\d{2})\\s*년\\s*(\\d{1,2})\\s*월/);
  if (!m) return { ok: false, reason: 'no_month' };
  const wy = parseInt(m[1],10); const wm = parseInt(m[2],10);
  function isSel(li){
    const a = li.querySelector('a[href], a, button');
    const cls = (li.className||'') + ' ' + (a ? (a.className||'') : '');
    const aria = li.getAttribute('aria-selected');
    const aaria = a && a.getAttribute('aria-selected');
    if (li.querySelector('[aria-current="date"], [aria-current]')) return true;
    if (aria === 'true' || aaria === 'true') return true;
    // 하나투어: "sun select low" 등 class에 select 단독 포함 (selected 아님)
    if (/\\bselect\\b/i.test(cls)) return true;
    if (/(?:^|\\s)(on|selected|active|pick|choice|chk)(?:\\s|$)/i.test(cls)) return true;
    if (/(?:^|\\s)ui\\s*-on(?:\\s|$)/i.test(cls)) return true;
    if (/(?:^|\\s)ui\\s*-state\\s*-active(?:\\s|$)/i.test(cls)) return true;
    if (/(?:^|\\s)day\\s*_on(?:\\s|$)/i.test(cls)) return true;
    return false;
  }
  for (const ul of grid.querySelectorAll('ul.day, ul[class*="day"]')){
    for (const li of ul.querySelectorAll(':scope > li')){
      const r = li.getBoundingClientRect();
      if (r.width * r.height < 40) continue;
      const s = (li.innerText||'').trim();
      const dm = s.match(/^(\\d{1,2})\\b/);
      if (!dm) continue;
      const dd = parseInt(dm[1], 10);
      if (dd < 1 || dd > 31) continue;
      if (li.className && /off|disabled|block/i.test(li.className)) continue;
      if (li.getAttribute('aria-disabled') === 'true') continue;
      if (isSel(li)) {
        const iso = wy + '-' + String(wm).padStart(2,'0') + '-' + String(dd).padStart(2,'0');
        return { ok: true, iso, day: dd };
      }
    }
  }
  return { ok: false, reason: 'no_selected_day' };
}
""")


_CLICK_COMMIT_CALENDAR_DAY_JS = _inject_dialog_selector(r"""
async (args) => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const isoStr = String((args && args[0]) || '');
  const wyIn = parseInt(String((args && args[1]) || '0'), 10) || 0;
  const wmIn = parseInt(String((args && args[2]) || '0'), 10) || 0;
  function txt(el){ return (el && (el.innerText || el.textContent) || '').replace(/\s+/g,' ').trim(); }
  function dayNum(li){
    const s = txt(li);
    const m = s.match(/^(\d{1,2})\b/);
    return m ? parseInt(m[1],10) : 0;
  }
  const parts = isoStr.split('-');
  const d = parseInt(parts[2]||'0',10);
  if (!d) return { ok:false, reason:'bad_iso', timings:{} };
  const t0 = performance.now();
  const timings = {
    candidate_scan_ms: 0,
    candidate_rank_ms: 0,
    first_click_ms: 0,
    retry_click_ms: 0,
    verify_selected_ms: 0,
  };
  const tScan0 = performance.now();
  const dialog = __hanatourPickDialog();
  const wrap = dialog.querySelector('.calendar_wrap, [class*="calendar_wrap"]') || dialog;
  const calArea = wrap.querySelector('.calendar_area') || wrap;
  const grid = calArea;
  let wy = wyIn;
  let wm = wmIn;
  if (!wy || !wm) {
    const el = dialog.querySelector('.calendar_title, .header p, .year_month, [class*="month"]');
    const t = el ? (el.innerText||'').trim() : '';
    const blob = (dialog.innerText||'').slice(0, 4000);
    let m = t.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월/);
    if (!m) m = blob.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월/);
    if (!m) return { ok:false, reason:'no_month', timings };
    wy = parseInt(m[1],10); wm = parseInt(m[2],10);
  }
  const targetIso = wy + '-' + String(wm).padStart(2,'0') + '-' + String(d).padStart(2,'0');
  function isSel(li){
    const a = li.querySelector('a[href], a, button');
    const cls = (li.className||'') + ' ' + (a ? (a.className||'') : '');
    const aria = li.getAttribute('aria-selected');
    const aaria = a && a.getAttribute('aria-selected');
    if (li.querySelector('[aria-current="date"], [aria-current]')) return true;
    if (aria === 'true' || aaria === 'true') return true;
    if (/\bselect\b/i.test(cls)) return true;
    if (/(?:^|\s)(on|selected|active|pick|choice|chk)(?:\s|$)/i.test(cls)) return true;
    if (/(?:^|\s)ui\s*-on(?:\s|$)/i.test(cls)) return true;
    if (/(?:^|\s)ui\s*-state\s*-active(?:\s|$)/i.test(cls)) return true;
    if (/(?:^|\s)day\s*_on(?:\s|$)/i.test(cls)) return true;
    return false;
  }
  function getSelectedTargetDayIso() {
    for (const ul of grid.querySelectorAll('ul.day, ul[class*="day"]')){
      for (const li of ul.querySelectorAll(':scope > li')){
        const r = li.getBoundingClientRect();
        if (r.width * r.height < 40) continue;
        const s = (li.innerText||'').trim();
        const dm = s.match(/^(\d{1,2})\b/);
        if (!dm) continue;
        const dd = parseInt(dm[1], 10);
        if (dd !== d) continue;
        if (dd < 1 || dd > 31) continue;
        if (li.className && /off|disabled|block/i.test(li.className)) continue;
        if (li.getAttribute('aria-disabled') === 'true') continue;
        if (isSel(li)) {
          const isoOut = wy + '-' + String(wm).padStart(2,'0') + '-' + String(dd).padStart(2,'0');
          return { ok: true, iso: isoOut, day: dd };
        }
      }
    }
    return { ok:false, reason:'no_selected_day' };
  }
  function verifyClickedLi(li) {
    if (!isSel(li)) return { ok: false };
    const s = (li.innerText||'').trim();
    const dm = s.match(/^(\d{1,2})\b/);
    if (!dm) return { ok: false };
    const dd = parseInt(dm[1], 10);
    if (dd !== d) return { ok: false };
    const isoOut = wy + '-' + String(wm).padStart(2,'0') + '-' + String(dd).padStart(2,'0');
    return { ok: isoOut === targetIso, iso: isoOut };
  }
  function isPaddingLi(li) {
    const c = (li.className||'') + '';
    if (/\bbefore\b/i.test(c) && d >= 8) return true;
    return false;
  }
  function pricedLowCell(li){
    const cls = li.className || '';
    if (!/\blow\b/i.test(cls)) return false;
    const s = txt(li);
    return /^\d{1,2}\s+.+만\s*최저가/i.test(s);
  }
  function area(el){
    try { const r = el.getBoundingClientRect(); return r.width * r.height; } catch(e){ return 0; }
  }
  function inCalViewport(li) {
    try {
      const cr = calArea.getBoundingClientRect();
      const r = li.getBoundingClientRect();
      const ih = Math.min(r.bottom, cr.bottom) - Math.max(r.top, cr.top);
      const iw = Math.min(r.right, cr.right) - Math.max(r.left, cr.left);
      return ih > 10 && iw > 10;
    } catch(e){ return false; }
  }
  function clickTarget(li){
    const a = li.querySelector('a[href], a');
    const btn = li.querySelector('button');
    if (a && area(a) > 4) return a;
    if (btn && area(btn) > 4) return btn;
    return li;
  }
  function firePointerClick(el, li){
    try { if (el && el.focus) el.focus(); } catch(e){}
    try {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (const type of ['mousedown','mouseup','click']){
        try {
          el.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0
          }));
        } catch(e){}
      }
      return true;
    } catch(e) {}
    try {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const seq = ['pointerdown','pointerup','mousedown','mouseup','click'];
      for (let i = 0; i < seq.length; i++){
        try {
          el.dispatchEvent(new MouseEvent(seq[i], {
            bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0
          }));
        } catch(e){}
      }
      if (typeof el.click === 'function') el.click();
      return true;
    } catch(e) {
      try { if (typeof el.click === 'function') el.click(); return true; } catch(e2) {}
      try { li.click(); return true; } catch(e3) { return false; }
    }
  }
  const raw = [];
  for (const ul of calArea.querySelectorAll('ul.day, ul[class*="day"]')){
    for (const li of ul.querySelectorAll(':scope > li')){
      if (dayNum(li) !== d) continue;
      const ar = area(li);
      if (ar < 40) continue;
      if (li.className && /off|disabled|block/i.test(li.className)) continue;
      if (li.getAttribute('aria-disabled') === 'true') continue;
      raw.push({ li, ar, pad: isPaddingLi(li), vis: inCalViewport(li) });
    }
  }
  const rawLow = raw.filter((x) => pricedLowCell(x.li));
  const rawUse = rawLow.length ? rawLow : raw;
  timings.candidate_scan_ms = performance.now() - tScan0;
  let cands = rawUse.filter((x) => x.vis);
  if (cands.length < 1) cands = rawUse.slice();
  const tRank0 = performance.now();
  cands.sort((a,b) => {
    if (a.pad !== b.pad) return a.pad ? 1 : -1;
    if (a.vis !== b.vis) return a.vis ? -1 : 1;
    return b.ar - a.ar;
  });
  timings.candidate_rank_ms = performance.now() - tRank0;
  let lastIso = null;
  let commitPath = 'none';
  function refreshBestLi() {
    const raw2 = [];
    for (const ul of calArea.querySelectorAll('ul.day, ul[class*="day"]')){
      for (const li of ul.querySelectorAll(':scope > li')){
        if (dayNum(li) !== d) continue;
        const ar = area(li);
        if (ar < 40) continue;
        if (li.className && /off|disabled|block/i.test(li.className)) continue;
        if (li.getAttribute('aria-disabled') === 'true') continue;
        raw2.push({ li, ar, pad: isPaddingLi(li), vis: inCalViewport(li) });
      }
    }
    const raw2Low = raw2.filter((x) => pricedLowCell(x.li));
    const raw2u = raw2Low.length ? raw2Low : raw2;
    let c2 = raw2u.filter((x) => x.vis);
    if (c2.length < 1) c2 = raw2u.slice();
    c2.sort((a,b) => {
      if (a.pad !== b.pad) return a.pad ? 1 : -1;
      if (a.vis !== b.vis) return a.vis ? -1 : 1;
      return b.ar - a.ar;
    });
    return c2.length ? c2[0].li : null;
  }
  async function tryOne(li0, idx, isFirst, preMs, postMsMax) {
    const tClick0 = performance.now();
    try { li0.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch(e){}
    await delay(preMs);
    const tgt = clickTarget(li0);
    if (!firePointerClick(tgt, li0)) return false;
    const tMid = performance.now();
    if (isFirst) timings.first_click_ms += tMid - tClick0;
    else timings.retry_click_ms += tMid - tClick0;
    const tVer0 = performance.now();
    const deadline = performance.now() + postMsMax;
    let iter = 0;
    while (performance.now() < deadline) {
      const q = verifyClickedLi(li0);
      if (q && q.ok) {
        lastIso = q.iso;
        timings.verify_selected_ms += performance.now() - tVer0;
        return true;
      }
      if (iter >= 2) {
        const sel = getSelectedTargetDayIso();
        if (sel && sel.ok && sel.iso === targetIso) {
          lastIso = sel.iso;
          timings.verify_selected_ms += performance.now() - tVer0;
          return true;
        }
      }
      iter++;
      await delay(16);
    }
    const sel = getSelectedTargetDayIso();
    timings.verify_selected_ms += performance.now() - tVer0;
    if (sel && sel.ok && sel.iso === targetIso) {
      lastIso = sel.iso;
      return true;
    }
    if (sel && sel.ok) lastIso = sel.iso;
    return false;
  }
  if (cands.length >= 1) {
    const ok1 = await tryOne(cands[0].li, 0, true, 18, 300);
    if (ok1) {
      commitPath = 'commit_fast';
      timings.total_ms = performance.now() - t0;
      return { ok: true, selectedIsoAfter: lastIso, idx: 0, method: 'commit_js', commitPath, timings };
    }
    const liRetry = refreshBestLi() || cands[0].li;
    const ok1b = await tryOne(liRetry, 0, true, 22, 360);
    if (ok1b) {
      commitPath = 'commit_fast_retry';
      timings.total_ms = performance.now() - t0;
      return { ok: true, selectedIsoAfter: lastIso, idx: 0, method: 'commit_js', commitPath, timings };
    }
  }
  const maxSlow = Math.min(cands.length, 6);
  for (let i = 1; i < maxSlow; i++) {
    const ok2 = await tryOne(cands[i].li, i, false, 34, 380);
    if (ok2) {
      commitPath = 'commit_slow';
      timings.total_ms = performance.now() - t0;
      return { ok: true, selectedIsoAfter: lastIso, idx: i, method: 'commit_js', commitPath, timings };
    }
  }
  timings.total_ms = performance.now() - t0;
  return { ok: false, reason: 'selection_not_committed', tried: cands.length, lastIso, timings };
}
""")


def _hint_departure_isos_for_month(raw_title: str, wy: int, wm: int) -> list[str]:
    """본문의 'MM/DD (요일)' 패턴 → 현재 달력 월(wy-wm)과 맞는 ISO 우선 클릭용."""
    t = (raw_title or "").replace("\u00a0", " ")
    out: list[str] = []
    for m in re.finditer(r"\b(\d{1,2})/(\d{1,2})\s*\(", t):
        try:
            mm = int(m.group(1))
            dd = int(m.group(2))
        except ValueError:
            continue
        if mm != wm or dd < 1 or dd > 31:
            continue
        iso = f"{wy}-{wm:02d}-{dd:02d}"
        if iso not in out:
            out.append(iso)
    return out


def _sort_day_slots_by_hints(slots: list[dict[str, Any]], hints: list[str]) -> list[dict[str, Any]]:
    if not hints or not slots:
        return slots
    hint_set = set(hints)

    def key(s: dict[str, Any]) -> tuple[int, int, str]:
        iiso = str((s or {}).get("iso") or "")
        if iiso in hint_set:
            try:
                return (0, hints.index(iiso), iiso)
            except ValueError:
                return (0, 0, iiso)
        return (1, 0, iiso)

    return sorted(slots, key=key)


def _selection_commit_ok(
    iso_label: str,
    sel_after: Any,
    before_selected_iso: str | None,
    h: str,
    before_hash: str,
) -> bool:
    """리스트 해시 변경 또는 달력에 클릭한 일자가 선택된 상태로 반영되면 참."""
    if h and h != before_hash:
        return True
    iso = (iso_label or "").strip()
    if not iso:
        return False
    sel_iso = str((sel_after or {}).get("iso") or "").strip()
    if sel_iso != iso:
        return False
    b = (before_selected_iso or "").strip()
    if not b:
        return bool(isinstance(sel_after, dict) and sel_after.get("ok"))
    if b != iso:
        return True
    # 클릭 전·후 모두 동일 일자(모달 기본일=클릭일): 해시/프로브 없이 통과는 스모크 전용 옵션
    return bool(getattr(config, "ALLOW_SAME_DAY_SELECTION_COMMIT", 0) > 0)


def _parse_row_times_and_airline(text: str) -> dict[str, Any]:
    t = " ".join(text.replace("\u00a0", " ").split())
    out: dict[str, Any] = {
        "candidateOutboundDepartureAt": None,
        "candidateInboundArrivalAt": None,
        "candidateAirlineName": None,
        "statusRaw": None,
    }
    times = re.findall(r"\b(\d{1,2})\s*:\s*(\d{2})\b", t)
    if len(times) >= 2:
        out["candidateOutboundDepartureAt"] = f"{int(times[0][0]):02d}:{times[0][1]}"
        out["candidateInboundArrivalAt"] = f"{int(times[1][0]):02d}:{times[1][1]}"
    elif len(times) == 1:
        out["candidateOutboundDepartureAt"] = f"{int(times[0][0]):02d}:{times[0][1]}"
    for tok in (
        "대한항공",
        "아시아나항공",
        "진에어",
        "제주항공",
        "티웨이항공",
        "에어부산",
        "이스타항공",
    ):
        if tok in t:
            out["candidateAirlineName"] = fix_airline_name_str(tok)
            break
    else:
        am = re.search(
            r"([가-힣a-zA-Z0-9·&\s]{0,40}(?:항공|에어웨이|에어)(?!\s*성급))",
            t,
        )
        if am:
            out["candidateAirlineName"] = fix_airline_name_str(am.group(1).strip()[:120])
    status_bits: list[str] = []
    if re.search(r"예약\s*가능|예약가능", t):
        status_bits.append("예약가능")
    if re.search(r"예약\s*마감|마감", t):
        status_bits.append("예약마감")
    if re.search(r"출발\s*확정|출발확정", t):
        status_bits.append("출발확정")
    if re.search(r"대기\s*예약|대기예약", t):
        status_bits.append("대기예약")
    if re.search(r"잔여", t):
        status_bits.append("잔여")
    if status_bits:
        out["statusRaw"] = "|".join(dict.fromkeys(status_bits))
    else:
        for kw in ("예약", "마감", "대기", "출발확정", "잔여"):
            if kw in t:
                out["statusRaw"] = kw
                break
    price_m = re.search(r"(\d{1,3}(?:,\d{3})+)\s*원", t)
    if not price_m:
        price_m = re.search(r"(\d{1,3}(?:,\d{3})+)", t)
    pr = clean_price_to_int(price_m.group(1)) if price_m else 0
    out["candidatePrice"] = pr if pr else None
    out["candidatePriceRawText"] = price_m.group(0) if price_m else None
    return out


def _calendar_selection_signature(cal: Any) -> tuple[Any, ...]:
    if not isinstance(cal, dict) or not cal.get("ok"):
        return ()
    return (
        str(cal.get("liAria") or ""),
        str(cal.get("aAria") or ""),
        str(cal.get("liClass") or "")[:200],
        str(cal.get("aClass") or "")[:200],
        str(cal.get("liAriaCurrent") or ""),
        str(cal.get("aAriaCurrent") or ""),
        str(cal.get("liDataAttrsJson") or ""),
        str(cal.get("aDataAttrsJson") or ""),
    )


def _calendar_probe_fingerprint(cal: dict[str, Any]) -> str:
    if not isinstance(cal, dict) or not cal.get("ok"):
        return ""
    parts = [
        str(cal.get("liClass") or ""),
        str(cal.get("liAria") or ""),
        str(cal.get("aClass") or ""),
        str(cal.get("aAria") or ""),
        str(cal.get("liAriaCurrent") or ""),
        str(cal.get("aAriaCurrent") or ""),
        str(cal.get("liDataAttrsJson") or ""),
        str(cal.get("aDataAttrsJson") or ""),
    ]
    return "|".join(parts)


def _row_probe_refresh_key(row: dict[str, Any]) -> str:
    """동일 row 슬롯에서 날짜 전환·가격·시간·상태·항공 변화 감지용 핑거프린트."""
    t = str(row.get("fullText") or "")
    m = _parse_row_times_and_airline(t)
    pr = m.get("candidatePrice")
    dates = ",".join(row.get("dateSlashTokens") or [])
    st = str(m.get("statusRaw") or "")
    air = str(m.get("candidateAirlineName") or "")
    ob = str(m.get("candidateOutboundDepartureAt") or "")
    ib = str(m.get("candidateInboundArrivalAt") or "")
    return "|".join(
        [
            str(pr),
            ob,
            ib,
            air,
            st,
            dates,
            str(row.get("className") or "")[:120],
            str(row.get("liAriaCurrent") or ""),
            str(row.get("liAriaSelected") or ""),
            str(row.get("liDataAttrsJson") or "")[:400],
            str(row.get("cardDataAttrsJson") or "")[:400],
        ]
    )


def _probe_refresh_committed(
    before_cal: dict[str, Any],
    after_cal: dict[str, Any],
    before_rows: list[dict[str, Any]],
    after_rows: list[dict[str, Any]],
) -> tuple[bool, str]:
    """달력 셀 FP 변화 또는 상위 3행 키(날짜/가격/시간/상태/항공/dataset·aria) 변화로 전환 증명."""
    if isinstance(after_cal, dict) and after_cal.get("ok"):
        if _calendar_probe_fingerprint(before_cal) != _calendar_probe_fingerprint(after_cal):
            return True, "calendar_cell_probe"
    n = min(3, len(before_rows), len(after_rows))
    for i in range(n):
        if _row_probe_refresh_key(before_rows[i]) != _row_probe_refresh_key(after_rows[i]):
            return True, f"row_probe_{i}"
    return False, ""


def _e2e_probe_log_snapshot(tag: str, iso: str, cal: Any, list_probe: Any) -> None:
    if not getattr(config, "PROBE_LOG", False):
        return
    try:
        rows = (list_probe or {}).get("rows") or []
        sys.stderr.write(f"[HANATOUR_E2E_PROBE] {tag} iso={iso}\n")
        if isinstance(cal, dict) and cal.get("ok"):
            sys.stderr.write(
                f"  calendar: liClass={str(cal.get('liClass') or '')[:120]!r} "
                f"liAriaSel={cal.get('liAria')!r} aAriaSel={cal.get('aAria')!r} "
                f"liAriaCur={cal.get('liAriaCurrent')!r} aAriaCur={cal.get('aAriaCurrent')!r}\n"
            )
            sys.stderr.write(f"  liDataAttrs={str(cal.get('liDataAttrsJson') or '')[:200]}\n")
            sys.stderr.write(f"  aDataAttrs={str(cal.get('aDataAttrsJson') or '')[:200]}\n")
        for i, r in enumerate(rows[:3]):
            m = _parse_row_times_and_airline(str(r.get("fullText") or ""))
            sys.stderr.write(
                f"  row[{i}] title={str(r.get('titleLine') or '')[:100]!r} "
                f"dates={r.get('dateSlashTokens')} price={m.get('candidatePrice')} "
                f"air={m.get('candidateAirlineName')!r} ob={m.get('candidateOutboundDepartureAt')!r} "
                f"ib={m.get('candidateInboundArrivalAt')!r} status={m.get('statusRaw')!r}\n"
            )
            sys.stderr.write(
                f"    class={str(r.get('className') or '')[:100]!r} "
                f"ariaCur={r.get('liAriaCurrent')!r} ariaSel={r.get('liAriaSelected')!r}\n"
            )
        sys.stderr.flush()
    except Exception:
        pass


_NON_TITLE_LINE_RE = re.compile(
    r"^(?:"
    r"\d{1,2}/\d{1,2}"  # 04/28 날짜
    r"|\d{4}-\d{2}-\d{2}"  # ISO 날짜
    r"|[가-힣a-zA-Z]{2,10}항공"  # 에어부산, 대한항공 등
    r"|[가-힣a-zA-Z]{1,8}에어"  # 에어서울 등
    r"|잔여\s*\d"  # 잔여 20석
    r"|[\d,]+\s*원"  # 999,900원
    r"|\d{1,2}:\d{2}"  # 09:40
    r")"
)


def _find_title_line(lines: list[str]) -> str | None:
    """항공사·날짜·가격 줄을 건너뛰고 상품명 줄을 반환."""
    for ln in lines:
        if not _NON_TITLE_LINE_RE.match(ln):
            return ln
    return None


def _row_to_candidate(raw: dict[str, str]) -> dict[str, Any]:
    text = raw.get("text") or ""
    price_hint = str(raw.get("priceHint") or "").strip()
    parse_blob = text if not price_hint else f"{text}\n{price_hint}"
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    title_line = _find_title_line(lines) or (lines[0] if lines else text[:200])
    layers = hanatour_title_layers(title_line)
    merged = _parse_row_times_and_airline(parse_blob)
    return {
        "candidateRawTitle": title_line,
        "candidatePreHashTitle": layers.get("preHashTitle"),
        "candidateComparisonTitle": layers.get("comparisonTitle"),
        "candidateComparisonTitleNoSpace": layers.get("comparisonTitleNoSpace"),
        "candidateVariantLabelKey": layers.get("variantLabelKey"),
        "rowText": text[:4000],
        **merged,
    }


def _sample_titles_for_notes(cands: list[dict[str, Any]], limit: int = 4) -> str:
    parts: list[str] = []
    for c in cands[:limit]:
        t = (c.get("candidateRawTitle") or "").strip()
        if t:
            parts.append(t[:160])
    return " | ".join(parts)


def _departure_row_complete(best: dict[str, Any]) -> tuple[bool, list[str]]:
    """가격·항공·구간 시간 수집 여부(완전성 검증)."""
    miss: list[str] = []
    pr = best.get("candidatePrice")
    if pr is None or (isinstance(pr, int) and pr <= 0):
        miss.append("adultPrice")
    if not str(best.get("candidateAirlineName") or "").strip():
        miss.append("airlineName")
    ob = best.get("candidateOutboundDepartureAt") or best.get("outboundAt")
    ib = best.get("candidateInboundArrivalAt") or best.get("inboundAt")
    if not str(ob or "").strip():
        miss.append("outboundAt")
    if not str(ib or "").strip():
        miss.append("inboundAt")
    return len(miss) == 0, miss


def _finalize_hanatour_e2e_validation_log(
    log: dict[str, Any],
    departures: list[dict[str, Any]],
    detail_url: str,
    collector_status: str | None,
) -> None:
    counts: dict[str, int] = {"verified_success": 0, "partial_success": 0, "fail": 0}
    summaries: list[dict[str, Any]] = []
    for d in departures:
        tier = str(d.get("verificationTier") or "")
        if tier in counts:
            counts[tier] += 1
        fc = d.get("fieldConfidence") if isinstance(d.get("fieldConfidence"), dict) else {}
        summaries.append(
            {
                "departureDate": d.get("departureDate"),
                "verificationTier": tier,
                "partialSuccessReason": d.get("partialSuccessReason"),
                "fieldLevels": {
                    k: ((fc.get(k) or {}) if isinstance(fc.get(k), dict) else {}).get("level")
                    for k in ("price", "airline", "time", "status")
                },
            }
        )
    st = str(collector_status or "")
    if not departures and st in ("modal_empty", "modal_failed", ""):
        counts["fail"] = max(1, counts["fail"])
    tiers_only = [str(d.get("verificationTier") or "") for d in departures]
    if not departures:
        run_outcome = "fail"
    elif tiers_only and all(t == "verified_success" for t in tiers_only):
        run_outcome = "verified_success"
    else:
        run_outcome = "partial_success"
    log["e2e_validation"] = {
        "detailUrl": detail_url,
        "departureSummaries": summaries,
        "countsByTier": counts,
        "runOutcome": run_outcome,
    }


async def _collect_rows_match_same_product(
    page: Page,
    raw_title: str,
    iso: str,
    notes: list[str],
    *,
    deadline: float | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None, int, list[dict[str, Any]]]:
    """우측 리스트에서 동일 상품명 row — 스크롤 보정 후 재수집."""
    last_cands: list[dict[str, Any]] = []
    _admin_sess = (os.environ.get("HANATOUR_E2E_ADMIN_MONTH_SESSION") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    _max_attempts = 2 if _admin_sess else 5
    for attempt in range(1, _max_attempts + 1):
        if deadline is not None and _time.perf_counter() >= deadline:
            notes.append(f"same_product_deadline:{iso}")
            return [], None, attempt, last_cands
        await _ensure_departure_list_visible(page)
        if attempt == 1:
            await asyncio.sleep(0.06)
        elif attempt > 1:
            await asyncio.sleep(0.25)
            if attempt == 2:
                await page.evaluate(_SCROLL_RIGHT_LIST_JS, {"mode": "top", "delta": 0})
            elif attempt == 3:
                await page.evaluate(_SCROLL_RIGHT_LIST_JS, {"mode": "delta", "delta": 240})
            else:
                await page.evaluate(_SCROLL_RIGHT_LIST_JS, {"mode": "bottom", "delta": 0})
            await asyncio.sleep(0.42)
        rows_raw = await page.evaluate(_COLLECT_ROWS_FULL_JS)
        if not isinstance(rows_raw, list):
            rows_raw = []
        cands = [_row_to_candidate(r) for r in rows_raw]
        last_cands = cands
        same = filter_hanatour_same_product_rows(cands, raw_title)
        if same:
            if attempt > 1:
                notes.append(f"same_product_matched_after_list_scroll:{iso}:attempt={attempt}")
            return same, same[0], attempt, cands
    return [], None, _max_attempts, last_cands


async def _wait_modal_layer_visible(page: Page, timeout_ms: int | None = None) -> bool:
    ms = timeout_ms if timeout_ms is not None else config.MODAL_WAIT_MS
    deadline = _time.monotonic() + ms / 1000.0
    while _time.monotonic() < deadline:
        for sel in config.DIALOG_SELECTOR_PARTS:
            try:
                loc = page.locator(sel.strip())
                n = await loc.count()
                for i in range(min(n, 20)):
                    el = loc.nth(i)
                    if await el.is_visible():
                        return True
            except Exception:
                continue
        await asyncio.sleep(0.2)
    return False


async def _wait_list_change(
    page: Page,
    before_hash: str,
    timeout_ms: int,
    *,
    before_row_count: int | None = None,
    iso_label: str = "",
    before_selected_iso: str | None = None,
    before_first_row_text: str | None = None,
    before_cal_probe: dict[str, Any] | None = None,
    before_list_probe: dict[str, Any] | None = None,
) -> tuple[bool, str, str]:
    """리스트 해시·첫 행·달력 셀 프로브·상위 3행 키 필드 변화까지 대기 → (ok, hash, refresh_proof_reason)."""
    t_loop0 = _time.perf_counter()
    deadline = t_loop0 + timeout_ms / 1000.0
    fast_until = t_loop0 + getattr(config, "LIST_FAST_PHASE_MS", 2800) / 1000.0
    poll_n = 0
    rc = 0
    label = f" iso={iso_label}" if iso_label else ""
    brc = before_row_count
    bfrow = (before_first_row_text or "").strip()
    bcal = before_cal_probe if isinstance(before_cal_probe, dict) else {}
    blpr = before_list_probe if isinstance(before_list_probe, dict) else {}
    br_before = list((blpr or {}).get("rows") or [])
    heavy_every = max(1, int(getattr(config, "LIST_WAIT_HEAVY_PROBE_EVERY", 2) or 2))
    if _e2e_progress_enabled():
        _e2e_progress(
            f"list_wait start{label} before_hash={before_hash[:32] if before_hash else 'empty'}..."
            f" before_rowCount={brc!r} before_sel_iso={before_selected_iso!r} "
            f"before_first_row_len={len(bfrow)} probe_rows={len(br_before)} timeout_ms={timeout_ms}"
        )
    while _time.monotonic() < deadline:
        if poll_n > 0:
            now = _time.monotonic()
            poll_ms = (
                getattr(config, "LIST_POLL_FAST_MS", 45)
                if now < fast_until
                else config.LIST_POLL_MS
            )
            await asyncio.sleep(poll_ms / 1000.0)
        poll_n += 1
        cur = await page.evaluate(_LIST_SNAPSHOT_JS)
        h = str((cur or {}).get("hash") or "")
        rc = int((cur or {}).get("rowCount") or 0)
        sel_after: dict[str, Any] = {}
        try:
            r = await page.evaluate(_CALENDAR_SELECTED_ISO_JS)
            sel_after = r if isinstance(r, dict) else {}
        except Exception:
            sel_after = {}
        row_text_changed = False
        if bfrow:
            try:
                fr = await page.evaluate(_LIST_FIRST_DEPARTURE_ROW_SNAPSHOT_JS)
                ft = (
                    str((fr or {}).get("text") or "").strip()
                    if isinstance(fr, dict) and (fr or {}).get("ok")
                    else ""
                )
                if ft and ft != bfrow:
                    row_text_changed = True
            except Exception:
                pass
        proof_ok = False
        proof_reason = ""
        if iso_label and (poll_n % heavy_every == 0 or poll_n <= 2):
            try:
                acal = await page.evaluate(_CALENDAR_DAY_STATE_JS, iso_label)
                alist = await page.evaluate(_LIST_TOP_DEPARTURE_ROWS_PROBE_JS)
                acal = acal if isinstance(acal, dict) else {}
                alist = alist if isinstance(alist, dict) else {}
                ara = list((alist or {}).get("rows") or [])
                proof_ok, proof_reason = _probe_refresh_committed(
                    bcal, acal, br_before, ara
                )
            except Exception:
                pass
        sel_ok = _selection_commit_ok(
            iso_label, sel_after, before_selected_iso, h, before_hash
        )
        committed = sel_ok or row_text_changed or proof_ok
        if poll_n % 10 == 0 and (_e2e_progress_enabled() or _e2e_debug_enabled()):
            _e2e_progress(
                f"list_wait polling{label} poll={poll_n} rightListChanged_pending={not committed} "
                f"sel_iso={str(sel_after.get('iso') or '')!r} row_txt={row_text_changed} "
                f"probe={proof_ok}:{proof_reason} "
                f"cur_hash={h[:36] if h else 'empty'}... cur_rowCount={rc}"
            )
        if committed:
            if proof_ok and proof_reason:
                fr = proof_reason
            elif row_text_changed:
                fr = "first_row_text"
            elif h and h != before_hash:
                fr = "list_hash"
            elif sel_ok:
                bs = (before_selected_iso or "").strip()
                il = (iso_label or "").strip()
                fr = "selection_same_iso" if bs and il and bs == il else "selection_commit"
            else:
                fr = "unknown"
            _e2e_progress(
                f"list_wait OK{label} rightListChanged=True reason={fr} "
                f"hash_changed={h != before_hash} row_first_changed={row_text_changed} "
                f"probe={proof_reason} sel_iso={str(sel_after.get('iso') or '')!r} "
                f"new_hash={h[:40]}..."
            )
            return True, h, fr
    _e2e_progress(
        f"list_wait TIMEOUT after {timeout_ms}ms{label} rightListChanged=False "
        f"(last poll rowCount={rc}, hash unchanged vs before)"
    )
    return False, before_hash, ""


async def _nudge_right_list_after_same_day(page: Page) -> str:
    """동일 날짜 클릭 직후 우측 리스트 스크롤로 갱신·레이아웃을 안정화한다."""
    await _ensure_departure_list_visible(page)
    await page.evaluate(_SCROLL_RIGHT_LIST_JS, {"mode": "bottom", "delta": 0})
    await asyncio.sleep(0.16)
    await page.evaluate(_SCROLL_RIGHT_LIST_JS, {"mode": "top", "delta": 0})
    await asyncio.sleep(0.14)
    await page.evaluate(_SCROLL_RIGHT_LIST_JS, {"mode": "delta", "delta": 280})
    await human_delay(0.2, 0.42)
    await _ensure_departure_list_visible(page)
    snap = await page.evaluate(_LIST_SNAPSHOT_JS) or {}
    return str(snap.get("hash") or "")


async def _force_right_list_refresh_aggressive(page: Page) -> None:
    """1·2차 list_wait 실패 후: bottom → top → delta(±) → bottom → top 을 반복해 가상 스크롤·DOM 갱신을 유도한다."""
    await _ensure_departure_list_visible(page)
    seq = (
        ("bottom", 0),
        ("top", 0),
        ("delta", 400),
        ("delta", -280),
        ("bottom", 0),
        ("top", 0),
    )
    for _ in range(2):
        for mode, delta in seq:
            try:
                await page.evaluate(_SCROLL_RIGHT_LIST_JS, {"mode": mode, "delta": delta})
            except Exception:
                pass
            await asyncio.sleep(0.1)
    await human_delay(0.22, 0.45)
    await _ensure_departure_list_visible(page)


async def _open_modal(page: Page) -> bool:
    """최우선: 「다른 출발일 보기」 (버튼/링크 + 접근 가능 이름)."""
    _e2e_progress("open_modal: trying CTA (다른 출발일 보기 등)")

    async def _try_open_from_locator(loc: Locator) -> bool:
        try:
            if await loc.count() == 0:
                return False
            target = loc.first
            try:
                if not await target.is_visible():
                    await target.scroll_into_view_if_needed(timeout=5000)
            except Exception:
                pass
            await human_delay(0.12, 0.28)
            await target.click(timeout=15000)
            await human_delay(0.45, 0.95)
            return await _wait_modal_layer_visible(page)
        except Exception:
            return False

    primary_patterns = (
        re.compile(r"^\s*다른\s*출발일\s*보기\s*$"),
        re.compile(r"다른\s*출발일\s*보기"),
    )
    for rx in primary_patterns:
        for role in ("button", "link"):
            try:
                loc = page.get_by_role(role, name=rx)
                if await _try_open_from_locator(loc):
                    return True
            except Exception:
                continue

    for sel in config.OPEN_MODAL_TRIGGERS:
        try:
            if await _try_open_from_locator(page.locator(sel)):
                return True
        except Exception:
            continue

    role_patterns = (
        re.compile(r"다른\s*출발일\s*선택|다른출발일선택"),
        re.compile(r"다른\s*출발일\s*보기|다른출발일보기"),
        re.compile(r"출발일\s*선택"),
        re.compile(r"출발일\s*변경"),
        re.compile(r"출발일\s*보기"),
        re.compile(r"다른\s*출발일"),
    )
    for rx in role_patterns:
        for role in ("button", "link"):
            try:
                loc = page.get_by_role(role, name=rx)
                if await _try_open_from_locator(loc):
                    return True
            except Exception:
                continue
    _e2e_progress("open_modal: FAILED (no visible dialog)")
    return False


async def _verify_calendar_selection(page: Page, iso: str, partial: dict[str, Any]) -> dict[str, Any] | None:
    if not partial.get("ok"):
        return None
    want = (iso or "").strip()
    await asyncio.sleep(0.04)
    sel = await page.evaluate(_CALENDAR_SELECTED_ISO_JS)
    got = str((sel or {}).get("iso") or "").strip()
    if got != want:
        return None
    partial["selectedIsoAfter"] = got
    return partial


async def _click_day(
    page: Page,
    iso: str,
    *,
    month_wy: int | None = None,
    month_wm: int | None = None,
) -> dict[str, Any]:
    parts = str(iso or "").strip().split("-")
    if len(parts) < 3:
        return {"ok": False, "reason": "bad_iso"}
    try:
        d = int(parts[2])
    except ValueError:
        return {"ok": False, "reason": "bad_iso"}
    if d < 1:
        return {"ok": False, "reason": "bad_iso"}
    isot = str(iso or "").strip()

    cr: dict[str, Any] | None = None
    try:
        cr = await page.evaluate(
            _CLICK_COMMIT_CALENDAR_DAY_JS, [isot, int(month_wy or 0), int(month_wm or 0)]
        )
    except Exception as ex:
        cr = None
        if _e2e_debug_enabled():
            sys.stderr.write(f"[HANATOUR_E2E] commit_eval_exception: {ex!r}\n")
    if isinstance(cr, dict) and cr.get("ok") and cr.get("selectedIsoAfter") == isot:
        return {
            "ok": True,
            "scrollSteps": 0,
            "pwPath": "commit_js",
            "commitMethod": cr.get("method"),
            "commitPath": cr.get("commitPath"),
            "commitTimings": cr.get("timings"),
            "selectedIsoAfter": cr.get("selectedIsoAfter"),
        }
    tried = int((cr or {}).get("tried") or 0) if isinstance(cr, dict) else 0
    if isinstance(cr, dict) and tried > 0:
        for si in range(26):
            if si > 0:
                await asyncio.sleep(0.05)
            sel = await page.evaluate(_CALENDAR_SELECTED_ISO_JS)
            got = str((sel or {}).get("iso") or "").strip()
            if got == isot:
                return {
                    "ok": True,
                    "scrollSteps": 0,
                    "pwPath": "commit_js",
                    "commitMethod": cr.get("method"),
                    "commitPath": (cr.get("commitPath") or "commit_soft_verify"),
                    "commitTimings": cr.get("timings"),
                    "selectedIsoAfter": got,
                }

    try:
        prep = await page.evaluate(_CALENDAR_DAY_PREPARE_AND_POINT_JS, isot)
        if (
            isinstance(prep, dict)
            and prep.get("ok")
            and prep.get("x") is not None
            and prep.get("y") is not None
        ):
            x = float(prep["x"])
            y = float(prep["y"])
            await page.mouse.click(x, y)
            await asyncio.sleep(0.05)
            out = await _verify_calendar_selection(
                page,
                isot,
                {
                    "ok": True,
                    "mouseClick": True,
                    "scrollSteps": int(prep.get("scrollSteps") or 0),
                    "pwPath": "mouse_coord",
                },
            )
            if out:
                merged = dict(out)
                if isinstance(cr, dict) and int(cr.get("tried") or 0) > 0:
                    merged["commitTimings"] = cr.get("timings")
                    merged["commitPath"] = cr.get("commitPath") or "commit_then_mouse_coord"
                return merged
    except Exception:
        pass

    for sel in config.DIALOG_SELECTOR_PARTS:
        try:
            dlg = page.locator(sel.strip()).first
            if await dlg.count() == 0:
                continue
            loc = dlg.locator(
                ".calendar_area ul.day li.low, .calendar_area ul.day li.select.low"
            ).filter(has_text=re.compile(rf"^\s*{d}\b"))
            if await loc.count() == 0:
                loc = dlg.locator(".calendar_area ul.day li").filter(
                    has_text=re.compile(rf"^\s*{d}\b")
                )
            if await loc.count() == 0:
                continue
            target = loc.first
            await target.scroll_into_view_if_needed(timeout=8000)
            await human_delay(0.06, 0.14)
            try:
                await target.evaluate(
                    """el => {
                      const li = el.closest('li') || el;
                      li.style.pointerEvents = 'auto';
                      li.style.opacity = '1';
                    }"""
                )
            except Exception:
                pass
            inner_triple = target.locator("a").first
            if await inner_triple.count() > 0:
                try:
                    await inner_triple.scroll_into_view_if_needed(timeout=8000)
                except Exception:
                    pass
                try:
                    await inner_triple.evaluate(
                        """el => {
                          ['mousedown','mouseup','click'].forEach(t => {
                            el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
                          });
                        }"""
                    )
                    await asyncio.sleep(0.07)
                    out = await _verify_calendar_selection(
                        page,
                        isot,
                        {
                            "ok": True,
                            "scrollSteps": 0,
                            "pwDayClick": True,
                            "pwPath": "inner_mouse_seq",
                        },
                    )
                    if out:
                        return out
                except Exception:
                    pass
            try:
                await target.evaluate(
                    """el => {
                      const li = el.closest('li') || el;
                      const t = li.querySelector('a') || li;
                      ['mousedown','mouseup','click'].forEach(ev => {
                        t.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true, view: window }));
                      });
                    }"""
                )
                await asyncio.sleep(0.06)
                out = await _verify_calendar_selection(
                    page,
                    isot,
                    {
                        "ok": True,
                        "scrollSteps": 0,
                        "pwDayClick": True,
                        "pwPath": "li_mouse_seq",
                    },
                )
                if out:
                    return out
            except Exception:
                pass
            for force in (False, True):
                try:
                    await target.click(timeout=3500, force=force)
                    out = await _verify_calendar_selection(
                        page,
                        isot,
                        {
                            "ok": True,
                            "scrollSteps": 0,
                            "pwDayClick": True,
                            "pwPath": "li_force" if force else "li",
                        },
                    )
                    if out:
                        return out
                except Exception:
                    continue
            inner = target.locator("a, button").first
            if await inner.count() > 0:
                await inner.scroll_into_view_if_needed(timeout=8000)
                await human_delay(0.05, 0.1)
                try:
                    await inner.evaluate("el => { el.style.pointerEvents = 'auto'; }")
                except Exception:
                    pass
                for force in (False, True):
                    try:
                        await inner.click(timeout=3500, force=force)
                        out = await _verify_calendar_selection(
                            page,
                            isot,
                            {
                                "ok": True,
                                "scrollSteps": 0,
                                "pwDayClick": True,
                                "pwPath": "inner_force" if force else "inner",
                            },
                        )
                        if out:
                            return out
                    except Exception:
                        continue
        except Exception:
            continue

    try:
        r = await page.evaluate(_SCROLL_CLICK_JS, isot)
        if isinstance(r, dict) and r.get("ok"):
            out = await _verify_calendar_selection(
                page, isot, {**r, "fallbackJsClick": True}
            )
            if out:
                return out
    except Exception:
        pass

    sel = await page.evaluate(_CALENDAR_SELECTED_ISO_JS)
    last = str((sel or {}).get("iso") or "").strip()
    return {
        "ok": False,
        "reason": "selection_not_committed",
        "lastIso": last,
    }



async def _month_label_tuple(page: Page) -> tuple[int, int] | None:
    ym = await page.evaluate(_MONTH_LABEL_JS)
    y = int((ym or {}).get("y") or 0)
    m = int((ym or {}).get("month") or 0)
    if y and m:
        return (y, m)
    return None


def _expected_next_month(y: int, m: int) -> tuple[int, int]:
    if m >= 12:
        return (y + 1, 1)
    return (y, m + 1)


def _expected_prev_month(y: int, m: int) -> tuple[int, int]:
    if m <= 1:
        return (y - 1, 12)
    return (y, m - 1)


async def _month_nav_goal_reached(page: Page, exp: tuple[int, int]) -> bool:
    # ENUM 슬롯 JS는 화면 월과 무관하게 (y,m)+일만 붙일 수 있어 여기서는 월 라벨만 신뢰한다.
    return await _month_label_tuple(page) == exp


async def _mouse_click_center(page: Page, el: ElementHandle) -> None:
    box = await el.bounding_box()
    if not box:
        raise RuntimeError("no_bbox")
    await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)


async def _scroll_into_view_then_click(el: ElementHandle) -> None:
    try:
        await el.scroll_into_view_if_needed()
    except Exception:
        pass
    await el.click(timeout=8000)


async def _js_dispatch_dom_click(el: ElementHandle) -> None:
    await el.evaluate(
        """(el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const seq = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'];
      for (const s of seq) {
        try {
          el.dispatchEvent(
            new MouseEvent(s, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: cx,
              clientY: cy,
              button: 0,
            })
          );
        } catch (e) {}
      }
      try { if (typeof el.click === 'function') el.click(); } catch (e) {}
    }"""
    )


async def _try_dialog_footer_month_nav(
    page: Page, direction: str, expected: tuple[int, int]
) -> bool:
    """모달 내 `a.next` / `a.prev`(이전달·다음달) — 단순 click 대신 mousedown→mouseup→click + lazy 대기."""
    global _LAST_MONTH_NAV_PATH
    arrow = "a.next" if direction == "next" else "a.prev"
    for dpart in config.DIALOG_SELECTOR_PARTS:
        ds = (dpart or "").strip()
        if not ds:
            continue
        try:
            dlg = page.locator(ds).first
            if await dlg.count() == 0:
                continue
            arr = dlg.locator(arrow).first
            if await arr.count() == 0:
                continue
            if not await arr.is_visible():
                continue
            await arr.evaluate(
                """el => {
                  ['mousedown','mouseup','click'].forEach(type => {
                    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
                  });
                }"""
            )
            await asyncio.sleep(2.0)
            if await _month_nav_goal_reached(page, expected):
                _LAST_MONTH_NAV_PATH = f"dialog_footer:{arrow}"
                _e2e_progress(f"month_nav ok via {arrow} in dialog {ds[:48]!r}")
                return True
        except Exception:
            continue
    return False


async def _nav_month_by_header_arrow(
    page: Page, direction: str, expected: tuple[int, int]
) -> bool:
    global _LAST_MONTH_NAV_PATH
    _LAST_MONTH_NAV_PATH = None
    if _e2e_debug_enabled():
        probe = await page.evaluate(_CALENDAR_MONTH_HEADER_NAV_PROBE_JS)
        if isinstance(probe, dict) and probe.get("ok"):
            _e2e_progress(
                f"month_header_nav probe label={probe.get('monthLabel')!r} "
                f"leftArrow={probe.get('leftArrow')} rightArrow={probe.get('rightArrow')} "
                f"labelRect={probe.get('labelRect')}"
            )
    h = await page.evaluate_handle(_CALENDAR_MONTH_HEADER_NAV_TARGET_JS, direction)
    el = h.as_element()
    if not el:
        return False

    async def a1() -> None:
        await el.click(timeout=8000)

    async def a2() -> None:
        await el.click(force=True, timeout=8000)

    async def a3() -> None:
        await _scroll_into_view_then_click(el)

    async def a4() -> None:
        await _mouse_click_center(page, el)

    async def a5() -> None:
        await _js_dispatch_dom_click(el)

    for path, fn in (
        ("playwright_click", a1),
        ("force_click", a2),
        ("scroll_then_click", a3),
        ("mouse_bbox", a4),
        ("js_dispatch", a5),
    ):
        try:
            await fn()
            await asyncio.sleep(0.06)
            if await _month_nav_goal_reached(page, expected):
                _LAST_MONTH_NAV_PATH = path
                _e2e_progress(f"month_nav ok via {path}")
                return True
        except Exception:
            continue
    return False


async def _next_month_legacy(page: Page, before: tuple[int, int]) -> bool:
    global _LAST_MONTH_NAV_PATH
    exp = _expected_next_month(*before)
    for sel in config.CALENDAR_MONTH_NEXT_SELECTORS:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                await loc.click(timeout=6000)
                await asyncio.sleep(0.14)
                if await _month_nav_goal_reached(page, exp):
                    _LAST_MONTH_NAV_PATH = f"legacy:{sel}"
                    return True
        except Exception:
            continue
    return False


async def _prev_month_legacy(page: Page, before: tuple[int, int]) -> bool:
    global _LAST_MONTH_NAV_PATH
    exp = _expected_prev_month(*before)
    for sel in config.CALENDAR_MONTH_PREV_SELECTORS:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                await loc.click(timeout=6000)
                await asyncio.sleep(0.14)
                if await _month_nav_goal_reached(page, exp):
                    _LAST_MONTH_NAV_PATH = f"legacy_prev:{sel}"
                    return True
        except Exception:
            continue
    return False


async def _next_month(page: Page) -> bool:
    before = await _month_label_tuple(page)
    if not before:
        return False
    exp = _expected_next_month(*before)
    if await _try_dialog_footer_month_nav(page, "next", exp):
        return True
    if await _nav_month_by_header_arrow(page, "next", exp):
        return True
    return await _next_month_legacy(page, before)


async def _prev_month(page: Page) -> bool:
    before = await _month_label_tuple(page)
    if not before:
        return False
    exp = _expected_prev_month(*before)
    if await _try_dialog_footer_month_nav(page, "prev", exp):
        return True
    if await _nav_month_by_header_arrow(page, "prev", exp):
        return True
    return await _prev_month_legacy(page, before)


class HanatourCalendarE2EScraper:
    def __init__(self, headless: bool = True) -> None:
        self.headless = headless
        self._pw = None
        self._browser = None
        self._page: Page | None = None

    async def _finalize_hanatour_e2e_run(
        self,
        result: dict[str, Any],
        own: bool,
        *,
        phase_month: str = "pending",
    ) -> dict[str, Any]:
        """stdout JSON + flush 후 브라우저 정리(최대 대기). try/finally보다 먼저 결과를 내보낸다."""
        emit = (os.environ.get("HANATOUR_E2E_NO_STDOUT_EMIT", "") or "").strip().lower() not in (
            "1",
            "true",
            "yes",
        )
        if emit:
            _e2e_timing_phase("before_collect_return")
            _e2e_hanatour_phase("before_collect_return", month=phase_month)
            _e2e_timing_phase("before_json_build")
            _e2e_hanatour_phase("before_json_build", month=phase_month)
            t_json0 = _time.perf_counter()
            payload = json.dumps(result, ensure_ascii=False, indent=2)
            json_stdout_ms = (_time.perf_counter() - t_json0) * 1000.0
            lg = result.get("log")
            if isinstance(lg, dict):
                b = lg.setdefault("e2e_bucket_ms", {})
                if isinstance(b, dict):
                    b["10_json_stdout_ms"] = round(json_stdout_ms, 1)
                    try:
                        sys.stderr.write(
                            "[HANATOUR_E2E_BUCKET_MS] "
                            + json.dumps(b, ensure_ascii=False)
                            + "\n"
                        )
                        sys.stderr.flush()
                    except Exception:
                        pass
            payload = json.dumps(result, ensure_ascii=False, indent=2)
            _e2e_timing_phase("after_json_build")
            _e2e_hanatour_phase("after_json_build", month=phase_month)
            sys.stdout.write(payload + "\n")
            _e2e_timing_phase("after_stdout_write")
            sys.stdout.flush()
            _e2e_timing_phase("after_stdout_flush")
            _e2e_hanatour_phase("after_stdout_flush", month=phase_month)
        _e2e_timing_phase("before_browser_close")
        _e2e_hanatour_phase("before_browser_close", month=phase_month)
        if own and self._pw is not None:
            pw, br = self._pw, self._browser
            self._pw = None
            self._browser = None
            self._page = None
            _close_deadline = (
                8.0
                if (os.environ.get("HANATOUR_E2E_ADMIN_MONTH_SESSION") or "").strip().lower()
                in ("1", "true", "yes")
                else 12.0
            )
            try:
                await asyncio.wait_for(close_hanatour_browser(pw, br), timeout=_close_deadline)
            except Exception:
                pass
        _e2e_timing_phase("after_browser_close")
        _e2e_hanatour_phase("after_browser_close", month=phase_month)
        _e2e_hanatour_phase("process-exit", month=phase_month)
        return {**result, "_hanatourStdoutEmitted": emit}

    async def run(
        self,
        detail_url: str,
        *,
        max_months: int = 6,
        page: Page | None = None,
        own_browser: bool = True,
        target_month_ym: str | None = None,
    ) -> dict[str, Any]:
        notes: list[str] = []
        log: dict[str, Any] = {
            "collectorStatus": "modal_failed",
            "modal_opened": False,
            "supplier_product_code": None,
            "raw_title": None,
            "e2e_timing_days": [],
        }
        departures: list[dict[str, Any]] = []
        t_e2e_wall0 = _time.perf_counter()
        phase_month = (target_month_ym or "").strip() or "pending"
        _e2e_hanatour_phase("script-entry", month=phase_month)
        own = own_browser and page is None
        if own:
            _e2e_hanatour_phase("browser-launching", month=phase_month)
            self._pw, self._browser, _, self._page = await launch_hanatour_browser(
                headless=self.headless
            )
            page = self._page
        assert page is not None
        try:
            next_month_nav_ms_acc = 0.0
            _e2e_timer_reset()
            _e2e_hanatour_phase("month_boot", month=phase_month)
            _e2e_timing_phase("browser_launched")
            if not getattr(config, "MONTH_FIRST_MATCH_ONLY", False):
                _e2e_progress(f"goto: {detail_url[:120]}...")
            await page.goto(detail_url, wait_until="domcontentloaded", timeout=config.PAGE_LOAD_TIMEOUT_MS)
            _e2e_hanatour_phase("page-navigated", month=phase_month)
            _e2e_progress("wait_load_state: networkidle (optional, short timeout)")
            try:
                await page.wait_for_load_state(
                    "networkidle", timeout=config.NETWORK_IDLE_TIMEOUT_MS
                )
            except Exception:
                _e2e_progress("networkidle: skipped or timeout (continuing)")
            await _post_page_load_delay()
            _e2e_timing_phase("detail_page_loaded")
            _e2e_hanatour_phase("detail_page_loaded", month=phase_month)
            html = await page.content()
            raw_title = extract_hanatour_detail_raw_title(html)
            log["raw_title"] = raw_title[:400]
            ident = parse_hanatour_product_identifiers(detail_url)
            log["supplier_product_code"] = ident.get("pkg_cd")
            opened = await _open_modal(page)
            log["modal_opened"] = opened
            if opened:
                _e2e_progress("open_modal: OK (dialog visible)")
                _e2e_timing_phase("departure_modal_opened")
                _e2e_hanatour_phase("departure_modal_opened", month=phase_month)
                _e2e_hanatour_phase("modal-opened", month=phase_month)
            if not opened:
                notes.append("modal_open_failed")
                log["collectorStatus"] = "modal_failed"
                return await self._finalize_hanatour_e2e_run(
                    self._ret(departures, notes, log, detail_url=detail_url),
                    own,
                    phase_month=phase_month,
                )

            rt = (raw_title or "").strip()
            if len(rt) < 8 or rt in ("하나투어", "HANATOUR", "hanatour"):
                try:
                    rows_probe = await page.evaluate(_COLLECT_ROWS_FULL_JS)
                    if isinstance(rows_probe, list) and rows_probe:
                        t0 = (rows_probe[0].get("text") or "").split("\n")[0].strip()
                        if len(t0) > 12:
                            raw_title = t0
                            log["raw_title"] = raw_title[:400]
                            notes.append("baseline_title_from_modal_first_row")
                except Exception:
                    pass

            lay_modal = await _ensure_departure_list_visible(page)
            log["e2e_list_layout"] = lay_modal
            if _e2e_progress_enabled() and lay_modal.get("ok"):
                _e2e_progress(
                    f"list_layout_after_modal layout={lay_modal.get('layout')} "
                    f"stacked={lay_modal.get('stacked')} viewport={lay_modal.get('viewport')} "
                    f"liCount={lay_modal.get('liCount')} scrolled={lay_modal.get('scrolled')}"
                )
            _e2e_timing_phase("right_list_layout_ready")
            t_e2e_post_modal = _time.perf_counter()

            kst_today = kst_today_ymd()
            months_done = 0
            next_month_ok_count = 0
            stop_after_first = str(
                os.environ.get("HANATOUR_E2E_STOP_AFTER_FIRST_DEPARTURE", "")
            ).strip().lower() in ("1", "true", "yes")
            stop_all_months = False
            try:
                max_day_attempts = max(
                    0, int((os.environ.get("HANATOUR_E2E_MAX_DAY_ATTEMPTS") or "0").strip())
                )
            except ValueError:
                max_day_attempts = 0
            day_attempts = 0
            sample_mode = getattr(config, "SAMPLE_MODE", False)
            sample_agg: dict[str, Any] = {
                "scanned": 0,
                "committed": 0,
                "matched": 0,
                "collected": 0,
                "fail": 0,
                "fr": {},
            }
            t_sample0 = _time.perf_counter()
            mfmo = getattr(config, "MONTH_FIRST_MATCH_ONLY", False)
            month_verify_results: list[dict[str, Any]] = []
            max_months_eff = max(1, max_months)
            ty_nav: int | None = None
            tm_nav: int | None = None
            skip_target_month_body = False
            if target_month_ym:
                raw_tm = (target_month_ym or "").strip()
                if len(raw_tm) >= 7 and raw_tm[4] == "-":
                    try:
                        ty_nav = int(raw_tm[:4])
                        tm_nav = int(raw_tm[5:7])
                        log["e2e_target_month_ym"] = f"{ty_nav:04d}-{tm_nav:02d}"
                        notes.append(f"e2e_target_month_only:{log['e2e_target_month_ym']}")
                        max_months_eff = 1
                        for _ in range(0, 24):
                            ym = await page.evaluate(_MONTH_LABEL_JS)
                            wy0 = int((ym or {}).get("y") or 0)
                            wm0 = int((ym or {}).get("month") or 0)
                            if wy0 == ty_nav and wm0 == tm_nav:
                                break
                            if (wy0 < ty_nav) or (wy0 == ty_nav and wm0 < tm_nav):
                                t_nv = _time.perf_counter()
                                nm_ok = await _next_month(page)
                                next_month_nav_ms_acc += (
                                    _time.perf_counter() - t_nv
                                ) * 1000.0
                            else:
                                t_nv = _time.perf_counter()
                                nm_ok = await _prev_month(page)
                                next_month_nav_ms_acc += (
                                    _time.perf_counter() - t_nv
                                ) * 1000.0
                            if not nm_ok:
                                notes.append("e2e_target_month_nav_failed")
                                break
                            t_hd = _time.perf_counter()
                            await human_delay(0.15, 0.35)
                            next_month_nav_ms_acc += (
                                _time.perf_counter() - t_hd
                            ) * 1000.0
                    except ValueError:
                        notes.append("e2e_target_month_parse_failed")
                        skip_target_month_body = True
                else:
                    notes.append("e2e_target_month_invalid")
                    skip_target_month_body = True
                if not skip_target_month_body and ty_nav is not None and tm_nav is not None:
                    ym_chk = await page.evaluate(_MONTH_LABEL_JS)
                    wy1 = int((ym_chk or {}).get("y") or 0)
                    wm1 = int((ym_chk or {}).get("month") or 0)
                    if wy1 != ty_nav or wm1 != tm_nav:
                        notes.append(
                            f"e2e_target_month_mismatch want={ty_nav:04d}-{tm_nav:02d} got={wy1:04d}-{wm1:02d}"
                        )
                        skip_target_month_body = True
                    else:
                        phase_month = f"{ty_nav:04d}-{tm_nav:02d}"
                        _e2e_hanatour_phase(
                            "calendar_aligned_to_target_month",
                            month=phase_month,
                            current_calendar_label=phase_month,
                        )
            if mfmo and not target_month_ym:
                raw_ym = (os.getenv("HANATOUR_E2E_FIRST_VERIFY_YM") or "").strip()
                if len(raw_ym) >= 7 and raw_ym[4] == "-":
                    try:
                        ty = int(raw_ym[:4])
                        tm = int(raw_ym[5:7])
                        for _ in range(0, 24):
                            ym = await page.evaluate(_MONTH_LABEL_JS)
                            wy0 = int((ym or {}).get("y") or 0)
                            wm0 = int((ym or {}).get("month") or 0)
                            if wy0 == ty and wm0 == tm:
                                break
                            if (wy0 < ty) or (wy0 == ty and wm0 < tm):
                                t_nv = _time.perf_counter()
                                nm_ok = await _next_month(page)
                                next_month_nav_ms_acc += (
                                    _time.perf_counter() - t_nv
                                ) * 1000.0
                            else:
                                t_nv = _time.perf_counter()
                                nm_ok = await _prev_month(page)
                                next_month_nav_ms_acc += (
                                    _time.perf_counter() - t_nv
                                ) * 1000.0
                            if not nm_ok:
                                notes.append("first_verify_ym_nav_failed")
                                break
                            t_hd = _time.perf_counter()
                            await human_delay(0.15, 0.35)
                            next_month_nav_ms_acc += (
                                _time.perf_counter() - t_hd
                            ) * 1000.0
                    except ValueError:
                        pass

            t_e2e_month_loop0 = _time.perf_counter()
            _e2e_timing_phase("month_loop_start")
            for mi in range(max_months_eff):
                if skip_target_month_body and target_month_ym:
                    break
                _e2e_timing_phase(f"month_{mi}_begin")
                ym = await page.evaluate(_MONTH_LABEL_JS)
                wy = int((ym or {}).get("y") or 0)
                wm = int((ym or {}).get("month") or 0)
                phase_month = f"{wy:04d}-{wm:02d}"
                month_appended = 0
                if not wy or not wm:
                    notes.append(f"month_label_unreadable_month_index={mi}")
                    break
                days = await page.evaluate(_ENUM_DAYS_JS, [wy, wm])
                if not isinstance(days, list):
                    days = []
                uniq_slots: list[dict[str, Any]] = []
                seen_iso: set[str] = set()
                for slot in days:
                    iiso = str((slot or {}).get("iso") or "")
                    if len(iiso) < 10 or iiso in seen_iso:
                        continue
                    seen_iso.add(iiso)
                    uniq_slots.append(slot)
                days = uniq_slots
                day_hints = _hint_departure_isos_for_month(raw_title, wy, wm)
                if day_hints:
                    notes.append(f"e2e_departure_day_hints:{','.join(day_hints[:12])}")
                    days = _sort_day_slots_by_hints(days, day_hints)
                elif stop_after_first and not mfmo:
                    # 첫 매칭만 필요할 때: 제목 힌트가 없으면 월말→월초 순으로 시도해 불필요한 일자 클릭 감소
                    notes.append("e2e_stop_after_first_day_order_desc")
                    days = list(reversed(days))
                probe_only = (
                    os.getenv("HANATOUR_E2E_PROBE_ONLY_DATES")
                    or getattr(config, "PROBE_ONLY_DATES", "")
                    or ""
                ).strip()
                if mfmo:
                    probe_only = ""
                probe_only_applied = False
                if probe_only:
                    allowed = {
                        x.strip()
                        for x in probe_only.split(",")
                        if len((x or "").strip()) >= 10
                    }
                    if allowed:
                        days = [
                            s
                            for s in days
                            if str((s or {}).get("iso") or "") in allowed
                        ]
                        notes.append(f"e2e_probe_only_dates:{','.join(sorted(allowed))}")
                        probe_only_applied = True
                if probe_only_applied and len(days) > 1:
                    try:
                        sel0 = await page.evaluate(_CALENDAR_SELECTED_ISO_JS)
                        sel_s = str((sel0 or {}).get("iso") or "").strip()
                        if sel_s:
                            days = sorted(
                                days,
                                key=lambda s: (
                                    1
                                    if str((s or {}).get("iso") or "") == sel_s
                                    else 0,
                                    str((s or {}).get("iso") or ""),
                                ),
                            )
                            notes.append(
                                "e2e_probe_only_dates_order:"
                                + ",".join(
                                    str((s or {}).get("iso") or "") for s in days
                                )
                                + f":default_was={sel_s}"
                            )
                    except Exception:
                        pass
                notes.append(
                    f"[HANATOUR_E2E_MONTH] index={mi} y={wy} m={wm} day_slots={len(days)}"
                )
                _e2e_hanatour_phase(
                    "left_calendar_scanned",
                    month=phase_month,
                    rows_seen=len(days),
                    current_calendar_label=phase_month,
                )
                _e2e_admin_progress(
                    f"ym={phase_month} calendar_day_slots={len(days)} (iterating…)"
                )
                if not mfmo:
                    _e2e_progress(f"month_loop: index={mi} {wy}-{wm:02d} day_slots={len(days)}")
                notes_at_month_start = len(notes)
                month_matched_this = False
                sm = sample_mode and not mfmo
                _e2e_hanatour_phase(
                    f"month-{wm}-collect-start",
                    month=phase_month,
                    rows_seen=len(days),
                    current_calendar_label=phase_month,
                )
                for slot in days:
                    iso = str((slot or {}).get("iso") or "")
                    if len(iso) < 10 or iso < kst_today:
                        continue
                    if max_day_attempts and day_attempts >= max_day_attempts:
                        notes.append(f"e2e_max_day_attempts_reached:{max_day_attempts}")
                        break
                    day_attempts += 1
                    day_budget_ms = (
                        config.DAY_BUDGET_MS
                        if config.DAY_BUDGET_MS > 0
                        else (25000 if (sample_mode or mfmo) else 0)
                    )
                    day_deadline = (
                        (_time.perf_counter() + day_budget_ms / 1000.0)
                        if ((sample_mode or mfmo) and day_budget_ms > 0)
                        else None
                    )

                    def _rem_ms() -> int:
                        if day_deadline is None:
                            return 10**9
                        return max(0, int((day_deadline - _time.perf_counter()) * 1000.0))

                    lw_first_ms = (
                        min(config.LIST_REFRESH_TIMEOUT_MS, config.LIST_REFRESH_SAMPLE_MS)
                        if (sample_mode or mfmo)
                        else config.LIST_REFRESH_TIMEOUT_MS
                    )
                    t_day0 = _time.perf_counter()
                    if not mfmo:
                        _e2e_progress(
                            f"click_day: {iso} (then list refresh wait max {config.LIST_REFRESH_TIMEOUT_MS}ms)"
                        )
                    before_cal = await page.evaluate(_CALENDAR_DAY_STATE_JS, iso)
                    sel_before_wr = await page.evaluate(_CALENDAR_SELECTED_ISO_JS)
                    before_sel_iso = str((sel_before_wr or {}).get("iso") or "").strip() or None
                    snap_list_before = await page.evaluate(_LIST_SNAPSHOT_JS) or {}
                    bh = str(snap_list_before.get("hash") or "")
                    brc = int(snap_list_before.get("rowCount") or 0)
                    before_row_sn = await page.evaluate(_LIST_FIRST_DEPARTURE_ROW_SNAPSHOT_JS)
                    bf_text: str | None = None
                    if isinstance(before_row_sn, dict) and before_row_sn.get("ok"):
                        bf_text = str(before_row_sn.get("text") or "").strip() or None
                    before_list_probe = await page.evaluate(_LIST_TOP_DEPARTURE_ROWS_PROBE_JS)
                    if not isinstance(before_list_probe, dict):
                        before_list_probe = {}
                    _e2e_probe_log_snapshot("before_click", iso, before_cal, before_list_probe)
                    _e2e_hanatour_phase(
                        "day_click_started",
                        month=phase_month,
                        iso=iso,
                        current_calendar_label=phase_month,
                    )
                    t_click0 = _time.perf_counter()
                    if (sample_mode or mfmo) and day_deadline is not None and _rem_ms() < 1:
                        el = (_time.perf_counter() - t_day0) * 1000
                        if sm:
                            _e2e_sample_line(
                                iso, False, False, False, "timeout", el
                            )
                            _e2e_sample_record(
                                sample_agg,
                                fail_reason="timeout",
                                selected_committed=False,
                                same_product_matched=False,
                                collected=False,
                            )
                        continue
                    cc = await _click_day(page, iso, month_wy=wy, month_wm=wm)
                    click_ms = (_time.perf_counter() - t_click0) * 1000
                    if (cc or {}).get("ok"):
                        _e2e_hanatour_phase(
                            "day_click_done",
                            month=phase_month,
                            iso=iso,
                            extra_ms=click_ms,
                        )
                    if not (cc or {}).get("ok"):
                        notes.append(
                            f"click_fail:{iso}:{(cc or {}).get('reason', '')}"
                        )
                        if sm:
                            el = (_time.perf_counter() - t_day0) * 1000
                            _e2e_sample_line(
                                iso,
                                False,
                                False,
                                False,
                                "selection_not_committed",
                                el,
                            )
                            _e2e_sample_record(
                                sample_agg,
                                fail_reason="selection_not_committed",
                                selected_committed=False,
                                same_product_matched=False,
                                collected=False,
                            )
                        continue
                    if _e2e_progress_enabled() and not mfmo:
                        _e2e_progress(
                            f"calendar_click ok iso={iso} scrollSteps={(cc or {}).get('scrollSteps')} "
                            f"pre_list_hash={bh[:24] if bh else 'empty'}... rowCount={brc}"
                        )
                    lay_click = await _ensure_departure_list_visible(page)
                    log["e2e_list_layout_last"] = lay_click
                    if _e2e_progress_enabled() and lay_click.get("ok") and not mfmo:
                        _e2e_progress(
                            f"list_layout_after_click iso={iso} layout={lay_click.get('layout')} "
                            f"stacked={lay_click.get('stacked')} listTop={lay_click.get('listTop')} "
                            f"listBottom={lay_click.get('listBottom')} "
                            f"partialViewport={lay_click.get('listPartiallyInViewport')} "
                            f"scrolled={lay_click.get('scrolled')}"
                        )
                    t_pre0 = _time.perf_counter()
                    if (cc or {}).get("pwPath") == "commit_js" and str(
                        (cc or {}).get("selectedIsoAfter") or ""
                    ).strip() == iso:
                        await asyncio.sleep(
                            max(0.02, config.POST_CLICK_BEFORE_LIST_MS / 1000.0)
                        )
                    else:
                        # 날짜(일자) 클릭 직후 — 사람이 다음 UI를 읽는 시간
                        await human_delay(2.0, 3.0)
                    pre_list_ms = (_time.perf_counter() - t_pre0) * 1000
                    refresh_proof = ""
                    list_refresh_forced_aggressive = False
                    cc2_ok = False
                    third_wait_ok = False
                    fourth_wait_ok = False
                    lw_total_ms = 0.0
                    t_lw = _time.perf_counter()
                    _e2e_hanatour_phase(
                        "right_list_scan_started",
                        month=phase_month,
                        iso=iso,
                    )
                    if (sample_mode or mfmo) and day_deadline is not None:
                        lw_timeout = min(lw_first_ms, _rem_ms())
                    else:
                        lw_timeout = lw_first_ms
                    if (sample_mode or mfmo) and day_deadline is not None and lw_timeout < 1:
                        el = (_time.perf_counter() - t_day0) * 1000
                        if sm:
                            _e2e_sample_line(
                                iso, False, False, False, "timeout", el
                            )
                            _e2e_sample_record(
                                sample_agg,
                                fail_reason="timeout",
                                selected_committed=False,
                                same_product_matched=False,
                                collected=False,
                            )
                        continue
                    changed, ah, refresh_proof = await _wait_list_change(
                        page,
                        bh,
                        lw_timeout,
                        before_row_count=brc,
                        iso_label=iso,
                        before_selected_iso=before_sel_iso,
                        before_first_row_text=bf_text,
                        before_cal_probe=before_cal if isinstance(before_cal, dict) else {},
                        before_list_probe=before_list_probe,
                    )
                    lw_total_ms += (_time.perf_counter() - t_lw) * 1000
                    right_list_changed = changed
                    if getattr(config, "PROBE_LOG", False):
                        try:
                            ac = await page.evaluate(_CALENDAR_DAY_STATE_JS, iso)
                            al = await page.evaluate(_LIST_TOP_DEPARTURE_ROWS_PROBE_JS)
                            _e2e_probe_log_snapshot("after_list_wait", iso, ac, al)
                        except Exception:
                            pass
                    _e2e_hanatour_phase(
                        "right_list_scan_done",
                        month=phase_month,
                        iso=iso,
                        extra_ms=lw_total_ms,
                    )
                    list_refresh_unverified = False
                    # matchingTraceRaw.listRefreshUnverifiedSource (JSON: 문자열 또는 null)
                    #   "env_allow" — HANATOUR_E2E_ALLOW_COLLECT_WITHOUT_LIST_REFRESH>0, 1·2차 list_wait 실패 직후 미검증
                    #   "after_aggressive_pipeline" — 강제 스크롤·3·4차 list_wait·재클릭 후에도 미갱신 시 미검증
                    #   null — 검증된 수집(listRefreshUnverified=false; rightListChanged 등으로 갱신 입증)
                    unverified_source: str | None = None
                    if not right_list_changed:
                        if sm:
                            el = (_time.perf_counter() - t_day0) * 1000
                            _e2e_sample_line(
                                iso,
                                False,
                                False,
                                False,
                                "selection_not_committed",
                                el,
                            )
                            _e2e_sample_record(
                                sample_agg,
                                fail_reason="selection_not_committed",
                                selected_committed=False,
                                same_product_matched=False,
                                collected=False,
                            )
                            continue
                        notes.append(f"list_static:{iso}")
                        if config.ALLOW_COLLECT_WITHOUT_LIST_REFRESH > 0:
                            notes.append(f"list_refresh_unverified:{iso}")
                            list_refresh_unverified = True
                            unverified_source = "env_allow"
                        else:
                            continue
                    ah_after_list_wait = ah
                    forced_list_refresh = False
                    await asyncio.sleep(
                        max(
                            0.05,
                            (
                                min(120, config.POST_CLICK_LIST_SETTLE_MS)
                                if sm
                                else config.POST_CLICK_LIST_SETTLE_MS
                            )
                            / 1000.0,
                        )
                    )
                    await _ensure_departure_list_visible(page)
                    after_cal = await page.evaluate(_CALENDAR_DAY_STATE_JS, iso)
                    sel_after_wr = await page.evaluate(_CALENDAR_SELECTED_ISO_JS)
                    after_sel_iso = str((sel_after_wr or {}).get("iso") or "").strip()
                    sig_b = _calendar_selection_signature(before_cal)
                    sig_a = _calendar_selection_signature(after_cal)
                    selected_changed = (
                        sig_b != sig_a
                        or (after_sel_iso == iso and (before_sel_iso or "") != iso)
                        or (ah != bh)
                        or (right_list_changed and after_sel_iso == iso)
                        or list_refresh_unverified
                    )
                    if not selected_changed:
                        notes.append(f"calendar_selection_unchanged:{iso}")
                        if sm:
                            el = (_time.perf_counter() - t_day0) * 1000
                            _e2e_sample_line(
                                iso,
                                False,
                                False,
                                False,
                                "selection_not_committed",
                                el,
                            )
                            _e2e_sample_record(
                                sample_agg,
                                fail_reason="selection_not_committed",
                                selected_committed=False,
                                same_product_matched=False,
                                collected=False,
                            )
                        continue
                    t_match0 = _time.perf_counter()
                    _e2e_hanatour_phase(
                        "row_collect_started",
                        month=phase_month,
                        iso=iso,
                        selected_iso=after_sel_iso,
                    )
                    if sm and day_deadline is not None and _rem_ms() < 1:
                        el = (_time.perf_counter() - t_day0) * 1000
                        _e2e_sample_line(
                            iso, False, False, False, "timeout", el
                        )
                        _e2e_sample_record(
                            sample_agg,
                            fail_reason="timeout",
                            selected_committed=False,
                            same_product_matched=False,
                            collected=False,
                        )
                        continue
                    same, best, scroll_match_attempt, last_cands = (
                        await _collect_rows_match_same_product(
                            page,
                            raw_title,
                            iso,
                            notes,
                            deadline=day_deadline,
                        )
                    )
                    match_ms = (_time.perf_counter() - t_match0) * 1000
                    if sm and any(
                        n.startswith(f"same_product_deadline:{iso}") for n in notes
                    ):
                        el = (_time.perf_counter() - t_day0) * 1000
                        _e2e_sample_line(
                            iso, False, False, False, "timeout", el
                        )
                        _e2e_sample_record(
                            sample_agg,
                            fail_reason="timeout",
                            selected_committed=False,
                            same_product_matched=False,
                            collected=False,
                        )
                        continue
                    if not same or not best:
                        sample = _sample_titles_for_notes(last_cands)
                        if sample:
                            notes.append(f"no_same_product_row:{iso}:titles_sample={sample[:400]}")
                        else:
                            notes.append(f"no_same_product_row:{iso}")
                        if sm:
                            el = (_time.perf_counter() - t_day0) * 1000
                            scx = after_sel_iso == iso
                            _e2e_sample_line(
                                iso,
                                scx,
                                False,
                                False,
                                "no_same_product_row",
                                el,
                            )
                            _e2e_sample_record(
                                sample_agg,
                                fail_reason="no_same_product_row",
                                selected_committed=scx,
                                same_product_matched=False,
                                collected=False,
                            )
                        continue
                    row_ok, miss = _departure_row_complete(best)
                    if not row_ok:
                        notes.append(f"departure_row_incomplete:{iso}:{','.join(miss)}")
                    st = best.get("statusRaw")
                    st_s = st if isinstance(st, str) else str(st or "")
                    st_norm = hanatour_normalize_status_raw(st_s)
                    sp_match = hanatour_same_product_match_trace(raw_title, best)
                    field_conf = hanatour_field_confidence_from_candidate_row(best)
                    tier = hanatour_e2e_verification_tier(
                        selected_iso_ok=(after_sel_iso == iso),
                        right_list_changed=bool(right_list_changed),
                        list_refresh_unverified=bool(list_refresh_unverified),
                        row_complete=row_ok,
                        match_result=str(sp_match.get("matchResult") or ""),
                        fuzzy_sequence_score=float(sp_match.get("fuzzySequenceScore") or 0.0),
                    )
                    ps_reason = (
                        hanatour_partial_success_primary_reason(
                            selected_iso_ok=(after_sel_iso == iso),
                            right_list_changed=bool(right_list_changed),
                            list_refresh_unverified=bool(list_refresh_unverified),
                            row_complete=row_ok,
                            match_result=str(sp_match.get("matchResult") or ""),
                            fuzzy_sequence_score=float(sp_match.get("fuzzySequenceScore") or 0.0),
                        )
                        if tier == "partial_success"
                        else None
                    )
                    dep = {
                        "departureDate": iso,
                        "adultPrice": best.get("candidatePrice"),
                        "statusRaw": st,
                        "statusNormalized": st_norm,
                        "seatsStatusRaw": st,
                        "seatsStatusNormalized": st_norm,
                        "carrierName": best.get("candidateAirlineName"),
                        "airlineName": best.get("candidateAirlineName"),
                        "outboundDepartureAt": best.get("candidateOutboundDepartureAt"),
                        "inboundArrivalAt": best.get("candidateInboundArrivalAt"),
                        "outboundAt": best.get("candidateOutboundDepartureAt"),
                        "inboundAt": best.get("candidateInboundArrivalAt"),
                        "verificationTier": tier,
                        "partialSuccessReason": ps_reason,
                        "fieldConfidence": field_conf,
                        "matchingTraceRaw": json.dumps(
                            {
                                "clickedIso": iso,
                                "sameProductFilter": "hanatour_anchor_tail_exact_match",
                                "sameProductMatch": sp_match,
                                "registered_raw_title": sp_match.get(
                                    "registered_raw_title"
                                ),
                                "registered_anchor_text": sp_match.get(
                                    "registered_anchor_text"
                                ),
                                "row_raw_title": sp_match.get("row_raw_title"),
                                "row_anchor_text": sp_match.get("row_anchor_text"),
                                "same_product_match": sp_match.get("same_product_match"),
                                "mismatch_reason": sp_match.get("mismatch_reason"),
                                "baseline_airlineName": sp_match.get("baseline_airlineName"),
                                "row_airlineName": sp_match.get("row_airlineName"),
                                "baseline_outboundAt": sp_match.get("baseline_outboundAt"),
                                "row_outboundAt": sp_match.get("row_outboundAt"),
                                "baseline_inboundAt": sp_match.get("baseline_inboundAt"),
                                "row_inboundAt": sp_match.get("row_inboundAt"),
                                "flight_itinerary_updated": sp_match.get(
                                    "flight_itinerary_updated"
                                ),
                                "verificationTier": tier,
                                "partialSuccessReason": ps_reason,
                                "fieldConfidence": field_conf,
                                "statusNormalized": st_norm,
                                "selectedIsoOk": after_sel_iso == iso,
                                "scrollSteps": (cc or {}).get("scrollSteps"),
                                "calendarClickPath": (cc or {}).get("pwPath")
                                or ("mouse" if (cc or {}).get("mouseClick") else None),
                                "fallbackJsCalendarClick": bool((cc or {}).get("fallbackJsClick")),
                                "rightListChanged": right_list_changed,
                                "selectedChanged": selected_changed,
                                "listRefreshed": right_list_changed,
                                "listHashBefore": bh,
                                "listHashAfter": ah,
                                "calendarBefore": before_cal,
                                "calendarAfter": after_cal,
                                "listLayoutAfterClick": lay_click,
                                "selectedIsoBefore": before_sel_iso,
                                "selectedIsoAfter": after_sel_iso,
                                "matchedAfterScrollAttempt": scroll_match_attempt,
                                "rowComplete": row_ok,
                                "missingFields": miss,
                                "listRefreshUnverified": list_refresh_unverified,
                                "listRefreshUnverifiedSource": unverified_source,
                                "refreshProofReason": refresh_proof,
                                "forcedListRefreshAfterSameDay": forced_list_refresh,
                                "listHashAfterListWait": ah_after_list_wait,
                                "listRefreshForcedAggressiveAttempt": list_refresh_forced_aggressive,
                                "thirdListWaitAfterForceScrollOk": third_wait_ok,
                                "fourthListWaitAfterReclickOk": fourth_wait_ok,
                                "calendarReclickedAfterListForce": cc2_ok,
                            },
                            ensure_ascii=False,
                        ),
                        "candidateRawTitle": best.get("candidateRawTitle"),
                    }
                    departures.append(dep)
                    month_appended += 1
                    notes.append(f"appended:{iso}")
                    _e2e_admin_progress(
                        f"ym={phase_month} collected={month_appended} lastIso={iso}"
                    )
                    _e2e_hanatour_phase(
                        "row_collect_done",
                        month=phase_month,
                        iso=iso,
                        appended_count=month_appended,
                        selected_iso=after_sel_iso,
                    )
                    if mfmo:
                        print(
                            f"E2E_MONTH_VERIFY\t{wy:04d}-{wm:02d}\tfound=true\tfirstMatchedIso={iso}\tfail_reason=none",
                            flush=True,
                        )
                        month_verify_results.append(
                            {
                                "month": f"{wy:04d}-{wm:02d}",
                                "found": True,
                                "firstMatchedIso": iso,
                                "fail_reason": "none",
                            }
                        )
                        month_matched_this = True
                        break
                    if sm:
                        el = (_time.perf_counter() - t_day0) * 1000
                        sc_ok = after_sel_iso == iso
                        sm_ok = True
                        if list_refresh_unverified:
                            fr = "list_refresh_unverified"
                            coll = False
                        elif not row_ok:
                            fr = "row_incomplete"
                            coll = False
                        else:
                            fr = "none"
                            coll = True
                        _e2e_sample_line(iso, sc_ok, sm_ok, coll, fr, el)
                        _e2e_sample_record(
                            sample_agg,
                            fail_reason=fr,
                            selected_committed=sc_ok,
                            same_product_matched=sm_ok,
                            collected=coll,
                        )
                    day_row = {
                        "iso": iso,
                        "clickMs": round(click_ms, 1),
                        "preListMs": round(pre_list_ms, 1),
                        "listWaitTotalMs": round(lw_total_ms, 1),
                        "matchMs": round(match_ms, 1),
                        "commitTimings": (cc or {}).get("commitTimings"),
                        "commitPath": (cc or {}).get("commitPath"),
                    }
                    log["e2e_timing_days"].append(day_row)
                    if getattr(config, "TIMING_LOG", False):
                        _e2e_progress(
                            f"timing {iso} click={day_row['clickMs']}ms pre={day_row['preListMs']}ms "
                            f"list_wait={day_row['listWaitTotalMs']}ms match={day_row['matchMs']}ms"
                        )
                    log["e2e_refresh_proof"] = refresh_proof
                    if forced_list_refresh:
                        log["e2e_forced_list_same_day"] = True
                    if not mfmo:
                        _e2e_progress(
                            f"row OK iso={iso} price={best.get('candidatePrice')} "
                            f"rlc={right_list_changed} sel={selected_changed} proof={refresh_proof!r}"
                        )
                    if stop_after_first:
                        _e2e_timing_phase(
                            f"first_match_collected_stop iso={iso} list_scan_done"
                        )
                        stop_all_months = True
                        break

                if mfmo and not month_matched_this:
                    month_last_fail = "unknown"
                    for n in reversed(notes[notes_at_month_start:]):
                        if "no_same_product_row:" in n:
                            month_last_fail = "no_same_product_row"
                            break
                        if "list_static:" in n:
                            month_last_fail = "selection_not_committed"
                            break
                        if "same_product_deadline:" in n:
                            month_last_fail = "timeout"
                            break
                        if "click_fail:" in n:
                            month_last_fail = "selection_not_committed"
                            break
                        if "calendar_selection_unchanged:" in n:
                            month_last_fail = "selection_not_committed"
                            break
                        if "departure_row_incomplete:" in n:
                            month_last_fail = "row_incomplete"
                            break
                        if "list_refresh_unverified" in n:
                            month_last_fail = "list_refresh_unverified"
                            break
                    if not days:
                        month_last_fail = "no_days"
                    print(
                        f"E2E_MONTH_VERIFY\t{wy:04d}-{wm:02d}\tfound=false\tfirstMatchedIso=\tfail_reason={month_last_fail}",
                        flush=True,
                    )
                    month_verify_results.append(
                        {
                            "month": f"{wy:04d}-{wm:02d}",
                            "found": False,
                            "firstMatchedIso": "",
                            "fail_reason": month_last_fail,
                        }
                    )

                _e2e_hanatour_phase(
                    f"month-{wm}-collect-end",
                    month=phase_month,
                    appended_count=month_appended,
                    rows_seen=len(days),
                    current_calendar_label=phase_month,
                )
                _e2e_hanatour_phase(
                    "month_collect_done",
                    month=phase_month,
                    appended_count=month_appended,
                    rows_seen=len(days),
                )
                months_done += 1
                if stop_all_months:
                    break
                if mi >= max_months_eff - 1:
                    break
                if month_appended == 0:
                    notes.append(f"season_end_detected:{phase_month}")
                    break
                t_nm0 = _time.perf_counter()
                nm_ok = await _next_month(page)
                nms = (_time.perf_counter() - t_nm0) * 1000.0
                next_month_nav_ms_acc += nms
                log["e2e_last_next_month_ms"] = round(nms, 1)
                if nm_ok:
                    next_month_ok_count += 1
                    notes.append(f"next_month_ok:from_m{wm}_to_next")
                else:
                    notes.append("next_month_failed")
                    break

            if mfmo and month_verify_results:
                found_cnt = sum(1 for r in month_verify_results if r.get("found"))
                failed = [r for r in month_verify_results if not r.get("found")]
                bc: dict[str, int] = {}
                for r in failed:
                    fk = str(r.get("fail_reason") or "")
                    bc[fk] = bc.get(fk, 0) + 1
                top = max(bc.items(), key=lambda x: x[1])[0] if bc else "none"
                print(
                    f"E2E_MONTH_VERIFY_SUMMARY\tmonthsFound={found_cnt}\ttotal={len(month_verify_results)}\ttopFailReason={top}",
                    flush=True,
                )
                log["e2e_month_verify"] = month_verify_results

            departures = dedupe_departures_by_date(departures)
            if departures:
                try:
                    tr = json.loads((departures[0].get("matchingTraceRaw") or "{}"))
                    log["e2e_sample_scroll_steps"] = tr.get("scrollSteps")
                    log["e2e_calendar_scrolled"] = int(tr.get("scrollSteps") or 0) > 0
                    log["e2e_right_list_changed"] = tr.get("rightListChanged")
                    log["e2e_selected_changed"] = tr.get("selectedChanged")
                except Exception:
                    log["e2e_calendar_scrolled"] = False
            else:
                log["e2e_calendar_scrolled"] = False
            log["collectorStatus"] = "success" if departures else "modal_empty"
            log["modal_row_count"] = len(departures)
            log["e2e_months_requested"] = max_months_eff if target_month_ym else max_months
            log["e2e_months_iterated"] = months_done
            log["e2e_next_month_clicks_ok"] = next_month_ok_count
            if sample_mode and not mfmo:
                _e2e_sample_summary(
                    sample_agg, (_time.perf_counter() - t_sample0) * 1000
                )
                log["e2e_sample_summary"] = {
                    **sample_agg,
                    "totalElapsedMs": round(
                        (_time.perf_counter() - t_sample0) * 1000, 1
                    ),
                }
            t_e2e_month_loop1 = _time.perf_counter()
            timing_days = log.get("e2e_timing_days")
            if not isinstance(timing_days, list):
                timing_days = []
            sum_list = sum(
                float((d or {}).get("listWaitTotalMs") or 0) for d in timing_days
            )
            sum_click = sum(float((d or {}).get("clickMs") or 0) for d in timing_days)
            sum_pre = sum(float((d or {}).get("preListMs") or 0) for d in timing_days)
            sum_match = sum(float((d or {}).get("matchMs") or 0) for d in timing_days)
            wall_month_loop_ms = (t_e2e_month_loop1 - t_e2e_month_loop0) * 1000.0
            anchor_prepare_ms = (t_e2e_month_loop0 - t_e2e_post_modal) * 1000.0
            browser_page_ms = (t_e2e_post_modal - t_e2e_wall0) * 1000.0
            accounted_loop_ms = sum_list + sum_click + sum_pre + sum_match
            log["e2e_bucket_ms"] = {
                "1_browser_page_ms": round(browser_page_ms, 1),
                "2_anchor_month_prepare_ms": round(anchor_prepare_ms, 1),
                "3_month_nav_clicks_ms": round(next_month_nav_ms_acc, 1),
                "4_day_loop_list_wait_ms": round(sum_list, 1),
                "5_day_loop_click_ms": round(sum_click, 1),
                "6_day_loop_pre_list_ms": round(sum_pre, 1),
                "7_day_loop_same_product_ms": round(sum_match, 1),
                "8_month_loop_wall_ms": round(wall_month_loop_ms, 1),
                "9_month_loop_other_ms": round(
                    max(0.0, wall_month_loop_ms - accounted_loop_ms), 1
                ),
            }
            _e2e_timing_phase("month_loop_done")
            return await self._finalize_hanatour_e2e_run(
                self._ret(departures, notes, log, detail_url=detail_url),
                own,
                phase_month=phase_month,
            )
        except BaseException:
            if own and self._pw is not None:
                try:
                    await asyncio.wait_for(
                        close_hanatour_browser(self._pw, self._browser), timeout=8.0
                    )
                except Exception:
                    pass
                self._pw = None
                self._browser = None
                self._page = None
            raise

    def _ret(
        self,
        departures: list[dict],
        notes: list[str],
        log: dict[str, Any],
        *,
        detail_url: str = "",
    ) -> dict[str, Any]:
        _finalize_hanatour_e2e_validation_log(
            log, departures, detail_url, str(log.get("collectorStatus") or "")
        )
        return {
            "departures": departures,
            "notes": notes,
            "log": log,
            "collectorStatus": log.get("collectorStatus"),
            "validation": log.get("e2e_validation"),
        }
