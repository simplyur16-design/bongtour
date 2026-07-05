"use client";

import type { CountryPurchaseNotice as Notice } from "@/lib/bongsim/country-purchase-notices";
import { getCountryPurchaseNotices, getMergedPurchaseNotices } from "@/lib/bongsim/country-purchase-notices";

function NoticeCard({ notice }: { notice: Notice }) {
  const isWarning = notice.severity === "warning";
  return (
    <div
      className={
        isWarning
          ? "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 sm:px-4 sm:py-3"
          : "rounded-xl border border-[#dbeafe] bg-[#f3f8ff] px-3 py-2.5 sm:px-4 sm:py-3"
      }
      role="note"
    >
      <p
        className={`text-[13px] font-semibold leading-snug ${
          isWarning ? "text-amber-950" : "text-[#121417]"
        }`}
      >
        {notice.title}
      </p>
      <p
        className={`mt-1 text-[12px] leading-relaxed ${
          isWarning ? "text-amber-900/90" : "text-[#424242]"
        }`}
      >
        {notice.body}
      </p>
    </div>
  );
}

type Props =
  | { countryCode: string; countryCodes?: never; compact?: boolean }
  | { countryCodes: string[]; countryCode?: never; compact?: boolean };

export function CountryPurchaseNoticeList({ compact, ...props }: Props) {
  const notices =
    "countryCode" in props && props.countryCode
      ? getCountryPurchaseNotices(props.countryCode)
      : getMergedPurchaseNotices(props.countryCodes ?? []);

  if (notices.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"} aria-label="국가별 구매 안내">
      {notices.map((n) => (
        <NoticeCard key={`${n.severity}-${n.title}`} notice={n} />
      ))}
    </div>
  );
}
