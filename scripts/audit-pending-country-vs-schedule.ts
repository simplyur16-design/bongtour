/**
 * Audit live 등록대기 queue: product country/geo vs schedule keywords/routes.
 * Usage: npx tsx scripts/audit-pending-country-vs-schedule.ts
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
} from "../lib/register-pre-photo-pending-queue-query";
import { verifyRegisterPrePhotoForStoredProduct } from "../lib/register-pre-photo-verify";
import { isRegisterPrePhotoPendingQueueReady } from "../lib/register-pre-photo-pending-queue";

const ROOT = process.cwd();
for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f);
  if (existsSync(p)) config({ path: p, override: f === ".env.local" });
}

type SchedDay = {
  day?: number;
  description?: string | null;
  routeText?: string | null;
  imageKeyword?: string | null;
  imageKeyword2?: string | null;
};

function parseSchedule(raw: unknown): SchedDay[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as SchedDay[];
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.product.findMany({
      where: REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
      select: {
        id: true,
        title: true,
        originSource: true,
        originUrl: true,
        registrationStatus: true,
        destination: true,
        primaryDestination: true,
        continent: true,
        country: true,
        city: true,
        countryKey: true,
        continentKey: true,
        cityKey: true,
        schedule: true,
        themeTags: true,
        displayCategory: true,
        productType: true,
        createdAt: true,
        countryTags: {
          select: { countryKey: true, isPrimary: true, nodeKey: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    console.log(`[audit] DB pending-ish rows=${rows.length}`);

    const live: typeof rows = [];
    const blocked: Array<{ id: string; title: string; issues: string[] }> = [];

    for (const r of rows) {
      const v = await verifyRegisterPrePhotoForStoredProduct(r as any);
      if (isRegisterPrePhotoPendingQueueReady(v)) {
        live.push(r);
      } else {
        blocked.push({
          id: r.id,
          title: String(r.title ?? "").slice(0, 80),
          issues: v.issues ?? [],
        });
      }
    }

    console.log(`[audit] live queue (verify.ok)=${live.length}`);
    console.log(`[audit] pending but not queue-ready=${blocked.length}`);

    console.log("\n=== LIVE 등록대기 (전수) ===");
    for (const r of live) {
      const days = parseSchedule(r.schedule);
      const kw = days
        .map((d) => {
          const parts = [d.imageKeyword, d.imageKeyword2].filter(Boolean).join(" / ");
          const route = String(d.routeText ?? "").replace(/\s+/g, " ").slice(0, 60);
          return `D${d.day ?? "?"}:${parts || "(no-kw)"}${route ? ` | ${route}` : ""}`;
        })
        .join(" || ");
      const tags = (r.countryTags ?? [])
        .map((t) => `${t.countryKey}${t.isPrimary ? "*" : ""}`)
        .join(",");
      console.log(
        [
          `id=${r.id}`,
          `src=${r.originSource ?? "?"}`,
          `countryKey=${r.countryKey ?? "-"}`,
          `country=${r.country ?? "-"}`,
          `continent=${r.continent ?? "-"}`,
          `dest=${(r.destination ?? r.primaryDestination ?? "-").toString().slice(0, 40)}`,
          `tags=[${tags}]`,
          `title=${String(r.title ?? "").slice(0, 70)}`,
        ].join(" | "),
      );
      console.log(`  schedule(${days.length}): ${kw.slice(0, 500)}`);
      const v = await verifyRegisterPrePhotoForStoredProduct(r as any);
      if (v.issues?.length) console.log(`  verify.issues: ${v.issues.join(", ")}`);
    }

    if (blocked.length) {
      console.log("\n=== NOT queue-ready (sample up to 40) ===");
      for (const b of blocked.slice(0, 40)) {
        console.log(
          `id=${b.id} | ${b.title} | issues=${b.issues.slice(0, 8).join(",")}`,
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
