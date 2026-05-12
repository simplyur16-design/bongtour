/**
 * USIMSA 엑셀 원문(`network_raw`, `internet_raw`, `qos_raw`) 파싱 — DB·ingest 변경 없음.
 */

export type NetworkGeneration = "g5" | "g4_lte" | "g4" | "g3" | "mixed" | "unknown";

/**
 * `network_raw`에서 세대 추출. 복수 표기 시 g5 > g4_lte > g4 > g3 우선순위로 단일 값 반환.
 */
export function parseNetworkGeneration(networkRaw: string | null | undefined): NetworkGeneration {
  const s = String(networkRaw ?? "").trim();
  if (!s) return "unknown";

  const has5g = /5\s*g\b/i.test(s);
  const hasLte = /lte/i.test(s) || /4\s*g\s*\(\s*lte\s*\)/i.test(s);
  const has4g = /4\s*g\b/i.test(s);
  const has3g = /3\s*g\b/i.test(s);

  const hits: NetworkGeneration[] = [];
  if (has5g) hits.push("g5");
  if (hasLte) hits.push("g4_lte");
  else if (has4g) hits.push("g4");
  if (has3g) hits.push("g3");

  if (hits.length === 0) return "unknown";
  if (hits.length >= 2) {
    const order: NetworkGeneration[] = ["g5", "g4_lte", "g4", "g3"];
    for (const gen of order) {
      if (hits.includes(gen)) return gen;
    }
    return "mixed";
  }
  return hits[0]!;
}

/** QOS 문자열 → kbps 정수. `-`/빈 값은 null. */
export function parseQosKbps(qosRaw: string | null | undefined): number | null {
  const t = String(qosRaw ?? "").trim();
  if (!t || t === "-") return null;

  const low = t.toLowerCase().replace(/\s+/g, " ");

  const mb = low.match(/(\d+(?:\.\d+)?)\s*mbps/i);
  if (mb) {
    const n = parseFloat(mb[1]!);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1000);
  }

  const kb = low.match(/(\d+(?:\.\d+)?)\s*kbps/i);
  if (kb) {
    const n = parseFloat(kb[1]!);
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
  }

  return null;
}

/** 로컬 망 여부: `network_family` 우선, 그다음 `internet_raw` (보수적). */
export function isLocalNetwork(
  internetRaw: string | null | undefined,
  networkFamily: string | null | undefined,
): boolean {
  const nf = String(networkFamily ?? "").trim().toLowerCase();
  if (nf === "local") return true;

  const ir = String(internetRaw ?? "");
  if (/roaming/i.test(ir)) return false;
  if (/local/i.test(ir)) return true;
  return false;
}

export function isUnlimitedPlan(
  allowanceLabel: string | null | undefined,
  planType: string | null | undefined,
  planLineExcel: string | null | undefined,
): boolean {
  const al = String(allowanceLabel ?? "");
  if (/무제한/i.test(al)) return true;
  if (/unlimited/i.test(al)) return true;

  if (String(planType ?? "").trim().toLowerCase() === "unlimited") return true;

  const pl = String(planLineExcel ?? "").trim();
  if (pl === "무제한") return true;
  if (/unlimited/i.test(pl)) return true;

  return false;
}
