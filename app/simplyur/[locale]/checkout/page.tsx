import { notFound } from "next/navigation";
import { SimplyurCheckoutClient } from "./SimplyurCheckoutClient";
import { isSimplyurCheckoutEnabled } from "@/lib/simplyur/checkout/enabled";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { loadSimplyurKoreaProductByOptionId } from "@/lib/simplyur/catalog/load-korea-catalog";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ optionApiId?: string; failed?: string }>;
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
    const loaded = await loadSimplyurKoreaProductByOptionId(optionApiId, locale);
    if (loaded.ok) initialProduct = loaded.product;
  }

  return (
    <SimplyurCheckoutClient
      optionApiId={optionApiId}
      initialProduct={initialProduct}
      paymentFailed={paymentFailed}
      checkoutEnabled={isSimplyurCheckoutEnabled()}
    />
  );
}
