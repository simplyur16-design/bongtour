/**
 * 해외 상단 메가메뉴 — 탭·열·도시 SSOT (운영 스펙 단일 원본).
 * browse `country`/`city` 슬러그는 `browseCountryLabel`·`label` 기준으로 `location-url-slugs`와 맞춘다.
 */
import { SPORTS_THEME_TAG_LABELS, SPORTS_THEME_TAG_VALUES } from '@/lib/product-listing-kind'

export type MegaMenuLeafKind = 'country' | 'city'

/** `LC()` / `city()` 로만 생성 — raw 리터럴 금지(내부 brand 필수) */
const MEGA_MENU_LEAF_DEF_BRAND = '__megaMenuLeafDef' as const

export type MegaMenuLeafDef = {
  readonly __megaMenuLeafDefBrand: typeof MEGA_MENU_LEAF_DEF_BRAND
  label: string
  terms: string[]
  /** browse URL `country` — 기본은 `label`과 동일 */
  browseCountryLabel?: string
  /** `country` = 국가 단위 링크(city 쿼리 없음) */
  kind: MegaMenuLeafKind
}

export type MegaMenuCountryGroupDef = {
  countryLabel: string
  cities: MegaMenuLeafDef[]
  nonLinkHeader?: boolean
  /** 그룹 헤더·소속 city URL의 browse `country` — 현·도 그룹(일본·중국)에만 */
  headerBrowseCountryLabel?: string
}

export type MegaMenuTabDef = {
  id: string
  label: string
  groups: MegaMenuCountryGroupDef[]
  /** 지방출발 단일 링크 탭 마커. 설정되면 도시/국가 펼침 없이 `/travel/overseas?region={id}` 로 즉시 이동. */
  localDeparture?: 'busan' | 'cheongju' | 'daegu'
}

function makeMegaMenuLeaf(
  kind: MegaMenuLeafKind,
  label: string,
  terms: string[],
  browseCountryLabel?: string,
): MegaMenuLeafDef {
  const t = [...new Set(terms.map((x) => x.trim()).filter(Boolean))]
  return {
    __megaMenuLeafDefBrand: MEGA_MENU_LEAF_DEF_BRAND,
    label,
    terms: t.length ? t : [label],
    browseCountryLabel: browseCountryLabel ?? label,
    kind,
  }
}

/** 도시 leaf — browse URL에 `city` 포함 */
export function city(label: string, terms: string[], browseCountryLabel?: string): MegaMenuLeafDef {
  return makeMegaMenuLeaf('city', label, terms, browseCountryLabel)
}

/** 국가 leaf — `buildProductsHrefCountryOnly` (city 쿼리 없음) */
export function LC(label: string, terms: string[], browseCountryLabel?: string): MegaMenuLeafDef {
  return makeMegaMenuLeaf('country', label, terms, browseCountryLabel)
}

function G(
  countryLabel: string,
  cities: MegaMenuLeafDef[],
  nonLinkHeader?: boolean,
  headerBrowseCountryLabel?: string,
): MegaMenuCountryGroupDef {
  return { countryLabel, cities, nonLinkHeader, headerBrowseCountryLabel }
}

/** 일본 탭 — 그룹 헤더·도시 링크 browse country = 일본 */
function GJp(countryLabel: string, cities: MegaMenuLeafDef[]): MegaMenuCountryGroupDef {
  return G(countryLabel, cities, undefined, '일본')
}

/** 중국 본토 성·도 그룹 — browse country = 중국 */
function GCn(countryLabel: string, cities: MegaMenuLeafDef[]): MegaMenuCountryGroupDef {
  return G(countryLabel, cities, undefined, '중국')
}

/** 유럽·중동·아프리카 — 서유럽 행은 국가 단위 링크 */
const EU: MegaMenuCountryGroupDef[] = [
  G(
    '서유럽',
    [
      LC('이탈리아', ['이탈리아', 'italy', '로마', '밀라노', '베네치아']),
      LC('프랑스', ['프랑스', 'france', '파리', '니스']),
      LC('스위스', ['스위스', 'switzerland', '취리히', '인터라켄']),
      LC('영국', ['영국', 'UK', '런던', 'london']),
      LC('독일', ['독일', 'germany', '베를린', '뮌헨']),
      LC('네덜란드', ['네덜란드', 'netherlands', '암스테르담']),
      LC('벨기에', ['벨기에', 'belgium', '브뤼셀']),
      LC('오스트리아', ['오스트리아', 'austria', '비엔나', '잘츠부르크']),
    ],
    true,
  ),
  G(
    '동유럽',
    [
      LC('체코', ['체코', 'czech', '프라하', 'prague']),
      LC('헝가리', ['헝가리', 'hungary', '부다페스트']),
      LC('폴란드', ['폴란드', 'poland', '바르샤바', 'warsaw']),
      LC('크로아티아', ['크로아티아', 'croatia', '두브로브니크']),
      LC('슬로베니아', ['슬로베니아', 'slovenia', '류블랴나']),
    ],
    true,
  ),
  G(
    '코카서스 3국',
    [
      LC('조지아', ['조지아', 'georgia', '트빌리시', 'tbilisi']),
      LC('아제르바이잔', ['아제르바이잔', 'azerbaijan', '바쿠', 'baku']),
      LC('아르메니아', ['아르메니아', 'armenia', '예레반', 'yerevan']),
      LC('코카서스 3국', ['코카서스', '카카서스', 'caucasus', '3국']),
    ],
    true,
  ),
  G(
    '북유럽',
    [
      LC('덴마크', ['덴마크', 'denmark', '코펜하겐']),
      LC('노르웨이', ['노르웨이', 'norway', '오슬로', '피오르']),
      LC('스웨덴', ['스웨덴', 'sweden', '스톡홀름']),
      LC('핀란드', ['핀란드', 'finland', '헬싱키']),
      LC('아이슬란드', ['아이슬란드', 'iceland', '레이캬비크']),
    ],
    true,
  ),
  G(
    '스페인/포르투갈',
    [LC('스페인', ['스페인', 'spain', '마드리드', '바르셀로나']), LC('포르투갈', ['포르투갈', 'portugal', '리스본'])],
    true,
  ),
  G(
    '그리스',
    [
      city('아테네', ['아테네', 'athens', '그리스']),
      city('산토리니', ['산토리니', 'santorini', '그리스']),
      city('미코노스', ['미코노스', 'mykonos', '그리스']),
    ],
    true,
  ),
  G(
    '튀르키예',
    [city('이스탄불', ['이스탄불', 'istanbul', '튀르키예']), city('카파도키아', ['카파도키아', 'cappadocia', '튀르키예'])],
    true,
  ),
  G(
    '이집트',
    [city('카이로', ['카이로', 'cairo', '이집트']), city('룩소르', ['룩소르', 'luxor', '이집트'])],
    true,
  ),
  G(
    '중동',
    [
      city('두바이', ['두바이', 'dubai', 'DXB']),
      city('아부다비', ['아부다비', 'abu dhabi']),
      LC('오만', ['오만', 'oman', '무스카트']),
      LC('요르단', ['요르단', 'jordan', '페트라']),
      LC('이스라엘', ['이스라엘', 'israel', '텔아비브', '예루살렘']),
    ],
    true,
  ),
  G(
    '아프리카',
    [
      LC('모로코', ['모로코', 'morocco', '마라케시']),
      LC('튀니지', ['튀니지', 'tunisia', '튀니스', 'tunis']),
      LC('남아공', ['남아공', 'south africa', '케이프타운', '요하네스버그']),
      LC('탄자니아', ['탄자니아', 'tanzania', '세렝게티', '킬리만자로']),
      LC('케냐', ['케냐', 'kenya', '나이로비', '마사이마라']),
      LC('에티오피아', ['에티오피아', 'ethiopia', '아디스아바바']),
    ],
    true,
  ),
]

const SEA: MegaMenuCountryGroupDef[] = [
  G('베트남', [
    city('다낭', ['다낭', 'danang', '베트남']),
    city('나트랑', ['나트랑', 'nha trang', '베트남']),
    city('호치민', ['호치민', 'hcm', 'saigon', '베트남']),
    city('하노이', ['하노이', 'hanoi', '베트남']),
    city('푸꾸옥', ['푸꾸옥', 'phu quoc', '베트남']),
    city('달랏', ['달랏', 'dalat', '베트남']),
  ]),
  G('태국', [
    city('방콕', ['방콕', 'bangkok', '태국', 'BKK']),
    city('푸켓', ['푸켓', 'phuket', '태국']),
    city('치앙마이', ['치앙마이', 'chiang mai', '태국']),
    city('파타야', ['파타야', 'pattaya', '태국']),
    city('끄라비', ['끄라비', 'krabi', '태국']),
    city('아유타야', ['아유타야', 'ayutthaya', '태국']),
  ]),
  G('싱가포르', [LC('싱가포르', ['싱가포르', 'singapore', 'SIN'])]),
  G('인도네시아', [
    city('발리', ['발리', 'bali', '인도네시아', 'DPS']),
    city('마나도', ['마나도', 'manado', '인도네시아']),
    city('자카르타', ['자카르타', 'jakarta', '인도네시아']),
    city('족자카르타', ['족자카르타', 'yogyakarta', '인도네시아']),
  ]),
  G('필리핀', [
    city('세부', ['세부', 'cebu', '필리핀', 'CEB']),
    city('보라카이', ['보라카이', 'boracay', '필리핀']),
    city('보홀', ['보홀', 'bohol', '필리핀']),
    city('클락', ['클락', 'clark', '필리핀']),
    city('마닐라', ['마닐라', 'manila', '필리핀', 'MNL']),
  ]),
  G('대만', [
    city('타이베이', ['타이베이', 'taipei', '대만']),
    city('가오슝', ['가오슝', 'kaohsiung', '대만']),
    city('타이중', ['타이중', 'taichung', '대만']),
    city('화롄', ['화롄', 'hualien', '대만', '타로코']),
  ]),
  // 서남아 — 4열 그리드 2행 이내 노출(패널 max-h 잘림 방지). 탭명 「동남아/대만/서남아」와 맞춤.
  G('인도', [
    LC('인도', ['인도', 'india', '북인도', '뭄바이', 'mumbai', '라다크', 'ladakh', '골든트라이앵글']),
    city('델리', ['델리', 'delhi', '인도', '북인도']),
    city('자이푸르', ['자이푸르', 'jaipur', '인도', '북인도', '골든트라이앵글']),
    city('아그라', ['아그라', 'agra', '인도', '타지마할', '북인도', '골든트라이앵글']),
    city('바라나시', ['바라나시', 'varanasi', '인도', '북인도', '갠지스']),
  ]),
  G('스리랑카', [
    city('콜롬보', ['콜롬보', 'colombo', '스리랑카']),
    city('캔디', ['캔디', 'kandy', '스리랑카']),
    city('시기리야', ['시기리야', 'sigiriya', '스리랑카']),
  ]),
  G('네팔', [city('카트만두', ['카트만두', 'kathmandu', '네팔']), city('포카라', ['포카라', 'pokhara', '네팔'])]),
  G('몰디브', [LC('몰디브', ['몰디브', 'maldives', 'male'])]),
  G('말레이시아', [
    city('코타키나발루', ['코타키나발루', 'kota kinabalu', '말레이시아']),
    city('쿠알라룸푸르', ['쿠알라룸푸르', 'kuala lumpur', '말레이시아', 'KL']),
    city('랑카위', ['랑카위', 'langkawi', '말레이시아']),
    city('페낭', ['페낭', 'penang', '말레이시아']),
  ]),
  G('캄보디아', [
    city('씨엠립', ['씨엠립', 'siem reap', '앙코르', '캄보디아']),
    city('프놈펜', ['프놈펜', 'phnom penh', '캄보디아']),
  ]),
  G('라오스', [
    city('루앙프라방', ['루앙프라방', 'luang prabang', '라오스']),
    city('비엔티안', ['비엔티안', 'vientiane', '라오스']),
  ]),
  G('미얀마', [city('양곤', ['양곤', 'yangon', '미얀마']), city('바간', ['바간', 'bagan', '미얀마'])]),
]

const JP: MegaMenuCountryGroupDef[] = [
  GJp('홋카이도', [
    city('삿포로', ['삿포로', 'sapporo', '일본', '홋카이도']),
    city('도야', ['도야', 'toya', '일본', '홋카이도']),
    city('오타루', ['오타루', 'otaru', '일본', '홋카이도']),
    city('후라노', ['후라노', 'furano', '일본', '홋카이도']),
    city('하코다테', ['하코다테', 'hakodate', '일본', '홋카이도']),
    city('니세코', ['니세코', 'niseko', '일본', '홋카이도']),
    city('아사히카와', ['아사히카와', 'asahikawa', '일본', '홋카이도']),
    city('노보리베츠', ['노보리베츠', 'noboribetsu', '일본', '홋카이도']),
  ]),
  GJp('도호쿠', [
    city('센다이', ['센다이', 'sendai', '일본', '도호쿠']),
    city('아오모리', ['아오모리', 'aomori', '일본', '도호쿠']),
    city('아키타', ['아키타', 'akita', '일본', '도호쿠']),
  ]),
  GJp('간토', [
    city('도쿄', ['도쿄', 'tokyo', '일본', '간토']),
    city('요코하마', ['요코하마', 'yokohama', '일본', '간토']),
    city('닛코', ['닛코', 'nikko', '일본', '간토']),
    city('하코네', ['하코네', 'hakone', '일본', '간토']),
    city('가마쿠라', ['가마쿠라', 'kamakura', '일본', '간토']),
    city('시즈오카', ['시즈오카', 'shizuoka', '이즈', 'izu', '아타미', 'atami', '일본', '간토']),
  ]),
  GJp('추부', [
    city('나고야', ['나고야', 'nagoya', '일본', '추부', '북알프스', 'north alps', 'northern alps']),
    city('가나자와', ['가나자와', 'kanazawa', '일본', '추부']),
    city('다카야마', ['다카야마', 'takayama', '일본', '추부']),
    city('시라카와고', ['시라카와고', 'shirakawago', '일본', '추부']),
    city('마츠모토', ['마츠모토', 'matsumoto', '일본', '추부']),
  ]),
  GJp('간사이', [
    city('오사카', ['오사카', 'osaka', '일본', '간사이']),
    city('교토', ['교토', 'kyoto', '일본', '간사이']),
    city('고베', ['고베', 'kobe', '일본', '간사이']),
    city('나라', ['나라', 'nara', '일본', '간사이']),
    city('와카야마', ['와카야마', 'wakayama', '일본', '간사이']),
  ]),
  GJp('주고쿠-시코쿠', [
    city('히로시마', ['히로시마', 'hiroshima', '일본']),
    city('요나고', ['요나고', 'yonago', '일본']),
    city('돗토리', ['돗토리', 'tottori', '일본']),
    city('마츠야마', ['마츠야마', 'matsuyama', '일본', '시코쿠']),
    city('다카마쓰', ['다카마쓰', 'takamatsu', '일본', '시코쿠']),
    city('도쿠시마', ['도쿠시마', 'tokushima', '일본', '시코쿠']),
    city('시마네', ['시마네', 'shimane', '일본', '주고쿠']),
  ]),
  GJp('규슈', [
    city('후쿠오카', ['후쿠오카', 'fukuoka', '일본', '규슈']),
    city('나가사키', ['나가사키', 'nagasaki', '일본', '규슈']),
    city('벳부', ['벳부', 'beppu', '일본', '규슈']),
    city('유후인', ['유후인', 'yufuin', '일본', '규슈']),
    city('가고시마', ['가고시마', 'kagoshima', '일본', '규슈']),
    city('구마모토', ['구마모토', 'kumamoto', '일본', '규슈']),
    city('미야자키', ['미야자키', 'miyazaki', '일본', '규슈']),
  ]),
  GJp('오키나와', [
    city('오키나와', ['오키나와', 'okinawa', '일본']),
    city('나하', ['나하', 'naha', '일본', '오키나와']),
    city('미야코지마', ['미야코지마', 'miyakojima', '일본']),
    city('이시가키', ['이시가키', 'ishigaki', '일본']),
  ]),
]

const CN: MegaMenuCountryGroupDef[] = [
  GCn('산동', [
    city('청도', ['청도', 'qingdao', '중국']),
    city('위해', ['위해', 'weihai', '중국']),
    city('연태', ['연태', 'yantai', '중국']),
  ]),
  GCn('화동', [
    city('상해', ['상해', 'shanghai', '중국']),
    city('소주', ['소주', 'suzhou', '중국', '苏州']),
    city('항주', ['항주', 'hangzhou', '중국', '杭州']),
    city('남경', ['남경', 'nanjing', '중국', '南京']),
    city('황산', ['황산', 'huangshan', '운곡', '태평', '중국']),
    city('태항산', ['태항산', 'taishan', '泰山', '중국']),
  ]),
  GCn('화북', [
    city('북경', ['북경', 'beijing', '중국']),
    city('천진', ['천진', 'tianjin', '중국']),
    city('대동', ['대동', 'datong', '중국']),
    city('서안', ['서안', "xi'an", 'xian', '중국']),
    city('장야', ['장야', 'zhangye', '张掖', '七彩', '丹霞', '다채', '쪼한', '중국']),
  ]),
  GCn('동북', [
    city('대련', ['대련', 'dalian', '중국']),
    city('하얼빈', ['하얼빈', 'harbin', '중국']),
    city('연길', ['연길', 'yanji', '중국']),
    city('심양', ['심양', 'shenyang', '중국']),
    city('장백산', ['장백산', 'changbai', '백두산', '중국']),
  ]),
  GCn('복건', [
    city('샤먼', ['샤먼', '하문', 'xiamen', '厦门', '중국']),
    city('푸저우', ['푸저우', '복주', 'fuzhou', '福州', '중국']),
  ]),
  GCn('화남', [
    city('광주', ['광주', 'guangzhou', '广州', '중국']),
    city('구이린', ['구이린', 'guilin', '계림', '중국']),
    city('장가계', ['장가계', 'zhangjiajie', '중국']),
    city('성도', ['성도', 'chengdu', '중국', '사천']),
    city('중경', ['중경', 'chongqing', '충칭', '중국']),
    city('곤명', ['곤명', 'kunming', '중국']),
    city('여강', ['여강', 'lijiang', '리장', '중국']),
  ]),
  G('홍콩', [LC('홍콩', ['홍콩', 'hong kong', 'HKG'])]),
  G('마카오', [LC('마카오', ['마카오', 'macau', 'macao'])]),
  G('몽골', [
    city('울란바타르', ['울란바타르', 'ulaanbaatar', '울란바토르', '몽골']),
    city('테를지', ['테를지', 'terelj', '몽골']),
    city('내몽골', [
      '내몽골',
      '내몽고',
      'inner mongolia',
      'inner-mongolia',
      'mongolia-inner',
      '후룬베이얼',
      'hulunbuir',
      '오르도스',
      'ordos',
      '적봉',
      '치펑',
      'chifeng',
    ]),
  ]),
]

/** REGRESSION-FREEZE[oceania-mega-menu-three-tier]: 괌·사이판·호주/뉴질랜드 LC-only — manifest */
const OC: MegaMenuCountryGroupDef[] = [
  G('괌', [LC('괌', ['괌', 'guam'], 'guam')], false, 'guam'),
  G('사이판', [LC('사이판', ['사이판', 'saipan'], 'saipan')], false, 'saipan'),
  G(
    '호주/뉴질랜드',
    [
      LC(
        '호주/뉴질랜드',
        ['호주', 'australia', '뉴질랜드', 'new zealand', 'newzealand'],
        'australia-new-zealand',
      ),
    ],
    false,
    'australia-new-zealand',
  ),
]

const SA: MegaMenuCountryGroupDef[] = [
  G(
    '중남미',
    [
      LC('멕시코', ['멕시코', 'mexico', 'mexico city', '멕시코시티', 'cancun', '칸쿤'], 'mexico'),
      LC('쿠바', ['쿠바', 'cuba', 'havana', '아바나'], 'cuba'),
      LC('페루', ['페루', 'peru', '리마', '마추픽추', 'lima', 'cusco'], 'peru'),
      LC('브라질', ['브라질', 'brazil', '리우', '상파울루', 'rio'], 'brazil'),
      LC('아르헨티나', ['아르헨티나', 'argentina', '부에노스아이레스'], 'argentina'),
      LC('칠레', ['칠레', 'chile', '산티아고', 'santiago'], 'chile'),
      LC('볼리비아', ['볼리비아', 'bolivia', '라파스', 'la paz'], 'bolivia'),
      LC('도미니카', ['도미니카', '도미니카공화국', 'dominican', 'caribbean'], 'dominican-republic'),
    ],
    true,
  ),
]

/** 스포츠 테마 — 중분류=종목(러닝·트레킹·…), 그룹·leaf 클릭 시 `sportsTheme` browse 필터 */
const ST: MegaMenuCountryGroupDef[] = SPORTS_THEME_TAG_VALUES.map((key) =>
  G(
    SPORTS_THEME_TAG_LABELS[key],
    [LC(SPORTS_THEME_TAG_LABELS[key], [SPORTS_THEME_TAG_LABELS[key], key], key)],
    false,
    key,
  ),
)

const AM: MegaMenuCountryGroupDef[] = [
  G('하와이', [
    city('호놀룰루', ['호놀룰루', 'honolulu', '하와이', '오아후']),
    city('마우이', ['마우이', 'maui', '하와이']),
    city('빅아일랜드', ['빅아일랜드', 'big island', 'hilo', 'kona', '하와이']),
    city('카우아이', ['카우아이', 'kauai', '하와이']),
  ]),
  G('미서부', [
    city('로스앤젤레스', ['로스앤젤레스', 'los angeles', 'LA', '미서부', '미국서부']),
    city('라스베가스', [
      '라스베가스',
      '라스베이거스',
      'las vegas',
      'vegas',
      '세도나',
      'sedona',
      '프레스노',
      'fresno',
      '미서부',
      '미국서부',
    ]),
    city('샌프란시스코', [
      '샌프란시스코',
      'san francisco',
      'SFO',
      '요세미티',
      'yosemite',
      '미서부',
      '미국서부',
    ]),
    city('그랜드캐년', [
      '그랜드캐년',
      'grand canyon',
      '5대캐년',
      '5대 캐년',
      '브라이스',
      'bryce',
      '자이언',
      'zion',
      '모뉴먼트밸리',
      'monument valley',
      '세도나캐년',
      '미서부',
      '미국서부',
    ]),
  ]),
  G('미동부', [
    city('뉴욕', ['뉴욕', 'new york', 'NYC', '미동부', '미국동부']),
    city('워싱턴', ['워싱턴', 'washington', 'dc', '미동부', '미국동부']),
  ]),
  G('캐나다', [
    city('밴쿠버', ['밴쿠버', 'vancouver', '캐나다', 'YVR']),
    city('토론토', ['토론토', 'toronto', '캐나다']),
    city('캘거리', ['캘거리', 'calgary', '캐나다']),
    city('퀘벡', ['퀘벡', 'quebec', 'montreal', '캐나다']),
    city('밴프', ['밴프', 'banff', '캐나다', '로키']),
    city('나이아가라', ['나이아가라', 'niagara', '캐나다']),
    city('옐로우나이프', ['옐로우나이프', 'yellowknife', '캐나다']),
  ]),
  G('알래스카', [LC('알래스카', ['알래스카', 'alaska', '앵커리지', 'anchorage'])]),
]

/**
 * 10탭 — 일반 7탭(권역별 도시 펼침) + 지방출발 3탭(단일 링크).
 * 지방출발 탭은 `localDeparture` 마커로 식별 — 도시 leaf 펼침 없이 `/travel/overseas?region={id}` 로 즉시 이동.
 * 라우팅·필터 SSOT: `app/api/products/browse/route.ts` localDepartureTagForBrowseRegion (busan_dep → 'busan' 등).
 */
export const MEGA_MENU_TAB_DEFINITIONS: MegaMenuTabDef[] = [
  { id: 'europe-me', label: '유럽/중동/아프리카', groups: EU },
  { id: 'southeast-asia', label: '동남아/대만/서남아', groups: SEA },
  { id: 'japan', label: '일본', groups: JP },
  { id: 'china-hk-mo', label: '중국/홍콩/마카오/몽골', groups: CN },
  { id: 'oceania', label: '괌/사이판/호주/뉴질랜드', groups: OC },
  { id: 'americas', label: '미주/캐나다/하와이', groups: AM },
  { id: 'south-america', label: '중남미', groups: SA },
  { id: 'sports_theme', label: '스포츠테마', groups: ST },
  { id: 'busan_dep', label: '부산출발', groups: [], localDeparture: 'busan' },
  { id: 'cheongju_dep', label: '청주출발', groups: [], localDeparture: 'cheongju' },
  { id: 'daegu_dep', label: '대구출발', groups: [], localDeparture: 'daegu' },
]

/**
 * browse `region` 탭 id → `MegaMenuGroupCard.cardKey` (DB seed·Prisma browse SSOT).
 * UI 그룹은 `MEGA_MENU_TAB_DEFINITIONS`; 카드 키 매핑은 이 표만 유지한다.
 */
export const BROWSE_TAB_ID_TO_CARD_KEYS: Record<string, readonly string[]> = {
  'europe-me': [
    'europe-me-africa',
    'nordic-baltic-cluster',
    'europe-benelux-uk',
    'central-asia-stan',
    'europe-balkans',
    'caucasus-3',
    'middle-east-gulf',
  ],
  'southeast-asia': [
    'sea-taiwan-south-asia',
    'malaysia-brunei-cluster',
    'sea-multi-routes',
    'south-asia-india-cluster',
  ],
  japan: ['japan', 'japan-hokkaido', 'japan-kansai', 'japan-kanto'],
  'china-hk-mo': ['china-circle', 'china-major-cities', 'china-shandong-cluster', 'hk-mo-sz-cluster'],
  oceania: ['guam-au-nz'],
  americas: ['americas'],
  'south-america': ['latin-caribbean-cluster'],
}
