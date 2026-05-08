import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { auth } from "@/auth";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { getOrCreateReferralCode } from "@/lib/bongsim/data/referral";
import { getTemplateBySlot } from "@/lib/coupon/issuance-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!userId) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "bongsim.mypage.referral.code", { status: 401 });
  }

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.mypage.referral.code", { status: 503 });
  }

  const c = await pool.connect();
  try {
    const row = await getOrCreateReferralCode(c, userId);
    const invT = await getTemplateBySlot(c, "referral_inviter");
    const inT = await getTemplateBySlot(c, "referral_invitee");
    const shareUrl = `https://www.bongtour.com/?ref=${encodeURIComponent(row.code)}`;
    return jsonWithLeakGuard(
      {
        code: row.code,
        share_url: shareUrl,
        total_invited: row.total_invited,
        total_rewarded: row.total_rewarded,
        inviter_template: {
          discount_value: invT?.discount_value ?? "0",
          validity_days: invT?.template_validity_days ?? null,
        },
        invitee_template: {
          discount_value: inT?.discount_value ?? "0",
          validity_days: inT?.template_validity_days ?? null,
        },
      },
      "bongsim.mypage.referral.code",
    );
  } catch (e) {
    console.error("[bongsim/mypage/referral]", e);
    return jsonWithLeakGuard({ error: "db_error" }, "bongsim.mypage.referral.code", { status: 500 });
  } finally {
    c.release();
  }
}
