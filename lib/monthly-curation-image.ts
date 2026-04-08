import { promises as fs } from 'fs'
import path from 'path'
import { convertToWebp } from '@/lib/image-to-webp'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'monthly-curation')
const WEB_PREFIX = '/uploads/monthly-curation/'
const EDITORIAL_DIR = path.join(process.cwd(), 'public', 'uploads', 'editorial-content')
const EDITORIAL_WEB_PREFIX = '/uploads/editorial-content/'

function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '')
    .slice(0, 80)
}

export async function saveMonthlyCurationImage(file: File, opts: { monthKey: string; title: string }) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  const input = Buffer.from(await file.arrayBuffer())
  const converted = await convertToWebp(input, { maxWidth: 1600, quality: 82 })
  const filename = `${slug(opts.monthKey || 'month')}-${slug(opts.title || 'curation')}-${Date.now()}.webp`
  const abs = path.join(UPLOAD_DIR, filename)
  await fs.writeFile(abs, converted.buffer)
  return {
    imageUrl: `${WEB_PREFIX}${filename}`,
    imageStorageKey: `monthly-curation/${filename}`,
    imageWidth: converted.width,
    imageHeight: converted.height,
  }
}

export async function saveEditorialHeroImage(file: File, opts: { title: string }) {
  await fs.mkdir(EDITORIAL_DIR, { recursive: true })
  const input = Buffer.from(await file.arrayBuffer())
  const converted = await convertToWebp(input, { maxWidth: 1600, quality: 82 })
  const filename = `editorial-${slug(opts.title || 'hero')}-${Date.now()}.webp`
  const abs = path.join(EDITORIAL_DIR, filename)
  await fs.writeFile(abs, converted.buffer)
  return {
    heroImageUrl: `${EDITORIAL_WEB_PREFIX}${filename}`,
    heroImageStorageKey: `editorial-content/${filename}`,
    heroImageWidth: converted.width,
    heroImageHeight: converted.height,
  }
}

