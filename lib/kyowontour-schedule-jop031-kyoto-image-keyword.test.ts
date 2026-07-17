/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 교토·오사카 Kansai POI — Day2/3 dup·Day4 Arashiyama bleed — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: JOP031 Kyoto dual-slot — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'

const JOP031_ROWS = [
  {
    day: 1,
    title: '아라시야마 이동',
    description: '',
    routeText:
      '아라시야마 이동 - 도게츠교 - 치쿠린 - 노노미야 신사 - 니시키 재래시장 - 우메코지 카덴쇼 료칸 - 교토 우메코지 카덴쇼 천연온천욕',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 2,
    title: '기요미즈데라',
    description: '',
    routeText:
      '기요미즈데라 - 니넨자카, 산넨자카 - 오하라 이동 - 호센인 - 오쓰 이동 - 비와호대교 - 나가하마 이동',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 3,
    title: '오미하치만 이동',
    description: '',
    routeText:
      '오미하치만 이동 - 하치만야마 로프웨이 - 하치만보리 운하 - 라코리나 오미하치만 - 오사카 이동 - 도톤보리, 신사이바시',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 4,
    title: '일본관광면세점',
    description: '',
    routeText: '일본관광면세점 - 고베 국제공항 이동',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
]

describe('kyowontour JOP031 Kyoto imageKeyword quality', () => {
  it('maps Kansai landmarks — not Doge/Fuji; no Day2/3 self-dup; Day4 ≠ Arashiyama', () => {
    expect(firstMatchingScheduleSpotEn('기요미즈데라')).toMatch(/Kiyomizu/i)
    expect(firstMatchingScheduleSpotEn('니넨자카')).toMatch(/Ninen|Sannen|Higashiyama/i)
    expect(firstMatchingScheduleSpotEn('니시키 재래시장')).toMatch(/Nishiki/i)
    expect(firstMatchingScheduleSpotEn('신사이바시')).toMatch(/Shinsaibashi/i)
    expect(firstMatchingScheduleSpotEn('하치만보리')).toMatch(/Hachiman|canal|Omihachiman/i)
    expect(firstMatchingScheduleSpotEn('도게츠교')).not.toMatch(/Doge/i)

    const out = applyRegisterScheduleImageKeywordsBySupplier(JOP031_ROWS, {
      supplierKey: 'kyowontour',
      productDestination: '교토',
      productTitle: '●대한항공● 교토 4일 [프라임]',
    })

    const pairs = out.map((r) => [String(r.imageKeyword ?? ''), String(r.imageKeyword2 ?? '')] as const)
    for (const [a, b] of pairs) {
      if (a && b) {
        expect(a.replace(/\s+/g, '').toLowerCase()).not.toBe(b.replace(/\s+/g, '').toLowerCase())
      }
    }

    expect(pairs[0]![0]).toMatch(/Togetsu|Arashiyama|Bamboo|Nishiki|Nonomiya/i)
    expect(pairs[0]!.join(' ')).not.toMatch(/Doge|Mount\s*Fuji/i)
    expect(pairs[0]![1] || pairs[0]![0]).toMatch(/Togetsu|Arashiyama|Bamboo|Nishiki|Nonomiya/i)

    expect(pairs[1]!.join(' ')).toMatch(/Kiyomizu|Ninen|Sannen|Hosen|Biwa|Ohara/i)
    expect(pairs[1]![0]).toBeTruthy()
    expect(pairs[1]![1]).toBeTruthy()
    expect(pairs[1]![1]).not.toMatch(new RegExp(`^${pairs[1]![0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))

    expect(pairs[2]!.join(' ')).toMatch(/Dotonbori|Hachiman|Omihachiman|Shinsaibashi|canal/i)
    expect(pairs[2]![0]).toBeTruthy()
    expect(pairs[2]![1]).toBeTruthy()

    expect(pairs[3]!.join(' ')).not.toMatch(/Arashiyama|Bamboo|Togetsu|Shinsaibashi|Dotonbori/i)
    expect(pairs[3]!.join(' ')).not.toMatch(/Mount\s*Fuji/i)
    if (pairs[3]![0]) {
      expect(pairs[3]![0]).toMatch(/Kyoto|Osaka|Kobe/i)
    }
  })
})
