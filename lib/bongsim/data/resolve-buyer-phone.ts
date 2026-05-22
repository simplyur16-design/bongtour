import { getPgPool } from "@/lib/bongsim/db/pool";
import { normalizeBuyerPhone } from "@/lib/bongsim/phone/normalize-buyer-phone";
import { prisma } from "@/lib/prisma";

/** 주문·회원 DB에서 알림톡 수신 번호 조회 */
export async function resolveBuyerPhoneForOrder(orderId: string): Promise<string | null> {
  const pool = getPgPool();
  if (!pool) return null;

  const r = await pool.query<{ buyer_phone: string | null; buyer_email: string; consents: unknown }>(
    `SELECT buyer_phone, buyer_email, consents FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
    [orderId],
  );
  const row = r.rows[0];
  if (!row) return null;

  const col = normalizeBuyerPhone(row.buyer_phone ?? "");
  if (col) return col;

  if (row.consents && typeof row.consents === "object" && !Array.isArray(row.consents)) {
    const c = row.consents as Record<string, unknown>;
    const fromConsents = normalizeBuyerPhone(String(c.buyer_phone ?? ""));
    if (fromConsents) return fromConsents;
  }

  const email = row.buyer_email.trim().toLowerCase();
  if (email) {
    try {
      const u = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { phone: true },
      });
      const p = normalizeBuyerPhone(u?.phone ?? "");
      if (p) return p;
    } catch {
      /* prisma optional */
    }
  }

  return null;
}
