import type { BongsimProductDetailV1 } from "@/lib/bongsim/contracts/product-detail.v1";
import { ProductDetailPoliciesV1 } from "@/components/bongsim/detail-v1/ProductDetailPoliciesV1";
import { ProductDetailSpecsV1 } from "@/components/bongsim/detail-v1/ProductDetailSpecsV1";
import { ProductDetailStickyBarV1 } from "@/components/bongsim/detail-v1/ProductDetailStickyBarV1";
import { ProductDetailSummaryV1 } from "@/components/bongsim/detail-v1/ProductDetailSummaryV1";
import { ProductDetailUsageV1 } from "@/components/bongsim/detail-v1/ProductDetailUsageV1";

export function ProductDetailV1View({ detail }: { detail: BongsimProductDetailV1 }) {
  if (detail.schema !== "bongsim.product_detail.v1") {
    return null;
  }

  return (
    <div>
      <ProductDetailSummaryV1 summary={detail.summary} />
      <ProductDetailSpecsV1 specs={detail.specs} />
      <ProductDetailUsageV1 usage={detail.usage} />
      <ProductDetailPoliciesV1 policies={detail.policies} />
      <ProductDetailStickyBarV1 sticky={detail.sticky} />
    </div>
  );
}
