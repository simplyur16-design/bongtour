"use client";

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, ChevronRight, Map, MessageCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { EsimLoginRequiredModal } from "@/components/bongsim/esim/EsimLoginRequiredModal";
import { BONGSIM_KAKAO_CHANNEL_URL, bongsimPath } from "@/lib/bongsim/constants";

type WhyItem = {
  id: string;
  icon: LucideIcon;
  title: string;
  titleShort?: string;
  body: string;
  bodyShort: string;
  hint?: string;
  circleClass: string;
  href?: string;
  linkLabel?: string;
  external?: boolean;
  /** 로그인 필요 시 비로그인 탭 → 로그인 안내 모달 */
  requiresLogin?: boolean;
};

const WHY_ITEMS: readonly WhyItem[] = [
  {
    id: "one-click",
    icon: Zap,
    title: "원클릭 설치",
    body: "QR 코드와 설치 문자 한 번 클릭이면 끝",
    bodyShort: "QR·설치 링크 한 번에",
    hint: "iOS 17.4+ · Android 13+",
    circleClass: "bg-pink-100 text-pink-600",
  },
  {
    id: "quality",
    icon: ShieldCheck,
    title: "품질보장서비스",
    titleShort: "품질보장",
    body: "제품 결함 시 전액 환불",
    bodyShort: "결함 시 전액 환불",
    circleClass: "bg-emerald-100 text-emerald-600",
  },
  {
    id: "usage",
    icon: BarChart3,
    title: "데이터 사용량 실시간 확인",
    titleShort: "사용량 확인",
    body: "마이페이지에서 남은 데이터를 언제든 확인",
    bodyShort: "마이페이지에서 잔량 조회",
    href: "/mypage/esim",
    linkLabel: "사용량 확인하기 →",
    requiresLogin: true,
    circleClass: "bg-sky-100 text-sky-600",
  },
  {
    id: "google-maps",
    icon: Map,
    title: "구글맵 데이터 무료",
    titleShort: "구글맵 무료",
    body: "해외에서 구글지도 길찾기를 데이터 차감 없이",
    bodyShort: "길찾기 데이터 차감 없음",
    href: bongsimPath("/benefits/google-maps"),
    linkLabel: "자세히 보기 →",
    circleClass: "bg-teal-100 text-teal-600",
  },
  {
    id: "chatgpt",
    icon: Sparkles,
    title: "ChatGPT 데이터 무료",
    titleShort: "ChatGPT 무료",
    body: "여행 중 번역·검색을 데이터 부담 없이",
    bodyShort: "번역·검색 데이터 차감 없음",
    href: bongsimPath("/benefits/chatgpt"),
    linkLabel: "자세히 보기 →",
    circleClass: "bg-violet-100 text-violet-600",
  },
  {
    id: "support",
    icon: MessageCircle,
    title: "안심 고객센터",
    body: "Bong투어 카카오톡으로 문의하세요 (09:00-18:00 KST)",
    bodyShort: "카카오톡 09:00–18:00",
    href: BONGSIM_KAKAO_CHANNEL_URL.trim() || undefined,
    linkLabel: "카카오톡 문의하기",
    external: true,
    circleClass: "bg-amber-100 text-amber-600",
  },
];

const FEATURED = WHY_ITEMS[0];
const GRID_ROW1 = WHY_ITEMS.slice(1, 4);
const GRID_ROW2 = WHY_ITEMS.slice(4, 6);

type WhyCardProps = {
  item: WhyItem;
  variant?: "default" | "featured";
  onLoginRequired?: () => void;
  isLoggedIn: boolean;
};

function WhyCard({ item, variant = "default", onLoginRequired, isLoggedIn }: WhyCardProps) {
  const { icon: Icon, title, titleShort, body, bodyShort, hint, circleClass, href, linkLabel, external, requiresLogin } =
    item;
  const tappable = Boolean(href);
  const navigate = tappable && (!requiresLogin || isLoggedIn);

  const cardClass = [
    "relative flex flex-col items-center rounded-xl border bg-white text-center shadow-sm transition",
    variant === "featured"
      ? "col-span-3 gap-2 border-pink-100 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4 md:flex-col md:gap-3 md:p-5"
      : "gap-1.5 p-2.5 md:gap-3 md:p-5",
    tappable
      ? "cursor-pointer border-slate-200 hover:border-teal-300 hover:shadow-md active:bg-slate-50/80"
      : "cursor-default border-slate-200",
  ].join(" ");

  const inner = (
    <>
      {tappable ? (
        <ChevronRight
          className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-teal-600 md:right-2 md:top-2 md:h-4 md:w-4"
          aria-hidden
        />
      ) : null}
      <div
        className={`flex shrink-0 items-center justify-center rounded-full ${variant === "featured" ? "p-2.5 md:p-3" : "p-2 md:p-3"} ${circleClass}`}
        aria-hidden
      >
        <Icon className={variant === "featured" ? "h-5 w-5 md:h-6 md:w-6" : "h-4 w-4 md:h-6 md:w-6"} strokeWidth={2} />
      </div>
      <div className="w-full min-w-0 px-0.5">
        <h3 className="text-[11px] font-semibold leading-tight text-slate-900 md:text-base">
          <span className="md:hidden">{titleShort ?? title}</span>
          <span className="hidden md:inline">{title}</span>
        </h3>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-600 md:mt-1 md:text-sm md:leading-relaxed md:text-slate-700">
          <span className="md:hidden">{bodyShort}</span>
          <span className="hidden md:inline">{body}</span>
        </p>
        {hint ? (
          <p className="mt-0.5 text-[9px] text-gray-500 md:mt-1 md:text-xs">{hint}</p>
        ) : null}
        {href && linkLabel ? (
          <span className="mt-1.5 hidden text-sm font-medium text-teal-600 underline-offset-4 md:group-hover:underline lg:inline-block">
            {linkLabel}
          </span>
        ) : null}
      </div>
    </>
  );

  if (!tappable) {
    return <div className={cardClass}>{inner}</div>;
  }

  if (requiresLogin && !isLoggedIn) {
    return (
      <button
        type="button"
        className={`group w-full text-left ${cardClass}`}
        onClick={() => onLoginRequired?.()}
      >
        {inner}
      </button>
    );
  }

  if (external && href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`group ${cardClass}`}>
        {inner}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={`group ${cardClass}`}>
        {inner}
      </Link>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}

export function EsimLandingWhySection() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const openLoginModal = () => setLoginModalOpen(true);

  return (
    <>
      <section className="text-center" aria-labelledby="esim-why-heading">
        <h2 id="esim-why-heading" className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
          왜 Bong투어 <span className="text-orange-600">eSIM</span>일까요?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600 lg:mt-4 lg:text-lg">
          여행 준비부터 현지 체류까지, 데이터 걱정을 덜어 드립니다.
        </p>

        <div className="mx-auto mt-6 max-w-lg md:hidden">
          <div className="grid grid-cols-3 gap-2">
            <WhyCard
              item={FEATURED}
              variant="featured"
              isLoggedIn={isLoggedIn}
              onLoginRequired={openLoginModal}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {GRID_ROW1.map((item) => (
              <WhyCard
                key={item.id}
                item={item}
                isLoggedIn={isLoggedIn}
                onLoginRequired={openLoginModal}
              />
            ))}
          </div>
          <div className="mx-auto mt-2 grid max-w-[14rem] grid-cols-2 gap-2">
            {GRID_ROW2.map((item) => (
              <WhyCard
                key={item.id}
                item={item}
                isLoggedIn={isLoggedIn}
                onLoginRequired={openLoginModal}
              />
            ))}
          </div>
        </div>

        <div className="mx-auto mt-8 hidden gap-4 md:grid md:grid-cols-3 md:gap-4 lg:mt-12">
          {WHY_ITEMS.map((item) => (
            <WhyCard
              key={item.id}
              item={item}
              isLoggedIn={isLoggedIn}
              onLoginRequired={openLoginModal}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link
            href={bongsimPath("/devices")}
            className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-400"
          >
            사용가능 기기 확인하기 →
          </Link>
          <Link
            href={bongsimPath("/guide")}
            className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-400"
          >
            eSIM 설치 가이드 보기 →
          </Link>
        </div>
      </section>

      <EsimLoginRequiredModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </>
  );
}
