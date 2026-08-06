# eSIM QR 카카오 알림톡 (Solapi)

결제·발급 완료 후 `deliverEsimToCustomer` → `bongsim_outbox` topic `EsimQrNotify` enqueue →
순차 드레인(`ESIM_QR_NOTIFY_GAP_MS`, 기본 1200ms) → `sendEsimQrDeliveredAlimTalk` (+ LMS 폴백).

단체 일괄처럼 웹훅이 몰려도 Solapi를 동시에 때리지 않는다. 실패 시 outbox 초 단위 백오프 재시도(최대 5회).

## 환경 변수

| 변수 | 설명 |
|------|------|
| `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` / `SOLAPI_FROM_PHONE` | 기존 Solapi 자격 |
| `SOLAPI_PFID` 또는 `SOLAPI_KAKAO_PFID` | 카카오 채널 PF ID |
| `SOLAPI_TPL_ESIM_QR_DELIVERED` | **필수(실발송)** — 아래 승인 템플릿 ID |

### 승인 템플릿 SSOT

- **ID:** `KA01TP260529080045939hjuDabvEjcg`
- **이름:** `[Bong투어] eSIM 발급 완료`
- **버튼:** `QR·설치코드 보기` → `https://bongtour.com#{installPath}`
- **변수:** `orderNumber`, `installPath` 만 (구 `installLink`/`qrLink` **미사용**)

검증: `npx tsx scripts/verify-solapi-esim-qr-template.ts`  
(잘못된·삭제된 템플릿 ID면 알림톡 실패 → LMS 폴백. LMS는 동작해도 고객은 알림톡 버튼이 “안 열린다”고 느낄 수 있음.)

## 템플릿 변수 (솔라피·카카오 등록명과 동일해야 함)

| 변수 | 내용 |
|------|------|
| `orderNumber` | 주문번호 (예: BS-20260522-…) |
| `installPath` | **주문 완료 경로** (도메인 제외, 예: `/travel/esim/order/{uuid}/complete`) |

문자/알림톡에는 LPA·설치 파일 URL을 넣지 않는다. 주문 완료 페이지에서 QR·iPhone/Galaxy 바로 설치를 연다.

## 예시 문구 (심사용 참고)

```
[Bong투어] eSIM 발급 완료

주문하신 eSIM이 정상 발급되었습니다.

· 주문번호: #{orderNumber}

아래 'QR·설치코드 보기'에서
QR 코드와 설치 코드를 확인하실 수 있습니다.
```

버튼: `https://bongtour.com#{installPath}`

## 기기 구분 (iPhone / Galaxy)

- 알림톡·LMS는 **기기 구분 없이** 주문 완료 페이지만 보냅니다. (휴대폰 번호만으로는 OS를 알 수 없음)
- **원클릭 설치 URL**은 주문 페이지·이메일에 **iPhone + Galaxy/Android 둘 다** 노출합니다.
  - iPhone: `esimsetup.apple.com/...`
  - Android: `esimsetup.android.com/...`
- QR 스캔은 양쪽 공통입니다.

## 수신 번호

- 체크아웃 **휴대폰** 필드 → `bongsim_order.buyer_tel` (선물 주문은 `consents.gift.recipient_phone`)
- 미입력 주문: 회원 `User.phone`(이메일 일치) 폴백
- 알림톡 실패 시 **LMS**로 주문 완료 URL 발송 (`buildBongsimOrderCompleteUrl` — apex `bongtour.com`)

## 체크아웃

고객은 결제 전 **휴대폰(010…)** 입력이 필수입니다.
