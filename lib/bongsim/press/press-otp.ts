import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { prisma } from "@/lib/prisma";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { sendPressOtpMail } from "@/lib/bongsim/email/send-press-otp-mail";
import { extractEmailDomain, isPressDomain } from "@/lib/bongsim/press/press-domains";
import {
  generatePressOtpCode,
  isPressOtpAttemptLocked,
  normalizeWorkEmail,
  pressOtpAttemptsRemaining,
  PRESS_OTP_TTL_MS,
} from "@/lib/bongsim/press/press-otp-helpers";

export {
  generatePressOtpCode,
  isPressOtpAttemptLocked,
  normalizeWorkEmail,
  pressOtpAttemptsRemaining,
  PRESS_OTP_MAX_ATTEMPTS,
  PRESS_OTP_TTL_MS,
} from "@/lib/bongsim/press/press-otp-helpers";

const BCRYPT_ROUNDS = 12;

export type PressOtpRequestResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid_email"
        | "domain_not_allowed"
        | "marketing_consent_required"
        | "already_verified"
        | "smtp_failed"
        | "db_unconfigured"
        | "db_error";
    };

export type PressOtpVerifyResult =
  | {
      ok: true;
      pressVerifiedEmail: string;
      pressVerifiedDomain: string;
    }
  | {
      ok: false;
      reason:
        | "invalid_email"
        | "domain_not_allowed"
        | "no_active_otp"
        | "expired"
        | "locked"
        | "invalid_code"
        | "db_unconfigured"
        | "db_error";
      attemptsRemaining?: number;
    };

async function invalidateActivePressOtps(
  client: PoolClient,
  userId: string,
  workEmail: string,
): Promise<void> {
  await client.query(
    `UPDATE bongsim_press_verification
        SET consumed_at = NOW()
      WHERE user_id = $1
        AND work_email = $2
        AND consumed_at IS NULL`,
    [userId, workEmail],
  );
}

async function insertPressOtp(
  client: PoolClient,
  params: {
    userId: string;
    workEmail: string;
    domain: string;
    codeHash: string;
    expiresAt: Date;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO bongsim_press_verification (
       user_id, work_email, domain, code_hash, expires_at, attempt_count
     ) VALUES ($1, $2, $3, $4, $5, 0)`,
    [params.userId, params.workEmail, params.domain, params.codeHash, params.expiresAt],
  );
}

type ActiveOtpRow = {
  id: string;
  code_hash: string;
  expires_at: Date;
  attempt_count: number;
};

async function loadLatestActiveOtp(
  client: PoolClient,
  userId: string,
  workEmail: string,
): Promise<ActiveOtpRow | null> {
  const r = await client.query<ActiveOtpRow>(
    `SELECT id, code_hash, expires_at, attempt_count
       FROM bongsim_press_verification
      WHERE user_id = $1
        AND work_email = $2
        AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, workEmail],
  );
  return r.rows[0] ?? null;
}

export async function requestPressOtp(userId: string, workEmailRaw: string): Promise<PressOtpRequestResult> {
  const workEmail = normalizeWorkEmail(workEmailRaw);
  if (!workEmail) return { ok: false, reason: "invalid_email" };
  if (!isPressDomain(workEmail)) return { ok: false, reason: "domain_not_allowed" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { marketingConsent: true, pressVerified: true },
  });
  if (!user) return { ok: false, reason: "db_error" };
  if (user.pressVerified) return { ok: false, reason: "already_verified" };
  if (!user.marketingConsent) return { ok: false, reason: "marketing_consent_required" };

  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const domain = extractEmailDomain(workEmail);
  if (!domain) return { ok: false, reason: "invalid_email" };

  const code = generatePressOtpCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + PRESS_OTP_TTL_MS);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await invalidateActivePressOtps(client, userId, workEmail);
    await insertPressOtp(client, { userId, workEmail, domain, codeHash, expiresAt });
    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[press-otp] request insert failed", e);
    return { ok: false, reason: "db_error" };
  } finally {
    client.release();
  }

  const mailed = await sendPressOtpMail({ to: workEmail, code });
  if (!mailed.ok) {
    console.error("[press-otp] smtp failed", mailed.error);
    const c2 = await pool.connect();
    try {
      await invalidateActivePressOtps(c2, userId, workEmail);
    } finally {
      c2.release();
    }
    return { ok: false, reason: "smtp_failed" };
  }

  return { ok: true };
}

export async function verifyPressOtp(
  userId: string,
  workEmailRaw: string,
  codeRaw: string,
): Promise<PressOtpVerifyResult> {
  const workEmail = normalizeWorkEmail(workEmailRaw);
  if (!workEmail) return { ok: false, reason: "invalid_email" };
  if (!isPressDomain(workEmail)) return { ok: false, reason: "domain_not_allowed" };

  const code = codeRaw.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, reason: "invalid_code", attemptsRemaining: undefined };
  }

  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const domain = extractEmailDomain(workEmail);
  if (!domain) return { ok: false, reason: "invalid_email" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const row = await loadLatestActiveOtp(client, userId, workEmail);
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "no_active_otp" };
    }

    if (row.expires_at.getTime() <= Date.now()) {
      await client.query(
        `UPDATE bongsim_press_verification SET consumed_at = NOW() WHERE id = $1::uuid`,
        [row.id],
      );
      await client.query("COMMIT");
      return { ok: false, reason: "expired" };
    }

    if (isPressOtpAttemptLocked(row.attempt_count)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "locked", attemptsRemaining: 0 };
    }

    const match = await bcrypt.compare(code, row.code_hash);
    if (!match) {
      const nextCount = row.attempt_count + 1;
      await client.query(
        `UPDATE bongsim_press_verification SET attempt_count = $2 WHERE id = $1::uuid`,
        [row.id, nextCount],
      );
      await client.query("COMMIT");
      const remaining = pressOtpAttemptsRemaining(nextCount);
      if (isPressOtpAttemptLocked(nextCount)) {
        return { ok: false, reason: "locked", attemptsRemaining: 0 };
      }
      return { ok: false, reason: "invalid_code", attemptsRemaining: remaining };
    }

    const now = new Date();
    await client.query(
      `UPDATE bongsim_press_verification SET consumed_at = $2 WHERE id = $1::uuid`,
      [row.id, now],
    );
    await client.query(
      `UPDATE "User"
          SET "pressVerified" = true,
              "pressVerifiedAt" = $2,
              "pressVerifiedDomain" = $3,
              "pressVerifiedEmail" = $4
        WHERE id = $1`,
      [userId, now, domain, workEmail],
    );

    await client.query("COMMIT");
    return { ok: true, pressVerifiedEmail: workEmail, pressVerifiedDomain: domain };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[press-otp] verify failed", e);
    return { ok: false, reason: "db_error" };
  } finally {
    client.release();
  }
}
