/**
 * 웰컴페이 INIStdPay(overlay) 등 PG 레이어가 body/html 스타일·DOM을 건드린 뒤
 * 남는 스크롤 잠금·레이아웃·투명 오버레이 잔재를 제거한다. 클라이언트 전용.
 * REGRESSION-FREEZE[welcomepay-esim-payment]: reset overlay on retry — manifest
 */

const WELCOMEPAY_OVERLAY_SELECTORS = [
  "#inicisModalDiv",
  "#inicisModalBg",
  "#inicisModalDiv iframe",
  "#paywelcome_layer",
  "#paywelcome_modal",
  "#allat_layer",
  "#allat_div",
  "#layer_all",
  "#inipay_modal",
  ".inipay_modal",
  "iframe[src*='paywelcome.co.kr']",
  "iframe[src*='inicis.com']",
  "iframe[src*='stdpay']",
  "iframe[name*='inicis']",
  "iframe[id*='inicis']",
  "iframe[name*='ini']",
  "div[id*='inicisModal']",
  "div[class*='inicisModal']",
  "div[id*='INIStdPay']",
  "div[class*='INIStdPay']",
] as const;

function removeMatchingOverlayNodes(doc: Document): number {
  let removed = 0;
  for (const sel of WELCOMEPAY_OVERLAY_SELECTORS) {
    doc.querySelectorAll(sel).forEach((el) => {
      try {
        el.parentNode?.removeChild(el);
        removed += 1;
      } catch {
        /* ignore */
      }
    });
  }
  return removed;
}

function clearScrollLockStyles(el: HTMLElement | null | undefined): void {
  if (!el?.style) return;
  el.style.removeProperty("overflow");
  el.style.removeProperty("overflow-x");
  el.style.removeProperty("overflow-y");
  el.style.removeProperty("position");
  el.style.removeProperty("top");
  el.style.removeProperty("left");
  el.style.removeProperty("right");
  el.style.removeProperty("bottom");
  el.style.removeProperty("width");
  el.style.removeProperty("height");
  el.style.removeProperty("max-height");
  el.style.removeProperty("touch-action");
  el.style.removeProperty("padding-right");
  el.style.removeProperty("margin-right");
  el.style.removeProperty("pointer-events");
}

function unlockDocument(doc: Document, win: Window): void {
  const body = doc.body;
  const html = doc.documentElement;
  let scrollY = 0;
  try {
    const topRaw = body?.style?.top ?? "";
    const m = /^-?\d+/.exec(topRaw);
    if (m) {
      const n = Number.parseInt(m[0]!, 10);
      if (Number.isFinite(n)) scrollY = Math.abs(n);
    } else if (typeof win.scrollY === "number" && win.scrollY > 0) {
      scrollY = win.scrollY;
    }
  } catch {
    /* ignore */
  }
  clearScrollLockStyles(body);
  clearScrollLockStyles(html);
  body?.classList.remove("modal-open", "inicis-modal-open", "noscroll", "no-scroll");
  html?.classList.remove("modal-open", "inicis-modal-open", "noscroll", "no-scroll");
  removeMatchingOverlayNodes(doc);
  try {
    win.scrollTo(0, scrollY);
  } catch {
    /* ignore */
  }
}

function sameOriginTop(): Window | null {
  if (typeof window === "undefined") return null;
  try {
    const topWin = window.top;
    if (!topWin || topWin === window) return null;
    // same-origin probe
    void topWin.document.location.href;
    return topWin;
  } catch {
    return null;
  }
}

/**
 * PG overlay iframe 안에서 결과·닫기 페이지가 열린 경우 top으로 탈출.
 * true면 top 네비게이션을 걸었으므로 현재 프레임은 정리만 하면 됨.
 */
export function breakOutOfPgFrameIfNeeded(): boolean {
  if (typeof window === "undefined") return false;
  const topWin = sameOriginTop();
  if (!topWin) return false;
  try {
    const href = window.location.href;
    if (!href || topWin.location.href === href) {
      unlockDocument(topWin.document, topWin);
      return false;
    }
    topWin.location.replace(href);
    return true;
  } catch {
    return false;
  }
}

/** top(가능하면) 문서로 하드 이동 — 재결제·취소 복귀용 */
export function navigateTopHard(href: string): void {
  if (typeof window === "undefined") return;
  const target = href.trim();
  if (!target) return;
  resetAfterPgOverlay();
  try {
    const topWin = window.top ?? window;
    topWin.location.assign(target);
  } catch {
    window.location.assign(target);
  }
}

export function resetAfterPgOverlay(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  unlockDocument(document, window);
  const topWin = sameOriginTop();
  if (topWin) {
    try {
      unlockDocument(topWin.document, topWin);
    } catch {
      /* ignore */
    }
  }
}

/**
 * 로드한 INIStdPay 스크립트 태그 제거(언마운트 시). 전역은 PG가 재주입할 수 있어 유지해도 되나,
 * 중복 로드·정리 시나리오에서 스크립트 노드는 제거하는 편이 안전하다.
 */
export function removeWelcomepayIniScriptNodes(): void {
  if (typeof document === "undefined") return;
  document.querySelectorAll("script[data-welcomepay-ini='1']").forEach((el) => {
    try {
      el.parentNode?.removeChild(el);
    } catch {
      /* ignore */
    }
  });
}

/** 테스트·진단용 — 셀렉터 목록 */
export function listWelcomepayOverlayCleanupSelectors(): readonly string[] {
  return WELCOMEPAY_OVERLAY_SELECTORS;
}

/** PC overlay 존재 여부 폴링용 — cleanup 목록과 동일 SSOT */
export function welcomepayOverlayPresentSelector(): string {
  return WELCOMEPAY_OVERLAY_SELECTORS.join(", ");
}

/**
 * INIStdPay.pay 직후 — 오버레이가 아직 안 뜬 타이밍에 reset 하면 창이 즉시 사라짐.
 * 한 번이라도 보인 뒤에만 "닫힘"으로 판정. graceMs 전에는 미등장도 대기.
 * REGRESSION-FREEZE[welcomepay-esim-payment]: overlay poll seen-once — manifest
 */
export function watchWelcomepayOverlayUntilClosed(opts?: {
  graceMs?: number;
  pollMs?: number;
  maxMs?: number;
  onClosed?: () => void;
}): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }
  const graceMs = Math.max(500, opts?.graceMs ?? 2_500);
  const pollMs = Math.max(100, opts?.pollMs ?? 400);
  const maxMs = Math.max(graceMs + 1_000, opts?.maxMs ?? 10 * 60 * 1_000);
  const sel = welcomepayOverlayPresentSelector();
  const startedAt = Date.now();
  let seen = false;
  const poll = window.setInterval(() => {
    const open = document.querySelector(sel);
    if (open) {
      seen = true;
      return;
    }
    const elapsed = Date.now() - startedAt;
    if (!seen && elapsed < graceMs) return;
    if (!seen && elapsed >= graceMs) {
      // never mounted — unlock UI only; do not nuke (nothing to remove yet / avoid race)
      window.clearInterval(poll);
      opts?.onClosed?.();
      return;
    }
    // seen once, now gone → closed
    window.clearInterval(poll);
    resetAfterPgOverlay();
    opts?.onClosed?.();
  }, pollMs);
  const hardStop = window.setTimeout(() => {
    window.clearInterval(poll);
  }, maxMs);
  return () => {
    window.clearInterval(poll);
    window.clearTimeout(hardStop);
  };
}
