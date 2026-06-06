# 웰컴페이먼츠 온라인 PG — Bong투어 eSIM 연동 체크리스트

원본: `[웰컴페이먼츠] 온라인PG_가맹점연동가이드` (PC Web v1.10.13, Mobile v1.10.6, PAYAPI v5.1.7).  
로컬 참고 샘플: `docs/ops/welcomepay-guide.zip` (압축 해제본은 `.gitignore`).

## 운영 env (필수)

| 변수 | 운영 예시 | 비고 |
|------|-----------|------|
| `WELCOMEPAY_MID` | 가맹점 발급 MID | |
| `WELCOMEPAY_SIGN_KEY` | 웹표준 signKey · **PAYAPI 전체취소 signature** 동일 키 (§3.2.1) | 취소 실패 시 signKey·테스트/운영 MID 확인 |
| `WELCOMEPAY_ENV` | `production` | 실결제 |
| `NEXT_PUBLIC_SITE_URL` | `https://bongtour.com` | **returnUrl·P_NEXT_URL SSOT** — `NEXTAUTH_URL`만 두지 말 것 |

PG 가맹점 관리자에 등록할 URL (apex 기준):

- PC `returnUrl`: `https://bongtour.com/api/bongsim/checkout/welcomepay-return`
- 모바일 `P_NEXT_URL`: `https://bongtour.com/api/bongsim/checkout/welcomepay-mobile-next`
- PC `closeUrl` / `popupUrl`: `https://bongtour.com/travel/esim/checkout/payment/welcomepay/close` (+ 쿼리)

## PC Web (INIStdPay) — 코드 매핑

| 메뉴얼 단계 | 구현 |
|-------------|------|
| WelStdPayRequest — mid, oid, price, timestamp, signature, mKey | `welcomepay-prepare` + 결제 페이지 hidden 폼 |
| returnUrl | `welcomepay-prepare` → `/api/bongsim/checkout/welcomepay-return` |
| closeUrl / popupUrl | `welcomepay/close` → 결제 결과 `cancel` |
| gopaymethod=Card, currency=WON, version=1.0 | 결제 페이지 폼 |
| charset=UTF-8 | PC 폼 `charset` hidden |
| WelStdPayReturn — 인증 resultCode 0000 | `welcomepay-return` |
| WelStdPayResult — payAuth (mid, authToken, **새** timestamp·signature) | `lib/bongsim/welcomepay-payauth.ts` → `buildPcPayAuthFormBody` |
| authSignature 검증 (MOID, TotPrice) | `verifyWelcomepayAuthSignature` |
| 운영 JS URL | `welcomepayStdPayScriptUrl()` — `WELCOMEPAY_ENV=production` |

## Mobile Web (welpay) — 코드 매핑

| 메뉴얼 단계 | 구현 |
|-------------|------|
| P_MID, P_OID, P_AMT, P_TIMESTAMP, P_CHKFAKE | `welcomepay-prepare` mobile 블록 |
| P_RESERVED=centerCd=Y&amt_hash=Y | prepare·결제 폼 (필수) |
| P_CHKFAKE = BASE64(SHA512(P_AMT+P_OID+P_TIMESTAMP+HashKey)) | `generateMobileWelpayPChkfake` — HashKey=`WELCOMEPAY_MOBILE_HASH_KEY` 또는 signKey |
| P_NEXT_URL | `welcomepay-mobile-next` (쿼리 없음) |
| P_CHARSET=utf8 | prepare·결제 폼 `P_CHARSET` |
| P_REQ_URL 승인 — **P_MID + P_TID 만** | `buildMobilePayApprovalFormBody` |
| UTF-8 샘플 | `WelPayMoNextUrlUtf8` 흐름과 동일 |

## 미구현 (eSIM 카드 단건 범위 밖)

- 가상계좌·계좌이체·휴대폰·문화상품권 (`smart/bank`, `smart/mobile` 등)
- `P_NOTI_URL` 비동기 입금통보
- `netCancel` 망취소 자동 호출
- PAYAPI 부분취소·에스크로 (전체취소: `payapi.paywelcome.co.kr/cancel/cancel` — `lib/bongsim/welcomepay-payapi-cancel.ts`)
- PC `WelStdPayRelay` (popup crossDomain — overlay 사용)

## 배포 후 검증

1. `https://bongtour.com` 에서 소액 실결제 1건
2. DB: `bongsim_order.status = paid` → 발급 후 `delivered`, `bongsim_fulfillment_job.status = delivered`
3. 고객 이메일: `SMTP_*` 설정 시 QR·설치 링크 메일 발송
4. 결제 직후 `OrderPaid` outbox 자동 처리 (`drainOrderPaidOutboxBestEffort`)

이미 결제만 된 주문 복구: `npx tsx scripts/reprocess-bongsim-order-fulfillment.ts <order_id>`

진단: `npx tsx scripts/diagnose-bongsim-payment.ts`
