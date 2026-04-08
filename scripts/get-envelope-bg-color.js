/**
 * 봉투 이미지 모서리 픽셀을 샘플링해 배경색(hex) 추출
 * 사용: node scripts/get-envelope-bg-color.js
 */
const path = require('path')
const fs = require('fs')

const imagePath = path.join(__dirname, '../public/image/envelope-closed.png')
if (!fs.existsSync(imagePath)) {
  console.error('이미지 없음:', imagePath)
  process.exit(1)
}

async function main() {
  const sharp = require('sharp')
  const { data, info } = await sharp(imagePath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const getPixel = (x, y) => {
    const i = (y * width + x) * channels
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }
  }

  const samples = []
  const margin = Math.min(30, Math.floor(width * 0.05))
  for (let y = 0; y < margin; y++) {
    for (let x = 0; x < margin; x++) {
      const p = getPixel(x, y)
      if (p.a > 200) samples.push(p)
    }
  }
  for (let y = 0; y < margin; y++) {
    const p = getPixel(width - 1 - margin, y)
    if (p.a > 200) samples.push(p)
  }
  for (let x = 0; x < margin; x++) {
    const p = getPixel(x, height - 1 - margin)
    if (p.a > 200) samples.push(p)
  }

  if (samples.length === 0) {
    console.log('#FDF5E6')
    return
  }

  const r = Math.round(samples.reduce((a, p) => a + p.r, 0) / samples.length)
  const g = Math.round(samples.reduce((a, p) => a + p.g, 0) / samples.length)
  const b = Math.round(samples.reduce((a, p) => a + p.b, 0) / samples.length)
  const hex = '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()
  console.log(hex)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
