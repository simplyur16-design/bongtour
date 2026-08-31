import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { SimplyurCheckoutClient } from "./SimplyurCheckoutClient";
import { isSimplyurCheckoutEnabled } from "@/lib/simplyur/checkout/enabled";
import { resolveSimplyurCheckoutBuyerEmail } from "@/lib/simplyur/checkout/session-buyer-email";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { loadSimplyurKoreaProductByOptionIdCached } from "@/lib/simplyur/catalog/load-korea-catalog-cached";

// REGRESSION-FREEZE[simplyur-product-detail-same-catalog-pipe]: checkout uses list cache — manifest
import { isSimplyurEximbayPrepUiEnabled } from "@/lib/simplyur/payments/eximbay-env";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ optionApiId?: string; failed?: string; buyerEmail?: string }>;
};

export default async function SimplyurCheckoutPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;

  const q = await searchParams;
  const optionApiId = (q.optionApiId ?? "").trim();
  const paymentFailed = q.failed === "1";

  let initialProduct = null;
  if (optionApiId) {
    const loaded = await loadSimplyurKoreaProductByOptionIdCached(optionApiId, locale);
    if (loaded.ok) initialProduct = loaded.product;
  }

  // REGRESSION-FREEZE[simplyur-checkout-session-email-prefill]: session email → checkout — manifest
  const session = await auth();
  const initialBuyerEmail = resolveSimplyurCheckoutBuyerEmail({
    sessionEmail: session?.user?.email,
    queryBuyerEmail: q.buyerEmail,
  });

  return (
    <SimplyurCheckoutClient
      optionApiId={optionApiId}
      initialProduct={initialProduct}
      initialBuyerEmail={initialBuyerEmail}
      paymentFailed={paymentFailed}
      checkoutEnabled={isSimplyurCheckoutEnabled()}
      eximbayPrepUi={isSimplyurEximbayPrepUiEnabled()}
    />
  );
}
