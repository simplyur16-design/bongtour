import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";
import EsimServiceNoticeBanner from "@/app/travel/esim/components/EsimServiceNoticeBanner";

export const metadata: Metadata = {
  title: "봉SIM | 해외 여행 eSIM | Bong투어",
  description: "24시간 고객센터, 100% 환불 보장. 여행지에 맞는 최적의 eSIM을 찾아드립니다.",
};

export default function EsimPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <OverseasTravelSubMainNav variant="links" />

      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 lg:pb-28 lg:pt-12">
        {/* 상단: 봉SIM 타이틀 + 사용가능 기기 */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-[1.6rem] font-bold tracking-tight text-slate-900 sm:text-3xl">
              봉<span className="text-orange-600">SIM</span>
            </h1>
            <p className="mt-1 text-[13px] text-slate-600">해외 여행 데이터, 이제 더 쉽게</p>
          </div>
          <Link
            href={bongsimPath("/devices")}
            className="text-[13px] font-semibold text-teal-700 underline decoration-teal-300 decoration-2 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-400"
          >
            사용가능 기기 확인하기 →
          </Link>
        </div>

        {/* 히어로 섹션: 캐치프레이즈 + CTA */}
        <section className="mt-12 text-center">
          <EsimServiceNoticeBanner />
          <p className="text-[15px] font-medium leading-relaxed text-slate-700 sm:text-[17px]">
            <span className="text-orange-600">&quot;이심전심&quot;</span> 데이터를 중요함을 알기에
          </p>

          {/* 메인 CTA 이미지 영역 */}
          <div className="mx-auto mt-10 max-w-md">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-orange-50 via-teal-50 to-blue-50 p-8 shadow-lg">
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-5xl">🌍</span>
                  <span className="text-5xl">📱</span>
                  <span className="text-5xl">✈️</span>
                </div>
                <p className="text-[14px] font-semibold text-slate-700">여행지에 딱 맞는 eSIM을 찾아드려요</p>
              </div>
            </div>
          </div>

          <Link
            href={bongsimPath("/recommend")}
            className="mt-8 inline-flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 px-10 text-[16px] font-bold text-white shadow-xl transition hover:from-orange-700 hover:to-orange-600 hover:shadow-2xl active:scale-[0.98]"
          >
            나에게 맞는 eSIM 찾기
          </Link>
        </section>

        {/* 봉sim의 장점 */}
        <section className="mt-20">
          <h2 className="mb-8 text-center text-[1.3rem] font-bold text-slate-900 sm:text-2xl">
            ✨ 봉<span className="text-orange-600">SIM</span>의 장점
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:border-orange-300 hover:shadow-md">
              <div className="mb-3 text-4xl">📞</div>
              <h3 className="text-[15px] font-bold text-slate-900">24시간 안심 고객센터</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">언제 어디서든 한국어로 빠른 응대</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:border-orange-300 hover:shadow-md">
              <div className="mb-3 text-4xl">💯</div>
              <h3 className="text-[15px] font-bold text-slate-900">100% 환불 보장</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">미사용 시 전액 환불 가능</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:border-orange-300 hover:shadow-md">
              <div className="mb-3 text-4xl">📶</div>
              <h3 className="text-[15px] font-bold text-slate-900">데이터 안정성</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">현지 주요 통신사 직접 연결</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:border-orange-300 hover:shadow-md">
              <div className="mb-3 text-4xl">🎁</div>
              <h3 className="text-[15px] font-bold text-slate-900">간편한 선물하기 기능</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">친구·가족에게 쉽게 전송</p>
            </div>
          </div>
        </section>

        <div className="mt-12 rounded-lg bg-slate-50 px-6 py-4 text-center">
          <p className="text-[13px] leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">간편이심</span>은 Bong투어가 직접 운영하고 판매하는 서비스입니다.
          </p>
        </div>
      </main>
    </div>
  );
}
