"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { simplyurPath, type SimplyurLocale } from "@/lib/simplyur/constants";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = { locale: SimplyurLocale };

const TABS = [
  { key: "home", path: "", match: (p: string) => p === "" },
  { key: "store", path: "/recommend", match: (p: string) => p.startsWith("recommend") || p.startsWith("product") },
  { key: "guide", path: "/guide", match: (p: string) => p.startsWith("guide") },
  { key: "myEsim", path: "/my-esim", match: (p: string) => p.startsWith("my-esim") },
] as const;

export function SimplyurTabBar({ locale }: Props) {
  const tr = useSimplyurT();
  const pathname = usePathname() ?? "";
  const base = `/simplyur/${locale}`;
  const path = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, "") : "";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[color:var(--su-brand-border)] bg-white/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main"
    >
      <div className="mx-auto flex h-[var(--su-tab-h)] max-w-lg items-stretch justify-around px-1">
        {TABS.map(({ key, path: href, match }) => {
          const active = match(path);
          return (
            <Link
              key={key}
              href={simplyurPath(locale, href)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition ${
                active ? "text-[color:var(--su-brand-ur)]" : "text-[color:var(--su-ink-muted)]"
              }`}
            >
              <TabIcon tab={key} active={active} />
              <span className="truncate">{tr(`tabs.${key}`)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TabIcon({ tab, active }: { tab: (typeof TABS)[number]["key"]; active: boolean }) {
  const stroke = active ? 2.2 : 2;
  if (tab === "home") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={stroke}>
        <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tab === "store") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}>
        <rect x="3" y="6" width="18" height="14" rx="2" />
        <path d="M3 10h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    );
  }
  if (tab === "guide") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}>
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}
