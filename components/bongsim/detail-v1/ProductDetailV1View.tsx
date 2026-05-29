import type { BongsimProductDetailV1 } from "@/lib/bongsim/contracts/product-detail.v1";
import { ProductDetailPoliciesV1 } from "@/components/bongsim/detail-v1/ProductDetailPoliciesV1";
import { ProductDetailSpecsV1 } from "@/components/bongsim/detail-v1/ProductDetailSpecsV1";
import { ProductDetailStickyBarV1 } from "@/components/bongsim/detail-v1/ProductDetailStickyBarV1";
import { ProductDetailSummaryV1 } from "@/components/bongsim/detail-v1/ProductDetailSummaryV1";
import { ProductDetailUsageV1 } from "@/components/bongsim/detail-v1/ProductDetailUsageV1";
import {
  shouldShowBadge,
  type KycLabelDistribution,
} from "@/lib/bongsim/esim/kyc-required";

export function ProductDetailV1View({
  detail,
  kycDistribution,
}: {
  detail: BongsimProductDetailV1;
  kycDistribution: KycLabelDistribution;
}) {
  if (detail.schema !== "bongsim.product_detail.v1") {
    return null;
  }

  const kycBadge = shouldShowBadge(
    { flags: { kyc: detail.usage.kyc_flag_raw } },
    kycDistribution,
  );

  return (
    <div>
      <ProductDetailSummaryV1
        summary={detail.summary}
        kycBadge={kycBadge}
        qosRaw={detail.specs.qos_raw}
      />
      <ProductDetailSpecsV1 specs={detail.specs} />
      <ProductDetailUsageV1 usage={detail.usage} />
      <ProductDetailPoliciesV1 policies={detail.policies} />
      <ProductDetailStickyBarV1 sticky={detail.sticky} />
    </div>
  );
}
