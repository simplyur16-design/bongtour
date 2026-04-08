import type { DomesticAreaNode, DomesticLeafNode, DomesticRegionGroupNode } from '@/lib/domestic-location-tree.types'

const L = (nodeKey: string, nodeLabel: string, extra: Partial<DomesticLeafNode> = {}): DomesticLeafNode => ({
  nodeKey,
  nodeLabel,
  ...extra,
})

const A = (
  areaKey: string,
  areaLabel: string,
  children: DomesticLeafNode[],
  extra: Partial<Omit<DomesticAreaNode, 'areaKey' | 'areaLabel' | 'children'>> = {}
): DomesticAreaNode => ({
  areaKey,
  areaLabel,
  children,
  ...extra,
})

/** 하나투어·모두투어식 국내 메뉴·상품명 키워드를 흡수한 초기 트리 */
export const DOMESTIC_LOCATION_TREE_DATA: DomesticRegionGroupNode[] = [
  {
    groupKey: 'capital',
    groupLabel: '수도권·경기',
    aliases: ['수도권', '경기', '경기도', '서울근교', '서울'],
    areas: [
      A('capital-main', '주요 도시·코스', [
        L('suwon', '수원', { aliases: ['수원시'], supplierKeywords: ['수원'], nodeType: 'city' }),
        L('incheon', '인천', { aliases: ['인천광역시'], supplierKeywords: ['인천'], nodeType: 'city' }),
        L('paju', '파주', { supplierKeywords: ['파주', 'DMZ', 'dmz'], nodeType: 'city' }),
        L('gapyeong', '가평', { supplierKeywords: ['가평', '남이섬'], nodeType: 'city' }),
        L('yangpyeong', '양평', { supplierKeywords: ['양평'], nodeType: 'city' }),
        L('pocheon', '포천', { supplierKeywords: ['포천'], nodeType: 'city' }),
        L('yongin', '용인', { supplierKeywords: ['용인', '에버랜드'], nodeType: 'city' }),
        L('namyangju', '남양주', { supplierKeywords: ['남양주'], nodeType: 'city' }),
      ]),
    ],
  },
  {
    groupKey: 'gangwon',
    groupLabel: '강원',
    aliases: ['강원', '강원도', '강원권'],
    areas: [
      A('gangwon-main', '주요 도시·코스', [
        L('gangneung', '강릉', { supplierKeywords: ['강릉'], nodeType: 'city' }),
        L('sokcho', '속초', { supplierKeywords: ['속초', '설악'], nodeType: 'city' }),
        L('yangyang', '양양', { supplierKeywords: ['양양'], nodeType: 'city' }),
        L('chuncheon', '춘천', { supplierKeywords: ['춘천', '남이섬', '소양강'], nodeType: 'city' }),
        L('pyeongchang', '평창', { supplierKeywords: ['평창', '대관령'], nodeType: 'city' }),
        L('jeongseon', '정선', { supplierKeywords: ['정선', '정선레일바이크'], nodeType: 'city' }),
        L('donghae-samcheok', '동해·삼척', { aliases: ['동해', '삼척'], supplierKeywords: ['동해', '삼척'], nodeType: 'region' }),
        L('wonju', '원주', { supplierKeywords: ['원주'], nodeType: 'city' }),
      ]),
    ],
  },
  {
    groupKey: 'chungcheong',
    groupLabel: '충청',
    aliases: ['충청', '충청도', '충청권'],
    areas: [
      A('chung-main', '주요 도시·코스', [
        L('daejeon', '대전', { supplierKeywords: ['대전'], nodeType: 'city' }),
        L('gongju-buyeo', '공주·부여', { aliases: ['공주', '부여'], supplierKeywords: ['공주', '부여', '백제'], nodeType: 'region' }),
        L('danyang', '단양', { supplierKeywords: ['단양', '도담삼봉'], nodeType: 'city' }),
        L('jecheon', '제천', { supplierKeywords: ['제천'], nodeType: 'city' }),
        L('taean-anmyeondo', '태안·안면도', { aliases: ['태안', '안면도'], supplierKeywords: ['태안', '안면도'], nodeType: 'region' }),
        L('boryeong', '보령', { supplierKeywords: ['보령', '대천'], nodeType: 'city' }),
        L('chungju', '충주', { supplierKeywords: ['충주'], nodeType: 'city' }),
        L('seosan', '서산', { supplierKeywords: ['서산'], nodeType: 'city' }),
      ]),
    ],
  },
  {
    groupKey: 'jeolla',
    groupLabel: '전라',
    aliases: ['전라', '전라도', '호남', '전라권'],
    areas: [
      A('jeolla-main', '주요 도시·코스', [
        L('jeonju', '전주', { supplierKeywords: ['전주', '한옥마을'], nodeType: 'city' }),
        L('gunsan', '군산', { supplierKeywords: ['군산'], nodeType: 'city' }),
        L('yeosu', '여수', { supplierKeywords: ['여수', '밤바다', '이순신'], nodeType: 'city' }),
        L('suncheon', '순천', { supplierKeywords: ['순천', '순천만'], nodeType: 'city' }),
        L('damyang', '담양', { supplierKeywords: ['담양', '죽녹원'], nodeType: 'city' }),
        L('mokpo', '목포', { supplierKeywords: ['목포'], nodeType: 'city' }),
        L('namwon', '남원', { supplierKeywords: ['남원', '광한루'], nodeType: 'city' }),
        L('gwangju', '광주', { supplierKeywords: ['광주', '광주광역시'], nodeType: 'city' }),
        L('haenam-wando', '해남·완도', { aliases: ['해남', '완도'], supplierKeywords: ['해남', '완도'], nodeType: 'region' }),
      ]),
    ],
  },
  {
    groupKey: 'gyeongsang',
    groupLabel: '경상',
    aliases: ['경상', '경상도', '영남', '경상권'],
    areas: [
      A('gyeong-main', '주요 도시·코스', [
        L('busan', '부산', { supplierKeywords: ['부산', '해운대', '광안리'], nodeType: 'city' }),
        L('gyeongju', '경주', { supplierKeywords: ['경주', '불국사', '첨성대'], nodeType: 'city' }),
        L('tongyeong', '통영', { supplierKeywords: ['통영', '미륵산'], nodeType: 'city' }),
        L('geoje', '거제', { supplierKeywords: ['거제', '바람의 언덕'], nodeType: 'city' }),
        L('pohang', '포항', { supplierKeywords: ['포항', '호미곶'], nodeType: 'city' }),
        L('andong', '안동', { supplierKeywords: ['안동', '하회마을'], nodeType: 'city' }),
        L('ulsan', '울산', { supplierKeywords: ['울산'], nodeType: 'city' }),
        L('daegu', '대구', { supplierKeywords: ['대구'], nodeType: 'city' }),
        L('changwon-masan', '창원·마산', { aliases: ['창원', '마산'], supplierKeywords: ['창원', '마산', '진해'], nodeType: 'region' }),
        L('namhae', '남해', { supplierKeywords: ['남해', '다랭이'], nodeType: 'city' }),
      ]),
    ],
  },
  {
    groupKey: 'jeju',
    groupLabel: '제주',
    aliases: ['제주', '제주도', '제주특별자치도'],
    areas: [
      A('jeju-main', '제주 코스', [
        L('jeju-city', '제주 시내', { aliases: ['제주시'], supplierKeywords: ['제주시', '제주 시내'], nodeType: 'city' }),
        L('seogwipo', '서귀포', { supplierKeywords: ['서귀포'], nodeType: 'city' }),
        L('udo', '우도', { supplierKeywords: ['우도'], nodeType: 'island' }),
        L('seongsan', '성산', { aliases: ['성산일출봉'], supplierKeywords: ['성산', '일출봉'], nodeType: 'region' }),
        L('aewol', '애월', { supplierKeywords: ['애월'], nodeType: 'city' }),
        L('jungmun', '중문', { supplierKeywords: ['중문', '중문관광단지'], nodeType: 'region' }),
      ]),
    ],
  },
  {
    groupKey: 'islands',
    groupLabel: '섬여행',
    aliases: ['섬', '섬여행', '도서', '도서지역'],
    areas: [
      A('island-routes', '섬 노선', [
        L('hongdo-heuksando', '홍도·흑산도', { supplierKeywords: ['홍도', '흑산도', '흑산'], nodeType: 'island' }),
        L('baengnyeong-daecheong', '백령도·대청도', { supplierKeywords: ['백령도', '대청도'], nodeType: 'island' }),
        L('wando-cluster', '외도·장사도·청산도·보길도', {
          aliases: ['외도', '장사도', '청산도', '보길도'],
          supplierKeywords: ['외도', '장사도', '청산도', '보길도', '완도'],
          nodeType: 'island',
        }),
        L('hahwado-geumo', '하화도·금오도·오동도·낭도', {
          supplierKeywords: ['하화도', '금오도', '오동도', '낭도'],
          nodeType: 'island',
        }),
        L('geomundo-baekdo', '거문도·백도', { supplierKeywords: ['거문도', '백도'], nodeType: 'island' }),
      ]),
    ],
  },
  {
    groupKey: 'themes',
    groupLabel: '테마·여행방식',
    aliases: ['테마', '테마여행', '여행방식', '특집'],
    areas: [
      A('theme-special', '특수 테마', [
        L('pet', '반려동물 동행여행', { supplierKeywords: ['반려', '반려동물', '펫', '애견'], nodeType: 'theme' }),
        L('busan-cruise', '부산원나잇크루즈', { supplierKeywords: ['원나잇', '크루즈', '부산 크루즈'], nodeType: 'theme' }),
        L('earthing', '어싱투어', { supplierKeywords: ['어싱', '어싱투어'], nodeType: 'theme' }),
        L('special-train', '이색관광열차', { supplierKeywords: ['관광열차', '열차여행', '레일봉', 'V-train', '바다열차'], nodeType: 'theme' }),
      ]),
      A('theme-transport-duration', '교통·일정 형태', [
        L('bus-tour', '버스여행', { supplierKeywords: ['버스여행', '관광버스', '버스 패키지'], nodeType: 'transport' }),
        L('train-tour', '기차여행', { supplierKeywords: ['기차여행', 'KTX', 'ktx', '철도', '열차'], nodeType: 'transport' }),
        L('day-trip', '당일여행', { supplierKeywords: ['당일', '당일치기', '당일여행'], nodeType: 'duration' }),
        L('one-night', '1박2일', { aliases: ['1박2일여행'], supplierKeywords: ['1박2일', '1박 2일'], nodeType: 'duration' }),
        L('two-night', '2박3일', { aliases: ['2박3일여행'], supplierKeywords: ['2박3일', '2박 3일'], nodeType: 'duration' }),
      ]),
    ],
  },
]
