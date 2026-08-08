import { notFound } from "next/navigation";
import { isSimplyurLocale } from "@/lib/simplyur/constants";

/**
 * Mobile WebView sentinel after Eximbay PAYER_AUTH.
 * App intercepts this URL (never shows website chrome). Keep query string intact
 * so payer_auth_id / status reach classifySimplyurCheckoutWebViewUrl.
 * REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: app-pay-result sentinel — manifest
 */

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SimplyurAppPayResultPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FFF7F2",
        color: "#5c6578",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <p>Returning to simplyur…</p>
    </main>
  );
}
