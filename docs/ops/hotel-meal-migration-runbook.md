# 호텔/식사 컬럼 마이그레이션 적용

마이그레이션 디렉터리: `prisma/migrations/20260326120000_add_hotel_meal_product_itinerary_fields`

## A. 일반 적용 (로컬·운영 공통)

프로젝트 루트에서:

```bash
npx prisma migrate deploy
npx prisma generate
```

## B. 이미 `db push` 등으로 컬럼이 있는 DB

`migrate deploy` 시 `duplicate column` 등으로 실패하면, **해당 마이그레이션만 적용됨으로 표시**하고 스키마 이력만 맞춘다.

```bash
npx prisma migrate resolve --applied 20260326120000_add_hotel_meal_product_itinerary_fields
npx prisma generate
```

## 확인

```bash
npx prisma validate
```
