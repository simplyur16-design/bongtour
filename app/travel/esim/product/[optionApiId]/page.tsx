import Link from "next/link";
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { bongsimPath } from '@/lib/bongsim/constants'
import { notFound } from "next/navigation";
import { ProductDetailV1View } from "@/components/bongsim/detail-v1/ProductDetailV1View";
import { getProductDetailByOptionApiId } from "@/lib/bongsim/data/get-product-detail-by-option-api-id";

type Props = { params: { optionApiId: string } };

export default async function ProductDetailV1Page({ params }: Props) {
  const { optionApiId } = params;
  const res = await getProductDetailByOptionApiId(optionApiId);
  if (!res.ok) {
    if (res.reason === "not_found") notFound();
    return (
      <div className="min-h-screen bg-bt-page">
        <Header />
        <OverseasTravelSubMainNav variant="links" />
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

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <div className="min-h-full bg-slate-50 pb-28">
      <main className="mx-auto max-w-lg px-4 pt-3 sm:max-w-2xl sm:px-6 sm:pt-4 lg:max-w-3xl lg:px-8 lg:pt-6">
        <nav className="text-[12px] text-slate-500 lg:text-[13px]">
          <Link href={bongsimPath()} className="hover:text-teal-800">
            홈
          </Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="text-slate-800">eSIM 상품</span>
        </nav>
        <ProductDetailV1View detail={res.detail} />
      </main>
      </div>
    </div>
  );
}
