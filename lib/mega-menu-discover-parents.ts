/**
 * 공급사 GNB 메가메뉴 클릭용 parent 펼침 SSOT.
 * UI leaf는 `mega-menu-regions.data.ts`만. 여기 값은 공급사 사이트 상단 메뉴
 * (`유럽`·`동남아`·`일본` …) 펼침용 — browse leaf로 쓰지 않음.
 *
 * REGRESSION-FREEZE[mega-menu-discover-parents]: 공급사 GNB parent = 그룹·탭 줄기 — manifest
 */
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'

/** 우리 탭 id → 공급사 사이트에서 흔한 상위 메뉴 표기 (UI 탭 라벨과 다름) */
const TAB_SUPPLIER_GNB_STEMS: Record<string, readonly string[]> = {
  'europe-me': ['유럽', '중동', '아프리카'],
  'southeast-asia': ['동남아', '동남아시아', '대만', '서남아'],
  japan: ['일본'],
  'china-hk-mo': ['중국', '홍콩', '마카오', '몽골'],
  oceania: ['오세아니아', '괌', '사이판', '호주', '뉴질랜드'],
  americas: ['미주', '미국', '캐나다', '하와이'],
  'south-america': ['중남미', '남미'],
}

/** LC 수도·관용 도시 — city leaf 없이 국가 leaf로 클릭할 때 parent 보조 */
const SOFT_CITY_TO_COUNTRY_LEAF: Record<string, string> = {
  파리: '프랑스',
  니스: '프랑스',
  보르도: '프랑스',
  시드니: '호주/뉴질랜드',
  멜버른: '호주/뉴질랜드',
  오클랜드: '호주/뉴질랜드',
  코펜하겐: '덴마크',
  오슬로: '노르웨이',
  베르겐: '노르웨이',
  스톡홀름: '스웨덴',
  헬싱키: '핀란드',
  레이캬비크: '아이슬란드',
  탈린: '에스토니아',
  리가: '라트비아',
  빌뉴스: '리투아니아',
  바르셀로나: '스페인',
  마드리드: '스페인',
  리스본: '포르투갈',
  런던: '영국',
  로마: '이탈리아',
  밀라노: '이탈리아',
}

function stemsForGroup(tabId: string, groupLabel: string): string[] {
  const all = TAB_SUPPLIER_GNB_STEMS[tabId] ?? []
  if (tabId === 'europe-me') {
    if (/중동|걸프|아랍|이스라엘|요르단|오만|두바이|카타르|튀르키예|터키/.test(groupLabel)) {
      return ['중동', '유럽']
    }
    if (/아프리카|모로코|이집트|케냐|남아공|탄자니아|에티오피아|튀니지/.test(groupLabel)) {
      return ['아프리카', '유럽']
    }
    return ['유럽']
  }
  if (tabId === 'southeast-asia') {
    if (/대만/.test(groupLabel)) return ['대만', '동남아', '동남아시아']
    if (/인도|스리랑카|네팔|부탄|몰디브|서남아/.test(groupLabel)) {
      return ['서남아', '동남아', '동남아시아']
    }
    return ['동남아', '동남아시아']
  }
  if (tabId === 'americas') {
    if (/하와이/.test(groupLabel)) return ['하와이', '미주', '미국']
    if (/캐나다/.test(groupLabel)) return ['캐나다', '미주']
    if (/알래스카/.test(groupLabel)) return ['미주', '미국']
    return ['미주', '미국']
  }
  if (tabId === 'oceania') {
    if (/괌/.test(groupLabel)) return ['괌', '오세아니아']
    if (/사이판/.test(groupLabel)) return ['사이판', '오세아니아']
    return ['호주', '뉴질랜드', '오세아니아']
  }
  if (tabId === 'china-hk-mo') {
    if (/홍콩/.test(groupLabel)) return ['홍콩', '중국']
    if (/마카오/.test(groupLabel)) return ['마카오', '중국']
    if (/몽골/.test(groupLabel)) return ['몽골', '중국']
    return ['중국']
  }
  return [...all]
}

function uniqParents(items: string[], leafLabel: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const p = String(raw || '').trim()
    if (!p || p === leafLabel || seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

/**
 * leaf 한글 라벨 → 공급사 GNB에서 먼저 눌러 펼칠 parent 후보 (가까운 그룹 우선).
 */
export function buildMegaMenuDiscoverParentsMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {}

  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture || tab.id === 'sports_theme') continue
    for (const g of tab.groups) {
      const stems = stemsForGroup(tab.id, g.countryLabel)
      for (const leaf of g.cities) {
        const parents = uniqParents([g.countryLabel, ...stems], leaf.label)
        const prev = map[leaf.label]
        if (!prev || parents.length > prev.length) map[leaf.label] = parents
      }
    }
  }

  for (const [soft, country] of Object.entries(SOFT_CITY_TO_COUNTRY_LEAF)) {
    const base = map[country] ?? []
    map[soft] = uniqParents([country, ...base], soft)
  }

  return map
}

let cached: Record<string, string[]> | null = null

export function megaMenuDiscoverParentsForLabel(label: string): string[] {
  if (!cached) cached = buildMegaMenuDiscoverParentsMap()
  const key = String(label || '').trim()
  if (!key) return []
  return cached[key] ?? []
}

/** 테스트·생성기용 — 캐시 초기화 */
export function resetMegaMenuDiscoverParentsCache(): void {
  cached = null
}
