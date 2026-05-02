/**
 * 하나투어·모두투어 해외 분류를 통합한 정적 트리 (운영 권역 SSOT).
 * UI 라벨은 Bong투어 표준, 매칭 토큰에 공급사 표기(동경·푸껫·씨엠립 등) 포함.
 */
import type { OverseasCountryNode, OverseasLeafNode, OverseasRegionGroupNode } from '@/lib/overseas-location-tree.types'

function L(
  nodeKey: string,
  nodeLabel: string,
  opt?: {
    aliases?: string[]
    supplierKeywords?: string[]
    supplierOnlyLabels?: string[]
    nodeType?: OverseasLeafNode['nodeType']
    dbCityValue?: string | null
  }
): OverseasLeafNode {
  return {
    nodeKey,
    nodeLabel,
    aliases: opt?.aliases,
    supplierKeywords: opt?.supplierKeywords,
    supplierOnlyLabels: opt?.supplierOnlyLabels,
    nodeType: opt?.nodeType ?? 'city',
    dbCityValue: opt?.dbCityValue,
  }
}

function C(
  countryKey: string,
  countryLabel: string,
  children: OverseasLeafNode[],
  opt?: { aliases?: string[]; supplierKeywords?: string[]; dbCountryValues?: string[] }
): OverseasCountryNode {
  return {
    countryKey,
    countryLabel,
    aliases: opt?.aliases,
    supplierKeywords: opt?.supplierKeywords,
    dbCountryValues: opt?.dbCountryValues,
    children,
  }
}

function G(
  groupKey: string,
  groupLabel: string,
  countries: OverseasCountryNode[],
  aliases?: string[]
): OverseasRegionGroupNode {
  return { groupKey, groupLabel, aliases, countries }
}

export const OVERSEAS_LOCATION_TREE_DATA: OverseasRegionGroupNode[] = [
  G(
    'sea-taiwan-south-asia',
    '동남아 · 대만 · 서남아',
    [
      C(
        'thailand',
        '태국',
        [
          L('bangkok', '방콕', {
            aliases: ['bangkok', '방콕'],
            supplierKeywords: ['BKK', '수완나품'],
          }),
          L('pattaya', '파타야', { aliases: ['pattaya', '파타야'] }),
          L('phuket-krabi-khaolak', '푸켓 · 끄라비 · 카오락', {
            aliases: ['푸켓', 'phuket', '끄라비', 'krabi', '카오락', 'khao lak', '푸껫'],
            supplierKeywords: ['푸껫', '카오락'],
          }),
          L('chiangmai-chiangrai', '치앙마이 · 치앙라이', {
            aliases: ['치앙마이', 'chiang mai', 'chiangmai', '치앙라이', 'chiang rai'],
          }),
          L('ayutthaya', '아유타야', { aliases: ['ayutthaya', '아유타야'] }),
          L('kanchanaburi', '칸차나부리', { aliases: ['kanchanaburi', '칸차나부리'] }),
          L('koh-samui', '코사무이', { aliases: ['koh samui', '코사무이', '사무이'] }),
        ],
        {
          aliases: ['태국', 'thailand'],
          supplierKeywords: ['태국일주', '방콕파타야'],
        }
      ),
      C(
        'vietnam',
        '베트남',
        [
          L('danang', '다낭', { aliases: ['danang', '다낭', '岘港'] }),
          L('nhatrang', '나트랑', { aliases: ['nha trang', '나트랑', '나짱'] }),
          L('dalat', '달랏', { aliases: ['dalat', '달랏', '대럿'] }),
          L('phuquoc', '푸꾸옥', { aliases: ['phu quoc', '푸꾸옥'] }),
          L('hanoi-halong', '하노이 · 하롱베이', {
            aliases: ['하노이', 'hanoi', '하롱', 'halong', '하롱베이'],
            supplierKeywords: ['하롱베이'],
          }),
          L('hochiminh', '호치민', { aliases: ['호치민', 'hcm', 'saigon', '사이공'] }),
          L('muine', '무이네 · 판티엣', { aliases: ['mui ne', '무이네', '판티엣', 'phan thiet'] }),
          L('sapa', '사파', { aliases: ['sapa', '사파'] }),
          L('hue-donghoi', '후에 · 동허이', { aliases: ['hue', '후에', 'dong hoi', '동허이'] }),
          L('haiphong', '하이퐁', { aliases: ['hai phong', '하이퐁'], supplierKeywords: ['하이퐁'] }),
        ],
        { aliases: ['베트남', 'vietnam'] }
      ),
      C(
        'philippines',
        '필리핀',
        [
          L('boracay', '보라카이', { aliases: ['boracay', '보라카이'] }),
          L('cebu', '세부', { aliases: ['cebu', '세부'], supplierKeywords: ['CEB'] }),
          L('bohol', '보홀', { aliases: ['bohol', '보홀'] }),
          L('manila', '마닐라', { aliases: ['manila', '마닐라'], supplierKeywords: ['MNL'] }),
          L('clark', '클락', { aliases: ['clark', '클락', '앙헬레스'] }),
        ],
        { aliases: ['필리핀', 'philippines'] }
      ),
      C(
        'malaysia-brunei',
        '말레이시아 · 브루나이',
        [
          L('kotakinabalu', '코타키나발루', { aliases: ['kota kinabalu', '코타키나발루', '사바'] }),
          L('kuala-lumpur', '쿠알라룸푸르', { aliases: ['kuala lumpur', 'KL', '쿠알라룸푸르'] }),
          L('brunei', '브루나이', { aliases: ['brunei', '브루나이'] }),
        ],
        { aliases: ['말레이시아', 'malaysia', '브루나이'] }
      ),
      C(
        'taiwan',
        '대만',
        [
          L('taipei', '타이베이', { aliases: ['taipei', '타이페이', '타이베이', '타이페이'], supplierKeywords: ['타이페이'] }),
          L('taichung', '타이중', { aliases: ['taichung', '타이중'] }),
          L('kaohsiung', '가오슝', { aliases: ['kaohsiung', '가오슝'] }),
          L('tainan', '타이난', { aliases: ['tainan', '타이난'] }),
          L('hualien', '화련', { aliases: ['hualien', '화련', '타로코'] }),
        ],
        { aliases: ['대만', 'taiwan', '타이완'] }
      ),
      C('singapore', '싱가포르', [L('singapore', '싱가포르', { aliases: ['singapore', '싱가폴'], supplierKeywords: ['SIN'] })], {
        aliases: ['싱가포르'],
      }),
      C(
        'laos',
        '라오스',
        [
          L('vangvieng', '방비엥', { aliases: ['vang vieng', '방비엥'] }),
          L('luangprabang', '루앙프라방', { aliases: ['luang prabang', '루앙프라방'] }),
          L('vientiane', '비엔티안', { aliases: ['vientiane', '비엔티안', '비엔티엔'] }),
        ],
        { aliases: ['라오스', 'laos'] }
      ),
      C(
        'cambodia',
        '캄보디아',
        [
          L('siemreap', '시엠립 · 앙코르와트', {
            aliases: ['siem reap', '시엠립', '앙코르', '앙코르와트'],
            supplierKeywords: ['씨엠립', '씨엠립(앙코르와트)'],
          }),
        ],
        { aliases: ['캄보디아', 'cambodia'] }
      ),
      C(
        'indonesia',
        '인도네시아',
        [
          L('bali', '발리', { aliases: ['bali', '발리', '덴파사르'], supplierKeywords: ['DPS'] }),
          L('batam', '바탐', { aliases: ['batam', '바탐'] }),
          L('manado', '마나도', { aliases: ['manado', '마나도'] }),
        ],
        { aliases: ['인도네시아', 'indonesia'] }
      ),
      C(
        'india-nepal-sri-bhutan',
        '인도 · 네팔 · 스리랑카 · 부탄',
        [
          L('india', '인도', { aliases: ['india', '인도', '델리', '뭄바이'] }),
          L('nepal', '네팔', { aliases: ['nepal', '네팔', '카트만두'] }),
          L('srilanka', '스리랑카', { aliases: ['sri lanka', '스리랑카', '콜롬보'] }),
          L('bhutan', '부탄', { aliases: ['bhutan', '부탄'], supplierKeywords: ['부탄'] }),
        ],
        { aliases: ['인도', '네팔', '스리랑카'] }
      ),
      C('maldives', '몰디브', [L('maldives', '몰디브', { aliases: ['maldives', '몰디브', 'male'] })], {
        aliases: ['몰디브'],
      }),
      C(
        'sea-multi',
        '동남아 다국가 · 연계',
        [
          L('sg-batam', '싱가포르+바탐', { nodeType: 'route', aliases: ['싱가포르+바탐', '싱가폴바탐'] }),
          L('my-link', '말레이시아 연계', { nodeType: 'route', aliases: ['말레이시아 연계'] }),
        ],
        { aliases: ['동남아 다국가'], supplierKeywords: ['동남아 다국가여행'] }
      ),
      C(
        'buddhist-pilgrimage',
        '불교 성지순례',
        [L('buddhist-pilgrimage', '불교 성지순례', { nodeType: 'theme' })],
        { supplierKeywords: ['불교 성지'] }
      ),
    ],
    ['동남아', '대만', '서남아', 'asean']
  ),

  G(
    'japan',
    '일본',
    [
      C(
        'jp-kanto',
        '간토(관동)',
        [
          L('tokyo', '도쿄', {
            aliases: ['도쿄', 'tokyo', '동경', '도쿄도'],
            supplierKeywords: ['NRT', 'HND', '도쿄(나리타)', '동경'],
          }),
          L('shizuoka-izu', '시즈오카 · 이즈(아타미)', {
            aliases: ['시즈오카', 'shizuoka', '이즈', 'izu', '아타미', 'atami'],
          }),
          L('hakone-fuji', '하코네 · 후지산', { aliases: ['하코네', 'hakone', '후지', 'fuji', '후지산'] }),
          L('yokohama-kamakura', '요코하마 · 가마쿠라 · 야마나시', {
            aliases: ['요코하마', 'yokohama', '가마쿠라', 'kamakura', '야마나시', 'yamanashi'],
          }),
          L('nikko', '닛꼬', { aliases: ['nikko', '닛코', '日光'], supplierKeywords: ['닛꼬'] }),
        ],
        { aliases: ['간토', '관동', 'kanto', '동경'], supplierKeywords: ['간토(관동)'], dbCountryValues: ['일본'] }
      ),
      C(
        'jp-kansai',
        '간사이(관서)',
        [
          L('osaka', '오사카', { aliases: ['오사카', 'osaka', '오사카시'], supplierKeywords: ['KIX', '오사카'] }),
          L('kyoto', '교토', { aliases: ['교토', 'kyoto', 'kyōto', '기요토'] }),
          L('kobe', '고베', { aliases: ['kobe', '고베', '神戶'] }),
          L('nara', '나라', { aliases: ['nara', '나라', '奈良'], supplierKeywords: ['나라'] }),
          L('wakayama-shirahama', '와카야마 · 시라하마', { aliases: ['wakayama', '시라하마', 'shirahama'] }),
        ],
        { aliases: ['간사이', '관서', 'kansai', '오사카'], dbCountryValues: ['일본'] }
      ),
      C(
        'jp-kyushu',
        '규슈',
        [
          L('fukuoka', '후쿠오카', { aliases: ['후쿠오카', 'fukuoka'], supplierKeywords: ['FUK'] }),
          L('beppu-yufuin', '벳부 · 유후인', { aliases: ['beppu', '벳부', 'yufuin', '유후인'] }),
          L('saga', '사가', { aliases: ['saga', '사가'] }),
          L('oita', '오이타', { aliases: ['oita', '오이타', '벳부'] }),
          L('kumamoto-nagasaki', '구마모토 · 나가사키', { aliases: ['kumamoto', '구마모토', 'nagasaki', '나가사키'] }),
          L('kagoshima-miyazaki', '가고시마 · 미야자키', { aliases: ['kagoshima', 'miyazaki', '가고시마', '미야자키'] }),
          L('kitakyushu-yamaguchi', '기타큐슈 · 야마구치', {
            aliases: ['kitakyushu', '기타큐슈', 'yamaguchi', '야마구치', '시모노세키'],
            supplierKeywords: ['기타큐슈', '시모노세키'],
          }),
        ],
        { aliases: ['규슈', 'kyushu', '큐슈'], supplierKeywords: ['큐슈'], dbCountryValues: ['일본'] }
      ),
      C(
        'jp-hokkaido',
        '홋카이도',
        [
          L('sapporo', '삿포로', { aliases: ['sapporo', '삿포로', '札幌'], supplierKeywords: ['CTS'] }),
          L('furano-biei', '후라노 · 비에이', { aliases: ['furano', 'biei', '후라노', '비에이'] }),
          L('asahikawa', '아사히카와', { aliases: ['asahikawa'] }),
          L('noboribetsu', '노보리베츠', { aliases: ['noboribetsu', '노보리베츠'] }),
          L('hakodate', '하코다테', { aliases: ['hakodate', '하코다테'] }),
          L('otaru', '오타루', { aliases: ['otaru', '오타루'], supplierKeywords: ['오타루'] }),
          L('toya-jozankei', '도야 · 죠잔케이', { aliases: ['toya', '도야', 'jozankei', '죠잔케이', '조잔케이'] }),
        ],
        { aliases: ['홋카이도', 'hokkaido', '북해도'], supplierKeywords: ['북해도'], dbCountryValues: ['일본'] }
      ),
      C(
        'jp-shikoku-chugoku',
        '시코쿠 · 주고쿠',
        [
          L('takamatsu-naoshima', '다카마츠 · 나오시마', { aliases: ['takamatsu', '다카마츠', 'naoshima', '나오시마'] }),
          L('matsuyama', '마츠야마', { aliases: ['matsuyama', '마츠야마'] }),
          L('tokushima', '도쿠시마', { aliases: ['tokushima', '도쿠시마'] }),
          L('tottori', '돗토리', { aliases: ['tottori', '돗토리'] }),
          L('yonago', '요나고', { aliases: ['yonago', '요나고'] }),
          L('hiroshima', '히로시마', { aliases: ['hiroshima', '히로시마'] }),
          L('okayama', '오카야마', { aliases: ['okayama', '오카야마'] }),
          L('shimonoseki', '시모노세키', { aliases: ['shimonoseki'], supplierKeywords: ['시모노세키'] }),
        ],
        { aliases: ['시코쿠', '주고쿠'], supplierKeywords: ['시코쿠/주고쿠'], dbCountryValues: ['일본'] }
      ),
      C(
        'jp-okinawa',
        '오키나와',
        [
          L('okinawa-main', '오키나와 본섬', { aliases: ['okinawa', '오키나와', '나하', 'naha'], supplierKeywords: ['OKA'] }),
          L('miyakojima', '미야코지마', { aliases: ['miyako', '미야코지마'] }),
          L('ishigaki', '이시가키', { aliases: ['ishigaki', '이시가키', '石垣'] }),
        ],
        { aliases: ['오키나와', 'okinawa'], dbCountryValues: ['일본'] }
      ),
      C(
        'jp-chubu-hokuriku',
        '중부 · 호쿠리쿠 · 알펜루트',
        [
          L('toyama-alpen', '도야마 · 알펜루트', { aliases: ['toyama', '도야마', 'alpen', '알펜루트'] }),
          L('nagoya', '나고야', { aliases: ['nagoya', '나고야', 'NGO'] }),
          L('takayama', '다카야마', { aliases: ['takayama', '다카야마'] }),
          L('kanazawa-komatsu', '고마츠 · 가나자와권', { aliases: ['komatsu', '고마츠', 'kanazawa', '가나자와'] }),
        ],
        { aliases: ['호쿠리쿠', '중부'], supplierKeywords: ['알펜루트'], dbCountryValues: ['일본'] }
      ),
      C(
        'jp-tohoku',
        '도호쿠(동북)',
        [
          L('niigata', '니가타', { aliases: ['niigata', '니가타'] }),
          L('aomori', '아오모리', { aliases: ['aomori', '아오모리'] }),
          L('akita-sendai', '아키타 · 센다이', { aliases: ['akita', 'sendai', '센다이', '아키타'] }),
        ],
        { aliases: ['도호쿠', '동북', 'tohoku'], supplierKeywords: ['도호쿠'], dbCountryValues: ['일본'] }
      ),
      C(
        'jp-ferry',
        '일본(선박 연계)',
        [
          L('tsushima', '대마도', { aliases: ['대마도', 'tsushima', '対馬'], supplierKeywords: ['대마도'] }),
          L('ferry-fukuoka', '후쿠오카(선박)', { nodeType: 'route', supplierKeywords: ['후쿠오카(선박)'] }),
          L('ferry-osaka', '오사카(선박)', { nodeType: 'route', supplierKeywords: ['오사카(선박)'] }),
        ],
        { supplierKeywords: ['일본(선박)'], dbCountryValues: ['일본'] }
      ),
    ],
    ['일본', 'japan', '재팬']
  ),

  G(
    'europe-me-africa',
    '유럽 · 중동 · 아프리카',
    [
      C('france', '프랑스', [
        L('fr', '프랑스', { aliases: ['프랑스', 'france', '파리', 'paris', '니스'] }),
        L('cotedazur', '코트다쥐르', {
          aliases: ['nice', '니스', '칸', 'cannes', 'cote dazur', '남프랑스', 'south france'],
        }),
      ], {
        aliases: ['프랑스', '남프랑스'],
      }),
      C('switzerland', '스위스', [L('ch', '스위스', { aliases: ['스위스', 'switzerland', '취리히', 'zurich', '인터라켄'] })], {
        aliases: ['스위스'],
      }),
      C('italy', '이탈리아', [
        L('it', '이탈리아', { aliases: ['이탈리아', 'italy', '로마', 'roma', '밀라노', '베네치아'] }),
        L('sicily', '시칠리아', { aliases: ['sicily', '시칠리아', '팔레르모', 'sicilia'] }),
      ], {
        aliases: ['이탈리아', '시칠리아'],
      }),
      C('uk', '영국', [
        L('uk', '영국 일반', { aliases: ['영국', 'london', '런던', 'UK'], supplierKeywords: ['LHR', 'LGW'] }),
        L('ie', '아일랜드', { aliases: ['ireland', 'Ireland', '더블린', 'Dublin'] }),
      ], {
        aliases: ['영국', 'britain', '아일랜드'],
      }),
      C('netherlands', '네덜란드', [
        L('nl', '네덜란드', { aliases: ['netherlands', '암스테르담', 'holland', 'Amsterdam'] }),
        L('be', '벨기에', { aliases: ['belgium', '벨기에', '브뤼셀', 'Brussels'] }),
      ], {
        aliases: ['네덜란드', '벨기에'],
      }),
      C('germany', '독일', [L('de', '독일', { aliases: ['독일', 'germany', '베를린', '뮌헨'] })], { aliases: ['독일'] }),
      C('austria', '오스트리아', [L('at', '오스트리아', { aliases: ['austria', '비엔나', '잘츠부르크'] })], {
        aliases: ['오스트리아'],
      }),
      C('czech', '체코', [L('cz', '체코 · 프라하', { aliases: ['czech', 'prague', '프라하', 'praha'] })], {
        aliases: ['체코'],
      }),
      C('hungary', '헝가리', [L('hu', '헝가리', { aliases: ['hungary', '부다페스트'] })], { aliases: ['헝가리'] }),
      C(
        'poland',
        '폴란드',
        [L('warsaw', '바르샤바', { aliases: ['warsaw', 'warszawa', '바르샤바', '폴란드', 'poland'] })],
        { aliases: ['폴란드', 'poland'], dbCountryValues: ['동유럽'] }
      ),
      C(
        'balkans',
        '발칸 · 크로아티아 · 슬로베니아',
        [
          L('balkan-mix', '발칸(크로아티아/슬로베니아)', {
            aliases: ['발칸', 'balkan', '크로아티아', 'croatia', '슬로베니아', 'slovenia'],
          }),
        ],
        { supplierKeywords: ['발칸(크로아티아/슬로베니아)'] }
      ),
      C('spain', '스페인', [L('es', '스페인', { aliases: ['spain', '스페인', '마드리드', '바르셀로나'] })], {
        aliases: ['스페인'],
      }),
      C('portugal', '포르투갈', [L('pt', '포르투갈', { aliases: ['portugal', '리스본', '포르투'] })], {
        aliases: ['포르투갈'],
      }),
      C('morocco', '모로코', [L('ma', '모로코', { aliases: ['morocco', '마라케시'] })], { aliases: ['모로코'] }),
      C(
        'turkey',
        '튀르키예',
        [
          L('istanbul', '이스탄불', { aliases: ['istanbul', '이스탄불', 'ist', '터키'] }),
          L('cappadocia', '카파도키아', { aliases: ['cappadocia', '카파도키아', 'goreme', '고레메', 'kapadokya'] }),
        ],
        {
          aliases: ['튀르키예', '터키'],
          supplierKeywords: ['튀르키예(터키)'],
        }
      ),
      C(
        'greece',
        '그리스',
        [
          L('athens', '아테네', { aliases: ['athens', '아테네', '애테네', 'athena'] }),
          L('santorini', '산토리니', { aliases: ['santorini', '산토리니', 'thira'] }),
        ],
        { aliases: ['그리스'] }
      ),
      C('egypt', '이집트', [L('egypt', '이집트', { aliases: ['egypt', '이집트', '카이로', '룩소르'], supplierKeywords: ['이집트'] })], {
        aliases: ['이집트'],
      }),
      C(
        'caucasus',
        '코카서스 3국',
        [
          L('georgia', '조지아', { aliases: ['georgia', '조지아', '트빌리시'] }),
          L('azerbaijan', '아제르바이잔', { aliases: ['azerbaijan', '바쿠'] }),
          L('armenia', '아르메니아', { aliases: ['armenia', '예레반'] }),
        ],
        { aliases: ['코카서스'], supplierKeywords: ['코카서스'] }
      ),
      C(
        'middle-east',
        '중동',
        [
          L('dubai', '두바이', { aliases: ['dubai', '두바이'], supplierKeywords: ['DXB'] }),
          L('abudhabi', '아부다비', { aliases: ['abu dhabi', '아부다비'], supplierKeywords: ['아부다비'] }),
          L('jordan', '요르단', { aliases: ['jordan', '요르단', '페트라'] }),
          L('saudi', '사우디아라비아', { aliases: ['saudi', '사우디'] }),
          L('oman', '오만', { aliases: ['oman', '오만'] }),
          L('qatar', '카타르', { aliases: ['qatar', '카타르', '도하'], supplierKeywords: ['카타르'] }),
          L('tunisia', '튀니지', { aliases: ['tunisia', '튀니지'] }),
        ],
        { aliases: ['중동'] }
      ),
      C(
        'nordic-baltic',
        '북유럽 · 발트',
        [
          L('norway', '노르웨이', { aliases: ['norway', '노르웨이', '오슬로', '피오르'] }),
          L('finland', '핀란드', { aliases: ['finland', '핀란드', '헬싱키'] }),
          L('denmark', '덴마크', { aliases: ['denmark', '덴마크', '코펜하겐'] }),
          L('sweden', '스웨덴', { aliases: ['sweden', '스웨덴', '스톡홀름'] }),
          L('baltic3', '발트 3국', { aliases: ['발트', '리투아니아', '에스토니아', '라트비아', '빌니우스', '탈린', '리가'] }),
          L('iceland', '아이슬란드', { aliases: ['iceland', '아이슬란드', '레이캬비크'] }),
        ],
        { aliases: ['북유럽', '발트'] }
      ),
      C(
        'africa',
        '아프리카 · 모리셔스',
        [
          L('kenya', '케냐', { aliases: ['kenya', '케냐'] }),
          L('tanzania', '탄자니아', { aliases: ['tanzania', '탄자니아', '세렝게티'] }),
          L('south-africa', '남아공', { aliases: ['south africa', '남아공', '케이프타운'] }),
          L('mauritius', '모리셔스', { aliases: ['mauritius', '모리셔스'], supplierKeywords: ['모리셔스'] }),
        ],
        { aliases: ['아프리카'] }
      ),
      C(
        'europe-pilgrimage',
        '유럽 성지순례',
        [L('eu-pilgrimage', '유럽 성지순례', { nodeType: 'theme' })],
        { supplierKeywords: ['유럽 성지순례'] }
      ),
    ],
    ['유럽', 'europe', '중동', '아프리카']
  ),

  G(
    'china-circle',
    '중국권 · 홍콩 · 마카오 · 몽골 · 중앙아',
    [
      C('mongolia', '몽골', [L('ulaanbaatar', '울란바타르', { aliases: ['ulaanbaatar', '울란바토르', '울란바타르', '몽골'] })], {
        aliases: ['몽골'],
      }),
      C(
        'hk-mo-sz',
        '홍콩 · 마카오 · 심천',
        [
          L('hongkong', '홍콩', { aliases: ['hong kong', '홍콩', 'HKG'] }),
          L('macau', '마카오', { aliases: ['macau', 'macao', '마카오'] }),
          L('shenzhen', '심천 · 선전', { aliases: ['shenzhen', '심천', '선전', '深圳'] }),
        ],
        { aliases: ['홍콩', '마카오'] }
      ),
      C(
        'inner-mongolia',
        '내몽골(내몽고)',
        [
          L('hulunbuir', '후룬베이얼', { aliases: ['hulunbuir', '후룬베이얼'] }),
          L('ordos', '오르도스', { aliases: ['ordos', '오르도스'] }),
          L('chifeng', '적봉 · 치펑', { aliases: ['chifeng', '적봉'] }),
        ],
        { aliases: ['내몽골', '내몽고', 'inner mongolia'], dbCountryValues: ['중국'] }
      ),
      C(
        'china-major',
        '중국 주요 도시',
        [
          L('zhangjiajie', '장가계', { aliases: ['zhangjiajie', '장가계', '장사', 'changsha', '장사'] }),
          L('shanghai', '상해', { aliases: ['shanghai', '상해', '上海'] }),
          L('beijing-tianjin', '북경 · 천진', { aliases: ['beijing', '북경', '베이징', 'tianjin', '천진'] }),
          L('sichuan', '사천 · 성도 · 구채구', { aliases: ['chengdu', '성도', '구채구', 'jiuzhaigou', '티벳', 'tibet', '충칭', 'chongqing', '중경'] }),
          L('guizhou', '귀주 · 안순', { aliases: ['guiyang', '귀양', '안순'] }),
          L('yunnan', '곤명 · 여강', { aliases: ['kunming', '곤명', 'lijiang', '여강', '리장'] }),
          L('guilin', '계림', { aliases: ['guilin', '계림', '양삭'] }),
          L('huangshan', '황산', { aliases: ['huangshan', '황산'] }),
          L('hangzhou', '항주', { aliases: ['hangzhou', '항주', '杭州'], supplierKeywords: ['항주'] }),
          L('hefei', '합비', { aliases: ['hefei', '합비'], supplierKeywords: ['합비'] }),
          L('taihang', '태항산', { aliases: ['taihang', '태항산'] }),
          L('shandong', '산동 · 칭다오 · 연태 · 제남 · 위해', {
            aliases: ['qingdao', '청도', '연태', 'yantai', '제난', 'jinan', '위해', 'weihai'],
          }),
          L('xiamen', '샤먼 · 하문', { aliases: ['xiamen', '샤먼', '하문', '厦门'] }),
          L('fuzhou', '푸저우 · 복주', { aliases: ['fuzhou', '복주', '福州'] }),
          L('zhangzhou', '천저 · 침주', { aliases: ['zhangzhou', '침주', '망산'], supplierKeywords: ['침주(망산)'] }),
          L('hainan', '하이난', { aliases: ['hainan', '하이난', '삼아', 'sanya', '하이커우', 'haikou'] }),
          L('dalian-harbin', '대련 · 하얼빈', { aliases: ['dalian', '대련', 'harbin', '하얼빈'] }),
          L('xian-urumqi', '서안 · 우루무치', { aliases: ["xi'an", '서안', 'urumqi', '우루무치'] }),
          L('wuhan-yichang', '무한 · 은시 · 무당산', { aliases: ['wuhan', '무한', 'yichang', '은시', '무당산'] }),
          L('changbai', '백두산 · 연길 · 심양 · 장춘', { aliases: ['백두산', 'changbai', '연길', '심양', '장춘'] }),
        ],
        { aliases: ['중국', 'china'], supplierKeywords: ['중국권'], dbCountryValues: ['중국'] }
      ),
      C(
        'central-asia',
        '중앙아시아',
        [
          L('kazakhstan', '카자흐스탄 · 알마티', { aliases: ['kazakhstan', '알마티', 'almaty'] }),
          L('kyrgyzstan', '키르기스스탄 · 비슈케크', { aliases: ['kyrgyzstan', '비슈케크', 'bishkek'] }),
          L('uzbekistan', '우즈베키스탄 · 타슈켄트', { aliases: ['uzbekistan', '타슈켄트', 'tashkent'] }),
        ],
        { aliases: ['중앙아시아'] }
      ),
      C(
        'china-trekking',
        '중국 트레킹',
        [L('cn-trek', '중국 트레킹', { nodeType: 'theme' })],
        { supplierKeywords: ['중국 트레킹'] }
      ),
    ],
    ['중국', 'china', '홍콩', '마카오']
  ),

  G(
    'guam-au-nz',
    '괌/사이판/호주/뉴질랜드',
    [
      C('guam', '괌', [L('guam', '괌', { aliases: ['guam', '괌'] })], { aliases: ['괌'] }),
      C('saipan', '사이판', [L('saipan', '사이판', { aliases: ['saipan', '사이판'] })], { aliases: ['사이판'] }),
      C(
        'australia',
        '호주',
        [
          L('sydney', '시드니', { aliases: ['sydney', '시드니'], supplierKeywords: ['SYD'] }),
          L('melbourne', '멜버른', { aliases: ['melbourne', '멜번', '멜버른'] }),
          L('goldcoast', '골드코스트', { aliases: ['gold coast', '골드코스트'] }),
          L('brisbane', '브리즈번', { aliases: ['brisbane', '브리즈번'] }),
          L('uluru', '울룰루', { aliases: ['uluru', '울룰루', '에어즈록'] }),
          L('perth', '퍼스', { aliases: ['perth', '퍼스'] }),
        ],
        { aliases: ['호주', 'australia'] }
      ),
      C(
        'newzealand',
        '뉴질랜드',
        [
          L('auckland', '오클랜드', { aliases: ['auckland', '오클랜드'] }),
          L('rotorua', '로토루아', { aliases: ['rotorua', '로토루아'], supplierKeywords: ['로토루아'] }),
          L('christchurch', '크라이스트처치', { aliases: ['christchurch', '크라이스트처치'] }),
          L('queenstown', '퀸즈타운', { aliases: ['queenstown', '퀸즈타운'] }),
        ],
        { aliases: ['뉴질랜드', 'new zealand'] }
      ),
    ],
    ['괌', '사이판', '호주', '뉴질랜드']
  ),

  G(
    'americas',
    '미주 · 하와이 · 캐나다 · 중남미',
    [
      C(
        'hawaii',
        '하와이',
        [
          L('honolulu', '호놀룰루 · 오아후', { aliases: ['honolulu', '호놀룰루', 'oahu', '오아후'], supplierKeywords: ['HNL'] }),
          L('maui', '마우이', { aliases: ['maui', '마우이'] }),
          L('bigisland', '빅아일랜드', { aliases: ['big island', '빅아일랜드', 'hilo', 'kona'] }),
          L('kauai', '카우아이', { aliases: ['kauai', '카우아이'], supplierKeywords: ['카우아이'] }),
        ],
        { aliases: ['하와이', 'hawaii'] }
      ),
      C(
        'usa-west',
        '미국 서부',
        [
          L('la', '로스앤젤레스', { aliases: ['los angeles', 'LA', '로스앤젤레스'] }),
          L('sf', '샌프란시스코', { aliases: ['san francisco', '샌프란시스코', 'SFO'] }),
          L('lasvegas', '라스베이거스', { aliases: ['las vegas', 'vegas', '라스베가스'] }),
          L('seattle', '시애틀', { aliases: ['seattle', '시애틀'] }),
          L('grandcanyon', '그랜드캐년', { aliases: ['grand canyon', '그랜드캐년'] }),
        ],
        { aliases: ['미국서부', '미서부'] }
      ),
      C(
        'usa-east',
        '미국 동부',
        [
          L('nyc', '뉴욕', { aliases: ['new york', '뉴욕', 'NYC'] }),
          L('dc', '워싱턴 DC', { aliases: ['washington', '워싱턴', 'dc'] }),
          L('boston', '보스턴', { aliases: ['boston', '보스턴'] }),
        ],
        { aliases: ['미동부', '미국동부'] }
      ),
      C(
        'usa-south',
        '미국 중남부 · 플로리다',
        [
          L('dallas-houston', '댈러스 · 휴스턴 · 뉴올리언스', { aliases: ['dallas', 'houston', 'new orleans'] }),
          L('orlando-miami', '올랜도 · 마이애미', { aliases: ['orlando', 'miami', '올랜도', '마이애미'] }),
        ],
        { aliases: ['미국중부'] }
      ),
      C(
        'canada',
        '캐나다',
        [
          L('vancouver', '밴쿠버', { aliases: ['vancouver', '밴쿠버', 'YVR'] }),
          L('banff', '밴프 · 로키', { aliases: ['banff', '밴프', '로키', 'jasper'] }),
          L('calgary', '캘거리', { aliases: ['calgary', '캘거리'] }),
          L('niagara', '나이아가라', { aliases: ['niagara', '나이아가라'] }),
          L('toronto', '토론토', { aliases: ['toronto', '토론토'] }),
          L('quebec', '퀘벡 · 퀘백', { aliases: ['quebec', '퀘벡', '퀘백', 'montreal'] }),
          L('yellowknife', '옐로우나이프', { aliases: ['yellowknife', '옐로우나이프'], supplierKeywords: ['옐로우나이프'] }),
        ],
        { aliases: ['캐나다', 'canada'] }
      ),
      C(
        'latin-caribbean',
        '중남미 · 카리브',
        [
          L('cuba-mexico', '쿠바 · 멕시코 · 칸쿤', { aliases: ['cuba', '쿠바', 'mexico', '멕시코', 'cancun', '칸쿤'] }),
          L('south-america', '남미(페루·브라질·아르헨티나·볼리비아·칠레)', {
            aliases: ['peru', '페루', 'brazil', '브라질', 'argentina', '아르헨티나', 'bolivia', 'chile', '칠레'],
          }),
          L('caribbean', '카리브해', { aliases: ['caribbean', '카리브'] }),
        ],
        { aliases: ['중남미', '멕시코'] }
      ),
      C('alaska', '알래스카', [L('alaska', '알래스카', { aliases: ['alaska', '알래스카'] })], {
        aliases: ['알래스카'],
        supplierKeywords: ['알래스카'],
      }),
      C(
        'sports-tours',
        '스포츠 · 경기 직관',
        [L('sports', '경기 직관 여행', { nodeType: 'theme', supplierKeywords: ['경기 직관', '스포츠 테마'] })],
        { supplierKeywords: ['스포츠 테마 투어'] }
      ),
    ],
    ['미국', '캐나다', '하와이', '중남미']
  ),
]
