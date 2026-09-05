/**
 * Site chrome 전화/카톡/eSIM bar vs eSIM purchase docks share the same mobile bottom slot.
 * REGRESSION-FREEZE[esim-mobile-web-pay-dock]: hide site bar on purchase funnel — manifest
 */
const ESIM_PURCHASE_DOCK_PREFIXES = [
  "/travel/esim/recommend",
  "/travel/esim/product",
  "/travel/esim/checkout",
  "/travel/esim/order",
  "/travel/esim/result",
] as const;

export function shouldHideMobileStickyBar(pathname: string): boolean {
  const path = (pathname.split("?")[0] || "").replace(/\/$/, "") || "/";
  if (path === "/simplyur" || path.startsWith("/simplyur/")) return true;
  return ESIM_PURCHASE_DOCK_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
