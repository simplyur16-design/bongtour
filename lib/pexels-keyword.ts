/**
 * Pexels 검색 키워드 생성 — 관광지(명소) 우선, 규칙 기반 + 최소 보정.
 * 한국어 상품 메타를 Pexels에서 의미 있는 영어 검색어로 변환.
 * REGRESSION-FREEZE[pexels-keyword-taiwan-poi]: 대만·타이페이 routeText 한글 명소 — manifest
 * REGRESSION-FREEZE[schedule-segment-poi-oceania-japan-europe]: NZ·AU·일본·유럽·중동·남미 routeText 세그먼트 — manifest
 */

import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

/** 도시·지역명 → Pexels 검색용 영어 (소규모 매핑) */
const DESTINATION_MAP: Record<string, string> = {
  다낭: 'Da Nang',
  호이안: 'Hoi An',
  바나힐: 'Ba Na Hills',
  바나힐스: 'Ba Na Hills',
  방콕: 'Bangkok',
  파타야: 'Pattaya',
  치앙마이: 'Chiang Mai',
  푸켓: 'Phuket',
  싱가포르: 'Singapore',
  발리: 'Bali',
  세부: 'Cebu',
  보라카이: 'Boracay',
  마닐라: 'Manila',
  마나도: 'Manado',
  비엔티안: 'Vientiane',
  방비엥: 'Vang Vieng',
  나트랑: 'Nha Trang',
  호치민: 'Ho Chi Minh',
  하노이: 'Hanoi',
  푸꾸옥: 'Phu Quoc',
  델리: 'Delhi',
  도쿄: 'Tokyo',
  교토: 'Kyoto',
  오사카: 'Osaka',
  후쿠오카: 'Fukuoka',
  나고야: 'Nagoya',
  다카야마: 'Takayama',
  마츠야마: 'Matsuyama',
  유후인: 'Yufuin',
  벳푸: 'Beppu',
  히로시마: 'Hiroshima',
  가고시마: 'Kagoshima',
  삿포로: 'Sapporo',
  니가타: 'Niigata',
  칸자와: 'Kanazawa',
  /** 일본 나라(奈良)만 — mapDestination·POI는 koreanHaystackIncludesMapToken으로 부분매칭 차단 */
  나라: 'Nara',
  고베: 'Kobe',
  요코하마: 'Yokohama',
  하코다테: 'Hakodate',
  오타루: 'Otaru',
  센다이: 'Sendai',
  아그라: 'Agra',
  자이푸르: 'Jaipur',
  뭄바이: 'Mumbai',
  바라나시: 'Varanasi',
  오키나와: 'Okinawa',
  미야코지마: 'Miyakojima',
  제주: 'Jeju',
  제주도: 'Jeju',
  홍콩: 'Hong Kong',
  마카오: 'Macau',
  상하이: 'Shanghai',
  /** modetour routeText 허브 — POI 아님, movement 1일차 도시명 SSOT */
  상해: 'Shanghai',
  사해: 'Shanghai',
  베이징: 'Beijing',
  북경: 'Beijing',
  하와이: 'Hawaii',
  괌: 'Guam',
  사이판: 'Saipan',
  시드니: 'Sydney',
  멜버른: 'Melbourne',
  멜번: 'Melbourne',
  오클랜드: 'Auckland',
  로토루아: 'Rotorua',
  퀸즈타운: 'Queenstown',
  '퀸즈 타운': 'Queenstown',
  크라이스트처치: 'Christchurch',
  골드코스트: 'Gold Coast',
  '골드 코스트': 'Gold Coast',
  케언즈: 'Cairns',
  퍼스: 'Perth',
  브리즈번: 'Brisbane',
  울루루: 'Uluru',
  호주: 'Australia',
  뉴질랜드: 'New Zealand',
  리우데자네이로: 'Rio de Janeiro',
  마라케시: 'Marrakech',
  파리: 'Paris',
  스페인: 'Spain',
  산티아고: 'Santiago de Compostela',
  순례길: 'Camino de Santiago',
  마드리드: 'Madrid',
  루고: 'Lugo',
  사리아: 'Sarria',
  포르토마린: 'Portomarin',
  팔레스데레이: 'Palas de Rei',
  레온: 'Leon',
  바르셀로나: 'Barcelona',
  세비야: 'Seville',
  그라나다: 'Granada',
  런던: 'London',
  암스테르담: 'Amsterdam',
  두바이: 'Dubai',
  이스탄불: 'Istanbul',
  이집트: 'Egypt',
  카이로: 'Cairo',
  룩소르: 'Luxor',
  아스완: 'Aswan',
  후르가다: 'Hurghada',
  기자: 'Giza',
  아부심벨: 'Abu Simbel',
  에드푸: 'Edfu',
  콤옴보: 'Kom Ombo',
  비엔나: 'Vienna',
  부다페스트: 'Budapest',
  프라하: 'Prague',
  브라티슬라바: 'Bratislava',
  잘츠부르크: 'Salzburg',
  할슈타트: 'Hallstatt',
  인스부르크: 'Innsbruck',
  체스키크룸로프: 'Cesky Krumlov',
  '체스키 크룸로프': 'Cesky Krumlov',
  부르노: 'Brno',
  포르투갈: 'Portugal',
  리스본: 'Lisbon',
  포르투: 'Porto',
  브라가: 'Braga',
  신트라: 'Sintra',
  카스카이스: 'Cascais',
  파티마: 'Fatima',
  아베이루: 'Aveiro',
  오비두스: 'Obidos',
  알부페이라: 'Albufeira',
  라고스: 'Lagos',
  사그레스: 'Sagres',
  까보다로까: 'Cabo da Roca',
  기마랑이스: 'Guimaraes',
  크라쿠프: 'Krakow',
  류블랴나: 'Ljubljana',
  자그레브: 'Zagreb',
  코타키나발루: 'Kota Kinabalu',
  '코타 키나발루': 'Kota Kinabalu',
  쿠알라룸푸르: 'Kuala Lumpur',
  말라카: 'Malacca',
  말레이시아: 'Malaysia',
  칭다오: 'Qingdao',
  청도: 'Qingdao',
  대만: 'Taipei',
  타이페이: 'Taipei',
  타이베이: 'Taipei',
  타오위uan: 'Taoyuan',
  桃園: 'Taoyuan',
  기룽: 'Keelung',
  리마: 'Lima',
  쿠스코: 'Cusco',
  라파즈: 'La Paz',
  우유니: 'Uyuni',
  이과수: 'Iguazu',
  리오데자네이로: 'Rio de Janeiro',
  상파울로: 'Sao Paulo',
  로스엔젤레스: 'Los Angeles',
  뉴욕: 'New York',
  워싱턴: 'Washington DC',
  토론토: 'Toronto',
  몬트리올: 'Montreal',
  퀘벡: 'Quebec City',
  나이아가라: 'Niagara Falls',
  밴쿠버: 'Vancouver',
  시애틀: 'Seattle',
  샌프란시스코: 'San Francisco',
  라스베가스: 'Las Vegas',
  시카고: 'Chicago',
  보스턴: 'Boston',
  플래츠버그: 'Plattsburgh',
}

const DESTINATION_MAP_KEYS_SORTED = Object.keys(DESTINATION_MAP).sort((a, b) => b.length - a.length)

/** 대표 지역(primaryRegion) → 영어 */
const REGION_MAP: Record<string, string> = {
  동남아: 'Southeast Asia',
  동남아시아: 'Southeast Asia',
  유럽: 'Europe',
  일본: 'Japan',
  중국: 'China',
  괌사이판: 'Guam Saipan',
  하와이: 'Hawaii',
  오세아니아: 'Oceania',
  미주: 'Americas',
  중동: 'Middle East',
  아시아: 'Asia',
}

/**
 * 일정/POI에 자주 나오는 한글 명소·구간 → Pexels용 영어(2~4단어 우선).
 * 긴 키를 먼저 매칭하도록 호출부에서 길이 내림차순 순회.
 */
const POI_KO_TO_EN: Record<string, string> = {
  '마이파리 열대과수원': 'Miyakojima Tropical Fruit Garden',
  마이파리: 'Miyakojima Tropical Fruit Garden',
  '미야코지마 해중공원': 'Miyakojima Haejung Park',
  '17엔드': 'Yonaha Maehama Beach Miyakojima',
  '이라부 대교': 'Irabu Bridge Miyakojima',
  '히가시헨나 곶': 'Higashi-Hennazaki Cape Miyakojima',
  '유키시오 뮤지엄': 'Yuki Snow Museum Miyakojima',
  '시기라 오공 온센': 'Shigira Ogon Onsen Miyakojima',
  토오리이케: 'Toriike Pond Miyakojima',
  해중공원: 'Miyakojima Haejung Park',
  유키시오: 'Yuki Snow Museum Miyakojima',
  조개박물관: 'Miyakojima Shell Museum',
  유니버설스튜디오싱가포르: 'Universal Studios Singapore',
  유니버설스튜디오재팬: 'Universal Studios Japan',
  유니버설스튜디오: 'Universal Studios Japan',
  유니버설: 'Universal Studios Japan',
  센토사: 'Sentosa',
  센토사섬: 'Sentosa',
  머를라이언: 'Merlion Park',
  머라이언: 'Merlion Park',
  가든스바이더베이: 'Gardens by the Bay',
  마리나베이샌즈: 'Marina Bay Sands',
  마리나베이: 'Marina Bay Sands',
  헨더슨웨이브: 'Henderson Waves Bridge',
  클라우드포레스트: 'Gardens by the Bay',
  오차드로드: 'Orchard Road',
  차이나타운: 'Chinatown Singapore',
  리버보트: 'Singapore River',
  리버보트크루즈: 'Singapore River',
  후르가다: 'Hurghada',
  홍해: 'Red Sea Egypt',
  그랜드이집션뮤지엄: 'Grand Egyptian Museum',
  '그랜드 이집션 뮤지엄': 'Grand Egyptian Museum',
  피라미드: 'Giza Pyramids',
  스핑크스: 'Great Sphinx of Giza',
  아부심벨: 'Abu Simbel',
  아스완하이댐: 'Aswan High Dam',
  미완성오벨리스크: 'Unfinished Obelisk',
  왕가의계곡: 'Valley of the Kings',
  카르낙신전: 'Karnak Temple',
  에드푸신전: 'Temple of Edfu',
  콤옴보신전: 'Kom Ombo Temple',
  칸엘칼릴리: 'Khan El-khalili',
  '칸 엘 칼릴리': 'Khan El-khalili',
  오사카성: 'Osaka Castle',
  나고야성: 'Nagoya Castle',
  타지마할: 'Taj Mahal',
  아그라성: 'Agra Fort',
  '아그라 성': 'Agra Fort',
  꾸뜹미나르: 'Qutub Minar',
  인디아게이트: 'India Gate',
  '인디아 게이트': 'India Gate',
  아그라센키바올리: 'Agrasen Ki Baoli',
  '아그라센 키 바올리': 'Agrasen Ki Baoli',
  구르드와라방글라사힙: 'Gurudwara Bangla Sahib',
  '구르드와라 방글라 사힙': 'Gurudwara Bangla Sahib',
  레왕궁: 'Leh Palace',
  '레 왕궁': 'Leh Palace',
  레시장: 'Leh Market',
  '레 시장': 'Leh Market',
  알치곰파: 'Alchi Monastery',
  '알치 곰파': 'Alchi Monastery',
  알치: 'Alchi Monastery',
  라마유르곰파: 'Lamayuru Monastery',
  '라마유르 곰파': 'Lamayuru Monastery',
  라마유르: 'Lamayuru Monastery',
  마그네틱힐: 'Magnetic Hill Ladakh',
  '마그네틱 힐': 'Magnetic Hill Ladakh',
  문랜드: 'Moonland Ladakh',
  카르둥라: 'Khardung La',
  '카르둥 라': 'Khardung La',
  누브라밸리: 'Nubra Valley',
  '누브라 밸리': 'Nubra Valley',
  디스켓곰파: 'Diskit Monastery',
  '디스켓 곰파': 'Diskit Monastery',
  훈더르사막: 'Hunder Sand Dunes',
  '훈더르 사막': 'Hunder Sand Dunes',
  판공초: 'Pangong Lake',
  메락마을: 'Merak Village',
  '메락 마을': 'Merak Village',
  헤미스곰파: 'Hemis Monastery',
  '헤미스 곰파': 'Hemis Monastery',
  틱세곰파: 'Thiksey Monastery',
  '틱세 곰파': 'Thiksey Monastery',
  쉐이곰파: 'Shey Monastery',
  '쉐이 곰파': 'Shey Monastery',
  샨티스투파: 'Shanti Stupa',
  '샨티 스투파': 'Shanti Stupa',
  야리가다케: 'Mount Yari',
  신호다카온천: 'Shinhotaka Onsen',
  신호다카: 'Shinhotaka Onsen',
  히라유온천: 'Hirayu Onsen',
  사피섬: 'Sapi Island',
  '사피 아일랜드': 'Sapi Island',
  툰구압둘라만: 'Tunku Abdul Rahman National Park',
  '툰구압둘라만 해양국립공원': 'Tunku Abdul Rahman National Park',
  '선셋 반딧불': 'Kota Kinabalu Fireflies',
  '선셋 반딧불이': 'Kota Kinabalu Fireflies',
  '코타키나발루 시티 모스크': 'Kota Kinabalu City Mosque',
  '이슬람 사원': 'Kota Kinabalu City Mosque',
  만따나니: 'Mantanani Island',
  '만따나니 아일랜드': 'Mantanani Island',
  '키나발루 국립공원': 'Kinabalu Park',
  키나발루: 'Kinabalu Park',
  카미코치: 'Kamikochi',
  도고온천: 'Dogo Onsen',
  마츠야마성: 'Matsuyama Castle',
  다자이후텐만구: 'Dazaifu Tenmangu',
  다자이후: 'Dazaifu Tenmangu',
  유후인온천: 'Yufuin Onsen',
  벳푸온천: 'Beppu Onsen',
  긴잔지: 'Kinkaku-ji',
  금각사: 'Kinkaku-ji',
  청수사: 'Kiyomizu-dera',
  기요미즈데라: 'Kiyomizu-dera',
  후시미이나리: 'Fushimi Inari',
  이타도신사: 'Itsukushima Shrine',
  미야지마: 'Itsukushima Shrine',
  도톤보리: 'Dotonbori',
  도톤: 'Dotonbori',
  시라카와고: 'Shirakawa-go',
  금손다리: 'Golden Bridge Da Nang',
  골든브릿지: 'Golden Bridge Da Nang',
  바나힐: 'Ba Na Hills',
  바나힐스: 'Ba Na Hills',
  호이안올드타운: 'Hoi An Ancient Town',
  호이안고성: 'Hoi An Ancient Town',
  포나가르탑: 'Po Nagar Cham Towers',
  포나가르: 'Po Nagar Cham Towers',
  '포나가 참 사원': 'Po Nagar Cham Towers',
  '포나가 참': 'Po Nagar Cham Towers',
  롱선사: 'Long Son Pagoda',
  롱선: 'Long Son Pagoda',
  빈원더스: 'VinWonders Nha Trang',
  빈원더: 'VinWonders Nha Trang',
  담시장: 'Dam Market Nha Trang',
  나트랑: 'Nha Trang',
  나짱: 'Nha Trang',
  미케비치: 'My Khe Beach Da Nang',
  내원교: 'Japanese Covered Bridge',
  용다리: 'Dragon Bridge Da Nang',
  드래곤브릿지: 'Dragon Bridge Da Nang',
  타이페이101: 'Taipei 101 tower night',
  타이베이101: 'Taipei 101 tower night',
  국립고궁박물관: 'National Palace Museum Taipei',
  고궁박물관: 'National Palace Museum Taipei',
  예류지질공원: 'Yehliu Geopark',
  예류: 'Yehliu Geopark',
  지우펀: 'Jiufen old street Taiwan night',
  스펀천등: 'Shifen Old Street',
  스펀골목: 'Shifen Old Street',
  스펀: 'Shifen Old Street',
  우라이마을: 'Wulai Hot Spring',
  우라이: 'Wulai Hot Spring',
  솽바오: 'Sun Moon Lake',
  중정기념堂: 'Chiang Kai-shek Memorial Hall',
  청담: 'Cheongdam',
  하코네신사: 'Hakone Shrine',
  하코네: 'Hakone',
  아시호수유람선: 'Lake Ashi Cruise',
  아시호수: 'Lake Ashi',
  오와쿠다니: 'Owakudani Valley',
  시부야스크램블교차로: 'Shibuya Crossing',
  시부야: 'Shibuya',
  도쿄타워: 'Tokyo Tower',
  센소지: 'Sensoji Temple',
  아사쿠사: 'Asakusa',
  오다이바: 'Odaiba',
  디즈니랜드: 'Tokyo Disneyland',
  도쿄디즈니랜드: 'Tokyo Disneyland',
  울루와뚜: 'Uluwatu Temple',
  빠당빠당비치: 'Padang Padang Beach',
  빠당빠당: 'Padang Padang Beach',
  가루다문화공원: 'Garuda Wisnu Kencana',
  '가루다 공원': 'Garuda Wisnu Kencana',
  가루다공원: 'Garuda Wisnu Kencana',
  멜라스티비치: 'Melasti Beach',
  '멜라스티 비치': 'Melasti Beach',
  멜라스티: 'Melasti Beach',
  테렐지국립공원: 'Terelj National Park',
  '테렐지 국립공원': 'Terelj National Park',
  테를지국립공원: 'Terelj National Park',
  '테를지 국립공원': 'Terelj National Park',
  거북바위: 'Turtle Rock',
  '거북 바위': 'Turtle Rock',
  아리야발사원: 'Ariyabal Temple',
  '아리야발 사원': 'Ariyabal Temple',
  아리야발: 'Ariyabal Temple',
  야리야발사원: 'Ariyabal Temple',
  자이승전망대: 'Zaisan Memorial',
  자이승승전탑: 'Zaisan Memorial',
  자이승기념탑: 'Zaisan Memorial',
  수흐바타르광장: 'Sukhbaatar Square',
  '수흐바타르 광장': 'Sukhbaatar Square',
  '울란바토르 시내관광': 'Sukhbaatar Square',
  '울란바토르 시내': 'Sukhbaatar Square',
  칭기즈칸기마상: 'Genghis Khan Statue',
  '칭기즈칸 기마상': 'Genghis Khan Statue',
  '칭기즈칸 청동 기마상': 'Genghis Khan Statue',
  징기스칸기마상: 'Genghis Khan Statue',
  비치클럽: 'Bali Beach Club',
  '비치 클럽': 'Bali Beach Club',
  '발리 해변': 'Bali beach sunset',
  발리해변: 'Bali beach sunset',
  프린스턴대학교: 'Princeton University campus',
  '프린스톤 대학교': 'Princeton University campus',
  필라델피아: 'Independence Hall Philadelphia',
  '필라델피아 독립기념관': 'Independence Hall Philadelphia',
  인디펜던스홀: 'Independence Hall Philadelphia',
  '인디펜던스 홀': 'Independence Hall Philadelphia',
  하버드대학교: 'Harvard University campus',
  '하버드 대학교': 'Harvard University campus',
  예일대학교: 'Yale University campus',
  '예일 대학교': 'Yale University campus',
  우드버리아울렛: 'Woodbury Common Premium Outlets',
  '우드버리 아울렛': 'Woodbury Common Premium Outlets',
  센트럴파크: 'Central Park New York',
  '센트럴 파크': 'Central Park New York',
  록펠러센터: 'Rockefeller Center Top of the Rock',
  '록펠러 센터': 'Rockefeller Center Top of the Rock',
  '9.11 메모리얼': '9/11 Memorial New York',
  황소동상: 'Wall Street Charging Bull New York',
  '황소 동상': 'Wall Street Charging Bull New York',
  짐바란: 'Jimbaran Beach',
  우붓재래시장: 'Ubud Market',
  우붓왕궁: 'Ubud Palace',
  사라스와띠사원: 'Saraswati Temple Ubud',
  뜨갈랄랑: 'Tegalalang Rice Terrace',
  뜨그눙안폭포: 'Tegenungan Waterfall',
  성바울성당: 'Ruins of St Paul Macau',
  세나도광장: 'Senado Square Macau',
  베네시안리조트: 'The Venetian Macao',
  하버시티: 'Harbour City Hong Kong',
  '하버 시티': 'Harbour City Hong Kong',
  하버플라자: 'Harbour City Hong Kong',
  할리우드로드: 'Hollywood Road Hong Kong',
  소호거리: 'SoHo Hong Kong',
  '소호 거리': 'SoHo Hong Kong',
  웡타이신: 'Wong Tai Sin Temple',
  '웡타이신 사원': 'Wong Tai Sin Temple',
  낭만의거리: 'Avenue of Stars Hong Kong',
  '낭만의 거리': 'Avenue of Stars Hong Kong',
  미드레벨에스컬레이터: 'Mid-Levels Escalator',
  타이쿤: 'Tai Kwun',
  빅토리아피크: 'Victoria Peak',
  피크트램: 'Peak Tram',
  침사추이: 'Tsim Sha Tsui',
  연인의거리: 'Avenue of Stars Hong Kong',
  헤리티지1881: '1881 Heritage Hong Kong',
  유원: 'Yu Garden',
  예원: 'Yu Garden',
  외탄: 'The Bund',
  와탄: 'The Bund',
  난징로: 'Nanjing Road',
  신천지: 'Xintiandi',
  동방명주: 'Oriental Pearl Tower',
  주가각: 'Zhujiajiao',
  우캉루: 'Wukang Road',
  송성: 'Songcheng Park',
  송가무: 'Songcheng Park',
  항주: 'West Lake',
  서호: 'West Lake',
  청황: 'City God Temple of Shanghai',
  청황묘: 'City God Temple of Shanghai',
  천안문광장: 'Tiananmen Square',
  천안문: 'Tiananmen Square',
  /** REGRESSION-FREEZE[modetour-register-ssot-freeze]: 북경 d2 kw2 — manifest */
  십찰해: 'Shichahai',
  '十刹海': 'Shichahai',
  이화원: 'Summer Palace',
  만리장성: 'Great Wall of China',
  '798예술구': '798 Art District',
  사랑의절벽: 'Two Lovers Point',
  '사랑의 절벽': 'Two Lovers Point',
  스페인광장: 'Plaza de Espana Guam',
  '스페인 광장': 'Plaza de Espana Guam',
  아가나: 'Hagatna Cathedral',
  투몬: 'Tumon Bay',
  투몬베이: 'Tumon Bay',
  피시아이: 'Fish Eye Marine Park Guam',
  '피시 아이': 'Fish Eye Marine Park Guam',
  본다이비치: 'Bondi Beach',
  '본다이 비치': 'Bondi Beach',
  본다이: 'Bondi Beach',
  블루마운틴: 'Blue Mountains',
  '블루 마운틴': 'Blue Mountains',
  포트스티븐스: 'Port Stephens',
  포트스티븐: 'Port Stephens',
  '포트 스티븐': 'Port Stephens',
  '포트 스티븐스': 'Port Stephens',
  오페라하우스: 'Sydney Opera House',
  '오페라 하우스': 'Sydney Opera House',
  하버브리지: 'Sydney Harbour Bridge',
  '하버 브리지': 'Sydney Harbour Bridge',
  브라티슬라바성: 'Bratislava Castle',
  '브라티슬라바 성': 'Bratislava Castle',
  쇤브룬궁전: 'Schonbrunn Palace',
  '쇤브룬 궁전': 'Schonbrunn Palace',
  헝가리국회의사당: 'Hungarian Parliament',
  부다페스트국회의사당: 'Hungarian Parliament',
  어부의요새: "Fisherman's Bastion Budapest",
  '어부의 요새': "Fisherman's Bastion Budapest",
  부다왕궁: 'Buda Castle Budapest',
  '부다 왕궁': 'Buda Castle Budapest',
  영웅광장: 'Heroes Square Budapest',
  '영웅 광장': 'Heroes Square Budapest',
  제로니모스수도원: 'Jeronimos Monastery Lisbon',
  '제로니모스 수도원': 'Jeronimos Monastery Lisbon',
  제로니무스수도원: 'Jeronimos Monastery Lisbon',
  '제로니무스 수도원': 'Jeronimos Monastery Lisbon',
  벨렘탑: 'Belem Tower Lisbon',
  '벨렘 탑': 'Belem Tower Lisbon',
  코메르시우광장: 'Commerce Square Lisbon',
  '코메르시우 광장': 'Commerce Square Lisbon',
  헤갈레이라별장: 'Pena Palace Sintra',
  '헤갈레이라 별장': 'Pena Palace Sintra',
  페나궁전: 'Pena Palace Sintra',
  로카곶: 'Cabo da Roca',
  '까보다로까 로카곶': 'Cabo da Roca',
  봉헤수스두몬테: 'Bom Jesus do Monte Braga',
  '봉 헤수스 두 몬테 성당': 'Bom Jesus do Monte Braga',
  '봉 헤수스 두봉테 성당': 'Bom Jesus do Monte Braga',
  브라가대성당: 'Braga Cathedral',
  '브라가 대성당': 'Braga Cathedral',
  클레리구스종탑: 'Clerigos Tower Porto',
  '클레리구스 성당 및 종탑': 'Clerigos Tower Porto',
  '클레리고스 종탑': 'Clerigos Tower Porto',
  포르투대성당: 'Porto Cathedral',
  '포르투 대성당': 'Porto Cathedral',
  상벤투역: 'Sao Bento Station Porto',
  '포르투 상 벤투역': 'Sao Bento Station Porto',
  몰리세이루: 'Moliceiro boats Aveiro',
  '몰리세이루 유람선 탑승': 'Moliceiro boats Aveiro',
  오비두스: 'Obidos medieval town',
  '왕비의 마을': 'Obidos medieval town',
  사그레스성: 'Sagres Fortress',
  '사그레스와 상비센테 곶': 'Cape St Vincent Sagres',
  카를교: 'Charles Bridge',
  '카를 교': 'Charles Bridge',
  프라하성: 'Prague Castle',
  '프라하 성': 'Prague Castle',
  스타피쉬비치: 'Starfish Beach',
  '스타피쉬 비치': 'Starfish Beach',
  사오비치: 'Sao Beach',
  '사오 비치': 'Sao Beach',
  호국사: 'Ho Quoc Pagoda',
  선셋사나토비치: 'Sunset Sanato Beach',
  '선셋 사나토 비치': 'Sunset Sanato Beach',
  선셋타운: 'Sunset Town',
  '선셋 타운': 'Sunset Town',
  키스브릿지: 'Kiss Bridge',
  '키스 브릿지': 'Kiss Bridge',
  부이페스트야시장: 'Vui Pnest Night Market',
  '부이페스트 야시장': 'Vui Pnest Night Market',
  그랜드월드: 'Grand World',
  '그랜드 월드': 'Grand World',
  코코넛수용소: 'Coconut Tree Prison',
  '코코넛 수용소': 'Coconut Tree Prison',
  소나시야시장: 'Sonasea Night Market',
  '소나시 야시장': 'Sonasea Night Market',
  팡아만해상국립공원: 'James Bond Island',
  '팡아만 해상 국립공원': 'James Bond Island',
  팡아만: 'James Bond Island',
  제임스본드섬: 'James Bond Island',
  '제임스 본드': 'James Bond Island',
  산호섬: 'Coral Island Phuket',
  칠바마켓: 'Chillva Market',
  '칠바 마켓': 'Chillva Market',
  푸켓올드타운: 'Phuket Old Town',
  올드타운: 'Phuket Old Town',
  부나켄국립해양공원: 'Bunaken National Marine Park',
  '부나켄 국립해양공원': 'Bunaken National Marine Park',
  부나켄: 'Bunaken National Marine Park',
  축복의그리스도: 'Christ Blessing Statue',
  '축복의 그리스도': 'Christ Blessing Statue',
  크리스트축복: 'Christ Blessing Statue',
  남능댐: 'Nam Ngum Dam',
  블루라군: 'Blue Lagoon Vang Vieng',
  탐짱동굴: 'Tham Chang Cave',
  '탐짱 동굴': 'Tham Chang Cave',
  파탓루앙: 'Pha That Luang',
  빠뚜사이: 'Patuxai',
  독립기념탑: 'Patuxai',
  왓시사켓: 'Wat Sisaket',
  '왓 시사켓': 'Wat Sisaket',
  성미카엘성당: "St Michael's Cathedral",
  천주교당: "St Michael's Cathedral",
  잔교: 'Zhanqiao Pier',
  칭다오잔교: 'Zhanqiao Pier',
  청도54광장: 'May Fourth Square',
  '54광장': 'May Fourth Square',
  '5.4광장': 'May Fourth Square',
  칭다오올림픽요트경기장: 'Qingdao Olympic Sailing Center',
  올림픽요트경기장: 'Qingdao Olympic Sailing Center',
  지모루시장: 'Jimo Road Market',
  찌모루시장: 'Jimo Road Market',
  지모루: 'Jimo Road Market',
  극지해양: 'Polar Ocean World',
  마추픽chu: 'Machu Picchu ancient ruins Peru',
  '마추 픽chu': 'Machu Picchu ancient ruins Peru',
  '세계 7대 불가사의 중 하나인 마추픽chu': 'Machu Picchu ancient ruins Peru',
  우유니사막: 'Salar de Uyuni salt flats Bolivia',
  '우유니 사막': 'Salar de Uyuni salt flats Bolivia',
  이과수폭포: 'Iguazu Falls waterfall panorama',
  '이과수 폭포': 'Iguazu Falls waterfall panorama',
  '세계 3대 폭포 이과수 폭포': 'Iguazu Falls waterfall panorama',
  링컨기념관: 'Lincoln Memorial Washington DC',
  '링컨 기념관': 'Lincoln Memorial Washington DC',
  제퍼슨기념관: 'Jefferson Memorial Washington DC',
  '제퍼슨 기념관': 'Jefferson Memorial Washington DC',
  엠파이어스테이트빌딩: 'Empire State Building New York',
  '엠파이어 스테이트 빌딩': 'Empire State Building New York',
  '나이아가라 폭포': 'Niagara Falls waterfall wide angle',
  스카이론전망대: 'Skylon Tower Niagara Falls',
  '스카이론 전망대': 'Skylon Tower Niagara Falls',
  노트르담대성당: 'Notre Dame Basilica Montreal interior',
  '노트르담 대성당': 'Notre Dame Basilica Montreal interior',
  몽모랑시폭포: 'Montmorency Falls Quebec',
  '몽모랑시 폭포': 'Montmorency Falls Quebec',
  그라운드제로: 'One World Trade Center New York',
  '그라운드 제로': 'One World Trade Center New York',
  천섬유람선: 'Thousand Islands St Lawrence River',
  '천섬 유람선': 'Thousand Islands St Lawrence River',
  /** REGRESSION-FREEZE[schedule-segment-poi-oceania-japan-europe]: NZ·AU routeText 세그먼트 — manifest */
  '로토루아 호수': 'Lake Rotorua',
  로토루아호수: 'Lake Rotorua',
  '아그로돔 양털깎이쇼': 'Agrodome Rotorua',
  아그로돜: 'Agrodome Rotorua',
  아그로돔: 'Agrodome Rotorua',
  '스카이라인 곤돌라': 'Skyline Rotorua gondola',
  스카이라인곤돌라: 'Skyline Rotorua gondola',
  '와카레와레와 마오리민속마을': 'Whakarewarewa Maori Village',
  '와카레와레와 마오리 민속마을': 'Whakarewarewa Maori Village',
  와카레와레와: 'Whakarewarewa Maori Village',
  '폴리네시안 스파': 'Polynesian Spa Rotorua',
  '쿠메우 지역 와이너리': 'Kumeu Valley wineries',
  쿠메우: 'Kumeu Valley wineries',
  미션베이: 'Mission Bay Auckland',
  '마이클 조셉 세비지 기념공원': 'Michael Joseph Savage Memorial Auckland',
  마이클조셉세비지기념공원: 'Michael Joseph Savage Memorial Auckland',
  에덴동산: 'Auckland Domain wintergardens',
  '퀸즈타운': 'Queenstown Lake Wakatipu',
  '퀸즈 타운': 'Queenstown Lake Wakatipu',
  크라이스트교회: 'Christ Church Cathedral Christchurch',
  '크라이스트 교회': 'Christ Church Cathedral Christchurch',
  '밀포드 사운드': 'Milford Sound New Zealand',
  밀포드사운드: 'Milford Sound New Zealand',
  '마운트 쿡': 'Mount Cook New Zealand',
  마운트쿡: 'Mount Cook New Zealand',
  '테카포 호수': 'Lake Tekapo Church of Good Shepherd',
  테카포: 'Lake Tekapo Church of Good Shepherd',
  '와이토모 동굴': 'Waitomo Glowworm Caves',
  와이토모: 'Waitomo Glowworm Caves',
  웨이티모: 'Waitomo Glowworm Caves',
  '그레이트 배리어 리프': 'Great Barrier Reef Cairns',
  그레이트배리어리프: 'Great Barrier Reef Cairns',
  '스카이 타워': 'Auckland Sky Tower',
  스카이타워: 'Auckland Sky Tower',
  '서퍼스 파라다이스': 'Surfers Paradise Gold Coast',
  '워너 브러더스': 'Warner Bros Movie World Gold Coast',
  '시드니 타워': 'Sydney Tower Eye',
  '하이드 파크': 'Hyde Park Sydney',
  '로얄 보타닉 가든': 'Royal Botanic Garden Sydney',
  세자매봉: 'Three Sisters Blue Mountains',
  '세 자매봉': 'Three Sisters Blue Mountains',
  '세 자매 봉': 'Three Sisters Blue Mountains',
  '에코 포인트': 'Echo Point Blue Mountains',
  에코포인트: 'Echo Point Blue Mountains',
  '시드니 동물원': 'Taronga Zoo Sydney',
  시드니동물원: 'Taronga Zoo Sydney',
  '세인트 메리 대성당': 'St Marys Cathedral Sydney',
  '세인트 메리스 대성당': 'St Marys Cathedral Sydney',
  '세인트 매리 대성당': 'St Marys Cathedral Sydney',
  '테즈메이트 호수': 'Lake Te Anau New Zealand',
  테아나우: 'Te Anau glowworm caves New Zealand',
  '파랑이티 해변': 'Piha Beach Auckland',
  /** REGRESSION-FREEZE[schedule-segment-poi-oceania-japan-europe]: 일본·유럽·중동·남미 routeText 세그먼트 — manifest */
  후지산: 'Mount Fuji Japan',
  '후지 산': 'Mount Fuji Japan',
  닛코동조궁: 'Nikko Toshogu Shrine',
  '닛코 동조궁': 'Nikko Toshogu Shrine',
  콜로세움: 'Colosseum Rome',
  '콜로세움 경기장': 'Colosseum Rome',
  사그라다파밀리아: 'Sagrada Familia Barcelona',
  '사그라다 파밀리아': 'Sagrada Familia Barcelona',
  '스위스 알프스': 'Swiss Alps Matterhorn',
  스위스알프스: 'Swiss Alps Matterhorn',
  페트라: 'Petra Treasury Jordan',
  '페트라 고대도시': 'Petra Treasury Jordan',
  마라케시: 'Marrakech Jemaa el-Fnaa',
  '마라케시 구시가': 'Marrakech medina Morocco',
  리우데자네이로: 'Rio de Janeiro Christ the Redeemer',
  '예수상': 'Christ the Redeemer Rio de Janeiro',
  /** REGRESSION-FREEZE[schedule-segment-poi-oceania-japan-europe]: NZ 남섬·섬 routeText 세그먼트 — manifest */
  '카와라우 번지': 'Kawarau Gorge Suspension Bridge',
  '카와라우 번지점프대': 'Kawarau Gorge Suspension Bridge',
  카와라우: 'Kawarau Gorge Suspension Bridge',
  애로우타운: 'Arrowtown historic street',
  '카우리번지점프': 'Nevis Bungy Queenstown',
  '카우리 번지': 'Nevis Bungy Queenstown',
  '퀸즈타운 가든': 'Queenstown Gardens',
  퀸즈타운가든: 'Queenstown Gardens',
  거울호수: 'Mirror Lakes Milford Sound',
  '거울 호수': 'Mirror Lakes Milford Sound',
  '호머 터널': 'Homer Tunnel',
  호머터널: 'Homer Tunnel',
  '선한 양치기의 교회': 'Church of Good Shepherd Lake Tekapo',
  '푸카키 호수': 'Lake Pukaki Mount Cook view',
  푸카키: 'Lake Pukaki Mount Cook view',
  '해글리 공원': 'Hagley Park Christchurch',
  '에이번 강': 'Avon River Christchurch',
  '모나 베일': 'Mona Vale Garden Christchurch',
  모나베일: 'Mona Vale Garden Christchurch',
  바이아덕트: 'Christchurch Tram city',
  '크라이스트처치 시내': 'Hagley Park Christchurch',
  '크라이스트처치 시내관광': 'Hagley Park Christchurch',
  '해밀턴 가든': 'Hamilton Gardens',
  해밀턴가든: 'Hamilton Gardens',
  '하무라나 스프링스': 'Hamurana Springs',
  하무라나: 'Hamurana Springs',
  '타우포 호수': 'Lake Taupo',
  타우포: 'Lake Taupo',
  후카폭포: 'Huka Falls',
  '후카 폭포': 'Huka Falls',
  '와이키테 밸리': 'Wai-O-Tapu geothermal Rotorua',
  와이키테: 'Wai-O-Tapu geothermal Rotorua',
  '와이오타푸': 'Wai-O-Tapu geothermal Rotorua',
  '레드우드 수목원': 'Redwoods Whakarewarewa Forest',
  '로토루아 레드우드': 'Redwoods Whakarewarewa Forest',
  레드우드: 'Redwoods Whakarewarewa Forest',
  '마오리족 민속공연': 'Whakarewarewa Maori Village',
}

/** 테마 태그(themeTags) 한국어/혼용 → Pexels 검색용 영어 (후순위 fallback) */
const THEME_TAG_MAP: Record<string, string> = {
  해변: 'beach',
  오션뷰: 'ocean view',
  바다: 'beach',
  허니문: 'honeymoon',
  신혼: 'honeymoon',
  가족: 'family travel',
  가족여행: 'family travel',
  테마파크: 'theme park',
  놀이공원: 'theme park',
  야경: 'night view',
  럭셔리: 'luxury travel',
  리조트: 'resort',
  스파: 'spa resort',
  골프: 'golf',
  크루즈: 'cruise',
  자연: 'nature landscape',
  전통: 'traditional culture',
  힐링: 'nature relaxation',
  맛집: 'food travel',
  쇼핑: 'shopping',
  시티: 'city',
  도시: 'city',
  문화: 'culture',
  역사: 'historic',
  오지: 'nature',
}

const MAX_TERMS = 3
const MAX_LENGTH = 50
const MAX_ATTRACTION_WORDS = 4

const POI_KO_KEYS_SORTED = Object.keys(POI_KO_TO_EN).sort((a, b) => b.length - a.length)

/** 목적지 고정 명소 — 동일 텍스트에 해당 지역·허브 언급 없으면 매핑 금지(지역별 POI 테이블 대신 문맥 SSOT) */
// REGRESSION-FREEZE[pexels-keyword-kk-fireflies-context]: KK·말레이 명소 — 코타/키나발루 문맥 없으면 반딧불 등 매핑 금지 — manifest
const POI_KO_MAPPING_CONTEXT_RE: Record<string, RegExp> = {
  '선셋 반딧불': /코타|키나발루|Kinabalu|Kota|말레이|Malaysia|만따나니|Mantanani/i,
  '선셋 반딧불이': /코타|키나발루|Kinabalu|Kota|말레이|Malaysia|만따나니|Mantanani/i,
  '코타키나발루 시티 모스크': /코타|키나발루|Kinabalu|Kota|말레이|Malaysia/i,
  '이슬람 사원': /코타|키나발루|Kinabalu|Kota|말레이|Malaysia|KK/i,
  키나발루: /코타|키나발루|Kinabalu|Kota|말레이|Malaysia|국립\s*공원/i,
  '키나발루 국립공원': /코타|키나발루|Kinabalu|Kota|말레이|Malaysia/i,
  만따나니: /코타|키나발루|Kinabalu|Kota|말레이|Malaysia|Mantanani/i,
  '만따나니 아일랜드': /코타|키나발루|Kinabalu|Kota|말레이|Malaysia|Mantanani/i,
  나라: /(?:奈良|나라시|Nara|일본|Japan|오사카|Osaka|Kyoto|교토)/i,
  /** Manado·술라웨시 축복 예수상 — 리우 Christ와 분리. bare 리우 금지(불리우는). */
  예수상: /(?:리우\s*데|리오\s*데|Rio\s*de\s*Janeiro|브라질|Brazil|Corcovado|코르코바도)/i,
}

function poiKoMappingAllowed(ko: string, text: string): boolean {
  const req = POI_KO_MAPPING_CONTEXT_RE[ko]
  if (!req) return true
  return req.test(text)
}

/**
 * 영문 키워드에 DESTINATION_MAP 허브가 들어 있는데 상품·당일 routeText에 근거가 없으면 true.
 * 지역별 POI 목록 없이 공용 도시 사전만으로 타 목적지 bleed 차단.
 */
export function scheduleKeywordEmbedsForeignDestinationHub(
  keyword: string | null | undefined,
  productDestination: string | null | undefined,
  rowHaystack: string,
): boolean {
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  const kwNorm = normalizeSemanticPoiKey(raw)
  if (!kwNorm) return false
  const evidence = [productDestination, rowHaystack].filter(Boolean).join('\n')
  const evidenceLower = evidence.toLowerCase()
  for (const [ko, en] of Object.entries(DESTINATION_MAP)) {
    const enNorm = normalizeSemanticPoiKey(en)
    if (!enNorm || enNorm.length < 4) continue
    if (!kwNorm.includes(enNorm) && !raw.toLowerCase().includes(en.toLowerCase())) continue
    if (evidence.includes(ko) || evidenceLower.includes(en.toLowerCase())) continue
    return true
  }
  return false
}

/**
 * 스크래퍼·공급사 페이지에 섞인 JSON/API 덤프가 title·destination 등에 들어오면
 * Pexels/Gemini 검색어가 `"gnbMenuEventTypeWebCode":null` 같은 문자열로 오염된다 — 미디어용으로 제외.
 */
export function isLikelyJsonOrWebApiDump(s: string | null | undefined): boolean {
  if (!s?.trim()) return false
  const t = s.trim()
  // 객체형 페이지/API 덤프 (상품명·목적지 필드에 붙는 경우)
  if (t.startsWith('{') && /"[^"]+"\s*:/.test(t)) return true
  if (t.includes('gnbMenuEventTypeWebCode') || t.includes('"gnbMenu')) return true
  if (t.includes('openapi.naver.com') || t.includes('nid.naver.com')) return true
  // `[` 로 시작하는 건 정상 schedule 배열일 수 있음 — 배열이 아닌 긴 덤프만
  const keyLike = t.match(/"[\w]+"\s*:/g)
  if (!t.startsWith('[') && keyLike && keyLike.length >= 4 && t.length > 80) return true
  return false
}

function mediaSafe(s: string | null | undefined): string | null {
  if (s == null || s === '') return s ?? null
  return isLikelyJsonOrWebApiDump(s) ? null : s
}

/** 일정 이미지·중복 제거용: 동일 명소 판별 */
export function normalizeSemanticPoiKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
}

export function mapKoreanPoiSegment(segment: string): string {
  const t = segment.trim()
  if (!t) return ''
  const compact = t.replace(/\s+/g, '')
  for (const ko of POI_KO_KEYS_SORTED) {
    if (!koreanHaystackIncludesMapToken(t, ko) && !koreanHaystackIncludesMapToken(compact, ko)) continue
    if (!poiKoMappingAllowed(ko, t)) continue
    return POI_KO_TO_EN[ko] ?? ''
  }
  return ''
}

/** routeText·일정 본문에서 매핑 가능한 한글 POI를 긴 키 우선·중복 없이 모두 수집 */
export function findAllMappedKoreanPoisInText(text: string): string[] {
  return findMappedKoreanPoisInTextByMentionOrder(text).map((x) => x.en)
}

/** 본문 등장 순서대로 매핑된 한글 POI → 영문 (일정 1순위 명소 선택용) */
export function findMappedKoreanPoisInTextByMentionOrder(text: string): Array<{ en: string; idx: number }> {
  const t = String(text ?? '').trim()
  if (!t) return []
  const out: Array<{ en: string; idx: number }> = []
  const seen = new Set<string>()
  for (const ko of POI_KO_KEYS_SORTED) {
    if (!koreanHaystackIncludesMapToken(t, ko)) continue
    if (!poiKoMappingAllowed(ko, t)) continue
    const en = (POI_KO_TO_EN[ko] ?? '').trim()
    if (!en) continue
    const key = en.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ en, idx: t.indexOf(ko) })
  }
  out.sort((a, b) => a.idx - b.idx)
  return out
}

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

/** 짧은 한글 토큰(나라 등) — "나라의" 같은 부분문자열 오매칭 방지 */
export function koreanHaystackIncludesMapToken(haystack: string, token: string): boolean {
  const t = haystack.trim()
  const ko = token.trim()
  if (!t || !ko) return false
  const compactHay = t.replace(/\s+/g, '')
  const compactKo = ko.replace(/\s+/g, '')
  if ([...ko].length <= 3) {
    const escaped = ko.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(t)) return true
    if (compactKo.length <= 3 && compactHay.includes(compactKo)) {
      const idx = compactHay.indexOf(compactKo)
      const before = idx > 0 ? compactHay[idx - 1]! : ''
      const after = idx + compactKo.length < compactHay.length ? compactHay[idx + compactKo.length]! : ''
      const isHangul = (ch: string) => /\p{Script=Hangul}/u.test(ch)
      if (!isHangul(before) && !isHangul(after)) return true
    }
    return false
  }
  return t.includes(ko) || compactHay.includes(compactKo)
}

/** `DESTINATION_MAP` 단일 단어 도시·국가명만 — 복합 지명(타지마할·Palas de Rei 등)은 false */
export function isKnownDestinationCityEnglishKeyword(kw: string): boolean {
  const words = kw.trim().split(/\s+/).filter(Boolean)
  if (words.length !== 1) return false
  const k = normalizeSemanticPoiKey(kw)
  if (!k) return false
  for (const en of Object.values(DESTINATION_MAP)) {
    if (en.trim().split(/\s+/).filter(Boolean).length !== 1) continue
    if (normalizeSemanticPoiKey(en) === k) return true
  }
  return false
}

/** `DESTINATION_MAP` 영문 값과 동일 — Hong Kong·Kota Kinabalu 등 복합 허브 도시명 */
export function isDestinationMapEnglishHubKeyword(kw: string): boolean {
  const nk = normalizeSemanticPoiKey(kw)
  if (!nk) return false
  for (const en of Object.values(DESTINATION_MAP)) {
    if (normalizeSemanticPoiKey(en) === nk) return true
  }
  return false
}

/** 상품 목적지와 동일한 허브 도시·지역(Phu Quoc 등 복합 지명 포함) */
export function isDestinationHubEnglishKeyword(
  kw: string,
  productDestination: string | null | undefined,
): boolean {
  if (isKnownDestinationCityEnglishKeyword(kw)) return true
  const destEn = mapDestination(String(productDestination ?? '').trim())
  if (!destEn) return false
  return normalizeSemanticPoiKey(kw) === normalizeSemanticPoiKey(destEn)
}

export function mapDestination(destination: string | null): string {
  if (!destination) return ''
  if (isLikelyJsonOrWebApiDump(destination)) return ''
  const t = normalize(destination)
  if (!t) return ''
  for (const ko of DESTINATION_MAP_KEYS_SORTED) {
    if (koreanHaystackIncludesMapToken(t, ko)) return DESTINATION_MAP[ko] ?? ''
  }
  return t
}

function mapRegion(region: string | null): string {
  if (!region) return ''
  if (isLikelyJsonOrWebApiDump(region)) return ''
  const t = normalize(region)
  if (!t) return ''
  for (const [ko, en] of Object.entries(REGION_MAP)) {
    if (t.includes(ko)) return en
  }
  return t
}

/** themeTags 쉼표 구분에서 첫 번째 유효 태그를 영어로 매핑 */
function mapFirstThemeTag(themeTags: string | null): string {
  if (!themeTags) return ''
  if (isLikelyJsonOrWebApiDump(themeTags)) return ''
  const tags = themeTags
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const tag of tags) {
    const lower = tag.toLowerCase()
    for (const [ko, en] of Object.entries(THEME_TAG_MAP)) {
      if (tag.includes(ko) || lower === ko.toLowerCase()) return en
    }
    if (/^[a-zA-Z\s]+$/.test(tag) && tag.length <= 20) return tag
  }
  return ''
}

/** 2~4단어, 짧은 실전 검색어 */
export function sanitizeAttractionPhrase(s: string | null | undefined): string {
  if (!s) return ''
  let t = normalize(s)
  if (!t) return ''
  const words = t.split(/\s+/).filter(Boolean).slice(0, MAX_ATTRACTION_WORDS)
  t = words.join(' ')
  if (t.length > MAX_LENGTH) t = t.slice(0, MAX_LENGTH).trim()
  return t
}

/**
 * 일정/POI 한 줄에서 Pexels용 **영문 관광지명**을 우선 추출.
 * 1) `POI_KO_TO_EN` 매핑 2) 괄호 안 라틴 구문 3) 짧은 라틴만으로 된 토큰
 */
export function extractEnglishPoiFromLabel(label: string | null | undefined): string {
  if (!label?.trim()) return ''
  const t = label.trim()
  const mapped = mapKoreanPoiSegment(t)
  if (mapped) {
    const q = sanitizeAttractionPhrase(mapped)
    if (q) return q
  }
  const paren = t.match(/\(\s*([A-Za-z][A-Za-z0-9\s,.'-]{2,48})\s*\)/)
  if (paren?.[1]) {
    const q = sanitizeAttractionPhrase(paren[1])
    if (q && isLatinAttractionName(q)) return q
  }
  if (isLatinAttractionName(t)) return sanitizeAttractionPhrase(t)
  return ''
}

/** 라틴 문자 위주인 명소명(편명·검색에 적합) */
function isLatinAttractionName(s: string): boolean {
  if (!s || s.length < 2) return false
  const letters = s.replace(/[^a-zA-Z]/g, '').length
  return letters >= Math.min(4, s.length * 0.5)
}

/** poiNamesRaw: 매핑된 한글 명소 → 영어, 없으면 첫 라틴 구간 */
function firstPoiFromRaw(poiNamesRaw: string | null | undefined): string {
  if (isLikelyJsonOrWebApiDump(poiNamesRaw)) return ''
  const hit = firstPoiSearchTermExcluding(poiNamesRaw, new Set())
  return hit ?? ''
}

/**
 * 이전 일차에서 이미 쓴 명소(semantic key)는 제외하고 첫 검색어 후보 반환.
 */
export function firstPoiSearchTermExcluding(
  poiNamesRaw: string | null | undefined,
  excludeKeys: Set<string>
): string | null {
  if (!poiNamesRaw?.trim()) return null
  const parts = poiNamesRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  for (const p of parts) {
    const mapped = mapKoreanPoiSegment(p)
    if (mapped) {
      const q = sanitizeAttractionPhrase(mapped)
      if (q) {
        if (excludeKeys.has(normalizeSemanticPoiKey(q))) continue
        return q
      }
    }
    const q = sanitizeAttractionPhrase(p)
    if (!q) continue
    if (!isLatinAttractionName(q)) continue
    if (excludeKeys.has(normalizeSemanticPoiKey(q))) continue
    return q
  }
  return null
}

/**
 * 상품명 등에서 라틴 명소·지명 구만 추출 (짧은 영문 슬러그 우선).
 * 목적지+테마보다 앞에 두어 "여행 분위기" 키워드보다 실제 장소 이미지에 가깝게 한다.
 */
export function extractLatinPhraseFromTitle(title: string | null): string {
  if (!title?.trim()) return ''
  if (isLikelyJsonOrWebApiDump(title)) return ''
  const chunks = title
    .split(/[|·/\\[\]()\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const tryPhrase = (chunk: string): string => {
    const m = chunk.match(
      /\b([A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*){1,3})\b/
    )
    if (!m?.[1]) return ''
    const q = sanitizeAttractionPhrase(m[1])
    return q && isLatinAttractionName(q) ? q : ''
  }
  for (const chunk of chunks) {
    const hit = tryPhrase(chunk)
    if (hit) return hit
  }
  const whole = tryPhrase(title)
  return whole
}

/**
 * Product.schedule JSON에서 imageKeyword(영문 장소) 우선, 없으면 짧은 title.
 */
export function extractAttractionFromScheduleJson(scheduleJson: string | null | undefined): string {
  if (!scheduleJson || typeof scheduleJson !== 'string') return ''
  if (isLikelyJsonOrWebApiDump(scheduleJson)) return ''
  try {
    const arr = JSON.parse(scheduleJson) as unknown
    if (!Array.isArray(arr)) return ''
    for (const item of arr) {
      const o = item as Record<string, unknown>
      const kw =
        typeof o.imageKeyword === 'string'
          ? o.imageKeyword.trim()
          : typeof (o as { image_keyword?: string }).image_keyword === 'string'
            ? String((o as { image_keyword?: string }).image_keyword).trim()
            : ''
      if (kw && !isLikelyJsonOrWebApiDump(kw)) {
        const segment = kw.split(' / ')[0]?.trim() ?? kw
        const place = normalizeToPlaceName(segment)
        if (place) return place
        const q = sanitizeAttractionPhrase(segment)
        if (q) return normalizeToPlaceName(q) || q
      }
    }
    for (const item of arr) {
      const o = item as Record<string, unknown>
      const title = typeof o.title === 'string' ? o.title.trim() : ''
      if (title && title.length <= 45 && !isLikelyJsonOrWebApiDump(title)) {
        const q = sanitizeAttractionPhrase(title)
        if (q && isLatinAttractionName(q)) return q
      }
    }
  } catch {
    return ''
  }
  return ''
}

/**
 * 상품/일정 기반 Pexels 검색 키워드 생성 (관광지 우선).
 * 우선순위: 1) attractionName 2) poiNamesRaw(한글 명소 매핑 → 영어, 또는 라틴 구) 3) schedule.imageKeyword·일정 제목
 * 4) 상품명에서 추출한 짧은 라틴 명소 구 5) 도시 + landmark / attraction / travel landmark
 * 6) 목적지 + 테마·지역 7) 상품명 단어 8) travel
 * displayCategory는 검색어에 넣지 않음.
 */
export type TravelSubjectEnMediaOptions = {
  destination: string | null
  primaryRegion: string | null
  themeTags: string | null
  title: string | null
  /** 관리자/추출에서 넘긴 명소 1순위 (영문 권장) */
  attractionName?: string | null
  /** ItineraryDay.poiNamesRaw 등 — 쉼표 구분 */
  poiNamesRaw?: string | null
  /** Product.schedule JSON 문자열 */
  scheduleJson?: string | null
}

/**
 * Pexels 검색어·Gemini 장면 묘사의 공통 **영문 주제** SSOT (짧은 키워드 조각).
 * `buildPexelsKeyword` / `buildGeminiImagePrompt`는 각각 검색·이미지 지시문으로만 감싼다.
 */
export function resolveTravelSubjectEnForMedia(options: TravelSubjectEnMediaOptions): string {
  const { destination, primaryRegion, themeTags, title, attractionName, poiNamesRaw, scheduleJson } = options
  const destIn = mediaSafe(destination) ?? null
  const titleIn = mediaSafe(title) ?? null
  const attrIn = mediaSafe(attractionName) ?? null
  const themeIn = mediaSafe(themeTags) ?? null
  const regionIn = mediaSafe(primaryRegion) ?? null

  const destEn = mapDestination(destIn)
  const themeEn = mapFirstThemeTag(themeIn)
  const regionEn = mapRegion(regionIn)

  const explicit = normalizeToPlaceName(attrIn ?? '')
  if (explicit) return explicit

  const fromPoi = firstPoiFromRaw(poiNamesRaw)
  if (fromPoi) {
    const n = normalizeToPlaceName(fromPoi)
    if (n) return n
  }

  const fromSchedule = extractAttractionFromScheduleJson(scheduleJson ?? null)
  if (fromSchedule) return fromSchedule

  const fromTitleLatin = extractLatinPhraseFromTitle(titleIn)
  if (fromTitleLatin) {
    const n = normalizeToPlaceName(fromTitleLatin)
    if (n) return n
  }

  if (destEn) {
    const cityOnly = normalizeToPlaceName(destEn)
    if (cityOnly) return cityOnly
  }

  const parts: string[] = []
  if (destEn) parts.push(destEn)
  if (themeEn) parts.push(themeEn)
  else if (regionEn && !destEn) parts.push(regionEn)
  else if (regionEn && destEn && parts.length < 2) parts.push(regionEn)

  let query = parts.slice(0, MAX_TERMS).join(' ')
  if (query.length > MAX_LENGTH) query = query.slice(0, MAX_LENGTH).trim()
  if (query) {
    const n = normalizeToPlaceName(query)
    return n || query
  }

  const titleWords = (titleIn ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
  query = titleWords.join(' ')
  if (query.length > MAX_LENGTH) query = query.slice(0, MAX_LENGTH).trim()
  const n = normalizeToPlaceName(query)
  return n || query || destEn || ''
}

export function buildPexelsKeyword(options: TravelSubjectEnMediaOptions): string {
  return resolveTravelSubjectEnForMedia(options)
}
