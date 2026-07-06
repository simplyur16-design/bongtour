"use client";

import { useEffect, useState } from "react";
import type { SimplyurProductViewState } from "@/lib/simplyur/product-design";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";
import { useSimplyurIntl } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurProductPanel } from "@/components/simplyur/product/SimplyurProductPanel";

type Props = { optionApiId: string };

export function SimplyurProductClient({ optionApiId }: Props) {
  const { locale } = useSimplyurIntl();
  const [product, setProduct] = useState<SimplyurPublicProduct | null>(null);
  const [state, setState] = useState<SimplyurProductViewState>("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/simplyur/products/${encodeURIComponent(optionApiId)}?locale=${locale}`)
      .then(async (r) => {
        if (r.status === 404) {
          if (!cancelled) setState("not_found");
          return null;
        }
        if (!r.ok) throw new Error("load failed");
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
        if (!cancelled) setState("not_found");
      });
    return () => {
      cancelled = true;
    };
  }, [optionApiId, locale]);

  return <SimplyurProductPanel state={state} product={product} />;
}
