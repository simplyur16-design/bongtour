/**
 * eSIM·simplyur 공개 경로 속도 실측 (TTFB + 전체 응답).
 *
 *   npx tsx scripts/audit-esim-route-speed.ts
 *   PERF_BASE_URL=https://bongtour.com npx tsx scripts/audit-esim-route-speed.ts
 */
const BASE = (process.env.PERF_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const RUNS = Number(process.env.PERF_RUNS ?? "3");

type Sample = { label: string; kind: string; ttfbMs: number; totalMs: number; status: number; bytes: number };

async function measureOnce(
  path: string,
  accept = "text/html",
): Promise<{ ttfbMs: number; totalMs: number; status: number; bytes: number }> {
  const t0 = performance.now();
  let ttfbMs = 0;
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: accept, "User-Agent": "BongTourEsimSpeedAudit/1.0" },
    redirect: "follow",
  });
  ttfbMs = Math.round(performance.now() - t0);
  const body = await res.text();
  const totalMs = Math.round(performance.now() - t0);
  return { ttfbMs, totalMs, status: res.status, bytes: body.length };
}

async function measureAvg(label: string, kind: string, path: string, accept?: string): Promise<Sample> {
  const runs: { ttfbMs: number; totalMs: number; status: number; bytes: number }[] = [];
  for (let i = 0; i < RUNS; i++) {
    runs.push(await measureOnce(path, accept));
  }
  const ttfbMs = Math.round(runs.reduce((s, r) => s + r.ttfbMs, 0) / runs.length);
  const totalMs = Math.round(runs.reduce((s, r) => s + r.totalMs, 0) / runs.length);
  const status = runs[runs.length - 1]!.status;
  const bytes = runs[runs.length - 1]!.bytes;
  return { label, kind, ttfbMs, totalMs, status, bytes };
}

async function resolveSimplyurProductPath(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/simplyur/products/by-country?locale=en`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      pack?: { roaming?: { products?: { option_api_id?: string }[] } };
    };
    const id = j.pack?.roaming?.products?.[0]?.option_api_id?.trim();
    return id ? `/simplyur/en/product/${encodeURIComponent(id)}` : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`=== eSIM route speed audit (${BASE}, ${RUNS} runs avg) ===\n`);

  const productPath = await resolveSimplyurProductPath();

  const targets: { label: string; kind: string; path: string; accept?: string }[] = [
    { label: "simplyur home", kind: "page", path: "/simplyur/en" },
    { label: "simplyur recommend", kind: "page", path: "/simplyur/en/recommend" },
    { label: "simplyur checkout", kind: "page", path: "/simplyur/en/checkout?optionApiId=dummy" },
    { label: "bongsim esim landing", kind: "page", path: "/travel/esim" },
    { label: "bongsim catalog", kind: "page", path: "/travel/esim/catalog" },
    { label: "bongsim recommend", kind: "page", path: "/travel/esim/recommend" },
    { label: "api simplyur catalog", kind: "api", path: "/api/simplyur/products/by-country?locale=en", accept: "application/json" },
    { label: "api bongsim countries", kind: "api", path: "/api/bongsim/countries", accept: "application/json" },
    { label: "api bongsim heroes", kind: "api", path: "/api/bongsim/country-heroes", accept: "application/json" },
  ];

  if (productPath) {
    targets.splice(2, 0, { label: "simplyur product", kind: "page", path: productPath });
  }

  const rows: Sample[] = [];
  for (const t of targets) {
    const row = await measureAvg(t.label, t.kind, t.path, t.accept);
    rows.push(row);
    const kb = (row.bytes / 1024).toFixed(0);
    console.log(
      `${row.totalMs}ms (ttfb ${row.ttfbMs}ms)\t${row.status}\t[${row.kind}]\t${row.label}\t${kb}KB`,
    );
  }

  console.log("\n=== 1초 초과 (total) ===\n");
  const slow = rows.filter((r) => r.totalMs > 1000).sort((a, b) => b.totalMs - a.totalMs);
  if (!slow.length) console.log("없음");
  else for (const r of slow) console.log(`${r.totalMs}ms\t${r.label}`);

  console.log("\n=== TTFB 500ms 초과 ===\n");
  const slowTtfb = rows.filter((r) => r.ttfbMs > 500).sort((a, b) => b.ttfbMs - a.ttfbMs);
  if (!slowTtfb.length) console.log("없음");
  else for (const r of slowTtfb) console.log(`${r.ttfbMs}ms\t${r.label}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
