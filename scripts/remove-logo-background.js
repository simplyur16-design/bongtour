/**
 * 흰색(및 밝은 배경)을 제거하여 투명 PNG로 저장.
 * 사용: node scripts/remove-logo-background.js
 * 입력: public/images/bongtour-logo.webp
 * 출력: public/images/logo-transparent.png
 */

const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const INPUT = path.join(__dirname, '..', 'public', 'images', 'bongtour-logo.webp')
const OUT_DIR = path.join(__dirname, '..', 'public', 'images')
const OUTPUT = path.join(OUT_DIR, 'logo-transparent.png')

// 이 값 이상이면 배경으로 간주하고 투명 처리 (255에 가까울수록 흰색)
const WHITE_THRESHOLD = 248

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error('입력 파일 없음:', INPUT)
    process.exit(1)
  }
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  const { data, info } = await sharp(INPUT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      data[i + 3] = 0
    }
  }

  await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(OUTPUT)

  console.log('저장 완료:', OUTPUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
