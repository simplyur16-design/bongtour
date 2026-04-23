import type { BongsimProductDetailV1 } from "@/lib/bongsim/contracts/product-detail.v1";
import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";

function txt(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.length ? s : "—";
}

function pickDisplayPrice(pb: BongsimProductOptionV1["price_block"]): { amount: number; basis: string } {
  const candidates: Array<{ basis: string; value: number | null }> = [
    { basis: "after.recommended_krw", value: pb.after.recommended_krw },
    { basis: "before.recommended_krw", value: pb.before.recommended_krw },
    { basis: "after.consumer_krw", value: pb.after.consumer_krw },
    { basis: "before.consumer_krw", value: pb.before.consumer_krw },
    { basis: "after.supply_krw", value: pb.after.supply_krw },
    { basis: "before.supply_krw", value: pb.before.supply_krw },
  ];
  for (const c of candidates) {
    if (c.value != null && Number.isFinite(c.value)) {
      return { amount: Math.trunc(c.value), basis: c.basis };
    }
  }
  return { amount: 0, basis: "missing_all_price_cells" };
}

function buyerSafeNote(opt: BongsimProductOptionV1): string | null {
  if (!opt.classification_conflict) return null;
  if (opt.classification_notes && opt.classification_notes.trim()) return opt.classification_notes.trim();
  return "표시 데이터가 공급사 원본과 불일치할 수 있습니다. 구매 전 고객센터로 확인해 주세요.";
}

export function mapProductOptionToDetailV1(opt: BongsimProductOptionV1): BongsimProductDetailV1 {
  const { amount, basis } = pickDisplayPrice(opt.price_block);
  const summary = {
    plan_name: txt(opt.plan_name),
    option_label: txt(opt.option_label),
    days_raw: txt(opt.days_raw),
    allowance_label: txt(opt.allowance_label),
    network_family: opt.network_family,
    plan_type: opt.plan_type,
    plan_line_excel: opt.plan_line_excel,
    carrier_raw: txt(opt.carrier_raw),
    pricing: { currency: "KRW" as const, display_amount_krw: amount, display_basis: basis },
  };

  const detail: BongsimProductDetailV1 = {
    schema: "bongsim.product_detail.v1",
    ids: { option_api_id: opt.option_api_id },
    summary,
    specs: {
      network_raw: txt(opt.network_raw),
      internet_raw: txt(opt.internet_raw),
      data_class_raw: txt(opt.data_class_raw),
      qos_raw: txt(opt.qos_raw),
      validity_raw: txt(opt.validity_raw),
      apn_raw: txt(opt.apn_raw),
      mcc_raw: txt(opt.mcc_raw),
      mnc_raw: txt(opt.mnc_raw),
    },
    usage: {
      activation_policy_raw: txt(opt.activation_policy_raw),
      install_benchmark_raw: txt(opt.install_benchmark_raw),
      hotspot_flag_raw: txt(opt.flags.hotspot),
      kyc_flag_raw: txt(opt.flags.kyc),
    },
    policies: {
      esim_constraint_raw: txt(opt.flags.esim),
      usim_constraint_raw: txt(opt.flags.usim),
      request_shipment_flag_raw: txt(opt.flags.request_shipment),
      status_check_flag_raw: txt(opt.flags.status_check),
      extension_iccid_topup_flag_raw: txt(opt.flags.extension_iccid_topup),
      data_integrity: {
        classification_conflict: opt.classification_conflict,
        buyer_safe_note: buyerSafeNote(opt),
      },
    },
    sticky: {
      summary,
      cta: { primary: "purchase_intent", payload: { option_api_id: opt.option_api_id } },
    },
  };

  return detail;
}
