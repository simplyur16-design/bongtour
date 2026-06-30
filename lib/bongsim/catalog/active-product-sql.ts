/**
 * 고객-facing 카탈로그·체크아웃 — 판매 중이며 eSIM 발급 가능한 옵션만.
 * `sim_kind`에 esim(대소문자 무시) 포함 시 통과 — eSIM/uSIM, eSIM/Usim 등 포함.
 */
export const BONGSIM_CATALOG_ESIM_CAPABLE_WHERE = "sim_kind ILIKE '%esim%'";

export const BONGSIM_CATALOG_ACTIVE_WHERE = `is_active = true AND ${BONGSIM_CATALOG_ESIM_CAPABLE_WHERE}`;

/** 매장 오프라인 USIM — eSIM·uSIM 겸용(active) 옵션만 */
export const BONGSIM_CATALOG_USIM_CAPABLE_WHERE = "sim_kind ILIKE '%usim%'";

export const BONGSIM_CATALOG_OFFLINE_USIM_WHERE = `${BONGSIM_CATALOG_ACTIVE_WHERE} AND ${BONGSIM_CATALOG_USIM_CAPABLE_WHERE}`;

/** DB `sim_kind` — eSIM 발급 가능 여부 (화이트리스트) */
export function isEsimCapableSimKind(simKind: string | null | undefined): boolean {
  const s = (simKind ?? "").trim();
  if (!s) return false;
  return s.toLowerCase().includes("esim");
}
