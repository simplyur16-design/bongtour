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
  /** 모바일 3열용 짧은 제목 (선택, 폰트 크기 동일) */
  titleMobile?: string;
  body: string;
  /** 모바일 카드 부제 (없으면 제목만) */
  bodyMobile?: string;
  hint?: string;
  circleClass: string;
  href?: string;
  linkLabel?: string;
  external?: boolean;
  requiresLogin?: boolean;
};

const WHY_ITEMS: readonly WhyItem[] = [
  {
    id: "one-click",
    icon: Zap,
    title: "원클릭 설치",
    body: "QR 코드와 설치 문자 한 번 클릭이면 끝",
    hint: "iOS 17.4+ · Android 13+",
    circleClass: "bg-pink-100 text-pink-600",
  },
  {
    id: "quality",
    icon: ShieldCheck,
    title: "품질보장서비스",
    titleMobile: "품질보장",
    body: "제품 결함 시 전액 환불",
    circleClass: "bg-emerald-100 text-emerald-600",
  },
  {
    id: "usage",
    icon: BarChart3,
    title: "데이터 사용량 실시간 확인",
    titleMobile: "사용량 확인",
    body: "마이페이지에서 남은 데이터를 언제든 확인",
    href: "/mypage/esim",
    linkLabel: "사용량 확인하기 →",
    requiresLogin: true,
    circleClass: "bg-sky-100 text-sky-600",
  },
  {
    id: "google-maps",
    icon: Map,
    title: "구글맵 데이터 무료",
    titleMobile: "구글맵 무료",
    body: "해외에서 구글지도 길찾기를 데이터 차감 없이",
    href: bongsimPath("/benefits/google-maps"),
    linkLabel: "자세히 보기 →",
    circleClass: "bg-teal-100 text-teal-600",
  },
  {
    id: "chatgpt",
    icon: Sparkles,
    title: "ChatGPT 데이터 무료",
    titleMobile: "ChatGPT 무료",
    body: "여행 중 번역·검색을 데이터 부담 없이",
    href: bongsimPath("/benefits/chatgpt"),
    linkLabel: "자세히 보기 →",
    circleClass: "bg-violet-100 text-violet-600",
  },
  {
    id: "support",
    icon: MessageCircle,
    title: "안심 고객센터",
    body: "Bong투어 카카오톡으로 문의하세요 (09:00-18:00 KST)",
    titleMobile: "고객센터",
    href: BONGSIM_KAKAO_CHANNEL_URL.trim() || undefined,
    linkLabel: "카카오톡 문의하기",
    external: true,
    circleClass: "bg-amber-100 text-amber-600",
  },
];

type WhyCardDesktopProps = { item: WhyItem };

/** PC·태블릿(md+): 등록 전과 동일한 카드·그리드 */
function WhyCardDesktop({ item }: WhyCardDesktopProps) {
  const { icon: Icon, title, body, hint, circleClass, href, linkLabel, external } = item;
  const cardClass =
    "flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:border-teal-200 hover:shadow-md";

  const inner = (
    <>
      <div
        className={`flex shrink-0 items-center justify-center rounded-full p-3 ${circleClass}`}
        aria-hidden
      >
        <Icon className="h-6 w-6" strokeWidth={2} />
      </div>
      <div className="w-full min-w-0">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{body}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
        {href && linkLabel ? (
          <span className="mt-2 inline-block text-sm font-medium text-teal-600 underline-offset-4 group-hover:underline">
            {linkLabel}
          </span>
        ) : null}
      </div>
    </>
  );

  if (!href) {
    return <div className={cardClass}>{inner}</div>;
  }

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`group ${cardClass}`}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={`group ${cardClass}`}>
      {inner}
    </Link>
  );
}

type WhyCardMobileProps = {
  item: WhyItem;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
};

/** 모바일만: 3열×2행, 아이콘·제목 중앙·동일 높이 */
function WhyCardMobile({ item, isLoggedIn, onLoginRequired }: WhyCardMobileProps) {
  const { icon: Icon, title, titleMobile, body, bodyMobile, circleClass, href, external, requiresLogin } = item;
  const displayTitle = titleMobile ?? title;
  const tappable = Boolean(href);
  const ariaLabel = bodyMobile ? `${displayTitle}. ${bodyMobile}` : `${displayTitle}. ${body}`;

  const cardClass = [
    "relative flex h-[5.75rem] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-center shadow-sm transition",
    tappable
      ? "cursor-pointer hover:border-teal-300 hover:shadow-md active:bg-slate-50/80"
      : "cursor-default",
  ].join(" ");

  const inner = (
    <div className="flex w-full flex-col items-center justify-center gap-2">
      {tappable ? (
        <ChevronRight className="absolute right-2 top-2 h-4 w-4 text-teal-600" aria-hidden />
      ) : null}
      <div
        className={`flex shrink-0 items-center justify-center rounded-full p-2.5 ${circleClass}`}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <h3 className="w-full px-0.5 text-sm font-semibold leading-tight text-slate-900">{displayTitle}</h3>
      {bodyMobile ? (
        <p className="w-full px-0.5 text-xs leading-snug text-slate-600">{bodyMobile}</p>
      ) : null}
    </div>
  );

  if (!tappable) {
    return <div className={cardClass}>{inner}</div>;
  }

  if (requiresLogin && !isLoggedIn) {
    return (
      <button
        type="button"
        className={`w-full ${cardClass}`}
        aria-label={ariaLabel}
        onClick={onLoginRequired}
      >
        {inner}
      </button>
    );
  }

  if (external && href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cardClass} aria-label={ariaLabel}>
        {inner}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cardClass} aria-label={ariaLabel}>
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

        {/* 모바일: 3열 × 2행 */}
        <div className="mx-auto mt-6 grid max-w-lg auto-rows-[5.75rem] grid-cols-3 gap-2.5 sm:gap-3 md:hidden">
          {WHY_ITEMS.map((item) => (
            <WhyCardMobile
              key={item.id}
              item={item}
              isLoggedIn={isLoggedIn}
              onLoginRequired={openLoginModal}
            />
          ))}
        </div>

        {/* PC·태블릿: 기존 3열 카드 */}
        <div className="mx-auto mt-8 hidden grid-cols-1 gap-4 sm:mt-10 md:grid md:grid-cols-3 lg:mt-12">
          {WHY_ITEMS.map((item) => (
            <WhyCardDesktop key={item.id} item={item} />
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
