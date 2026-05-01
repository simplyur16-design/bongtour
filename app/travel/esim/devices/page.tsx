import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath, BONGSIM_KAKAO_CHANNEL_URL } from "@/lib/bongsim/constants";

export const metadata: Metadata = {
  title: "eSIM 지원 기기 확인 | Bong투어 eSIM",
  description:
    "여행자님, 구매 전 사용 중인 휴대폰이 eSIM을 지원하는지 확인해 보세요. 삼성·애플·픽셀 기준과 기종 확인 방법을 안내합니다.",
};

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default function EsimDevicesPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <OverseasTravelSubMainNav variant="links" />

      <section
        className="w-full bg-gradient-to-br from-sky-50 to-teal-50 px-4 py-12 lg:py-16"
        aria-labelledby="esim-devices-hero"
      >
        <div className="mx-auto max-w-3xl text-center lg:max-w-4xl">
          <h1
            id="esim-devices-hero"
            className="text-balance text-2xl font-bold leading-tight tracking-tight text-slate-900 lg:text-4xl"
          >
            eSIM 지원 기종, 구매 전 체크해 보세요
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 lg:mt-5 lg:text-lg">
            여행자님, 사용 중인 휴대폰이 eSIM을 지원하는지 먼저 확인해보세요.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:max-w-4xl lg:px-6 lg:pb-20 lg:pt-10">
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 lg:p-5 lg:text-base"
          role="note"
        >
          eSIM을 먼저 구매한 후 휴대폰이 미지원 기종임을 뒤늦게 알게 되면, 여행지에서 인터넷 연결이 안 되는 불편을 겪을 수 있어요.
        </div>

        <div className="mt-8 space-y-8 lg:mt-10 lg:space-y-10">
          <SectionCard title="Samsung (한국 사용자 기준)">
            <ul className="list-inside list-disc space-y-1.5 marker:text-teal-600">
              <li>Z Fold 7, Z Flip 7, Z Fold 6, Z Flip 6, Z Fold 5, Z Flip 5, Z Fold 4, Z Flip 4</li>
              <li>S23 Series, S24 Series, S25 Series, S26 Series</li>
              <li>A54, A55, A56 (한국판)</li>
            </ul>
            <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
              ⚠️ Galaxy S22 이하 한국판은 eSIM을 지원하지 않습니다
            </p>
            <p className="rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-sm text-slate-700">
              💡 출시 국가가 중국 본토, 홍콩, 마카오인 갤럭시 기기는 eSIM을 지원하지 않아요.
            </p>
          </SectionCard>

          <SectionCard title="Apple iPhone">
            <ul className="list-inside list-disc space-y-1.5 marker:text-teal-600">
              <li>iPhone XR, XS, XS Max</li>
              <li>iPhone SE (2세대, 3세대)</li>
              <li>iPhone 11~17 Series 전부</li>
            </ul>
            <p className="rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-sm text-slate-700">
              💡 출시 국가가 중국 본토, 홍콩, 마카오인 기기는 eSIM을 지원하지 않아요. (단, iPhone 13 Mini, iPhone 12
              Mini, iPhone SE 2020 및 iPhone XS는 지원)
            </p>
          </SectionCard>

          <SectionCard title="Google Pixel">
            <p>Pixel 2 이후 전 모델 (한국 미출시)</p>
          </SectionCard>

          <section
            className="rounded-xl bg-slate-50 p-6 lg:p-8"
            aria-labelledby="esim-devices-check-heading"
          >
            <h2 id="esim-devices-check-heading" className="text-lg font-bold text-slate-900 lg:text-xl">
              가능한 기종인지 확인하기
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 lg:text-base">
              전화 키패드 {">"}{" "}
              <span className="font-mono font-semibold text-slate-800">*#06#</span> 입력 {">"}{" "}
              <span className="font-semibold text-teal-700">‘EID’</span>가 있다면 사용 가능!
            </p>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-4">
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-6 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">다이얼 입력</p>
                <p className="mt-3 font-mono text-2xl font-bold tracking-wider text-slate-800 lg:text-3xl">
                  *#06#
                </p>
                <p className="mt-2 text-center text-[11px] text-slate-500">전화 앱 키패드에 그대로 입력해 보세요</p>
              </div>
              <div className="flex flex-1 flex-col justify-center rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-6 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-teal-800">EID 정보</p>
                <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-slate-700 lg:text-xs">
                  EID: 89049032…
                  <br />
                  (일부 기기에서는 IMEI와 함께 표시돼요)
                </p>
                <p className="mt-3 text-sm font-medium text-teal-900">EID가 보이면 eSIM 사용 가능 신호예요</p>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-sky-50/80 to-teal-50/80 px-5 py-8 text-center lg:px-8 lg:py-10">
            <p className="text-base font-semibold text-slate-800 lg:text-lg">
              확인되셨나요? 지금 바로 나에게 맞는 eSIM을 찾아보세요!
            </p>
            <Link
              href={bongsimPath("/recommend")}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-8 py-3.5 text-base font-bold text-white shadow-md transition hover:from-teal-600 hover:to-cyan-600 hover:shadow-lg active:scale-[0.99] lg:px-10 lg:py-4 lg:text-lg"
            >
              나에게 맞는 eSIM 찾기
            </Link>
          </div>

          <p className="text-center text-sm text-slate-500">
            기기 확인이 어려우신가요?{" "}
            <a
              href={BONGSIM_KAKAO_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 underline hover:text-teal-700"
            >
              카카오톡 문의하기
            </a>
          </p>
          <p className="mt-3 text-center text-sm text-slate-500">
            <Link href={bongsimPath()} className="font-medium text-teal-700 underline-offset-4 hover:underline">
              ← eSIM 홈으로
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
