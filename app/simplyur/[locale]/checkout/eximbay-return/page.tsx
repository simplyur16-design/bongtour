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

export default async function SimplyurEximbayReturnPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;
  const q = await searchParams;
  const rescode = typeof q.rescode === "string" ? q.rescode : "";
  const orderNumber =
    (typeof q.order_id === "string" && q.order_id.trim()) ||
    (typeof q.orderId === "string" && q.orderId.trim()) ||
    "";

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

  const failed = rescode && rescode !== "0000";

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>
        {failed ? "Payment not completed" : "Confirming payment…"}
      </h1>
      <p style={{ color: "#555", lineHeight: 1.5, marginBottom: 16 }}>
        {failed
          ? "The payment window reported a failure. You can return to plans and try again."
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
        <Link href={simplyurPath(locale, failed ? "/recommend" : "/my-esim")}>
          {failed ? "Back to plans" : "My eSIM"}
        </Link>
      </p>
    </main>
  );
}
