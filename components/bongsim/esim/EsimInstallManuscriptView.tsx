import type { ReactNode } from "react";
import { parseEsimInstallManuscript, type EsimInstallBlock } from "@/lib/bongsim/esim-install-manuscript";

function Inline({ text }: { text: string }): ReactNode {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link?.[2] ?? "";
      const label = link?.[1] ?? token;
      nodes.push(
        <a key={key} href={href} className="font-medium text-teal-800 underline-offset-2 hover:underline">
          {label}
        </a>,
      );
    }
    key += 1;
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function BlockView({ block }: { block: EsimInstallBlock }) {
  if (block.kind === "h") {
    if (block.level === 1) {
      return <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 lg:text-3xl">{block.text}</h1>;
    }
    if (block.level === 2) {
      return <h2 className="mt-10 text-lg font-bold text-slate-900 lg:text-xl">{block.text}</h2>;
    }
    return <h3 className="mt-6 text-base font-bold text-slate-900">{block.text}</h3>;
  }
  if (block.kind === "p") {
    return <p className="mt-3 text-sm leading-relaxed text-slate-800 lg:text-base"><Inline text={block.text} /></p>;
  }
  if (block.kind === "quote") {
    return (
      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
        <Inline text={block.text} />
      </p>
    );
  }
  if (block.kind === "ul" || block.kind === "ol") {
    const List = block.kind === "ul" ? "ul" : "ol";
    return (
      <List className={`mt-3 space-y-2 pl-5 text-sm leading-relaxed text-slate-800 lg:text-base ${block.kind === "ul" ? "list-disc" : "list-decimal"}`}>
        {block.items.map((item) => (
          <li key={item}>
            <Inline text={item} />
          </li>
        ))}
      </List>
    );
  }
  if (block.kind === "img") {
    return (
      {/* eslint-disable-next-line @next/next/no-img-element -- 원고 SVG */}
      <img
        src={block.src}
        alt={block.alt}
        className="mt-4 h-auto w-full max-w-3xl"
        loading="lazy"
        decoding="async"
      />
    );
  }
  if (block.kind === "small") {
    return <p className="mt-8 text-xs leading-relaxed text-slate-500"><Inline text={block.text} /></p>;
  }
  return (
    <div className="mt-3 max-w-full overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm text-slate-800">
        <thead>
          <tr>
            {block.header.map((cell) => (
              <th key={cell} className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">
                <Inline text={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) => (
                <td key={`${index}-${cell}`} className="border border-slate-200 px-3 py-2 align-top">
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EsimInstallManuscriptView({ markdown }: { markdown: string }) {
  const blocks = parseEsimInstallManuscript(markdown);
  return (
    <article>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </article>
  );
}
