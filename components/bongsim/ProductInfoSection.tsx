"use client";

import type { EsimCountryDetailInfo } from "@/lib/bongsim/types";

type Props = {
  info: EsimCountryDetailInfo;
};

type InfoRow = { key: string; label: string; value: string };

export function ProductInfoSection({ info }: Props) {
  const rows: InfoRow[] = [];
  if (info.deviceCheckLabel?.trim()) {
    rows.push({
      key: "device",
      label: "사용 가능 기종 확인",
      value: info.deviceCheckLabel.trim(),
    });
  }
  if (info.activation?.trim()) {
    rows.push({
      key: "activation",
      label: "개통 방식 / 등록 기준",
      value: info.activation.trim(),
    });
  }
  if (info.hotspot?.trim()) {
    rows.push({
      key: "hotspot",
      label: "핫스팟 가능 여부",
      value: info.hotspot.trim(),
    });
  }
  if (info.network?.trim()) {
    rows.push({
      key: "network",
      label: "네트워크",
      value: info.network.trim(),
    });
  }
  if (info.startPolicy?.trim()) {
    rows.push({
      key: "start",
      label: "데이터 시작 시점",
      value: info.startPolicy.trim(),
    });
  }

  if (rows.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm ring-1 ring-slate-100/80 lg:px-5 lg:py-5"
      aria-label="상품 요약 정보"
    >
      <h2 className="text-[14px] font-bold tracking-tight text-slate-900 lg:text-[15px]">상품 정보</h2>
      <ul className="mt-3 space-y-0 divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.key} className="flex gap-3 py-3 first:pt-0">
            <span className="w-[7.75rem] shrink-0 pt-0.5 text-[11px] font-bold leading-snug text-slate-500 lg:w-[8.5rem] lg:text-[12px]">
              {r.label}
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-medium leading-relaxed text-slate-800 lg:text-[14px]">
              {r.value}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-teal-900 lg:text-[12px]">
        이 상품은 eSIM으로만 제공돼요. 실물 카드는 보내지 않아요.
      </p>
    </section>
  );
}
