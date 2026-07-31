import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isSimplyurLocale, type SimplyurLocale, simplyurPath } from "@/lib/simplyur/constants";
import { SIMPLYUR_EXIMBAY_PROVIDER_ID } from "@/lib/simplyur/payments/providers/eximbay-payments";

// REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: return_url stub — manifest
// REGRESSION-FREEZE[simplyur-eximbay-live-checkout]: return → complete when paid — manifest

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstQuery(
  q: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = q[key];
  return typeof v === "string" ? v.trim() : "";
}

function requestOrigin(hdrs: Headers): string {
  const host = (hdrs.get("x-forwarded-host") || hdrs.get("host") || "").split(",")[0]?.trim();
  const proto = (hdrs.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  if (host) return `${proto}://${host}`;
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://bongtour.com"
  );
}

function hostAllowed(candidate: string, requestHost: string): boolean {
  const a = candidate.toLowerCase();
  const b = requestHost.toLowerCase();
  if (a === b) return true;
  // www / apex
  if (a.replace(/^www\./, "") === b.replace(/^www\./, "")) return true;
  return false;
}

/** Same-site Simplyur cancel resume only (relative or absolute). */
function safeCancelResume(raw: string, origin: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    if (s.startsWith("/") && !s.startsWith("//")) {
      if (!s.startsWith("/simplyur/")) return null;
      return s;
    }
    const u = new URL(s);
    const req = new URL(origin);
    if (!hostAllowed(u.hostname, req.hostname)) return null;
    if (!u.pathname.startsWith("/simplyur/")) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export default async function SimplyurEximbayReturnPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;
  const q = await searchParams;
  const origin = requestOrigin(await headers());

  const rescode = firstQuery(q, "rescode");
  const orderNumber = firstQuery(q, "order_id") || firstQuery(q, "orderId") || "";
  const cancelResume = safeCancelResume(firstQuery(q, "su_cancel"), origin);

  const failed = Boolean(rescode && rescode !== "0000");

  // Cancel / decline — send buyer back to checkout (not stuck on this stub).
  if (failed && cancelResume) {
    redirect(cancelResume);
  }

  if (orderNumber && (rescode === "0000" || !rescode)) {
    const pool = getPgPool();
    if (pool) {
      let row: { order_id: string; order_number: string } | null = null;
      try {
        const r = await pool.query<{ order_id: string; order_number: string }>(
          `SELECT o.order_id, o.order_number
           FROM bongsim_order o
           LEFT JOIN bongsim_payment_attempt a
             ON a.order_id = o.order_id AND a.provider = $2
           WHERE o.order_number = $1 OR a.provider_session_id = $1
           ORDER BY o.updated_at DESC
           LIMIT 1`,
          [orderNumber, SIMPLYUR_EXIMBAY_PROVIDER_ID],
        );
        row = r.rows[0] ?? null;
      } catch {
        row = null;
      }
      if (row) {
        redirect(
          simplyurPath(
            locale,
            `/checkout/complete?orderId=${encodeURIComponent(row.order_id)}&orderNumber=${encodeURIComponent(row.order_number)}`,
          ),
        );
      }
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>
        {failed ? "Payment not completed" : "Confirming payment…"}
      </h1>
      <p style={{ color: "#555", lineHeight: 1.5, marginBottom: 16 }}>
        {failed
          ? "The payment window reported a failure. You can return to checkout and try again."
          : "If you completed payment, your eSIM will appear shortly. You can also check My eSIM."}
      </p>
      {rescode ? (
        <p style={{ fontSize: 14 }}>
          rescode: <code>{rescode}</code>
          {orderNumber ? (
            <>
              {" "}
              · order_id: <code>{orderNumber}</code>
            </>
          ) : null}
        </p>
      ) : null}
      <p style={{ marginTop: 24 }}>
        <Link href={cancelResume || simplyurPath(locale, failed ? "/recommend" : "/my-esim")}>
          {failed ? "Back to checkout" : "My eSIM"}
        </Link>
      </p>
    </main>
  );
}
