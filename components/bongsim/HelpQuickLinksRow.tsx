import Link from "next/link";
import { HELP_MENU_ITEMS } from "@/lib/bongsim/help-nav";

/** Compact row for purchase funnel pages — each item is a distinct /help/* route (not /recommend). */
export function HelpQuickLinksRow() {
  return (
    <nav
      className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-slate-200/80 pt-4 text-[12px] font-semibold leading-snug text-teal-800 sm:text-[13px]"
      aria-label="도움말 바로가기"
    >
      {HELP_MENU_ITEMS.map((item, i) => (
        <span key={item.href} className="inline-flex min-h-8 flex-wrap items-center gap-2">
          {i > 0 ? (
            <span className="select-none text-slate-300" aria-hidden>
              ·
            </span>
          ) : null}
          <Link href={item.href} className="break-words underline-offset-2 hover:underline">
            {item.shortLabel}
          </Link>
        </span>
      ))}
    </nav>
  );
}
