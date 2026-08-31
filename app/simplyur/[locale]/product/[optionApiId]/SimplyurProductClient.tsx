"use client";

import { useEffect, useState } from "react";
import { simplyurProductHttpViewState } from "@/lib/simplyur/catalog/product-http-view-state";
// REGRESSION-FREEZE[esim-fulfill-keep-catalog-pipe]: 5xx uses simplyurProductHttpViewState — manifest
import type { SimplyurProductViewState } from "@/lib/simplyur/product-design";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";
import { useSimplyurIntl } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurProductPanel } from "@/components/simplyur/product/SimplyurProductPanel";

type Props = {
  optionApiId: string;
  initialProduct?: SimplyurPublicProduct | null;
  initialState?: SimplyurProductViewState;
  checkoutEnabled?: boolean;
};

export function SimplyurProductClient({
  optionApiId,
  initialProduct = null,
  initialState = "loading",
  checkoutEnabled,
}: Props) {
  const { locale } = useSimplyurIntl();
  const serverLoaded = initialState === "loaded" && initialProduct != null;
  const serverTerminal = initialState === "not_found" || initialState === "unavailable";
  const [product, setProduct] = useState<SimplyurPublicProduct | null>(initialProduct);
  const [state, setState] = useState<SimplyurProductViewState>(
    serverLoaded ? "loaded" : serverTerminal ? initialState : "loading",
  );

  useEffect(() => {
    if (serverLoaded || serverTerminal) return;
    let cancelled = false;
    setState("loading");
    fetch(`/api/simplyur/products/${encodeURIComponent(optionApiId)}?locale=${locale}`)
      .then(async (r) => {
        const view = simplyurProductHttpViewState(r.status);
        if (view !== "ok") {
          if (!cancelled) setState(view);
          return null;
        }
        return r.json() as Promise<{ product: SimplyurPublicProduct }>;
      })
      .then((json) => {
        if (cancelled) return;
        if (json?.product) {
          setProduct(json.product);
          setState("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [optionApiId, locale, serverLoaded, serverTerminal]);

  return <SimplyurProductPanel state={state} product={product} checkoutEnabled={checkoutEnabled} />;
}
