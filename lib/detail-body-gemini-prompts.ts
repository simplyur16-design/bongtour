export const DETAIL_BODY_GEMINI_PROMPTS = {
  normalize_hotel_table: `아래 텍스트는 여행상품의 호텔/예정호텔 영역이다.
목표는 설명문 요약이 아니라 실제 호텔 row를 canonical schema로 변환하는 것이다.

규칙:
- 허용 필드: dayLabel, dateText, cityText, bookingStatusText, hotelNameText, hotelCandidates, noteText
- 헤더/설명문/유의사항은 row로 만들지 말 것
- 여러 호텔명이 한 셀에 있으면 hotelCandidates에 분리 저장 가능
- 불명확하면 비워두고 reviewReasons에 남길 것
- 절대 없는 호텔명을 생성하지 말 것

출력:
{
  "rows": [],
  "reviewNeeded": false,
  "reviewReasons": []
}

입력:
{{section_text}}`,
  normalize_optional_tours_table: `아래 텍스트는 여행상품의 선택관광/현지옵션 영역이다.
목표는 실제 선택관광 데이터행만 canonical schema로 변환하는 것이다.

규칙:
- 허용 필드: tourName, currency, adultPrice, childPrice, durationText, minPeopleText, guide同行Text, waitingPlaceText, descriptionText, noteText
- 헤더, 안내문, 마일리지, 유의사항, 브랜드 문구는 row로 만들지 말 것
- 실제 상품행만 rows에 넣을 것
- 애매하면 넣지 말고 reviewReasons에 남길 것
- tourName을 임의 생성하지 말 것

출력:
{
  "rows": [],
  "reviewNeeded": false,
  "reviewReasons": []
}

입력:
{{section_text}}`,
  normalize_shopping_table: `아래 텍스트는 여행상품의 쇼핑 영역이다.
목표는 실제 쇼핑 row만 canonical schema로 변환하는 것이다.

규칙:
- 허용 필드: shoppingItem, shoppingPlace, durationText, refundPolicyText, noteText
- 쇼핑횟수 문구는 shoppingCountText로만 처리하고 rows에 넣지 말 것
- 환불 장문 전체를 개별 쇼핑 row로 만들지 말 것
- 헤더/안내문/유의사항은 row 금지
- 애매하면 reviewReasons로만 남길 것

출력:
{
  "rows": [],
  "shoppingCountText": "",
  "reviewNeeded": false,
  "reviewReasons": []
}

입력:
{{section_text}}`,
  normalize_flight_block: `아래 텍스트는 여행상품의 항공/출국/입국 블록이다.
목표는 가는편/오는편을 canonical flight schema로 변환하는 것이다.

규칙:
- airlineName, outbound, inbound만 채울 것
- 없는 값은 추정 생성하지 말 것
- 가는편/오는편 구분이 불확실하면 reviewNeeded=true로 할 것
- 편명, 공항, 날짜, 시간은 원문 보존을 우선할 것

출력:
{
  "airlineName": "",
  "outbound": {},
  "inbound": {},
  "rawFlightLines": [],
  "reviewNeeded": false,
  "reviewReasons": []
}

입력:
{{section_text}}`,
  summarize_included_excluded: `아래 텍스트는 포함/불포함 영역이다.
목표는 포함항목과 불포함항목을 분리하는 것이다.

규칙:
- 포함과 불포함을 섞지 말 것
- 불릿/목록 우선
- 장문은 항목 단위로 최대한 분리
- 없는 항목은 생성 금지

출력:
{
  "includedItems": [],
  "excludedItems": [],
  "noteText": "",
  "reviewNeeded": false,
  "reviewReasons": []
}

입력:
{{section_text}}`,
} as const

