# 배포 직전 (호텔·식사)

## 로컬 dev 전제 (관리자·등록·호텔·식사 확인 전)

- [ ] `/admin`·`/admin/register` 이상 시 **먼저** 실행 중 dev 종료 후 **`npm run dev:clean`** (`docs/DEV-NEXT-CACHE.md`)
- [ ] 브라우저 주소 = 터미널 **`Local:` URL** (호스트·포트 동일)
- [ ] stylesheet / static chunk 오류를 **CSS 코드 버그로만 단정하지 않음** (대부분 `.next` 산출물 꼬임)
- [ ] **기능·보안 수정 전에** dev 서버 상태부터 정상화

---

- [ ] DB: `20260326120000_add_hotel_meal_product_itinerary_fields` 적용 또는 `migrate resolve` 처리됨 (`docs/ops/hotel-meal-migration-runbook.md`)
- [ ] (선택) 포맷터 회귀: `npm run verify:hotel-meal-display`
- [ ] 빌드: **`npm run build`** (직접 `next build` 금지 권장)
- [ ] Admin: 등록 **preview** 1회 이상 확인
- [ ] 상세: **신규·수정 상품** 1건 일정 영역 확인
- [ ] 회귀: **기존 상품** 1건 상세 열림 확인
