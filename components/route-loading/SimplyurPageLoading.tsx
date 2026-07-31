import Image from "next/image";
import { SIMPLYUR_BRAND } from "@/lib/simplyur/brand";
import "@/app/simplyur/simplyur-theme.css";

/** Simplyur route Suspense — never show Bongtong HomePageLoading on /simplyur. */
export default function SimplyurPageLoading() {
  return (
    <div
      className="simplyur-theme su-app-shell min-h-screen"
      style={{ backgroundColor: SIMPLYUR_BRAND.bg, color: SIMPLYUR_BRAND.navy }}
      aria-busy
      aria-label="Loading"
    >
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-sm"
        style={{
          borderColor: SIMPLYUR_BRAND.border,
          backgroundColor: `${SIMPLYUR_BRAND.bgSoft}f2`,
        }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 sm:max-w-3xl sm:px-6 sm:py-4 lg:max-w-6xl">
          <Image
            src={SIMPLYUR_BRAND.wordmarkImage}
            alt="simplyur"
            width={148}
            height={44}
            priority
            className="h-9 w-auto"
          />
          <div className="flex items-center gap-2">
            <div
              className="hidden h-8 w-20 animate-pulse rounded-full sm:block"
              style={{ backgroundColor: SIMPLYUR_BRAND.border }}
              aria-hidden
            />
            <div
              className="h-9 w-24 animate-pulse rounded-full"
              style={{ backgroundColor: SIMPLYUR_BRAND.coral, opacity: 0.35 }}
              aria-hidden
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-6 sm:max-w-3xl sm:px-6 lg:max-w-6xl">
        <div
          className="h-10 w-48 max-w-full animate-pulse rounded-xl"
          style={{ backgroundColor: SIMPLYUR_BRAND.border }}
          aria-hidden
        />
        <div
          className="h-5 w-72 max-w-full animate-pulse rounded-md"
          style={{ backgroundColor: SIMPLYUR_BRAND.border, opacity: 0.7 }}
          aria-hidden
        />
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-36 w-full animate-pulse rounded-2xl border bg-white"
              style={{ borderColor: SIMPLYUR_BRAND.border }}
              aria-hidden
            />
          ))}
        </div>
      </main>
    </div>
  );
}
