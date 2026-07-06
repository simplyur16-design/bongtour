# Handoff: Simply UR — 상품 선택 (Korea eSIM Plans)

## Overview

로그인(1b) 다음에 사용자가 **한국 체류 기간을 고른 뒤**, 그 기간에 맞는 eSIM 요금제를 고르는 화면입니다.  
Phase 1은 **대한민국 단일 카탈로그**만 있으며, 국가·도시 선택 UI는 없습니다.

**핵심 UX:** 먼저 **머무는 일수** → 그다음 **해당 일수의 플랜 목록** (로밍 vs 로컬망 · 데이터 · 가격).

## About the Design Files

산출물은 **HTML design reference** (내부 DC 형식)로 제공해도 됩니다.  
개발팀은 React Native(앱) / Next.js(웹)로 **재구현**합니다 — HTML을 그대로 복붙하지 않습니다.

## Fidelity

**High-fidelity.** 색·타이포·간격은 로그인 1b handoff와 동일 SSOT를 따릅니다.

---

## 1. 전체 화면 순서

```
[01 Opening]     오프닝 — 한국 사진 + Get Started
       ↓
[02 Login 1b]    Apple / Google / Email / Skip
       ↓ Skip 또는 로그인 성공
[03 Home]        홈 탭 — 히어로 + "Find my eSIM" CTA
       ↓ CTA 또는 하단 탭
[04 Plans]       ★ 이번 디자인 범위 — 상품 선택
       │
       ├─ (1) 체류 일수 선택  ← 필수, 먼저
       └─ (2) 해당 일수 플랜 목록
       ↓ 카드 "Select"
[05 Product]     상품 상세 (별도 handoff)
       ↓
[06 Checkout]    결제 (미오픈)
```

**이번 범위:** `[04 Plans]` — **일수 선택 + 필터된 플랜 목록**을 한 화면(또는 동일 탭 내 연속 스크롤)으로 디자인.

**진입 경로 (모두 동일 화면):**

- 홈 CTA **Find my eSIM**
- 하단 탭 **Find my eSIM** (앱: `plans` 탭)
- 웹: `/simplyur/{locale}/recommend`

로그인 없이(Skip) 탐색 가능합니다.

---

## 2. 화면 목적

**“한국에 며칠 머무는지 고른 다음, 그 기간에 맞는 eSIM 요금제를 고른다.”**

| 순서 | 선택 축 | UI |
|------|---------|-----|
| **1** | **체류 일수** | 상단 **일수 칩 피커** (3 · 5 · 7 · 10 · 15 … — 카탈로그에 있는 일수만) |
| **2** | **네트워크 유형** | 섹션: Roaming vs Local Korean network |
| **3** | **데이터량** | 카드 주요 라벨 (`data_label`) |
| **4** | **가격** | 카드 가격 (`simplyur_display`) |

일수를 고르기 **전**에는 플랜 카드 영역을 비우거나 안내 문구만 표시합니다.  
일수를 고른 **후**에만 해당 `days`에 맞는 상품만 노출합니다.

**도시·지역(서울/부산/제주 등)은 이 화면에서 다루지 않습니다.**

---

## 3. 프레임·플랫폼

| 항목 | 값 |
|------|-----|
| 우선 타깃 | iPhone 앱, 402×874 logical px (portrait) |
| 웹 | 동일 정보 구조, max-width ~512px |
| 하단 탭 | Home · **Find my eSIM** · Install guide (3탭 유지) |

---

## 4. 레이아웃 (top → bottom)

**Frame:** 세로 스크롤, 좌우 패딩 20~28px, 하단 safe area + 탭바 여백.

### 4.1 헤더

| 요소 | 스펙 |
|------|------|
| 국가 뱃지 | pill, 소형 uppercase — `SOUTH KOREA` |
| 타이틀 | `Find your Korea eSIM` — 26px, weight 700~800, `#12233F` |
| 서브카피 | 14px, `#6B7686` — **아래 카피 SSOT 참고** |
| 안내 배너 | 결제 미오픈 안내 (정보성, 구매 CTA 아님) |

### 4.2 ★ 체류 일수 선택 (Duration picker) — 필수

헤더·배너 **아래**, 플랜 목록 **위**에 고정합니다.

| 요소 | 스펙 |
|------|------|
| 라벨 | `How long is your trip?` — 15px, weight 600, `#12233F` |
| 힌트 | `Only trip lengths we sell are shown.` — 12px, `#6B7686` |
| 칩 행 | 가로 스크롤 pill/chip — 예: `3` `5` `7` `10` `15` `30` + `days` 접미 |
| 선택 상태 | 선택 칩: 흰 배경 + coral 테두리/글자 `#FF6B4A` 또는 coral fill + 흰 글자 |
| 미선택 | transparent / muted `#98A0AB` |
| 칩 크기 | 높이 ~48–52px, min-width ~72px, radius 12–16px |
| 푸터 캡션 | `1 day = 24 hours from activation (varies by plan)` — 11px, `#98A0AB` |

**동작**

- 칩 탭 → `selectedDays` 갱신 → 아래 플랜 목록 **즉시 필터**
- 카탈로그에 없는 일수는 칩 자체를 **표시하지 않음**
- 기본값: **미선택** (플랜 영역 placeholder) 또는 **가장 짧은 판매 일수** auto-select — 디자인 2안 모두 제출 권장

**참고 UX (봉심 단일국가):** `DayChipPicker` — 일수 먼저, 그다음 플랜. simplyur는 토큰만 Poppins + coral/navy로 맞춤.

### 4.3 플랜 목록 (일수 선택 후)

선택한 일수에 해당하는 상품만 표시.

#### 4.3a 일수 **미선택** 상태

```
┌─────────────────────────────────────────┐
│  Select your trip length above to       │
│  see available plans.                   │
└─────────────────────────────────────────┘
```

또는 일수 칩 아래 얇은 divider + muted 일러스트/아이콘 (선택).

#### 4.3b 일수 **선택됨** 상태

선택 일수 확인 한 줄 (선택):

`Showing plans for **7 days**` + `Change` 링크 (칩 영역으로 스크롤)

그 아래:

**섹션 A — Roaming network**

- 헤더: `Roaming network` + 해당 일수 그룹 최저가 `From ₩XX,XXX`
- 카드 리스트

**섹션 B — Local Korean network**

- 동일 구조
- 해당 일수 상품 0건이면 섹션 미표시

**해당 일수에 상품 0건**

`No plans for {N} days right now. Try another trip length.`

### 4.4 넣지 말 것

- 국가 선택, 도시·지역 필터, 정렬 UI

---

## 5. 플랜 카드

일수는 **이미 피커에서 선택됨** → 카드에는 **데이터·가격** 중심.  
`days_label`은 카드에 **작게** 넣거나 생략 가능 (중복 방지).

### 데이터 필드 (API)

| 필드 | 예시 | UI (일수 선택 후) |
|------|------|-------------------|
| `data_label` | `Unlimited` / `5GB` / `10GB/day` | **가장 크게** |
| `simplyur_display` | `₩32,000` | 코랄 `#FF6B4A`, weight 800 |
| `network_family` | roaming / local | 섹션으로 구분 — 카드 내 뱃지 선택 |
| CTA | `Select` | pill — 56px·16px radius (로그인 1b와 동일) |

### 카드 와이어 (일수 선택 후)

```
┌─────────────────────────────────────────┐
│  Unlimited                              │
│                                         │
│  ₩32,000                                │
│                                         │
│              [ Select ]                 │
└─────────────────────────────────────────┘
```

로밍/로컬 **두 옵션이 같은 데이터·다른 망**이면, 섹션 헤더로 구분하고 카드는 데이터명 + 가격만.

- 탭 대상: **Select 버튼**
- 동작: 상품 상세로 이동 (이 화면에서 결제 없음)

---

## 6. 상태 (States)

| 상태 | UI |
|------|-----|
| Loading (초기) | 일수 칩 스켈레ton + 플랜 영역 스켈레ton |
| Loaded, **일수 미선택** | 칩 활성 + 플랜 placeholder |
| Loaded, **일수 선택 + 플랜 있음** | 칩 + 필터된 섹션·카드 |
| Loaded, **일수 선택 + 플랜 없음** | 칩 + `No plans for N days…` |
| Error | 짧은 문구 + Retry |
| Checkout disabled | 상단 정보 배너; CTA는 **Select**만 |

---

## 7. 카피 SSOT (영문 기준)

**서울·부산·제주·전국 문구는 사용하지 않습니다.**

| 키 | 문구 |
|----|------|
| Badge | `SOUTH KOREA` |
| Title | `Find your Korea eSIM` |
| Subtitle | `Choose how long you stay, then pick a data plan.` |
| Duration label | `How long is your trip?` |
| Duration hint | `Only trip lengths we sell are shown.` |
| Duration caption | `1 day = 24 hours from activation (varies by plan)` |
| Days suffix (chip) | `days` — 예: `7 days` |
| Plans prompt (no selection) | `Select your trip length above to see available plans.` |
| Plans header (selected) | `Showing plans for {N} days` |
| Change duration | `Change` |
| Banner title | `Checkout opening soon` |
| Banner body | `You can browse plans and read the install guide now. Online payment is being enabled.` |
| Section A | `Roaming network` |
| Section B | `Local Korean network` |
| From price | `From ₩28,000` |
| Card CTA | `Select` |
| Empty (no catalog) | `No plans available right now.` |
| Empty (no match for days) | `No plans for {N} days right now. Try another trip length.` |
| Loading | `Loading plans…` |

5개 언어(en / ja / zh / zh-TW / vi)는 위 의미를 유지해 번역합니다.

---

## 8. 디자인 토큰 (로그인 1b와 동일)

| 토큰 | 값 | 용도 |
|------|-----|------|
| Coral | `#FF6B4A` | 선택 칩, 가격, Select CTA |
| Navy | `#12233F` | 타이틀, 라벨 |
| Muted | `#6B7686` | 서브카피, 힌트 |
| Faint | `#98A0AB` | 캡션, 미선택 칩 |
| Border | `#E1DFD9` | 카드·칩 트레이 테두리 |
| Chip tray bg | `#F5F3F0` 또는 `#FFF4EF` | 일수 칩 가로 스크롤 영역 |
| Background | `#FFF4EF` 또는 `#FAF7F2` | 페이지 배경 — **한 가지로 통일** |
| Font | Poppins 400 / 600 / 700 / 800 | |

Signal Pin: 이 화면 헤더에 **필수 아님**.

---

## 9. Out of scope

- 상품 상세 (`[05 Product]`)
- 결제·체크아웃
- My eSIM
- 국가·도시 선택
- 달력형 시작일·종료일 선택 (다국가 여행용 — simplyur Phase 1 Korea 단일국가는 **일수 칩만**)
- 로그인·오프닝 재디자인
- 설치 가이드 본문

---

## 10. 다음 화면 (참고만)

Select → 상품 상세:

- `plan_summary` (제목, 예: `Korea 7-day Unlimited Roaming`)
- 가격, Network, Duration (`days_label`)
- CTA: 현재 `Checkout opening soon` (disabled)

Plans와 **칩·카드·토큰 연속성**을 맞춥니다.

---

## 11. 산출물 요청

1. **Duration + plans (selected)** — 7일 선택, 로밍+로컬 카드 2~3개 (high-fidelity, iPhone)
2. **Duration only (unselected)** — 칩 + placeholder
3. **No plans for selected days** — 30일 선택했으나 해당 SKU 없음
4. **Variants** — Loading / Error
5. **Component spec** — duration chip picker, plan card, section header, info banner
6. **HTML reference** 1~2파일

---

## 12. 개발 참고

| Surface | Path | 비고 |
|---------|------|------|
| 앱 | `apps/simplyur-mobile/app/(tabs)/plans.tsx` | **일수 피커 미구현** — handoff 기준으로 추가 예정 |
| 웹 | `app/simplyur/[locale]/recommend` | 동일 |
| API | `GET /api/simplyur/products/by-country?locale={locale}` | 전체 카탈로그; **클라이언트에서 `days_raw` 기준 필터** (또는 추후 `?days=` 쿼리) |
| 참고 | `components/bongsim/recommend/DayChipPicker.tsx` | 단일국가 일수 선택 패턴 |

응답: `pack.roaming.products[]`, `pack.local.products[]` — 각 `option_api_id`, `data_label`, `days_label`, `simplyur_display`.  
판매 가능 일수 목록 = 응답 상품의 `days_label` / `days_raw` 유니크 값.

현재 UI는 전체 목록 flat 노출(스켈레톤) — **일수 선행 선택 UX로 교체**가 목표.

---

## 한 줄 요약

> **Find my eSIM** 탭에서 사용자는 **먼저 한국 체류 일수(칩)** 를 고르고, **그 일수에 맞는** 로밍/로컬 플랜만 비교·선택합니다. 도시 카피 없음. Poppins + `#FF6B4A` + `#12233F`. 결제 전이므로 정보 배너 + **Select** CTA만.
