# Handoff: Simply UR — Product 상세 [05]

## Overview
Plans에서 **Select** 후 진입. 선택한 **일수·데이터·망** 요약 + 구매 CTA.

## Flow
`Plans (일수 선택) → ★ Product → Checkout (미오픈 시 disabled)`

## Fidelity
Plans 카드·토큰 연속성. 배경 `#FFF4EF`.

## Layout
- 뒤로: Back to plans
- 제목: `plan_summary` (예: Korea 7-day Unlimited Roaming)
- 가격: large coral
- Detail panel (card 18px):
  - Network: Roaming / Local
  - Duration: {N} days (피커에서 이미 선택 — 확인용)
  - Data: {data_label}
- CTA:
  - **현재:** disabled `Checkout opening soon` + hint
  - **오픈 후:** `Buy now` coral 56px

## States
Loading skeleton · Not found · Checkout disabled · Checkout enabled (future)

## Out of scope
Plans picker, Guide, My eSIM

## 산출물
Loaded + disabled CTA variant + HTML reference
