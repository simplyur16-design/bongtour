import Link from "next/link";
import { HELP_MENU_ITEMS } from "@/lib/bongsim/help-nav";

export function HelpNavCrosslinks({ currentHref }: { currentHref: string }) {
  const others = HELP_MENU_ITEMS.filter((x) => x.href !== currentHref);
  return (
    <nav
      className="mt-8 rounded-2xl border border-slate-200/90 bg-slate-50/90 p-4 ring-1 ring-slate-100/80 sm:p-5"
      aria-label="다른 도움말로 이동"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">다른 도움말</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {others.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-11 items-center rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-[13px] font-bold text-teal-900 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/50"
            >
              <span className="min-w-0 break-words">{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
