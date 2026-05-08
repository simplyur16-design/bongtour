import type { IssuanceSlot } from "@/lib/coupon/issuance-helpers";
import { issueUserCoupon } from "@/lib/bongsim/data/user-coupon";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/** 어드민 발급 — birthday 슬롯 금지(정책). */
const SLOT_ISSUE: readonly IssuanceSlot[] = ["welcome", "review", "referral_inviter", "referral_invitee"];

type IssueBody = {
  userEmail?: string;
  sourceCouponCode?: string;
  /** welcome | review | referral_* | admin_manual — birthday 불가 */
  issuedVia?: string | null;
  notes?: string | null;
};

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return jsonWithLeakGuard({ error: "unauthorized" }, "admin.bongsim.user-coupons.issue", { status: 401 });

  let body: IssueBody;
  try {
    body = (await req.json()) as IssueBody;
  } catch {
    return jsonWithLeakGuard({ error: "invalid_json" }, "admin.bongsim.user-coupons.issue", { status: 400 });
  }

  const email = typeof body.userEmail === "string" ? body.userEmail.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return jsonWithLeakGuard({ error: "invalid_email" }, "admin.bongsim.user-coupons.issue", { status: 400 });
  }
  const issuedViaRaw = typeof body.issuedVia === "string" ? body.issuedVia.trim() : "admin_manual";
  if (issuedViaRaw === "birthday") {
    return jsonWithLeakGuard({ error: "birthday_slot_disabled" }, "admin.bongsim.user-coupons.issue", { status: 400 });
  }

  const sourceCouponCode = typeof body.sourceCouponCode === "string" ? body.sourceCouponCode.trim() : "";
  const useSlotIssue = SLOT_ISSUE.includes(issuedViaRaw as IssuanceSlot);
  if (!useSlotIssue && issuedViaRaw !== "admin_manual") {
    return jsonWithLeakGuard({ error: "invalid_issued_via" }, "admin.bongsim.user-coupons.issue", { status: 400 });
  }
  if (!useSlotIssue && !sourceCouponCode) {
    return jsonWithLeakGuard({ error: "missing_source_coupon_code" }, "admin.bongsim.user-coupons.issue", { status: 400 });
  }
  if (useSlotIssue && sourceCouponCode) {
    return jsonWithLeakGuard({ error: "slot_issue_conflicts_with_template_code" }, "admin.bongsim.user-coupons.issue", {
      status: 400,
    });
  }
  const memo = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;

  const pool = getPgPool();
  if (!pool) return jsonWithLeakGuard({ error: "db_unconfigured" }, "admin.bongsim.user-coupons.issue", { status: 503 });

  const client = await pool.connect();
  try {
    const ur = await client.query<{ id: string }>(`SELECT id FROM "User" WHERE lower(email) = lower($1) LIMIT 1`, [email]);
    const userRow = ur.rows[0];
    if (!userRow) {
      return jsonWithLeakGuard({ error: "user_not_found" }, "admin.bongsim.user-coupons.issue", { status: 404 });
    }

    const issueSlot: IssuanceSlot = useSlotIssue ? (issuedViaRaw as IssuanceSlot) : "admin_manual";
    let sourceOverride: string | undefined;

    if (!useSlotIssue) {
      const cr = await client.query<{ coupon_id: string }>(
        `SELECT coupon_id::text FROM bongsim_coupon WHERE lower(code) = lower($1) AND coupon_kind = 'issuance_template' LIMIT 1`,
        [sourceCouponCode],
      );
      const couponRow = cr.rows[0];
      if (!couponRow) {
        return jsonWithLeakGuard({ error: "template_not_found_or_not_issuance" }, "admin.bongsim.user-coupons.issue", {
          status: 404,
        });
      }
      sourceOverride = couponRow.coupon_id;
    }

    const issued = await issueUserCoupon(
      client,
      {
        slot: issueSlot,
        userId: userRow.id,
        userEmail: email,
        sourceCouponIdOverride: sourceOverride,
        notes: memo,
      },
      new Date(),
    );

    if (!issued.issued || !issued.userCouponId) {
      return jsonWithLeakGuard({ error: "issue_failed" }, "admin.bongsim.user-coupons.issue", { status: 409 });
    }

    const lr = await client.query(
      `SELECT user_coupon_id::text AS user_coupon_id, user_email, source_coupon_id::text AS source_coupon_id,
              issued_via, issued_at, expires_at, status
         FROM bongsim_user_coupon WHERE user_coupon_id = $1::uuid`,
      [issued.userCouponId],
    );
    const row = lr.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      return jsonWithLeakGuard({ error: "issue_fetch_failed" }, "admin.bongsim.user-coupons.issue", { status: 500 });
    }

    return jsonWithLeakGuard(
      {
        ok: true,
        userCoupon: {
          user_coupon_id: row.user_coupon_id,
          user_email: row.user_email,
          source_coupon_id: row.source_coupon_id,
          issued_via: row.issued_via,
          issued_at: row.issued_at,
          expires_at: row.expires_at,
          status: row.status,
          memo,
        },
      },
      "admin.bongsim.user-coupons.issue.response",
    );
  } catch (e) {
    console.error("[admin/bongsim/user-coupons/issue]", e);
    return jsonWithLeakGuard({ error: "issue_error" }, "admin.bongsim.user-coupons.issue", { status: 500 });
  } finally {
    client.release();
  }
}
