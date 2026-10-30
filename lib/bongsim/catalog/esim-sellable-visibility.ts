/**
 * REGRESSION-FREEZE[bongsim-esim-hide-unavailable]: 판매 불가 eSIM은 「없음/품절」 표기 없이 아예 숨김 — manifest
 *
 * 판매 가능(sellable) SSOT = `BONGSIM_CATALOG_ACTIVE_WHERE`(is_active·eSIM·소비자가·신규상품 컷오버)를 통과한 행.
 * 이 파일은 Edge(middleware)·클라이언트에서도 쓰므로 DB/Node 의존성 금지 — 순수 함수만.
 */

/** 판매 가능 여부 API — middleware·클라 공용 경로 */
export const BONGSIM_SELLABLE_API_PATH = "/api/bongsim/sellable";

const OPTION_API_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ISO2_RE = /^[a-z]{2}$/;
const REGION_PACK_RE = /^rg-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `/travel/esim/product/<id>` → id (하위 경로·빈 값은 null) */
export function esimProductOptionIdFromPath(pathname: string): string | null {
  const prefix = "/travel/esim/product/";
  if (!pathname.startsWith(prefix)) return null;
  let rest = pathname.slice(prefix.length);
  if (rest.endsWith("/")) rest = rest.slice(0, -1);
  if (!rest || rest.includes("/")) return null;
  let id: string;
  try {
    id = decodeURIComponent(rest).trim();
  } catch {
    return null;
  }
  return id.length > 0 ? id : null;
}

/** 형식상 존재할 수 없는 상품 ID — DB 조회 없이 바로 404 */
export function isWellFormedOptionApiId(id: string): boolean {
  return OPTION_API_ID_RE.test(id);
}

/** 국가/권역 코드 정규화 — ISO2 또는 rg-* 만 허용 */
export function normalizeEsimDestinationCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  if (code.length === 0 || code.length > 40) return null;
  if (ISO2_RE.test(code) || REGION_PACK_RE.test(code)) return code;
  return null;
}

/** 국가/권역 pack(by-country 결과 1건)에 판매 가능 플랜이 1개 이상인지 */
export function packHasSellablePlans(
  pack:
    | {
        roaming?: { products?: readonly unknown[] } | null;
        local?: { products?: readonly unknown[] } | null;
      }
    | null
    | undefined,
): boolean {
  if (!pack) return false;
  const roaming = pack.roaming?.products?.length ?? 0;
  const local = pack.local?.products?.length ?? 0;
  return roaming + local > 0;
}

/**
 * 목적지 타일(홈 인기·랜딩·다국가) — 판매 가능 코드 집합으로 거름.
 * sellable === null(목록 로드 실패/로딩 중)이면 기존 목록 유지(fail-open) — 장애 시 빈 화면 방지.
 */
export function filterSellableDestinations<T extends { code: string }>(
  items: readonly T[],
  sellable: ReadonlySet<string> | null,
): T[] {
  if (!sellable) return [...items];
  return items.filter((it) => sellable.has(it.code.trim().toLowerCase()));
}

/** 플랜 유형 탭 — 0건 탭은 비활성 표시 대신 아예 숨김 */
export function planTabsWithSellablePlans<T extends string>(
  tabs: readonly T[],
  counts: Readonly<Record<T, number>>,
): T[] {
  return tabs.filter((t) => (counts[t] ?? 0) > 0);
}

/** 플랜 그리드 열 수 → Tailwind 정적 클래스 (동적 문자열 생성 금지) */
export function planGridColsClass(columnCount: number): string {
  if (columnCount <= 1) return "grid-cols-1";
  if (columnCount === 2) return "grid-cols-2";
  return "grid-cols-3";
}
