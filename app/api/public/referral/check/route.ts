import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { findReferralByCode } from "@/lib/bongsim/data/referral";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return jsonWithLeakGuard({ ok: false, error: "missing_code" }, "public.referral.check", { status: 400 });
  }

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ ok: false, error: "db_unconfigured" }, "public.referral.check", { status: 503 });
  }

  const c = await pool.connect();
  try {
    const row = await findReferralByCode(c, code);
    if (!row) {
      return jsonWithLeakGuard({ ok: false, status: "notfound" }, "public.referral.check");
    }
    return jsonWithLeakGuard({ ok: true, status: "ok" }, "public.referral.check");
  } catch (e) {
    console.error("[public/referral/check]", e);
    return jsonWithLeakGuard({ ok: false, error: "db_error" }, "public.referral.check", { status: 500 });
  } finally {
    c.release();
  }
}
