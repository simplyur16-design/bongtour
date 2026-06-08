# 웰컴페이먼츠 온라인 PG — Bong투어 eSIM 연동 체크리스트

원본: `[웰컴페이먼츠] 온라인PG_가맹점연동가이드` (PC Web v1.10.13, Mobile v1.10.6, PAYAPI v5.1.7).  
로컬 참고 샘플: `docs/ops/welcomepay-guide.zip` (압축 해제본은 `.gitignore`).  
운영자 PC 가이드: `[온라인PG]가맹점연동가이드/샘플소스/페이 웰컴 샘플소스_PHP/PHP_MOBILE/`

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
- 가상계좌 `P_NOTI_URL`: `https://bongtour.com/api/bongsim/checkout/welcomepay-vbank-noti`
- PC `closeUrl` / `popupUrl`: `https://bongtour.com/travel/esim/checkout/payment/welcomepay/close` (+ 쿼리)

## PC Web (INIStdPay) — 코드 매핑

| 메뉴얼 단계 | 구현 |
|-------------|------|
| WelStdPayRequest — mid, oid, price, timestamp, signature, mKey | `welcomepay-prepare` + 결제 페이지 hidden 폼 |
| returnUrl | `welcomepay-prepare` → `/api/bongsim/checkout/welcomepay-return` |
| closeUrl / popupUrl | `welcomepay/close` → 결제 결과 `cancel` |
| gopaymethod (Card·VBank·DirectBank·HPP·Culture·해외 GLOBAL) | 결제 페이지 — 수단 선택 시 `methods[].pc` |
| charset=UTF-8 | PC 폼 `charset` hidden |
| WelStdPayReturn — 인증 resultCode 0000 | `welcomepay-return` |
| WelStdPayResult — payAuth (mid, authToken, **새** timestamp·signature) | `lib/bongsim/welcomepay-payauth.ts` → `buildPcPayAuthFormBody` |
| authSignature 검증 (MOID, TotPrice) | `verifyWelcomepayAuthSignature` |
| 운영 JS URL | `welcomepayStdPayScriptUrl()` — `WELCOMEPAY_ENV=production` |

## Mobile Web (§1.2 지불수단별 URL) — 코드 매핑

| 메뉴얼 단계 | 구현 |
|-------------|------|
| 결제창 POST URL | `welcomepayMobileSubmitUrlForMethod(id)` — `wcard`·`vbank`·`bank`·`mobile`·`cgft`·`etc` (`lib/bongsim/welcomepay-payment-methods.ts`) |
| P_INI_PAYMENT | CARD·VBANK·BANK·HPP·CULTURE (해외카드=CARD + `/smart/etc/`) |
| P_NOTI_URL (가상계좌) | `welcomepayVbankNotiCallbackUrlRegistered()` → `welcomepay-vbank-noti` |
| P_HPP_METHOD=1 | 휴대폰 결제 시 (eSIM=디지털 컨텐츠) |
| P_MID, P_OID, P_AMT, P_TIMESTAMP, P_CHKFAKE | `welcomepay-prepare` mobile 블록 |
| P_RESERVED=centerCd=Y&amt_hash=Y | prepare·결제 폼 (필수) |
| P_CHKFAKE = BASE64(SHA512(P_AMT+P_OID+P_TIMESTAMP+HashKey)) | HashKey 기본=SHA256(signKey) hex(`mkey`); 부가정보 값=`WELCOMEPAY_MOBILE_HASH_KEY`; raw Signkey=`WELCOMEPAY_MOBILE_HASH_KEY_SOURCE=signkey` |
| P_NEXT_URL (가맹점 등록·결제 폼 동일) | `welcomepay-mobile-next` path만 (쿼리 없음) — 폼에 쿼리 붙이면 01 거절 가능 |
| 주문번호 복구 | hidden `P_OID`·`P_NOTI` + prepare 쿠키 |
| 인코딩 | 기본 `WELCOMEPAY_MOBILE_CHARSET=utf8` → 폼 `P_CHARSET=utf8` + `acceptCharset=UTF-8` (`WelPayMoNextUrlUtf8` 흐름). EUC-KR 시 env `euc-kr` → `P_CHARSET` **미전송** + `acceptCharset=EUC-KR` (`WelPayMoNextUrl`) — 값 `EUC-KR` 전송 금지 |
| 신용카드 `P_RESERVED` | `centerCd=Y&amt_hash=Y` + 샘플 ISP 옵션 `twotrs_isp=Y&block_isp=Y&twotrs_isp_noti=N&apprun_check=Y` |
| 해시 | 샘플 구버전 `P_SIGNATURE`(SHA256) 대신 `amt_hash=Y` 시 **`P_CHKFAKE`** (SHA512+HashKey) |
| P_REQ_URL 승인 — **P_MID + P_TID 만** | `buildMobilePayApprovalFormBody` |
| UTF-8 샘플 | `WelPayMoNextUrlUtf8` 흐름과 동일 |

## 미구현

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
