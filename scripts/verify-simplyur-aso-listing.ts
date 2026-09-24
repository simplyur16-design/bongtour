/**
 * REGRESSION-FREEZE[simplyur-aso-listing]: store listing char limits + locale SSOT — manifest
 *
 * Validates apps/simplyur-mobile/store-listing/aso/listing.json against
 * App Store / Play Console field limits used for ASO.
 *
 *   npm run verify:simplyur-aso-listing
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const LISTING_PATH = join(ROOT, 'apps/simplyur-mobile/store-listing/aso/listing.json')

type LocaleListing = {
  title: string
  iosSubtitle: string
  iosKeywords: string
  iosPromo: string
  playShort: string
  description: string
  whatsNew: string
  screenshotCaptions?: string[]
}

type ListingDoc = {
  version: number
  product: string
  bundleId: string
  limits: {
    title: number
    iosSubtitle: number
    iosKeywords: number
    iosPromo: number
    playShort: number
    description: number
    playWhatsNew: number
    iosWhatsNew: number
  }
  locales: Record<string, LocaleListing>
  homeScreenName: string
  privacyPolicyUrl: string
}

function len(s: string): number {
  return Array.from(String(s ?? '')).length
}

function fail(msg: string): never {
  console.error(`[simplyur-aso] FAIL: ${msg}`)
  process.exit(1)
}

function assertMax(label: string, value: string, max: number) {
  const n = len(value)
  if (n > max) fail(`${label} length ${n} > ${max}: ${JSON.stringify(value.slice(0, 48))}`)
  if (!String(value).trim()) fail(`${label} is empty`)
}

function assertIosKeywords(locale: string, keywords: string, title: string, subtitle: string) {
  if (/\s/.test(keywords)) fail(`${locale} iosKeywords must not contain spaces (use commas only)`)
  if (keywords.includes(',,')) fail(`${locale} iosKeywords has empty token`)
  const banned = new Set(
    [...title.toLowerCase().split(/[^a-z0-9가-힣ぁ-んァ-ン一-龥]+/u), ...subtitle.toLowerCase().split(/[^a-z0-9가-힣ぁ-んァ-ン一-龥]+/u)]
      .map((t) => t.trim())
      .filter((t) => t.length >= 2),
  )
  for (const raw of keywords.split(',')) {
    const t = raw.trim().toLowerCase()
    if (!t) fail(`${locale} iosKeywords empty token`)
    if (banned.has(t)) {
      fail(`${locale} iosKeywords repeats title/subtitle token: ${t}`)
    }
  }
}

function main() {
  const raw = readFileSync(LISTING_PATH, 'utf8')
  // REGRESSION-FREEZE[simplyur-aso-listing]: store listing char limits + locale SSOT — manifest
  const doc = JSON.parse(raw) as ListingDoc
  if (doc.product !== 'simplyur') fail('product must be simplyur')
  if (doc.bundleId !== 'com.bongtour.simplyur') fail('bundleId must be com.bongtour.simplyur')
  if (doc.homeScreenName !== 'simplyur') fail('homeScreenName must stay brand-only simplyur')
  if (!String(doc.privacyPolicyUrl).includes('bongtour.com/simplyur')) {
    fail('privacyPolicyUrl must be bongtour.com/simplyur…')
  }
  if (/bongtong\.com/i.test(raw)) fail('bongtong.com typo forbidden')

  const required = ['en-US', 'ja', 'zh-CN', 'zh-TW', 'vi']
  for (const key of required) {
    if (!doc.locales[key]) fail(`missing locale ${key}`)
  }

  const L = doc.limits
  for (const [key, loc] of Object.entries(doc.locales)) {
    assertMax(`${key}.title`, loc.title, L.title)
    assertMax(`${key}.iosSubtitle`, loc.iosSubtitle, L.iosSubtitle)
    assertMax(`${key}.iosKeywords`, loc.iosKeywords, L.iosKeywords)
    assertMax(`${key}.iosPromo`, loc.iosPromo, L.iosPromo)
    assertMax(`${key}.playShort`, loc.playShort, L.playShort)
    assertMax(`${key}.description`, loc.description, L.description)
    assertMax(`${key}.whatsNew`, loc.whatsNew, Math.min(L.playWhatsNew, L.iosWhatsNew))
    if (!/korea|한국|韓國|hàn quốc|esim/i.test(loc.title)) {
      fail(`${key}.title must include Korea/eSIM intent`)
    }
    if (!/visitor|visit|tourist|訪韓|赴韩|赴韓|khách|여행|游客|旅客/i.test(loc.description)) {
      fail(`${key}.description must state visitor audience`)
    }
    if (/주민|resident|在住|cư dân/i.test(loc.description) === false && key === 'en-US') {
      // en must exclude residents explicitly
      if (!/not for people who live in Korea|not for.*residents/i.test(loc.description)) {
        fail(`${key}.description must exclude Korea residents`)
      }
    }
    assertIosKeywords(key, loc.iosKeywords, loc.title, loc.iosSubtitle)
    if (!Array.isArray(loc.screenshotCaptions) || loc.screenshotCaptions.length < 3) {
      fail(`${key}.screenshotCaptions needs ≥3 captions`)
    }
  }

  const report = Object.fromEntries(
    Object.entries(doc.locales).map(([k, loc]) => [
      k,
      {
        title: len(loc.title),
        iosSubtitle: len(loc.iosSubtitle),
        iosKeywords: len(loc.iosKeywords),
        playShort: len(loc.playShort),
        description: len(loc.description),
      },
    ]),
  )
  console.log('[simplyur-aso] OK', JSON.stringify({ locales: Object.keys(doc.locales).length, report }, null, 2))
}

main()
