import Link from "next/link";
import type { Metadata } from "next";
import {
  buildEsimSearchMetadata,
  ESIM_SEARCH_TITLE_SUFFIX,
  sanitizeEsimSearchCopy,
} from '@/lib/seo/esim-search-metadata'
import Header from '@/app/components/Header'
import { bongsimPath } from '@/lib/bongsim/constants'
import { notFound } from "next/navigation";
import { ProductDetailV1View } from "@/components/bongsim/detail-v1/ProductDetailV1View";
import { getProductDetailByOptionApiIdCached } from "@/lib/bongsim/data/load-product-detail-cached";
import { listKycFlagProductsForPlanName } from "@/lib/bongsim/data/list-kyc-flag-products-for-plan-name";
import { getKycLabelDistribution } from "@/lib/bongsim/esim/kyc-required";

type Props = { params: Promise<{ optionApiId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { optionApiId } = await params;
  const res = await getProductDetailByOptionApiIdCached(optionApiId);
  const canonical = `/travel/esim/product/${encodeURIComponent(optionApiId)}`;
  if (!res.ok) {
    return {
      title: { absolute: `eSIM 상품 | ${ESIM_SEARCH_TITLE_SUFFIX}` },
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }
  // REGRESSION-FREEZE[seo-search-copy-esim-travel]: 공급사 상품명(유심사 …)은 검색 문구에서 'eSIM(여행용)' 으로 — manifest
  const plan = sanitizeEsimSearchCopy(res.detail.summary.plan_name?.trim() || "eSIM") || "eSIM";
  const option = sanitizeEsimSearchCopy(res.detail.summary.option_label?.trim() ?? "");
  const title = option ? `${plan} ${option} | ${ESIM_SEARCH_TITLE_SUFFIX}` : `${plan} | ${ESIM_SEARCH_TITLE_SUFFIX}`;
  const description = `${plan}${option ? ` · ${option}` : ""} eSIM(여행용) — QR 설치·즉시 구매. 설치·사용 문의는 고객센터에서 안내합니다.`;
  return {
    ...buildEsimSearchMetadata({ title, description, path: canonical }),
    title: { absolute: title },
  };
}

export default async function ProductDetailV1Page({ params }: Props) {
  const { optionApiId } = await params;
  const res = await getProductDetailByOptionApiIdCached(optionApiId);
  if (!res.ok) {
    if (res.reason === "not_found") notFound();
    return (
      <div className="min-h-screen bg-bt-page">
        <Header />
        <div className="min-h-full bg-slate-50">
        <main className="mx-auto max-w-lg px-4 py-10 sm:max-w-2xl lg:max-w-3xl">
          <p className="text-sm text-slate-700">
            {res.reason === "db_unconfigured"
              ? "DATABASE_URL이 설정되지 않았습니다."
              : "상품 정보를 불러오지 못했습니다."}
          </p>
          <Link href={bongsimPath()} className="mt-4 inline-block text-sm text-teal-800 underline">
            홈으로
          </Link>
        </main>
        </div>
      </div>
    );
  }

  const kycDistribution = getKycLabelDistribution(
    await listKycFlagProductsForPlanName(res.detail.summary.plan_name),
  );

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <div className="min-h-full bg-slate-50 pb-8">
      <main className="mx-auto max-w-lg px-4 pt-3 sm:max-w-2xl sm:px-6 sm:pt-4 lg:max-w-3xl lg:px-8 lg:pt-6">
        <nav className="text-[12px] text-slate-500 lg:text-[13px]">
          <Link href={bongsimPath()} className="hover:text-teal-800">
            홈
          </Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="text-slate-800">eSIM 상품</span>
        </nav>
        <ProductDetailV1View detail={res.detail} kycDistribution={kycDistribution} />
      </main>
      </div>
    </div>
  );
}
