/**
 * public/og/*.png → 동일 basename .webp (1200px 너비 제한, quality 85)
 * 실행: node scripts/convert-public-og-png-to-webp.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OG_DIR = path.join(process.cwd(), "public", "og");

async function main() {
  const names = await fs.readdir(OG_DIR);
  const pngs = names.filter((n) => n.toLowerCase().endsWith(".png"));
  for (const file of pngs) {
    const inPath = path.join(OG_DIR, file);
    const outPath = path.join(OG_DIR, file.replace(/\.png$/i, ".webp"));
    const buf = await fs.readFile(inPath);
    await sharp(buf)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outPath);
    const stIn = await fs.stat(inPath);
    const stOut = await fs.stat(outPath);
    console.log(file, "→", path.basename(outPath), `${Math.round(stIn.size / 1024)}KB → ${Math.round(stOut.size / 1024)}KB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
