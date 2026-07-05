"use client";

import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

const KEYS = ["instant", "support", "refund"] as const;

export function SimplyurWhySection() {
  const tr = useSimplyurT();

  return (
    <section className="mx-auto max-w-4xl px-4 lg:max-w-5xl">
      <h2 className="text-center text-2xl font-bold tracking-tight su-text-ink lg:text-3xl">
        {tr("why.title")}
      </h2>
      <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
        {KEYS.map((key) => (
          <article key={key} className="su-panel p-5 sm:p-6">
            <h3 className="text-base font-semibold su-text-ink">{tr(`why.items.${key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">
              {tr(`why.items.${key}.body`)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SimplyurReviewsSection() {
  const { messages } = useSimplyurIntl();
  const tr = useSimplyurT();
  const items = messages.reviews.items;

  return (
    <section className="mx-auto mt-14 max-w-4xl px-4 lg:mt-20 lg:max-w-5xl">
      <h2 className="text-center text-2xl font-bold tracking-tight su-text-ink lg:text-3xl">
        {tr("reviews.title")}
      </h2>
      <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.author} className="su-card p-5 shadow-sm">
            <p className="text-[color:var(--su-dan)]" aria-hidden>
              ★★★★★
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">{item.text}</p>
            <p className="mt-4 text-sm text-[color:var(--su-celadon)]">{item.author}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
