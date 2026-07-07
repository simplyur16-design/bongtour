/** One-off: PortOne REST API auth smoke (no payment id printed). */
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { PORTONE_API_ORIGIN, resolvePortoneCoreEnv } from "@/lib/simplyur/payments/portone-env";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const core = resolvePortoneCoreEnv();
  if (!core.ok) {
    console.error("[fail] env:", core.missing.join(", "));
    process.exit(1);
  }
  const res = await fetch(`${PORTONE_API_ORIGIN}/payments/su-verify-smoke-not-found`, {
    headers: { Authorization: `PortOne ${core.env.apiSecret}` },
  });
  // 404 = auth OK, payment missing; 401 = bad secret
  if (res.status === 401) {
    console.error("[fail] PortOne API returned 401 — check PORTONE_API_SECRET");
    process.exit(1);
  }
  console.log(`[ok] PortOne API auth smoke → HTTP ${res.status}`);
}

void main();
