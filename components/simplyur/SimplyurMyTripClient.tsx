"use client";

/**
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: SimplyurMyTripClient — manifest
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: upload + learn from correction — manifest
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { SimplyurCurrentHotelCard } from "@/components/simplyur/SimplyurCurrentHotelCard";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import {
  loadTripInboxSegments,
  mergeTripInboxSegments,
  saveTripInboxSegments,
} from "@/lib/simplyur/trip-inbox/client-store";
import {
  loadTripFormParsers,
  rememberTripSource,
  recallTripSource,
  saveTripFormParser,
} from "@/lib/simplyur/trip-inbox/learn-client-store";
import { enrichHotelBilingual } from "@/lib/simplyur/trip-inbox/bilingual-hotel";
import { pickCurrentHotelStay, pickUpcomingHotelStay } from "@/lib/simplyur/trip-inbox/current-stay";
import type {
  TripExperienceSegmentPayload,
  TripHotelSegmentPayload,
  TripParsedSegment,
  TripParseResult,
  TripParseStatus,
} from "@/lib/simplyur/trip-inbox/types";

function hydrateSegments(segs: TripParsedSegment[]): TripParsedSegment[] {
  return segs.map((s) => {
    if (s.payload.type !== "hotel") return s;
    return { ...s, payload: enrichHotelBilingual(s.payload as TripHotelSegmentPayload) };
  });
}
function statusLabel(tr: (k: string) => string, status: TripParseStatus): string {
  if (status === "confirmed") return tr("myTrip.statusConfirmed");
  if (status === "needs_review") return tr("myTrip.statusNeedsReview");
  return tr("myTrip.statusFailed");
}

function segmentTitle(seg: TripParsedSegment): string {
  if (seg.payload.type === "flight") {
    const p = seg.payload;
    const route = [p.dep_airport || p.dep_city, p.arr_airport || p.arr_city]
      .filter(Boolean)
      .join(" → ");
    return [p.flight_no, route].filter(Boolean).join(" · ") || "Flight";
  }
  if (seg.payload.type === "hotel") {
    const p = seg.payload;
    return p.property_name_user || p.property_name_dest || p.property_name || "Hotel";
  }
  if (seg.payload.type === "experience") {
    return seg.payload.title || seg.payload.venue || "Experience";
  }
  return seg.payload.vehicle_class || seg.payload.pickup_location || "Car";
}

function segmentWhen(seg: TripParsedSegment): string {
  return seg.sort_at?.replace("T", " ").slice(0, 16) || "—";
}

export function SimplyurMyTripClient() {
  const tr = useSimplyurT();
  const [segments, setSegments] = useState<TripParsedSegment[]>([]);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TripParsedSegment | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setSegments(hydrateSegments(loadTripInboxSegments()));
  }, []);

  const persist = useCallback((next: TripParsedSegment[]) => {
    setSegments(next);
    saveTripInboxSegments(next);
  }, []);

  const stayHotel = useMemo(() => {
    const current = pickCurrentHotelStay(segments);
    if (current) return { seg: current, mode: "current" as const };
    const upcoming = pickUpcomingHotelStay(segments);
    if (upcoming) return { seg: upcoming, mode: "upcoming" as const };
    return null;
  }, [segments]);

  const ingest = useCallback(
    async (text: string, pdfBase64?: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/simplyur/trips/parse", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            pdfBase64: pdfBase64 || undefined,
            formParsers: loadTripFormParsers(),
          }),
        });
        const j = (await res.json()) as TripParseResult & { error?: string };
        if (res.status === 401) {
          setError(tr("myTrip.signInRequired"));
          return;
        }
        if (!res.ok) throw new Error(j.error ?? "parse_failed");
        const merged = mergeTripInboxSegments(loadTripInboxSegments(), j.segments ?? []);
        persist(merged);
        const source = (j.source_text || text).trim();
        for (const s of j.segments ?? []) {
          if (source) rememberTripSource(s.temp_id, source);
        }
        saveTripFormParser(j.form_parser);
        setPaste("");
      } catch {
        setError(tr("myTrip.parseError"));
      } finally {
        setBusy(false);
      }
    },
    [persist, tr],
  );

  const onParse = useCallback(async () => {
    await ingest(paste);
  }, [ingest, paste]);

  const onUploadFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > 6_000_000) {
          setError(tr("myTrip.parseError"));
          return;
        }
        const buf = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!);
        await ingest("", btoa(binary));
        return;
      }
      await ingest(await file.text());
    },
    [ingest],
  );

  const openEdit = useCallback((seg: TripParsedSegment) => {
    setEditing(seg);
    const p = seg.payload;
    if (p.type === "flight") {
      setDraft({
        flight_no: p.flight_no ?? "",
        airline: p.airline ?? "",
        dep_airport: p.dep_airport ?? "",
        arr_airport: p.arr_airport ?? "",
        dep_at: p.dep_at ?? "",
        arr_at: p.arr_at ?? "",
        pnr: p.pnr ?? "",
      });
    } else if (p.type === "hotel") {
      const h = p as TripHotelSegmentPayload;
      setDraft({
        property_name: h.property_name ?? "",
        property_name_user: h.property_name_user ?? "",
        property_name_dest: h.property_name_dest ?? "",
        address_user: h.address_user ?? "",
        address_dest: h.address_dest ?? "",
        check_in_at: h.check_in_at ?? "",
        check_out_at: h.check_out_at ?? "",
        booking_ref: h.booking_ref ?? "",
        dest_lang: h.dest_lang ?? "ko",
      });
    } else if (p.type === "experience") {
      const e = p as TripExperienceSegmentPayload;
      setDraft({
        title: e.title ?? "",
        venue: e.venue ?? "",
        start_at: e.start_at ?? "",
        booking_ref: e.booking_ref ?? "",
      });
    } else {
      setDraft({
        pickup_location: p.pickup_location ?? "",
        pickup_at: p.pickup_at ?? "",
        vehicle_class: p.vehicle_class ?? "",
      });
    }
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const payloadPatch: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(draft)) {
        payloadPatch[k] = v.trim() || null;
      }
      const formParsers = loadTripFormParsers();
      const existingParser =
        formParsers.find(
          (p) => p.form_id === editing.form_id || p.fingerprint === editing.source_fingerprint,
        ) ?? null;
      const res = await fetch("/api/simplyur/trips/correct", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment: editing,
          patch: { payload: payloadPatch },
          source_text: recallTripSource(editing.temp_id) || undefined,
          form_parser: existingParser,
        }),
      });
      const j = (await res.json()) as {
        segment?: TripParsedSegment;
        form_parser?: TripParseResult["form_parser"];
        error?: string;
      };
      if (!res.ok || !j.segment) throw new Error(j.error ?? "correct_failed");
      saveTripFormParser(j.form_parser);
      const next = mergeTripInboxSegments(
        loadTripInboxSegments().filter((s) => s.temp_id !== editing.temp_id),
        [j.segment],
      );
      persist(next);
      setEditing(null);
    } catch {
      setError(tr("myTrip.correctError"));
    } finally {
      setBusy(false);
    }
  }, [draft, editing, persist, tr]);

  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  const reviewCount = useMemo(
    () => segments.filter((s) => s.status === "needs_review" || s.status === "failed").length,
    [segments],
  );

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6 sm:max-w-2xl sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--su-ink)]">
          {tr("myTrip.title")}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--su-ink-muted)]">{tr("myTrip.subtitle")}</p>
      </header>

      {stayHotel ? (
        <SimplyurCurrentHotelCard
          segment={stayHotel.seg}
          mode={stayHotel.mode}
          tr={tr}
          onFix={() => openEdit(stayHotel.seg)}
        />
      ) : null}

      <section className="mb-8 space-y-3">
        <label className="block text-sm font-medium text-[color:var(--su-ink)]" htmlFor="trip-paste">
          {tr("myTrip.pasteLabel")}
        </label>
        <textarea
          id="trip-paste"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={8}
          placeholder={tr("myTrip.pastePlaceholder")}
          className="w-full resize-y rounded-xl border border-[color:var(--su-brand-border)] bg-white px-3 py-2.5 text-sm text-[color:var(--su-ink)] outline-none focus:border-[color:var(--su-brand-ur)]"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !paste.trim()}
            onClick={() => void onParse()}
            className="su-btn-navy rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? tr("myTrip.parsing") : tr("myTrip.parseCta")}
          </button>
          <label className="cursor-pointer rounded-lg border border-[color:var(--su-brand-border)] px-4 py-2 text-sm text-[color:var(--su-ink)]">
            {tr("myTrip.uploadCta")}
            <input
              type="file"
              accept=".pdf,.txt,.eml,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                void onUploadFile(f);
              }}
            />
          </label>
          <button
            type="button"
            className="rounded-lg border border-[color:var(--su-brand-border)] px-4 py-2 text-sm text-[color:var(--su-ink-muted)]"
            onClick={() => {
              void fetch("/api/simplyur/trips/inbox/oauth").then(async (r) => {
                const j = (await r.json()) as { message?: string };
                setError(j.message ?? tr("myTrip.oauthSoon"));
              });
            }}
          >
            {tr("myTrip.connectEmail")}
          </button>
        </div>
        <p className="text-xs text-[color:var(--su-ink-muted)]">{tr("myTrip.uploadHint")}</p>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-[color:var(--su-ink)]">{tr("myTrip.timeline")}</h2>
          {segments.length > 0 ? (
            <button
              type="button"
              className="text-xs text-[color:var(--su-ink-muted)] underline"
              onClick={clearAll}
            >
              {tr("myTrip.clear")}
            </button>
          ) : null}
        </div>
        {reviewCount > 0 ? (
          <p className="mb-3 text-xs text-amber-800">
            {tr("myTrip.reviewHint").replace("{n}", String(reviewCount))}
          </p>
        ) : null}

        {segments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--su-brand-border)] px-4 py-8 text-center text-sm text-[color:var(--su-ink-muted)]">
            {tr("myTrip.empty")}
          </p>
        ) : (
          <ol className="space-y-3">
            {segments.map((seg) => (
              <li
                key={seg.temp_id}
                className="rounded-xl border border-[color:var(--su-brand-border)] bg-white px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--su-ink-muted)]">
                      {seg.type} · {seg.provider}
                    </p>
                    <p className="mt-0.5 truncate font-medium text-[color:var(--su-ink)]">
                      {segmentTitle(seg)}
                    </p>
                    <p className="mt-0.5 text-sm text-[color:var(--su-ink-muted)]">{segmentWhen(seg)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      seg.status === "confirmed"
                        ? "bg-emerald-50 text-emerald-800"
                        : seg.status === "needs_review"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-red-50 text-red-800"
                    }`}
                  >
                    {statusLabel(tr, seg.status)}
                  </span>
                </div>
                {seg.issues.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-900">{seg.issues.join(", ")}</p>
                ) : null}
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-[color:var(--su-brand-ur)] underline"
                  onClick={() => openEdit(seg)}
                >
                  {tr("myTrip.fix")}
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {editing ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={tr("myTrip.fixTitle")}
        >
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[color:var(--su-ink)]">{tr("myTrip.fixTitle")}</h3>
            <p className="mt-1 text-xs text-[color:var(--su-ink-muted)]">{segmentTitle(editing)}</p>
            <div className="mt-4 space-y-3">
              {Object.keys(draft).map((key) => (
                <label key={key} className="block text-sm">
                  <span className="mb-1 block text-[color:var(--su-ink-muted)]">{key}</span>
                  <input
                    value={draft[key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-[color:var(--su-brand-border)] px-3 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm text-[color:var(--su-ink-muted)]"
                onClick={() => setEditing(null)}
              >
                {tr("myTrip.cancel")}
              </button>
              <button
                type="button"
                disabled={busy}
                className="su-btn-navy rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                onClick={() => void saveEdit()}
              >
                {tr("myTrip.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
