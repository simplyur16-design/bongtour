import type { ReactNode } from "react";
import Link from "next/link";
import { PenLine, Smartphone, UserRound } from "lucide-react";
import Header from "@/app/components/Header";

const nav = [
  { href: "/mypage", label: "마이페이지", icon: UserRound },
  { href: "/mypage/esim", label: "내 eSIM", icon: Smartphone },
  { href: "/mypage/reviews/write", label: "후기 작성", icon: PenLine },
] as const;

export default function MyPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-teal-50/50">
      <Header />
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-28 pt-6 md:flex-row md:pb-12 md:pt-8">
        <aside className="hidden shrink-0 md:block md:w-52">
          <nav
            className="sticky top-24 space-y-1 rounded-2xl border border-teal-100/90 bg-white/90 p-3 shadow-sm backdrop-blur-sm"
            aria-label="마이페이지 메뉴"
          >
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-teal-800/70">메뉴</p>
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-900"
              >
                <Icon className="h-5 w-5 shrink-0 text-teal-600" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-teal-100/90 bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_20px_rgba(15,118,110,0.08)] backdrop-blur-md md:hidden"
        aria-label="마이페이지 하단 메뉴"
      >
        <div className="mx-auto flex max-w-lg justify-around px-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium text-slate-600 transition active:bg-teal-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-teal-100 text-teal-700 shadow-sm">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
