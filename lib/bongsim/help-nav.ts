import { bongsimPath } from "@/lib/bongsim/constants";

/** Help/support destinations — single source for menu cards and cross-links. */

export type HelpNavItem = {
  href: string;
  title: string;
  sub: string;
  shortLabel: string;
};

/** 내부 서브패스 — 손님 링크는 반드시 `bongsimPath()` */
export const HELP_MENU_SUBPATHS = [
  "/help/setup-guide",
  "/help/service-help",
  "/help/device-compatibility",
  "/help/customer-support",
] as const;

// REGRESSION-FREEZE[bongsim-help-nav-esim-prefix]: href is /travel/esim/help/* — manifest
export const HELP_MENU_ITEMS: readonly HelpNavItem[] = [
  {
    href: bongsimPath("/help/setup-guide"),
    title: "설정 방법 / 가이드",
    sub: "eSIM 설치·개통 순서를 단계별로 확인해요.",
    shortLabel: "설정 가이드",
  },
  {
    href: bongsimPath("/help/service-help"),
    title: "서비스 도움말 / 문의",
    sub: "이용 중 궁금한 점을 정리해 두었어요.",
    shortLabel: "서비스 도움말",
  },
  {
    href: bongsimPath("/help/device-compatibility"),
    title: "이용 가능 기기 다시 확인",
    sub: "EID·기종 호환을 한 번 더 살펴보세요.",
    shortLabel: "기기 호환",
  },
  {
    href: bongsimPath("/help/customer-support"),
    title: "고객지원 / 운영 안내",
    sub: "상담 가능 시간과 처리 기준을 안내해요.",
    shortLabel: "고객지원",
  },
] as const;
