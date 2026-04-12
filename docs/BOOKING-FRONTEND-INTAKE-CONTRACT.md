# 고객 예약 UI 연동용 입력 계약 (프론트)

서버 단일 기준: `lib/booking-intake-contract.ts` · `POST /api/bookings`  
정책 요약: `docs/BOOKING-INTAKE-POLICY.md`

고객 UI는 **아직 구현하지 않아도** 폼 설계·검증 메시지는 본 문서와 맞춘다.

---

## 1. 필수 / 선택

| 필드 | 필수 | 비고 |
|------|------|------|
| `productId` | 예 | 상품 ID |
| `originSource` | 예* | 미입력 시 서버가 상품에서 채움. **클라이언트 전달 시** 상품과 동일하게 canonical만: `hanatour` \| `modetour` \| `ybtour` \| `verygoodtour` (한글 상호는 UI 라벨용). |
| `originCode` | 예* | 동일 |
| `selectedDepartureDate` 또는 `selectedDate` | 조건 | 상품 일정에서 고른 날 `YYYY-MM-DD`. **있으면** 해당 일자 **가격 필수** |
| `preferredDepartureDate` | 조건 | `YYYY-MM-DD`. **선택 일이 없을 때 희망일만으로 접수**할 때 필수 |
| `customerName` | 예 | |
| `customerPhone` | 예 | |
| `customerEmail` | 예 | |
| `adultCount` | 예 | 정수 ≥ 0 |
| `childCount` | 예 | 정수 ≥ 0. 생략 시 `childWithBedCount+childNoBedCount`로 서버 보정 가능 |
| `childWithBedCount` | 예 | |
| `childNoBedCount` | 예 | |
| `infantCount` | 예 | |
| `totalPax` | 선택 | **보내면** 반드시 `adult+child+infant`와 일치 |
| `singleRoomRequested` | 예 | boolean |
| `preferredContactChannel` | 예 | `phone` \| `kakao` \| `email` |
| `childInfantBirthDates` | 예* | 아동·유아가 0명이면 **빈 배열** |
| `requestNotes` | 아니오 | |
| `departureId` | 아니오 | 향후 회차 ID |

\* 출발일: **`selectedDepartureDate`(또는 `selectedDate`)와 `preferredDepartureDate` 중 최소 하나는 반드시** 있어야 한다.  
둘 다 있으면 견적은 **선택 일자** 기준이며, 희망일은 부가 정보로 저장될 수 있다.

**POST `/api/bookings` JSON 예시 (`originSource` / `originCode` — 복붙용):**

```json
{
  "productId": "…",
  "originSource": "modetour",
  "originCode": "AVP603VJC5",
  "selectedDepartureDate": "2026-05-01",
  "customerName": "홍길동",
  "customerPhone": "010-0000-0000",
  "customerEmail": "a@b.c",
  "adultCount": 2,
  "childCount": 0,
  "childWithBedCount": 0,
  "childNoBedCount": 0,
  "infantCount": 0,
  "singleRoomRequested": false,
  "preferredContactChannel": "phone",
  "childInfantBirthDates": []
}
```

다른 공급사는 `originSource`만 `hanatour` / `ybtour` / `verygoodtour` 등으로 바꾸면 된다.

---

## 2. 출발일 정책 (UX)

- **일정 캘린더에서 날짜 선택 가능** → `selectedDepartureDate` 전송(권장). 견적 자동 산정.
- **일정 미정/매진 등** → `preferredDepartureDate`만 전송. 접수는 되고 금액은 서버에서 0·`wish_date_only`(응답의 `pricingMode` 참고).
- 둘 다 보낼 수 있음: 선택 = 견적 기준, 희망 = 추가 희망.

---

## 3. 인원·생년월일 (child / infant)

- **아동 수** = `childWithBedCount + childNoBedCount` (서버 검증).
- `childInfantBirthDates`는 **객체 배열**:
  - 길이 = `childCount + infantCount`
  - `type`이 `child`인 항목 수 = `childCount`
  - `type`이 `infant`인 항목 수 = `infantCount`
  - 각 `birthDate`: `YYYY-MM-DD`

프론트 구현 팁:

- 아동 N명 → N개 행 `type: 'child'` + 생일 입력
- 유아 M명 → M개 행 `type: 'infant'` + 생일 입력
- 인원 0이면 배열 `[]`

---

## 4. API 응답 (성공)

```json
{
  "ok": true,
  "bookingId": 123,
  "message": "…접수 확인 문구…",
  "pricingMode": "schedule_price | wish_date_only"
}
```

---

## 5. 에러 메시지 (검증 실패 시)

HTTP **400**, 본문 `{ "error": "<문자열>" }`.  
서버는 여러 사유를 **한 문자열에 공백으로 연결**해 내려줄 수 있다. 프론트는:

- 전체를 그대로 표시하거나
- `split(' ')`으로 나누기보다는 **한 블록 메시지**로 표시하는 것을 권장

주요 메시지 예 (실제 문구는 `booking-intake-contract.ts` 기준):

- 고객 이름/휴대폰/이메일/productId/origin 누락
- `totalPax` 불일치
- 아동 베드+노베드 ≠ 아동 수
- 선택·희망 출발일 둘 다 없음
- 날짜 형식 오류
- 생년월일 건수/타입 불일치
- (선택 일 사용 시) 해당 일 **가격 없음** → `"선택한 출발일에 대한 가격 정보가 없습니다..."`

---

## 6. 관련 파일

- 검증: `lib/booking-intake-contract.ts`
- 라우트: `app/api/bookings/route.ts`
- 상태(관리자만): `lib/booking-status-policy.ts`

---

## 7. 다음 구현 단계 (고객 예약 UI)

본 문서를 **단일 계약**으로 삼아 아래를 순서대로 구현한다.

1. **예약 폼**
   - 상품 상세 컨텍스트에서 `productId`, `originSource`, `originCode` 주입
   - 출발일: 일정 선택 → `selectedDepartureDate` / 희망만 → `preferredDepartureDate` (§2)
   - 인원·베드/노베드·유아·생년월일 동적 필드 (§3)

2. **클라이언트 검증**
   - 서버 규칙과 동일한 제약을 최소한 반영(제출 전 UX). 최종 판정은 항상 서버.

3. **제출·성공/실패**
   - `POST /api/bookings` JSON
   - 성공: `ok`, `bookingId`, `message`, `pricingMode` 표시
   - 실패: HTTP 400, `error` 문자열 그대로 또는 인라인 안내 (§5)

4. **접수 완료 안내**
   - `message`를 그대로 노출(확정·결제 문구 금지). 필요 시 `pricingMode === 'wish_date_only'`일 때 금액 미확정 안내 문구 추가.

**구현 참고 (1차 반영)**: `app/components/travel/BookingIntakeModal.tsx` — 데스크톱 `TravelProductDetail`·모바일 `MobileProductDetail`에서 공통 사용.
