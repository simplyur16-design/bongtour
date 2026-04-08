# 상품목록 운영 가시성

## 목적

봉투어는 공급사 상품을 검수·정리·상담 연결하는 창구다. 상품목록(`/admin/products`)에서 운영자가 **무슨 상품을 먼저 손봐야 하는지** 한눈에 판단할 수 있도록 운영 가시성을 강화한다. 상품 내용/일정 원문은 건드리지 않는다.

## 현재 표시 항목

- **이미지 셀** (별도 출처 컬럼 없이 셀 안에서 처리)
  - 없음: `—`
  - 있음: 1줄 `있음` 배지, 2줄 **출처 배지** (pexels, gemini, destination-set, photopool, manual, city-asset, attraction-asset, legacy)
- **상태**: registered / pending / on_hold / rejected + 수집 에러·데이터 불완전 배지
- **분류**: 대표 지역 · 노출 카테고리 · 테마(앞일부) 한 줄 요약, 툴팁에 전체

## legacy 규칙

- **정의**: 대표 이미지는 있으나 `bgImageSource`가 비어 있는 경우.
- **표시**: 회색 `legacy` 배지. 과거 등록·이전 시스템에서 저장된 상품에 해당.
- **예상 외 source 값**: DB에 알 수 없는 문자열이 들어 있어도 화면에서는 `legacy`로 안전 표시.

## API·타입

- `GET /api/admin/products/list`: `hasPrimaryImage`, `bgImageSource`, `primaryRegion`, `displayCategory`, `themeTags`, `registrationStatus` 등 포함.
- `ProductRow` 타입에 위 필드 반영.

## 후속 확장 TODO

- **source 필터**: 목록 상단에 "출처: 전체 / Pexels / Gemini / legacy / …" 필터 추가.
- **legacy만 보기**: `bgImageSource` 없음 또는 legacy인 상품만 노출 옵션.
- **pexels/gemini 비중 KPI**: 상단 KPI에 "대표 이미지: Pexels N건, Gemini M건, legacy K건" 등 집계.
- **썸네일 호버 미리보기**: 이미지 셀 호버 시 `bgImageUrl` 썸네일 툴팁/팝오버.
