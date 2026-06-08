import { NextResponse } from "next/server";
import { buildEsimCountryHeroAdminCatalog } from "@/lib/bongsim/esim-country-hero-admin-catalog";
import { listBongsimStandaloneCountries } from "@/lib/bongsim/data/list-standalone-countries";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { requireAdmin } from "@/lib/require-admin";

/**
 * GET /api/admin/bongsim/country-heroes/catalog
 *
 * 단독 플랜 국가 + 유럽 패키지·개별국 — 추천 히어로 관리용 목록.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  }

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json({ ok: false, error: "DB not configured" }, { status: 500 });
  }

  try {
    const standalone = await listBongsimStandaloneCountries(pool);
    const catalog = buildEsimCountryHeroAdminCatalog(standalone);
    return NextResponse.json({ ok: true, catalog });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "query failed";
    console.error("[api/admin/bongsim/country-heroes/catalog]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
