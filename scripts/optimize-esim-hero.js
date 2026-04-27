/**
 * eSIM 메인 허브 히어로 이미지 최적화
 * 실행: node scripts/optimize-esim-hero.js
 *
 * 입력: public/images/home-hub/esim-hero.png
 * 출력: public/images/home-hub/esim-hero.webp (1200px 너비, quality 80)
 *       public/images/home-hub/esim-hero.jpg (동일 리사이즈, quality 85, 폴백용)
 */

const fs = require("fs");
const path = require("path");

let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("sharp 모듈을 불러올 수 없습니다. 다음을 실행하세요:\n  npm install sharp --save-dev\n");
  process.exit(1);
}

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "public", "images", "home-hub", "esim-hero.png");
const OUT_WEBP = path.join(ROOT, "public", "images", "home-hub", "esim-hero.webp");
const OUT_JPG = path.join(ROOT, "public", "images", "home-hub", "esim-hero.jpg");

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`입력 파일이 없습니다: ${INPUT}`);
    process.exit(1);
  }

  const resized = await sharp(INPUT)
    .rotate()
    .resize({
      width: 1200,
      withoutEnlargement: true,
    })
    .toBuffer();

  await sharp(resized).webp({ quality: 80 }).toFile(OUT_WEBP);
  await sharp(resized).jpeg({ quality: 85, mozjpeg: true }).toFile(OUT_JPG);

  const inStat = fs.statSync(INPUT);
  const webpStat = fs.statSync(OUT_WEBP);
  const jpgStat = fs.statSync(OUT_JPG);
  console.log("완료.");
  console.log(`  원본 PNG: ${(inStat.size / 1024).toFixed(1)} KB  (${INPUT})`);
  console.log(`  WebP:     ${(webpStat.size / 1024).toFixed(1)} KB  (${OUT_WEBP})`);
  console.log(`  JPEG:     ${(jpgStat.size / 1024).toFixed(1)} KB  (${OUT_JPG})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
