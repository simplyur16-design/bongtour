import { notFound } from "next/navigation";
import { SimplyurProductClient } from "./SimplyurProductClient";
import { isSimplyurCheckoutEnabled } from "@/lib/simplyur/checkout/enabled";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { loadSimplyurKoreaProductByOptionIdCached } from "@/lib/simplyur/catalog/load-korea-catalog-cached";

// REGRESSION-FREEZE[simplyur-product-detail-same-catalog-pipe]: web product uses list cache — manifest

type Props = { params: Promise<{ locale: string; optionApiId: string }> };

export default async function SimplyurProductPage({ params }: Props) {
  const { locale: raw, optionApiId } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;

  const res = await loadSimplyurKoreaProductByOptionIdCached(optionApiId, locale);

  return (
    <SimplyurProductClient
      optionApiId={optionApiId}
      initialProduct={res.ok ? res.product : null}
      initialState={
        res.ok
          ? "loaded"
          : res.reason === "not_found" || res.reason === "not_korea"
            ? "not_found"
            : "unavailable"
      }
      checkoutEnabled={isSimplyurCheckoutEnabled()}
    />
  );
}
