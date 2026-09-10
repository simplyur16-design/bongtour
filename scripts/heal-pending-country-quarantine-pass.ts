/**
 * @deprecated 격리만 하지 말 것 — geo 재부여 셀프힐 사용:
 *   npx tsx scripts/heal-pending-country-schedule-mismatch.ts --apply
 *
 * 이 스크립트는 false-positive 복원만 유지한다.
 */
import { existsSync } from "fs";
import path from "path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { verifyRegisterPrePhotoForStoredProduct } from "../lib/register-pre-photo-verify";

const ROOT = process.cwd();
for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f);
  if (existsSync(p)) config({ path: p, override: f === ".env.local" });
}

const FALSE_POSITIVE_IDS = ["cmtegli1a04r1gh46v6m55ons"];

async function main() {
  const apply = process.argv.includes("--apply");
  console.warn(
    "[deprecated] use scripts/heal-pending-country-schedule-mismatch.ts --apply for mismatch heal",
  );
  const prisma = new PrismaClient();
  try {
    for (const id of FALSE_POSITIVE_IDS) {
      const row = await prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          registrationStatus: true,
          countryKey: true,
          destination: true,
          schedule: true,
          listingKind: true,
          productType: true,
          sportsThemeTag: true,
        },
      });
      if (!row) continue;
      const v = verifyRegisterPrePhotoForStoredProduct(row);
      console.log("[restore-check]", id, "status=", row.registrationStatus, "ok=", v.ok, "issues=", v.issues);
      if (apply && row.registrationStatus === "pre_photo_blocked" && v.ok) {
        await prisma.product.update({
          where: { id },
          data: { registrationStatus: "pending", rejectReason: null, rejectedAt: null },
        });
        console.log("[restored]", id);
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
