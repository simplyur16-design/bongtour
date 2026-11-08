import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  SAME_ORIGINAL_MOBILE_BY_BASE,
  homeHubTrainingSrcSet,
  preferMobileHubLocalVariant,
  selectProvenMobileHubVariant,
  selectProvenTrainingSrcSet,
  type SameOriginalMobileVariant,
} from '@/lib/home-mobile-hub-tile-images'
import { pexelsResponsiveSrcSet } from '@/lib/responsive-image-srcset'

const TRAINING_BASE = '/images/home-hub/base/training.webp'
const TRAINING_MOBILE = '/images/home-hub/mobile/training.webp'

function readPublic(urlPath: string): Buffer {
  return fs.readFileSync(path.join(process.cwd(), 'public', urlPath.replace(/^\/+/, '')))
}

function gitBlobSha1(bytes: Buffer): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
}

function webpSize(buf: Buffer): { width: number; height: number } {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('not a webp')
  }
  let offset = 12
  while (offset + 8 <= buf.length) {
    const tag = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const data = offset + 8
    if (tag === 'VP8 ' && data + 10 <= buf.length) {
      return {
        width: buf.readUInt16LE(data + 6) & 0x3fff,
        height: buf.readUInt16LE(data + 8) & 0x3fff,
      }
    }
    if (tag === 'VP8L' && data + 5 <= buf.length) {
      const b0 = buf[data + 1]!
      const b1 = buf[data + 2]!
      const b2 = buf[data + 3]!
      const b3 = buf[data + 4]!
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      }
    }
    if (tag === 'VP8X' && data + 10 <= buf.length) {
      return { width: 1 + buf.readUIntLE(data + 4, 3), height: 1 + buf.readUIntLE(data + 7, 3) }
    }
    offset = data + size + (size % 2)
  }
  throw new Error('webp size missing')
}

describe('speed-home-responsive-images', () => {
  // REGRESSION-FREEZE[speed-home-responsive-images]: same-name mobile file is not the training photo — manifest
  it('keeps the training photo when the same-name mobile file is a different picture', () => {
    const base = readPublic(TRAINING_BASE)
    const mobile = readPublic(TRAINING_MOBILE)
    expect(base.length).toBe(249872)
    expect(mobile.length).toBe(10142)
    expect(gitBlobSha1(base)).toBe('4fcd40b7779bda1aa4b02535197b793e6937f928')
    expect(gitBlobSha1(mobile)).toBe('3fd40f5ac222b5669803a7dcbe98c2d36a7f34b9')
    expect(webpSize(base)).toEqual({ width: 1600, height: 2399 })
    expect(webpSize(mobile)).toEqual({ width: 1181, height: 591 })
    expect(SAME_ORIGINAL_MOBILE_BY_BASE[TRAINING_BASE]).toBeUndefined()
    expect(preferMobileHubLocalVariant(TRAINING_BASE)).toBe(TRAINING_BASE)
    expect(homeHubTrainingSrcSet(TRAINING_BASE)).toBeNull()
    expect(homeHubTrainingSrcSet(TRAINING_MOBILE)).toBeNull()
    const set = homeHubTrainingSrcSet(TRAINING_BASE)
    expect(set ?? '').not.toContain(TRAINING_MOBILE)
  })

  it('does not select an unproven same-name sibling just because the file exists', () => {
    const proven: Readonly<Record<string, SameOriginalMobileVariant>> = {}
    const exists = (url: string) => url === TRAINING_MOBILE || url === TRAINING_BASE
    expect(selectProvenMobileHubVariant(TRAINING_BASE, proven, exists)).toBe(TRAINING_BASE)
    expect(selectProvenMobileHubVariant('/images/home-hub/base/overseas.webp', proven, () => true)).toBe(
      '/images/home-hub/base/overseas.webp',
    )
    expect(selectProvenMobileHubVariant('/images/home-hub/base/training.jpg', proven, () => true)).toBe(
      '/images/home-hub/base/training.jpg',
    )
    expect(selectProvenTrainingSrcSet(TRAINING_BASE, proven, exists)).toBeNull()
    expect(selectProvenTrainingSrcSet(TRAINING_MOBILE, proven, exists)).toBeNull()
    expect(selectProvenTrainingSrcSet('/images/home-hub/base/overseas.webp', proven, exists)).toBeNull()
  })

  it('selects a responsive url only for a recorded same-original derivative', () => {
    const derivative = '/images/home-hub/mobile/training-same.webp'
    const proven = {
      [TRAINING_BASE]: { url: derivative, width: 800 },
    }
    const exists = (url: string) => url === derivative || url === TRAINING_BASE
    expect(selectProvenMobileHubVariant(TRAINING_BASE, proven, exists)).toBe(derivative)
    expect(selectProvenTrainingSrcSet(TRAINING_BASE, proven, exists)).toBe(
      `${derivative} 800w, ${TRAINING_BASE} 1600w`,
    )
    expect(selectProvenTrainingSrcSet(TRAINING_MOBILE, proven, exists)).toBeNull()
    expect(selectProvenMobileHubVariant(TRAINING_BASE, proven, () => false)).toBe(TRAINING_BASE)
    expect(selectProvenTrainingSrcSet(TRAINING_BASE, proven, () => false)).toBeNull()
    expect(
      selectProvenTrainingSrcSet(TRAINING_BASE, { [TRAINING_BASE]: { url: derivative, width: 1600 } }, exists),
    ).toBeNull()
  })

  it('leaves remote ncloud urls and unrelated local paths unchanged', () => {
    const ncloud = 'https://kr.object.ncloudstorage.com/bongtour/places/unknown/unknown-pexels-38932251-detail1920.webp'
    expect(preferMobileHubLocalVariant(ncloud)).toBe(ncloud)
    expect(selectProvenMobileHubVariant(ncloud, { [ncloud]: { url: TRAINING_MOBILE, width: 100 } }, () => true)).toBe(
      ncloud,
    )
    expect(preferMobileHubLocalVariant('/images/home-hub/base/overseas.webp')).toBe(
      '/images/home-hub/base/overseas.webp',
    )
    expect(preferMobileHubLocalVariant('/images/home-hub/base/training.jpg')).toBe(
      '/images/home-hub/base/training.jpg',
    )
    expect(preferMobileHubLocalVariant(TRAINING_MOBILE)).toBe(TRAINING_MOBILE)
    expect(homeHubTrainingSrcSet('/images/home-hub/base/overseas.webp')).toBeNull()
    expect(pexelsResponsiveSrcSet(ncloud)).toBeNull()
  })

  it('builds pexels srcset up to the authored width', () => {
    const src = 'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=1200'
    const set = pexelsResponsiveSrcSet(src)
    expect(set).toContain('w=480')
    expect(set).toContain('480w')
    expect(set).toContain('w=768')
    expect(set).toContain('w=1200')
    expect(set).not.toContain('w=1600')
    expect(pexelsResponsiveSrcSet('https://kr.object.ncloudstorage.com/bongtour/a.webp')).toBeNull()
  })
})
