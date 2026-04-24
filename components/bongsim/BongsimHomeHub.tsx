"use client";

import { bongsimPath } from '@/lib/bongsim/constants'
import Link from "next/link";
import { useState } from "react";
import { BongsimHomeHero } from "@/components/bongsim/BongsimHero";
import { BongsimHomeSupportSection } from "@/components/bongsim/BongsimHomeSupportSection";
import { BongsimTrustSection } from "@/components/bongsim/BongsimTrustSection";
import { SimplyurTeaserBanner } from "@/components/bongsim/SimplyurTeaserBanner";
import { DeviceCheckCard } from "@/components/bongsim/DeviceCheckCard";
import { DeviceCompatibilityModal } from "@/components/bongsim/DeviceCompatibilityModal";

export function BongsimHomeHub() {
  const [deviceOpen, setDeviceOpen] = useState(false);
  const openDevice = () => setDeviceOpen(true);

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-5 sm:px-6 sm:pt-6 lg:px-12 lg:pb-28 lg:pt-10 xl:max-w-7xl xl:px-16">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 lg:max-w-3xl lg:gap-10 xl:max-w-4xl xl:gap-12">
          <section aria-label="이용 가능 기기">
            <DeviceCheckCard variant="home" onClick={openDevice} />
          </section>

          <BongsimHomeHero />

          <BongsimTrustSection />

          <BongsimHomeSupportSection />

          <section className="rounded-2xl border border-dashed border-slate-300/90 bg-white/80 px-4 py-5 text-center shadow-sm sm:px-6 lg:px-8" aria-label="추천 흐름으로 이동">
            <p className="text-[13px] font-semibold text-slate-800 sm:text-[14px]">여행 준비가 되셨다면</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">국가 선택부터 요금 비교까지 이어지는 화면으로 이동해요.</p>
            <Link
              href={bongsimPath("/recommend")}
              className="mt-4 inline-flex min-h-11 w-full max-w-xs items-center justify-center rounded-2xl bg-teal-700 text-[14px] font-bold text-white shadow-md transition hover:bg-teal-800 sm:max-w-sm"
            >
              나에게 맞는 eSIM 찾기
            </Link>
          </section>
          <SimplyurTeaserBanner variant="inline" />
        </div>
      </main>

      <DeviceCompatibilityModal open={deviceOpen} onClose={() => setDeviceOpen(false)} />
    </>
  );
}
