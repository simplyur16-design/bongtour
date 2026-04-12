# 예약 요청 접수 정책 (관리자 중심)

코드 기준: `lib/booking-intake-contract.ts` · `app/api/bookings/route.ts`

상태·전이: [BOOKING-STATUS-POLICY.md](./BOOKING-STATUS-POLICY.md)

고객 UI 연동(프론트 계약): [BOOKING-FRONTEND-INTAKE-CONTRACT.md](./BOOKING-FRONTEND-INTAKE-CONTRACT.md)

PII 익명화 배치 운영: [BOOKING-PII-PURGE-RUNBOOK.md](./BOOKING-PII-PURGE-RUNBOOK.md)

## 1) 목적과 전제

- 예약하기는 **자동 예약이 아니다**.
- **고객 정보 접수 → 운영자 수동 예약 진행** 구조다.
- 고객 UI는 미구현일 수 있으나, **서버 입력 계약은 본 문서·코드와 동일**해야 한다.

## 2) POST `/api/bookings` 최종 필드 (JSON)

| 필드 | 필수 | 설명 |
|------|------|------|
| `productId` | 예 | 상품 ID |
| `originSource` | 예 | 공급 식별. **권장:** 상품과 동일한 canonical (`hanatour`·`modetour`·`ybtour`·`verygoodtour`). 미전달 시 상품 값 사용. |
| `originCode` | 예 | 상품 코드(미전달 시 상품 값 사용) |
| `selectedDepartureDate` | 조건 | `YYYY-MM-DD`. 상품 일정에서 **고른 날짜**. 있으면 해당 일자 **가격으로 견적**(`pricingMode: schedule_price`). |
| `selectedDate` | 대체 키 | 하위 호환: `selectedDepartureDate`와 동일 의미로 처리됨. |
| `preferredDepartureDate` | 조건 | `YYYY-MM-DD`. **희망** 출발일. `selectedDepartureDate`가 없을 때 **필수**로 간주(둘 중 하나 필수). |
| `departureId` | 아니오 | 향후 `ProductDeparture` 연계용 |
| `customerName` | 예 | 고객 이름 |
| `customerPhone` | 예 | 휴대폰 |
| `customerEmail` | 예 | 이메일 |
| `adultCount` | 예 | 성인 수 (0 이상 정수) |
| `childCount` | 예 | 아동 수. 생략 시 `childWithBedCount+childNoBedCount`로 보정 가능 |
| `childWithBedCount` | 예 | 아동(베드) |
| `childNoBedCount` | 예 | 아동(노베드) |
| `infantCount` | 예 | 유아 수 |
| `totalPax` | 조건 | **합계 검증용**. 전달 시 반드시 `성인+아동+유아`와 일치. 미전달 시 서버가 합계만 사용. |
| `singleRoomRequested` | 예 | 1인실 요청 여부 (boolean) |
| `preferredContactChannel` | 예 | `phone` \| `kakao` \| `email` (대소문자 무시, 기본 `phone`) |
| `childInfantBirthDates` | 예 | 배열. 아동·유아 **각각** `{ "type": "child"\|"infant", "birthDate": "YYYY-MM-DD" }`. |
| `requestNotes` | 아니오 | 요청사항 |

### 출발일 정책

- **선택 출발일**과 **희망 출발일** 중 **하나 이상 필수**.
- 선택 출발일이 있으면: 해당 날짜에 **가격 행이 있어야** 하며, 없으면 400(매진·변경 안내 메시지).
- 희망만 있으면: 접수는 되고 `pricingMode: wish_date_only`, **원화/현지 금액 0**으로 저장(담당자 확인 후 안내).
- 둘 다 있으면: 견적은 **선택 일자** 기준, DB에 희망일은 `preferredDepartureDate`로 병기.

### 인원·생년월일 검증 (서버)

- `childWithBedCount + childNoBedCount === childCount`
- `성인 + 아동 + 유아 === totalPax` (totalPax 필드가 오면 **합계와 불일치 시 에러**)
- `childInfantBirthDates` 길이 === `childCount + infantCount`
- `type=child` 개수 === `childCount`, `type=infant` 개수 === `infantCount`
- 생년월일은 모두 `YYYY-MM-DD`

에러 메시지는 한국어 한 줄 병합 또는 배열을 공백으로 이어 반환한다.

## 3) 응답 (공개)

- `ok`, `bookingId`, `message`(접수 확인 문구), `pricingMode` (`schedule_price` \| `wish_date_only`)

## 4) 관리자 알림·고객 확인

- 관리자: `lib/booking-alert-payload.ts` · `lib/notification-service.ts` (PII 최소화 유지)
- 고객: 접수 확인만. 확정·결제·혜택은 문구상 “확인 후 안내”로 고정 (`buildCustomerBookingReceiptMessage`)

## 5) PII

- 관리자 목록/상세 마스킹: `lib/pii.ts` · `/api/admin/bookings*`
- 보관·파기·배치: `scripts/purge-old-bookings.ts` 및 운영 런북

## 6) 구현 시점

- 고객 상품 상세 흐름·`Product`/`ProductDeparture` 안정화 후 UI 착수.
- 선행: 본 입력 계약·상태 정책·알림·PII (현재 문서·코드 기준).

## 7) 혜택 연결 (UI 미구현)

- Brand / Product / 기간성 혜택은 추후 스냅샷 필드 확장 여지. 예약 접수 본문에는 포함하지 않음.
