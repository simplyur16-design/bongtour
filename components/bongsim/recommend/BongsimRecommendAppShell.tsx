"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** 단일 국가 구매 — usimsa 앱형 500px 레이아웃 (모바일) */
  singleCountry?: boolean;
  className?: string;
};

/**
 * usimsa.com 모바일 레이아웃: max-width 500px, 회색 바깥·흰 콘텐츠.
 * lg 이상에서는 기존 넓은 레이아웃 유지.
 */
export function BongsimRecommendAppShell({ children, singleCountry, className }: Props) {
  if (!singleCountry) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`mx-auto w-full max-lg:min-h-[calc(100dvh-56px)] max-lg:max-w-[500px] max-lg:bg-[#f9f9f9] lg:max-w-5xl ${className ?? ""}`}
    >
      <div className="max-lg:mx-auto max-lg:min-h-full max-lg:bg-white max-lg:shadow-sm">{children}</div>
    </div>
  );
}
