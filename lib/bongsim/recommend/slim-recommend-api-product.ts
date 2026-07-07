import { computeRecommendedPrice, type ProductOption } from "@/lib/bongsim/recommend/product-option";

// REGRESSION-FREEZE[bongsim-by-country-slim-prefetch]: recommend API 슬림 payload — manifest

/** recommend by-country API — price_block 제거, recommended_price SSOT */
export function slimProductForRecommendApi(p: ProductOption): ProductOption {
  const recommended =
    typeof p.recommended_price === "number" && Number.isFinite(p.recommended_price)
      ? p.recommended_price
      : computeRecommendedPrice(p.price_block);

  if (recommended == null) {
    return {
      option_api_id: p.option_api_id,
      plan_name: p.plan_name,
      network_family: p.network_family,
      plan_type: p.plan_type,
      days_raw: p.days_raw,
      allowance_label: p.allowance_label,
      option_label: p.option_label,
      flags: p.flags,
      price_block: p.price_block,
      ...(p.qos_raw != null ? { qos_raw: p.qos_raw } : {}),
    };
  }

  return {
    option_api_id: p.option_api_id,
    plan_name: p.plan_name,
    network_family: p.network_family,
    plan_type: p.plan_type,
    days_raw: p.days_raw,
    allowance_label: p.allowance_label,
    option_label: p.option_label,
    flags: p.flags,
    recommended_price: recommended,
    ...(p.qos_raw != null ? { qos_raw: p.qos_raw } : {}),
    price_block: {},
  };
}
