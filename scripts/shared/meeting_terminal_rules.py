# -*- coding: utf-8 -*-
"""인천공항(ICN) 터미널 안내 — Next SSOT: lib/meeting-terminal-rules.ts (emit-meeting-terminal-py.ts 동기화).

공용 터미널 안내는 출발공항 코드 + 최종 항공 입력값(또는 최종 구조화 항공값)을 기준으로 생성한다.
스크래퍼 원문 항공사명은 직접 SSOT로 쓰지 않고, 필요 시 최종 항공 입력값이 비어 있을 때만 보조/fallback 참고값으로 제한한다.
ICN일 때만 터미널 문구를 생성하고, ICN 외 공항은 null 또는 비노출 처리한다. 시간/장소 문구는 포함하지 않는다.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

_ICN_JSON = "{\"대한항공\":{\"terminal\":\"T2\",\"airline_name_kr\":\"대한항공\",\"checkin_counter\":\"A, B, C, D\",\"note\":\"A: 일등석/프레스티지 B, C: 일반석/모바일/웹 D: 모닝캄 우수회원\",\"category\":\"국내 대형사\"},\"아시아나항공\":{\"terminal\":\"T2\",\"airline_name_kr\":\"아시아나항공\",\"checkin_counter\":\"G, H, J\",\"note\":\"J: 비즈니스/우수회원 H: 일반석 G: 셀프백드랍\",\"category\":\"국내 대형사\"},\"에어부산\":{\"terminal\":\"T2\",\"airline_name_kr\":\"에어부산\",\"checkin_counter\":\"F\",\"note\":\"당일 혼잡도에 따라 일부 변동 가능\",\"category\":\"국내 LCC\"},\"에어서울\":{\"terminal\":\"T2\",\"airline_name_kr\":\"에어서울\",\"checkin_counter\":\"F\",\"note\":\"당일 혼잡도에 따라 일부 변동 가능\",\"category\":\"국내 LCC\"},\"진에어\":{\"terminal\":\"T2\",\"airline_name_kr\":\"진에어\",\"checkin_counter\":\"F\",\"note\":\"당일 혼잡도에 따라 일부 변동 가능\",\"category\":\"국내 LCC\"},\"델타항공\":{\"terminal\":\"T2\",\"airline_name_kr\":\"델타항공\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀\",\"category\":\"외국 항공사(미주)\"},\"아에로멕시코\":{\"terminal\":\"T2\",\"airline_name_kr\":\"아에로멕시코\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀\",\"category\":\"외국 항공사(미주)\"},\"에어프랑스\":{\"terminal\":\"T2\",\"airline_name_kr\":\"에어프랑스\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀\",\"category\":\"외국 항공사(유럽)\"},\"KLM 네덜란드 항공\":{\"terminal\":\"T2\",\"airline_name_kr\":\"KLM 네덜란드 항공\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀\",\"category\":\"외국 항공사(유럽)\"},\"버진 애틀랜틱\":{\"terminal\":\"T2\",\"airline_name_kr\":\"버진 애틀랜틱\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀\",\"category\":\"외국 항공사(유럽)\"},\"스칸디나비아 항공\":{\"terminal\":\"T2\",\"airline_name_kr\":\"스칸디나비아 항공\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀\",\"category\":\"외국 항공사(유럽)\"},\"아에로플로트\":{\"terminal\":\"T2\",\"airline_name_kr\":\"아에로플로트\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀 (현재 운항 중단)\",\"category\":\"외국 항공사(유럽)\"},\"가루다 인도네시아\":{\"terminal\":\"T2\",\"airline_name_kr\":\"가루다 인도네시아\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀\",\"category\":\"외국 항공사(아시아)\"},\"샤먼항공\":{\"terminal\":\"T2\",\"airline_name_kr\":\"샤먼항공\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀\",\"category\":\"외국 항공사(아시아)\"},\"중화항공\":{\"terminal\":\"T2\",\"airline_name_kr\":\"중화항공\",\"checkin_counter\":\"E, F 중 배정\",\"note\":\"스카이팀\",\"category\":\"외국 항공사(아시아)\"},\"제주항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"제주항공\",\"checkin_counter\":\"L, M\",\"note\":\"\",\"category\":\"국내 LCC\"},\"티웨이항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"티웨이항공\",\"checkin_counter\":\"E, F, G\",\"note\":\"\",\"category\":\"국내 LCC\"},\"이스타항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"이스타항공\",\"checkin_counter\":\"E, F, G\",\"note\":\"\",\"category\":\"국내 LCC\"},\"에어프레미아\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에어프레미아\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"국내 LCC\"},\"에어로케이\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에어로케이\",\"checkin_counter\":\"H, J, K\",\"note\":\"\",\"category\":\"국내 LCC\"},\"파라타항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"파라타항공\",\"checkin_counter\":\"H, J\",\"note\":\"\",\"category\":\"국내 LCC\"},\"루프트한자\":{\"terminal\":\"T1\",\"airline_name_kr\":\"루프트한자\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"스위스 국제항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"스위스 국제항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"아메리칸항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"아메리칸항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"에어 뉴질랜드\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에어 뉴질랜드\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"에어캐나다\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에어캐나다\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"유나이티드항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"유나이티드항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"제트스타\":{\"terminal\":\"T1\",\"airline_name_kr\":\"제트스타\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"콴타스항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"콴타스항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"터키항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"터키항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"폴란드항공(LOT)\":{\"terminal\":\"T1\",\"airline_name_kr\":\"폴란드항공(LOT)\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"핀에어\":{\"terminal\":\"T1\",\"airline_name_kr\":\"핀에어\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"하와이안항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"하와이안항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"미주/유럽/대양주\"},\"에미레이트항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에미레이트항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"중동/아프리카\"},\"에티오피아항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에티오피아항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"중동/아프리카\"},\"에티하드항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에티하드항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"중동/아프리카\"},\"카타르항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"카타르항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"중동/아프리카\"},\"중국국제항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"중국국제항공\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동북아시아\"},\"중국남방항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"중국남방항공\",\"checkin_counter\":\"F, G\",\"note\":\"\",\"category\":\"동북아시아\"},\"중국동방항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"중국동방항공\",\"checkin_counter\":\"F, G\",\"note\":\"\",\"category\":\"동북아시아\"},\"캐세이퍼시픽항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"캐세이퍼시픽항공\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동북아시아\"},\"에바항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에바항공\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동북아시아\"},\"길상항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"길상항공\",\"checkin_counter\":\"D, E\",\"note\":\"\",\"category\":\"동북아시아\"},\"마카오항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"마카오항공\",\"checkin_counter\":\"E, F\",\"note\":\"\",\"category\":\"동북아시아\"},\"산둥항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"산둥항공\",\"checkin_counter\":\"D, E\",\"note\":\"\",\"category\":\"동북아시아\"},\"상하이항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"상하이항공\",\"checkin_counter\":\"F, G\",\"note\":\"\",\"category\":\"동북아시아\"},\"선전항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"선전항공\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동북아시아\"},\"쓰촨항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"쓰촨항공\",\"checkin_counter\":\"D, E\",\"note\":\"\",\"category\":\"동북아시아\"},\"집에어 도쿄\":{\"terminal\":\"T1\",\"airline_name_kr\":\"집에어 도쿄\",\"checkin_counter\":\"D, E\",\"note\":\"\",\"category\":\"동북아시아\"},\"칭다오항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"칭다오항공\",\"checkin_counter\":\"D, E\",\"note\":\"\",\"category\":\"동북아시아\"},\"춘추항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"춘추항공\",\"checkin_counter\":\"D, E\",\"note\":\"\",\"category\":\"동북아시아\"},\"톈진항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"톈진항공\",\"checkin_counter\":\"D, E\",\"note\":\"\",\"category\":\"동북아시아\"},\"피치항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"피치항공\",\"checkin_counter\":\"D, E\",\"note\":\"\",\"category\":\"동북아시아\"},\"하이난항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"하이난항공\",\"checkin_counter\":\"D, E\",\"note\":\"\",\"category\":\"동북아시아\"},\"홍콩항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"홍콩항공\",\"checkin_counter\":\"E, F\",\"note\":\"\",\"category\":\"동북아시아\"},\"홍콩익스프레스\":{\"terminal\":\"T1\",\"airline_name_kr\":\"홍콩익스프레스\",\"checkin_counter\":\"E, F\",\"note\":\"\",\"category\":\"동북아시아\"},\"그레이터베이항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"그레이터베이항공\",\"checkin_counter\":\"E, F\",\"note\":\"\",\"category\":\"동북아시아\"},\"타이거에어 타이완\":{\"terminal\":\"T1\",\"airline_name_kr\":\"타이거에어 타이완\",\"checkin_counter\":\"E, F\",\"note\":\"\",\"category\":\"동북아시아\"},\"말레이시아항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"말레이시아항공\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"베트남항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"베트남항공\",\"checkin_counter\":\"E, F\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"비엣젯항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"비엣젯항공\",\"checkin_counter\":\"H, I, J\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"세부퍼시픽\":{\"terminal\":\"T1\",\"airline_name_kr\":\"세부퍼시픽\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"스쿠트항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"스쿠트항공\",\"checkin_counter\":\"E, F\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"싱가포르항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"싱가포르항공\",\"checkin_counter\":\"J, K\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"에어아시아 그룹\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에어아시아 그룹\",\"checkin_counter\":\"H, I, J\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"타이항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"타이항공\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"타이 비엣젯 항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"타이 비엣젯 항공\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"필리핀항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"필리핀항공\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"라오항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"라오항공\",\"checkin_counter\":\"K, L\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"로열 브루나이 항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"로열 브루나이 항공\",\"checkin_counter\":\"K, L\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"미얀마국제항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"미얀마국제항공\",\"checkin_counter\":\"K, L\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"뱀부항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"뱀부항공\",\"checkin_counter\":\"H, I\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"스카이 앙코르 항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"스카이 앙코르 항공\",\"checkin_counter\":\"K, L\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"MIAT 몽골항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"MIAT 몽골항공\",\"checkin_counter\":\"F, G\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"에어 아스타나\":{\"terminal\":\"T1\",\"airline_name_kr\":\"에어 아스타나\",\"checkin_counter\":\"F, G\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"},\"우즈베키스탄항공\":{\"terminal\":\"T1\",\"airline_name_kr\":\"우즈베키스탄항공\",\"checkin_counter\":\"F, G\",\"note\":\"\",\"category\":\"동남아시아 및 중앙아시아\"}}"
_RAW_JSON = "{\"korean air\":\"대한항공\",\"koreanair\":\"대한항공\",\"코리안에어\":\"대한항공\",\"대한 항공\":\"대한항공\",\"대한항공\":\"대한항공\",\"asiana airlines\":\"아시아나항공\",\"asiana\":\"아시아나항공\",\"아시아나\":\"아시아나항공\",\"아시아나항공\":\"아시아나항공\",\"tway air\":\"티웨이항공\",\"t'way air\":\"티웨이항공\",\"t way air\":\"티웨이항공\",\"티웨이\":\"티웨이항공\",\"티웨이항공\":\"티웨이항공\",\"jeju air\":\"제주항공\",\"제주항공\":\"제주항공\",\"jin air\":\"진에어\",\"jinair\":\"진에어\",\"진에어\":\"진에어\",\"air busan\":\"에어부산\",\"airbusan\":\"에어부산\",\"에어부산\":\"에어부산\",\"air seoul\":\"에어서울\",\"airseoul\":\"에어서울\",\"에어서울\":\"에어서울\",\"eastar jet\":\"이스타항공\",\"eastar\":\"이스타항공\",\"이스타\":\"이스타항공\",\"이스타항공\":\"이스타항공\",\"air premia\":\"에어프레미아\",\"airpremia\":\"에어프레미아\",\"에어프레미아\":\"에어프레미아\",\"aero k\":\"에어로케이\",\"aerok\":\"에어로케이\",\"에어로케이\":\"에어로케이\",\"delta air lines\":\"델타항공\",\"delta airlines\":\"델타항공\",\"delta\":\"델타항공\",\"델타항공\":\"델타항공\",\"air france\":\"에어프랑스\",\"에어프랑스\":\"에어프랑스\",\"klm\":\"KLM 네덜란드 항공\",\"klm royal dutch airlines\":\"KLM 네덜란드 항공\",\"klm 네덜란드 항공\":\"KLM 네덜란드 항공\",\"china airlines\":\"중화항공\",\"중화항공\":\"중화항공\",\"lufthansa\":\"루프트한자\",\"루프트한자\":\"루프트한자\",\"cathay pacific\":\"캐세이퍼시픽항공\",\"cathay pacific airways\":\"캐세이퍼시픽항공\",\"캐세이퍼시픽\":\"캐세이퍼시픽항공\",\"캐세이퍼시픽항공\":\"캐세이퍼시픽항공\",\"singapore airlines\":\"싱가포르항공\",\"싱가포르항공\":\"싱가포르항공\",\"vietnam airlines\":\"베트남항공\",\"베트남항공\":\"베트남항공\",\"vietjet air\":\"비엣젯항공\",\"vietjet\":\"비엣젯항공\",\"비엣젯\":\"비엣젯항공\",\"비엣젯항공\":\"비엣젯항공\",\"aeromexico\":\"아에로멕시코\",\"virgin atlantic\":\"버진 애틀랜틱\",\"scandinavian airlines\":\"스칸디나비아 항공\",\"sas\":\"스칸디나비아 항공\",\"aeroflot\":\"아에로플로트\",\"garuda\":\"가루다 인도네시아\",\"garuda indonesia\":\"가루다 인도네시아\",\"xiamen airlines\":\"샤먼항공\",\"xiamenair\":\"샤먼항공\",\"swiss\":\"스위스 국제항공\",\"swiss international\":\"스위스 국제항공\",\"american\":\"아메리칸항공\",\"american airlines\":\"아메리칸항공\",\"air new zealand\":\"에어 뉴질랜드\",\"air canada\":\"에어캐나다\",\"united\":\"유나이티드항공\",\"united airlines\":\"유나이티드항공\",\"jetstar\":\"제트스타\",\"qantas\":\"콴타스항공\",\"turkish\":\"터키항공\",\"turkish airlines\":\"터키항공\",\"lot\":\"폴란드항공(LOT)\",\"lot polish\":\"폴란드항공(LOT)\",\"finnair\":\"핀에어\",\"hawaiian\":\"하와이안항공\",\"emirates\":\"에미레이트항공\",\"ethiopian\":\"에티오피아항공\",\"etihad\":\"에티하드항공\",\"qatar\":\"카타르항공\",\"qatar airways\":\"카타르항공\",\"air china\":\"중국국제항공\",\"china southern\":\"중국남방항공\",\"china eastern\":\"중국동방항공\",\"eva\":\"에바항공\",\"eva air\":\"에바항공\",\"juneyao\":\"길상항공\",\"airmacau\":\"마카오항공\",\"shandong airlines\":\"산둥항공\",\"shanghai airlines\":\"상하이항공\",\"shenzhen\":\"선전항공\",\"sichuan\":\"쓰촨항공\",\"zipair\":\"집에어 도쿄\",\"qingdao airlines\":\"칭다오항공\",\"spring\":\"춘추항공\",\"tianjin\":\"톈진항공\",\"peach\":\"피치항공\",\"hainan\":\"하이난항공\",\"hkexpress\":\"홍콩익스프레스\",\"hong kong express\":\"홍콩익스프레스\",\"greaterbay\":\"그레이터베이항공\",\"tigerair\":\"타이거에어 타이완\",\"malaysia\":\"말레이시아항공\",\"cebu\":\"세부퍼시픽\",\"cebu pacific\":\"세부퍼시픽\",\"scoot\":\"스쿠트항공\",\"airasia\":\"에어아시아 그룹\",\"thai\":\"타이항공\",\"thai airways\":\"타이항공\",\"philippine\":\"필리핀항공\",\"lao\":\"라오항공\",\"royal brunei\":\"로열 브루나이 항공\",\"myanmar\":\"미얀마국제항공\",\"bamboo\":\"뱀부항공\",\"skyangkor\":\"스카이 앙코르 항공\",\"miat\":\"MIAT 몽골항공\",\"airastana\":\"에어 아스타나\",\"uzbekistan\":\"우즈베키스탄항공\"}"

ICN_TERMINAL_MAP_BY_AIRLINE_KEY: Dict[str, Dict[str, Any]] = json.loads(_ICN_JSON)
RAW_AIRLINE_NAME_ALIASES: Dict[str, str] = json.loads(_RAW_JSON)

_ICN_FALLBACK_MESSAGE = (
    "인천공항 출발 예정입니다. 이용 항공사 기준 터미널은 출발 전 별도 확인 부탁드립니다."
)


def normalize_airline_name(name: Optional[str]) -> str:
    if name is None:
        return ""
    s = str(name).replace("\u00a0", " ")
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"['`´]", "", s)
    s = re.sub(r"[^0-9a-zA-Z\uac00-\ud7a3\s\-/&.]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return ""
    s = "".join(ch.lower() if "a" <= ch <= "z" or "A" <= ch <= "Z" else ch for ch in s)
    return re.sub(r"\s+", " ", s).strip()


def _build_airline_name_aliases() -> Dict[str, str]:
    out: Dict[str, str] = {}
    for k, v in RAW_AIRLINE_NAME_ALIASES.items():
        out[normalize_airline_name(k)] = v
    for key in ICN_TERMINAL_MAP_BY_AIRLINE_KEY.keys():
        out[normalize_airline_name(key)] = key
    return out


AIRLINE_NAME_ALIASES: Dict[str, str] = _build_airline_name_aliases()


def resolve_airline_terminal_key(airline_name: Optional[str]) -> Optional[str]:
    n = normalize_airline_name(airline_name)
    if not n:
        return None
    return AIRLINE_NAME_ALIASES.get(n)


def resolve_icn_terminal_info(airline_name: Optional[str]) -> Optional[Dict[str, Any]]:
    key = resolve_airline_terminal_key(airline_name)
    if not key:
        return None
    return ICN_TERMINAL_MAP_BY_AIRLINE_KEY.get(key)


def normalize_departure_airport_code(code: Optional[str]) -> Optional[str]:
    if code is None:
        return None
    raw = str(code).strip()
    if not raw:
        return None
    u = raw.upper()
    if u == "ICN" or re.search(r"\bICN\b", u):
        return "ICN"
    if "인천" in raw and (re.search(r"(ICN|국제|공항)", raw) or len(raw) <= 12):
        return "ICN"
    return None


def build_departure_terminal_info(
    departure_airport_code: Optional[str], airline_name: Optional[str]
) -> Optional[str]:
    if normalize_departure_airport_code(departure_airport_code) != "ICN":
        return None
    n = normalize_airline_name(airline_name)
    if not n:
        return _ICN_FALLBACK_MESSAGE
    info = resolve_icn_terminal_info(airline_name)
    if not info:
        return _ICN_FALLBACK_MESSAGE
    t_label = "제1터미널" if info["terminal"] == "T1" else "제2터미널"
    parts = [f"인천공항 {t_label} 출발 예정입니다."]
    counter = str(info.get("checkin_counter", "")).strip()
    if counter:
        parts.append(f"{info['airline_name_kr']} 체크인 카운터는 {counter} 구역입니다.")
    else:
        parts.append(f"{info['airline_name_kr']} 이용 고객은 {t_label}에서 수속해 주세요.")
    note = str(info.get("note", "")).strip()
    if note:
        parts.append(note)
    return " ".join(parts)
