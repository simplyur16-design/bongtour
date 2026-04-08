# 봉투어 공통 텍스트 컬러 토큰

전체 팔레트·브랜드·CTA·달력·배지는 **`docs/DESIGN-TOKENS-COLOR.md`** 를 SSOT로 둡니다.

## 원칙

- **제목·상품명**: 가장 진하게 (`--bt-text-title` / `text-bt-title`)
- **본문**: 슬레이트 계열 (`--bt-text-body` / `text-bt-body`)
- **날짜·코드·메타**: 연한 보조 (`--bt-text-meta` / `text-bt-meta`)
- **브랜드 포인트·링크 강조**: 청록 (`--bt-accent`, `text-bt-accent`)
- **가격 숫자**: 본문과 구분 (`--bt-text-price` / `text-bt-price`)
- **미운영·비활성**: 가격처럼 보이지 않게 (`--bt-text-disabled` / `text-bt-disabled`)

## CSS 변수 (`app/globals.css`)

| 변수 | 역할 |
|------|------|
| `--bt-text-strong` | 특히 강한 헤드라인(옵션) |
| `--bt-text-title` | 메인 타이틀·섹션 제목 |
| `--bt-text-body` | 본문 기본 |
| `--bt-text-muted` | 2차 본문 |
| `--bt-text-subtle` | 보조 한 단계 더 약하게 |
| `--bt-text-meta` | 출발일·코드·캡션 |
| `--bt-text-disabled` | 미운영·placeholder |
| `--bt-text-price` | 요금 강조 |
| `--bt-accent` | 브랜드 포인트(배경·테두리와 조합) |

별칭: `--bt-price`, `--bt-disabled` (문서·레거시 호환).

## Tailwind (`tailwind.config.ts`)

`text-bt-title`, `text-bt-body`, `text-bt-meta`, `text-bt-price`, `text-bt-disabled`, `text-bt-strong` 등 `bt.*` 색상 키로 매핑됨.

## 출발일·요금 UI

- 미운영 날짜는 **`text-bt-disabled`** / "미운영" 라벨만 사용, **`text-bt-price` 금지**.
