import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { FileText, RefreshCw, Scale, ShieldAlert } from "lucide-react";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";
import { SITE_NAME } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: `eSIM 환불·서비스 정책 | Bong투어 eSIM`,
  description:
    "Bong투어 eSIM(무형재화)의 서비스 제공기간, 환불·교환 정책 및 유의사항입니다. 결제 후 QR 발송, 활성화 기준, 미활성 시 환불 안내.",
  alternates: { canonical: "/travel/esim/policy" },
  openGraph: {
    title: `eSIM 환불·서비스 정책 | ${SITE_NAME} eSIM`,
    description: "서비스 제공기간, 환불·교환 정책, 유의사항(무형재화·디지털 상품 기준).",
    url: "/travel/esim/policy",
    type: "website",
  },
};

const SECTIONS: Array<{
  id: string;
  title: string;
  icon: typeof FileText;
  body: ReactNode;
}> = [
  {
    id: "service-period",
    title: "서비스 제공기간",
    icon: FileText,
    body: (
      <ul className="ml-4 list-disc space-y-2 pl-1 marker:text-teal-600">
        <li>eSIM은 결제 완료 후 이메일로 QR코드가 즉시 발송됩니다.</li>
        <li>
          데이터 사용 기간은 구매하신 플랜에 따라 다르며, 최초 활성화(현지 네트워크 연결) 시점부터 기산됩니다.
        </li>
        <li>최대 서비스 제공기간: 결제일로부터 180일(미활성화 기준)</li>
      </ul>
    ),
  },
  {
    id: "refund",
    title: "환불정책",
    icon: Scale,
    body: (
      <ul className="ml-4 list-disc space-y-2 pl-1 marker:text-teal-600">
        <li>QR코드 미사용(미활성화) 시: 전액 환불 가능</li>
        <li>QR코드 사용(활성화) 후: 환불 불가</li>
        <li>제품 결함 시: 전액 환불 또는 재발급</li>
        <li>
          환불 신청: 고객센터 또는 이메일(
          <a
            href="mailto:bongtour24@naver.com"
            className="font-medium text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-800"
          >
            bongtour24@naver.com
          </a>
          )
        </li>
      </ul>
    ),
  },
  {
    id: "exchange",
    title: "교환정책",
    icon: RefreshCw,
    body: (
      <ul className="ml-4 list-disc space-y-2 pl-1 marker:text-teal-600">
        <li>eSIM은 디지털 상품으로 교환이 불가합니다.</li>
        <li>제품 결함 시 동일 상품 재발급으로 대체합니다.</li>
      </ul>
    ),
  },
  {
    id: "notice",
    title: "유의사항",
    icon: ShieldAlert,
    body: (
      <ul className="ml-4 list-disc space-y-2 pl-1 marker:text-teal-600">
        <li>eSIM QR코드는 1회만 사용 가능하며, 삭제 시 재설치가 불가합니다.</li>
        <li>기기 호환성을 반드시 확인 후 구매해 주세요.</li>
      </ul>
    ),
  },
];

export default function EsimPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <OverseasTravelSubMainNav variant="links" />

      <section
        className="w-full bg-gradient-to-br from-sky-50 to-teal-50 px-4 py-12 lg:py-16"
        aria-labelledby="esim-policy-hero"
      >
        <div className="mx-auto max-w-3xl text-center lg:max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800/80">무형재화 · 디지털 상품</p>
          <h1
            id="esim-policy-hero"
            className="mt-2 text-balance text-2xl font-bold leading-tight tracking-tight text-slate-900 lg:text-4xl"
          >
            eSIM 환불·서비스 정책
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 lg:mt-5 lg:text-lg">
            간편이심(eSIM) 구매 전 서비스 제공 기간과 환불·교환 기준을 확인해 주세요.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:max-w-4xl lg:px-6 lg:pb-20 lg:pt-10">
        <div className="space-y-6 lg:space-y-8">
          {SECTIONS.map(({ id, title, icon: Icon, body }) => (
            <section
              key={id}
              id={id}
              className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6"
              aria-labelledby={`${id}-heading`}
            >
              <h2
                id={`${id}-heading`}
                className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-bold text-slate-900 lg:text-xl"
              >
                <Icon className="h-5 w-5 shrink-0 text-teal-600" aria-hidden />
                {title}
              </h2>
              <div className="mt-4 text-sm leading-relaxed text-slate-700 lg:text-base">{body}</div>
            </section>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          <Link href={bongsimPath()} className="font-medium text-teal-700 underline-offset-4 hover:underline">
            ← eSIM 홈으로
          </Link>
        </p>
      </main>
    </div>
  );
}
