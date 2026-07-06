# Handoff: Simply UR — My eSIM

## Overview
**로그인 후** 주문·QR·**데이터 사용량**. 앱 4번째 탭 또는 Home 진입 (웹은 이미 `/my-esim`).

## Flow
`Login (Apple/Google/Email) → ★ My eSIM`  
Guest는 Guide/Plans만 — My eSIM은 sign-in required empty state.

## Fidelity
`#FFF4EF`, coral/navy, Poppins. Plans/Guide와 동일.

## Screens
1. **Sign-in required** — CTA → Login 1b
2. **Empty** — no orders yet · Browse plans
3. **Order list** — date, plan summary, status badge
4. **Order detail** — View QR · **Data usage**
5. **Usage modal** — daily bars / used MB · unlimited label

## API (이미 있음)
`GET /api/simplyur/mypage/orders` · `GET /api/simplyur/mypage/usage?orderId=`

## Out of scope
Checkout form, Guide, USIM

## 산출물
List + usage expanded + sign-in required + HTML reference
