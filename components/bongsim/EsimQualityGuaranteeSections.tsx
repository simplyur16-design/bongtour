import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import {
  ESIM_QUALITY_GUARANTEE_CLOSING,
  ESIM_QUALITY_GUARANTEE_FAQ,
  ESIM_QUALITY_GUARANTEE_PROMISE,
} from "@/lib/bongsim/esim-quality-guarantee-content";
import { bongsimPath } from "@/lib/bongsim/constants";

export function EsimQualityGuaranteeSections() {
  return (
    <>
      <section
        className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm lg:p-6"
        aria-labelledby="esim-quality-promise-heading"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex shrink-0 items-center justify-center rounded-full bg-emerald-100 p-3 text-emerald-600"
            aria-hidden
          >
            <ShieldCheck className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="min-w-0 text-left">
            <h2 id="esim-quality-promise-heading" className="text-lg font-bold text-slate-900 lg:text-xl">
              {ESIM_QUALITY_GUARANTEE_PROMISE.headline}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 lg:text-base">
              {ESIM_QUALITY_GUARANTEE_PROMISE.lead}
            </p>
            <Link
              href={bongsimPath("/policy")}
              className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-teal-800 underline-offset-4 hover:underline"
            >
              환불·서비스 정책 전문 보기 →
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 lg:mt-8" aria-labelledby="esim-quality-why-heading">
        <h2 id="esim-quality-why-heading" className="text-lg font-bold text-slate-900 lg:text-xl">
          품질보장을 하는 이유
        </h2>
        <div className="mt-4 space-y-4">
          {ESIM_QUALITY_GUARANTEE_FAQ.map((item, index) => (
            <article
              key={item.question}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Q{index + 1}</p>
              <h3 className="mt-1 text-base font-semibold leading-snug text-slate-900 lg:text-lg">
                {item.question}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-700 lg:text-base">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-5 py-6 text-center lg:mt-8 lg:px-8 lg:py-8"
        aria-labelledby="esim-quality-closing-heading"
      >
        <h2 id="esim-quality-closing-heading" className="sr-only">
          Bong투어 품질보장 약속
        </h2>
        <div className="mx-auto max-w-xl space-y-3 text-sm leading-relaxed text-slate-700 lg:text-base">
          {ESIM_QUALITY_GUARANTEE_CLOSING.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>
    </>
  );
}
