/**
 * 해외 랜딩 메가메뉴 — 1차: 권역 한 줄, 2차: 국가, 3차: 도시(검색 토큰).
 * 클릭 시 `terms`는 상품 목적지 매칭에 전달된다.
 */

export type MegaMenuLeaf = {
  label: string
  terms: string[]
}

/** 국가(또는 복합 권역) 단위 블록 — 캡처 UI의 국가 헤더 + 도시 2열 */
export type MegaMenuCountryGroup = {
  countryLabel: string
  cities: MegaMenuLeaf[]
}

export type MegaMenuSpecial = 'free' | 'supplier' | 'curation'

export type MegaMenuRegion = {
  id: string
  /** 상단 탭 한 줄에 표시 */
  label: string
  hint?: string
  /** 일반 권역: 국가 → 도시 트리 */
  countryGroups?: MegaMenuCountryGroup[]
  special?: MegaMenuSpecial
}

/**
 * 1차 메뉴 = 대권역 한 줄 (캡처와 유사한 그룹핑).
 * 2·3차 = hover 패널 안에서 국가별 헤더 + 도시 그리드.
 */
export const OVERSEAS_MEGA_MENU_REGIONS: MegaMenuRegion[] = [
  {
    id: 'eu_me_af',
    label: '유럽/중동/아프리카',
    countryGroups: [
      {
        countryLabel: '서유럽',
        cities: [
          { label: '프랑스', terms: ['프랑스', 'France', '파리', 'Paris'] },
          { label: '스위스', terms: ['스위스', 'Switzerland', 'Zurich', '인터라켄'] },
          { label: '이탈리아', terms: ['이탈리아', 'Italy', '로마', 'Rome', '밀라노'] },
          { label: '영국', terms: ['영국', 'UK', '런던', 'London'] },
          { label: '네덜란드', terms: ['네덜란드', 'Netherlands', '암스테르담'] },
        ],
      },
      {
        countryLabel: '동유럽',
        cities: [
          { label: '체코', terms: ['체코', 'Czech', '프라하', 'Prague'] },
          { label: '오스트리아', terms: ['오스트리아', 'Austria', '비엔나', 'Vienna'] },
          { label: '헝가리', terms: ['헝가리', 'Hungary', '부다페스트'] },
          { label: '독일', terms: ['독일', 'Germany', 'Berlin', '뮌헨'] },
        ],
      },
      {
        countryLabel: '발칸(크로아티아/슬로베니아)',
        cities: [
          { label: '크로아티아', terms: ['크로아티아', 'Croatia', '두브로브니크'] },
          { label: '슬로베니아', terms: ['슬로베니아', 'Slovenia'] },
        ],
      },
      {
        countryLabel: '스페인/포르투갈',
        cities: [
          { label: '스페인', terms: ['스페인', 'Spain', '바르셀로나', 'Madrid'] },
          { label: '포르투갈', terms: ['포르투갈', 'Portugal', '리스본'] },
          { label: '모로코', terms: ['모로코', 'Morocco'] },
        ],
      },
      {
        countryLabel: '튀르키예',
        cities: [{ label: '튀르키예', terms: ['튀르키예', 'Turkey', '이스탄불', 'Istanbul'] }],
      },
      {
        countryLabel: '이집트',
        cities: [{ label: '이집트', terms: ['이집트', 'Egypt', '카이로', 'Luxor'] }],
      },
      {
        countryLabel: '그리스',
        cities: [{ label: '그리스', terms: ['그리스', 'Greece', '아테네', '산토리니'] }],
      },
      {
        countryLabel: '중동',
        cities: [
          { label: '두바이', terms: ['두바이', 'Dubai', 'UAE'] },
          { label: '아부다비', terms: ['아부다비', 'Abu Dhabi'] },
          { label: '사우디아라비아', terms: ['사우디', 'Saudi'] },
          { label: '요르단', terms: ['요르단', 'Jordan'] },
          { label: '카타르', terms: ['카타르', 'Qatar'] },
          { label: '오만', terms: ['오만', 'Oman'] },
        ],
      },
      {
        countryLabel: '북유럽',
        cities: [
          { label: '노르웨이', terms: ['노르웨이', 'Norway', '오슬로'] },
          { label: '핀란드', terms: ['핀란드', 'Finland', '헬싱키'] },
          { label: '덴마크', terms: ['덴마크', 'Denmark', '코펜하겐'] },
          { label: '스웨덴', terms: ['스웨덴', 'Sweden', '스톡홀름'] },
          { label: '아이슬란드', terms: ['아이슬란드', 'Iceland'] },
          { label: '발트3국', terms: ['발트', '에스토니아', '라트비아', '리투아니아'] },
        ],
      },
      {
        countryLabel: '아프리카/모리셔스',
        cities: [
          { label: '모리셔스', terms: ['모리셔스', 'Mauritius'] },
          { label: '아프리카', terms: ['아프리카', 'Africa', '케이프타운', '남아프리카'] },
        ],
      },
      {
        countryLabel: '코카서스 3국',
        cities: [
          { label: '조지아', terms: ['조지아', 'Georgia'] },
          { label: '아제르바이잔', terms: ['아제르바이잔', 'Azerbaijan'] },
          { label: '아르메니아', terms: ['아르메니아', 'Armenia'] },
        ],
      },
      {
        countryLabel: '유럽 성지순례',
        cities: [{ label: '유럽 성지순례', terms: ['성지순례', '이스라엘', '성지'] }],
      },
    ],
  },
  {
    id: 'sea_taiwan_sw',
    label: '동남아/대만/서남아',
    countryGroups: [
      {
        countryLabel: '태국',
        cities: [
          { label: '방콕', terms: ['방콕', 'Bangkok'] },
          { label: '파타야', terms: ['파타야', 'Pattaya'] },
          { label: '푸켓', terms: ['푸켓', 'Phuket'] },
          { label: '치앙마이', terms: ['치앙마이', 'Chiang Mai'] },
          { label: '치앙라이', terms: ['치앙라이', 'Chiang Rai'] },
          { label: '코사무이', terms: ['코사무이', 'Koh Samui', 'Samui'] },
          { label: '카오락', terms: ['카오락', 'Khao Lak'] },
          { label: '칸차나부리', terms: ['칸차나부리', 'Kanchanaburi'] },
        ],
      },
      {
        countryLabel: '베트남',
        cities: [
          { label: '다낭', terms: ['다낭', 'Da Nang', 'Danang'] },
          { label: '나트랑', terms: ['나트랑', 'Nha Trang', '芽莊'] },
          { label: '달랏', terms: ['달랏', 'Dalat'] },
          { label: '푸꾸옥', terms: ['푸꾸옥', 'Phu Quoc'] },
          { label: '하노이', terms: ['하노이', 'Hanoi'] },
          { label: '하롱베이', terms: ['하롱', 'Halong', 'Ha Long'] },
          { label: '호치민', terms: ['호치민', 'Ho Chi Minh', 'HCMC'] },
          { label: '무이네', terms: ['무이네', 'Mui Ne'] },
          { label: '사파', terms: ['사파', 'Sapa'] },
          { label: '하이퐁', terms: ['하이퐁', 'Hai Phong'] },
        ],
      },
      {
        countryLabel: '필리핀',
        cities: [
          { label: '세부', terms: ['세부', 'Cebu'] },
          { label: '보라카이', terms: ['보라카이', 'Boracay'] },
          { label: '보홀', terms: ['보홀', 'Bohol'] },
          { label: '마닐라', terms: ['마닐라', 'Manila'] },
          { label: '클락', terms: ['클락', 'Clark', '앙헬레스'] },
        ],
      },
      {
        countryLabel: '대만',
        cities: [
          { label: '타이베이', terms: ['타이베이', 'Taipei', '台北'] },
          { label: '가오슝', terms: ['가오슝', 'Kaohsiung'] },
          { label: '타이중', terms: ['타이중', 'Taichung'] },
        ],
      },
      {
        countryLabel: '싱가포르',
        cities: [{ label: '싱가포르', terms: ['싱가포르', 'Singapore'] }],
      },
      {
        countryLabel: '인도네시아',
        cities: [
          { label: '발리', terms: ['발리', 'Bali'] },
          { label: '바탐', terms: ['바탐', 'Batam'] },
          { label: '마나도', terms: ['마나도', 'Manado'] },
        ],
      },
      {
        countryLabel: '라오스',
        cities: [
          { label: '비엔티안', terms: ['비엔티안', 'Vientiane'] },
          { label: '방비엥', terms: ['방비엥', 'Vang Vieng'] },
          { label: '루앙프라방', terms: ['루앙프라방', 'Luang Prabang'] },
        ],
      },
      {
        countryLabel: '몰디브',
        cities: [{ label: '몰디브', terms: ['몰디브', 'Maldives', 'Male'] }],
      },
      {
        countryLabel: '인도/네팔/스리랑카',
        cities: [
          { label: '인도', terms: ['인도', 'India', '델리', 'Delhi'] },
          { label: '네팔', terms: ['네팔', 'Nepal', '카트만두'] },
          { label: '스리랑카', terms: ['스리랑카', 'Sri Lanka', '콜롬보'] },
          { label: '부탄', terms: ['부탄', 'Bhutan'] },
          { label: '불교 성지순례', terms: ['불교', '성지', '인도'] },
        ],
      },
      {
        countryLabel: '말레이시아',
        cities: [
          { label: '코타키나발루', terms: ['코타키나발루', 'Kota Kinabalu'] },
          { label: '쿠알라룸푸르', terms: ['쿠알라룸푸르', 'Kuala Lumpur'] },
        ],
      },
      {
        countryLabel: '캄보디아',
        cities: [{ label: '씨엠립', terms: ['씨엠립', 'Siem Reap', '앙코르'] }],
      },
      {
        countryLabel: '동남아 다국가여행',
        cities: [
          { label: '싱가포르+바탐', terms: ['싱가포르', '바탐', 'Batam'] },
          { label: '말레이시아 연계', terms: ['말레이시아', '연계'] },
          { label: '베트남+캄보디아', terms: ['베트남', '캄보디아'] },
        ],
      },
    ],
  },
  {
    id: 'japan',
    label: '일본',
    countryGroups: [
      {
        countryLabel: '동경/관동',
        cities: [
          { label: '도쿄', terms: ['도쿄', 'Tokyo', '東京'] },
          { label: '하코네', terms: ['하코네', 'Hakone', '箱根'] },
          { label: '닛코', terms: ['닛코', 'Nikko'] },
          { label: '시즈오카', terms: ['시즈오카', 'Shizuoka'] },
          { label: '니가타', terms: ['니가타', 'Niigata'] },
        ],
      },
      {
        countryLabel: '오사카/간사이',
        cities: [
          { label: '오사카', terms: ['오사카', 'Osaka', '大阪'] },
          { label: '교토', terms: ['교토', 'Kyoto', '京都'] },
          { label: '나라', terms: ['나라', 'Nara', '奈良'] },
          { label: '고베', terms: ['고베', 'Kobe', '神戸'] },
          { label: '와카야마', terms: ['와카야마', 'Wakayama', '시라하마'] },
        ],
      },
      {
        countryLabel: '알펜루트',
        cities: [
          { label: '나고야', terms: ['나고야', 'Nagoya', '名古屋'] },
          { label: '도야마', terms: ['도야마', 'Toyama'] },
          { label: '고마츠', terms: ['고마츠', 'Komatsu'] },
        ],
      },
      {
        countryLabel: '규슈',
        cities: [
          { label: '후쿠오카', terms: ['후쿠오카', 'Fukuoka', '福岡'] },
          { label: '기타큐슈', terms: ['기타큐슈', 'Kitakyushu'] },
          { label: '벳푸', terms: ['벳푸', 'Beppu', '別府'] },
          { label: '유후인', terms: ['유후인', 'Yufuin', '由布院'] },
          { label: '오이타', terms: ['오이타', 'Oita'] },
          { label: '구마모토', terms: ['구마모토', 'Kumamoto'] },
          { label: '나가사키', terms: ['나가사키', 'Nagasaki'] },
          { label: '미야자키', terms: ['미야자키', 'Miyazaki'] },
          { label: '가고시마', terms: ['가고시마', 'Kagoshima'] },
        ],
      },
      {
        countryLabel: '북해도',
        cities: [
          { label: '삿포로', terms: ['삿포로', 'Sapporo', '札幌'] },
          { label: '오타루', terms: ['오타루', 'Otaru'] },
          { label: '후라노', terms: ['후라노', 'Furano'] },
          { label: '비에이', terms: ['비에이', 'Biei'] },
          { label: '노보리베츠', terms: ['노보리베츠', 'Noboribetsu'] },
          { label: '하코다테', terms: ['하코다테', 'Hakodate'] },
        ],
      },
      {
        countryLabel: '오키나와',
        cities: [
          { label: '오키나와', terms: ['오키나와', 'Okinawa', '沖縄'] },
          { label: '미야코지마', terms: ['미야코지마', 'Miyakojima'] },
          { label: '이시가키', terms: ['이시가키', 'Ishigaki'] },
        ],
      },
      {
        countryLabel: '시코쿠/주고쿠',
        cities: [
          { label: '다카마쓰', terms: ['다카마쓰', 'Takamatsu'] },
          { label: '마쓰야마', terms: ['마쓰야마', 'Matsuyama'] },
          { label: '히로시마', terms: ['히로시마', 'Hiroshima', '広島'] },
          { label: '요나고', terms: ['요나고', 'Yonago'] },
          { label: '돗토리', terms: ['돗토리', 'Tottori'] },
          { label: '오카야마', terms: ['오카야마', 'Okayama'] },
          { label: '도쿠시마', terms: ['도쿠시마', 'Tokushima'] },
        ],
      },
      {
        countryLabel: '중부/호쿠리쿠',
        cities: [
          { label: '나고야', terms: ['나고야', 'Nagoya'] },
          { label: '다카야마', terms: ['다카야마', 'Takayama'] },
          { label: '가나자와', terms: ['가나자와', 'Kanazawa'] },
        ],
      },
      {
        countryLabel: '도호쿠',
        cities: [
          { label: '센다이', terms: ['센다이', 'Sendai'] },
          { label: '아오모리', terms: ['아오모리', 'Aomori'] },
          { label: '니가타', terms: ['니가타', 'Niigata'] },
        ],
      },
      {
        countryLabel: '일본(선박)/대마도',
        cities: [
          { label: '대마도', terms: ['대마도', '쓰시마', 'Tsushima'] },
          { label: '후쿠오카(선박)', terms: ['후쿠오카', '선박'] },
        ],
      },
    ],
  },
  {
    id: 'cn_hk_mo_mn',
    label: '중국/홍콩/마카오/몽골/중앙아시아',
    countryGroups: [
      {
        countryLabel: '장가계',
        cities: [
          { label: '장가계', terms: ['장가계', 'Zhangjiajie'] },
          { label: '장사', terms: ['장사', 'Changsha'] },
          { label: '무한', terms: ['무한', 'Wuhan'] },
        ],
      },
      {
        countryLabel: '상해/북경',
        cities: [
          { label: '상해', terms: ['상하이', 'Shanghai', '上海'] },
          { label: '북경', terms: ['베이징', 'Beijing', '北京'] },
        ],
      },
      {
        countryLabel: '홍콩/마카오/심천',
        cities: [
          { label: '홍콩', terms: ['홍콩', 'Hong Kong'] },
          { label: '마카오', terms: ['마카오', 'Macau', 'Macao'] },
          { label: '심천', terms: ['심천', 'Shenzhen'] },
        ],
      },
      {
        countryLabel: '청도/위해/연태',
        cities: [
          { label: '청도', terms: ['청도', 'Qingdao'] },
          { label: '연태', terms: ['연태', 'Yantai'] },
          { label: '위해', terms: ['위해', 'Weihai'] },
        ],
      },
      {
        countryLabel: '계림/침주',
        cities: [
          { label: '계림', terms: ['계림', 'Guilin'] },
          { label: '침주', terms: ['침주', 'Chenzhou'] },
        ],
      },
      {
        countryLabel: '성도/구채구',
        cities: [{ label: '성도', terms: ['성도', 'Chengdu', '청두', '成都'] }],
      },
      {
        countryLabel: '하이난',
        cities: [
          { label: '삼아', terms: ['삼아', 'Sanya'] },
          { label: '하이커우', terms: ['하이커우', 'Haikou'] },
        ],
      },
      {
        countryLabel: '몽골/내몽고',
        cities: [
          { label: '몽골', terms: ['몽골', 'Mongolia', 'Ulaanbaatar'] },
          { label: '내몽고', terms: ['내몽고', 'Inner Mongolia'] },
        ],
      },
      {
        countryLabel: '중앙아시아',
        cities: [
          { label: '카자흐스탄', terms: ['카자흐스탄', 'Kazakhstan'] },
          { label: '우즈베키스탄', terms: ['우즈베키스탄', 'Uzbekistan'] },
        ],
      },
    ],
  },
  {
    id: 'oz_pacific',
    label: '괌/사이판/호주/뉴질랜드',
    countryGroups: [
      {
        countryLabel: '괌 · 사이판',
        cities: [
          { label: '괌', terms: ['괌', 'Guam'] },
          { label: '사이판', terms: ['사이판', 'Saipan'] },
        ],
      },
      {
        countryLabel: '호주',
        cities: [
          { label: '시드니', terms: ['시드니', 'Sydney'] },
          { label: '멜버른', terms: ['멜버른', 'Melbourne'] },
          { label: '브리즈번', terms: ['브리즈번', 'Brisbane'] },
          { label: '골드코스트', terms: ['골드코스트', 'Gold Coast'] },
          { label: '케언즈', terms: ['케언즈', 'Cairns'] },
        ],
      },
      {
        countryLabel: '뉴질랜드',
        cities: [
          { label: '오클랜드', terms: ['오클랜드', 'Auckland', '뉴질랜드'] },
          { label: '크라이스트처치', terms: ['크라이스트처치', 'Christchurch'] },
          { label: '퀸스타운', terms: ['퀸스타운', 'Queenstown'] },
        ],
      },
    ],
  },
  {
    id: 'americas',
    label: '미주/캐나다/하와이/중남미',
    countryGroups: [
      {
        countryLabel: '하와이',
        cities: [
          { label: '호놀룰루', terms: ['하와이', 'Hawaii', '호놀룰루', 'Honolulu'] },
          { label: '마우이', terms: ['마우이', 'Maui'] },
          { label: '빅아일랜드', terms: ['Big Island', '하와이'] },
          { label: '카우아이', terms: ['Kauai', '하와이'] },
        ],
      },
      {
        countryLabel: '미서부',
        cities: [
          { label: '로스앤젤레스', terms: ['LA', 'Los Angeles', '로스앤젤레스'] },
          { label: '라스베이거스', terms: ['라스베이거스', 'Las Vegas'] },
          { label: '샌프란시스코', terms: ['샌프란시스코', 'San Francisco'] },
        ],
      },
      {
        countryLabel: '미동부',
        cities: [
          { label: '뉴욕', terms: ['뉴욕', 'New York'] },
          { label: '워싱턴', terms: ['워싱턴', 'Washington'] },
        ],
      },
      {
        countryLabel: '알래스카',
        cities: [{ label: '알래스카', terms: ['알래스카', 'Alaska'] }],
      },
      {
        countryLabel: '캐나다',
        cities: [
          { label: '밴쿠버', terms: ['밴쿠버', 'Vancouver', '캐나다'] },
          { label: '토론토', terms: ['토론토', 'Toronto'] },
          { label: '캘거리', terms: ['캘거리', 'Calgary'] },
          { label: '퀘벡', terms: ['퀘벡', 'Quebec'] },
          { label: '밴프', terms: ['밴프', 'Banff'] },
          { label: '나이아가라', terms: ['나이아가라', 'Niagara'] },
          { label: '옐로나이프', terms: ['옐로나이프', 'Yellowknife'] },
        ],
      },
      {
        countryLabel: '중남미/멕시코',
        cities: [
          { label: '칸쿤', terms: ['칸쿤', 'Cancun', '멕시코'] },
          { label: '멕시코시티', terms: ['멕시코', 'Mexico City'] },
          { label: '브라질', terms: ['브라질', 'Brazil', '리우'] },
          { label: '칠레', terms: ['칠레', 'Chile'] },
          { label: '아르헨티나', terms: ['아르헨티나', 'Argentina'] },
          { label: '페루', terms: ['페루', 'Peru'] },
        ],
      },
      {
        countryLabel: '스포츠 테마',
        cities: [{ label: '경기 직관', terms: ['직관', '스포츠', '경기'] }],
      },
    ],
  },
  {
    id: 'cruise',
    label: '크루즈',
    countryGroups: [
      {
        countryLabel: '지중해·북유럽',
        cities: [
          { label: '지중해', terms: ['지중해', 'Mediterranean', '크루즈'] },
          { label: '북유럽', terms: ['북유럽', '크루즈', '노르웨이'] },
        ],
      },
      {
        countryLabel: '알래스카·캐리비안',
        cities: [
          { label: '알래스카', terms: ['알래스카', 'Alaska', '크루즈'] },
          { label: '캐리비안', terms: ['캐리비안', 'Caribbean', '크루즈'] },
        ],
      },
      {
        countryLabel: '동아시아',
        cities: [
          { label: '일본', terms: ['일본', '크루즈'] },
          { label: '동남아', terms: ['동남아', '싱가포르', '크루즈'] },
        ],
      },
    ],
  },
  {
    id: 'local_dep',
    label: '지방출발',
    countryGroups: [
      {
        countryLabel: '국내 출발지',
        cities: [
          { label: '부산', terms: ['부산', '출발'] },
          { label: '대구', terms: ['대구', '출발'] },
          { label: '광주', terms: ['광주', '출발'] },
          { label: '제주', terms: ['제주', '출발'] },
          { label: '청주', terms: ['청주', '출발'] },
        ],
      },
    ],
  },
  {
    id: 'golf_theme',
    label: '골프',
    countryGroups: [
      {
        countryLabel: '골프 인기',
        cities: [
          { label: '하와이', terms: ['하와이', '골프', 'Hawaii'] },
          { label: '괌', terms: ['괌', '골프', 'Guam'] },
          { label: '일본', terms: ['일본', '골프'] },
          { label: '태국', terms: ['태국', '골프', '치앙마이'] },
          { label: '필리핀', terms: ['필리핀', '골프', '세부'] },
        ],
      },
    ],
  },
  {
    id: 'honeymoon',
    label: '허니문',
    countryGroups: [
      {
        countryLabel: '허니문 인기',
        cities: [
          { label: '발리', terms: ['발리', 'Bali', '허니문'] },
          { label: '몰디브', terms: ['몰디브', 'Maldives', '허니문'] },
          { label: '하와이', terms: ['하와이', 'Hawaii', '허니문'] },
          { label: '괌', terms: ['괌', 'Guam', '허니문'] },
          { label: '싱가포르', terms: ['싱가포르', 'Singapore', '허니문'] },
        ],
      },
    ],
  },
  {
    id: 'curation',
    label: '추천여행',
    hint: '운영에서 고른 이달 큐레이션 카드로 이동합니다.',
    special: 'curation',
  },
  {
    id: 'free',
    label: '자유여행',
    hint: '에어텔·항공+호텔 중심으로 보기',
    special: 'free',
  },
  {
    id: 'supplier',
    label: '공급사별',
    hint: '하나·모두·참좋은 등 출처별로 보기',
    special: 'supplier',
  },
]

/** 도시별 탭용 플랫 칩 */
export const OVERSEAS_QUICK_CITY_CHIPS: MegaMenuLeaf[] = OVERSEAS_MEGA_MENU_REGIONS.filter((r) => !r.special && r.countryGroups?.length)
  .flatMap((r) => r.countryGroups!.flatMap((g) => g.cities))
  .filter((leaf, i, a) => a.findIndex((x) => x.label === leaf.label) === i)
  .slice(0, 40)

export const OVERSEAS_DESTINATION_BRIEF_FALLBACK =
  '표시 상품은 공급사 등록 기준이며, 일정·요금·출발 확정은 상담 시 안내드립니다.'

export const OVERSEAS_DESTINATION_BRIEFS: Record<string, string> = {
  eu_me_af: '유럽·중동 일정은 항공 스케줄·비자 확인이 중요합니다.',
  sea_taiwan_sw: '동남아·대만은 휴양·가족 문의가 많고, 도시마다 성수기가 다릅니다.',
  japan: '일본은 단거리·미식·온천 수요가 높고, 3~4박 묶음이 흔합니다.',
  cn_hk_mo_mn: '중국·홍콩·마카오는 비자·항공편에 따라 동선이 달라질 수 있습니다.',
  oz_pacific: '남태평양·호주는 시즌·비행 시간을 함께 보시는 것이 좋습니다.',
  americas: '미주·하와이는 동부·서부 동선과 시차를 고려한 일정이 많습니다.',
  honeymoon: '허니문은 리조트·항공 좌석 상황에 따라 견차가 달라질 수 있습니다.',
  오사카: '간사이 중심으로 교토·고베·나라와 묶는 패턴이 흔합니다.',
  다낭: '해안 리조트와 시내 관광을 함께 구성하는 일정이 많습니다.',
  도쿄: '도심 관광과 근교(하코네·요코하마)를 조합하는 문의가 많습니다.',
}

export function briefingForMegaLabel(regionId: string | undefined, leafLabel: string): string {
  if (regionId && OVERSEAS_DESTINATION_BRIEFS[regionId]) return OVERSEAS_DESTINATION_BRIEFS[regionId]!
  if (OVERSEAS_DESTINATION_BRIEFS[leafLabel]) return OVERSEAS_DESTINATION_BRIEFS[leafLabel]!
  return OVERSEAS_DESTINATION_BRIEF_FALLBACK
}
