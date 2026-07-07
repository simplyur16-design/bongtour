/** Middleware → root layout surface 식별 (simplyur 경량 셸). */
export const SIMPLYUR_SURFACE_HEADER = "x-bt-surface" as const;
export const SIMPLYUR_SURFACE_VALUE = "simplyur" as const;

export function isSimplyurSurfacePath(pathname: string): boolean {
  const p = (pathname.split("?")[0] || "/").replace(/\/$/, "") || "/";
  return p === "/simplyur" || p.startsWith("/simplyur/");
}
