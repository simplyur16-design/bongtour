/**
 * Rasterize Play Console listing assets at exact pixel sizes.
 * Icon 512×512 (≤1MB). Feature graphic 1024×500.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = path.dirname(fileURLToPath(import.meta.url));
const desktopOut = path.join("C:/Users/USER/Desktop/simplyur-play-assets");

async function render(svgName, width, height, pngName) {
  const svg = fs.readFileSync(path.join(dir, svgName));
  const buf = await sharp(svg, { density: 144 })
    .resize(width, height, { fit: "fill" })
    .flatten({ background: { r: 255, g: 244, b: 239 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  fs.writeFileSync(path.join(dir, pngName), buf);
  fs.mkdirSync(desktopOut, { recursive: true });
  fs.writeFileSync(path.join(desktopOut, pngName), buf);
  const kb = Math.round(buf.length / 1024);
  console.log(`${pngName}: ${width}x${height} ${kb}KB`);
}

await render("play-icon.svg", 512, 512, "play-icon-512.png");
await render("play-feature.svg", 1024, 500, "play-feature-1024x500.png");
