/**
 * EU 국기 1종 — flagcdn → NCloud `flags/iso/eu.webp` + manifest `eu` 항목 갱신
 *
 *   npx tsx scripts/sync-eu-flag-to-ncloud.ts --apply
 */
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { convertToWebp } from "@/lib/image-to-webp";
import { flagcdnImageUrl } from "@/lib/bongsim-flag-image-url";
import { isObjectStorageConfigured, uploadStorageObject } from "@/lib/object-storage";

const MANIFEST_PATH = join(process.cwd(), "lib", "bongsim-flag-ncloud-manifest.ts");
const CODE = "eu";

async function main() {
  const apply = process.argv.includes("--apply");
  const remote = flagcdnImageUrl(CODE);

  if (!apply) {
    console.log(`[dry-run] would fetch ${remote} → flags/iso/${CODE}.webp and patch manifest`);
    return;
  }

  if (!isObjectStorageConfigured()) {
    console.error("Object Storage(NCLOUD_*)가 설정되어 있지 않습니다.");
    process.exit(1);
  }

  const res = await fetch(remote, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    console.error(`flagcdn fetch failed: ${res.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const webp = await convertToWebp(buf, { maxWidth: 320, quality: 82 });
  const { publicUrl } = await uploadStorageObject({
    objectKey: `flags/iso/${CODE}.webp`,
    body: webp.buffer,
    contentType: "image/webp",
  });

  let manifest = await readFile(MANIFEST_PATH, "utf8");
  const line = `  ${JSON.stringify(CODE)}: ${JSON.stringify(publicUrl)},`;
  if (manifest.includes(`"${CODE}":`)) {
    manifest = manifest.replace(new RegExp(`\\s+${JSON.stringify(CODE)}:.*`, "m"), `\n${line}`);
  } else {
    manifest = manifest.replace(/(\s+"et":[^\n]+\n)/, `$1${line}\n`);
  }
  await writeFile(MANIFEST_PATH, manifest, "utf8");
  console.log(`Uploaded ${publicUrl}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
