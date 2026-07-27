# 웰컴페이 eSIM 결제 계약 (Regression Freeze)

**얼림 id:** `welcomepay-esim-payment`  
**성공 기준 커밋:** `bc395fa` (모바일 `P_SIGNATURE` — PG 오류 01 「해시값이 없습니다」 해소)  
**manifest:** `scripts/regression-freeze-manifest.json` → `staticGuards` + `vitestSuites`

## 변경 규칙

의도적 스펙 변경이 아니면 아래 계약을 깨지 않는다. 변경 시 **같은 PR**에서 manifest 가드·vitest·`REGRESSION-FREEZE[welcomepay-esim-payment]` 마커를 함께 갱신한다.

## 모바일 (WelPayMoRequest 샘플)

| 항목 | 값 |
|------|-----|
| 신용카드 POST URL | `{mobileHost}/smart/wcard/` (trailing slash) |
| 수단 path | `wcard`·`vbank`·`bank`·`mobile`·`cgft`·`etc` |
| 해시 (기본) | `P_SIGNATURE` — `generateMobileWelpayPSignature` |
| 해시 (선택) | `WELCOMEPAY_MOBILE_AMT_HASH=1` → `amt_hash=Y` + `P_CHKFAKE` |
| `P_RESERVED` 기본 | `centerCd=Y` (+ 카드: ISP 옵션) |
| `P_NEXT_URL` | `/api/bongsim/checkout/welcomepay-mobile-next` — **쿼리 없음** |
| charset 기본 | `WELCOMEPAY_MOBILE_CHARSET=utf8` → `P_CHARSET=utf8`, `acceptCharset=UTF-8` |
| charset EUC-KR | `P_CHARSET` **미전송**, `acceptCharset=EUC-KR` |

**금지:** `/smart/welpay/`, `P_NEXT_URL`에 oid 쿼리, `P_CHARSET=EUC-KR` 값 전송.

## PC

- INIStdPay — `welcomepay-prepare` + `WelcomepayPaymentClient` hidden 폼
- `returnUrl` → `welcomepay-return` → `welcomepay-payauth.ts` payAuth

## env (운영)

- `WELCOMEPAY_MID`, `WELCOMEPAY_SIGN_KEY`, `WELCOMEPAY_ENV=production`
- `NEXT_PUBLIC_SITE_URL=https://bongtour.com` (콜백 URL SSOT)
- `WELCOMEPAY_EASY_PAY=1` (선택) — 간편결제 다이렉트. 운영 기본 on, `0`으로 off
- `WELCOMEPAY_EASY_PAY_METHODS=kakaopay,naverpay,tosspay,payco,samsungpay` (선택 allowlist)

## 재결제·취소 후

- `resetAfterPgOverlay()` — body 스크롤 잠금·`#inicisModalDiv` 등 PG 오버레이 DOM 제거
- 결과 페이지「다시 결제하기」는 soft Link 대신 `location.assign` + overlay reset (화면 정지 방지)
- 결제·체크아웃·close 진입 시 mount에서 reset

| 수단 | PC `gopaymethod` | 모바일 `P_RESERVED` |
|------|------------------|---------------------|
| 카카오페이 | `onlykakaopay` | `centerCd=Y&d_kakaopay=Y` |
| 네이버페이 | `onlynaverpay` | `centerCd=Y&d_npay=Y` |
| 토스페이 | `onlytosspay` | `centerCd=Y&d_tosspay=Y` |
| PAYCO | `onlypayco` | `centerCd=Y&d_payco=Y` |
| 삼성페이 | `onlyssp` | `centerCd=Y&d_samsungpay=Y` |

PC `acceptmethod`: `centerCd(Y):cardonly`. checkout id: `easy_kakaopay` 등. SSOT: `lib/bongsim/welcomepay-easy-pay.ts`.

## 검증

```bash
npm run verify:regression-freeze:prebuild
npm run verify:regression-freeze:ci   # vitest 포함
npx vitest run lib/bongsim/welcomepay-*.test.ts lib/bongsim/checkout/welcomepay-*.test.ts
npx tsx scripts/smoke-welcomepay-methods.ts --base=https://bongtour.com
```

## 관련

- 운영 체크리스트: `docs/ops/welcomepay-merchant-manual-checklist.md`
- Cursor 규칙: `.cursor/rules/welcomepay-esim-payment-frozen.mdc`
