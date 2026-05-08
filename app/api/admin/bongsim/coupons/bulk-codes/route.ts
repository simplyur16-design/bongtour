import { randomBytes } from "node:crypto";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

type BulkTemplate = {
  discount_type?: string;
  discount_value?: number;
  max_discount_krw?: number | null;
  min_order_krw?: number | null;
  usage_limit?: number | null;
  valid_from?: string;
  valid_until?: string;
  description?: string | null;
};

type BulkBody = {
  prefix?: string;
  count?: number;
  template?: BulkTemplate;
};

function genBulkCode(prefix: string): string {
  return `${prefix}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** 접두어·개수 기반 공개 코드 다량 생성 (여행 감사 벌크는 `POST .../coupons/bulk` 사용). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.coupons.bulk-codes", { status: 401 });

  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return jsonWithLeakGuard({ error: "invalid_json" }, "admin.bongsim.coupons.bulk-codes", { status: 400 });
  }

  const prefixRaw = typeof body.prefix === "string" ? body.prefix.trim() : "";
  if (!/^[A-Za-z0-9]+$/.test(prefixRaw)) {
    return jsonWithLeakGuard({ error: "invalid_prefix" }, "admin.bongsim.coupons.bulk-codes", { status: 400 });
  }
  const count = typeof body.count === "number" && Number.isFinite(body.count) ? Math.trunc(body.count) : Number.NaN;
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    return jsonWithLeakGuard({ error: "invalid_count" }, "admin.bongsim.coupons.bulk-codes", { status: 400 });
  }

  const tpl = body.template ?? {};
  const discount_type = tpl.discount_type === "percent" ? "percent" : "fixed";
  const dv =
    typeof tpl.discount_value === "number" && Number.isFinite(tpl.discount_value) ? tpl.discount_value : Number.NaN;
  if (!Number.isFinite(dv) || dv < 0) {
    return jsonWithLeakGuard({ error: "invalid_discount_value" }, "admin.bongsim.coupons.bulk-codes", { status: 400 });
  }
  const max_disc =
    tpl.max_discount_krw == null || (typeof tpl.max_discount_krw === "string" && tpl.max_discount_krw === "")
      ? null
      : Math.trunc(Number(tpl.max_discount_krw));
  const min_order =
    tpl.min_order_krw == null || (typeof tpl.min_order_krw === "string" && tpl.min_order_krw === "")
      ? 0
      : Math.max(0, Math.trunc(Number(tpl.min_order_krw)));
  const usage_limit =
    tpl.usage_limit == null || (typeof tpl.usage_limit === "string" && tpl.usage_limit === "")
      ? null
      : Math.max(1, Math.trunc(Number(tpl.usage_limit)));
  const valid_from =
    typeof tpl.valid_from === "string" && tpl.valid_from.trim() ? new Date(tpl.valid_from) : new Date();
  const valid_until =
    typeof tpl.valid_until === "string" && tpl.valid_until.trim()
      ? new Date(tpl.valid_until)
      : new Date(valid_from.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(valid_from.getTime()) || Number.isNaN(valid_until.getTime()) || valid_until <= valid_from) {
    return jsonWithLeakGuard({ error: "invalid_dates" }, "admin.bongsim.coupons.bulk-codes", { status: 400 });
  }
  const description =
    typeof tpl.description === "string" && tpl.description.trim() ? tpl.description.trim().slice(0, 500) : null;

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.coupons.bulk-codes", { status: 503 });

  const codes: string[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < count; i++) {
      let inserted = false;
      for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
        const code = genBulkCode(prefixRaw);
        try {
          await client.query(
            `INSERT INTO bongsim_coupon (
               code, description, discount_type, discount_value, max_discount_krw, min_order_krw,
               usage_limit, used_count, valid_from, valid_until, is_active, coupon_kind
             ) VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, 0, $8, $9, true, 'public_code')`,
            [
              code.slice(0, 64),
              description,
              discount_type,
              String(dv),
              max_disc != null && Number.isFinite(max_disc) ? max_disc : null,
              min_order,
              usage_limit,
              valid_from.toISOString(),
              valid_until.toISOString(),
            ],
          );
          codes.push(code);
          inserted = true;
        } catch (e) {
          const err = e as { code?: string };
          if (err.code === "23505") continue;
          throw e;
        }
      }
      if (!inserted) {
        await client.query("ROLLBACK");
        return jsonWithLeakGuard({ error: "unique_collision_exhausted" }, "admin.bongsim.coupons.bulk-codes", {
          status: 409,
        });
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* noop */
    }
    const err = e as { code?: string };
    if (err.code === "42P01")
      return jsonWithLeakGuard({ error: "coupon_table_missing" }, "admin.bongsim.coupons.bulk-codes", { status: 503 });
    console.error("[admin/bongsim/coupons/bulk-codes]", e);
    return jsonWithLeakGuard({ error: "insert_failed" }, "admin.bongsim.coupons.bulk-codes", { status: 500 });
  } finally {
    client.release();
  }

  return jsonWithLeakGuard({ ok: true, created: codes.length, codes }, "admin.bongsim.coupons.bulk-codes.response");
}
