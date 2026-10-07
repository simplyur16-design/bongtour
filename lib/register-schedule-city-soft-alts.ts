/**
 * 도시 단독일·ICE 이동일 — route에 도시만 있어도 허용할 soft-alt 랜드마크.
 * REGRESSION-FREEZE[register-schedule-forbidden-city-route-evidence]: city soft-alt trip SSOT — manifest
 * REGRESSION-FREEZE[lottetour-schedule-expression]: 베를린 단독일 Brandenburg 중복 시 alt — manifest
 * REGRESSION-FREEZE[register-pending-hard-kw-soft-alt-heal]: pending hard KW 반복 → unused soft-alt — manifest
 */
import { finalizeScheduleImageKeyword, isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

const CITY_SOFT_ALT_RULES: ReadonlyArray<{ cityRe: RegExp; alts: readonly string[] }> = [
  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: Da Nang≠Hoi An soft-alt bleed — manifest
  {
    cityRe: /호이안|Hoi\s*An/i,
    alts: [
      'Hoi An Ancient Town',
      'Japanese Covered Bridge Hoi An',
    ],
  },
  {
    cityRe: /다낭|Da\s*Nang|미케|My\s*Khe|베트남|Vietnam/i,
    alts: [
      'Da Nang Dragon Bridge',
      'Marble Mountains Da Nang',
      'My Khe Beach Da Nang',
      'Ba Na Hills Golden Bridge Da Nang',
      'Han River Bridge Da Nang night',
      'Son Tra Peninsula Linh Ung Pagoda',
      'Non Nuoc Beach Da Nang',
      'Da Nang Cathedral Pink Church',
    ],
  },
  {
    cityRe: /부다페스트|Budapest|헝가리|Hungary/i,
    alts: [
      'Budapest Parliament Building',
      'Fisherman Bastion Budapest',
      'Buda Castle Budapest',
      'Chain Bridge Budapest',
      'Heroes Square Budapest',
    ],
  },
  {
    cityRe: /코펜하겐|Copenhagen|덴마크|Denmark/i,
    alts: [
      'Nyhavn Copenhagen Harbor',
      'Little Mermaid Copenhagen',
      'Tivoli Gardens Copenhagen',
      'Amalienborg Palace Copenhagen',
    ],
  },
  {
    cityRe: /샌프란시스코|San\s*Francisco|\bSF\b|금문교|Golden\s*Gate/i,
    alts: [
      'Golden Gate Bridge San Francisco',
      'Alcatraz Island San Francisco',
      'Painted Ladies San Francisco',
      'Fishermans Wharf San Francisco',
    ],
  },
  {
    cityRe: /삿포로|Sapporo|홋카이도|Hokkaido|조잔케이|Jozankei/i,
    alts: [
      'Sapporo Clock Tower',
      'Odori Park Sapporo',
      'Jozankei Onsen Sapporo',
      'Mount Moiwa Sapporo',
      'Sapporo Beer Museum',
    ],
  },
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
  // REGRESSION-FREEZE[naeiltour-mykonos-kw-no-repeat]: 미코노스 다일 soft-alt — sanitize가 pool 명소 제거 금지 — manifest
  {
    cityRe: /미코노스|Mykonos/i,
    alts: [
      'Mykonos windmills',
      'Mykonos Chora white houses',
      'Paradise Beach Mykonos',
      'Delos Island Greece',
      'Mykonos',
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
    cityRe: /아루샤|Arusha|탄자니아|Tanzania|킬리만자로|Kilimanjaro|암보셀리|Amboseli/i,
    alts: [
      'Arusha Tanzania Mount Meru Gateway',
      'Serengeti Savanna Wildlife',
      'Ngorongoro Crater Wildlife',
      'Lake Manyara National Park',
      'Amboseli Kilimanjaro View',
      'Tarangire National Park',
    ],
  },
  {
    cityRe: /베니스|Venice|Venezia|Grand\s*Canal/i,
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
    cityRe: /런던|London|British\s*Museum/i,
    alts: [
      'Tower Bridge London Thames',
      'Big Ben London',
      'British Museum London',
      'Buckingham Palace London',
      'London Eye Thames',
    ],
  },
  // REGRESSION-FREEZE[register-pending-hard-kw-soft-alt-heal]: pending hard KW soft-alt packs — manifest
  {
    cityRe: /레이캬비크|Reykjavik|아이슬란드|Iceland|블루라군|Blue\s*Lagoon/i,
    alts: [
      'Reykjavik Colorful Harbor Houses',
      'Blue Lagoon Iceland',
      'Hallgrimskirkja Reykjavik',
      'Gullfoss Waterfall Iceland',
      'Thingvellir National Park Iceland',
      'Reynisfjara Black Sand Beach',
    ],
  },
  {
    cityRe: /칸쿤|Cancun|치첸|Chichen|툴룸|Tulum|Isla\s*Mujeres/i,
    alts: [
      'Cancun Caribbean Beach',
      'Chichen Itza Mexico',
      'Tulum Mayan Ruins',
      'Isla Mujeres Mexico',
      'Cenote Ik Kil Mexico',
    ],
  },
  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: Blue Mountain≠Sydney trigger (Laura Village bleed) — manifest
  {
    cityRe: /시드니|Sydney|본디|Bondi|쿠지|Coogee|왓슨스|Watsons|갭\s*파크|Gap\s*Park/i,
    alts: [
      'Bondi Beach',
      'Sydney Opera House',
      'Sydney Harbour Bridge',
      'Blue Mountains Echo Point',
      'Taronga Zoo Sydney',
      'Coogee Beach Sydney',
      'Watsons Bay Gap Park Sydney',
      'The Rocks Sydney harbor',
      'Darling Harbour Sydney',
      'Manly Beach Sydney ferry',
      'Bondi to Coogee coastal walk',
      'Circular Quay Sydney ferry',
    ],
  },
  {
    cityRe:
      /블루마운틴|Blue\s*Mountains?|(?<![가-힣])로라\s*빌리지|(?<![A-Za-z])Laura\s*Village|에코\s*포인트|Echo\s*Point/i,
    alts: [
      'Blue Mountains Echo Point',
      'Three Sisters Blue Mountains',
      'Laura Village Blue Mountains',
    ],
  },
  {
    cityRe: /여강|리장|Lijiang|샹그릴라|Shangri/i,
    alts: [
      'Lijiang Old Town Yunnan',
      'Jade Dragon Snow Mountain',
      'Black Dragon Pool Lijiang',
      'Tiger Leaping Gorge Yunnan',
      'Shangri La Yunnan',
    ],
  },
  {
    cityRe: /청도|칭다오|Qingdao|연태|Yantai/i,
    alts: [
      'Qingdao',
      'Qingdao Zhanqiao Pier',
      'Badaguan Qingdao',
      'Qingdao Beer Museum',
      'Yantai Mountain Park Lighthouse',
      'Penglai Pavilion Yantai',
    ],
  },
  {
    cityRe: /장가계|Zhangjiajie|천문산|Tianmen|원가계/i,
    alts: [
      'Tianmen Mountain',
      'Zhangjiajie Avatar Mountains',
      'Glass Bridge Zhangjiajie',
      'Yuanjiajie Peak Forest',
      'Golden Whip Stream Zhangjiajie',
    ],
  },
  {
    cityRe: /사해|Dead\s*Sea|요르단|Jordan|페트라|Petra|와디럼|Wadi\s*Rum/i,
    alts: [
      'Dead Sea Jordan',
      'Petra Treasury Jordan',
      'Wadi Rum desert Jordan',
      'Jerash Roman Ruins Jordan',
      'Amman Citadel Jordan',
    ],
  },
  {
    cityRe: /세렝게티|Serengeti|응고롱고로|Ngorongoro|사파리|Safari|나이로비|Nairobi/i,
    alts: [
      'Serengeti Savanna Wildlife',
      'Ngorongoro Crater Wildlife',
      'Lake Manyara National Park',
      'Amboseli Kilimanjaro View',
      'Masai Mara Savanna',
    ],
  },
  {
    cityRe: /로스앤젤레스|Los\s*Angeles|\bLA\b|할리우드|Hollywood|Broad\s*Museum|바스토우|Barstow/i,
    alts: [
      'The Broad Museum',
      'Hollywood Sign',
      'Griffith Observatory Los Angeles',
      'Santa Monica Pier California',
      'Barstow Route 66 California',
      'Universal Studios Hollywood',
    ],
  },
  {
    cityRe: /푸꾸옥|Phu\s*Quoc|그랜드월드|Grand\s*World|혼똔|Hon\s*Thom|모벤픽/i,
    alts: [
      'Phu Quoc Grand World',
      'Phu Quoc Sao Beach',
      'Phu Quoc Night Market',
      'Phu Quoc Vinpearl Safari',
      'Phu Quoc Hon Thom Cable Car',
      'Phu Quoc Dinh Cau Temple',
    ],
  },
  {
    cityRe: /상파울로|Sao\s*Paulo|상\s*파울로/i,
    alts: [
      'Sao Paulo Cathedral',
      'Paulista Avenue Sao Paulo',
      'Ibirapuera Park Sao Paulo',
      'Sao Paulo Museum of Art MASP',
      'Municipal Theatre Sao Paulo',
    ],
  },
  {
    cityRe: /아디스|Addis\s*Ababa|에티오피아|Ethiopia/i,
    alts: [
      'Addis Ababa Ethiopia skyline',
      'Holy Trinity Cathedral Addis Ababa',
      'National Museum Addis Ababa',
      'Entoto Mountain Addis Ababa',
      'Meskel Square Addis Ababa',
      'Addis Ababa University campus',
      'Bole Airport Addis Ababa skyline',
    ],
  },
  {
    cityRe: /하이델베르크|Heidelberg/i,
    alts: [
      'Heidelberg Castle Old Bridge Germany',
      'Heidelberg Old Town Neckar river',
      'Philosophers Walk Heidelberg',
    ],
  },
  {
    cityRe: /프랑크푸르트|Frankfurt/i,
    alts: [
      'Frankfurt Romer Square',
      'Frankfurt Main River skyline',
      'Frankfurt Cathedral Dom',
    ],
  },
  {
    cityRe: /쾰른|Cologne|Koln|Köln/i,
    alts: [
      'Cologne Cathedral Germany',
      'Cologne Old Town Rhine river',
      'Hohenzollern Bridge Cologne',
    ],
  },
  {
    cityRe: /노이슈반슈타인|Neuschwanstein|퓌센|Fussen/i,
    alts: [
      'Neuschwanstein Castle Bavaria',
      'Hohenschwangau Castle Bavaria',
      'Alpsee lake Neuschwanstein',
    ],
  },
  {
    cityRe: /베를린|Berlin|브란덴부르크|Brandenburg/i,
    alts: [
      'Berlin Brandenburg Gate',
      'Berlin Reichstag building',
      'Museum Island Berlin',
      'East Side Gallery Berlin',
    ],
  },
  {
    cityRe: /발렌시아|Valencia/i,
    alts: [
      'City of Arts Valencia',
      'Valencia Cathedral Spain',
      'Central Market Valencia',
      'Oceanografic Valencia',
    ],
  },
  {
    cityRe: /사라고사|Zaragoza|사라고자/i,
    alts: [
      'Basilica Del Pilar Zaragoza',
      'Aljaferia Palace Zaragoza',
      'Zaragoza Old Town Spain',
    ],
  },
  {
    cityRe: /알함브라|Alhambra|그라나다|Granada|산\s*니콜라스|San\s*Nicolas/i,
    alts: [
      'Alhambra Granada Spain',
      'Generalife Gardens Granada',
      'Albaicin Granada viewpoint',
      'San Nicolas viewpoint Granada',
      'Alhambra Palace Granada night',
      'Granada Cathedral Spain',
      'Sacromonte Granada caves',
    ],
  },
  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: Istanbul≠Ankara/Cappadocia/Pamukkale bleed — manifest
  {
    cityRe: /이스탄불|Istanbul|성소피아|하기아|Hagia|블루\s*모스크|Blue\s*Mosque|토프카프|Topkapi|갈라타|Galata|그랜드\s*바자|Grand\s*Bazaar/i,
    alts: [
      'Hagia Sophia Istanbul',
      'Blue Mosque Istanbul',
      'Grand Bazaar Istanbul',
      'Bosphorus Bridge Istanbul',
      'Galata Tower Istanbul',
      'Topkapi Palace Istanbul',
      'Spice Bazaar Istanbul',
      'Dolmabahce Palace Istanbul',
      'Ortakoy Mosque Bosphorus Istanbul',
      'Basilica Cistern Istanbul',
    ],
  },
  {
    cityRe: /앙카라|Ankara|아닛카비르|Anitkabir/i,
    alts: ['Anitkabir Ankara'],
  },
  {
    cityRe: /카파도키아|Cappadocia|괴레메|Goreme/i,
    alts: ['Cappadocia Fairy Chimneys', 'Goreme Cappadocia Fairy Chimneys'],
  },
  {
    cityRe: /파묵칼레|Pamukkale|석회붕/i,
    alts: ['Pamukkale Travertine Terraces'],
  },
  {
    cityRe: /소포트|Sopot/i,
    alts: [
      'Sopot Baltic Beach',
      'Sopot Pier Poland',
      'Sopot Crooked House',
    ],
  },
  {
    cityRe: /그단스크|Gdansk|그다인스크/i,
    alts: [
      'Gdansk Old Town Poland',
      'Gdansk Neptune Fountain',
      'Gdansk Crane Motlawa',
    ],
  },
  {
    cityRe: /바르샤바|Warsaw/i,
    alts: [
      'Warsaw Old Town Square',
      'Warsaw Royal Castle',
      'Palace of Culture Warsaw',
    ],
  },
  {
    cityRe: /크라쿠프|Krakow|크라코프|Malbork/i,
    alts: [
      'Krakow Main Square',
      'Wawel Castle Krakow',
      'Malbork Castle Poland',
    ],
  },
  {
    cityRe: /쿠로가와|Kurokawa|온천|료칸|구마모토|Kumamoto|규슈|Kyushu/i,
    alts: [
      'Kurokawa Onsen Village',
      'Kumamoto Castle Japan',
      'Mount Aso Caldera',
      'Takachiho Gorge Kyushu',
      'Beppu Onsen Japan',
    ],
  },
  {
    cityRe: /페리토|Perito|모레노|Moreno|칼라파테|Calafate|파타고니아|Patagonia|로스\s*글라시아레스/i,
    alts: [
      'Perito Moreno Glacier',
      'Los Glaciares National Park Calafate',
      'Upsala Glacier Patagonia',
      'El Calafate Patagonia town',
    ],
  },
  {
    cityRe: /리우|Rio\s*de\s*Janeiro|코르코바도|Christ\s*the\s*Redeemer|코파카바나|Copacabana/i,
    alts: [
      'Christ the Redeemer Rio de Janeiro',
      'Sugarloaf Mountain Rio de Janeiro',
      'Copacabana Beach Rio de Janeiro',
      'Ipanema Beach Rio de Janeiro',
      'Santa Teresa Rio de Janeiro',
    ],
  },
  {
    cityRe: /태항|Taihang|보천|천계산/i,
    alts: [
      'Taihang Mountains Canyon',
      'Heavenly Mountain China',
      'Bailigou Canyon China',
      'Wangmangling Peak Taihang',
    ],
  },
  // REGRESSION-FREEZE[register-schedule-city-soft-alt-empty-middle]: empty-middle city soft-alt packs — manifest
  {
    cityRe: /두바이|Dubai/i,
    alts: [
      'Dubai Marina skyline',
      'Dubai Frame architecture',
      'Dubai Miracle Garden',
      'Dubai JBR Beach',
      'Dubai Museum Al Fahidi',
      'Burj Khalifa Dubai skyline',
      'Palm Jumeirah Dubai aerial',
      'Dubai Fountain Dubai Mall',
    ],
  },
  {
    cityRe: /아부다비|Abu\s*Dhabi/i,
    alts: [
      'Sheikh Zayed Grand Mosque Abu Dhabi',
      'Louvre Abu Dhabi Saadiyat Island',
      'Emirates Palace Abu Dhabi',
      'Qasr Al Watan Abu Dhabi',
      'Etihad Towers Abu Dhabi',
    ],
  },
  {
    cityRe: /헬싱키|Helsinki|핀란드|Finland/i,
    alts: [
      'Helsinki Senate Square Finland',
      'Helsinki Cathedral white dome',
      'Suomenlinna Sea Fortress Helsinki',
      'Temppeliaukio Rock Church Helsinki',
      'Market Square Helsinki harbor',
    ],
  },
  {
    cityRe: /마드리드|Madrid/i,
    alts: [
      'Prado Museum Madrid',
      'Royal Palace Madrid',
      'Plaza Mayor Madrid Spain',
      'Puerta del Sol Madrid',
      'Retiro Park Madrid',
      'Gran Via Madrid night',
      'Temple of Debod Madrid sunset',
      'Madrid Rio park Manzanares',
      'Cibeles Fountain Madrid',
      'Almudena Cathedral Madrid',
    ],
  },
  {
    cityRe: /온플뢰르|Honfleur|노르망디|Normandy|에트르타|Etretat|몽생미셸|Mont\s*Saint[\s-]*Michel|고흐\s*마을|오베르/i,
    alts: [
      'Honfleur Harbor Normandy Colorful Houses',
      'Etretat cliffs Normandy France',
      'Mont Saint Michel Normandy',
      'Auvers sur Oise Van Gogh village',
      'Normandy countryside France',
    ],
  },
  {
    cityRe: /산티아고|Santiago\s*de\s*Compostela|콤포스텔라|순례|Camino|포르토마리|Portomarin|사리아|Sarria/i,
    alts: [
      'Santiago de Compostela Cathedral',
      'Camino de Santiago pilgrimage path',
      'Obradoiro Square Santiago',
      'Portomarin Camino bridge Spain',
      'Sarria Camino de Santiago start',
    ],
  },
  {
    cityRe: /바르셀로나|Barcelona/i,
    alts: [
      'Sagrada Familia Barcelona',
      'Park Guell Barcelona',
      'Casa Batllo Barcelona',
      'La Rambla Barcelona',
      'Barceloneta Beach Barcelona',
    ],
  },
  {
    cityRe: /제노아|제노바|Genoa|Genova|포르토\s*안티코|Porto\s*Antico|몬테카티니|몬테카치아|Montecatini/i,
    alts: [
      'Genoa Porto Antico harbor',
      'Genoa Cathedral San Lorenzo',
      'Piazza de Ferrari Genoa',
      'Boccadasse colorful fishing village Genoa',
      'Spianata Castelletto Genoa viewpoint',
      'Montecatini Terme Tuscany',
    ],
  },
  {
    cityRe: /이과수|Iguazu|Igua[cç]u|포스\s*두\s*이과수|Foz\s*do/i,
    alts: [
      'Iguazu Falls Argentina',
      'Iguazu Falls waterfall panorama',
      'Iguazu Devil Throat walkway',
      'Iguazu National Park Brazil side',
      'Bird Park Foz do Iguacu',
      'Iguazu Falls boat ride spray',
      'Iguazu upper circuit walkway',
      'Iguazu lower circuit rainforest',
      'Puerto Iguazu Argentina town',
      'Iguazu triborder landmark',
    ],
  },
  {
    cityRe: /다카마쓰|다카마쯔|다카마츠|Takamatsu|시코쿠|Shikoku|나오시마|Naoshima|고토히라|Kotohira|쇼도시마|쇼도지마|Shodoshima/i,
    alts: [
      'Ritsurin Garden Takamatsu',
      'Naoshima Yellow Pumpkin',
      'Kotohira Konpira Shrine',
      'Seto Inland Sea islands Japan',
      'Takamatsu Castle ruins',
      'Shodoshima olive park Japan',
    ],
  },
  {
    cityRe: /오카야마|Okayama|고라쿠엔|Korakuen/i,
    alts: [
      'Okayama Korakuen Garden',
      'Okayama Castle crow castle',
      'Okayama city tram Japan',
      'Kurashiki Bikan historic quarter',
    ],
  },
  {
    cityRe: /전일\s*해상|해상\s*이동|크루즈\s*항해|Cruise\s*day|at\s*sea|항해\s*중/i,
    alts: [
      'Mediterranean cruise ship deck sea',
      'Cruise ship sunset ocean view',
      'Mediterranean sea blue water aerial',
      'Cruise balcony Mediterranean coastline',
      'Open ocean cruise wake aerial',
    ],
  },
  {
    cityRe: /라스베가스|라스베이거스|Las\s*Vegas|인앤아웃|In-?N-?Out|그랜드\s*캐년|Grand\s*Canyon|앤텔로프|Antelope|벨라지오|Bellagio|F1/i,
    alts: [
      'Las Vegas Strip neon night',
      'Grand Canyon South Rim',
      'Antelope Canyon Arizona',
      'Hoover Dam Arizona Nevada',
      'Fremont Street Las Vegas',
      'Bellagio Fountains Las Vegas',
      'Las Vegas Sphere LED exterior',
      'Welcome to Fabulous Las Vegas sign',
      'Red Rock Canyon Las Vegas',
      'High Roller observation wheel Las Vegas',
      'Venetian Las Vegas Grand Canal',
      'Las Vegas Formula 1 Strip circuit',
    ],
  },
  {
    cityRe: /파리|Paris|루브르|Louvre|샹젤리제|Champs|콩코르드|Concorde|튈르리|Tuileries/i,
    alts: [
      'Eiffel Tower Paris',
      'Louvre Museum Paris pyramid',
      'Champs Elysees Paris avenue',
      'Arc de Triomphe Paris',
      'Notre Dame Cathedral Paris',
      'Sacre Coeur Montmartre Paris',
      'Seine River cruise Paris',
      'Tuileries Garden Paris',
      'Place de la Concorde Paris',
      'Musee d Orsay Paris',
    ],
  },
  {
    cityRe: /니스|Nice|프롬나드|Promenade\s*des\s*Anglais|벨포|Belfort/i,
    alts: [
      'Promenade Des Anglais Nice Beach',
      'Nice Old Town Cours Saleya',
      'Castle Hill Nice viewpoint',
      'Negresco Hotel Nice facade',
      'Cimiez Gardens Nice',
    ],
  },
  {
    cityRe: /방콕|Bangkok|아이콘시암|Icon\s*Siam|시암\s*파라곤|Siam\s*Paragon|조드페어|Jodd|야시장/i,
    alts: [
      'Icon Siam Bangkok riverside',
      'Siam Paragon Bangkok mall',
      'Jodd Fairs night market Bangkok',
      'Wat Arun Temple Bangkok',
      'Grand Palace Bangkok',
      'Chatuchak Weekend Market Bangkok',
      'Asiatique riverfront Bangkok',
      'Jim Thompson House Bangkok',
    ],
  },
  {
    cityRe: /홍콩|Hong\s*Kong|침사추이|Tsim\s*Sha\s*Tsui|스타의\s*거리|Avenue\s*of\s*Stars/i,
    alts: [
      'Avenue of Stars Hong Kong',
      'Victoria Harbour Hong Kong night',
      'Tsim Sha Tsui waterfront promenade',
      'Hong Kong Peak Tram Victoria Peak',
      'Symphony of Lights Hong Kong',
      'Star Ferry Hong Kong harbour',
      'Temple Street Night Market Hong Kong',
      'Ngong Ping 360 cable car',
    ],
  },
  {
    cityRe: /발리|Bali|빠당빠당|Padang\s*Padang|울루와뚜|Uluwatu|세미냑|Seminyak|누사두아|Nusa\s*Dua|쿠타|Kuta/i,
    alts: [
      'Padang Padang Beach Bali',
      'Bali Uluwatu Temple cliff',
      'Seminyak Beach Club Bali',
      'Tanah Lot Temple Bali sunset',
      'Ubud Rice Terraces Bali',
      'Bali Garuda Wisnu Kencana',
      'Nusa Dua Beach Bali',
      'Kuta Beach Bali sunset',
    ],
  },
  {
    cityRe: /알래스카|Alaska|주노|Juneau|스케그웨이|Skagway|케치칸|Ketchikan|글래시어\s*베이|Glacier\s*Bay/i,
    alts: [
      'Alaska cruise ship glacier bay',
      'Cruise ship theater show stage',
      'Juneau Alaska mountain harbor',
      'Skagway Alaska gold rush town',
      'Glacier Bay National Park Alaska',
      'Ketchikan Alaska totem poles',
      'Alaska Inside Passage fjord',
    ],
  },
  {
    cityRe: /크루즈\s*[-–]\s*대극장|대극장\s*쇼|ship\s*theater|cruise\s*show/i,
    alts: [
      'Cruise ship theater show stage',
      'Cruise ship atrium lobby night',
      'Cruise ship deck ocean sunset',
      'Cruise ship dining room evening',
    ],
  },
  {
    cityRe: /항주|Hangzhou|서호|West\s*Lake|황산|Huangshan|휘주/i,
    alts: [
      'West Lake Hangzhou China',
      'Hangzhou Lingyin Temple',
      'Huangshan Yellow Mountain peaks',
      'Hangzhou Broken Bridge West Lake',
      'Huizhou ancient village China',
    ],
  },
  {
    cityRe: /하노이|Hanoi|하롱|Halong|시엠립|Siem\s*Reap|앙코르|Angkor/i,
    alts: [
      'Hoan Kiem Lake Hanoi',
      'Halong Bay limestone islands',
      'Angkor Wat Cambodia Temple',
      'Hanoi Old Quarter street',
      'Ta Prohm Temple Siem Reap',
      'Bayon Temple Angkor Thom',
    ],
  },
  {
    cityRe: /룩소르|Luxor|아부\s*심벨|Abu\s*Simbel|카이로|Cairo|나일|Nile/i,
    alts: [
      'Abu Simbel temples Egypt',
      'Luxor Temple night Egypt',
      'Karnak Temple Luxor columns',
      'Valley of the Kings Luxor',
      'Nile River cruise Egypt',
      'Pyramids of Giza Cairo',
    ],
  },
  {
    cityRe: /도쿠시마|Tokushima|우즈노미치|비잔|Bizan|아와오도리|오츠카/i,
    alts: [
      'Tokushima Bizan cable car view',
      'Naruto Whirlpools Uzunomichi',
      'Tokushima Awa Odori Hall',
      'Otsuka Museum of Art Tokushima',
      'Tokushima Castle ruins park',
    ],
  },
  {
    cityRe: /뉴욕|New\s*York|센트럴파크|Central\s*Park|나이아가라|Niagara|꽃시계/i,
    alts: [
      'Central Park New York',
      'Times Square New York night',
      'Statue of Liberty New York',
      'Brooklyn Bridge New York',
      'Niagara Falls Waterfall Mist',
      'Empire State Building New York',
      'Fifth Avenue New York',
      'High Line park New York',
    ],
  },
  {
    cityRe: /밴쿠버|Vancouver|로키|Rockies|밴프|Banff|레이크\s*루이스/i,
    alts: [
      'Vancouver Canada Harbor Mountains',
      'Stanley Park Vancouver seawall',
      'Capilano Suspension Bridge Vancouver',
      'Banff National Park Rockies',
      'Lake Louise Alberta Canada',
      'Moraine Lake Banff Canada',
    ],
  },
  {
    cityRe: /토스카나|Tuscany|몬테풀차노|Montepulciano|오르비에토|Orvieto|와이너리/i,
    alts: [
      'Montepulciano Tuscany hill town',
      'Orvieto Cathedral Duomo Italy',
      'Tuscany vineyard countryside',
      'Siena Piazza del Campo',
      'Chianti wine region Tuscany',
    ],
  },
  {
    cityRe: /사이판|Saipan|워터파크|Waterpark|PIC/i,
    alts: [
      'Saipan beach lagoon turquoise',
      'Saipan Managaha Island',
      'Saipan waterpark resort pool',
      'Suicide Cliff Saipan viewpoint',
      'Garapan Saipan downtown',
    ],
  },
  {
    cityRe: /타이중|Taichung|일월담|Sun\s*Moon|아리산|Alishan|무지개마을|Rainbow/i,
    alts: [
      'Sun Moon Lake Taiwan',
      'Alishan Forest Railway Taiwan',
      'Rainbow Village Taichung',
      'Taichung Calligraphy Greenway',
      'Alishan sunrise Taiwan',
    ],
  },
  {
    cityRe: /포카라|Pokhara|나가르코트|Nagarkot|카트만두|Kathmandu|사랑코트/i,
    alts: [
      'Pokhara Phewa Lake Nepal',
      'Nagarkot Himalaya viewpoint',
      'Kathmandu Durbar Square',
      'Sarangkot sunrise Pokhara',
      'Boudhanath Stupa Kathmandu',
    ],
  },
  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: Lisbon≠Porto soft-alt bleed — manifest
  {
    cityRe: /벨렝|Belem|파스테이스|Pasteis|리스본|Lisbon|제로니모스|Jeronimos|코메르시우|Commerce\s*Square/i,
    alts: [
      'Belem Tower Lisbon',
      'Pasteis de Belem bakery Lisbon',
      'Jerónimos Monastery Lisbon',
      'Lisbon Tram 28 Alfama',
      'Commerce Square Lisbon',
      'Lisbon Alfama district viewpoint',
    ],
  },
  {
    cityRe: /포르투(?!\s*안티코)|(?<!Porto\s)Porto(?!\s*Antico)|클레리구스|Clerigos|상\s*벤투|Sao\s*Bento|리버라|Ribeira/i,
    alts: [
      'Porto Ribeira Douro river',
      'Clerigos Tower Porto',
      'Porto Cathedral Se do Porto',
      'Sao Bento Station Porto azulejos',
      'Dom Luis I Bridge Porto',
    ],
  },
  {
    cityRe: /브르노|Brno/i,
    alts: [
      'Brno Cathedral Petrov Czech',
      'Brno Spilberk Castle',
      'Brno Vegetable Market namesti',
    ],
  },
  {
    cityRe: /잘츠부르크|Salzburg|모차르트|Mozart/i,
    alts: [
      'Salzburg Hohensalzburg Fortress',
      'Mirabell Gardens Salzburg',
      'Getreidegasse Salzburg Mozart',
      'Salzburg Old Town UNESCO',
    ],
  },
  {
    cityRe: /프라하|Prague|카를교|Charles\s*Bridge/i,
    alts: [
      'Prague Charles Bridge dawn',
      'Prague Old Town Square Astronomical Clock',
      'Prague Castle complex',
      'Cesky Krumlov Castle Czech',
      'Strahov Library Prague',
    ],
  },
  {
    cityRe: /예레반|Yerevan|시그나기|Signagi|트빌리시|Tbilisi|코카서스/i,
    alts: [
      'Yerevan Cascade complex Armenia',
      'Signagi Georgia wine town',
      'Tbilisi Old Town Narikala',
      'Republic Square Yerevan',
      'Kakheti wine region Georgia',
    ],
  },
  {
    cityRe: /상해|상하이|Shanghai|외탄|Bund|난징로/i,
    alts: [
      'Shanghai Bund skyline night',
      'Oriental Pearl Tower Shanghai',
      'Yu Garden Shanghai',
      'Nanjing Road Shanghai',
      'Shanghai French Concession',
    ],
  },
  {
    cityRe: /브루나이|Brunei|반다르|Bandar|세리\s*베가완|Seri\s*Begawan/i,
    alts: [
      'Bandar Seri Begawan mosque Brunei',
      'Omar Ali Saifuddien Mosque',
      'Kampong Ayer water village Brunei',
      'Brunei Bay waterfront',
    ],
  },
  {
    cityRe: /하지\s*레인|Haji\s*Lane|잠잠|아이온\s*오차드|Ion\s*Orchard|쥬얼|Jewel\s*Changi/i,
    alts: [
      'Haji Lane Singapore street art',
      'ION Orchard Singapore mall',
      'Jewel Changi Airport waterfall',
      'Orchard Road Singapore night',
      'Arab Street Singapore mosque',
    ],
  },
  {
    cityRe: /까띠끌란|Katiklan|세부|Cebu|모알보알|Moalboal/i,
    alts: [
      'Cebu Moalboal sardine run',
      'Kawasan Falls Cebu',
      'Cebu Temple of Leah',
      'Magellan Cross Cebu',
      'Oslob whale shark Cebu',
    ],
  },
  {
    cityRe: /리마|Lima|미라플로레스|Miraflores/i,
    alts: [
      'Lima Peru Miraflores coastal cliff park',
      'Plaza de Armas Lima Peru',
      'Larcomar Miraflores Lima ocean view',
      'Huaca Pucllana Lima adobe pyramid',
      'Barranco district Lima murals',
    ],
  },
  {
    cityRe: /쿠스코|Cusco|마추픽추|Machu\s*Picchu|성스러운\s*계곡|Sacred\s*Valley/i,
    alts: [
      'Cusco Peru Plaza de Armas Colonial',
      'Machu Picchu Peru',
      'Sacsayhuaman Cusco fortress',
      'Sacred Valley Pisac Peru',
      'Qorikancha Temple of the Sun Cusco',
    ],
  },
  {
    cityRe: /짐바브웨|Zimbabwe|보츠와나|Botswana|빅토리아\s*폭포|Victoria\s*Falls|리빙스턴|Livingstone|잠베지|Zambezi/i,
    alts: [
      'Victoria Falls Zimbabwe',
      'Victoria Falls Livingstone Zambia',
      'Zambezi River Sunset Cruise',
      'Chobe River Boat Safari',
      'Hwange National Park Zimbabwe',
    ],
  },
  {
    cityRe: /케이프\s*타운|Cape\s*Town|테이블\s*마운틴|Table\s*Mountain|희망봉|Good\s*Hope/i,
    alts: [
      'Cape Town Table Mountain South Africa',
      'Cape Town V&A Waterfront',
      'Cape of Good Hope South Africa',
      'Cape Town Bo-Kaap colorful houses',
      'Cape Town Robben Island',
    ],
  },
  {
    cityRe: /싱가포르|Singapore|마리나\s*베이|Marina\s*Bay|센토사|Sentosa|머라이언|Merlion|가든스\s*바이\s*더\s*베이|Gardens\s*by\s*the\s*Bay|클락\s*키|Clarke\s*Quay/i,
    alts: [
      'Merlion Park Singapore',
      'Gardens by the Bay Singapore',
      'Marina Bay Sands Singapore',
      'Universal Studios Singapore',
      'Siloso Beach Sentosa',
      'Buddha Tooth Relic Temple Singapore',
      'Clarke Quay Singapore night',
      'Chinatown Singapore temple street',
      'Singapore Flyer observation wheel',
      'Little India Singapore street',
      'Botanic Gardens Singapore UNESCO',
      'Helix Bridge Marina Bay Singapore',
    ],
  },
  {
    cityRe: /누와라\s*엘리야|Nuwara\s*Eliya|캔디|Kandy|콜롬보|Colombo|벤토타|Bentota|스리랑카|Sri\s*Lanka/i,
    alts: [
      'Nuwara Eliya tea plantations Sri Lanka',
      'Temple of the Tooth Kandy',
      'Galle Face Green Colombo',
      'Bentota Beach Sri Lanka',
      'Sigiriya Rock Fortress Sri Lanka',
    ],
  },
  {
    cityRe: /산티아고|Santiago|칠레|Chile|발파라이소|Valparaiso/i,
    alts: [
      'Santiago Chile Cerro San Cristobal',
      'Plaza de Armas Santiago Chile',
      'Valparaiso colorful hills Chile',
      'La Moneda Palace Santiago',
      'Santa Lucia Hill Santiago',
    ],
  },
  {
    cityRe: /이스터\s*섬|Easter\s*Island|라파누이|Rapa\s*Nui|모아이|Moai/i,
    alts: [
      'Easter Island Moai statues',
      'Rapa Nui Ahu Tongariki',
      'Rano Raraku quarry Easter Island',
      'Anakena Beach Easter Island',
    ],
  },
  {
    cityRe: /취리히|Zurich/i,
    alts: [
      'Zurich Old Town Limmat river',
      'Lake Zurich promenade Switzerland',
      'Bahnhofstrasse Zurich shopping street',
      'Grossmunster Zurich cathedral',
      'Zurich Opera House lakeside',
      'Zurich Lindenhof hill view',
      'Zurich Fraumunster church',
      'Uetliberg Zurich panoramic view',
    ],
  },
  {
    cityRe: /루체른|Lucerne|Luzern|카펠교|Chapel\s*Bridge/i,
    alts: [
      'Chapel Bridge Lucerne Switzerland',
      'Lake Lucerne mountains Switzerland',
      'Lion Monument Lucerne',
      'Lucerne Old Town riverside',
      'Pilatus mountain Lucerne view',
    ],
  },
  {
    cityRe: /베른|Bern|베른\s*구시가지|Zytglogge/i,
    alts: [
      'Bern Switzerland Zytglogge Clock Tower',
      'Bern Old Town UNESCO Switzerland',
      'Aare River Bern Switzerland',
      'Federal Palace Bern Bundeshaus',
      'Rose Garden Bern viewpoint',
    ],
  },
  {
    cityRe: /인터라켄|Interlaken|융프라우|Jungfrau|그린델발트|Grindelwald/i,
    alts: [
      'Jungfraujoch Sphinx Observatory',
      'Interlaken Swiss Alps lake view',
      'Grindelwald First Swiss Alps',
      'Harder Kulm Interlaken viewpoint',
      'Lauterbrunnen valley waterfall Switzerland',
    ],
  },
  {
    cityRe: /비엔나|Vienna|Wien|쉔부른|Schonbrunn/i,
    alts: [
      'Schonbrunn Palace Vienna gardens',
      'St Stephens Cathedral Vienna',
      'Belvedere Palace Vienna',
      'Vienna Hofburg Palace',
      'Prater Ferris Wheel Vienna',
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

/**
 * 이미 쓴 키워드가 soft-alt 팩에 있으면 같은 팩에서 unused 차순위.
 * 당일 route/title/description 증거가 있는 팩만 — usedKeyword 단독으로 타대륙 팩 금지.
 * REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: usedKeyword≠day-route pack unlock — manifest
 */
export function collectRegisterScheduleCitySoftAltKeywordsForUsedKeyword(
  usedKeyword: string,
  hay: string,
): string[] {
  const dayHay = String(hay ?? '')
  const uk = normScheduleImageKeywordKey(usedKeyword)
  if (!uk) return collectRegisterScheduleCitySoftAltKeywords(dayHay)
  const fromHay = collectRegisterScheduleCitySoftAltKeywords(dayHay)
  const samePackFirst: string[] = []
  const seen = new Set<string>()
  for (const { cityRe, alts } of CITY_SOFT_ALT_RULES) {
    // 당일 hay에 도시 증거가 없으면 팩 잠금 (Istanbul usedKeyword → Mykonos day Anitkabir 금지)
    if (!cityRe.test(dayHay)) continue
    const packHasUsed = alts.some((a) => normScheduleImageKeywordKey(a) === uk)
    if (!packHasUsed) continue
    for (const en of alts) {
      const nk = normScheduleImageKeywordKey(en)
      if (!nk || seen.has(nk)) continue
      seen.add(nk)
      samePackFirst.push(en)
    }
  }
  for (const en of fromHay) {
    const nk = normScheduleImageKeywordKey(en)
    if (!nk || seen.has(nk)) continue
    seen.add(nk)
    samePackFirst.push(en)
  }
  return samePackFirst
}

/** trip used에 없는 soft-alt 1개 — pending hard KW heal SSOT */
// REGRESSION-FREEZE[register-pending-hard-kw-soft-alt-heal]: unused soft-alt pick — manifest
// REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: day-route hay only — manifest
export function pickUnusedRegisterScheduleCitySoftAltKeyword(
  used: ReadonlySet<string>,
  opts: {
    routeText?: string | null
    title?: string | null
    description?: string | null
    usedKeyword?: string | null
  },
): string {
  // usedKeyword는 차순위 정렬용 — hay에 넣지 않음 (Istanbul/Laura Village → 타도시 팩 unlock 금지)
  const dayHay = [opts.routeText, opts.title, opts.description]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join('\n')
  const pool = opts.usedKeyword
    ? collectRegisterScheduleCitySoftAltKeywordsForUsedKeyword(opts.usedKeyword, dayHay)
    : collectRegisterScheduleCitySoftAltKeywords(dayHay)
  for (const en of pool) {
    if (isBareCityOrCountryKeyword(en) && used.has(normScheduleImageKeywordKey(en))) continue
    let candidate = en
    try {
      const fin = finalizeScheduleImageKeyword(en)
      if (fin && !isBareCityOrCountryKeyword(fin)) candidate = fin
      else if (fin && isBareCityOrCountryKeyword(en)) candidate = fin
      // landmark pack 문구는 finalize가 bare로 줄여도 원문 유지
    } catch {
      candidate = en
    }
    const nk = normScheduleImageKeywordKey(candidate)
    if (!nk || used.has(nk)) continue
    if (isBareCityOrCountryKeyword(candidate)) continue
    return candidate
  }
  // landmark 소진 후 bare city soft-dup (미사용만)
  for (const en of pool) {
    if (!isBareCityOrCountryKeyword(en)) continue
    const nk = normScheduleImageKeywordKey(en)
    if (!nk || used.has(nk)) continue
    return en
  }
  return ''
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
