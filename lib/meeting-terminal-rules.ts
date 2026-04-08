/**
 * 인천공항(ICN) 터미널 안내 전용 — 미팅 시간·장소·집결 문구 없음.
 *
 * 확정 기준:
 * - 공용 터미널 안내는 출발공항 코드 + 최종 항공 입력값(또는 최종 구조화 항공값)을 기준으로 생성한다.
 * - 스크래퍼 원문 항공사명은 직접 SSOT로 쓰지 않고, 필요 시 최종 항공 입력값이 비어 있을 때만 보조/fallback 참고값으로 제한한다.
 * - ICN일 때만 터미널 문구를 생성하고, ICN 외 공항은 null 또는 비노출 처리한다.
 * - 시간/장소 문구는 포함하지 않는다.
 *
 * 매핑: 항공사명 별칭 → 대표 키 → T1/T2·카운터·note.
 */

export type IcnTerminalInfo = {
  terminal: 'T1' | 'T2'
  airline_name_kr: string
  checkin_counter: string
  note: string
  category: string
}

/** 대표 항공사 키(한글) → ICN 터미널 메타 */
export const ICN_TERMINAL_MAP_BY_AIRLINE_KEY: Record<string, IcnTerminalInfo> = {
  대한항공: {
    terminal: 'T2',
    airline_name_kr: '대한항공',
    checkin_counter: 'A, B, C, D',
    note: 'A: 일등석/프레스티지 B, C: 일반석/모바일/웹 D: 모닝캄 우수회원',
    category: '국내 대형사',
  },
  아시아나항공: {
    terminal: 'T2',
    airline_name_kr: '아시아나항공',
    checkin_counter: 'G, H, J',
    note: 'J: 비즈니스/우수회원 H: 일반석 G: 셀프백드랍',
    category: '국내 대형사',
  },
  에어부산: {
    terminal: 'T2',
    airline_name_kr: '에어부산',
    checkin_counter: 'F',
    note: '당일 혼잡도에 따라 일부 변동 가능',
    category: '국내 LCC',
  },
  에어서울: {
    terminal: 'T2',
    airline_name_kr: '에어서울',
    checkin_counter: 'F',
    note: '당일 혼잡도에 따라 일부 변동 가능',
    category: '국내 LCC',
  },
  진에어: {
    terminal: 'T2',
    airline_name_kr: '진에어',
    checkin_counter: 'F',
    note: '당일 혼잡도에 따라 일부 변동 가능',
    category: '국내 LCC',
  },
  델타항공: {
    terminal: 'T2',
    airline_name_kr: '델타항공',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀',
    category: '외국 항공사(미주)',
  },
  아에로멕시코: {
    terminal: 'T2',
    airline_name_kr: '아에로멕시코',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀',
    category: '외국 항공사(미주)',
  },
  에어프랑스: {
    terminal: 'T2',
    airline_name_kr: '에어프랑스',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀',
    category: '외국 항공사(유럽)',
  },
  'KLM 네덜란드 항공': {
    terminal: 'T2',
    airline_name_kr: 'KLM 네덜란드 항공',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀',
    category: '외국 항공사(유럽)',
  },
  '버진 애틀랜틱': {
    terminal: 'T2',
    airline_name_kr: '버진 애틀랜틱',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀',
    category: '외국 항공사(유럽)',
  },
  '스칸디나비아 항공': {
    terminal: 'T2',
    airline_name_kr: '스칸디나비아 항공',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀',
    category: '외국 항공사(유럽)',
  },
  아에로플로트: {
    terminal: 'T2',
    airline_name_kr: '아에로플로트',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀 (현재 운항 중단)',
    category: '외국 항공사(유럽)',
  },
  '가루다 인도네시아': {
    terminal: 'T2',
    airline_name_kr: '가루다 인도네시아',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀',
    category: '외국 항공사(아시아)',
  },
  샤먼항공: {
    terminal: 'T2',
    airline_name_kr: '샤먼항공',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀',
    category: '외국 항공사(아시아)',
  },
  중화항공: {
    terminal: 'T2',
    airline_name_kr: '중화항공',
    checkin_counter: 'E, F 중 배정',
    note: '스카이팀',
    category: '외국 항공사(아시아)',
  },
  제주항공: {
    terminal: 'T1',
    airline_name_kr: '제주항공',
    checkin_counter: 'L, M',
    note: '',
    category: '국내 LCC',
  },
  티웨이항공: {
    terminal: 'T1',
    airline_name_kr: '티웨이항공',
    checkin_counter: 'E, F, G',
    note: '',
    category: '국내 LCC',
  },
  이스타항공: {
    terminal: 'T1',
    airline_name_kr: '이스타항공',
    checkin_counter: 'E, F, G',
    note: '',
    category: '국내 LCC',
  },
  에어프레미아: {
    terminal: 'T1',
    airline_name_kr: '에어프레미아',
    checkin_counter: 'J, K',
    note: '',
    category: '국내 LCC',
  },
  에어로케이: {
    terminal: 'T1',
    airline_name_kr: '에어로케이',
    checkin_counter: 'H, J, K',
    note: '',
    category: '국내 LCC',
  },
  파라타항공: {
    terminal: 'T1',
    airline_name_kr: '파라타항공',
    checkin_counter: 'H, J',
    note: '',
    category: '국내 LCC',
  },
  루프트한자: {
    terminal: 'T1',
    airline_name_kr: '루프트한자',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  '스위스 국제항공': {
    terminal: 'T1',
    airline_name_kr: '스위스 국제항공',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  아메리칸항공: {
    terminal: 'T1',
    airline_name_kr: '아메리칸항공',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  '에어 뉴질랜드': {
    terminal: 'T1',
    airline_name_kr: '에어 뉴질랜드',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  에어캐나다: {
    terminal: 'T1',
    airline_name_kr: '에어캐나다',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  유나이티드항공: {
    terminal: 'T1',
    airline_name_kr: '유나이티드항공',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  제트스타: {
    terminal: 'T1',
    airline_name_kr: '제트스타',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  콴타스항공: {
    terminal: 'T1',
    airline_name_kr: '콴타스항공',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  터키항공: {
    terminal: 'T1',
    airline_name_kr: '터키항공',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  '폴란드항공(LOT)': {
    terminal: 'T1',
    airline_name_kr: '폴란드항공(LOT)',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  핀에어: {
    terminal: 'T1',
    airline_name_kr: '핀에어',
    checkin_counter: 'H, I',
    note: '',
    category: '미주/유럽/대양주',
  },
  하와이안항공: {
    terminal: 'T1',
    airline_name_kr: '하와이안항공',
    checkin_counter: 'J, K',
    note: '',
    category: '미주/유럽/대양주',
  },
  에미레이트항공: {
    terminal: 'T1',
    airline_name_kr: '에미레이트항공',
    checkin_counter: 'J, K',
    note: '',
    category: '중동/아프리카',
  },
  에티오피아항공: {
    terminal: 'T1',
    airline_name_kr: '에티오피아항공',
    checkin_counter: 'J, K',
    note: '',
    category: '중동/아프리카',
  },
  에티하드항공: {
    terminal: 'T1',
    airline_name_kr: '에티하드항공',
    checkin_counter: 'J, K',
    note: '',
    category: '중동/아프리카',
  },
  카타르항공: {
    terminal: 'T1',
    airline_name_kr: '카타르항공',
    checkin_counter: 'J, K',
    note: '',
    category: '중동/아프리카',
  },
  중국국제항공: {
    terminal: 'T1',
    airline_name_kr: '중국국제항공',
    checkin_counter: 'H, I',
    note: '',
    category: '동북아시아',
  },
  중국남방항공: {
    terminal: 'T1',
    airline_name_kr: '중국남방항공',
    checkin_counter: 'F, G',
    note: '',
    category: '동북아시아',
  },
  중국동방항공: {
    terminal: 'T1',
    airline_name_kr: '중국동방항공',
    checkin_counter: 'F, G',
    note: '',
    category: '동북아시아',
  },
  캐세이퍼시픽항공: {
    terminal: 'T1',
    airline_name_kr: '캐세이퍼시픽항공',
    checkin_counter: 'H, I',
    note: '',
    category: '동북아시아',
  },
  에바항공: {
    terminal: 'T1',
    airline_name_kr: '에바항공',
    checkin_counter: 'H, I',
    note: '',
    category: '동북아시아',
  },
  길상항공: {
    terminal: 'T1',
    airline_name_kr: '길상항공',
    checkin_counter: 'D, E',
    note: '',
    category: '동북아시아',
  },
  마카오항공: {
    terminal: 'T1',
    airline_name_kr: '마카오항공',
    checkin_counter: 'E, F',
    note: '',
    category: '동북아시아',
  },
  산둥항공: {
    terminal: 'T1',
    airline_name_kr: '산둥항공',
    checkin_counter: 'D, E',
    note: '',
    category: '동북아시아',
  },
  상하이항공: {
    terminal: 'T1',
    airline_name_kr: '상하이항공',
    checkin_counter: 'F, G',
    note: '',
    category: '동북아시아',
  },
  선전항공: {
    terminal: 'T1',
    airline_name_kr: '선전항공',
    checkin_counter: 'H, I',
    note: '',
    category: '동북아시아',
  },
  쓰촨항공: {
    terminal: 'T1',
    airline_name_kr: '쓰촨항공',
    checkin_counter: 'D, E',
    note: '',
    category: '동북아시아',
  },
  '집에어 도쿄': {
    terminal: 'T1',
    airline_name_kr: '집에어 도쿄',
    checkin_counter: 'D, E',
    note: '',
    category: '동북아시아',
  },
  칭다오항공: {
    terminal: 'T1',
    airline_name_kr: '칭다오항공',
    checkin_counter: 'D, E',
    note: '',
    category: '동북아시아',
  },
  춘추항공: {
    terminal: 'T1',
    airline_name_kr: '춘추항공',
    checkin_counter: 'D, E',
    note: '',
    category: '동북아시아',
  },
  톈진항공: {
    terminal: 'T1',
    airline_name_kr: '톈진항공',
    checkin_counter: 'D, E',
    note: '',
    category: '동북아시아',
  },
  피치항공: {
    terminal: 'T1',
    airline_name_kr: '피치항공',
    checkin_counter: 'D, E',
    note: '',
    category: '동북아시아',
  },
  하이난항공: {
    terminal: 'T1',
    airline_name_kr: '하이난항공',
    checkin_counter: 'D, E',
    note: '',
    category: '동북아시아',
  },
  홍콩항공: {
    terminal: 'T1',
    airline_name_kr: '홍콩항공',
    checkin_counter: 'E, F',
    note: '',
    category: '동북아시아',
  },
  홍콩익스프레스: {
    terminal: 'T1',
    airline_name_kr: '홍콩익스프레스',
    checkin_counter: 'E, F',
    note: '',
    category: '동북아시아',
  },
  그레이터베이항공: {
    terminal: 'T1',
    airline_name_kr: '그레이터베이항공',
    checkin_counter: 'E, F',
    note: '',
    category: '동북아시아',
  },
  '타이거에어 타이완': {
    terminal: 'T1',
    airline_name_kr: '타이거에어 타이완',
    checkin_counter: 'E, F',
    note: '',
    category: '동북아시아',
  },
  말레이시아항공: {
    terminal: 'T1',
    airline_name_kr: '말레이시아항공',
    checkin_counter: 'H, I',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  베트남항공: {
    terminal: 'T1',
    airline_name_kr: '베트남항공',
    checkin_counter: 'E, F',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  비엣젯항공: {
    terminal: 'T1',
    airline_name_kr: '비엣젯항공',
    checkin_counter: 'H, I, J',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  세부퍼시픽: {
    terminal: 'T1',
    airline_name_kr: '세부퍼시픽',
    checkin_counter: 'H, I',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  스쿠트항공: {
    terminal: 'T1',
    airline_name_kr: '스쿠트항공',
    checkin_counter: 'E, F',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  싱가포르항공: {
    terminal: 'T1',
    airline_name_kr: '싱가포르항공',
    checkin_counter: 'J, K',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  '에어아시아 그룹': {
    terminal: 'T1',
    airline_name_kr: '에어아시아 그룹',
    checkin_counter: 'H, I, J',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  타이항공: {
    terminal: 'T1',
    airline_name_kr: '타이항공',
    checkin_counter: 'H, I',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  '타이 비엣젯 항공': {
    terminal: 'T1',
    airline_name_kr: '타이 비엣젯 항공',
    checkin_counter: 'H, I',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  필리핀항공: {
    terminal: 'T1',
    airline_name_kr: '필리핀항공',
    checkin_counter: 'H, I',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  라오항공: {
    terminal: 'T1',
    airline_name_kr: '라오항공',
    checkin_counter: 'K, L',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  '로열 브루나이 항공': {
    terminal: 'T1',
    airline_name_kr: '로열 브루나이 항공',
    checkin_counter: 'K, L',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  미얀마국제항공: {
    terminal: 'T1',
    airline_name_kr: '미얀마국제항공',
    checkin_counter: 'K, L',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  뱀부항공: {
    terminal: 'T1',
    airline_name_kr: '뱀부항공',
    checkin_counter: 'H, I',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  '스카이 앙코르 항공': {
    terminal: 'T1',
    airline_name_kr: '스카이 앙코르 항공',
    checkin_counter: 'K, L',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  'MIAT 몽골항공': {
    terminal: 'T1',
    airline_name_kr: 'MIAT 몽골항공',
    checkin_counter: 'F, G',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  '에어 아스타나': {
    terminal: 'T1',
    airline_name_kr: '에어 아스타나',
    checkin_counter: 'F, G',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
  우즈베키스탄항공: {
    terminal: 'T1',
    airline_name_kr: '우즈베키스탄항공',
    checkin_counter: 'F, G',
    note: '',
    category: '동남아시아 및 중앙아시아',
  },
}

/** Python `meeting_terminal_rules.py` 동기화·외부 덤프용 */
export const RAW_AIRLINE_NAME_ALIASES: Record<string, string> = {
  'korean air': '대한항공',
  koreanair: '대한항공',
  코리안에어: '대한항공',
  '대한 항공': '대한항공',
  대한항공: '대한항공',
  'asiana airlines': '아시아나항공',
  asiana: '아시아나항공',
  아시아나: '아시아나항공',
  아시아나항공: '아시아나항공',
  'tway air': '티웨이항공',
  "t'way air": '티웨이항공',
  't way air': '티웨이항공',
  티웨이: '티웨이항공',
  티웨이항공: '티웨이항공',
  'jeju air': '제주항공',
  제주항공: '제주항공',
  'jin air': '진에어',
  jinair: '진에어',
  진에어: '진에어',
  'air busan': '에어부산',
  airbusan: '에어부산',
  에어부산: '에어부산',
  'air seoul': '에어서울',
  airseoul: '에어서울',
  에어서울: '에어서울',
  'eastar jet': '이스타항공',
  eastar: '이스타항공',
  이스타: '이스타항공',
  이스타항공: '이스타항공',
  'air premia': '에어프레미아',
  airpremia: '에어프레미아',
  에어프레미아: '에어프레미아',
  'aero k': '에어로케이',
  aerok: '에어로케이',
  에어로케이: '에어로케이',
  'delta air lines': '델타항공',
  'delta airlines': '델타항공',
  delta: '델타항공',
  델타항공: '델타항공',
  'air france': '에어프랑스',
  에어프랑스: '에어프랑스',
  klm: 'KLM 네덜란드 항공',
  'klm royal dutch airlines': 'KLM 네덜란드 항공',
  'klm 네덜란드 항공': 'KLM 네덜란드 항공',
  'china airlines': '중화항공',
  중화항공: '중화항공',
  lufthansa: '루프트한자',
  루프트한자: '루프트한자',
  'cathay pacific': '캐세이퍼시픽항공',
  'cathay pacific airways': '캐세이퍼시픽항공',
  캐세이퍼시픽: '캐세이퍼시픽항공',
  캐세이퍼시픽항공: '캐세이퍼시픽항공',
  'singapore airlines': '싱가포르항공',
  싱가포르항공: '싱가포르항공',
  'vietnam airlines': '베트남항공',
  베트남항공: '베트남항공',
  'vietjet air': '비엣젯항공',
  vietjet: '비엣젯항공',
  비엣젯: '비엣젯항공',
  비엣젯항공: '비엣젯항공',
  'aeromexico': '아에로멕시코',
  'virgin atlantic': '버진 애틀랜틱',
  'scandinavian airlines': '스칸디나비아 항공',
  sas: '스칸디나비아 항공',
  aeroflot: '아에로플로트',
  garuda: '가루다 인도네시아',
  'garuda indonesia': '가루다 인도네시아',
  'xiamen airlines': '샤먼항공',
  'xiamenair': '샤먼항공',
  swiss: '스위스 국제항공',
  'swiss international': '스위스 국제항공',
  american: '아메리칸항공',
  'american airlines': '아메리칸항공',
  'air new zealand': '에어 뉴질랜드',
  'air canada': '에어캐나다',
  united: '유나이티드항공',
  'united airlines': '유나이티드항공',
  jetstar: '제트스타',
  qantas: '콴타스항공',
  turkish: '터키항공',
  'turkish airlines': '터키항공',
  lot: '폴란드항공(LOT)',
  'lot polish': '폴란드항공(LOT)',
  finnair: '핀에어',
  hawaiian: '하와이안항공',
  emirates: '에미레이트항공',
  ethiopian: '에티오피아항공',
  etihad: '에티하드항공',
  qatar: '카타르항공',
  'qatar airways': '카타르항공',
  'air china': '중국국제항공',
  'china southern': '중국남방항공',
  'china eastern': '중국동방항공',
  eva: '에바항공',
  'eva air': '에바항공',
  juneyao: '길상항공',
  airmacau: '마카오항공',
  'shandong airlines': '산둥항공',
  'shanghai airlines': '상하이항공',
  shenzhen: '선전항공',
  sichuan: '쓰촨항공',
  zipair: '집에어 도쿄',
  'qingdao airlines': '칭다오항공',
  spring: '춘추항공',
  tianjin: '톈진항공',
  peach: '피치항공',
  hainan: '하이난항공',
  hkexpress: '홍콩익스프레스',
  'hong kong express': '홍콩익스프레스',
  greaterbay: '그레이터베이항공',
  tigerair: '타이거에어 타이완',
  malaysia: '말레이시아항공',
  cebu: '세부퍼시픽',
  'cebu pacific': '세부퍼시픽',
  scoot: '스쿠트항공',
  airasia: '에어아시아 그룹',
  thai: '타이항공',
  'thai airways': '타이항공',
  philippine: '필리핀항공',
  lao: '라오항공',
  'royal brunei': '로열 브루나이 항공',
  myanmar: '미얀마국제항공',
  bamboo: '뱀부항공',
  skyangkor: '스카이 앙코르 항공',
  miat: 'MIAT 몽골항공',
  airastana: '에어 아스타나',
  uzbekistan: '우즈베키스탄항공',
}

export function normalizeAirlineName(name: string | null | undefined): string {
  if (name == null) return ''
  let s = String(name)
    .replace(/\u00a0/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\u2018\u2019\u201A\u201B`´]/g, '')
    .replace(/[^0-9a-zA-Z\uAC00-\uD7A3\s\-/&.]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  if (!s) return ''
  s = s
    .split('')
    .map((ch) => (/[A-Za-z]/.test(ch) ? ch.toLowerCase() : ch))
    .join('')
  return s.replace(/\s+/g, ' ').trim()
}

/** normalizeAirlineName 결과로 조회하는 별칭 → 대표 항공사 키 */
export const AIRLINE_NAME_ALIASES: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(RAW_AIRLINE_NAME_ALIASES)) {
    out[normalizeAirlineName(k)] = v
  }
  for (const key of Object.keys(ICN_TERMINAL_MAP_BY_AIRLINE_KEY)) {
    out[normalizeAirlineName(key)] = key
  }
  return out
})()

export function resolveAirlineTerminalKey(airlineName: string | null | undefined): string | null {
  const n = normalizeAirlineName(airlineName)
  if (!n) return null
  const hit = AIRLINE_NAME_ALIASES[n]
  return hit ?? null
}

export function resolveIcnTerminalInfo(airlineName: string | null | undefined): IcnTerminalInfo | null {
  const key = resolveAirlineTerminalKey(airlineName)
  if (!key) return null
  return ICN_TERMINAL_MAP_BY_AIRLINE_KEY[key] ?? null
}

/** ICN만 인식. 그 외 공항 코드는 null (터미널 추정 안 함). */
export function normalizeDepartureAirportCode(code: string | null | undefined): string | null {
  if (code == null) return null
  const raw = String(code).trim()
  if (!raw) return null
  const u = raw.toUpperCase()
  if (u === 'ICN' || /\bICN\b/.test(u)) return 'ICN'
  if (/인천/.test(raw) && (/(ICN|국제|공항)/.test(raw) || raw.length <= 12)) return 'ICN'
  return null
}

const ICN_FALLBACK_MESSAGE =
  '인천공항 출발 예정입니다. 이용 항공사 기준 터미널은 출발 전 별도 확인 부탁드립니다.'

/**
 * @param departureAirportCode 출발편 출발공항 코드(최종 입력·구조화 값 기준; ICN만 터미널 문구 생성).
 * @param airlineName 최종 항공 입력의 항공사명 또는 구조화 항공의 airlineName(비어 있을 때만 상위에서 fallback 주입).
 */
export function buildDepartureTerminalInfo(
  departureAirportCode: string | null | undefined,
  airlineName: string | null | undefined
): string | null {
  if (normalizeDepartureAirportCode(departureAirportCode) !== 'ICN') return null
  const n = normalizeAirlineName(airlineName)
  if (!n) return ICN_FALLBACK_MESSAGE
  const info = resolveIcnTerminalInfo(airlineName)
  if (!info) return ICN_FALLBACK_MESSAGE
  const tLabel = info.terminal === 'T1' ? '제1터미널' : '제2터미널'
  const parts: string[] = [`인천공항 ${tLabel} 출발 예정입니다.`]
  const counter = info.checkin_counter.trim()
  if (counter) {
    parts.push(`${info.airline_name_kr} 체크인 카운터는 ${counter} 구역입니다.`)
  } else {
    parts.push(`${info.airline_name_kr} 이용 고객은 ${tLabel}에서 수속해 주세요.`)
  }
  if (info.note.trim()) parts.push(info.note.trim())
  return parts.join(' ')
}

export type DepartureRowLike = {
  carrierName?: string | null
  outboundDepartureAirport?: string | null
  meetingInfoRaw?: string | null
  meetingPointRaw?: string | null
  meetingTerminalRaw?: string | null
}

/**
 * 출발 행의 `carrierName`·`outboundDepartureAirport`(최종 항공 입력·구조화 반영 후)으로 터미널 안내만 반영(ICN만).
 * 비-ICN은 meeting* raw 정리(null/비노출).
 */
/** 등록·재파싱 경로: 터미널/항공 자동 미팅 문구를 출발행에 싣지 않음(미팅 SSOT는 운영자 전용 입력만). */
export function applyDepartureTerminalMeetingInfo<T extends DepartureRowLike>(inputs: T[]): T[] {
  return inputs.map((d) => ({
    ...d,
    meetingInfoRaw: null,
    meetingPointRaw: null,
    meetingTerminalRaw: null,
  }))
}

/** 상세 HTML 텍스트에서 가는편 출발이 인천인 경우 ICN 코드 추정(보수). */
export function inferDepartureAirportCodeFromKoreanDetailText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const t = text.slice(0, 48000)
  if (/\bICN\b/i.test(t) && /인천|ICN/i.test(t)) return 'ICN'
  if (/가는편|출발\s*[:：]|편명/i.test(t) && /인천\s*\(?\s*ICN\s*\)?|인천(?:국제)?공항/i.test(t)) return 'ICN'
  if (/인천\s*\(\s*ICN\s*\)\s*출발|출발\s*[:：]\s*인천|인천\s*→/i.test(t)) return 'ICN'
  return null
}
