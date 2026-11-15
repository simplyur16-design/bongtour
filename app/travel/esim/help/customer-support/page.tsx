import type { Metadata } from "next";
import { buildEsimSearchMetadata, esimSearchTitle } from "@/lib/seo/esim-search-metadata";
import Link from "next/link";
import Header from "@/app/components/Header";
import { EsimMypageUsimsaCsLinks } from "@/components/bongsim/EsimMypageUsimsaCsLinks";
import { HelpSupportDetailLayout } from "@/components/bongsim/HelpSupportDetailLayout";
import { bongsimPath } from "@/lib/bongsim/constants";

export const metadata: Metadata = {
  ...buildEsimSearchMetadata({
    title: esimSearchTitle("eSIM 고객센터"),
    description: "Bong투어 eSIM(여행용) 고객센터 상담 시간과 문의 방법을 안내합니다.",
    path: "/travel/esim/help/customer-support",
  }),
};

export default function EsimCustomerSupportPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <HelpSupportDetailLayout
        currentPath={bongsimPath("/help/customer-support")}
        title="고객지원 / 운영 안내"
        intro="eSIM 설치·사용 문의는 아래 고객센터로 연결됩니다."
      >
        <div className="space-y-6">
          <EsimMypageUsimsaCsLinks />
          <Link href="/support" className="inline-flex text-sm font-semibold text-teal-800 underline-offset-2 hover:underline">
            여행 고객지원 허브
          </Link>
        </div>
      </HelpSupportDetailLayout>
    </div>
  );
}
