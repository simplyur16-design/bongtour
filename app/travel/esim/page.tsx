import type { Metadata } from "next";
import Link from "next/link";
import { Gift, MessageCircle, ShieldCheck, Signal } from "lucide-react";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";

export const metadata: Metadata = {
  title: "Bong투어 eSIM | 해외 여행 eSIM | Bong투어",
  description: "24시간 고객센터, 100% 환불 보장. 여행지에 맞는 최적의 eSIM을 찾아드립니다.",
};

const WHY_ITEMS = [
  {
    icon: MessageCircle,
    title: "24시간 안심 고객센터",
    body: "언제 어디서든 한국어로 빠른 응대",
    circleClass: "bg-teal-100 text-teal-600",
  },
  {
    icon: ShieldCheck,
    title: "100% 환불보장",
    body: "제품 결함 시 전액 환불",
    circleClass: "bg-emerald-100 text-emerald-600",
  },
  {
    icon: Signal,
    title: "데이터 안정성",
    body: "현지 주요 통신사 직접 연결",
    circleClass: "bg-blue-100 text-blue-600",
  },
  {
    icon: Gift,
    title: "간편한 선물하기 기능",
    body: "친구·가족에게 쉽게 전송",
    circleClass: "bg-amber-100 text-amber-600",
  },
] as const;

export default function EsimPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <OverseasTravelSubMainNav variant="links" />

      <section
        className="w-full bg-gradient-to-br from-sky-50 to-teal-50 px-4 py-12 text-center lg:py-20"
        aria-labelledby="esim-hero-heading"
      >
        <div className="mx-auto max-w-4xl lg:max-w-5xl">
          <h1
            id="esim-hero-heading"
            className="text-balance text-3xl font-bold leading-tight tracking-tight text-slate-900 lg:text-5xl"
          >
            여행지에 딱 맞는 eSIM
          </h1>
          <div className="mx-auto mt-3 flex max-w-2xl flex-col items-center gap-2 lg:mt-4">
            <p className="text-lg text-slate-600 lg:text-xl">해외 여행 데이터, 이제 더 쉽게</p>
            <Link
              href={bongsimPath("/devices")}
              className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-400"
            >
              사용가능 기기 확인하기 →
            </Link>
          </div>
          <div className="mt-8 lg:mt-10">
            <Link
              href={bongsimPath("/recommend")}
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 px-10 py-4 text-lg font-bold text-white shadow-lg transition hover:from-teal-600 hover:to-cyan-600 hover:shadow-xl active:scale-[0.99]"
            >
              나에게 맞는 eSIM 찾기
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 pb-12 pt-10 lg:max-w-5xl lg:px-0 lg:pb-14 lg:pt-12">
        <section className="text-center" aria-labelledby="esim-why-heading">
          <h2 id="esim-why-heading" className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            왜 Bong투어 <span className="text-orange-600">eSIM</span>일까요?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600 lg:mt-4 lg:text-lg">
            여행 준비부터 현지 체류까지, 데이터 걱정을 덜어 드립니다.
          </p>

          <div className="mx-auto mt-8 grid grid-cols-1 gap-4 text-left sm:mt-10 sm:grid-cols-2 lg:mt-12">
            {WHY_ITEMS.map(({ icon: Icon, title, body, circleClass }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div
                  className={`flex shrink-0 items-center justify-center rounded-full p-3 ${circleClass}`}
                  aria-hidden
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="w-full bg-slate-50 py-6 text-center">
        <div className="mx-auto max-w-4xl px-4 lg:max-w-5xl lg:px-0">
          <p className="text-sm leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">간편이심</span>은 Bong투어가 직접 운영하고 판매하는 서비스입니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
