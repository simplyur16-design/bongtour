/**
 * 등록 일정 imageKeyword — 한글 routeText·본문 → 영문 POI/도시 (전 공급사 공용 SSOT).
 * 공급사별 지역 ROI 테이블 금지 — 이 파일 + lib/pexels-keyword.ts POI_KO_TO_EN 만 사용.
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 공급사 모듈에 POI/CITY regex 중복 금지 — manifest
 * REGRESSION-FREEZE[schedule-segment-poi-oceania-japan-europe]: NZ·AU·일본·유럽·중동·남미 routeText 세그먼트 — manifest
 */
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'
import { mapDestination, mapKoreanPoiSegment, normalizeSemanticPoiKey } from '@/lib/pexels-keyword'

export type SchedulePoiRegexRule = { re: RegExp; en: string }

export const SCHEDULE_SPOT_KO_REGEX_RULES: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /내원교/u, en: "Japanese Covered Bridge" },
  { re: /호이안\s*고대\s*도시|호이안\s*올드\s*타운|호이안\s*고성/u, en: "Hoi An Ancient Town" },
  { re: /^호이안$/u, en: "Hoi An Ancient Town" },
  { re: /영흥사|손짜/u, en: "Linh Ung Pagoda" },
  { re: /다낭\s*대성당/u, en: "Da Nang Cathedral" },
  { re: /미케\s*비치/u, en: "My Khe Beach" },
  { re: /천주교당|성미카엘/u, en: "St Michael's Cathedral" },
  { re: /잔교/u, en: "Zhanqiao Pier" },
  { re: /54광장|5\.4광장/u, en: "May Fourth Square" },
  { re: /올림픽\s*요트|요트\s*경기장/u, en: "Qingdao Olympic Sailing Center" },
  { re: /지모루|찌모루/u, en: "Jimo Road Market" },
  { re: /죠잔케이|Jozankei|定山渓/u, en: "Jozankei" },
  { re: /오쿠라야마|Okurayama/i, en: "Okurayama Ski Jump Stadium" },
  { re: /미츠이\s*아울렛|Mitsui\s*Outlet/i, en: "Mitsui Outlet Park Sapporo" },
  { re: /후라노\s*와인|Furano\s*Wine/i, en: "Furano Wine House" },
  { re: /팜\s*도미타|Farm\s*Tomita/i, en: "Farm Tomita Furano" },
  { re: /시키사이노오카|Shikisai/i, en: "Shikisai-no-Oka Biei" },
  { re: /(?:청의\s*호수|아오이케|Blue\s*Pond)/i, en: "Blue Pond Biei" },
  { re: /은하폭포|Ginga\s*Falls/i, en: "Ginga Falls Sounkyo" },
  { re: /유성폭포|Ryusei\s*Falls/i, en: "Ryusei Falls Sounkyo" },
  { re: /기타이치|Kitaichi/i, en: "Kitaichi Glass Otaru" },
  { re: /시로이\s*코이비토|Shiroi\s*Koibito/i, en: "Shiroi Koibito Park" },
  { re: /삿포로\s*시계탑|Sapporo\s*Clock/i, en: "Sapporo Clock Tower" },
  { re: /^후라노$/u, en: "Farm Tomita Furano" },
  { re: /^비에이$/u, en: "Shikisai-no-Oka Biei" },
  { re: /^소운쿄$/u, en: "Sounkyo Gorge" },
  { re: /^치토세$/u, en: "New Chitose Airport" },
  { re: /노보리베츠.*지옥|지옥\s*계곡|Jigokudani/u, en: "Noboribetsu Jigokudani" },
  { re: /오타루\s*운하|Otaru\s*Canal/u, en: "Otaru Canal" },
  { re: /오르골|Music\s*Box/u, en: "Otaru Music Box Museum" },
  { re: /오도리\s*공원|Odori\s*Park/u, en: "Odori Park" },
  { re: /도야\s*호수|Lake\s*Toya/u, en: "Lake Toya" },
  { re: /소호\s*거리|SoHo(?!\s*Hong)/iu, en: "SoHo Hong Kong" },
  { re: /타이쿤|Tai\s*Kwun/u, en: "Tai Kwun" },
  { re: /헐리우드\s*로드|Hollywood\s*Road/u, en: "Hollywood Road Hong Kong" },
  { re: /미드[-\s]*레벨\s*에스컬레이터|Mid[-\s]*level\s*Escalator/u, en: "Mid-Levels Escalator" },
  { re: /리퉁\s*애비뉴|Li\s*Yuen|L\.?\s*Yuen/i, en: "Li Yuen Street Hong Kong" },
  { re: /블루\s*하우스|Blue\s*House/u, en: "Blue House Hong Kong" },
  { re: /빅토리아\s*피크|Victoria\s*Peak/u, en: "Victoria Peak" },
  { re: /피크\s*트램|Peak\s*Tram/u, en: "Peak Tram" },
  { re: /웡타이신|Wong\s*Tai\s*Sin/u, en: "Wong Tai Sin Temple" },
  { re: /성\s*바울\s*성당|Ruins\s*of\s*St\.?\s*Paul|St\.?\s*Paul'?s?/iu, en: "Ruins of St. Paul's" },
  { re: /세나두\s*광장|Senado\s*Square/u, en: "Senado Square" },
  { re: /침사추이\s*해변|연인의\s*거리|스타의\s*거리|Avenue\s*of\s*Stars/u, en: "Avenue of Stars Hong Kong" },
  { re: /술탄\s*아흐메트|블루\s*모스크|Sultan\s*Ahmed/i, en: "Sultan Ahmed Mosque Istanbul" },
  { re: /그랜드\s*바자르|Grand\s*Bazaar/i, en: "Grand Bazaar Istanbul" },
  { re: /투즈괼|소금\s*호수|Lake\s*Tuz/i, en: "Lake Tuz salt lake Turkey" },
  { re: /데린쿠유|지하\s*도시|Derinkuyu/i, en: "Derinkuyu Underground City Cappadocia" },
  { re: /괴레메|Goreme|Göreme/i, en: "Goreme Cappadocia fairy chimneys" },
  { re: /우치히사르|Uchisar/i, en: "Uchisar Castle Cappadocia" },
  { re: /데브란트|Devrent/i, en: "Devrent Valley Cappadocia" },
  { re: /카파도키아|카파토키아|Cappadocia/i, en: "Cappadocia hot air balloons sunrise" },
  { re: /오브룩|담수호|Obruk/i, en: "Obruk Lake Turkey sinkhole" },
  { re: /이블리\s*미나레|Yivli\s*Minaret/i, en: "Yivli Minaret Antalya" },
  { re: /하드리아누스|Hadrian/i, en: "Hadrian's Gate Antalya" },
  { re: /히에라폴리스|Hierapolis/i, en: "Hierapolis ancient ruins Pamukkale" },
  { re: /석회붕|파묵칼레|Pamukkale/i, en: "Pamukkale travertine terraces Turkey" },
  { re: /쉬린제|Sirince|Şirince/i, en: "Sirince village Turkey wine houses" },
  { re: /에페소|Efes|Ephesus/i, en: "Ephesus ancient ruins Library of Celsus Turkey" },
  { re: /에페수스|Ephesus/i, en: "Ephesus ancient library ruins Turkey" },
  { re: /(부르사|Bursa)/i, en: "Green Tomb Bursa Turkey" },
  { re: /성\s*소피아|아야\s*소피아|Hagia\s*Sophia/i, en: "Hagia Sophia Istanbul interior dome" },
  { re: /역사\s*박물관|Archaeological\s*Museum/i, en: "Istanbul Archaeological Museum" },
  { re: /톱카프|Topkapi|Topkapı/i, en: "Topkapi Palace Istanbul courtyard" },
  { re: /발랏|Balat/i, en: "Balat Istanbul colorful houses street" },
  { re: /보스포러스|Bosphorus|Bosporus/i, en: "Bosphorus Strait Istanbul cruise view" },
  { re: /피엘로티|Pierre\s*Loti/i, en: "Pierre Loti Hill Istanbul cable car view" },
  { re: /포나가(?:\s*참)?(?:\s*사원)?|포나가르|Po Nagar|Cham Towers/i, en: "Po Nagar Cham Towers" },
  { re: /달랏\s*꽃\s*정원|Dalat Flower|Da Lat Flower/i, en: "Da Lat Flower Garden Vietnam" },
  { re: /달랏|Da Lat|Dalat/i, en: "Da Lat Vietnam highland city" },
  { re: /나트랑|Nha Trang/i, en: "Nha Trang beach Vietnam" },
  { re: /(?:유|우)원|豫园|예원/u, en: "Yu Garden Shanghai" },
  { re: /외탄|外灘|外滩|와탄/u, en: "Shanghai Bund skyline" },
  { re: /항주|杭州|서호|西湖/u, en: "West Lake Hangzhou" },
  { re: /송성|宋城|송가무|가무쇼/u, en: "Songcheng Park Hangzhou" },
  { re: /청황|城隍/u, en: "City God Temple of Shanghai" },
  { re: /동방명주|东方明珠/u, en: "Oriental Pearl Tower Shanghai" },
  { re: /주가각|朱家角/u, en: "Zhujiajiao water town canal bridge" },
  { re: /우캉\s*루|武康路/u, en: "Wukang Road Shanghai" },
  { re: /남경\s*로|南京路/u, en: "Nanjing Road Shanghai" },
  { re: /에펠\s*탑|에펠탑|Eiffel/i, en: "Eiffel Tower Paris" },
  { re: /개선문/u, en: "Arc de Triomphe Paris" },
  { re: /몽생미셸|Mont\s*Saint\s*Michel/i, en: "Mont Saint Michel abbey" },
  { re: /시부야|渋谷/u, en: "Shibuya crossing Tokyo night" },
  { re: /하라주쿠|原宿/u, en: "Harajuku Takeshita street Tokyo" },
  { re: /금각사|金閣寺/u, en: "Kinkakuji golden pavilion Kyoto" },
  { re: /은각사|銀閣寺/u, en: "Ginkakuji temple Kyoto" },
  { re: /후시미\s*이나리|伏見稲荷/u, en: "Fushimi Inari Shrine / thousand vermilion torii gates / eye-level front view" },
  { re: /도톤보리|道頓堀/u, en: "Dotonbori Osaka night" },
  { re: /(?:유|우)니버설|USJ/u, en: "Universal Studios Japan Osaka" },
  { re: /도쿄\s*디즈니|디즈니(?:랜드|씨)/u, en: "Tokyo Disneyland castle" },
  { re: /돗토리\s*사구|Tottori\s*Sand/i, en: "Tottori Sand Dunes" },
  { re: /코난\s*박물관|고쇼\s*아오야마|Gosho\s*Aoyama|Manga\s*Factory/i, en: "Gosho Aoyama Manga Factory" },
  { re: /20\s*세기\s*배|나싯코\s*관|20segi/i, en: "Tottori Nashi Pear Museum" },
  { re: /아다치\s*미술관|Adachi\s*Museum/i, en: "Adachi Museum of Art" },
  { re: /마츠에성|마쓰에성|Matsue\s*Castle/i, en: "Matsue Castle" },
  { re: /미즈키\s*시게루|Mizuki\s*Shigeru/i, en: "Mizuki Shigeru Road" },
  { re: /시오미\s*나와테|Shiomi\s*Nawate/i, en: "Shiomi Nawate Samurai Street" },
  { re: /타이페이\s*101|台北\s*101|타이편\s*101/u, en: "Taipei 101 tower night" },
  { re: /지우펀|九份/u, en: "Jiufen old street Taiwan night" },
  { re: /백두산/u, en: "Changbai Mountain scenic view" },
  { re: /이도백하/u, en: "Erdaobaihe river town Changbai" },
  { re: /금강\s*대?\s*협곡/u, en: "Mount Geumgang gorge scenic" },
  { re: /수안\s*후엉|Xuan\s*Huong/i, en: "Xuan Huong Lake Da Lat / pine forest shore / wide angle" },
  { re: /두오모|Duomo|피렌체\s*성당/i, en: "Florence Cathedral Duomo / red dome plaza / front view" },
  { re: /시뇨리아|Signoria/i, en: "Piazza della Signoria Florence / Palazzo Vecchio / daytime" },
  { re: /베키오|Ponte Vecchio/i, en: "Ponte Vecchio Florence / Arno River / wide angle" },
  { re: /우피치|Uffizi/i, en: "Uffizi Gallery Florence / courtyard / front view" },
  { re: /피렌체|Florence|Firenze/i, en: "Florence Duomo / historic center / wide angle" },
  { re: /산\s*지미냐노|San Gimignano/i, en: "San Gimignano medieval towers / Tuscany hills / wide angle" },
  { re: /베로나|Verona/i, en: "Verona Arena / Roman amphitheater / front view" },
  { re: /오르티세이|Ortisei/i, en: "Ortisei Dolomites / alpine village / wide angle" },
  { re: /볼차노|Bolzano/i, en: "Bolzano South Tyrol / Dolomites gateway / street view" },
  { re: /코르티나|Cortina/i, en: "Cortina d Ampezzo Dolomites / mountain peaks / wide angle" },
  { re: /베니스|Venice|Venezia/i, en: "Venice Grand Canal / gondolas / wide angle" },
  { re: /산\s*마리노|San Marino/i, en: "San Marino historic fortress / hilltop view / wide angle" },
  { re: /몬테카티니|Montecatini/i, en: "Montecatini Terme spa town / Tuscany / street view" },
  { re: /볼로냐|Bologna/i, en: "Bologna Two Towers / historic center / front view" },
  { re: /마르쿠스|St\.?\s*Mark|산\s*마르코/i, en: "St Mark's Basilica Venice / Piazza San Marco / front view" },
  { re: /요호|Yoho/i, en: "Yoho National Park / Emerald Lake / wide angle" },
  { re: /페이토|Peyto/i, en: "Peyto Lake / turquoise water / overlook view" },
  { re: /아사바스카|Athabasca/i, en: "Athabasca Falls / Rocky Mountains / wide angle" },
  { re: /레이크\s*루이스|Lake Louise/i, en: "Lake Louise / turquoise lake / mountain backdrop" },
  { re: /모레인|Moraine/i, en: "Moraine Lake / Valley of Ten Peaks / wide angle" },
  { re: /보우\s*폭포|Bow Falls/i, en: "Bow Falls Banff / river cascade / wide angle" },
  { re: /미네완카|Minnewanka/i, en: "Lake Minnewanka Banff / mountain lake / wide angle" },
  { re: /캘거리|Calgary/i, en: "Calgary Tower / downtown skyline / wide angle" },
  { re: /밴프|Banff/i, en: "Banff townsite / Rocky Mountains / street view" },
  { re: /고랑서|鼓浪屿|Gulangyu/i, en: "Gulangyu Island" },
  { re: /남정토루|Nanjing Tulou/i, en: "Nanjing Tulou Fujian" },
  { re: /유창루|Hongkeng/i, en: "Hongkeng Tulou Cluster" },
  { re: /탑하촌|Taxia/i, en: "Taxia Tulou Village" },
  { re: /숙장화원|Shuzhuang/i, en: "Shuzhuang Garden Gulangyu" },
  { re: /일광암|Sunlight Rock/i, en: "Sunlight Rock Gulangyu" },
  { re: /환도로|Huandao/i, en: "Xiamen Huandao Road" },
  { re: /증조안|Zengcuoan/i, en: "Zengcuoan Xiamen" },
  { re: /남보타사|Nanputuo/i, en: "Nanputuo Temple" },
  { re: /(?:하문|샤먼|厦門|厦门|Xiamen).{0,20}중산로|중산로.{0,20}(?:하문|샤먼|厦門|厦门|Xiamen)/u, en: "Zhongshan Road Xiamen" },
  { re: /(?:칭다오|청도|Qingdao).{0,20}중산로|중산로.{0,20}(?:칭다오|청도|Qingdao)/u, en: "Zhongshan Road Qingdao" },
  { re: /코타\s*키나발루|Kota\s*Kinabalu/i, en: 'Kota Kinabalu Malaysia' },
  { re: /페트로나스|Petronas/i, en: 'Petronas Twin Towers Kuala Lumpur' },
  { re: /바투\s*동굴|Batu\s*Caves/i, en: 'Batu Caves Kuala Lumpur' },
  { re: /메르데카\s*광장|Merdeka\s*Square/i, en: 'Merdeka Square Kuala Lumpur' },
  { re: /쳉훈텡|Cheng\s*Hoon\s*Teng/i, en: 'Cheng Hoon Teng Temple Malacca' },
  { re: /쿠알라룸푸르\s*왕궁|Istana\s*Negara/i, en: 'Istana Negara Kuala Lumpur' },
  { re: /겐팅\s*하이랜드|겐팅|Genting/i, en: 'Genting Highlands Malaysia' },
  { re: /(?:^|\s)레(?:\s|$|-)(?=.*(?:왕궁|시장|Palace|Ladakh|라다크))/u, en: "Leh Palace Ladakh" },
  { re: /^(?:레|Leh)$/iu, en: "Leh Palace Ladakh" },
  { re: /\bLeh(?:\s+Palace|\s+Ladakh)?\b/i, en: "Leh Palace Ladakh" },
  { re: /몰디브|Maldives/i, en: "Maldives overwater villa turquoise lagoon aerial" },
  { re: /(?:르메르디앙|Le\s*Meridien|Meridien)/i, en: "Maldives overwater bungalow resort aerial" },
  { re: /하우스\s*리프|House\s*Reef/i, en: "Maldives house reef snorkeling turquoise water" },
  { re: /Bodu\s*Finolhu|보두\s*피놀후/i, en: "Maldives white sand beach palm trees aerial" },
  { re: /달랏|Da Lat|Dalat/i, en: "Da Lat Vietnam highland pine forest city" },
  { re: /나트랑|Nha Trang/i, en: "Nha Trang beach Vietnam turquoise sea" },
  { re: /비엔티안|Vientiane/i, en: "Pha That Luang Vientiane golden stupa" },
  { re: /방비엥|Vang Vieng/i, en: "Vang Vieng Nam Song river karst mountains" },
  { re: /블루\s*라군|Blue Lagoon/i, en: "Blue Lagoon Vang Vieng emerald water" },
  { re: /파투싸이|Patuxai/i, en: "Patuxai Victory Monument Vientiane" },
  { re: /타틀루앙|Pha That Luang/i, en: "Pha That Luang Vientiane golden stupa front view" },
  { re: /후룬베이얼\s*대초원|Hulunbuir Grassland/i, en: "Hulunbuir Grassland / rolling green hills / wide angle" },
  { re: /모리거러|Morigele/i, en: "Morigele River / grassland valley / wide angle" },
  { re: /만주리|Manzhouli/i, en: "Manzhouli border city / Russian architecture / street view" },
  { re: /마트료시카|Matryoshka/i, en: "Matryoshka Square Manzhouli / colorful dolls plaza / front view" },
  { re: /후룬베이얼\s*고성|Hulunbuir Old/i, en: "Hulunbuir Old Town / Qing dynasty gate / front view" },
  { re: /하이라얼|Hailar/i, en: "Hailar city / Inner Mongolia steppe gateway / street view" },
  { re: /포나가르|Po Nagar|Cham Towers/i, en: "Po Nagar Cham Towers Nha Trang / ancient towers / front view" },
  { re: /나트랑|Nha Trang/i, en: "Nha Trang beach Vietnam / turquoise sea / wide angle" },
  { re: /달랏|Da Lat|Dalat/i, en: "Da Lat Vietnam highland / pine hills / wide angle" },
  { re: /나이아가라|Niagara/i, en: "Niagara Falls waterfall mist wide angle" },
  { re: /링컨\s*기념관|Lincoln\s*Memorial/i, en: "Lincoln Memorial Washington DC front view" },
  { re: /제퍼슨\s*기념관|Jefferson\s*Memorial/i, en: "Jefferson Memorial Washington DC dome reflection" },
  { re: /백악관|White\s*House/i, en: "White House Washington DC north facade" },
  { re: /국회의사당|Capitol\s*Building|US\s*Capitol/i, en: "United States Capitol dome Washington DC" },
  { re: /자연사\s*박물관|Natural\s*History\s*Museum/i, en: "Smithsonian National Museum of Natural History Washington DC" },
  { re: /워싱턴\s*국립\s*미술관|National\s*Gallery/i, en: "National Gallery of Art Washington DC" },
  { re: /스카이론|Skylon/i, en: "Skylon Tower Niagara Falls observation deck" },
  { re: /바람의\s*동굴|Cave\s*of\s*the\s*Winds/i, en: "Cave of the Winds Niagara Falls platform" },
  { re: /엠파이어\s*스테이트|Empire\s*State/i, en: "Empire State Building New York skyline" },
  { re: /플랫아이언|Flatiron/i, en: "Flatiron Building New York street view" },
  { re: /그라운드\s*제로|Ground\s*Zero|9\s*\/\s*11/i, en: "One World Trade Center New York memorial" },
  { re: /월\s*스트리트|Wall\s*Street/i, en: "Wall Street New York Charging Bull" },
  { re: /그리니치\s*빌리지|Greenwich\s*Village/i, en: "Greenwich Village New York brownstone street" },
  { re: /브로드웨이|Broadway/i, en: "Times Square Broadway New York night lights" },
  { re: /5번가|Fifth\s*Avenue/i, en: "Fifth Avenue New York street view" },
  { re: /노트르담\s*대성당|Notre\s*Dame\s*Basilica/i, en: "Notre Dame Basilica Montreal interior blue vault" },
  { re: /몽모랑시\s*폭포|Montmorency/i, en: "Montmorency Falls Quebec suspension bridge" },
  { re: /천섬|Thousand\s*Islands/i, en: "Thousand Islands St Lawrence River aerial" },
  { re: /레이크\s*조지|Lake\s*George/i, en: "Lake George New York Adirondack mountains" },
  { re: /오저블\s*케이즘|Ausable\s*Chasm/i, en: "Ausable Chasm New York gorge waterfall" },
  { re: /마추픽chu|Machu\s*Picchu|마추\s*픽chu/i, en: "Machu Picchu ancient ruins mountain Peru" },
  { re: /우유니\s*사막|Uyuni|볼리비아\s*우유니/i, en: "Salar de Uyuni salt flats mirror Bolivia" },
  { re: /이과수\s*폭포|Iguazu|Iguassu/i, en: "Iguazu Falls Brazil Argentina waterfall panorama" },
  { re: /쿠스코|Cusco|Cuzco/i, en: "Cusco Peru Plaza de Armas colonial architecture" },
  { re: /아구아스\s*칼리엔테스|Aguas\s*Calientes/i, en: "Aguas Calientes Machu Picchu gateway town" },
  { re: /가루다\s*공원|Garuda\s*Wisnu/i, en: "Garuda Wisnu Kencana" },
  { re: /울루와뚜|Uluwatu/i, en: "Uluwatu Temple" },
  { re: /멜라스티|Melasti/i, en: "Melasti Beach" },
  { re: /빠당빠당|Padang\s*Padang/i, en: "Padang Padang Beach" },
  { re: /비치\s*클럽|Beach\s*Club/i, en: "Bali Beach Club" },
  { re: /뜨갈랄랑|Tegalalang/i, en: "Tegalalang Rice Terrace" },
  { re: /발리\s*해변/i, en: "Bali beach sunset" },
  { re: /프린스(?:턴|톤)\s*대학|Princeton\s*University/i, en: "Princeton University campus" },
  { re: /필라델피아|Philadelphia/i, en: "Independence Hall Philadelphia" },
  { re: /인디펜던스\s*홀|Independence\s*Hall/i, en: "Independence Hall Philadelphia" },
  { re: /하버드\s*대학|Harvard\s*University/i, en: "Harvard University campus" },
  { re: /예일\s*대학|Yale\s*University/i, en: "Yale University campus" },
  { re: /우드버리\s*아울|Woodbury\s*Common/i, en: "Woodbury Common Premium Outlets" },
  { re: /센트럴\s*파크|Central\s*Park/i, en: "Central Park New York" },
  { re: /록펠러|Rockefeller\s*Center|Top\s*of\s*the\s*Rock/i, en: "Rockefeller Center Top of the Rock" },
  { re: /9\.?11\s*메모리얼|Ground\s*Zero/i, en: "9/11 Memorial New York" },
  { re: /황소\s*동상|Charging\s*Bull/i, en: "Wall Street Charging Bull New York" },
  { re: /나이아가라\s*시티\s*크루즈|Niagara\s*City\s*Cruises/i, en: "Niagara Falls cruise boat mist" },
  { re: /테[를]?[르]?지\s*국립\s*공원|Terelj\s*National\s*Park/i, en: "Terelj National Park" },
  { re: /거북\s*바위|Turtle\s*Rock/i, en: "Turtle Rock" },
  { re: /아ri?ya발\s*사원|아리{1,2}ya?발\s*사원|Ariyabal/i, en: "Ariyabal Temple" },
  { re: /(?:자이승|Zaisan)/i, en: "Zaisan Memorial" },
  { re: /수흐?바타르|Sukhbaatar/i, en: "Sukhbaatar Square" },
  { re: /(?:칭기즈|징기스|Genghis)\s*칸/i, en: "Genghis Khan Statue" },
  { re: /로토루아\s*호수|Lake\s*Rotorua/i, en: "Lake Rotorua" },
  { re: /아그로돜|Agrodome/i, en: "Agrodome Rotorua sheep show" },
  { re: /스카이라인\s*곤돌라|Skyline\s*Rotorua/i, en: "Skyline Rotorua gondola luge" },
  { re: /와카레와레와|Whakarewarewa/i, en: "Whakarewarewa Maori Village geothermal" },
  { re: /미션\s*베이|Mission\s*Bay/i, en: "Mission Bay Auckland beach" },
  { re: /마이클\s*조셉\s*세비지|Michael\s*Joseph\s*Savage/i, en: "Michael Joseph Savage Memorial Auckland" },
  { re: /에덴\s*동산|Auckland\s*Domain/i, en: "Auckland Domain wintergardens" },
  { re: /밀포드\s*사운드|Milford\s*Sound/i, en: "Milford Sound New Zealand fiord" },
  { re: /와이토모|Waitomo/i, en: "Waitomo Glowworm Caves" },
  { re: /울루루|Uluru|Ayers\s*Rock/i, en: "Uluru Ayers Rock sunset" },
  { re: /그레이트\s*배리어\s*리프|Great\s*Barrier\s*Reef/i, en: "Great Barrier Reef aerial" },
  { re: /폴리네시안\s*스파|Polynesian\s*Spa/i, en: "Polynesian Spa Rotorua" },
  { re: /쿠메우|Kumeu/i, en: "Kumeu wine region Auckland" },
  { re: /후지\s*산|후지산|Mount\s*Fuji|富士/i, en: "Mount Fuji Japan" },
  { re: /콜로세움|Colosseum/i, en: "Colosseum Rome exterior" },
  { re: /사그라다\s*파밀리아|Sagrada\s*Familia/i, en: "Sagrada Familia Barcelona exterior" },
  { re: /스위스\s*알프스|Swiss\s*Alps|Matterhorn/i, en: "Swiss Alps Matterhorn scenic" },
  { re: /페트라|Petra/i, en: "Petra Treasury Jordan" },
  { re: /마라케시|Marrakech|Marrakesh/i, en: "Marrakech Jemaa el-Fnaa square" },
  { re: /리우\s*데\s*자네이로|리오\s*데\s*자네이로|Rio\s*de\s*Janeiro/i, en: "Rio de Janeiro Christ the Redeemer" },
] as const

export const SCHEDULE_CITY_KO_REGEX_RULES: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /부르사|Bursa/i, en: "Bursa Grand Mosque Turkey" },
  { re: /이스탄불|Istanbul|İstanbul/i, en: "Istanbul Bosporus mosque skyline sunset" },
  { re: /앙카라|Ankara/i, en: "Ankara city skyline Turkey" },
  { re: /안탈리아|Antalya/i, en: "Antalya old town harbour Turkey" },
  { re: /아이발릭|Ayvalik|Ayvalık/i, en: "Ayvalik Aegean coast Turkey" },
  { re: /튀르키예|터키|Turkey/i, en: "Istanbul Bosporus mosque skyline sunset" },
  { re: /상해|사해|上海/u, en: "Shanghai skyline night" },
  { re: /북경|베이징|北京/u, en: 'Beijing' },
  { re: /광저우|광주|广州/u, en: "Guangzhou skyline night" },
  { re: /심천|深圳/u, en: "Shenzhen skyline night" },
  { re: /도쿄|東京/u, en: "Tokyo street night" },
  { re: /오사카|大阪/u, en: "Osaka Dotonbori night" },
  { re: /교토|京都/u, en: "Kyoto temple street" },
  { re: /후쿠오카|福岡/u, en: "Fukuoka city night" },
  { re: /삿포로|札幌/u, en: "Sapporo snow city street" },
  { re: /나고야|名古屋/u, en: "Nagoya castle view" },
  { re: /요코하마|横浜/u, en: "Yokohama bay night" },
  { re: /파리/u, en: "Paris city skyline" },
  { re: /(?<!(?:고대\s{0,2}))(?<![가-힣])로마(?!시대)/u, en: "Rome Colosseum view" },
  { re: /바르셀로나/u, en: "Barcelona Sagrada Familia exterior" },
  { re: /런던/u, en: "London Thames skyline" },
  { re: /뉴욕/u, en: "New York Manhattan skyline" },
  { re: /연길/u, en: "Yanji Korean quarter winter street" },
  { re: /제주/u, en: "Jeju coast view" },
  { re: /부산/u, en: "Busan Gamcheon village" },
  { re: /방콕/u, en: "Bangkok Wat Arun temple" },
  { re: /치앙마이/u, en: "Chiang Mai old city temple" },
  { re: /파타야/u, en: "Pattaya beach sunset" },
  { re: /호이안|會安|Hoi\s*An/u, en: "Hoi An Ancient Town / lantern-lit street / eye-level" },
  { re: /다낭/u, en: "Da Nang Han River / Dragon Bridge waterfront skyline / wide angle" },
  { re: /하노이/u, en: "Hanoi Old Quarter street" },
  { re: /호치민/u, en: "Ho Chi Minh city skyline" },
  { re: /세부/u, en: "Cebu tropical beach" },
  { re: /보라카이/u, en: "Boracay white beach" },
  { re: /발리/u, en: "Bali rice terrace view" },
  { re: /시드니|悉尼/u, en: "Sydney Opera House harbour" },
  { re: /멜버른|멜번/u, en: "Melbourne laneway street" },
  { re: /홍콩|香港/u, en: "Hong Kong Victoria Harbour night" },
  { re: /마카오|澳門/u, en: "Macau Senado square" },
  { re: /타이페이|台北/u, en: "Taipei night market street" },
  { re: /하와이|호놀룰루|Honolulu/i, en: "Honolulu Waikiki beach" },
  { re: /괌|Guam/i, en: "Guam Tumon beach" },
  { re: /사이판|Saipan/i, en: "Saipan Managaha lagoon" },
  { re: /캘거리|Calgary/i, en: "Calgary Tower downtown skyline" },
  { re: /밴프|Banff/i, en: "Banff townsite Rocky Mountains" },
  { re: /피렌체|Florence|Firenze/i, en: "Florence Duomo historic center" },
  { re: /베니스|Venice|Venezia/i, en: "Venice Grand Canal gondolas" },
  { re: /볼로냐|Bologna/i, en: "Bologna Two Towers historic center" },
  { re: /하문|샤먼|Xiamen|厦门/u, en: "Xiamen harbor skyline" },
  { re: /복주|푸저우|福州|Fuzhou/u, en: "Fuzhou skyline" },
  { re: /(?<!(?:고대\s{0,2}))로마(?!시대)/u, en: "Rome Colosseum view" },
  { re: /리마|Lima/i, en: "Lima Peru Miraflores coastal cliff park" },
  { re: /쿠스코|Cusco|Cuzco/i, en: "Cusco Peru Plaza de Armas" },
  { re: /라파즈|La\s*Paz/i, en: "La Paz Bolivia cable car city view" },
  { re: /우유니|Uyuni/i, en: "Salar de Uyuni salt flats Bolivia" },
  { re: /이과수|Iguazu/i, en: "Iguazu Falls waterfall panorama" },
  { re: /리오데자네이로|Rio\s*de\s*Janeiro/i, en: "Rio de Janeiro Christ the Redeemer view" },
  { re: /로스엔젤레스|Los\s*Angeles|LA\b/i, en: "Los Angeles Griffith Observatory city view" },
  { re: /워싱턴\s*DC|Washington\s*DC/i, en: "Washington DC National Mall monuments" },
  { re: /토론토|Toronto/i, en: "Toronto CN Tower skyline" },
  { re: /몬트리올|Montreal/i, en: "Montreal Old Port waterfront" },
  { re: /퀘벡|Quebec/i, en: "Quebec City Old Town Chateau Frontenac" },
  { re: /나이아가라|Niagara/i, en: "Niagara Falls waterfall wide angle" },
  { re: /몰디브|Maldives/i, en: "Maldives overwater villa lagoon sunset" },
  { re: /나트랑|Nha Trang/i, en: "Nha Trang beach Vietnam" },
  { re: /달랏|Da Lat|Dalat/i, en: "Da Lat Vietnam highland city" },
  { re: /쿠알라룸푸르|Kuala\s*Lumpur/i, en: "Kuala Lumpur Petronas Twin Towers" },
  { re: /말라카|Malacca|Melaka/i, en: "Malacca historic city Malaysia" },
  { re: /페낭|Penang|George\s*Town/i, en: "George Town Penang Malaysia" },
  { re: /랑카위|Langkawi/i, en: "Langkawi island Malaysia" },
  { re: /오클랜드|Auckland/i, en: "Auckland Sky Tower harbour" },
  { re: /로토루아|Rotorua/i, en: "Rotorua geothermal valley" },
  { re: /퀸즈\s*타운|Queenstown/i, en: "Queenstown Lake Wakatipu" },
  { re: /크라이스트\s*처치|Christchurch/i, en: "Christchurch Cathedral square" },
  { re: /골드\s*코스트|Gold\s*Coast/i, en: "Surfers Paradise Gold Coast beach" },
  { re: /케언즈|Cairns/i, en: "Cairns Great Barrier Reef gateway" },
  { re: /퍼스|Perth/i, en: "Perth Kings Park skyline" },
  { re: /브리즈번|Brisbane/i, en: "Brisbane Story Bridge" },
  { re: /뉴질랜드|New\s*Zealand/i, en: "New Zealand Milford Sound landscape" },
  { re: /호주|Australia/i, en: "Australia Sydney Opera House harbour" },
  { re: /리우\s*데\s*자네이로|Rio\s*de\s*Janeiro/i, en: "Rio de Janeiro Christ the Redeemer view" },
  { re: /마라케시|Marrakech/i, en: "Marrakech medina Morocco" },
  { re: /하코네|Hakone/i, en: "Hakone hot spring Mount Fuji view" },
  { re: /닛코|Nikko/i, en: "Nikko Toshogu Shrine" },
] as const
function firstMatchingEn(rules: ReadonlyArray<SchedulePoiRegexRule>, h: string): string | null {
  for (const { re, en } of rules) {
    if (re.test(h)) return en
  }
  return null
}

/** routeText·본문 세그먼트 — 랜드마크/명소 우선 */
export function firstMatchingScheduleSpotEn(haystack: string): string | null {
  const h = String(haystack ?? '').trim()
  if (!h) return null
  return firstMatchingEn(SCHEDULE_SPOT_KO_REGEX_RULES, h)
}

/** routeText·본문 세그먼트 — 도시 폴백 */
export function firstMatchingScheduleCityEn(haystack: string): string | null {
  const h = String(haystack ?? '').trim()
  if (!h) return null
  return firstMatchingEn(SCHEDULE_CITY_KO_REGEX_RULES, h)
}

/** 명소 → 도시 순으로 첫 매칭 */
export function firstMatchingSchedulePoiEn(haystack: string): string | null {
  return firstMatchingScheduleSpotEn(haystack) ?? firstMatchingScheduleCityEn(haystack)
}

/** routeText·본문 — 등장 순 전체 명소 매칭 */
export function findAllScheduleSpotMatchesInText(text: string): Array<{ index: number; en: string }> {
  const haystack = String(text ?? '')
  const hits: Array<{ index: number; en: string }> = []
  for (const { re, en } of SCHEDULE_SPOT_KO_REGEX_RULES) {
    const m = haystack.match(re)
    if (m && m.index != null) hits.push({ index: m.index, en })
  }
  hits.sort((a, b) => a.index - b.index)
  return hits
}

/** regex SSOT 영문 키 — weak-opaque·SSOT 판별용 */
export function getSchedulePoiRegexEnglishKeys(): ReadonlySet<string> {
  return SCHEDULE_POI_REGEX_EN_KEYS
}

/** 한글 세그먼트 — regex 우선(오매핑 방지), finalize 시도 */
export function englishFromScheduleKoreanSegmentWithRegex(seg: string): string {
  const t = String(seg ?? '').trim()
  if (!t) return ''
  const spot = firstMatchingScheduleSpotEn(t)
  if (spot) {
    try {
      return finalizeScheduleImageKeyword(spot)
    } catch {
      return spot
    }
  }
  const fromPoi = mapKoreanPoiSegment(t)
  if (fromPoi) {
    try {
      return finalizeScheduleImageKeyword(fromPoi)
    } catch {
      /* continue */
    }
  }
  const fromDest = mapDestination(t)
  if (fromDest && fromDest !== t && !/[\uAC00-\uD7AF]/u.test(fromDest)) {
    try {
      return finalizeScheduleImageKeyword(fromDest)
    } catch {
      /* continue */
    }
  }
  const city = firstMatchingScheduleCityEn(t)
  if (city) {
    try {
      return finalizeScheduleImageKeyword(city)
    } catch {
      return city
    }
  }
  return ''
}

const SCHEDULE_POI_REGEX_EN_KEYS: ReadonlySet<string> = new Set(
  [...SCHEDULE_SPOT_KO_REGEX_RULES, ...SCHEDULE_CITY_KO_REGEX_RULES].map(({ en }) =>
    normalizeSemanticPoiKey(en),
  ),
)
