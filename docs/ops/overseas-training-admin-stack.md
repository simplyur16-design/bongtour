# 국외연수 프로그램 — 관리자·공개 스택 (SSOT)

**범위:** `listingKind: overseas_training` 전용. 6공급사 `parse-and-register-*` 와 분리.

## 공개 URL

| 경로 | 용도 |
|------|------|
| `/business` | 서비스 허브 + 프로그램 미리보기 |
| `/business/programs` | 프로그램 목록 (공무/기업·분야 필터) |
| `/business/programs/[slug]` | 프로그램 상세 (가격·예약 없음) |

상세 **상세일정** 탭: `fixedDepartureWeekday` 기준 **1년 달력** — 출발 요일 날짜 선택 시 `DAY n · M월 D일` 예시 일정 표시 (`lib/overseas-training-departure-calendar.ts`, `TrainingDepartureYearCalendar`).

`/products` browse 에는 노출하지 않음.

## 관리자 URL

| 경로 | 용도 |
|------|------|
| `/admin/training-programs` | 목록 |
| `/admin/training-programs/new` | 등록 (윈저 paste 분할) |
| `/admin/training-programs/[id]` | 편집 |
| `/admin/training-programs/guide` | in-app 운영 가이드 |

## API

| Method | Path |
|--------|------|
| GET/POST | `/api/admin/training-programs` |
| GET/PATCH | `/api/admin/training-programs/[id]` |
| POST | `/api/admin/training-programs/parse-windsor-paste` |
| POST | `/api/admin/training-programs/suggest-title` |
| POST | `/api/admin/gemini/image-generate` (`profile: overseas_training`) |

## lib SSOT

| 파일 | 역할 |
|------|------|
| `lib/overseas-training-taxonomy.ts` | 분야·audience |
| `lib/overseas-training-weekday.ts` | 화요일 출발 등 메타 문구 |
| `lib/overseas-training-program-query.ts` | 공개 목록/상세 |
| `lib/overseas-training-admin.ts` | 관리자 CRUD |
| `lib/overseas-training-parse-windsor.ts` | paste → 3블록 |
| `lib/bongtour-training-product-title.ts` | 노출 제목 LLM |
| `lib/gemini-image-prompt.ts` | 연수 이미지 2슬롯 |

## Product 필드

- `listingKind`: `overseas_training`
- `fixedDepartureWeekday`, `durationDays`, `trainingCategory`, `trainingAudience`
- `trainingDescription`, `prepChecklistJson`, `schedule`
- `priceFrom`: null, `ProductDeparture` 미사용

## 회귀

```bash
npx tsx scripts/verify-overseas-training-taxonomy.ts
npx tsx scripts/verify-inquiry-notification-format.ts
```

## 관련

- `docs/ADMIN-IA-IMPLEMENTATION.md` — 사이드바 그룹
- 문의: `overseas_training_quote`, `TrainingInquiryForm`
