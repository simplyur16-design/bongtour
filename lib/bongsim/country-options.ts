import type { CountryOption } from "./types";

type Row = [string, string, string, string?];

const ROWS: Row[] = [
  ["ae", "아랍에미리트", "🇦🇪", "uae dubai"],
  ["ar", "아르헨티나", "🇦🇷", "argentina"],
  ["au", "호주", "🇦🇺", "australia sydney"],
  ["at", "오스트리아", "🇦🇹", "austria vienna"],
  ["az", "아제르바이잔", "🇦🇿", "azerbaijan baku"],
  ["be", "벨기에", "🇧🇪", "belgium brussels"],
  ["br", "브라질", "🇧🇷", "brazil sao paulo"],
  ["bg", "불가리아", "🇧🇬", "bulgaria sofia"],
  ["kh", "캄보디아", "🇰🇭", "cambodia siem reap"],
  ["ca", "캐나다", "🇨🇦", "canada toronto vancouver"],
  ["cl", "칠레", "🇨🇱", "chile santiago"],
  ["cn", "중국", "🇨🇳", "china beijing shanghai"],
  ["co", "콜롬비아", "🇨🇴", "colombia bogota"],
  ["hr", "크로아티아", "🇭🇷", "croatia dubrovnik"],
  ["cy", "키프로스", "🇨🇾", "cyprus"],
  ["cz", "체코", "🇨🇿", "czech prague"],
  ["dk", "덴마크", "🇩🇰", "denmark copenhagen"],
  ["ec", "에콰도르", "🇪🇨", "ecuador"],
  ["eg", "이집트", "🇪🇬", "egypt cairo"],
  ["ee", "에스토니아", "🇪🇪", "estonia tallinn"],
  ["fi", "핀란드", "🇫🇮", "finland helsinki"],
  ["fr", "프랑스", "🇫🇷", "france paris"],
  ["de", "독일", "🇩🇪", "germany berlin munich"],
  ["gr", "그리스", "🇬🇷", "greece athens santorini"],
  ["gu", "괌", "🇬🇺", "guam"],
  ["hk", "홍콩", "🇭🇰", "hong kong"],
  ["hu", "헝가리", "🇭🇺", "hungary budapest"],
  ["is", "아이슬란드", "🇮🇸", "iceland reykjavik"],
  ["in", "인도", "🇮🇳", "india delhi mumbai"],
  ["id", "인도네시아", "🇮🇩", "indonesia bali jakarta"],
  ["ie", "아일랜드", "🇮🇪", "ireland dublin"],
  ["il", "이스라엘", "🇮🇱", "israel tel aviv"],
  ["it", "이탈리아", "🇮🇹", "italy rome milan"],
  ["jp", "일본", "🇯🇵", "japan tokyo osaka"],
  ["jo", "요르단", "🇯🇴", "jordan petra"],
  ["kz", "카자흐스탄", "🇰🇿", "kazakhstan"],
  ["kw", "쿠웨이트", "🇰🇼", "kuwait"],
  ["la", "라오스", "🇱🇦", "laos luang prabang"],
  ["lv", "라트비아", "🇱🇻", "latvia riga"],
  ["lt", "리투아니아", "🇱🇹", "lithuania vilnius"],
  ["lu", "룩셈부르크", "🇱🇺", "luxembourg"],
  ["mo", "마카오", "🇲🇴", "macau"],
  ["my", "말레이시아", "🇲🇾", "malaysia kuala lumpur"],
  ["mt", "몰타", "🇲🇹", "malta"],
  ["mx", "멕시코", "🇲🇽", "mexico cancun"],
  ["mn", "몽골", "🇲🇳", "mongolia ulaanbaatar"],
  ["me", "몬테네그로", "🇲🇪", "montenegro"],
  ["ma", "모로코", "🇲🇦", "morocco marrakech"],
  ["mm", "미얀마", "🇲🇲", "myanmar yangon"],
  ["np", "네팔", "🇳🇵", "nepal kathmandu"],
  ["nl", "네덜란드", "🇳🇱", "netherlands amsterdam"],
  ["nz", "뉴질랜드", "🇳🇿", "new zealand auckland"],
  ["no", "노르웨이", "🇳🇴", "norway oslo"],
  ["om", "오만", "🇴🇲", "oman muscat"],
  ["ph", "필리핀", "🇵🇭", "philippines manila cebu"],
  ["pl", "폴란드", "🇵🇱", "poland warsaw"],
  ["pt", "포르투갈", "🇵🇹", "portugal lisbon"],
  ["qa", "카타르", "🇶🇦", "qatar doha"],
  ["ro", "루마니아", "🇷🇴", "romania bucharest"],
  ["ru", "러시아", "🇷🇺", "russia moscow"],
  ["sa", "사우디아라비아", "🇸🇦", "saudi riyadh"],
  ["rs", "세르비아", "🇷🇸", "serbia belgrade"],
  ["sg", "싱가포르", "🇸🇬", "singapore"],
  ["sk", "슬로바키아", "🇸🇰", "slovakia bratislava"],
  ["si", "슬로베니아", "🇸🇮", "slovenia ljubljana"],
  ["za", "남아프리카공화국", "🇿🇦", "south africa cape town"],
  ["es", "스페인", "🇪🇸", "spain barcelona madrid"],
  ["lk", "스리랑카", "🇱🇰", "sri lanka colombo"],
  ["se", "스웨덴", "🇸🇪", "sweden stockholm"],
  ["ch", "스위스", "🇨🇭", "switzerland zurich"],
  ["tw", "대만", "🇹🇼", "taiwan taipei"],
  ["tz", "탄자니아", "🇹🇿", "tanzania"],
  ["th", "태국", "🇹🇭", "thailand bangkok phuket"],
  ["tr", "튀르키예", "🇹🇷", "turkey istanbul antalya"],
  ["gb", "영국", "🇬🇧", "uk london"],
  ["us", "미국", "🇺🇸", "usa new york la"],
  ["uy", "우루과이", "🇺🇾", "uruguay"],
  ["uz", "우즈베키스탄", "🇺🇿", "uzbekistan tashkent"],
  ["vn", "베트남", "🇻🇳", "vietnam hanoi danang"],
  ["dz", "알제리", "🇩🇿", "algeria"],
  ["bh", "바레인", "🇧🇭", "bahrain"],
  ["bd", "방글라데시", "🇧🇩", "bangladesh"],
  ["by", "벨라루스", "🇧🇾", "belarus"],
  ["ba", "보스니아 헤르체고비나", "🇧🇦", "bosnia"],
  ["cr", "코스타리카", "🇨🇷", "costa rica"],
  ["do", "도미니카공화국", "🇩🇴", "dominican"],
  ["sv", "엘살바도르", "🇸🇻", "el salvador"],
  ["fo", "덴마크령 페로 제도", "🇫🇴", "faroe"],
  ["ge", "조지아", "🇬🇪", "georgia tbilisi"],
  ["gt", "과테말라", "🇬🇹", "guatemala"],
  ["hn", "온두라스", "🇭🇳", "honduras"],
  ["iq", "이라크", "🇮🇶", "iraq"],
  ["jm", "자메이카", "🇯🇲", "jamaica"],
  ["ke", "케냐", "🇰🇪", "kenya nairobi"],
  ["xk", "코소보", "🇽🇰", "kosovo"],
  ["lb", "레바논", "🇱🇧", "lebanon"],
  ["li", "리히텐슈타인", "🇱🇮", "liechtenstein"],
  ["mk", "북마케도니아", "🇲🇰", "north macedonia"],
  ["ni", "니카라과", "🇳🇮", "nicaragua"],
  ["pa", "파나마", "🇵🇦", "panama"],
  ["pe", "페루", "🇵🇪", "peru lima"],
  ["pr", "푸에르토리코", "🇵🇷", "puerto rico"],
  ["sn", "세네갈", "🇸🇳", "senegal"],
  ["tn", "튀니지", "🇹🇳", "tunisia"],
  ["ua", "우크라이나", "🇺🇦", "ukraine kyiv"],
  ["va", "바티칸", "🇻🇦", "vatican"],
  ["ve", "베네수엘라", "🇻🇪", "venezuela"],
  ["fj", "피지", "🇫🇯", "fiji"],
  ["pf", "프랑스령 폴리네시아", "🇵🇫", "tahiti"],
  ["nc", "누벨칼레도니", "🇳🇨", "new caledonia"],
  ["mp", "북마리아나제도", "🇲🇵", "saipan"],
  ["bn", "브루나이", "🇧🇳", "brunei"],
  ["bt", "부탄", "🇧🇹", "bhutan"],
  ["mv", "몰디브", "🇲🇻", "maldives"],
  ["pk", "파키스탄", "🇵🇰", "pakistan"],
  ["py", "파라과이", "🇵🇾", "paraguay"],
  ["bo", "볼리비아", "🇧🇴", "bolivia"],
  ["na", "나미비아", "🇳🇦", "namibia"],
  ["zw", "짐바브웨", "🇿🇼", "zimbabwe"],
  ["et", "에티오피아", "🇪🇹", "ethiopia"],
  ["gh", "가나", "🇬🇭", "ghana"],
  ["ng", "나이지리아", "🇳🇬", "nigeria"],
  ["mu", "모리셔스", "🇲🇺", "mauritius"],
  ["sc", "세이셸", "🇸🇨", "seychelles"],
  ["ws", "사모아", "🇼🇸", "samoa"],
];

function dedupeByCode(rows: Row[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of rows) {
    if (seen.has(r[0])) continue;
    seen.add(r[0]);
    out.push(r);
  }
  return out;
}

const UNIQUE = dedupeByCode(ROWS);

export const COUNTRY_OPTIONS: CountryOption[] = UNIQUE.map(([code, nameKr, flag, terms]) => ({
  code,
  nameKr,
  flag,
  searchTerms: terms
    ? terms
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined,
})).sort((a, b) => a.nameKr.localeCompare(b.nameKr, "ko"));

export function filterCountryOptions(list: CountryOption[], query: string): CountryOption[] {
  const noKr = list.filter((c) => c.code !== "kr");
  const t = query.trim().toLowerCase();
  if (!t) return noKr;
  return noKr.filter((c) => {
    if (c.nameKr.toLowerCase().includes(t)) return true;
    if (c.subtitleKr?.toLowerCase().includes(t)) return true;
    if (c.code.toLowerCase().includes(t)) return true;
    return c.searchTerms?.some((s) => s.toLowerCase().includes(t)) ?? false;
  });
}
