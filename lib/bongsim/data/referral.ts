import type { PoolClient } from "pg";
import { makeReferralCode } from "@/lib/identifiers/make-referral-code";
import { getTemplateBySlot } from "@/lib/coupon/issuance-helpers";

export type ReferralRow = {
  referral_id: string;
  inviter_user_id: string;
  code: string;
  inviter_template_coupon_id: string | null;
  invitee_template_coupon_id: string | null;
  is_active: boolean;
  total_invited: number;
  total_rewarded: number;
};

export function assertNotSelfReferral(inviterUserId: string, invitedUserId: string): void {
  if (inviterUserId.trim() === invitedUserId.trim()) {
    throw new Error("self_referral_not_allowed");
  }
}

export async function findReferralByCode(
  client: Pick<PoolClient, "query">,
  code: string,
): Promise<ReferralRow | null> {
  const c = code.trim();
  if (!c) return null;
  const r = await client.query<ReferralRow>(
    `SELECT referral_id::text, inviter_user_id, code,
            inviter_template_coupon_id::text, invitee_template_coupon_id::text,
            is_active, total_invited, total_rewarded
     FROM bongsim_referral_code
     WHERE lower(trim(code)) = lower(trim($1)) AND is_active = true
     LIMIT 1`,
    [c],
  );
  return r.rows[0] ?? null;
}

export async function incrementInviteCount(client: Pick<PoolClient, "query">, referralId: string): Promise<void> {
  await client.query(
    `UPDATE bongsim_referral_code SET total_invited = total_invited + 1, updated_at = now() WHERE referral_id = $1::uuid`,
    [referralId.trim()],
  );
}

export async function incrementRewardedCount(client: Pick<PoolClient, "query">, referralId: string): Promise<void> {
  await client.query(
    `UPDATE bongsim_referral_code SET total_rewarded = total_rewarded + 1, updated_at = now() WHERE referral_id = $1::uuid`,
    [referralId.trim()],
  );
}

export async function getOrCreateReferralCode(
  client: Pick<PoolClient, "query">,
  userId: string,
): Promise<ReferralRow> {
  const uid = userId.trim();
  if (!uid) throw new Error("inviter_user_id_required");

  const ex = await client.query<ReferralRow>(
    `SELECT referral_id::text, inviter_user_id, code,
            inviter_template_coupon_id::text, invitee_template_coupon_id::text,
            is_active, total_invited, total_rewarded
     FROM bongsim_referral_code WHERE inviter_user_id = $1::text LIMIT 1`,
    [uid],
  );
  if (ex.rows[0]) return ex.rows[0];

  const invT = await getTemplateBySlot(client, "referral_inviter");
  const invE = await getTemplateBySlot(client, "referral_invitee");
  if (!invT || !invE) throw new Error("referral_templates_missing");

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeReferralCode();
    try {
      const ins = await client.query<ReferralRow>(
        `INSERT INTO bongsim_referral_code (
           inviter_user_id, code, inviter_template_coupon_id, invitee_template_coupon_id, is_active
         ) VALUES ($1::text, $2::text, $3::uuid, $4::uuid, true)
         RETURNING referral_id::text, inviter_user_id, code,
                   inviter_template_coupon_id::text, invitee_template_coupon_id::text,
                   is_active, total_invited, total_rewarded`,
        [uid, code, invT.coupon_id, invE.coupon_id],
      );
      const row = ins.rows[0];
      if (row) return row;
    } catch (e) {
      const er = e as { code?: string };
      if (er.code === "23505") continue;
      throw e;
    }
  }

  const again = await client.query<ReferralRow>(
    `SELECT referral_id::text, inviter_user_id, code,
            inviter_template_coupon_id::text, invitee_template_coupon_id::text,
            is_active, total_invited, total_rewarded
     FROM bongsim_referral_code WHERE inviter_user_id = $1::text LIMIT 1`,
    [uid],
  );
  if (again.rows[0]) return again.rows[0];
  throw new Error("referral_code_create_failed");
}
