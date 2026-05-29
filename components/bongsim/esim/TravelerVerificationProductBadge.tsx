import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { KycLabelState } from "@/lib/bongsim/esim/kyc-required";

type Props = {
  state: KycLabelState;
  className?: string;
  size?: "sm" | "md";
};

export function TravelerVerificationProductBadge({ state, className = "", size = "sm" }: Props) {
  if (state === "unknown") return null;

  const sizeClass =
    size === "md" ? "text-xs py-1 px-2" : "text-[10px] py-0.5 px-1.5";
  const iconClass = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  if (state === "required") {
    return (
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-100 font-semibold text-amber-800 ${sizeClass} ${className}`}
      >
        <ShieldAlert className={iconClass} aria-hidden />
        여행자 인증 필요
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-teal-200 bg-teal-100 font-semibold text-teal-800 ${sizeClass} ${className}`}
    >
      <ShieldCheck className={iconClass} aria-hidden />
      인증 필요없음
    </span>
  );
}
