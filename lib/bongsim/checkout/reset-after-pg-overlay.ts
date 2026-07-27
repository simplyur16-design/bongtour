/**
 * 웰컴페이 INIStdPay(overlay) 등 PG 레이어가 body/html 스타일·DOM을 건드린 뒤
 * 남는 스크롤 잠금·레이아웃·투명 오버레이 잔재를 제거한다. 클라이언트 전용.
 * REGRESSION-FREEZE[welcomepay-esim-payment]: reset overlay on retry — manifest
 */

const WELCOMEPAY_OVERLAY_SELECTORS = [
  "#inicisModalDiv",
  "#inicisModalBg",
  "#paywelcome_layer",
  "#paywelcome_modal",
  "#allat_layer",
  "iframe[src*='paywelcome.co.kr']",
  "iframe[src*='inicis.com']",
  "iframe[name*='inicis']",
  "iframe[id*='inicis']",
  "div[id*='inicisModal']",
  "div[class*='inicisModal']",
] as const;

function removeMatchingOverlayNodes(): number {
  if (typeof document === "undefined") return 0;
  let removed = 0;
  for (const sel of WELCOMEPAY_OVERLAY_SELECTORS) {
    document.querySelectorAll(sel).forEach((el) => {
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

export function resetAfterPgOverlay(): void {
  if (typeof document === "undefined") return;
  const body = document.body;
  const html = document.documentElement;
  body.style.removeProperty("overflow");
  body.style.removeProperty("position");
  body.style.removeProperty("top");
  body.style.removeProperty("left");
  body.style.removeProperty("right");
  body.style.removeProperty("bottom");
  body.style.removeProperty("width");
  body.style.removeProperty("height");
  body.style.removeProperty("max-height");
  body.style.removeProperty("touch-action");
  body.style.removeProperty("padding-right");
  body.style.removeProperty("margin-right");
  body.style.removeProperty("pointer-events");
  html.style.removeProperty("overflow");
  html.style.removeProperty("position");
  html.style.removeProperty("height");
  html.style.removeProperty("pointer-events");
  body.classList.remove("modal-open", "inicis-modal-open");
  html.classList.remove("modal-open", "inicis-modal-open");
  removeMatchingOverlayNodes();
  try {
    window.scrollTo(0, window.scrollY);
  } catch {
    /* ignore */
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
