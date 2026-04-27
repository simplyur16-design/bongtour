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
    circleClass: "bg-teal-500 text-white",
  },
  {
    icon: ShieldCheck,
    title: "100% 환불보장",
    body: "제품 결함 시 전액 환불",
    circleClass: "bg-emerald-500 text-white",
  },
  {
    icon: Signal,
    title: "데이터 안정성",
    body: "현지 주요 통신사 직접 연결",
    circleClass: "bg-blue-500 text-white",
  },
  {
    icon: Gift,
    title: "간편한 선물하기 기능",
    body: "친구·가족에게 쉽게 전송",
    circleClass: "bg-amber-500 text-white",
  },
] as const;

export default function EsimPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <OverseasTravelSubMainNav variant="links" />

      <section
        className="w-full bg-gradient-to-br from-sky-50 to-teal-50 px-4 py-12 text-center sm:py-14 lg:px-8 lg:py-16"
        aria-labelledby="esim-hero-heading"
      >
        <div className="mx-auto max-w-5xl lg:max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/80 sm:text-sm">
            Bong투어 eSIM
          </p>
          <h1
            id="esim-hero-heading"
            className="mt-2 text-balance text-3xl font-bold leading-tight tracking-tight text-slate-900 lg:mt-3 lg:text-5xl"
          >
            여행지에 딱 맞는 eSIM
          </h1>
          <div className="mx-auto mt-3 flex max-w-2xl flex-col items-center gap-2 sm:mt-4 lg:mt-5">
            <p className="text-lg text-slate-600 lg:text-xl">해외 여행 데이터, 이제 더 쉽게</p>
            <Link
              href={bongsimPath("/devices")}
              className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-400"
            >
              사용가능 기기 확인하기 →
            </Link>
          </div>
          <div className="mt-8 sm:mt-10 lg:mt-12">
            <Link
              href={bongsimPath("/recommend")}
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-500 px-10 py-4 text-lg font-bold text-white shadow-lg transition hover:from-teal-700 hover:to-cyan-600 hover:shadow-xl active:scale-[0.99]"
            >
              나에게 맞는 eSIM 찾기
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6 sm:pb-14 sm:pt-12 lg:max-w-6xl lg:pb-16 lg:pt-14">
        <section className="text-center" aria-labelledby="esim-why-heading">
          <h2 id="esim-why-heading" className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            왜 Bong투어 <span className="text-orange-600">eSIM</span>일까요?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600 lg:mt-4 lg:text-lg">
            여행 준비부터 현지 체류까지, 데이터 걱정을 덜어 드립니다.
          </p>

          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 text-left sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:mt-12 lg:max-w-none lg:gap-6">
            {WHY_ITEMS.map(({ icon: Icon, title, body, circleClass }) => (
              <div
                key={title}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:gap-4"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${circleClass}`}
                  aria-hidden
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-slate-900 lg:text-xl">{title}</h3>
                  <p className="mt-1 text-base leading-relaxed text-slate-600 lg:text-[1.05rem]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="w-full bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:max-w-6xl">
          <p className="text-sm leading-relaxed text-slate-600 lg:text-base">
            <span className="font-semibold text-slate-800">간편이심</span>은 Bong투어가 직접 운영하고 판매하는 서비스입니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
