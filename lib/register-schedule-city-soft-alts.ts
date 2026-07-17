/**
 * 도시 단독일·ICE 이동일 — route에 도시만 있어도 허용할 soft-alt 랜드마크.
 * REGRESSION-FREEZE[register-schedule-forbidden-city-route-evidence]: city soft-alt trip SSOT — manifest
 * REGRESSION-FREEZE[lottetour-schedule-expression]: 베를린 단독일 Brandenburg 중복 시 alt — manifest
 */
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

const CITY_SOFT_ALT_RULES: ReadonlyArray<{ cityRe: RegExp; alts: readonly string[] }> = [
  {
    cityRe: /베를린|Berlin/i,
    alts: [
      'Altes Museum Berlin',
      'Reichstag Building Berlin',
      'Checkpoint Charlie Berlin',
      'East Side Gallery Berlin',
      'Charlottenburg Palace Berlin',
      'Brandenburg Gate Berlin',
    ],
  },
  {
    cityRe: /로마|Rome|\bRoma\b/i,
    alts: [
      'Colosseum Rome amphitheater',
      'Trevi Fountain Rome',
      "St Peter's Basilica Vatican",
      'Spanish Steps Rome',
      'Pantheon Rome',
    ],
  },
  {
    cityRe: /베니스|Venice|Venezia/i,
    alts: [
      'Venice Grand Canal gondolas',
      "St Mark's Basilica Venice",
      "Doge's Palace Venice",
      'Rialto Bridge Venice',
    ],
  },
  {
    cityRe: /밀라노|Milan|Milano/i,
    alts: [
      'Milan Cathedral Duomo square',
      'Galleria Vittorio Emanuele Milan',
      'Sforza Castle Milan',
    ],
  },
  {
    cityRe: /런던|London/i,
    alts: [
      'Tower Bridge London Thames',
      'Big Ben London',
      'British Museum London',
      'Buckingham Palace London',
    ],
  },
]

/** route/title hay에 도시가 있으면 soft-alt 영문 키워드 목록 */
export function collectRegisterScheduleCitySoftAltKeywords(hay: string): string[] {
  const h = String(hay ?? '')
  if (!h.trim()) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const { cityRe, alts } of CITY_SOFT_ALT_RULES) {
    if (!cityRe.test(h)) continue
    for (const en of alts) {
      const nk = normScheduleImageKeywordKey(en)
      if (!nk || seen.has(nk)) continue
      seen.add(nk)
      out.push(en)
    }
  }
  return out
}

/** trip route SSOT keywordKeys에 soft-alt finalize 키 추가 */
export function appendRegisterScheduleCitySoftAltKeywordKeys(
  hay: string,
  keywordKeys: Set<string>,
): void {
  for (const en of collectRegisterScheduleCitySoftAltKeywords(hay)) {
    const nk = normScheduleImageKeywordKey(en)
    if (nk) keywordKeys.add(nk)
    try {
      const fin = normScheduleImageKeywordKey(finalizeScheduleImageKeyword(en))
      if (fin) keywordKeys.add(fin)
    } catch {
      /* keep */
    }
  }
}
