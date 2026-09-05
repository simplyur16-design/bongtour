import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/Header";
import { HelpSupportDetailLayout } from "@/components/bongsim/HelpSupportDetailLayout";
import { bongsimPath } from "@/lib/bongsim/constants";

export const metadata: Metadata = {
  title: "eSIM 서비스 도움말",
  description: "Bong투어 eSIM 이용 중 자주 묻는 질문과 문의 경로를 안내합니다.",
  alternates: { canonical: "/travel/esim/help/service-help" },
};

export default function EsimServiceHelpPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <HelpSupportDetailLayout
        currentPath={bongsimPath("/help/service-help")}
        title="서비스 도움말 / 문의"
        intro="설치·개통·요금 문의는 아래 경로로 먼저 확인하세요. 해결되지 않으면 고객지원으로 이어집니다."
      >
        <ul className="space-y-3 text-sm leading-relaxed text-slate-700">
          <li>
            <Link href={bongsimPath("/help/setup-guide")} className="font-semibold text-teal-800 underline-offset-2 hover:underline">
              설정 가이드
            </Link>
            — 출국 전 설치, 요금 폭탄 방지, QR 안내
          </li>
          <li>
            <Link href={bongsimPath("/guide")} className="font-semibold text-teal-800 underline-offset-2 hover:underline">
              iPhone·Android 전체 가이드
            </Link>
            — 기종별 설치 화면
          </li>
          <li>
            <Link href={bongsimPath("/help/device-compatibility")} className="font-semibold text-teal-800 underline-offset-2 hover:underline">
              이용 가능 기기
            </Link>
            — 구매 전 호환 확인
          </li>
          <li>
            <Link href="/inquiry?type=travel&source=/travel/esim/help/service-help" className="font-semibold text-teal-800 underline-offset-2 hover:underline">
              문의 접수
            </Link>
            — 일정·상품이 아닌 eSIM 이용 문의도 남길 수 있습니다
          </li>
        </ul>
      </HelpSupportDetailLayout>
    </div>
  );
}
