import { esimHasFreeData } from "@/lib/bongsim/constants";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

type ProductLike = Pick<ProductOption, "network_family" | "plan_name">;

type Props = {
  product: ProductLike;
  /** plan=플랜 카드(회색 2줄), summary=선택 요약(파랑 강조) */
  variant?: "plan" | "summary";
  className?: string;
};

/**
 * 로밍망 + plan_name 화이트리스트(`esimHasFreeData`)일 때만 표시 — usimsa 혜택 문구.
 */
export function EsimFreeDataBenefitLine({ product, variant = "plan", className }: Props) {
  if (!esimHasFreeData(product.network_family, product.plan_name)) return null;

  if (variant === "summary") {
    return (
      <p className={className ?? "mt-1 text-[11px] font-bold leading-[16px] text-[#0176f9]"}>
        구글맵·ChatGPT 데이터 무료
      </p>
    );
  }

  return (
    <div className={className ?? "mt-1.5 space-y-0.5"}>
      <p className="text-[10px] font-medium leading-[14px] tracking-[-0.5px] text-[#767676]">
        구글맵 데이터 무료
      </p>
      <p className="text-[10px] font-medium leading-[14px] tracking-[-0.5px] text-[#767676]">
        ChatGPT 데이터 무료
      </p>
    </div>
  );
}
