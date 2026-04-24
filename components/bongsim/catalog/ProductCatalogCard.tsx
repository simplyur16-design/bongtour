import Link from "next/link";
import type { CatalogProductListRow } from "@/lib/bongsim/data/list-catalog-products";
import { bongsimPath } from "@/lib/bongsim/constants";

function consumerAfterKrw(price_block: unknown): number | null {
  if (!price_block || typeof price_block !== "object") return null;
  const o = price_block as Record<string, unknown>;
  const after = o.after;
  if (!after || typeof after !== "object") return null;
  const n = (after as Record<string, unknown>).consumer_krw;
  if (typeof n === "number" && Number.isFinite(n)) return Math.round(n);
  if (typeof n === "string" && n.trim()) {
    const v = Number(n.replace(/,/g, ""));
    return Number.isFinite(v) ? Math.round(v) : null;
  }
  return null;
}

type Props = { row: CatalogProductListRow };

export function ProductCatalogCard({ row }: Props) {
  const price = consumerAfterKrw(row.price_block);
  const href = bongsimPath(`/product/${encodeURIComponent(row.option_api_id)}`);

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 transition hover:border-teal-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug text-slate-900">{row.plan_name}</p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-600">{row.option_label}</p>
          <p className="mt-2 text-[11px] text-slate-400">
            {row.allowance_label} · {row.days_raw}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {price != null ? (
            <p className="text-[14px] font-semibold tabular-nums text-teal-900">{price.toLocaleString("ko-KR")}원</p>
          ) : (
            <p className="text-[12px] text-slate-400">가격 문의</p>
          )}
          <p className="mt-1 font-mono text-[10px] text-slate-400">{row.option_api_id}</p>
        </div>
      </div>
    </Link>
  );
}
