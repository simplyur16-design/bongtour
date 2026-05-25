"use client";

import SafeImage from "@/app/components/SafeImage";
import { RecommendModalShell } from "@/components/bongsim/recommend/RecommendModalShell";
import {
  computeRecommendedPrice,
  extractDaysFromDaysRaw,
  formatKrw,
  isTrueUnlimited,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";

export type CompareChoice = "individual" | "multi";

export type CompareCountryPlanSelection = { product: ProductOption; quantity: number };

type Props = {
  open: boolean;
  onClose: () => void;
  selectedCodes: string[];
  countryNameByCode: Record<string, string | undefined>;
  completed: Record<string, CompareCountryPlanSelection>;
  compareChoice: CompareChoice;
  onCompareChoiceChange: (choice: CompareChoice) => void;
  onChangeCountryPlan: (code: string) => void;
};

function flagCdnUrl(code: string): string {
  return `https://flagcdn.com/w160/${code.toLowerCase()}.png`;
}

function planTypeLabelKr(planType: string | null | undefined): string {
  switch ((planType ?? "").toLowerCase()) {
    case "unlimited":
      return "무제한";
    case "daily":
      return "데일리";
    case "fixed":
      return "종량제";
    default:
      return planType?.trim() || "—";
  }
}

function allowanceLabelForSummary(p: ProductOption): string {
  if (isTrueUnlimited(p)) return "무제한";
  const pt = (p.plan_type || "").trim().toLowerCase();
  if (pt === "unlimited") return (p.allowance_label || "").trim() || "무제한";
  const al = (p.allowance_label || "").trim();
  if (al) return al;
  return planTypeLabelKr(p.plan_type);
}

/** completed[code].product — recommended_price 우선, 없으면 price_block 계산 */
export function unitConsumerKrw(product: ProductOption): number | null {
  if (typeof product.recommended_price === "number" && Number.isFinite(product.recommended_price)) {
    return product.recommended_price;
  }
  return computeRecommendedPrice(product.price_block);
}

export function buildPlanSummaryForCompare(product: ProductOption, quantity: number): string {
  const grade = planTypeLabelKr(product.plan_type);
  const capacity = allowanceLabelForSummary(product);
  const days = extractDaysFromDaysRaw(product.days_raw);
  const daysLabel = days != null ? `${days}일` : (product.days_raw || "").trim() || "—";
  return `${grade} · ${capacity} · ${daysLabel} ×${quantity}`;
}

export type CompareIndividualLine = {
  code: string;
  nameKr: string;
  summary: string;
  unitKrw: number | null;
  quantity: number;
  lineTotalKrw: number | null;
};

export function buildCompareIndividualLines(
  selectedCodes: string[],
  completed: Record<string, CompareCountryPlanSelection>,
  countryNameByCode: Record<string, string | undefined>,
): CompareIndividualLine[] {
  const lines: CompareIndividualLine[] = [];
  for (const code of selectedCodes) {
    const sel = completed[code];
    if (!sel?.product?.option_api_id) continue;
    const unitKrw = unitConsumerKrw(sel.product);
    const quantity = sel.quantity;
    const lineTotalKrw = unitKrw != null ? unitKrw * quantity : null;
    lines.push({
      code,
      nameKr: countryNameByCode[code] ?? code.toUpperCase(),
      summary: buildPlanSummaryForCompare(sel.product, quantity),
      unitKrw,
      quantity,
      lineTotalKrw,
    });
  }
  return lines;
}

export function sumCompareIndividualTotal(lines: CompareIndividualLine[]): number | null {
  if (lines.length === 0) return null;
  let sum = 0;
  for (const line of lines) {
    if (line.lineTotalKrw == null) return null;
    sum += line.lineTotalKrw;
  }
  return sum;
}

export function ComparePlansPopup({
  open,
  onClose,
  selectedCodes,
  countryNameByCode,
  completed,
  compareChoice,
  onCompareChoiceChange,
  onChangeCountryPlan,
}: Props) {
  const individualLines = buildCompareIndividualLines(selectedCodes, completed, countryNameByCode);
  const individualTotal = sumCompareIndividualTotal(individualLines);
  const checkoutAmount =
    compareChoice === "individual" ? individualTotal : null;

  return (
    <RecommendModalShell
      open={open}
      onClose={onClose}
      closeOnBackdrop
      maxWidthClassName="max-w-lg"
    >
      <div className="flex max-h-[92vh] flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">플랜 비교</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            aria-label="닫기"
          >
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <fieldset className="mb-4 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <legend className="sr-only">결제할 플랜 선택</legend>
            <label
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                compareChoice === "individual"
                  ? "bg-white text-teal-800 shadow-sm ring-1 ring-teal-200"
                  : "text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="compare-choice"
                className="sr-only"
                checked={compareChoice === "individual"}
                onChange={() => onCompareChoiceChange("individual")}
              />
              내 선택
            </label>
            <label
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                compareChoice === "multi"
                  ? "bg-white text-teal-800 shadow-sm ring-1 ring-teal-200"
                  : "text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="compare-choice"
                className="sr-only"
                checked={compareChoice === "multi"}
                onChange={() => onCompareChoiceChange("multi")}
              />
              다국가
            </label>
          </fieldset>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">내가 선택한 플랜</h3>
            {individualLines.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                국가별 선택 정보가 없습니다. 각 국가에서 플랜을 다시 선택해 주세요.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {individualLines.map((line) => (
                  <li
                    key={line.code}
                    className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-100">
                      <SafeImage
                        src={flagCdnUrl(line.code)}
                        alt=""
                        width={40}
                        height={40}
                        quality={90}
                        className="h-full w-full object-cover"
                        sizes="40px"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">{line.nameKr}</p>
                        <button
                          type="button"
                          onClick={() => onChangeCountryPlan(line.code)}
                          className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                        >
                          변경
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-slate-600">{line.summary}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {line.lineTotalKrw != null ? (
                          <>
                            {formatKrw(line.lineTotalKrw)}
                            {line.quantity > 1 && line.unitKrw != null ? (
                              <span className="ml-1 text-xs font-medium text-slate-500">
                                ({formatKrw(line.unitKrw)} ×{line.quantity})
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-slate-500">가격 정보 없음</span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-bold text-slate-800">합계</span>
              <span className="text-base font-bold text-teal-800">
                {individualTotal != null ? formatKrw(individualTotal) : "—"}
              </span>
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
            <h3 className="text-sm font-bold text-slate-900">다국가 플랜</h3>
            <p className="mt-2 text-sm text-slate-500">다국가 플랜 불러오는 중 (4-2에서 연결 예정)</p>
          </section>
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            disabled
            className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-300 px-6 text-base font-bold text-white opacity-90"
            aria-disabled
            title="4-2 / 3-1b에서 결제 연결 예정"
          >
            결제하기
            {checkoutAmount != null ? ` · ${formatKrw(checkoutAmount)}` : ""}
            <span className="ml-1 text-sm font-medium opacity-90">(준비 중)</span>
          </button>
        </div>
      </div>
    </RecommendModalShell>
  );
}
