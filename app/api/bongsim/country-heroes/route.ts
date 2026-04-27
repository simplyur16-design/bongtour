import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ENTITY_TYPE = "bongsim_esim_country";
const IMAGE_ROLE = "recommend_hero";

/**
 * GET /api/bongsim/country-heroes
 *
 * `image_assets`에서 봉심 eSIM 추천 퍼널 국가별 히어로 URL 맵 (공개).
 * 동일 국가 다행 시 `updatedAt` 최신 행을 사용.
 */
export async function GET() {
  try {
    const rows = await prisma.imageAsset.findMany({
      where: {
        entityType: ENTITY_TYPE,
        imageRole: IMAGE_ROLE,
        isPrimary: true,
      },
      select: {
        entityId: true,
        publicUrl: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const heroes: Record<string, string> = {};
    for (const r of rows) {
      const code = r.entityId.trim().toLowerCase();
      const url = r.publicUrl.trim();
      if (!code || !url) continue;
      if (heroes[code] !== undefined) continue;
      heroes[code] = url;
    }

    return NextResponse.json(heroes, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "query failed";
    console.error("[api/bongsim/country-heroes]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
