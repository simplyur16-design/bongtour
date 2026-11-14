"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ESIM_GUIDE_SITE_DATA,
  asBlocks,
  asSteps,
  esimGuideDiagram,
  esimGuideLocale,
  esimGuideScreen,
  type EsimGuideBlock,
  type EsimGuideDetail,
  type EsimGuideStep,
} from "@/lib/bongsim/esim-guide-site/load";
import { ESIM_INSTALL_GUIDE_PATH, ESIM_TRAVELER_AUTH_PATH } from "@/lib/bongsim/esim-install-guide";

const PAGE_HREF = {
  guide: ESIM_INSTALL_GUIDE_PATH,
  auth: ESIM_TRAVELER_AUTH_PATH,
} as const;

function RichText({
  text,
  links,
}: {
  text: string;
  links?: ReadonlyArray<{ label: string; url?: string; page?: "guide" | "auth" }>;
}) {
  const nodes: Array<string | { key: string; label: string; href: string; external: boolean }> = [text];
  for (const link of links ?? []) {
    const next: typeof nodes = [];
    nodes.forEach((part, partIndex) => {
      if (typeof part !== "string") {
        next.push(part);
        return;
      }
      const index = part.indexOf(link.label);
      if (index < 0) {
        next.push(part);
        return;
      }
      if (index > 0) next.push(part.slice(0, index));
      next.push({
        key: `${partIndex}-${link.label}`,
        label: link.label,
        href: link.url ?? PAGE_HREF[link.page ?? "guide"],
        external: Boolean(link.url),
      });
      const rest = part.slice(index + link.label.length);
      if (rest) next.push(rest);
    });
    nodes.splice(0, nodes.length, ...next);
  }
  return (
    <>
      {nodes.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <a
            key={part.key}
            href={part.href}
            className="font-semibold text-[#1A7DB4] underline-offset-2 hover:underline"
            {...(part.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {part.label}
          </a>
        ),
      )}
    </>
  );
}

function GuideImage({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes="(max-width: 760px) 86vw, 240px"
      className={className}
      style={{ width: "100%", height: "auto" }}
      loading="lazy"
      unoptimized={src.endsWith(".svg")}
    />
  );
}

function Flow({
  flow,
  locale,
}: {
  flow: { imageKey: string; imageAlt: string; items: Array<{ title: string; lines: string[] }> };
  locale: string;
}) {
  return (
    <div>
      <ol className="mb-4 hidden grid-cols-2 gap-2 rounded-2xl bg-[#f6f8fa] p-3 max-[760px]:grid">
        {flow.items.map((item) => (
          <li key={item.title} className="flex flex-col rounded-[10px] border-[1.5px] border-[#1A7DB4] bg-[#EEF4F9] px-2.5 py-2">
            <b className="text-sm">{item.title}</b>
            <span className="text-[12.5px] text-[#5B6470]">{item.lines.join(" · ")}</span>
          </li>
        ))}
      </ol>
      <figure className="mb-4 rounded-2xl bg-[#f6f8fa] p-4 max-[760px]:hidden">
        <GuideImage
          src={esimGuideDiagram(flow.imageKey, locale)}
          alt={flow.imageAlt}
          width={700}
          height={98}
          className="mx-auto h-auto w-[700px] max-w-full"
        />
      </figure>
    </div>
  );
}

function LineRoles({ locale }: { locale: string }) {
  const roles = esimGuideLocale(locale).content.guide.lineRoles;
  return (
    <div className="my-2">
      <div className="hidden gap-2 max-[760px]:grid">
        {roles.lines.map((line) => (
          <div
            key={line.title}
            className={`flex flex-col rounded-xl px-3 py-2.5 text-[13.5px] ${
              line.role === "esim" ? "border-[1.5px] border-[#1A7DB4] bg-[#EEF4F9]" : "border-[1.5px] border-[#9AA3AE] bg-[#F4F5F7]"
            }`}
          >
            <b className="mb-0.5 text-[15px]">{line.title}</b>
            {line.lines.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ))}
        <p className="m-0 text-[12.5px] text-[#5B6470]">{roles.footnote}</p>
      </div>
      <figure className="max-w-[560px] max-[760px]:hidden">
        <GuideImage
          src={esimGuideDiagram(roles.imageKey, locale)}
          alt={roles.imageAlt}
          width={700}
          height={130}
          className="h-auto w-full max-w-[560px]"
        />
      </figure>
    </div>
  );
}

function BlockView({ block }: { block: EsimGuideBlock }) {
  if (block.type === "text" || block.type === "note") {
    return (
      <p className={block.type === "note" ? "rounded-lg border-l-[3px] border-[#e5b33a] bg-[#fff8e6] px-3.5 py-2.5 text-sm text-[#4a3d1a]" : "text-[15px]"}>
        <RichText text={block.text} links={block.links} />
      </p>
    );
  }
  if (block.type === "heading") return <h4 className="mb-1.5 mt-4 text-[15px] font-semibold text-[#12628f]">{block.text}</h4>;
  if (block.type === "list") {
    return (
      <ul className="my-1.5 list-disc pl-5 text-[15px]">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "table") {
    return (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm max-[760px]:block">
          <thead className="max-[760px]:hidden">
            <tr>
              {block.columns.map((column) => (
                <th key={column} className="border-b border-[#cfe2ef] bg-[#EEF4F9] px-2.5 py-2 text-left font-semibold text-[#12628f]">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-[760px]:block">
            {block.rows.map((row) => (
              <tr key={row.join("|")} className="max-[760px]:mb-2 max-[760px]:block max-[760px]:rounded-xl max-[760px]:border max-[760px]:border-[#e3e8ee] max-[760px]:px-3 max-[760px]:py-1.5">
                {row.map((cell, index) => (
                  <td
                    key={`${block.columns[index]}-${cell}`}
                    data-label={block.columns[index]}
                    className="border-b border-[#e3e8ee] px-2.5 py-2 align-top max-[760px]:block max-[760px]:border-0 max-[760px]:px-0 max-[760px]:py-1 max-[760px]:before:block max-[760px]:before:text-xs max-[760px]:before:font-semibold max-[760px]:before:text-[#12628f] max-[760px]:before:content-[attr(data-label)] first:font-semibold max-[760px]:first:text-[15px] max-[760px]:first:before:hidden"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "lineRoles") return <LineRoles locale="ko" />;
  if (block.type === "stepRef") {
    return (
      <p className="text-[15px]">
        <b className="mr-1 inline-block rounded-md bg-[#EEF4F9] px-2 py-px text-xs text-[#12628f]">{block.label}</b>
        {block.text}
      </p>
    );
  }
  return null;
}

function DetailList({ step, locale }: { step: EsimGuideStep; locale: string }) {
  const label = esimGuideLocale(locale).content.common.moreLabel;
  const details = step.details ?? [];
  if (!details.length) return null;
  return (
    <details className="mt-2.5 border-t border-dashed border-[#e3e8ee] pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-[#1A7DB4] after:text-xs after:content-['▾'] [[open]_&]:after:rotate-180">
        {label} ({details.length})
      </summary>
      <ol className="mt-2.5 grid list-none gap-3 p-0">
        {details.map((detail, index) => (
          <DetailCard key={`${step.number}-${index + 1}`} detail={detail} number={`${step.number}-${index + 1}`} locale={locale} />
        ))}
      </ol>
    </details>
  );
}

function DetailCard({ detail, number, locale }: { detail: EsimGuideDetail; number: string; locale: string }) {
  const image = esimGuideScreen(detail.imageKey, locale);
  return (
    <li className="grid grid-cols-1 justify-items-center gap-2.5 rounded-xl bg-[#f6f8fa] p-2 text-left max-[760px]:grid-cols-[110px_minmax(0,1fr)] max-[760px]:justify-items-start">
      <GuideImage src={image.src} alt={detail.imageAlt} width={image.width} height={image.height} className="aspect-[9/19.5] h-auto w-[140px] max-[760px]:w-[110px]" />
      <div className="w-full">
        <span className="mb-1 inline-block rounded-full bg-[#12628f] px-2 text-xs font-bold text-white">{number}</span>
        <p className="m-0 text-[13px]">{detail.text}</p>
        {"tip" in detail && detail.tip ? <p className="mt-1.5 rounded-lg bg-white px-2 py-1.5 text-[13px] text-[#5B6470]">{detail.tip}</p> : null}
      </div>
    </li>
  );
}

function StepCarousel({ steps, locale }: { steps: EsimGuideStep[]; locale: string }) {
  const track = useRef<HTMLOListElement>(null);
  const [index, setIndex] = useState(0);
  const go = (next: number) => {
    const list = track.current;
    if (!list) return;
    const clamped = Math.max(0, Math.min(steps.length - 1, next));
    const card = list.children[clamped] as HTMLElement | undefined;
    if (card) list.scrollTo({ left: card.offsetLeft - list.offsetLeft - 16, behavior: "smooth" });
    setIndex(clamped);
  };
  return (
    <div>
      <ol
        ref={track}
        onScroll={() => {
          const list = track.current;
          if (!list) return;
          let best = 0;
          let distance = Number.POSITIVE_INFINITY;
          Array.from(list.children).forEach((child, childIndex) => {
            const delta = Math.abs((child as HTMLElement).offsetLeft - list.offsetLeft - 16 - list.scrollLeft);
            if (delta < distance) {
              distance = delta;
              best = childIndex;
            }
          });
          setIndex(best);
        }}
        className="m-0 grid list-none grid-cols-4 items-start gap-[18px] p-0 max-[1100px]:grid-cols-3 max-[760px]:mx-[-16px] max-[760px]:flex max-[760px]:snap-x max-[760px]:snap-mandatory max-[760px]:gap-3 max-[760px]:overflow-x-auto max-[760px]:px-4 max-[760px]:[scrollbar-width:none] max-[760px]:[&::-webkit-scrollbar]:hidden"
      >
        {steps.map((step) => {
          const image = esimGuideScreen(step.imageKey, locale);
          return (
            <li key={step.number} className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-[#e3e8ee] bg-white max-[760px]:w-[86%] max-[760px]:shrink-0 max-[760px]:snap-start">
              <figure className="m-0 flex justify-center bg-[#f6f8fa] px-4 pt-4">
                <GuideImage src={image.src} alt={step.imageAlt} width={image.width} height={image.height} className="aspect-[9/19.5] h-auto w-full max-w-[240px] object-contain max-[760px]:max-w-[220px]" />
              </figure>
              <div className="px-4 pb-4 pt-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#1A7DB4] text-[15px] font-bold text-white">{step.number}</span>
                  {step.title ? <h3 className="m-0 min-w-0 flex-1 text-[15.5px] leading-snug">{step.title}</h3> : null}
                  <span className="order-3 rounded-full bg-[#EEF4F9] px-2.5 py-0.5 text-xs text-[#12628f]">{step.phase}</span>
                </div>
                <p className="m-0 text-[14.5px]">{step.text}</p>
                {step.tip ? <p className="mt-1.5 rounded-lg bg-[#f6f8fa] px-2 py-1.5 text-[13px] text-[#5B6470]">{step.tip}</p> : null}
                <DetailList step={step} locale={locale} />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 hidden items-center gap-2 max-[760px]:flex">
        <button type="button" aria-label="이전" className="h-9 w-9 shrink-0 rounded-full border border-[#e3e8ee] bg-white text-[22px] leading-none text-[#1A7DB4]" onClick={() => go(index - 1)}>
          ‹
        </button>
        <div className="flex flex-1 flex-wrap justify-center gap-[5px]">
          {steps.map((step, dot) => (
            <button
              key={step.number}
              type="button"
              aria-label={`${step.number}단계`}
              className={`h-[7px] rounded-full border-0 p-0 ${dot === index ? "w-[18px] bg-[#1A7DB4]" : "w-[7px] bg-[#cbd3dc]"}`}
              onClick={() => go(dot)}
            />
          ))}
        </div>
        <span className="min-w-11 shrink-0 text-center text-[13px] text-[#5B6470]">
          <b className="text-[#1A7DB4]">{index + 1}</b> / {steps.length}
        </span>
        <button type="button" aria-label="다음" className="h-9 w-9 shrink-0 rounded-full border border-[#e3e8ee] bg-white text-[22px] leading-none text-[#1A7DB4]" onClick={() => go(index + 1)}>
          ›
        </button>
      </div>
    </div>
  );
}

function Banner({
  banner,
  back = false,
}: {
  banner: { title: string; description: string; page: "guide" | "auth" };
  back?: boolean;
}) {
  return (
    <Link
      href={PAGE_HREF[banner.page]}
      className={`mb-[18px] flex flex-wrap items-center justify-between gap-x-3.5 gap-y-1 rounded-[14px] px-[18px] py-3.5 no-underline ${
        back ? "border border-[#1A7DB4] bg-[#1A7DB4] text-white" : "border border-[#cfe2ef] bg-[#EEF4F9] text-[#1d2530]"
      }`}
    >
      <b className={back ? "text-white" : "text-[#12628f]"}>{banner.title}</b>
      <span className={`text-sm ${back ? "text-white" : "text-[#5B6470]"}`}>{banner.description} ›</span>
    </Link>
  );
}

function SupportLine({ locale }: { locale: string }) {
  const labels = esimGuideLocale(locale).content.support;
  const contact = ESIM_GUIDE_SITE_DATA.support;
  return (
    <p id="cs" className="mt-10 border-t border-[#e3e8ee] pt-3.5 text-[13px] text-[#5B6470]">
      {labels.label}: {labels.phoneLabel}{" "}
      <a className="text-[#5B6470] underline" href={`tel:${contact.phone.tel}`}>
        {labels.phone}
      </a>{" "}
      ({labels.phoneOverseasLabel}{" "}
      <a className="text-[#5B6470] underline" href={`tel:${contact.phone.telOverseas}`}>
        {labels.phoneOverseas}
      </a>
      ) ·{" "}
      <a className="text-[#5B6470] underline" href={contact.web.url} target="_blank" rel="noopener noreferrer">
        {labels.webLabel}
      </a>
    </p>
  );
}

function FaqTable({ title, items, columns }: { title: string; items: Array<{ q: string; a: string }>; columns: string[] }) {
  const downloads = esimGuideLocale().content.faq.downloads as Array<{ id: string; label: string; url: string }>;
  return (
    <section className="my-9" id="faq">
      <h2 className="mb-3 text-[22px]">{title}</h2>
      <BlockView block={{ type: "table", columns, rows: items.map((item) => [item.q, item.a]) }} />
      {downloads.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {downloads.map((item) => (
            <a key={item.id} href={item.url}>
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function EsimGuideSiteView({ page }: { page: "guide" | "auth" }) {
  const { locale, content } = esimGuideLocale("ko");
  const guide = content.guide;
  const [tab, setTab] = useState(guide.defaultTab);

  useEffect(() => {
    if (page !== "guide") return;
    const apply = () => {
      const id = window.location.hash.replace("#", "");
      if (guide.tabs.some((item) => item.id === id)) setTab(id);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [guide.tabs, page]);

  const selectTab = (id: string) => {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <article className="mx-auto w-full max-w-[1200px] px-6 pb-10 pt-2 text-[#1d2530] [word-break:keep-all] max-[760px]:px-4">
      {page === "guide" ? (
        <>
          <p className="mb-1 mt-5 text-[13px] text-[#5B6470]">{guide.breadcrumb.join(" › ")}</p>
          <h1 className="mb-2 mt-1.5 text-[32px] tracking-[-0.02em] max-[760px]:text-[25px]">{guide.title}</h1>
          <p className="mb-[18px] max-w-[820px] text-[#5B6470]">{guide.intro}</p>
          <Flow flow={guide.flow} locale={locale} />
          <Banner banner={{ ...guide.authBanner, page: guide.authBanner.page === "auth" ? "auth" : "guide" }} />
          <div className="sticky top-[4.5rem] z-40 mb-[22px] mt-2 flex gap-1.5 rounded-[14px] bg-[#f6f8fa] p-1.5 sm:top-20" role="tablist">
            {guide.tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`flex-1 rounded-[10px] px-2 py-3 text-base font-semibold ${tab === item.id ? "bg-white text-[#1A7DB4] shadow-[0_1px_4px_rgba(16,40,70,.12)]" : "text-[#5B6470]"}`}
                onClick={() => selectTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === "prep" ? (
            <div className="grid grid-cols-2 gap-[18px] max-[760px]:grid-cols-1">
              {guide.prep.cards.map((card, index) => (
                <article key={card.id} className={`rounded-[18px] border border-[#e3e8ee] bg-white px-[22px] py-5 max-[760px]:px-4 ${index === 0 ? "col-span-full" : ""}`}>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1A7DB4] text-sm font-bold text-white">{index + 1}</span>
                    <h3 className="m-0 text-lg">{card.title}</h3>
                  </div>
                  {asBlocks(card.blocks).map((block, blockIndex) => (
                    <BlockView key={`${card.id}-${blockIndex}`} block={block} />
                  ))}
                </article>
              ))}
            </div>
          ) : null}
          {tab === "iphone" || tab === "galaxy" ? (
            <div>
              <p className="mb-[18px] rounded-[14px] bg-[#f6f8fa] px-[18px] py-3.5">{guide.platforms[tab].lead}</p>
              <StepCarousel steps={asSteps(guide.platforms[tab].steps)} locale={locale} />
              <section className="my-9">
                <h2 className="mb-3 text-[22px]">{guide.platforms[tab].localSetup.title}</h2>
                {asBlocks(guide.platforms[tab].localSetup.blocks).map((block, blockIndex) => (
                  <BlockView key={`${tab}-local-${blockIndex}`} block={block} />
                ))}
              </section>
            </div>
          ) : null}
          <FaqTable title={content.faq.title} items={content.faq.items} columns={content.faq.columns} />
          <SupportLine locale={locale} />
        </>
      ) : (
        <>
          <p className="mb-1 mt-5 text-[13px] text-[#5B6470]">{content.auth.breadcrumb.join(" › ")}</p>
          <h1 className="mb-2 mt-1.5 text-[32px] tracking-[-0.02em] max-[760px]:text-[25px]">{content.auth.title}</h1>
          <p className="mb-[18px] max-w-[820px] text-[#5B6470]">{content.auth.intro}</p>
          <Banner banner={{ ...content.auth.installBanner, page: content.auth.installBanner.page === "guide" ? "guide" : "auth" }} back />
          <Flow flow={content.auth.flow} locale={locale} />
          <section className="my-9">
            <h2 className="mb-3 text-[22px]">{content.auth.differences.title}</h2>
            {asBlocks(content.auth.differences.blocks).map((block, index) => (
              <BlockView key={`diff-${index}`} block={block} />
            ))}
          </section>
          <section className="my-9">
            <h2 className="mb-3 text-[22px]">{content.auth.verification.title}</h2>
            <p className="mb-[18px] rounded-[14px] bg-[#f6f8fa] px-[18px] py-3.5">
              <RichText text={content.auth.verification.lead.text} links={content.auth.verification.lead.links} />
            </p>
            <StepCarousel steps={asSteps(content.auth.verification.steps)} locale={locale} />
            <div className="mt-4">
              <BlockView block={asBlocks([content.auth.verification.note])[0]!} />
            </div>
          </section>
          <FaqTable title={content.auth.faq.title} items={content.auth.faq.items} columns={content.faq.columns} />
          <SupportLine locale={locale} />
        </>
      )}
    </article>
  );
}
