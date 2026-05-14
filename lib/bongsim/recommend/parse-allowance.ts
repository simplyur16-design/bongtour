export type AllowanceKind = "unlimited" | "mb" | "unknown";

export type ParsedAllowance =
  | { kind: "unlimited" }
  | { kind: "mb"; mb: number }
  | { kind: "unknown" };

const RE_GB = /(\d+(?:\.\d+)?)\s*gb\b/i;
const RE_MB = /(\d+(?:\.\d+)?)\s*mb\b/i;

/**
 * `allowance_label` 파싱. 무제한 → unlimited. 용량은 GB 매칭 우선, 없으면 MB.
 * 합성 라벨은 첫 매칭만 사용.
 */
export function parseAllowance(allowanceLabel: string | null | undefined): ParsedAllowance {
  const s = String(allowanceLabel ?? "").trim();
  if (!s) return { kind: "unknown" };

  if (/무제한/i.test(s) || /unlimited/i.test(s)) {
    return { kind: "unlimited" };
  }

  const gb = s.match(RE_GB);
  if (gb) {
    const n = parseFloat(gb[1]!);
    if (Number.isFinite(n)) return { kind: "mb", mb: Math.round(n * 1024) };
  }

  const mb = s.match(RE_MB);
  if (mb) {
    const n = parseFloat(mb[1]!);
    if (Number.isFinite(n)) return { kind: "mb", mb: Math.round(n) };
  }

  return { kind: "unknown" };
}

/**
 * `ParsedAllowance` 타입 가드. `kind === 'mb'`일 때 `.mb` 접근을 위한 narrow 보존용.
 * `.filter` 안에서 destructure를 쓰면 TS narrowing이 풀리는 문제를 회피한다.
 */
export function isParsedAllowanceMb(
  parsed: ParsedAllowance,
): parsed is { kind: "mb"; mb: number } {
  return parsed.kind === "mb";
}

/** 2GB 이하 용량(가벼운 사용 패턴 슬롯 후보). */
export function isGentleAllowance(parsed: ParsedAllowance): boolean {
  return parsed.kind === "mb" && parsed.mb <= 2048;
}

export function allowanceTierBucket(parsed: ParsedAllowance): "large" | "medium" | "small" | "na" {
  if (parsed.kind === "unlimited") return "na";
  if (parsed.kind !== "mb") return "na";
  const { mb } = parsed;
  if (mb >= 1500) return "large";
  if (mb >= 800) return "medium";
  if (mb >= 1) return "small";
  return "na";
}
