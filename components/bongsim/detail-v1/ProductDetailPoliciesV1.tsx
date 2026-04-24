import type { BongsimProductDetailPoliciesV1 } from "@/lib/bongsim/contracts/product-detail.v1";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-slate-100 py-3 sm:grid-cols-[200px_1fr] sm:items-start sm:gap-4">
      <dt className="text-[12px] font-medium text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-900">{value}</dd>
    </div>
  );
}

export function ProductDetailPoliciesV1({ policies }: { policies: BongsimProductDetailPoliciesV1 }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="policy-heading">
      <h2 id="policy-heading" className="text-[15px] font-semibold text-slate-900">
        환불·유의·운영 정책
      </h2>
      {policies.data_integrity.classification_conflict && policies.data_integrity.buyer_safe_note ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-950">
          {policies.data_integrity.buyer_safe_note}
        </p>
      ) : null}
      <dl className="mt-2">
        <Row label="eSIM" value={policies.esim_constraint_raw} />
        <Row label="USIM" value={policies.usim_constraint_raw} />
        <Row label="요청(발송)" value={policies.request_shipment_flag_raw} />
        <Row label="상태 확인" value={policies.status_check_flag_raw} />
        <Row label="연장(ICCID)" value={policies.extension_iccid_topup_flag_raw} />
      </dl>
    </section>
  );
}
