import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";

export const metadata: Metadata = {
  title: "Bong투어 eSIM | 해외 여행 eSIM | Bong투어",
  description: "24시간 고객센터, 100% 환불 보장. 여행지에 맞는 최적의 eSIM을 찾아드립니다.",
};

export default function EsimPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <OverseasTravelSubMainNav variant="links" />

      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 lg:max-w-6xl lg:pb-24 lg:pt-10">
        {/* 상단: Bong투어 eSIM 타이틀 + 사용가능 기기 */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 lg:pb-5">
          <div>
            <h1 className="text-[1.6rem] font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Bong투어 <span className="text-orange-600">eSIM</span>
            </h1>
            <p className="mt-1 text-[13px] text-slate-600 lg:mt-2 lg:text-base">
              해외 여행 데이터, 이제 더 쉽게
            </p>
          </div>
          <Link
            href={bongsimPath("/devices")}
            className="shrink-0 text-[13px] font-semibold text-teal-700 underline decoration-teal-300 decoration-2 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-400 lg:text-base"
          >
            사용가능 기기 확인하기 →
          </Link>
        </div>

        {/* 히어로 섹션: 캐치프레이즈 + CTA */}
        <section className="mt-8 text-center lg:mt-7">
          <p className="text-[15px] font-medium leading-relaxed text-slate-700 sm:text-[17px] lg:text-xl">
            <span className="text-orange-600">&quot;이심전심&quot;</span> 데이터를 중요함을 알기에
          </p>

          {/* 메인 CTA 이미지 영역 — 모바일은 좁게, PC는 가로 활용 */}
          <div className="mx-auto mt-6 max-w-md lg:mt-5 lg:max-w-5xl">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-orange-50 via-teal-50 to-blue-50 p-8 shadow-lg lg:aspect-[2/1] lg:p-12">
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-4 flex items-center gap-3 lg:mb-5 lg:gap-5">
                  <span className="text-5xl lg:text-7xl" aria-hidden>
                    🌍
                  </span>
                  <span className="text-5xl lg:text-7xl" aria-hidden>
                    📱
                  </span>
                  <span className="text-5xl lg:text-7xl" aria-hidden>
                    ✈️
                  </span>
                </div>
                <p className="text-[14px] font-semibold text-slate-700 lg:text-lg">
                  여행지에 딱 맞는 eSIM을 찾아드려요
                </p>
              </div>
            </div>
          </div>

          <Link
            href={bongsimPath("/recommend")}
            className="mt-4 inline-flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 px-10 text-[16px] font-bold text-white shadow-xl transition hover:from-orange-700 hover:to-orange-600 hover:shadow-2xl active:scale-[0.98] lg:mt-5 lg:min-h-[3.75rem] lg:px-12 lg:text-lg"
          >
            나에게 맞는 eSIM 찾기
          </Link>
        </section>

        {/* 왜 Bong투어 eSIM인가 */}
        <section className="mt-14 sm:mt-16 lg:mt-16">
          <h2 className="mb-5 text-center text-[1.3rem] font-bold text-slate-900 sm:text-2xl lg:mb-6 lg:text-3xl">
            왜 Bong투어 <span className="text-orange-600">eSIM</span>일까요?
          </h2>

          <div className="grid items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            <div className="flex min-h-[10.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm sm:min-h-[11rem] lg:min-h-[12rem] lg:gap-2.5 lg:px-4 lg:py-5">
              <div className="text-3xl leading-none lg:text-4xl" aria-hidden>
                💬
              </div>
              <h3 className="text-base font-bold leading-snug text-slate-900 lg:text-lg">24시간 안심 고객센터</h3>
              <p className="text-sm leading-snug text-slate-600 lg:text-[15px]">언제 어디서든 한국어로 빠른 응대</p>
            </div>

            <div className="flex min-h-[10.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm sm:min-h-[11rem] lg:min-h-[12rem] lg:gap-2.5 lg:px-4 lg:py-5">
              <div className="text-3xl leading-none lg:text-4xl" aria-hidden>
                🛡️
              </div>
              <h3 className="text-base font-bold leading-snug text-slate-900 lg:text-lg">100% 환불보장</h3>
              <p className="text-sm leading-snug text-slate-600 lg:text-[15px]">제품 결함 시 전액 환불</p>
            </div>

            <div className="flex min-h-[10.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm sm:min-h-[11rem] lg:min-h-[12rem] lg:gap-2.5 lg:px-4 lg:py-5">
              <div className="text-3xl leading-none lg:text-4xl" aria-hidden>
                📶
              </div>
              <h3 className="text-base font-bold leading-snug text-slate-900 lg:text-lg">데이터 안정성</h3>
              <p className="text-sm leading-snug text-slate-600 lg:text-[15px]">현지 주요 통신사 직접 연결</p>
            </div>

            <div className="flex min-h-[10.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm sm:min-h-[11rem] lg:min-h-[12rem] lg:gap-2.5 lg:px-4 lg:py-5">
              <div className="text-3xl leading-none lg:text-4xl" aria-hidden>
                🎁
              </div>
              <h3 className="text-base font-bold leading-snug text-slate-900 lg:text-lg">간편한 선물하기 기능</h3>
              <p className="text-sm leading-snug text-slate-600 lg:text-[15px]">친구·가족에게 쉽게 전송</p>
            </div>
          </div>
        </section>

        <div className="mt-10 rounded-lg bg-slate-50 px-6 py-4 text-center lg:mt-12 lg:py-5">
          <p className="text-[13px] leading-relaxed text-slate-600 lg:text-base">
            <span className="font-semibold text-slate-800">간편이심</span>은 Bong투어가 직접 운영하고 판매하는 서비스입니다.
          </p>
        </div>
      </main>
    </div>
  );
}
