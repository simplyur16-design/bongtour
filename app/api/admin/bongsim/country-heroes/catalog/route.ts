import { NextResponse } from "next/server";
import { buildEsimCountryHeroAdminCatalog } from "@/lib/bongsim/esim-country-hero-admin-catalog";
import { listBongsimStandaloneCountriesViaPrisma } from "@/lib/bongsim/data/list-standalone-countries";
import { requireAdmin } from "@/lib/require-admin";

/**
 * GET /api/admin/bongsim/country-heroes/catalog
 *
 * 단독 플랜 국가 + 유럽 패키지·개별국 — 추천 히어로 관리용 목록.
 * Prisma 경로만 사용 (별도 pg Pool connect timeout 회피).
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const standalone = await listBongsimStandaloneCountriesViaPrisma();
    const catalog = buildEsimCountryHeroAdminCatalog(standalone);
    return NextResponse.json({ ok: true, catalog });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "query failed";
    console.error("[api/admin/bongsim/country-heroes/catalog]", e);
    const friendly =
      /timeout|ECONNREFUSED|EMAXCONN|too many|connection/i.test(msg)
        ? `DB 연결에 실패했습니다. 잠시 후 다시 시도하세요. (${msg})`
        : msg;
    return NextResponse.json({ ok: false, error: friendly }, { status: 500 });
  }
}
