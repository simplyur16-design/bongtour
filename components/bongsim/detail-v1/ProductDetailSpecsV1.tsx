import type { BongsimProductDetailSpecsV1 } from "@/lib/bongsim/contracts/product-detail.v1";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-slate-100 py-3 sm:grid-cols-[160px_1fr] sm:items-start sm:gap-4">
      <dt className="text-[12px] font-medium text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-900">{value}</dd>
    </div>
  );
}

export function ProductDetailSpecsV1({ specs }: { specs: BongsimProductDetailSpecsV1 }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="specs-heading">
      <h2 id="specs-heading" className="text-[15px] font-semibold text-slate-900">
        요금·망 정보
      </h2>
      <dl className="mt-2">
        <Row label="네트워크" value={specs.network_raw} />
        <Row label="망(로컬/로밍)" value={specs.internet_raw} />
        <Row label="데이터 구분" value={specs.data_class_raw} />
        <Row label="QOS" value={specs.qos_raw} />
        <Row label="유효기간" value={specs.validity_raw} />
        <Row label="APN" value={specs.apn_raw} />
        <Row label="MCC" value={specs.mcc_raw} />
        <Row label="MNC" value={specs.mnc_raw} />
      </dl>
    </section>
  );
}
