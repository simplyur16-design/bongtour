/**
 * 웰컴페이 INIStdPay(overlay) 등 PG 레이어가 body/html 스타일을 건드린 뒤
 * 남는 스크롤 잠금·레이아웃 잔재를 제거한다. 클라이언트 전용.
 */
export function resetAfterPgOverlay(): void {
  if (typeof document === "undefined") return;
  const body = document.body;
  const html = document.documentElement;
  body.style.removeProperty("overflow");
  body.style.removeProperty("position");
  body.style.removeProperty("top");
  body.style.removeProperty("left");
  body.style.removeProperty("width");
  body.style.removeProperty("height");
  body.style.removeProperty("touch-action");
  body.style.removeProperty("padding-right");
  html.style.removeProperty("overflow");
  html.style.removeProperty("position");
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
