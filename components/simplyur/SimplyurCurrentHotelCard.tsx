"use client";

import {
  destLangMessageKey,
  hotelAddressForDest,
  hotelAddressForUser,
  hotelNameForDest,
  hotelNameForUser,
} from "@/lib/simplyur/trip-inbox/bilingual-hotel";
import type { TripHotelSegmentPayload, TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";

type Props = {
  segment: TripParsedSegment;
  mode: "current" | "upcoming";
  tr: (path: string) => string;
  onFix?: () => void;
};

function fmtWhen(iso: string | null | undefined): string {
  return iso?.replace("T", " ").slice(0, 16) || "—";
}

/**
 * Current / upcoming hotel card — user language + destination language.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: bilingual current hotel card — manifest
 */
export function SimplyurCurrentHotelCard({ segment, mode, tr, onFix }: Props) {
  if (segment.payload.type !== "hotel") return null;
  const p = segment.payload as TripHotelSegmentPayload;
  const nameUser = hotelNameForUser(p);
  const nameDest = hotelNameForDest(p);
  const addrUser = hotelAddressForUser(p);
  const addrDest = hotelAddressForDest(p);
  const destLabel = tr(destLangMessageKey(p.dest_lang));

  return (
    <section
      className="mb-8 overflow-hidden rounded-2xl border border-[color:var(--su-brand-border)] bg-gradient-to-br from-[color:var(--su-brand-bg-soft)] to-white shadow-sm"
      aria-label={mode === "current" ? tr("myTrip.currentStay") : tr("myTrip.upcomingStay")}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--su-brand-border)] px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--su-brand-ur)]">
          {mode === "current" ? tr("myTrip.currentStay") : tr("myTrip.upcomingStay")}
        </span>
        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-medium text-[color:var(--su-ink-muted)]">
          {destLabel}
        </span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--su-ink-muted)]">
            {tr("myTrip.yourLanguage")}
          </p>
          <p className="mt-0.5 text-lg font-semibold text-[color:var(--su-ink)]">
            {nameUser || tr("myTrip.nameMissing")}
          </p>
          {addrUser ? (
            <p className="mt-1 text-sm text-[color:var(--su-ink-muted)]">{addrUser}</p>
          ) : null}
        </div>

        <div className="rounded-xl bg-white/70 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--su-ink-muted)]">
            {tr("myTrip.localLanguage").replace("{lang}", destLabel)}
          </p>
          <p className="mt-0.5 text-base font-semibold text-[color:var(--su-ink)]">
            {nameDest || tr("myTrip.localNameMissing")}
          </p>
          {addrDest ? (
            <p className="mt-1 text-sm text-[color:var(--su-ink-muted)]">{addrDest}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[color:var(--su-ink-muted)]">
          <span>
            {tr("myTrip.checkIn")}: {fmtWhen(p.check_in_at)}
          </span>
          <span>
            {tr("myTrip.checkOut")}: {fmtWhen(p.check_out_at)}
          </span>
        </div>

        {(!nameUser || !nameDest) && onFix ? (
          <button
            type="button"
            className="text-sm font-medium text-[color:var(--su-brand-ur)] underline"
            onClick={onFix}
          >
            {tr("myTrip.addBilingualNames")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
