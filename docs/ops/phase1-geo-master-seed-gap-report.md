# Phase 1 — 지리 마스터 시드 vs 정적 SSOT 갭

생성: `npx tsx scripts/audit-geo-master-static-gap.ts --write-doc`

## 요약

| 구분 | 트리 시드 | 메가메뉴 browse 슬러그 | 권역 카드 링크 |
|------|----------|----------------------|----------------|
| 대륙 | 9 | — | 6 cards |
| 국가 | 77 | 228 | 76 links |
| 도시 | 247 | 186 leaves | 245 links |

## 차이 — 메가메뉴에만 있고 트리 시드에 없음

### 국가 슬러그

- `africa`
- `eastern-europe`
- `hawaii`
- `middle-east`
- `new-zealand`
- `northern-europe`
- `spain-portugal`
- `uk`
- `us-east`
- `us-west`
- `western-europe`
- `가고시마`
- `가나자와`
- `가마쿠라`
- `가오슝`
- `간사이`
- `간토`
- `경기-직관-여행`
- `고베`
- `곤명`
- `골드코스트`
- `괌`
- `광주`
- `교토`
- `구마모토`
- `구이린`
- `규슈`
- `끄라비`
- `나가사키`
- `나고야`
- `나라`
- `나이아가라`
- `나트랑`
- `나하`
- `남경`
- `남아공`
- `네팔`
- `노보리베츠`
- `뉴욕`
- `니세코`
- `닛코`
- `다낭`
- `다카마쓰`
- `다카야마`
- `달랏`
- `대동`
- `대련`
- `델리`
- `도쿄`
- `도호쿠`
- `돗토리`
- `동북`
- `두바이`
- `라스베가스`
- `랑카위`
- `로스앤젤레스`
- `로토루아`
- `루앙프라방`
- `룩소르`
- `마나도`
- `마닐라`
- `마우이`
- `마츠모토`
- `마츠야마`
- `마카오`
- `멕시코`
- `멜버른`
- `미야자키`
- `미야코지마`
- `미얀마`
- `미코노스`
- `바간`
- `바라나시`
- `발리`
- `방콕`
- `밴쿠버`
- `밴프`
- `벳부`
- `보라카이`
- `보홀`
- `북경`
- `브라질`
- `브리즈번`
- `비엔티안`
- `빅아일랜드`
- `사이판`
- `산동`
- `산토리니`
- `삿포로`
- `상해`
- `샌프란시스코`
- `성도`
- `세부`
- `센다이`
- `소주`
- `스리랑카`
- `스포츠-테마-투어`
- `슬로베니아`
- `시기리야`
- `시드니`
- `시라카와고`
- `시마네`
- `심양`
- `씨엠립`
- `아그라`
- `아르헨티나`
- `아부다비`
- `아사히카와`
- `아오모리`
- `아키타`
- `아테네`
- `알래스카`
- `양곤`
- `에티오피아`
- `여강`
- `연길`
- `연태`
- `옐로우나이프`
- `오만`
- `오사카`
- `오클랜드`
- `오키나와`
- `오타루`
- `와카야마`
- `요나고`
- `요르단`
- `요코하마`
- `울란바타르`
- `울루루`
- `워싱턴`
- `위해`
- `유후인`
- `이스라엘`
- `이스탄불`
- `이시가키`
- `인도`
- `자이푸르`
- `자카르타`
- `장가계`
- `장백산`
- `족자카르타`
- `주고쿠-시코쿠`
- `중경`
- `중남미-멕시코`
- `천진`
- `청도`
- `추부`
- `치앙마이`
- `칠레`
- `카우아이`
- `카이로`
- `카트만두`
- `카파도키아`
- `칸쿤`
- `캔디`
- `캘거리`
- `케냐`
- `케언즈`
- `코타키나발루`
- `콜롬보`
- `쿠알라룸푸르`
- `퀘벡`
- `퀸스타운`
- `크라이스트처치`
- `크로아티아`
- `클락`
- `타이베이`
- `타이중`
- `탄자니아`
- `테를지`
- `토론토`
- `파타야`
- `페낭`
- `페루`
- `포카라`
- `폴란드`
- `푸꾸옥`
- `푸켓`
- `프놈펜`
- `하노이`
- `하얼빈`
- `하코네`
- `하코다테`
- `항주`
- `호놀룰루`
- `호치민`
- `홋카이도`
- `홍콩`
- `화남`
- `화동`
- `화롄`
- `화북`
- `후라노`
- `후쿠오카`
- `히로시마`

### 도시 leaf (상위 80건)

| tab | country | citySlug | label |
|-----|---------|----------|-------|
| europe-me | italy | italy | 이탈리아 |
| europe-me | france | france | 프랑스 |
| europe-me | switzerland | switzerland | 스위스 |
| europe-me | uk | uk | 영국 |
| europe-me | germany | germany | 독일 |
| europe-me | netherlands | netherlands | 네덜란드 |
| europe-me | belgium | belgium | 벨기에 |
| europe-me | austria | austria | 오스트리아 |
| europe-me | czech | czech | 체코 |
| europe-me | hungary | hungary | 헝가리 |
| europe-me | 폴란드 | poland | 폴란드 |
| europe-me | 크로아티아 | croatia | 크로아티아 |
| europe-me | 슬로베니아 | slovenia | 슬로베니아 |
| europe-me | denmark | denmark | 덴마크 |
| europe-me | norway | norway | 노르웨이 |
| europe-me | sweden | sweden | 스웨덴 |
| europe-me | finland | finland | 핀란드 |
| europe-me | iceland | iceland | 아이슬란드 |
| europe-me | spain | spain | 스페인 |
| europe-me | portugal | portugal | 포르투갈 |
| europe-me | 미코노스 | mykonos | 미코노스 |
| europe-me | 카이로 | cairo | 카이로 |
| europe-me | 룩소르 | luxor | 룩소르 |
| europe-me | 아부다비 | abu-dhabi | 아부다비 |
| europe-me | 이스라엘 | israel | 이스라엘 |
| europe-me | morocco | morocco | 모로코 |
| europe-me | 에티오피아 | ethiopia | 에티오피아 |
| southeast-asia | 나트랑 | nha-trang | 나트랑 |
| southeast-asia | 호치민 | hcm | 호치민 |
| southeast-asia | 푸꾸옥 | phu-quoc | 푸꾸옥 |
| southeast-asia | 치앙마이 | chiang-mai | 치앙마이 |
| southeast-asia | 자카르타 | jakarta | 자카르타 |
| southeast-asia | 족자카르타 | yogyakarta | 족자카르타 |
| southeast-asia | 코타키나발루 | kota-kinabalu | 코타키나발루 |
| southeast-asia | 랑카위 | langkawi | 랑카위 |
| southeast-asia | 페낭 | penang | 페낭 |
| southeast-asia | 씨엠립 | siem-reap | 씨엠립 |
| southeast-asia | 프놈펜 | phnom-penh | 프놈펜 |
| southeast-asia | 루앙프라방 | luang-prabang | 루앙프라방 |
| southeast-asia | 양곤 | yangon | 양곤 |
| southeast-asia | 바간 | bagan | 바간 |
| southeast-asia | 델리 | delhi | 델리 |
| southeast-asia | 자이푸르 | jaipur | 자이푸르 |
| southeast-asia | 아그라 | agra | 아그라 |
| southeast-asia | 바라나시 | varanasi | 바라나시 |
| southeast-asia | 콜롬보 | colombo | 콜롬보 |
| southeast-asia | 캔디 | kandy | 캔디 |
| southeast-asia | 시기리야 | sigiriya | 시기리야 |
| southeast-asia | 카트만두 | kathmandu | 카트만두 |
| southeast-asia | 포카라 | pokhara | 포카라 |
| japan | 시라카와고 | shirakawago | 시라카와고 |
| japan | 마츠모토 | matsumoto | 마츠모토 |
| japan | 시마네 | shimane | 시마네 |
| japan | 오키나와 | okinawa | 오키나와 |
| japan | 나하 | naha | 나하 |
| china-hk-mo | 소주 | suzhou | 소주 |
| china-hk-mo | 남경 | nanjing | 남경 |
| china-hk-mo | 대동 | datong | 대동 |
| china-hk-mo | 장백산 | changbai | 장백산 |
| china-hk-mo | 광주 | guangzhou | 광주 |
| china-hk-mo | 홍콩 | hong-kong | 홍콩 |
| china-hk-mo | 테를지 | terelj | 테를지 |
| oceania | 골드코스트 | gold-coast | 골드코스트 |
| oceania | 케언즈 | cairns | 케언즈 |
| americas | 빅아일랜드 | big-island | 빅아일랜드 |
| americas | 로스앤젤레스 | los-angeles | 로스앤젤레스 |
| americas | 라스베가스 | las-vegas | 라스베가스 |
| americas | 샌프란시스코 | san-francisco | 샌프란시스코 |
| americas | 뉴욕 | new-york | 뉴욕 |
| americas | 워싱턴 | washington | 워싱턴 |
| americas | 퀘벡 | quebec | 퀘벡 |
| americas | 브라질 | brazil | 브라질 |
| americas | 칠레 | chile | 칠레 |
| americas | 아르헨티나 | argentina | 아르헨티나 |
| americas | 페루 | peru | 페루 |
| americas | 경기-직관-여행 | 경기-직관-여행 | 경기 직관 여행 |

## 차이 — 트리 시드에 있으나 MegaMenuGroupCard에 미연결

- 국가: 0건 (korea 제외)
- 도시: 2건 — `busan`, `seoul` (국내 지방출발·PR2 범위)

## 메가메뉴 UI browse 슬러그 vs Country.countryKey

메가메뉴 `mega-menu-regions.data.ts`는 한글 라벨·browse 슬러그(예: `나트랑`, `uk`)를 쓰고, DB 마스터는 `countryKey`/`cityKey`(예: `vietnam`, `nhatrang`)를 씁니다. **동일 키 공간이 아니므로** 위 JSON의 `menuCountrySlugsMissingInTreeSeed` 대부분은 PR2 browse 통합 전 **표기 차이**이며, Phase1 마이그는 **트리 시드 77국·247도시 upsert**로 DB 정합을 맞춥니다.

## 마이그레이션

Supabase: `supabase/migrations/20260520120000_phase1_geo_master_seed.sql`
기존 `20260510120000_megamenu_card_seed_patch.sql` + 시드 upsert. 수동 apply.
