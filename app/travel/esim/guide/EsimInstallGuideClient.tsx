"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  Headphones,
  HelpCircle,
  Mail,
  Plane,
  ScanLine,
  Settings2,
  Smartphone,
  Wifi,
} from "lucide-react";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";

type Os = "iphone" | "samsung";

function StepOsTabs({
  iphone,
  samsung,
  showPathHint,
}: {
  iphone: string;
  samsung: string;
  showPathHint: boolean;
}) {
  const [os, setOs] = useState<Os>("iphone");
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex gap-1 rounded-lg bg-slate-200/60 p-1">
        <button
          type="button"
          onClick={() => setOs("iphone")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition lg:text-sm ${
            os === "iphone" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          iPhone
        </button>
        <button
          type="button"
          onClick={() => setOs("samsung")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition lg:text-sm ${
            os === "samsung" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Samsung
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">{os === "iphone" ? iphone : samsung}</p>
      {showPathHint ? (
        <p className="mt-2 border-t border-slate-200/80 pt-2 text-[11px] leading-relaxed text-slate-500">
          <span className="font-medium text-slate-600">경로 요약:</span> iPhone — 설정 → 셀룰러 → eSIM 추가 → QR코드
          / Samsung — 설정 → 연결 → SIM 관리자 → eSIM 추가 → QR코드
        </p>
      ) : null}
    </div>
  );
}

const STEPS: Array<{
  n: number;
  title: string;
  icon: typeof Mail;
  iphone: string;
  samsung: string;
}> = [
  {
    n: 1,
    title: "이메일로 받은 QR코드를 준비하세요",
    icon: Mail,
    iphone: "주문 완료 메일에 첨부된 QR 코드를 미리 열어 두세요. 캡처 이미지로 저장해 두셔도 좋아요.",
    samsung: "주문 완료 메일에 첨부된 QR 코드를 미리 열어 두세요. 캡처 이미지로 저장해 두셔도 좋아요.",
  },
  {
    n: 2,
    title: "설정 → 셀룰러(모바일 데이터) → eSIM 추가",
    icon: Settings2,
    iphone: "설정 앱을 연 뒤, 셀룰러(또는 모바일 데이터)로 들어가 ‘eSIM 추가’ 또는 ‘셀룰러 요금제 추가’를 눌러 주세요.",
    samsung: "설정 → 연결 → SIM 관리자로 이동한 뒤, ‘eSIM 추가’를 선택해 주세요.",
  },
  {
    n: 3,
    title: "QR코드를 스캔하세요",
    icon: ScanLine,
    iphone: "카메라로 스캔하거나, 저장된 QR 이미지를 불러와 등록할 수 있어요. 안내에 따라 진행해 주세요.",
    samsung: "‘QR 코드 스캔’을 선택한 뒤, 메일에 있는 QR을 비추거나 이미지를 선택해 주세요.",
  },
  {
    n: 4,
    title: "데이터 플랜이 추가되면 설치 완료!",
    icon: Smartphone,
    iphone: "셀룰러 화면에 새 요금제(라인)가 보이면 설치가 끝난 거예요. 라벨을 여행지 이름으로 바꿔 두면 헷갈리지 않아요.",
    samsung: "SIM 관리자에 새 eSIM 프로필이 표시되면 완료예요. 여행지 이름으로 바꿔 두시면 편해요.",
  },
  {
    n: 5,
    title: "여행지 도착 후 eSIM 데이터를 켜세요",
    icon: Plane,
    iphone: "현지에 도착하신 뒤, 설정 → 셀룰러에서 해당 라인의 ‘데이터’를 켜고, 데이터 로밍도 허용해 주세요.",
    samsung: "도착 후 설정 → 연결 → SIM 카드에서 eSIM 라인의 모바일 데이터를 켜 주세요. 로밍이 꺼져 있지 않은지도 확인해 주세요.",
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "eSIM 설치하면 기존 번호는 어떻게 되나요?",
    a: "기존 번호 그대로 사용! eSIM은 데이터 전용으로 추가됩니다",
  },
  {
    q: "여행지 도착 전에 설치해도 되나요?",
    a: "네! 미리 설치하고 도착 후 데이터만 켜면 됩니다",
  },
  {
    q: "eSIM을 삭제하면 다시 설치할 수 있나요?",
    a: "아니요, QR코드는 1회만 사용 가능합니다. 삭제하지 마세요",
  },
  {
    q: "데이터가 안 되면 어떻게 하나요?",
    a: "데이터 로밍을 켜주세요. 설정 → 셀룰러 → 데이터 로밍 ON",
  },
];

export function EsimInstallGuideClient() {
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <OverseasTravelSubMainNav variant="links" />

      <section
        className="w-full bg-gradient-to-br from-sky-50 to-teal-50 px-4 py-12 lg:py-16"
        aria-labelledby="esim-guide-hero"
      >
        <div className="mx-auto max-w-3xl text-center lg:max-w-4xl">
          <h1
            id="esim-guide-hero"
            className="text-balance text-2xl font-bold leading-tight tracking-tight text-slate-900 lg:text-4xl"
          >
            eSIM 설치 가이드
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium text-slate-600 lg:mt-5 lg:text-lg">
            QR코드 하나로 1분 만에 설치 완료!
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 lg:text-base">여행자님, 천천히 따라 오시면 금방 끝나요.</p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:max-w-4xl lg:px-6 lg:pb-20 lg:pt-10">
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 lg:p-5"
          role="region"
          aria-label="설치 전 확인사항"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <Wifi className="h-5 w-5" aria-hidden />
            </span>
            <ul className="space-y-2.5 text-sm leading-relaxed text-amber-950 lg:text-base">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                Wi-Fi에 연결된 상태에서 설치해주세요
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                여행 출발 전날 미리 설치하는 것을 추천해요
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                기존 유심은 그대로! eSIM은 추가로 설치됩니다
              </li>
            </ul>
          </div>
        </div>

        <section className="mt-10 lg:mt-12" aria-labelledby="esim-guide-steps">
          <h2 id="esim-guide-steps" className="flex items-center gap-2 text-lg font-bold text-slate-900 lg:text-xl">
            <Settings2 className="h-5 w-5 text-teal-600" aria-hidden />
            설치 단계
          </h2>
          <ol className="mt-6 space-y-8">
            {STEPS.map(({ n, title, icon: Icon, iphone, samsung }) => (
              <li key={n} className="relative flex gap-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-sm font-bold text-white shadow-md ring-4 ring-teal-100 lg:h-11 lg:w-11 lg:text-base"
                  aria-hidden
                >
                  {n}
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />
                    <h3 className="text-base font-semibold leading-snug text-slate-900 lg:text-lg">{title}</h3>
                  </div>
                  <StepOsTabs iphone={iphone} samsung={samsung} showPathHint={n >= 2} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 lg:mt-14" aria-labelledby="esim-guide-faq">
          <h2 id="esim-guide-faq" className="flex items-center gap-2 text-lg font-bold text-slate-900 lg:text-xl">
            <HelpCircle className="h-5 w-5 text-teal-600" aria-hidden />
            자주 묻는 질문
          </h2>
          <div className="mt-4 space-y-2">
            {FAQ.map(({ q, a }) => {
              const open = openFaq === q;
              return (
                <div key={q} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : q)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50 lg:px-5 lg:py-4 lg:text-base"
                    aria-expanded={open}
                  >
                    <span>{q}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  {open ? (
                    <div className="border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600 lg:px-5 lg:py-4 lg:text-base">
                      {a}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-12 rounded-2xl border border-teal-100 bg-gradient-to-br from-sky-50/90 to-teal-50/90 px-5 py-8 text-center lg:mt-14 lg:px-8 lg:py-10">
          <p className="text-base font-semibold text-slate-800 lg:text-lg">아직 eSIM이 없으신가요?</p>
          <Link
            href={bongsimPath("/recommend")}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-8 py-3.5 text-base font-bold text-white shadow-md transition hover:from-teal-600 hover:to-cyan-600 hover:shadow-lg active:scale-[0.99] lg:px-10 lg:py-4 lg:text-lg"
          >
            나에게 맞는 eSIM 찾기
          </Link>
          <p className="mt-6 flex flex-col items-center gap-1.5 text-sm text-slate-600 lg:flex-row lg:justify-center lg:gap-2">
            <span className="inline-flex items-center gap-1.5">
              <Headphones className="h-4 w-4 text-teal-600" aria-hidden />
              문제가 있으신가요?
            </span>
            <span className="font-medium text-slate-800">24시간 고객센터</span>
            <span className="text-xs text-slate-400">(연결 예정)</span>
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href={bongsimPath()} className="font-medium text-teal-700 underline-offset-4 hover:underline">
            ← eSIM 홈으로
          </Link>
        </p>
      </main>
    </div>
  );
}
