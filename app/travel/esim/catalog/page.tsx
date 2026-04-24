import Link from "next/link";
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { bongsimPath } from '@/lib/bongsim/constants'
import { ProductCatalogCard } from "@/components/bongsim/catalog/ProductCatalogCard";
import { listCatalogProducts, type CatalogProductListRow } from "@/lib/bongsim/data/list-catalog-products";

type BucketKey = "local" | "roam_unlimited" | "roam_fixed" | "roam_daily";

function bucketFor(row: CatalogProductListRow): BucketKey {
  if (row.network_family === "local") return "local";
  const pt = row.plan_type;
  if (pt === "unlimited") return "roam_unlimited";
  if (pt === "daily") return "roam_daily";
  return "roam_fixed";
}

const BUCKET_META: Record<BucketKey, { title: string; description: string }> = {
  local: { title: "로컬", description: "국내 망 기준 요금제" },
  roam_unlimited: { title: "로밍 · 무제한", description: "해외 로밍 무제한 라인" },
  roam_fixed: { title: "로밍 · 종량제", description: "데이터 용량 기준 로밍" },
  roam_daily: { title: "로밍 · 데일리", description: "일 단위 로밍" },
};

function groupRows(rows: CatalogProductListRow[]): Record<BucketKey, CatalogProductListRow[]> {
  const out: Record<BucketKey, CatalogProductListRow[]> = {
    local: [],
    roam_unlimited: [],
    roam_fixed: [],
    roam_daily: [],
  };
  for (const r of rows) {
    out[bucketFor(r)].push(r);
  }
  return out;
}

export default async function CatalogPage() {
  const res = await listCatalogProducts({});

  if (!res.ok) {
    return (
      <div className="min-h-screen bg-bt-page">
        <Header />
        <OverseasTravelSubMainNav variant="links" />
        <div className="min-h-full bg-slate-50">
        <main className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-lg font-semibold text-slate-900">요금제 목록</h1>
          <p className="mt-3 text-sm text-slate-600">
            {res.reason === "db_unconfigured"
              ? "DATABASE_URL이 설정되지 않았거나 DB에 연결할 수 없습니다."
              : "목록을 불러오지 못했습니다."}
          </p>
          <Link href={bongsimPath()} className="mt-6 inline-block text-sm text-teal-800 underline">
            홈으로
          </Link>
        </main>
        </div>
      </div>
    );
  }

  const grouped = groupRows(res.rows);
  const order: BucketKey[] = ["local", "roam_unlimited", "roam_fixed", "roam_daily"];

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <div className="min-h-full bg-slate-50">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
        <nav className="text-[12px] text-slate-500">
          <Link href={bongsimPath()} className="hover:text-teal-800">
            홈
          </Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="text-slate-800">요금제</span>
        </nav>
        <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-slate-900">요금제 목록</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Excel에서 반영된 상품 옵션을 망·플랜 유형별로 묶어 보여줍니다. 카드를 누르면 상세 페이지로 이동합니다.
        </p>

        <div className="mt-10 space-y-12">
          {order.map((key) => {
            const items = grouped[key];
            if (!items.length) return null;
            const meta = BUCKET_META[key];
            return (
              <section key={key} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{meta.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{meta.description}</p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {items.map((row) => (
                    <li key={row.option_api_id}>
                      <ProductCatalogCard row={row} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {res.rows.length === 0 ? (
          <p className="mt-10 text-sm text-slate-600">등록된 상품이 없습니다. 내부 Excel 가져오기를 먼저 실행해 주세요.</p>
        ) : null}
      </main>
      </div>
    </div>
  );
}
