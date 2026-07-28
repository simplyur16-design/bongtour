import type { ReactNode } from "react";
import Header from "@/app/components/Header";
import { EsimMypageUsimsaCsLinks } from "@/components/bongsim/EsimMypageUsimsaCsLinks";

type Props = {
  title: string;
  subtitle: string;
  intro: string;
  introHeading?: string;
  introBullets?: string[];
  countriesHeading: string;
  countriesText: string;
  countriesBullets?: string[];
  noticeHeading?: string;
  noticeItems: string[];
  noticeLink?: { href: string; label: string };
  children?: ReactNode;
  /** true면 주의사항 블록 위에 children 렌더 (품질보장 Q&A 등) */
  childrenBeforeNotice?: boolean;
};

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed marker:text-slate-400 lg:text-base">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function EsimBenefitPageShell({
  title,
  subtitle,
  intro,
  introHeading = "소개",
  introBullets,
  countriesHeading,
  countriesText,
  countriesBullets,
  noticeHeading = "주의사항",
  noticeItems,
  noticeLink,
  children,
  childrenBeforeNotice = false,
}: Props) {
  return (
    <div className="bt-esim-benefit-page min-h-screen bg-white">
      <Header />
      <section
        className="w-full bg-gradient-to-br from-sky-50 to-teal-50 px-4 py-12 lg:py-16"
        aria-labelledby="esim-benefit-hero"
      >
        <div className="mx-auto max-w-3xl text-center lg:max-w-4xl">
          <h1
            id="esim-benefit-hero"
            className="text-balance text-2xl font-bold leading-tight tracking-tight lg:text-4xl"
          >
            {title}
          </h1>
          <p className="bt-esim-benefit-subtitle mx-auto mt-4 max-w-2xl text-base leading-relaxed lg:mt-5 lg:text-lg">
            {subtitle}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:max-w-4xl lg:px-6 lg:pb-20 lg:pt-10">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
          <h2 className="text-lg font-bold lg:text-xl">{introHeading}</h2>
          <p className="mt-3 text-sm leading-relaxed lg:text-base">{intro}</p>
          <BulletList items={introBullets ?? []} />
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:mt-8 lg:p-6">
          <h2 className="text-lg font-bold lg:text-xl">{countriesHeading}</h2>
          {countriesText.trim() ? (
            <p className="mt-3 text-sm leading-relaxed lg:text-base">{countriesText}</p>
          ) : null}
          <BulletList items={countriesBullets ?? []} />
        </section>

        {childrenBeforeNotice ? children : null}

        {noticeItems.length > 0 ? (
          <div
            className="bt-esim-benefit-notice mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed lg:mt-8 lg:p-5 lg:text-base"
            role="note"
          >
            <h2 className="font-semibold">{noticeHeading}</h2>
            {noticeLink ? (
              <p className="mt-3">
                <a
                  href={noticeLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800"
                >
                  {noticeLink.label}
                </a>
              </p>
            ) : null}
            <ul className="mt-3 list-inside list-disc space-y-2 marker:text-amber-700">
              {noticeItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {!childrenBeforeNotice ? children : null}

        <section
          className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-5 py-6 text-center lg:mt-10 lg:px-8 lg:py-8"
          aria-labelledby="esim-benefit-cs-heading"
        >
          <h2 id="esim-benefit-cs-heading" className="text-base font-semibold lg:text-lg">
            문제가 있으신가요?
          </h2>
          <p className="bt-esim-benefit-muted mx-auto mt-2 max-w-md text-sm leading-relaxed lg:text-base">
            eSIM 설치·사용 문의는 고객센터에서 24시간 접수합니다.
          </p>
          <div className="mt-4 flex justify-center text-left">
            <EsimMypageUsimsaCsLinks />
          </div>
        </section>
      </main>
    </div>
  );
}
