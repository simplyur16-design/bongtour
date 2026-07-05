"use client";

import { USIMSA_BLUE } from "@/lib/bongsim/recommend/duration-from-days";

type Props = {
  value: number | null;
  onChange: (days: number) => void;
  /** 카탈로그에 존재하는 일수만 — 빈 배열이면 안내 문구 */
  options: number[];
  label?: string;
  hint?: string;
  className?: string;
};

/** usimsa 스타일 — 가로 한 줄 스크롤 일수 칩. */
export function DayChipPicker({ value, onChange, options, label, hint, className }: Props) {
  if (options.length === 0) {
    return (
      <div className={className}>
        {label ? (
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#111]">{label}</p>
        ) : null}
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600">
          선택 가능한 이용 일수를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {label ? (
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#111]">{label}</p>
      ) : null}
      {hint ? (
        <p className="mt-1 text-[12px] leading-relaxed text-[#767676]">{hint}</p>
      ) : null}
      <div
        className="mt-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="이용 일수 선택"
      >
        <div className="flex w-max min-w-full gap-2 rounded-md bg-[#f5f6f8] p-2">
          {options.map((d) => {
            const selected = value === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(d)}
                className="flex h-[52px] min-w-[4.5rem] shrink-0 items-center justify-center rounded-md px-4 text-[17px] font-medium tracking-[-0.03em] transition"
                style={
                  selected
                    ? {
                        backgroundColor: "#fff",
                        color: USIMSA_BLUE,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                      }
                    : { backgroundColor: "transparent", color: "#999" }
                }
              >
                {d}일
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-[#999]">
        판매 중인 요금제 일수만 표시됩니다 · 1일=24시 (활성화 시점부터, 상품별 상이)
      </p>
    </div>
  );
}
