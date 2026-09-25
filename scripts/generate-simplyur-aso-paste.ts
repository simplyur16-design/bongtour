/**
 * Expand listing.json → plain-text paste packs for Play / App Store Connect.
 *
 *   npx tsx scripts/generate-simplyur-aso-paste.ts
 *
 * Output: apps/simplyur-mobile/store-listing/aso/paste/
 * Also mirrors to Desktop/simplyur-store-paste/ when writable.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const ASO = join(ROOT, 'apps/simplyur-mobile/store-listing/aso')
const OUT = join(ASO, 'paste')
const DESKTOP = join('C:/Users/USER/Desktop/simplyur-store-paste')

type Loc = {
  storeLocale: { play: string; ios: string }
  title: string
  iosSubtitle: string
  iosKeywords: string
  iosPromo: string
  playShort: string
  description: string
  whatsNew: string
  screenshotCaptions: string[]
}

type Doc = {
  contactEmail: string
  privacyPolicyUrl: string
  category: { play: string; iosPrimary: string; iosSecondary: string }
  locales: Record<string, Loc>
}

function writeBoth(name: string, body: string) {
  // UTF-8 BOM so Windows Notepad / Play Console paste keep punctuation
  const withBom = '\uFEFF' + body
  writeFileSync(join(OUT, name), withBom, 'utf8')
  try {
    mkdirSync(DESKTOP, { recursive: true })
    writeFileSync(join(DESKTOP, name), withBom, 'utf8')
  } catch {
    /* Desktop mirror optional */
  }
}

function playPack(key: string, loc: Loc, meta: Doc): string {
  const play = loc.storeLocale.play
  return [
    `PLAY ${play} — paste EACH block separately (do not paste this whole file into one field)`,
    ``,
    `App name`,
    loc.title,
    ``,
    `Short description`,
    loc.playShort,
    ``,
    `Full description`,
    loc.description,
    ``,
    `What's new`,
    loc.whatsNew,
    ``,
    `Category: ${meta.category.play}`,
    `Email: ${meta.contactEmail}`,
    `Privacy: ${meta.privacyPolicyUrl}`,
    ``,
    `Screenshot captions:`,
    ...loc.screenshotCaptions.map((c, i) => `${i + 1}. ${c}`),
    ``,
  ].join('\n')
}

function iosPack(key: string, loc: Loc, meta: Doc): string {
  const ios = loc.storeLocale.ios
  return [
    `IOS ${ios} — paste EACH block separately (do not paste this whole file into one field)`,
    ``,
    `Name`,
    loc.title,
    ``,
    `Subtitle`,
    loc.iosSubtitle,
    ``,
    `Keywords`,
    loc.iosKeywords,
    ``,
    `Promotional Text`,
    loc.iosPromo,
    ``,
    `Description`,
    loc.description,
    ``,
    `What's New`,
    loc.whatsNew,
    ``,
    `Category: ${meta.category.iosPrimary} / ${meta.category.iosSecondary}`,
    `Privacy: ${meta.privacyPolicyUrl}`,
    ``,
    `Screenshot captions:`,
    ...loc.screenshotCaptions.map((c, i) => `${i + 1}. ${c}`),
    ``,
  ].join('\n')
}

function fieldOnly(label: string, value: string): string {
  return value.endsWith('\n') ? value : value + '\n'
}

function main() {
  const doc = JSON.parse(readFileSync(join(ASO, 'listing.json'), 'utf8')) as Doc
  mkdirSync(OUT, { recursive: true })

  const index: string[] = [
    `simplyur — store paste pack (generated from listing.json)`,
    ``,
    `Desktop copy: C:\\Users\\USER\\Desktop\\simplyur-store-paste\\`,
    `Repo copy: apps/simplyur-mobile/store-listing/aso/paste/`,
    ``,
    `How to use: open the locale file, copy the block under each --- Field --- header, paste into the console.`,
    ``,
    `Play graphics:`,
    `  apps/simplyur-mobile/store-listing/play-icon-512.png`,
    `  apps/simplyur-mobile/store-listing/play-feature-1024x500.png`,
    ``,
    `AAB:`,
    `  C:\\Users\\USER\\Desktop\\BONGTOUR\\simplyur-1.0.0-12-local.aab`,
    ``,
    `Files:`,
  ]

  for (const [key, loc] of Object.entries(doc.locales)) {
    const playName = `PLAY-${loc.storeLocale.play}.txt`
    const iosName = `IOS-${loc.storeLocale.ios}.txt`
    writeBoth(playName, playPack(key, loc, doc))
    writeBoth(iosName, iosPack(key, loc, doc))

    // bare field files for one-click select-all (Play default en-US first)
    const bareDir = `fields-${key}`
    mkdirSync(join(OUT, bareDir), { recursive: true })
    try {
      mkdirSync(join(DESKTOP, bareDir), { recursive: true })
    } catch {
      /* optional */
    }
    const bare = {
      '01-title.txt': loc.title,
      '02-play-short.txt': loc.playShort,
      '03-ios-subtitle.txt': loc.iosSubtitle,
      '04-ios-keywords.txt': loc.iosKeywords,
      '05-ios-promo.txt': loc.iosPromo,
      '06-description.txt': loc.description,
      '07-whats-new.txt': loc.whatsNew,
    }
    for (const [fn, val] of Object.entries(bare)) {
      const body = '\uFEFF' + fieldOnly(fn, val)
      writeFileSync(join(OUT, bareDir, fn), body, 'utf8')
      try {
        writeFileSync(join(DESKTOP, bareDir, fn), body, 'utf8')
      } catch {
        /* optional */
      }
    }

    index.push(`  ${playName}`)
    index.push(`  ${iosName}`)
    index.push(`  ${bareDir}/  (single-field files)`)
  }

  writeBoth('00-README.txt', index.join('\n') + '\n')
  console.log(`OK paste pack → ${OUT}`)
  if (existsSync(DESKTOP)) console.log(`OK desktop → ${DESKTOP}`)
}

main()
