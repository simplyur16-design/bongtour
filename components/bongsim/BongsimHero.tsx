import Link from "next/link";
import { bongsimPath } from "@/lib/bongsim/constants";

/** STEP 0 — PC 홈 전용 히어로 (국가·비교 UI는 /recommend) */
export function BongsimHomeHero() {
  return (
    <section aria-labelledby="home-hero-title" className="w-full">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-teal-900 to-sky-800 px-5 py-8 shadow-xl shadow-slate-900/20 ring-1 ring-white/10 sm:px-8 sm:py-10 lg:grid lg:min-h-[280px] lg:grid-cols-[1fr_min(14rem,34%)] lg:items-center lg:gap-8 lg:px-10 lg:py-10 xl:min-h-[300px]">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl lg:right-0 lg:top-1/2 lg:h-72 lg:w-72 lg:-translate-y-1/2 lg:translate-x-1/4"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-teal-400/15 blur-2xl"
          aria-hidden
        />

        <div className="relative z-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-200/90">Bong투어 eSIM</p>
          <h1
            id="home-hero-title"
            className="mt-3 max-w-xl text-[1.4rem] font-bold leading-snug tracking-tight text-white sm:text-2xl lg:max-w-2xl lg:text-[1.75rem] lg:leading-tight xl:text-[1.85rem]"
          >
            낯선 여행지에서도 당황하지 않도록
          </h1>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/85 sm:text-[14px] lg:mt-4">
            Bong투어가 고심해서 고른 안정적인 데이터. 구매 즉시 이메일로 QR을 보내드려요. 개통 전엔 기기 호환만 꼭 확인해 주세요.
          </p>
          <Link
            href={bongsimPath("/recommend")}
            className="mt-7 flex min-h-[3.35rem] w-full max-w-md items-center justify-center rounded-2xl bg-white text-[15px] font-bold text-teal-900 shadow-lg transition hover:bg-slate-50 sm:mt-8 lg:mt-9 lg:w-auto lg:min-w-[15rem] lg:px-10"
          >
            나에게 맞는 eSIM 찾기
          </Link>
        </div>

        <div className="relative z-10 mt-8 hidden lg:mt-0 lg:flex lg:justify-end" aria-hidden>
          <div className="flex aspect-square w-full max-w-[11.5rem] flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm xl:max-w-[12.5rem]">
            <span className="text-4xl font-black tracking-tight text-white/95">eSIM</span>
            <span className="mt-2 text-center text-[11px] font-medium leading-snug text-teal-100/90">여행 데이터</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 모바일 홈 등에서 사용하는 컴팩트 히어로 카드 */
export function BongsimHeroCard() {
  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-teal-600 to-slate-900 px-5 py-6 shadow-lg ring-1 ring-white/10">
      <p className="text-xs font-medium text-white/80">Bong투어 eSIM</p>
      <p className="mt-2 text-lg font-bold leading-snug text-white">낯선 여행지에서도 당황하지 않도록</p>
      <p className="mt-1 text-sm leading-relaxed text-white/85">Bong투어가 고심해서 고른 안정적인 데이터.</p>
    </div>
  );
}

export function BongsimHero() {
  return (
    <section className="px-4 pb-8 pt-6 sm:px-6">
      <div className="mx-auto max-w-md sm:max-w-lg">
        <BongsimHeroCard />
      </div>
    </section>
  );
}
