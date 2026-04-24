import Link from "next/link";
import { bongsimPath } from '@/lib/bongsim/constants'
import type { ReactNode } from "react";
import { HelpNavCrosslinks } from "@/components/bongsim/HelpNavCrosslinks";
import { HELP_MENU_ITEMS } from "@/lib/bongsim/help-nav";

type Props = {
  title: string;
  intro: string;
  children?: ReactNode;
  /** Breadcrumb leaf + cross-links (must match one of HELP_MENU_ITEMS hrefs when set). */
  currentPath?: string;
};

export function HelpSupportDetailLayout({ title, intro, children, currentPath }: Props) {
  const crumb =
    currentPath != null ? HELP_MENU_ITEMS.find((x) => x.href === currentPath)?.shortLabel ?? "상세" : null;
  return (
    <div className="min-h-full overflow-x-hidden bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-2xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:max-w-3xl lg:px-8 lg:py-10">
        <nav className="text-[12px] font-medium text-slate-500 lg:text-[13px]">
          <Link href={bongsimPath()} className="hover:text-teal-800">
            홈
          </Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="text-slate-800">도움말</span>
          {crumb ? (
            <>
              <span className="mx-1.5 text-slate-300">/</span>
              <span className="break-words text-slate-800">{crumb}</span>
            </>
          ) : null}
        </nav>
        <Link
          href={bongsimPath()}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
        >
          ← 홈으로
        </Link>
        <h1 className="mt-6 break-words text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">{title}</h1>
        <p className="mt-3 break-words text-[14px] leading-relaxed text-slate-600 lg:text-[15px]">{intro}</p>
        <section className="mt-8 min-w-0 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 sm:p-6 lg:p-8">
          <div className="min-w-0 break-words">{children}</div>
        </section>
        {currentPath ? <HelpNavCrosslinks currentHref={currentPath} /> : null}
      </main>
    </div>
  );
}
