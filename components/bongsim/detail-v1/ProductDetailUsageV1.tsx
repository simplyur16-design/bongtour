import type { BongsimProductDetailUsageV1 } from "@/lib/bongsim/contracts/product-detail.v1";

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
      <h3 className="text-[12px] font-semibold text-slate-700">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-900">{body}</p>
    </div>
  );
}

export function ProductDetailUsageV1({ usage }: { usage: BongsimProductDetailUsageV1 }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="usage-heading">
      <h2 id="usage-heading" className="text-[15px] font-semibold text-slate-900">
        사용·활성화
      </h2>
      <div className="mt-3 grid gap-3">
        <Block title="활성화 정책" body={usage.activation_policy_raw} />
        <Block title="설치 기준" body={usage.install_benchmark_raw} />
        <div className="grid grid-cols-2 gap-3">
          <Block title="핫스팟" body={usage.hotspot_flag_raw} />
          <Block title="신원인증(KYC)" body={usage.kyc_flag_raw} />
        </div>
      </div>
    </section>
  );
}
