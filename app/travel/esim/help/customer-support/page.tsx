import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/Header";
import { EsimBongsimCsLinks } from "@/components/bongsim/EsimBongsimCsLinks";
import { EsimMypageUsimsaCsLinks } from "@/components/bongsim/EsimMypageUsimsaCsLinks";
import { HelpSupportDetailLayout } from "@/components/bongsim/HelpSupportDetailLayout";
import { BONGSIM_ESIM_SUPPORT_EMAIL_LINE, bongsimPath } from "@/lib/bongsim/constants";

export const metadata: Metadata = {
  title: "eSIM 고객지원",
  description: "Bong투어 eSIM 상담 시간과 문의 채널을 안내합니다.",
  alternates: { canonical: "/travel/esim/help/customer-support" },
};

export default function EsimCustomerSupportPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <HelpSupportDetailLayout
        currentPath={bongsimPath("/help/customer-support")}
        title="고객지원 / 운영 안내"
        intro="구매·결제 문의는 봉투어 고객센터, 설치·개통 문의는 24시간 채널을 이용해 주세요."
      >
        <div className="space-y-6">
          <EsimBongsimCsLinks />
          <p className="text-sm text-slate-700">{BONGSIM_ESIM_SUPPORT_EMAIL_LINE}</p>
          <EsimMypageUsimsaCsLinks />
          <Link href="/support" className="inline-flex text-sm font-semibold text-teal-800 underline-offset-2 hover:underline">
            여행 고객지원 허브
          </Link>
        </div>
      </HelpSupportDetailLayout>
    </div>
  );
}
