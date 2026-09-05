/**
 * Site chrome 전화/카톡/eSIM bar vs page-owned mobile bottom docks share the same slot.
 * REGRESSION-FREEZE[esim-mobile-web-pay-dock]: hide site bar on purchase funnel — manifest
 * REGRESSION-FREEZE[site-chrome-hide-own-bottom-dock]: mypage + 연수 상세 자체 독 — manifest
 */
const ESIM_PURCHASE_DOCK_PREFIXES = [
  "/travel/esim/recommend",
  "/travel/esim/product",
  "/travel/esim/checkout",
  "/travel/esim/order",
  "/travel/esim/result",
] as const;

function normalizeChromePath(pathname: string): string {
  return (pathname.split("?")[0] || "").replace(/\/$/, "") || "/";
}

function isMypagePath(path: string): boolean {
  return path === "/mypage" || path.startsWith("/mypage/");
}

/** 목록 `/business/programs` 는 상담 바 유지. 상세만 문의 독이 바닥을 씀. */
function isTrainingProgramDetailPath(path: string): boolean {
  return path.startsWith("/business/programs/");
}

export function shouldHideMobileStickyBar(pathname: string): boolean {
  const path = normalizeChromePath(pathname);
  if (path === "/simplyur" || path.startsWith("/simplyur/")) return true;
  if (isMypagePath(path) || isTrainingProgramDetailPath(path)) return true;
  return ESIM_PURCHASE_DOCK_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
