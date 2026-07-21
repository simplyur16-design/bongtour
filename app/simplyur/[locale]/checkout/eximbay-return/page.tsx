import { notFound } from "next/navigation";
import Link from "next/link";
import { isSimplyurLocale, type SimplyurLocale, simplyurPath } from "@/lib/simplyur/constants";

// REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: return_url stub — manifest

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
  const orderId = typeof q.order_id === "string" ? q.order_id : "";

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Payment return (Eximbay prep)</h1>
      <p style={{ color: "#555", lineHeight: 1.5, marginBottom: 16 }}>
        Browser return_url stub for Simplyur Eximbay integration prep. Order fulfillment is confirmed
        via status_url verify in a later phase — this page does not mark the order paid.
      </p>
      {rescode ? (
        <p style={{ fontSize: 14 }}>
          rescode: <code>{rescode}</code>
          {orderId ? (
            <>
              {" "}
              · order_id: <code>{orderId}</code>
            </>
          ) : null}
        </p>
      ) : null}
      <p style={{ marginTop: 24 }}>
        <Link href={simplyurPath(locale, "/")}>Back to Simplyur</Link>
      </p>
    </main>
  );
}
