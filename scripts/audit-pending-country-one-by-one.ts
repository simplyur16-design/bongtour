/**
 * Live 등록대기 — countryKey vs 동선 불일치 전수.
 * Usage:
 *   npx tsx scripts/audit-pending-country-one-by-one.ts
 *   npx tsx scripts/audit-pending-country-one-by-one.ts --apply   # 격리 대신 셀프힐(geo 재부여)
 */
import Module from "node:module";
import { register } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "fs";
import path from "path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE } from "../lib/register-pre-photo-pending-queue-query";
import {
  scheduleRowsForPrePhotoVerify,
  verifyRegisterPrePhotoForStoredProduct,
} from "../lib/register-pre-photo-verify";
import { isRegisterPrePhotoPendingQueueReady } from "../lib/register-pre-photo-pending-queue";
import { productCountryScheduleMismatchIssues } from "../lib/register-pre-photo-product-country-schedule-guard";

register(pathToFileURL(join(process.cwd(), "scripts/stub-server-only.mjs")).href);
const load = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
;(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function (
  request: unknown,
  parent: unknown,
  isMain: unknown,
) {
  if (request === "server-only") return {};
  return load.call(this, request, parent, isMain);
};

const ROOT = process.cwd();
for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f);
  if (existsSync(p)) config({ path: p, override: f === ".env.local" });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  const healMod = apply ? await import("../lib/register-pending-pre-photo-self-heal") : null;
  try {
    const rows = await prisma.product.findMany({
      where: {
        OR: [
          REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
          {
            registrationStatus: "pre_photo_blocked",
            rejectReason: { startsWith: "product_country_schedule_mismatch" },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        originSource: true,
        countryKey: true,
        destination: true,
        schedule: true,
        listingKind: true,
        productType: true,
        sportsThemeTag: true,
        registrationStatus: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const bad: Array<{
      id: string;
      src: string | null;
      ck: string | null;
      title: string;
      dest: string;
      issues: string[];
      dayTitles: string;
    }> = [];

    for (const r of rows) {
      const v = verifyRegisterPrePhotoForStoredProduct(r);
      const schedRows = scheduleRowsForPrePhotoVerify(r.schedule);
      const mismatch = productCountryScheduleMismatchIssues({
        countryKey: r.countryKey,
        productTitle: r.title,
        productDestination: r.destination,
        rows: schedRows,
      });
      const hasMismatch =
        mismatch.length > 0 || v.issues.includes("product_country_schedule_mismatch");
      if (!hasMismatch) continue;

      bad.push({
        id: r.id,
        src: r.originSource,
        ck: r.countryKey,
        title: String(r.title ?? "").slice(0, 90),
        dest: String(r.destination ?? "").slice(0, 40),
        issues: [...new Set([...mismatch, ...v.issues.filter((i) => i.includes("country"))])],
        dayTitles: schedRows.map((d) => `D${d.day}:${String(d.title ?? "").slice(0, 20)}`).join("|"),
      });
    }

    console.log(`[audit] db_scan=${rows.length} country_mismatch=${bad.length} apply=${apply}`);
    for (const b of bad) {
      console.log(JSON.stringify(b));
      if (apply && healMod) {
        const result = await healMod.healPendingRegisterPrePhoto({
          productId: b.id,
          limit: 1,
          dryRun: false,
          probeImageUrls: false,
        });
        console.log(JSON.stringify({ healed: b.id, result }));
      }
    }

    let liveOk = 0;
    const afterRows = apply
      ? await prisma.product.findMany({
          where: REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
          select: {
            id: true,
            title: true,
            originSource: true,
            countryKey: true,
            destination: true,
            schedule: true,
            listingKind: true,
            productType: true,
            sportsThemeTag: true,
          },
        })
      : rows.filter((r) => r.registrationStatus !== "pre_photo_blocked");
    for (const r of afterRows) {
      if (!apply && bad.some((b) => b.id === r.id)) continue;
      const v = verifyRegisterPrePhotoForStoredProduct(r);
      if (isRegisterPrePhotoPendingQueueReady(v)) liveOk += 1;
    }
    console.log(`[audit] live_queue_remaining_estimate=${liveOk}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
