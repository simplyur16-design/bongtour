/**
 * Rasterize Play Console listing assets at exact pixel sizes.
 * Icon 512×512 (≤1MB) — from the app icon (assets/images/icon.png, A안 eSIM icon).
 * Feature graphic 1024×500 — play-feature.svg (1.0.2 design: sage bg, ink card, cobalt).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = path.dirname(fileURLToPath(import.meta.url));
// Windows operator copy only; on other machines the PNGs stay next to this script.
const desktopOut = process.platform === "win32" ? path.join("C:/Users/USER/Desktop/simplyur-play-assets") : null;

async function render(svgName, width, height, pngName) {
  const svg = fs.readFileSync(path.join(dir, svgName));
  const buf = await sharp(svg, { density: 144 })
    .resize(width, height, { fit: "fill" })
    .flatten({ background: { r: 244, g: 246, b: 242 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  write(pngName, buf);
  const kb = Math.round(buf.length / 1024);
  console.log(`${pngName}: ${width}x${height} ${kb}KB`);
}

function write(pngName, buf) {
  fs.writeFileSync(path.join(dir, pngName), buf);
  if (desktopOut) {
    fs.mkdirSync(desktopOut, { recursive: true });
    fs.writeFileSync(path.join(desktopOut, pngName), buf);
  }
}

async function renderIcon() {
  const buf = await sharp(path.join(dir, "../assets/images/icon.png"))
    .resize(512, 512)
    .flatten({ background: { r: 244, g: 246, b: 242 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  write("play-icon-512.png", buf);
  console.log(`play-icon-512.png: 512x512 ${Math.round(buf.length / 1024)}KB`);
}

await renderIcon();
await render("play-feature.svg", 1024, 500, "play-feature-1024x500.png");
