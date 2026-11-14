import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/Header";
import { EsimInstallManuscriptView } from "@/components/bongsim/esim/EsimInstallManuscriptView";
import { ESIM_INSTALL_AUTH_MARKDOWN } from "@/lib/bongsim/esim-install-guide-copy";
import { ESIM_INSTALL_AUTH_PATH, ESIM_INSTALL_GENERAL_PATH } from "@/lib/bongsim/esim-install-guide";

export const metadata: Metadata = {
  title: { absolute: "eSIM 설치·설정 안내 (인증형) | Bong투어 eSIM" },
  description:
    "여행자 인증이 필요한 eSIM(여행용) 상품의 아이폰·갤럭시 설치, 현지 설정, 자주 묻는 문제, 고객센터 안내.",
  alternates: { canonical: ESIM_INSTALL_AUTH_PATH },
};

export default function EsimInstallAuthPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:max-w-4xl lg:px-6 lg:pb-20 lg:pt-10">
        <EsimInstallManuscriptView markdown={ESIM_INSTALL_AUTH_MARKDOWN} />
        <p className="mt-8 text-sm text-slate-600">
          인증이 필요 없는 상품은{" "}
          <Link href={ESIM_INSTALL_GENERAL_PATH} className="font-semibold text-teal-800 underline-offset-2 hover:underline">
            일반형 설치 안내
          </Link>
          를 보세요.
        </p>
      </main>
    </div>
  );
}
