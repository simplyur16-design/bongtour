/**
 * 트리 다도시·클러스터 leaf → 마스터 cityKey 목록 (시드·등록 태그 SSOT).
 * @see scripts/seed-master-data.ts
 */
export type ClusterCityRow = { cityKey: string; koreanLabel: string; isMajor?: boolean }

export const CLUSTER_CITY_EXPANSIONS: Record<string, ClusterCityRow[]> = {
  shandong: [
    { cityKey: 'qingdao', koreanLabel: '칭다오', isMajor: true },
    { cityKey: 'yantai', koreanLabel: '연태', isMajor: true },
    { cityKey: 'jinan', koreanLabel: '제남', isMajor: true },
    { cityKey: 'weihai', koreanLabel: '위해', isMajor: true },
  ],
  'phuket-krabi-khaolak': [
    { cityKey: 'phuket', koreanLabel: '푸켓', isMajor: true },
    { cityKey: 'krabi', koreanLabel: '끄라비', isMajor: true },
    { cityKey: 'khaolak', koreanLabel: '카오락', isMajor: false },
  ],
  'chiangmai-chiangrai': [
    { cityKey: 'chiangmai', koreanLabel: '치앙마이', isMajor: true },
    { cityKey: 'chiangrai', koreanLabel: '치앙라이', isMajor: false },
  ],
  'hanoi-halong': [
    { cityKey: 'hanoi', koreanLabel: '하노이', isMajor: true },
    { cityKey: 'halong', koreanLabel: '하롱', isMajor: true },
  ],
  'hue-donghoi': [
    { cityKey: 'hue', koreanLabel: '후에', isMajor: false },
    { cityKey: 'donghoi', koreanLabel: '동허이', isMajor: false },
  ],
  'shizuoka-izu': [
    { cityKey: 'shizuoka', koreanLabel: '시즈오카', isMajor: false },
    { cityKey: 'izu', koreanLabel: '이즈', isMajor: false },
  ],
  'hakone-fuji': [
    { cityKey: 'hakone', koreanLabel: '하코네', isMajor: true },
    { cityKey: 'fuji', koreanLabel: '후지산', isMajor: true },
  ],
  'yokohama-kamakura': [
    { cityKey: 'yokohama', koreanLabel: '요코하마', isMajor: true },
    { cityKey: 'kamakura', koreanLabel: '가마쿠라', isMajor: false },
    { cityKey: 'yamanashi', koreanLabel: '야마나시', isMajor: false },
  ],
  'beppu-yufuin': [
    { cityKey: 'beppu', koreanLabel: '벳부', isMajor: false },
    { cityKey: 'yufuin', koreanLabel: '유후인', isMajor: false },
  ],
  'kumamoto-nagasaki': [
    { cityKey: 'kumamoto', koreanLabel: '구마모토', isMajor: false },
    { cityKey: 'nagasaki', koreanLabel: '나가사키', isMajor: false },
  ],
  'kagoshima-miyazaki': [
    { cityKey: 'kagoshima', koreanLabel: '가고시마', isMajor: false },
    { cityKey: 'miyazaki', koreanLabel: '미야자키', isMajor: false },
  ],
  'kitakyushu-yamaguchi': [
    { cityKey: 'kitakyushu', koreanLabel: '기타큐슈', isMajor: false },
    { cityKey: 'yamaguchi', koreanLabel: '야마구치', isMajor: false },
  ],
  'furano-biei': [
    { cityKey: 'furano', koreanLabel: '후라노', isMajor: true },
    { cityKey: 'biei', koreanLabel: '비에이', isMajor: true },
  ],
  'toya-jozankei': [
    { cityKey: 'toya', koreanLabel: '도야', isMajor: false },
    { cityKey: 'jozankei', koreanLabel: '죠잔케이', isMajor: false },
  ],
  'wakayama-shirahama': [
    { cityKey: 'wakayama', koreanLabel: '와카야마', isMajor: false },
    { cityKey: 'shirahama', koreanLabel: '시라하마', isMajor: false },
  ],
  'takamatsu-naoshima': [
    { cityKey: 'takamatsu', koreanLabel: '다카마츠', isMajor: false },
    { cityKey: 'naoshima', koreanLabel: '나오시마', isMajor: false },
  ],
  'akita-sendai': [
    { cityKey: 'akita', koreanLabel: '아키타', isMajor: false },
    { cityKey: 'sendai', koreanLabel: '센다이', isMajor: true },
  ],
  'beijing-tianjin': [
    { cityKey: 'beijing', koreanLabel: '북경', isMajor: true },
    { cityKey: 'tianjin', koreanLabel: '천진', isMajor: true },
  ],
  sichuan: [
    { cityKey: 'chengdu', koreanLabel: '성도', isMajor: true },
    { cityKey: 'jiuzhaigou', koreanLabel: '구채구', isMajor: true },
    { cityKey: 'chongqing', koreanLabel: '충칭', isMajor: true },
  ],
  yunnan: [
    { cityKey: 'kunming', koreanLabel: '곤명', isMajor: true },
    { cityKey: 'lijiang', koreanLabel: '여강', isMajor: true },
  ],
  'dalian-harbin': [
    { cityKey: 'dalian', koreanLabel: '대련', isMajor: true },
    { cityKey: 'harbin', koreanLabel: '하얼빈', isMajor: true },
  ],
  'xian-urumqi': [
    { cityKey: 'xian', koreanLabel: '서안', isMajor: true },
    { cityKey: 'urumqi', koreanLabel: '우루무치', isMajor: false },
  ],
  'wuhan-yichang': [
    { cityKey: 'wuhan', koreanLabel: '무한', isMajor: true },
    { cityKey: 'yichang', koreanLabel: '은시', isMajor: false },
  ],
  changbai: [
    { cityKey: 'changbai-mountain', koreanLabel: '백두산', isMajor: true },
    { cityKey: 'yanji', koreanLabel: '연길', isMajor: false },
    { cityKey: 'shenyang', koreanLabel: '심양', isMajor: true },
    { cityKey: 'changchun', koreanLabel: '장춘', isMajor: false },
  ],
  'dallas-houston': [
    { cityKey: 'dallas', koreanLabel: '댈러스', isMajor: true },
    { cityKey: 'houston', koreanLabel: '휴스턴', isMajor: true },
    { cityKey: 'new-orleans', koreanLabel: '뉴올리언스', isMajor: false },
  ],
  'orlando-miami': [
    { cityKey: 'orlando', koreanLabel: '올랜도', isMajor: true },
    { cityKey: 'miami', koreanLabel: '마이애미', isMajor: true },
  ],
  'cuba-mexico': [
    { cityKey: 'cancun', koreanLabel: '칸쿤', isMajor: true },
    { cityKey: 'mexico-city', koreanLabel: '멕시코시티', isMajor: true },
  ],
  quebec: [
    { cityKey: 'quebec-city', koreanLabel: '퀘벡시티', isMajor: false },
    { cityKey: 'montreal', koreanLabel: '몬트리올', isMajor: true },
  ],
  'kanazawa-komatsu': [
    { cityKey: 'kanazawa', koreanLabel: '가나자와', isMajor: true },
    { cityKey: 'komatsu', koreanLabel: '고마츠', isMajor: false },
  ],
  'toyama-alpen': [
    { cityKey: 'toyama', koreanLabel: '도야마', isMajor: false },
    { cityKey: 'alpen-route', koreanLabel: '알펜루트', isMajor: false },
  ],
  baltic3: [
    { cityKey: 'vilnius', koreanLabel: '빌니우스', isMajor: false },
    { cityKey: 'tallinn', koreanLabel: '탈린', isMajor: true },
    { cityKey: 'riga', koreanLabel: '리가', isMajor: false },
  ],
}

export const CLUSTER_CITY_EXPANSION_NODE_KEYS = new Set(Object.keys(CLUSTER_CITY_EXPANSIONS))

export function clusterCityKeysForNode(nodeKey: string | null | undefined): string[] {
  const k = (nodeKey ?? '').trim()
  if (!k) return []
  return (CLUSTER_CITY_EXPANSIONS[k] ?? []).map((r) => r.cityKey)
}

export function isClusterExpansionNode(nodeKey: string | null | undefined): boolean {
  return CLUSTER_CITY_EXPANSION_NODE_KEYS.has((nodeKey ?? '').trim())
}
